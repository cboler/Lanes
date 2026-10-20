import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CAMPAIGN } from '../core/models/campaign-story';
import { Mission, StoryLine, missionContract, tellLine } from '../core/models/campaign.model';
import { getClassDefinition } from '../core/models/unit-class.model';
import { BattleStateService } from '../core/services/battle-state.service';
import { CampaignService } from '../core/services/campaign.service';
import { GamepadService } from '../core/services/gamepad.service';
import { RosterService } from '../core/services/roster.service';

interface Scene {
  readonly mission: Mission;
  readonly kind: 'briefing' | 'debrief';
  readonly index: number;
}

/** The campaign: chapters of story missions, each told in a scene before and after its battle. */
@Component({
  selector: 'app-campaign',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './campaign.component.html',
  styleUrl: './campaign.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignComponent {
  protected readonly campaign = inject(CampaignService);
  private readonly roster = inject(RosterService);
  private readonly battle = inject(BattleStateService);
  private readonly router = inject(Router);
  private readonly pad = inject(GamepadService);
  protected readonly chapters = CAMPAIGN;
  protected readonly total = CAMPAIGN.reduce((sum, chapter) => sum + chapter.missions.length, 0);
  protected readonly scene = signal<Scene | null>(null);
  private readonly sceneButton = viewChild<ElementRef<HTMLButtonElement>>('sceneNext');

  private readonly leader = computed(() => this.roster.squad()[0]);

  /** The scene's current line, with the leader's name filled in. */
  protected readonly line = computed(() => {
    const scene = this.scene();
    if (!scene) return null;
    const lines = scene.kind === 'briefing' ? scene.mission.briefing : scene.mission.debrief;
    return {
      ...tellLine(lines[scene.index], this.leader()?.name ?? 'Captain'),
      number: scene.index + 1,
      count: lines.length,
      last: scene.index === lines.length - 1,
    };
  });

  constructor() {
    // After a story battle is won, the result screen sends the player here for the debrief.
    const debrief = inject(ActivatedRoute).snapshot.queryParamMap.get('debrief');
    const mission = debrief ? this.campaign.mission(debrief) : null;
    if (mission?.debrief.length && this.campaign.isCleared(mission.id)) {
      this.scene.set({ mission, kind: 'debrief', index: 0 });
    }
    // Each new line takes focus, so Enter, Space or a controller's A reads on.
    effect(() => {
      if (!this.line()) return;
      const button = this.sceneButton()?.nativeElement;
      if (this.pad.connected()) this.pad.focus(button);
      else button?.focus();
    });
  }

  protected portrait(line: StoryLine): string | null {
    const classId = line.portrait === 'leader' ? this.leader()?.classId : line.portrait;
    return classId ? getClassDefinition(classId).portraitUrl : null;
  }

  protected classPortrait(classId: string): string {
    return getClassDefinition(classId).portraitUrl;
  }

  protected className(classId: string): string {
    return getClassDefinition(classId).name;
  }

  protected begin(mission: Mission): void {
    if (!this.campaign.isUnlocked(mission.id)) return;
    if (mission.briefing.length) this.scene.set({ mission, kind: 'briefing', index: 0 });
    else this.deploy(mission);
  }

  protected epilogue(mission: Mission): void {
    this.scene.set({ mission, kind: 'debrief', index: 0 });
  }

  /** Reads on; the briefing's last line sends the squad into battle. */
  protected advance(): void {
    const scene = this.scene();
    const line = this.line();
    if (!scene || !line) return;
    if (!line.last) this.scene.set({ ...scene, index: scene.index + 1 });
    else if (scene.kind === 'briefing') this.deploy(scene.mission);
    else this.close();
  }

  /** Skipping a briefing goes straight to battle; skipping a debrief closes it. */
  protected skip(): void {
    const scene = this.scene();
    if (scene?.kind === 'briefing') this.deploy(scene.mission);
    else this.close();
  }

  protected close(): void {
    this.scene.set(null);
    // Drop ?debrief so a reload does not replay the scene.
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  private deploy(mission: Mission): void {
    this.scene.set(null);
    this.battle.deployContract(missionContract(mission), this.roster.squad());
    void this.router.navigate(['/battle']);
  }
}
