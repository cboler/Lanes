import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { BattlefieldComponent } from './battlefield.component';
import { BattleStateService } from '../core/services/battle-state.service';

describe('BattlefieldComponent', () => {
  let component: BattlefieldComponent;
  let fixture: ComponentFixture<BattlefieldComponent>;
  let battleService: BattleStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BattlefieldComponent],
      providers: [provideRouter([]), BattleStateService],
    }).compileComponents();

    fixture = TestBed.createComponent(BattlefieldComponent);
    component = fixture.componentInstance;
    battleService = TestBed.inject(BattleStateService);
    fixture.detectChanges();
  });

  it('initializes the component with a 3-lane battlefield', () => {
    expect(component).toBeTruthy();
    expect(battleService.units().length).toBe(8);
    expect(fixture.nativeElement.querySelectorAll('.combat-lane').length).toBe(3);
  });

  it('renders initiative tokens and quick utility buttons', () => {
    const tokens = fixture.nativeElement.querySelectorAll('.turn-token');
    expect(tokens.length).toBeGreaterThan(0);

    const restartBtn = fixture.nativeElement.querySelector('#restart-battle-btn');
    expect(restartBtn).toBeTruthy();
  });

  it('handles keyboard shortcuts for movement', () => {
    const active = battleService.activeUnit();
    if (active && active.team === 'player') {
      const initialPos = active.positionX;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
      expect(active.positionX).toBeGreaterThan(initialPos);
    }
  });
});
