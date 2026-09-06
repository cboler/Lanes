import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
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

  it('deploys selected formation into battle service', () => {
    component['deployToBattle']();
    expect(battleService.units().length).toBe(6);
    expect(battleService.playerUnits().length).toBe(3);
    expect(battleService.enemyUnits().length).toBe(3);
  });
});
