import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SquadSelectComponent } from './squad-select.component';
import { BattleStateService } from '../core/services/battle-state.service';
import { ALL_CLASSES } from '../core/models/unit-class.model';

describe('SquadSelectComponent', () => {
  let component: SquadSelectComponent;
  let fixture: ComponentFixture<SquadSelectComponent>;
  let battleService: BattleStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SquadSelectComponent],
      providers: [provideRouter([]), BattleStateService],
    }).compileComponents();

    fixture = TestBed.createComponent(SquadSelectComponent);
    component = fixture.componentInstance;
    battleService = TestBed.inject(BattleStateService);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('renders squad builder and all 6 selectable classes', () => {
    expect(component).toBeTruthy();
    const classBtns = fixture.nativeElement.querySelectorAll('.class-pick-btn');
    expect(classBtns.length).toBe(6);
  });

  it('allows adding and removing units from player squad', () => {
    const initialCount = component['playerSquad']().length;
    // Remove one unit
    component['removePlayerUnit'](0);
    expect(component['playerSquad']().length).toBe(initialCount - 1);

    // Add Witch
    component['addPlayerUnit'](ALL_CLASSES[3]);
    expect(component['playerSquad']().length).toBe(initialCount);
  });

  it('keeps each squad between one and four members', () => {
    for (let i = 0; i < 5; i++) {
      component['removePlayerUnit'](0);
      component['removeEnemyUnit'](0);
    }
    fixture.detectChanges();
    expect(component['playerSquad']().length).toBe(1);
    expect(component['enemySquad']().length).toBe(1);
    const removeButtons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.slot-remove-btn'),
    );
    expect(removeButtons.every((button) => button.disabled)).toBe(true);

    for (let i = 0; i < 5; i++) {
      component['addPlayerUnit'](ALL_CLASSES[0]);
      component['addEnemyUnit'](ALL_CLASSES[1]);
    }
    fixture.detectChanges();
    expect(component['playerSquad']().length).toBe(4);
    expect(component['enemySquad']().length).toBe(4);
    expect(fixture.nativeElement.querySelector('#add-to-player-squad-btn').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('#add-to-enemy-squad-btn').disabled).toBe(true);
  });

  it('explains automatic front and rear starting positions across three lanes', () => {
    const positions = Array.from(
      fixture.nativeElement.querySelectorAll('.squad-card.player .slot-position'),
      (element) => (element as HTMLElement).textContent?.trim(),
    );
    expect(positions).toEqual([
      'Front · Lane I',
      'Rear · Lane II',
      'Rear · Lane III',
      'Front · Lane I',
    ]);
  });

  it('updates the dossier with the selected archetype and resource stats', () => {
    const witch = ALL_CLASSES[3];
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.class-pick-btn'),
    );
    buttons[3].click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.archetype-label').textContent).toContain('Magic');
    const stats = Array.from(
      fixture.nativeElement.querySelectorAll('.resource-stats strong'),
      (element) => Number((element as HTMLElement).textContent),
    );
    expect(stats).toEqual([
      witch.baseStats.agility,
      witch.baseStats.vitality,
      witch.baseStats.technique,
    ]);
    expect(buttons[3].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('deploys selected formation into battle service', () => {
    component['deployToBattle']();
    expect(battleService.units().length).toBe(8);
    expect(battleService.playerUnits().length).toBe(4);
    expect(battleService.enemyUnits().length).toBe(4);
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/']);
  });

  it('shows and deploys the actual sizes of smaller formations', () => {
    component['removePlayerUnit'](0);
    component['removeEnemyUnit'](0);
    component['removeEnemyUnit'](0);
    fixture.detectChanges();
    const deployButton: HTMLButtonElement =
      fixture.nativeElement.querySelector('#deploy-squad-btn');
    expect(deployButton.textContent).toContain('(3 vs 2)');
    deployButton.click();

    expect(battleService.playerUnits().length).toBe(3);
    expect(battleService.enemyUnits().length).toBe(2);
  });
});
