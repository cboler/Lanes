import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BattleStateService, COLLISION_BUFFER } from './battle-state.service';
import {
  FIGHTER_CLASS,
  ARCHER_CLASS,
  CLERIC_CLASS,
  GUNNER_CLASS,
  LANCER_CLASS,
} from '../models/unit-class.model';
import { CHAIN_WINDOW } from '../engine/execution';
import { generateContract } from '../models/contract.model';
import { StatusEffectInstance } from '../models/status-effect.model';
import {
  generateMercenary,
  generateStarterRoster,
  seededRandom,
  deriveCombatStats,
} from '../models/mercenary.model';
import { createDefaultDefensePlan } from '../models/defense-plan.model';

/** A defense mercenary with neutral stats, so it fights exactly like the Fighter class. */
const defender = {
  ...generateMercenary('fighter', seededRandom(11)),
  stats: { str: 17, mag: 17, tec: 17, vit: 17, stm: 17, spi: 17, agi: 17, con: 17, sp: 10 },
};

describe('BattleStateService', () => {
  let service: BattleStateService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new BattleStateService();
  });

  afterEach(() => {
    service.suspend();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('initializes skirmish with 4 player and 4 enemy units across lanes with vanguard positioning', () => {
    service.initSkirmish();

    expect(service.units().length).toBe(8);
    expect(service.playerUnits().length).toBe(4);
    expect(service.enemyUnits().length).toBe(4);
    expect(service.activeUnit()).not.toBeNull();
    expect(service.battleStatus()).toBe('active');
    expect(service.roundNumber()).toBe(1);

    // Fighter (tank) should be in frontline (0.32), Archer/Cleric in rear (0.14)
    const playerFighter = service.playerUnits().find((u) => u.classDef.id === 'fighter')!;
    const playerArcher = service.playerUnits().find((u) => u.classDef.id === 'archer')!;
    expect(playerFighter.positionX).toBeGreaterThan(playerArcher.positionX);
  });

  it('switches lane for active player unit when affordable and unblocked', () => {
    service.initSkirmish([FIGHTER_CLASS], [FIGHTER_CLASS]);
    const active = service.activeUnit();
    expect(active).not.toBeNull();
    expect(active?.team).toBe('player');
    expect(active?.lane).toBe(0);

    const switched = service.switchActiveUnitLane(1);
    expect(switched).toBe(true);
    expect(service.activeUnit()?.lane).toBe(1);
  });

  it('prevents lane switch if target lane space is occupied by another unit', () => {
    service.initSkirmish([FIGHTER_CLASS], [FIGHTER_CLASS]);
    const active = service.activeUnit()!;
    // Place enemy in lane 1 at the exact same positionX
    const enemy = service.enemyUnits()[0];
    enemy.lane = 1;
    enemy.positionX = active.positionX;

    const switched = service.switchActiveUnitLane(1);
    expect(switched).toBe(false);
    expect(active.lane).toBe(0);
    expect(service.combatLogs()[0]).toContain('space occupied');
  });

  it('moves active player unit horizontally in lane and blocks collision', () => {
    service.initSkirmish([FIGHTER_CLASS], [FIGHTER_CLASS]);
    const active = service.activeUnit()!;
    const initialPos = active.positionX;

    const moved = service.moveActiveUnit(0.1);
    expect(moved).toBe(true);
    expect(active.positionX).toBeCloseTo(initialPos + 0.1, 3);

    // Place an obstacle in same lane ahead of unit
    const enemy = service.enemyUnits()[0];
    enemy.lane = active.lane;
    enemy.positionX = active.positionX + 0.1;

    // Moving forward should stop at collision buffer
    service.moveActiveUnit(0.2);
    expect(active.positionX).toBeLessThanOrEqual(enemy.positionX - COLLISION_BUFFER + 0.001);
  });

  it('allows selecting abilities and detects valid targets', () => {
    service.initSkirmish([ARCHER_CLASS], [CLERIC_CLASS]);
    const active = service.activeUnit()!;

    // Select Quick Shot (single-enemy in same lane)
    const quickShot = active.classDef.abilities[0];
    service.selectAbility(quickShot.id);
    expect(service.selectedAbility()?.id).toBe(quickShot.id);

    const valid = service.validTargets();
    expect(valid.length).toBe(1);
    expect(valid[0].team).toBe('enemy');
  });

  it('executes ability and updates logs and damage', () => {
    service.initSkirmish([FIGHTER_CLASS], [FIGHTER_CLASS]);
    const active = service.activeUnit()!;
    const enemy = service.enemyUnits()[0];
    const initialHp = enemy.currentHp;

    service.selectAbility(active.classDef.abilities[0].id);
    const executed = service.executeSelectedAbility(enemy);

    expect(executed).toBe(true);
    expect(enemy.currentHp).toBeLessThan(initialHp);
    expect(service.combatLogs().length).toBeGreaterThan(2);
  });

  it('toggles auto battle and auto battle speed', () => {
    expect(service.isAutoBattle()).toBe(false);
    service.toggleAutoBattle();
    expect(service.isAutoBattle()).toBe(true);
    service.toggleAutoBattle();
    expect(service.isAutoBattle()).toBe(false);

    expect(service.autoBattleSpeed()).toBe('1x');
    service.toggleAutoSpeed();
    expect(service.autoBattleSpeed()).toBe('2x');
  });

  it('spends independent movement and action gauges', () => {
    service.initSkirmish([ARCHER_CLASS], [FIGHTER_CLASS]);
    const unit = service.activeUnit()!;
    expect(service.moveActiveUnit(0.04)).toBe(true);
    expect(unit.moveGauge.current).toBe(98);
    expect(unit.actionGauge.current).toBe(100);
    service.selectAbility('quick_shot');
    expect(service.executeSelectedAbility()).toBe(true);
    expect(unit.moveGauge.current).toBe(98);
    expect(unit.actionGauge.current).toBe(80);
    expect(service.switchActiveUnitLane(1)).toBe(true);
    expect(unit.moveGauge.current).toBe(83);
    expect(unit.actionGauge.current).toBe(80);
  });

  it('guards until its own next turn and recovers only that unit on turn start', () => {
    service.initSkirmish([ARCHER_CLASS, CLERIC_CLASS], [FIGHTER_CLASS]);
    const archer = service.activeUnit()!;
    const cleric = service.playerUnits()[1];
    archer.actionGauge.trySpend(20);
    archer.moveGauge.exhaust();
    cleric.actionGauge.exhaust();
    service.endCurrentTurn();
    expect(archer.guardPoints).toBe(84);
    expect(archer.actionGauge.current).toBe(0);
    expect(service.activeUnit()).toBe(cleric);
    expect(cleric.actionGauge.current).toBe(cleric.actionRecovery);
    service.endCurrentTurn();
    service.endCurrentTurn(true);
    expect(service.activeUnit()).toBe(archer);
    expect(archer.guardPoints).toBe(0);
    expect(archer.actionGauge.current).toBe(archer.actionRecovery);
    expect(archer.moveGauge.current).toBe(archer.moveRecovery);
  });

  it('refreshes and rotates initiative after turns, deaths, and restart', () => {
    service.initSkirmish();
    const first = service.activeUnit()!;
    expect(service.turnOrder()[0]).toBe(first);
    service.endCurrentTurn();
    expect(service.turnOrder()[0]).toBe(service.activeUnit());
    expect(service.turnOrder().at(-1)).toBe(first);
    const victim = service.enemyUnits()[0];
    victim.takeDamage(victim.maxHp, true);
    service.units.update((units) => [...units]);
    expect(service.turnOrder()).not.toContain(victim);
    service.initSkirmish([ARCHER_CLASS], [FIGHTER_CLASS]);
    expect(service.turnOrder()).toHaveLength(2);
    expect(service.turnOrder()).not.toContain(first);
  });

  it('prevents paused auto actions from advancing or damaging a later manual turn', () => {
    service.initSkirmish();
    const first = service.activeUnit()!;
    service.toggleAutoBattle();
    service.toggleAutoBattle();
    vi.advanceTimersByTime(5000);
    expect(service.activeUnit()).toBe(first);
    expect(first.actionGauge.current).toBe(100);
    service.toggleAutoBattle();
    vi.advanceTimersByTime(600);
    service.toggleAutoBattle();
    const hp = service.units().map((unit) => unit.currentHp);
    service.endCurrentTurn();
    const next = service.activeUnit();
    vi.advanceTimersByTime(5000);
    expect(service.activeUnit()).toBe(next);
    expect(service.units().map((unit) => unit.currentHp)).toEqual(hp);
  });

  it('suspends a battle during navigation without granting another turn recovery', () => {
    service.initSkirmish();
    service.toggleAutoBattle();
    const first = service.activeUnit()!;
    first.actionGauge.trySpend(10);
    service.suspend();
    vi.advanceTimersByTime(5000);
    expect(first.actionGauge.current).toBe(90);
    service.resume();
    expect(first.actionGauge.current).toBe(90);
    vi.advanceTimersByTime(600);
    expect(first.actionGauge.current).toBeLessThan(90);
  });

  it('blocks manual inputs during enemy, stunned, auto, and completed turns', () => {
    service.initSkirmish([FIGHTER_CLASS], [FIGHTER_CLASS]);
    const player = service.activeUnit()!;
    player.applyStatusEffect(new StatusEffectInstance('stun', 1));
    service.units.update((units) => [...units]);
    expect(service.moveActiveUnit(0.04)).toBe(false);
    expect(service.switchActiveUnitLane(1)).toBe(false);
    service.selectAbility('shield_bash');
    expect(service.executeSelectedAbility()).toBe(false);
    service.endCurrentTurn();
    expect(service.activeUnit()).toBe(player);
    player.clearStatusEffects();
    service.units.update((units) => [...units]);
    service.toggleAutoBattle();
    expect(service.moveActiveUnit(0.04)).toBe(false);
    service.toggleAutoBattle();
    service.endCurrentTurn();
    expect(service.activeUnit()?.team).toBe('enemy');
    expect(service.moveActiveUnit(0.04)).toBe(false);
    service.battleStatus.set('victory');
    expect(service.moveActiveUnit(0.04)).toBe(false);
  });

  it('keeps four-member starting positions separate and preserves the chosen squad on restart', () => {
    service.initSkirmish(
      [FIGHTER_CLASS, FIGHTER_CLASS, FIGHTER_CLASS, FIGHTER_CLASS],
      [FIGHTER_CLASS],
    );
    const [first, , , fourth] = service.playerUnits();
    expect(first.lane).toBe(fourth.lane);
    expect(Math.abs(first.positionX - fourth.positionX)).toBeGreaterThan(COLLISION_BUFFER);
    service.toggleAutoBattle();
    service.initSkirmish();
    expect(service.playerUnits().every((unit) => unit.classDef.id === 'fighter')).toBe(true);
    expect(service.isAutoBattle()).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(service.playerUnits().every((unit) => unit.currentHp === unit.maxHp)).toBe(true);
  });

  it.each([
    ['default squads', undefined, undefined],
    ['guard-heavy mirror', [FIGHTER_CLASS], [FIGHTER_CLASS]],
  ] as const)(
    'finishes auto combat for %s and stops issuing turns after the result',
    (_name, players, enemies) => {
      service.initSkirmish(players ? [...players] : undefined, enemies ? [...enemies] : undefined);
      service.toggleAutoBattle();
      for (let i = 0; i < 2000 && service.battleStatus() === 'active'; i++)
        vi.advanceTimersByTime(600);
      expect(service.battleStatus()).not.toBe('active');
      const logs = service.combatLogs();
      const round = service.roundNumber();
      vi.advanceTimersByTime(10000);
      expect(service.combatLogs()).toEqual(logs);
      expect(service.roundNumber()).toBe(round);
    },
  );

  it('runs saved orders, falls back when an order is unavailable, and preserves practice on restart', () => {
    const plan = createDefaultDefensePlan([defender]);
    plan.members = [
      {
        mercenary: defender,
        orders: [
          { abilityId: 'guard', targetPriority: 'closest' },
          { abilityId: 'bulwark', targetPriority: 'closest' },
          { abilityId: 'bulwark', targetPriority: 'closest' },
          { abilityId: 'auto', targetPriority: 'closest' },
        ],
      },
    ];
    service.initDefensePractice(plan);
    expect(service.practicePlan()).not.toBeNull();
    for (let turn = 1; turn <= 3; turn++) {
      while (service.activeUnit()?.team === 'player') service.endCurrentTurn();
      vi.advanceTimersByTime(1500);
      const logs = service.combatLogs().join('\n');
      if (turn === 1) expect(logs).toContain('follows turn 1 order: Guard');
      if (turn === 2) expect(logs).toContain('follows turn 2 order: Bulwark');
      if (turn === 3) expect(logs).toContain('turn 3 order is unavailable');
      if (turn === 3) expect(logs.match(/turn 3 order is unavailable/g)).toHaveLength(1);
    }
    service.initSkirmish();
    expect(service.practicePlan()?.members[0].orders[0].abilityId).toBe('guard');
    expect(service.enemyUnits()).toHaveLength(1);
    service.initSkirmish([ARCHER_CLASS], [FIGHTER_CLASS]);
    expect(service.practicePlan()).toBeNull();
  });

  it('fields defense mercenaries with their own names and stats, marking one facing itself', () => {
    const strong = { ...defender, id: 'merc_strong', stats: { ...defender.stats, con: 26 } };
    service.deployMercenaries([strong]);
    expect(service.playerUnits()[0].name).toBe(strong.name);
    service.initDefensePractice(createDefaultDefensePlan([strong, defender]));
    const [first, second] = service.enemyUnits();
    expect(first.name).toBe(`${strong.name} (Def)`);
    expect(first.stats).toEqual(deriveCombatStats(FIGHTER_CLASS, strong));
    expect(first.maxHp).toBeGreaterThan(FIGHTER_CLASS.baseStats.maxHp);
    expect(second.stats).toEqual(FIGHTER_CLASS.baseStats);
  });

  it('reports how a battle ended, once, naming the roster mercenaries who fought', () => {
    const archer = { ...defender, id: 'merc_archer', classId: 'archer' };
    service.deployMercenaries([archer], [FIGHTER_CLASS]);
    expect(service.battleReport()).toBeNull();
    const enemy = service.enemyUnits()[0];
    enemy.takeDamage(enemy.maxHp - 1);
    service.selectAbility('quick_shot');
    expect(service.executeSelectedAbility(enemy)).toBe(true);
    expect(service.battleReport()).toEqual(
      expect.objectContaining({
        outcome: 'victory',
        enemiesDefeated: 1,
        mercenaries: [{ id: 'merc_archer', survived: true }],
      }),
    );
    service.initSkirmish();
    expect(service.battleReport()).toBeNull();
  });

  it('fields mercenaries with the skills their level has taught, and their supports', () => {
    const veteran = { ...defender, level: 99, supports: ['vigor'] };
    service.deployMercenaries([veteran]);
    const unit = service.playerUnits()[0];
    expect(unit.abilities).toHaveLength(5);
    expect(unit.abilities.map((a) => a.id)).toContain(defender.pattern[1].id);
    expect(unit.supports).toEqual(['vigor']);
    expect(unit.maxHp).toBe(198);
    service.deployMercenaries([defender]);
    expect(service.playerUnits()[0].abilities).toHaveLength(3);
  });

  it('fills the assist gauge from damage and spends an orb on a free ally pursuit', () => {
    service.initSkirmish([ARCHER_CLASS, FIGHTER_CLASS], [FIGHTER_CLASS]);
    const archer = service.activeUnit()!;
    const fighter = service.playerUnits().find((u) => u !== archer)!;
    const foe = service.enemyUnits()[0];
    fighter.lane = archer.lane;
    foe.lane = archer.lane;
    expect(service.assistOptions()).toEqual([]);
    service.selectAbility('quick_shot');
    service.executeSelectedAbility(foe);
    expect(service.assistGauge().player).toBeGreaterThan(0);

    service.assistGauge.set({ player: 100, enemy: 0 });
    expect(service.assistOptions().map((o) => o.ally)).toEqual([fighter]);
    const hp = foe.currentHp;
    const ap = fighter.actionGauge.current;
    expect(service.callAssist(fighter.id)).toBe(true);
    expect(foe.currentHp).toBeLessThan(hp);
    expect(fighter.actionGauge.current).toBe(ap);
    expect(service.lastAction()?.attackerId).toBe(fighter.id);
    // The pursuit itself does not refill the gauge.
    expect(service.assistGauge().player).toBe(0);
    expect(service.callAssist(fighter.id)).toBe(false);
  });

  it('lets the AI spend an orb only on a pursuit that defeats its target', () => {
    service.initSkirmish([FIGHTER_CLASS], [ARCHER_CLASS, FIGHTER_CLASS]);
    const [enemyArcher, enemyFighter] = service.enemyUnits();
    const target = service.playerUnits()[0];
    enemyFighter.lane = target.lane;
    enemyArcher.lane = target.lane;
    target.takeDamage(target.maxHp - 5);
    service.assistGauge.set({ player: 0, enemy: 100 });
    expect(service.activeUnit()).toBe(enemyArcher);
    vi.advanceTimersByTime(700);
    expect(service.combatLogs().join(' ')).toContain('Assist!');
    expect(service.assistGauge().enemy).toBeLessThan(100);
  });

  it('fights a contract band with its own names and stats, keeps it through restarts, and reports its reward', () => {
    const contract = generateContract('hard', 3, seededRandom(21));
    service.deployContract(contract, [defender]);
    expect(service.activeContract()).toBe(contract);
    expect(service.practicePlan()).toBeNull();
    const enemies = service.enemyUnits();
    expect(enemies.map((u) => u.classDef.id)).toEqual(contract.enemies.map((e) => e.classId));
    expect(enemies[0].maxHp).toBeGreaterThan(enemies[0].classDef.baseStats.maxHp);
    service.initSkirmish();
    expect(service.activeContract()).toBe(contract);
    for (const enemy of service.enemyUnits()) enemy.takeDamage(9999);
    service.endCurrentTurn(true);
    expect(service.battleReport()).toEqual(
      expect.objectContaining({ contractId: contract.id, rewardMultiplier: 2.2 }),
    );
    // Any other deployment ends the contract.
    service.deployMercenaries([defender]);
    expect(service.activeContract()).toBeNull();
  });

  it('refreshes squad sheets for the next restart', () => {
    service.deployMercenaries([defender]);
    service.refreshMercenaries([{ ...defender, stats: { ...defender.stats, con: 30 } }]);
    service.initSkirmish();
    expect(service.playerUnits()[0].maxHp).toBeGreaterThan(FIGHTER_CLASS.baseStats.maxHp);
  });

  it('rejects corrupt practice plans without altering an active battle', () => {
    service.initSkirmish();
    const before = service.units();
    expect(() => service.initDefensePractice({ version: 1, members: [] })).toThrow();
    expect(service.units()).toBe(before);
    expect(service.practicePlan()).toBeNull();
  });

  it('uses exactly four scripted turns per defender, then switches to the fallback', () => {
    const plan = createDefaultDefensePlan([defender]);
    plan.members = [
      {
        mercenary: defender,
        orders: Array.from({ length: 4 }, () => ({
          abilityId: 'guard',
          targetPriority: 'closest',
        })),
      },
    ];
    service.initDefensePractice(plan);
    for (let turn = 1; turn <= 4; turn++) {
      while (service.activeUnit()?.team === 'player') service.endCurrentTurn();
      vi.advanceTimersByTime(1500);
      expect(service.combatLogs().join('\n')).toContain(`follows turn ${turn} order: Guard`);
    }
    while (service.activeUnit()?.team === 'player') service.endCurrentTurn();
    vi.advanceTimersByTime(600);
    expect(service.combatLogs().join('\n')).toContain(`${defender.name} unleashed`);
    expect(service.combatLogs().join('\n')).not.toContain('follows turn 5 order');
  });

  it('applies roster mercenary stats and names to player units, and a class-only squad clears them', () => {
    const merc = generateMercenary('fighter', seededRandom(5));
    merc.stats.con = 26;
    service.initSkirmish([FIGHTER_CLASS], [FIGHTER_CLASS], undefined, [merc]);
    const unit = service.playerUnits()[0];
    expect(unit.name).toBe(merc.name);
    expect(unit.stats).toEqual(deriveCombatStats(FIGHTER_CLASS, merc));
    expect(unit.maxHp).toBeGreaterThan(FIGHTER_CLASS.baseStats.maxHp);
    expect(unit.currentHp).toBe(unit.maxHp);
    expect(service.enemyUnits()[0].stats).toBe(FIGHTER_CLASS.baseStats);

    service.initSkirmish([FIGHTER_CLASS], [FIGHTER_CLASS]);
    expect(service.playerUnits()[0].name).toBe('Player Fighter');
    expect(service.playerUnits()[0].stats).toBe(FIGHTER_CLASS.baseStats);
  });

  it('keeps roster stats through restart and defense practice', () => {
    const merc = generateMercenary('archer', seededRandom(6));
    service.initSkirmish([ARCHER_CLASS], undefined, undefined, [merc]);
    service.initSkirmish();
    expect(service.playerUnits()[0].name).toBe(merc.name);
    service.initDefensePractice(createDefaultDefensePlan(generateStarterRoster(seededRandom(3))));
    expect(service.playerUnits()[0].name).toBe(merc.name);
  });

  it('publishes each resolved skill for the stage, and clears it on a new battle', () => {
    service.initSkirmish([ARCHER_CLASS], [FIGHTER_CLASS]);
    expect(service.lastAction()).toBeNull();
    const archer = service.playerUnits()[0];
    const fighter = service.enemyUnits()[0];
    service.selectAbility('quick_shot');
    expect(service.executeSelectedAbility(fighter)).toBe(true);
    const action = service.lastAction()!;
    expect(action.attackerId).toBe(archer.id);
    expect(action.abilityId).toBe('quick_shot');
    expect(action.effects).toEqual([
      expect.objectContaining({ targetId: fighter.id, isHealing: false, wasDefeated: false }),
    ]);
    service.selectAbility('quick_shot');
    service.executeSelectedAbility(fighter);
    expect(service.lastAction()!.seq).toBeGreaterThan(action.seq);
    service.initSkirmish([ARCHER_CLASS], [FIGHTER_CLASS]);
    expect(service.lastAction()).toBeNull();
  });

  it('reports the span a unit can walk to, stopped by lane-mates and the field edge', () => {
    service.initSkirmish([ARCHER_CLASS], [FIGHTER_CLASS]);
    const archer = service.playerUnits()[0];
    const fighter = service.enemyUnits()[0];
    archer.lane = fighter.lane;
    archer.positionX = 0.1;
    fighter.positionX = 0.3;
    // 100 MG covers two whole field widths, so only the edge and the fighter limit it.
    expect(service.reachableSpan(archer)).toEqual({ from: 0.05, to: 0.3 - COLLISION_BUFFER });
    archer.moveGauge.exhaust();
    expect(service.reachableSpan(archer)).toEqual({ from: 0.1, to: 0.1 });
  });

  it('lists allies an area skill would catch', () => {
    service.initSkirmish(
      [GUNNER_CLASS, FIGHTER_CLASS, CLERIC_CLASS, ARCHER_CLASS],
      [FIGHTER_CLASS],
    );
    // Archer (fastest) acts first; the gunner shares lane I with it.
    service.endCurrentTurn();
    const gunner = service.activeUnit()!;
    expect(gunner.classDef.id).toBe('gunner');
    service.selectAbility('explosive_shot');
    expect(service.friendlyFireRisk().map((unit) => unit.classDef.id)).toEqual(['archer']);
    service.selectAbility('quick_fire');
    expect(service.friendlyFireRisk()).toEqual([]);
  });

  it('marks where the current round ends in the turn order', () => {
    service.initSkirmish([ARCHER_CLASS, CLERIC_CLASS], [FIGHTER_CLASS]);
    expect(service.turnOrder()).toHaveLength(3);
    expect(service.turnsLeftInRound()).toBe(3);
    service.endCurrentTurn();
    expect(service.turnsLeftInRound()).toBe(2);
    expect(service.turnOrder()).toHaveLength(3);
  });

  describe('interactive execution', () => {
    beforeEach(() => service.timingEnabled.set(true));

    it('aims a ranged skill: nothing is spent until the player fires, then the press is graded', () => {
      service.initSkirmish([ARCHER_CLASS], [FIGHTER_CLASS]);
      const archer = service.activeUnit()!;
      const fighter = service.enemyUnits()[0];
      service.selectAbility('quick_shot');
      expect(service.commitSelectedAbility()).toBe(true);
      const aim = service.aim()!;
      expect(aim.targetIds).toEqual([fighter.id]);
      expect(archer.actionGauge.current).toBe(100);
      // Nothing else can happen while the cursor sweeps.
      expect(service.moveActiveUnit(0.04)).toBe(false);
      service.endCurrentTurn();
      expect(service.activeUnit()).toBe(archer);

      vi.advanceTimersByTime(aim.center * aim.sweepMs);
      expect(service.fireAim()).toBe(true);
      expect(service.aim()).toBeNull();
      expect(service.lastAction()?.grade).toBe('critical');
      expect(archer.actionGauge.current).toBe(80);
      expect(fighter.currentHp).toBeLessThan(fighter.maxHp);
      expect(service.fireAim()).toBe(false);
    });

    it('a cursor left to run off the track misses and still spends the AP', () => {
      service.initSkirmish([ARCHER_CLASS], [FIGHTER_CLASS]);
      const archer = service.activeUnit()!;
      const fighter = service.enemyUnits()[0];
      service.selectAbility('quick_shot');
      service.commitSelectedAbility();
      vi.advanceTimersByTime(service.aim()!.sweepMs + 1);
      expect(service.aim()).toBeNull();
      expect(service.lastAction()?.grade).toBe('miss');
      expect(service.lastAction()?.effects[0].missed).toBe(true);
      expect(fighter.currentHp).toBe(fighter.maxHp);
      expect(archer.actionGauge.current).toBe(80);
    });

    it('with timing off, a confirm resolves at once at normal power', () => {
      service.timingEnabled.set(false);
      service.initSkirmish([ARCHER_CLASS], [FIGHTER_CLASS]);
      service.selectAbility('quick_shot');
      expect(service.commitSelectedAbility()).toBe(true);
      expect(service.aim()).toBeNull();
      expect(service.lastAction()?.grade).toBeUndefined();
      expect(service.activeUnit()!.actionGauge.current).toBe(80);
    });

    it('chains melee skills in the combo window, with a Just Cancel on the flash', () => {
      service.initSkirmish([LANCER_CLASS], [FIGHTER_CLASS]);
      const lancer = service.activeUnit()!;
      service.selectAbility('thrust');
      expect(service.commitSelectedAbility()).toBe(true);
      expect(service.lastAction()?.grade).toBeUndefined();
      expect(service.combo()).toEqual(expect.objectContaining({ count: 1, abilityId: 'thrust' }));
      const afterFirst = lancer.actionGauge.current;

      // A press before the strike lands is swallowed and keeps the combo.
      expect(service.chainAbility('thrust')).toBe(true);
      expect(lancer.actionGauge.current).toBe(afterFirst);

      vi.advanceTimersByTime(CHAIN_WINDOW.justFrom + 20);
      expect(service.chainAbility('thrust')).toBe(true);
      expect(service.lastAction()?.grade).toBe('just');
      expect(service.combo()?.count).toBe(2);

      vi.advanceTimersByTime(CHAIN_WINDOW.close + 1);
      expect(service.combo()).toBeNull();
      expect(service.chainAbility('thrust')).toBe(false);
    });

    it('moving ends a combo', () => {
      service.initSkirmish([LANCER_CLASS], [FIGHTER_CLASS]);
      service.selectAbility('thrust');
      service.commitSelectedAbility();
      expect(service.combo()).not.toBeNull();
      service.moveActiveUnit(-0.04);
      expect(service.combo()).toBeNull();
    });

    it('enemy turns resolve without timing grades', () => {
      service.initSkirmish([FIGHTER_CLASS], [ARCHER_CLASS]);
      expect(service.activeUnit()?.team).toBe('enemy');
      vi.advanceTimersByTime(700);
      expect(service.lastAction()).not.toBeNull();
      expect(service.lastAction()?.grade).toBeUndefined();
      expect(service.aim()).toBeNull();
      expect(service.combo()).toBeNull();
    });
  });
});
