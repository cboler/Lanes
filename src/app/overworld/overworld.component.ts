import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  HostListener,
  Injector,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  MAP_EDGES,
  MAP_NODES,
  MapNode,
  PATROLS,
  advanceExpedition,
  neighbors,
  nodeAt,
  patrolPosition,
} from '../core/models/overworld.model';
import { OverworldService } from '../core/services/overworld.service';
import { RosterService } from '../core/services/roster.service';
import { BattleStateService } from '../core/services/battle-state.service';
import { GamepadService } from '../core/services/gamepad.service';
import { TIERS } from '../core/models/contract.model';
import { itemName } from '../core/models/item.model';
import { Mission, StoryLine, tellLine } from '../core/models/campaign.model';
import { getClassDefinition } from '../core/models/unit-class.model';

@Component({
  selector: 'app-overworld',
  imports: [RouterLink],
  templateUrl: './overworld.component.html',
  styleUrls: ['./overworld.component.scss', './overworld-tactics.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverworldComponent implements OnDestroy {
  protected readonly world = inject(OverworldService);
  protected readonly roster = inject(RosterService);
  protected readonly battle = inject(BattleStateService);
  protected readonly pad = inject(GamepadService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  protected readonly nodes = MAP_NODES;
  protected readonly edges = MAP_EDGES.map(([a, b]) => ({ a: nodeAt(a), b: nodeAt(b) }));
  protected readonly current = computed(() => nodeAt(this.world.state().position));
  protected readonly choices = computed(() => neighbors(this.world.state().position));
  protected readonly patrols = computed(() =>
    [
      ...(this.world.story() ? [this.world.story()!] : []),
      ...PATROLS.filter((p) => !this.world.state().defeated.includes(p.id)),
    ].map((patrol) => ({
      ...patrol,
      node: nodeAt(patrolPosition(patrol, this.world.state().turn)),
      next: nodeAt(patrolPosition(patrol, this.world.state().turn + 1)),
    })),
  );
  protected readonly moving = signal(false);
  protected readonly help = signal(false);
  protected readonly scouting = signal(false);
  protected readonly dialog = signal<'patrol' | 'complete' | 'story' | null>(null);
  protected readonly scene = signal<{
    mission: Mission;
    kind: 'briefing' | 'debrief';
    index: number;
  } | null>(null);
  protected readonly line = computed(() => {
    const scene = this.scene();
    if (!scene) return null;
    const lines = scene.kind === 'briefing' ? scene.mission.briefing : scene.mission.debrief;
    return {
      ...tellLine(lines[scene.index], this.roster.squad()[0]?.name ?? 'Captain'),
      number: scene.index + 1,
      count: lines.length,
      last: scene.index === lines.length - 1,
    };
  });
  protected readonly commissionNode = computed(() =>
    this.world.campaign.next()
      ? nodeAt(patrolPosition(this.world.story()!, this.world.state().turn))
      : null,
  );
  private readonly inspectedPatrol = signal('');
  protected readonly inspectedEnemy = computed(() =>
    this.patrols().find((p) => p.id === this.inspectedPatrol()),
  );
  protected readonly inspectedSquad = computed(
    () => this.world.contract(this.inspectedPatrol())?.enemies ?? [],
  );
  protected readonly cacheCount = MAP_NODES.filter((node) => node.gold || node.item).length;
  protected readonly tiers = TIERS;
  protected readonly patrolCount = PATROLS.length;
  protected readonly recovered = computed(() =>
    MAP_NODES.filter((node) => this.world.state().collected.includes(node.id)),
  );
  protected readonly recoveredGold = computed(() =>
    this.recovered().reduce((sum, node) => sum + (node.gold ?? 0), 0),
  );
  protected readonly itemName = itemName;
  protected readonly selected = signal('trail');
  protected readonly selectedNode = computed(() => nodeAt(this.selected()));
  protected readonly pendingBattle = computed(
    () => this.battle.units().length > 0 && this.battle.battleStatus() === 'active',
  );
  private timer: ReturnType<typeof setTimeout> | undefined;
  private returnFocus: HTMLElement | null = null;

  constructor() {
    const query = inject(ActivatedRoute).snapshot.queryParamMap;
    this.document.body.classList.add('overworld-screen');
    this.selected.set(
      this.choices().find((node) => node.x > this.current().x)?.id ?? this.choices()[0].id,
    );
    afterNextRender(() => {
      this.panToCompany(false);
      const debrief = this.world.campaign.mission(query.get('debrief') ?? '');
      const commission = this.world.campaign.mission(query.get('commission') ?? '');
      if (debrief && this.world.campaign.isCleared(debrief.id)) this.showStory(debrief, 'debrief');
      else if (this.world.encounter() && !this.pendingBattle()) this.engage();
      else if (commission && this.world.campaign.isUnlocked(commission.id))
        this.showStory(commission, 'briefing');
    });
    effect(() => {
      if (!this.pad.connected()) return;
      afterNextRender(
        () => {
          if (this.document.querySelector('dialog[open]:not(#field-dialog)')) return;
          const control = this.dialog()
            ? this.dialog() === 'story'
              ? 'scene-next-btn'
              : 'field-return-btn'
            : this.world.encounter()
              ? 'engage-patrol'
              : 'march-btn';
          this.pad.focus(
            this.document.getElementById(control) ?? this.document.getElementById('scout-btn'),
          );
        },
        { injector: this.injector },
      );
    });
    this.pad.actions.pipe(takeUntilDestroyed()).subscribe((action) => {
      if (action === 'cancel') this.help.set(false);
      if (this.dialog()) return;
      if (action === 'assist') this.scouting.update((value) => !value);
      if (action === 'end-turn') this.move(this.current().id);
      if (action === 'move-left' || action === 'move-up') this.cycle(-1);
      if (action === 'move-right' || action === 'move-down') this.cycle(1);
    });
  }

  ngOnDestroy(): void {
    this.document.body.classList.remove('overworld-screen');
    clearTimeout(this.timer);
  }

  protected available(node: MapNode): boolean {
    return this.choices().some((choice) => choice.id === node.id);
  }

  protected label(node: MapNode): string {
    const loot = !this.world.state().collected.includes(node.id)
      ? node.gold
        ? ` · ${node.gold} gold`
        : node.item
          ? ` · ${node.item === 'tactics' ? 'Tactics' : 'Charm'} Scroll`
          : ''
      : ' · collected';
    return `${node.name}${loot}${node.kind === 'goal' ? ' · expedition objective' : ''}`;
  }

  protected inspect(node: MapNode): void {
    this.selected.set(node.id);
  }

  /** Preview with the actual turn resolver so crossing and landing warnings match combat. */
  protected contact(destination: string) {
    const next = advanceExpedition(this.world.state(), destination, this.world.story());
    return this.patrols().find((patrol) => patrol.id === next.encounter);
  }

  protected inspectEnemy(id: string): void {
    if (this.moving()) return;
    this.inspectedPatrol.set(id);
    this.showDialog('patrol');
  }

  protected showDialog(kind: 'patrol' | 'complete' | 'story'): void {
    this.returnFocus = this.document.activeElement as HTMLElement | null;
    this.help.set(false);
    this.dialog.set(kind);
    afterNextRender(
      () => {
        const dialog = this.document.querySelector<HTMLDialogElement>('#field-dialog');
        if (!dialog || this.dialog() !== kind) return;
        dialog.showModal();
        const button = this.document.getElementById(
          kind === 'story' ? 'scene-next-btn' : 'field-return-btn',
        );
        if (this.pad.connected()) this.pad.focus(button);
        else button?.focus();
      },
      { injector: this.injector },
    );
  }

  protected closeDialog(event?: Event): void {
    event?.preventDefault();
    this.document.querySelector<HTMLDialogElement>('#field-dialog')?.close();
    this.dialog.set(null);
    this.scene.set(null);
    if (this.router.url.includes('?'))
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    const previous = this.returnFocus;
    const control =
      previous?.isConnected &&
      previous.matches('button, a, [tabindex]') &&
      !previous.matches(':disabled')
        ? previous
        : (this.document.getElementById('march-btn') ?? this.document.getElementById('scout-btn'));
    if (this.pad.connected()) this.pad.focus(control);
    else control?.focus({ preventScroll: true });
  }

  protected move(id: string): void {
    if (
      this.moving() ||
      this.pendingBattle() ||
      this.help() ||
      this.dialog() ||
      this.document.querySelector('dialog[open]')
    )
      return;
    const previous = this.current().id;
    const wasComplete = this.world.state().complete;
    if (!this.world.step(id)) return;
    this.moving.set(true);
    this.selected.set(this.choices().find((n) => n.id !== previous)?.id ?? this.choices()[0].id);
    this.panToCompany();
    this.timer = setTimeout(() => {
      this.moving.set(false);
      if (this.world.encounter()) {
        this.engage();
        return;
      }
      if (!wasComplete && this.world.state().complete) {
        this.showDialog('complete');
        return;
      }
      // Wait for Angular to enable the control before asking the browser to focus it.
      afterNextRender(
        () => {
          if (this.document.querySelector('dialog[open]')) return;
          const control = this.document.getElementById(
            this.world.encounter() ? 'engage-patrol' : 'march-btn',
          );
          if (this.pad.connected() && control) this.pad.focus(control);
        },
        { injector: this.injector },
      );
    }, 500);
  }

  private panToCompany(animate = true): void {
    const viewport = this.document.querySelector<HTMLElement>('.map-scroll');
    const board = this.document.querySelector<HTMLElement>('.board');
    if (!viewport || !board) return;
    const reduced = this.document.defaultView?.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    viewport.scrollTo({
      left: (board.clientWidth * this.current().x) / 100 - viewport.clientWidth / 2,
      top: (board.clientHeight * this.current().y) / 100 - viewport.clientHeight * 0.6,
      behavior: animate && !reduced ? 'smooth' : 'instant',
    });
  }

  protected engage(): void {
    if (this.pendingBattle()) {
      void this.router.navigate(['/battle']);
      return;
    }
    const contract = this.world.contract();
    if (!contract) return;
    if (contract.missionId && !this.world.campaign.accepted().includes(contract.missionId)) {
      this.showStory(this.world.campaign.mission(contract.missionId)!, 'briefing');
      return;
    }
    this.battle.deployContract(contract, this.roster.squad());
    void this.router.navigate(['/battle']);
  }

  protected showStory(mission: Mission, kind: 'briefing' | 'debrief'): void {
    if (this.moving()) return;
    this.scene.set({ mission, kind, index: 0 });
    this.showDialog('story');
  }

  protected portrait(line: StoryLine): string | null {
    const id = line.portrait === 'leader' ? this.roster.squad()[0]?.classId : line.portrait;
    return id ? getClassDefinition(id).portraitUrl : null;
  }

  protected advanceStory(skip = false): void {
    const scene = this.scene();
    if (!scene) return;
    if (!skip && !this.line()?.last) {
      this.scene.update((s) => ({ ...s!, index: s!.index + 1 }));
      this.document.getElementById('scene-next-btn')?.focus();
      return;
    }
    if (scene.kind === 'briefing') this.world.campaign.accept(scene.mission.id);
    this.closeDialog();
    if (this.world.state().encounter === `story:${scene.mission.id}`) this.engage();
  }

  private cycle(direction: number): void {
    const choices = this.choices();
    const index = choices.findIndex((n) => n.id === this.selected());
    this.selected.set(choices[(index + direction + choices.length) % choices.length].id);
  }

  @HostListener('document:keydown', ['$event'])
  protected key(event: KeyboardEvent): void {
    if (this.document.querySelector('dialog[open]:not(#field-dialog)')) return;
    if (event.key === 'Tab' && this.dialog()) {
      const controls = this.document.querySelectorAll<HTMLElement>(
        '#field-dialog button, #field-dialog a[href]',
      );
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (this.document.activeElement === (event.shiftKey ? first : last)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
      return;
    }
    if (event.key === 'Escape') {
      if (this.dialog()) this.closeDialog(event);
      this.help.set(false);
      return;
    }
    if (
      event.repeat ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      this.dialog() ||
      /INPUT|SELECT|TEXTAREA/.test((event.target as HTMLElement)?.tagName)
    )
      return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.cycle(-1);
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.cycle(1);
    }
    if (event.key.toLowerCase() === 'm') {
      event.preventDefault();
      this.move(this.selected());
    }
    if (event.key.toLowerCase() === 'v') {
      event.preventDefault();
      this.scouting.update((value) => !value);
    }
    if (event.code === 'Space' && event.target === this.document.body) {
      event.preventDefault();
      this.move(this.current().id);
    }
  }
}
