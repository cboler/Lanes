import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SquadSelectComponent } from './squad-select.component';
import { BattleStateService } from '../core/services/battle-state.service';
import { RosterService } from '../core/services/roster.service';
import { ALL_CLASSES } from '../core/models/unit-class.model';

describe('SquadSelectComponent', () => {
  let component: SquadSelectComponent;
  let fixture: ComponentFixture<SquadSelectComponent>;
  let battleService: BattleStateService;
  let roster: RosterService;

  const element = (): HTMLElement => fixture.nativeElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SquadSelectComponent],
      providers: [provideRouter([]), BattleStateService],
    }).compileComponents();

    fixture = TestBed.createComponent(SquadSelectComponent);
    component = fixture.componentInstance;
    battleService = TestBed.inject(BattleStateService);
    roster = TestBed.inject(RosterService);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('renders the roster squad, its reserves, and all 6 classes to inspect', () => {
    expect(component).toBeTruthy();
    const names = Array.from(element().querySelectorAll('.squad-card.player .slot-name'), (el) =>
      el.textContent?.trim(),
    );
    expect(names).toEqual(roster.squad().map((merc) => merc.name));
    expect(element().querySelectorAll('.reserve-btn')).toHaveLength(
      roster.mercenaries().length - roster.squad().length,
    );
    expect(element().querySelectorAll('.class-pick-btn')).toHaveLength(6);
  });

  it('adds and removes mercenaries through the roster, keeping one to four', () => {
    const squad = roster.squad();
    component['toggleMercenary'](squad[0]);
    expect(roster.squad()).toHaveLength(squad.length - 1);
    const reserve = component['reserves']()[0];
    component['toggleMercenary'](reserve);
    expect(roster.squadIds()).toContain(reserve.id);

    for (const merc of roster.mercenaries()) component['toggleMercenary'](merc);
    for (const merc of roster.mercenaries()) component['toggleMercenary'](merc);
    expect(roster.squad().length).toBeGreaterThanOrEqual(1);
    expect(roster.squad().length).toBeLessThanOrEqual(4);
  });

  it('keeps the opponent squad between one and four members', () => {
    for (let i = 0; i < 5; i++) component['removeEnemyUnit'](0);
    expect(component['enemySquad']()).toHaveLength(1);
    for (let i = 0; i < 5; i++) component['addEnemyUnit'](ALL_CLASSES[1]);
    fixture.detectChanges();
    expect(component['enemySquad']()).toHaveLength(4);
    expect(element().querySelector<HTMLButtonElement>('#add-to-enemy-squad-btn')!.disabled).toBe(
      true,
    );
  });

  it('explains automatic front and rear starting positions across three lanes', () => {
    const positions = Array.from(
      element().querySelectorAll('.squad-card.player .slot-position'),
      (el) => el.textContent?.trim(),
    );
    const expected = roster.squad().map((merc, index) => {
      const role = roster.classOf(merc).role;
      const rank = role === 'tank' || role === 'melee' ? 'Front' : 'Rear';
      return `${rank} · Lane ${['I', 'II', 'III'][index % 3]}`;
    });
    expect(positions).toEqual(expected);
  });

  it('updates the dossier with the selected archetype and resource stats', () => {
    const witch = ALL_CLASSES[3];
    const buttons = Array.from(element().querySelectorAll<HTMLButtonElement>('.class-pick-btn'));
    buttons[3].click();
    fixture.detectChanges();

    expect(element().querySelector('.archetype-label')!.textContent).toContain('Magic');
    const stats = Array.from(element().querySelectorAll('.resource-stats strong'), (el) =>
      Number(el.textContent),
    );
    expect(stats).toEqual([
      witch.baseStats.agility,
      witch.baseStats.vitality,
      witch.baseStats.technique,
    ]);
    expect(buttons[3].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('deploys the mercenaries, named and with their stats, against the opponents', () => {
    component['removeEnemyUnit'](0);
    fixture.detectChanges();
    const deployButton = element().querySelector<HTMLButtonElement>('#deploy-squad-btn')!;
    expect(deployButton.textContent).toContain(`(${roster.squad().length} vs 3)`);
    deployButton.click();
    expect(battleService.playerUnits().map((unit) => unit.name)).toEqual(
      roster.squad().map((merc) => merc.name),
    );
    expect(battleService.enemyUnits()).toHaveLength(3);
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/battle']);
  });
});
