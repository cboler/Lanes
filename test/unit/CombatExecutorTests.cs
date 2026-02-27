using System.Collections.Generic;
using NUnit.Framework;
using Lanes.Combat;
using Lanes.Combat.Units;

namespace Lanes.Tests;

/// <summary>
/// Tests for the CombatExecutor — the central ability resolution engine
/// that integrates DamageCalculator, ActionGauge, and UnitInstance.
/// </summary>
[TestFixture]
public sealed class CombatExecutorTests
{
    private static UnitInstance MakeUnit(string name, int atk = 60, int def = 20, int matk = 0, int mdef = 0, int hp = 100)
    {
        var classDef = new UnitClassDefinition
        {
            Id          = name,
            Name        = name,
            Description = "",
            Role        = UnitRole.Melee,
            BaseStats   = new UnitBaseStats(MaxHp: hp, Attack: atk, Defense: def,
                                             Speed: 40, MagicAttack: matk, MagicDefense: mdef),
            Abilities   = new List<AbilityDefinition>(),
        };
        return new UnitInstance(classDef, name);
    }

    private static AbilityDefinition PhysAbility(int cost = 20, float mult = 1.0f) =>
        new("test_phys", "Test", "", ActionCost: cost, DamageType.Physical, mult, AbilityTarget.SingleEnemy);

    private static AbilityDefinition HealAbility(int cost = 25) =>
        new("test_heal", "Test", "", ActionCost: cost, DamageType.Healing, 1.0f, AbilityTarget.SingleAlly);

    // ── Successful execution ─────────────────────────────────────────────

    [Test]
    public void Execute_SingleTarget_DealsDamage()
    {
        var attacker = MakeUnit("Attacker", atk: 60);
        var target   = MakeUnit("Target",  def: 10, hp: 100);
        var ability  = PhysAbility();

        var result = CombatExecutor.Execute(attacker, ability, new[] { target });

        Assert.Multiple(() =>
        {
            Assert.That(result.Success,      Is.True);
            Assert.That(result.Effects,      Has.Count.EqualTo(1));
            Assert.That(result.Effects[0].IsHealing,    Is.False);
            Assert.That(result.Effects[0].Amount,       Is.GreaterThan(0));
            Assert.That(target.CurrentHp,               Is.LessThan(100));
        });
    }

    [Test]
    public void Execute_Healing_RestoresHp()
    {
        var healer = MakeUnit("Healer", matk: 50);
        var target = MakeUnit("Target", hp: 100);
        target.TakeDamage(40); // HP = 60

        var result = CombatExecutor.Execute(healer, HealAbility(), new[] { target });

        Assert.Multiple(() =>
        {
            Assert.That(result.Success,   Is.True);
            Assert.That(result.Effects,   Has.Count.EqualTo(1));
            Assert.That(result.Effects[0].IsHealing, Is.True);
            Assert.That(target.CurrentHp, Is.GreaterThan(60));
        });
    }

    [Test]
    public void Execute_MultipleTargets_AllAffected()
    {
        var attacker = MakeUnit("Attacker", atk: 60);
        var t1       = MakeUnit("T1", def: 10, hp: 100);
        var t2       = MakeUnit("T2", def: 10, hp: 100);
        var t3       = MakeUnit("T3", def: 10, hp: 100);

        var result = CombatExecutor.Execute(attacker, PhysAbility(), new[] { t1, t2, t3 });

        Assert.That(result.Effects, Has.Count.EqualTo(3));
        Assert.That(t1.CurrentHp, Is.LessThan(100));
        Assert.That(t2.CurrentHp, Is.LessThan(100));
        Assert.That(t3.CurrentHp, Is.LessThan(100));
    }

    [Test]
    public void Execute_SpendsActionGauge()
    {
        var attacker = MakeUnit("Attacker", atk: 60);
        var target   = MakeUnit("Target", hp: 100);
        float before = attacker.ActionGauge.Current;

        CombatExecutor.Execute(attacker, PhysAbility(cost: 30), new[] { target });

        Assert.That(attacker.ActionGauge.Current, Is.EqualTo(before - 30));
    }

    [Test]
    public void Execute_DetectsDefeat()
    {
        var attacker = MakeUnit("Attacker", atk: 200);
        var target   = MakeUnit("Target", def: 0, hp: 10);

        var result = CombatExecutor.Execute(attacker, PhysAbility(), new[] { target });

        Assert.That(result.Effects[0].WasDefeated, Is.True);
        Assert.That(target.IsAlive, Is.False);
    }

    // ── Failure cases ────────────────────────────────────────────────────

    [Test]
    public void Execute_InsufficientGauge_Fails()
    {
        var attacker = MakeUnit("Attacker", atk: 60);
        attacker.ActionGauge.TrySpend(90f); // only 10 left
        var target = MakeUnit("Target");

        var result = CombatExecutor.Execute(attacker, PhysAbility(cost: 20), new[] { target });

        Assert.Multiple(() =>
        {
            Assert.That(result.Success,       Is.False);
            Assert.That(result.FailureReason, Is.Not.Null);
            Assert.That(target.CurrentHp,     Is.EqualTo(100)); // unharmed
        });
    }

    [Test]
    public void Execute_DeadAttacker_Fails()
    {
        var attacker = MakeUnit("Attacker", atk: 60, hp: 10);
        attacker.TakeDamage(100);
        var target = MakeUnit("Target");

        var result = CombatExecutor.Execute(attacker, PhysAbility(), new[] { target });

        Assert.That(result.Success, Is.False);
    }

    [Test]
    public void Execute_SkipsDeadTargets()
    {
        var attacker = MakeUnit("Attacker", atk: 60);
        var alive    = MakeUnit("Alive", def: 10, hp: 100);
        var dead     = MakeUnit("Dead",  def: 10, hp: 100);
        dead.TakeDamage(100);

        var result = CombatExecutor.Execute(attacker, PhysAbility(), new[] { alive, dead });

        Assert.That(result.Effects, Has.Count.EqualTo(1));
        Assert.That(result.Effects[0].Target, Is.SameAs(alive));
    }

    // ── Null guards ──────────────────────────────────────────────────────

    [Test]
    public void Execute_NullAttacker_Throws()
    {
        Assert.Throws<System.ArgumentNullException>(
            () => CombatExecutor.Execute(null!, PhysAbility(), new List<UnitInstance>()));
    }

    [Test]
    public void Execute_NullAbility_Throws()
    {
        var attacker = MakeUnit("Attacker");
        Assert.Throws<System.ArgumentNullException>(
            () => CombatExecutor.Execute(attacker, null!, new List<UnitInstance>()));
    }
}
