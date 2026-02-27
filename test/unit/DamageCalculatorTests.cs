using System.Collections.Generic;
using NUnit.Framework;
using Lanes.Combat;
using Lanes.Combat.Units;
using Lanes.Data.Classes;

namespace Lanes.Tests;

[TestFixture]
public sealed class DamageCalculatorTests
{
    private static UnitInstance MakeUnit(string classId, int atk = 60, int def = 20, int matk = 0, int mdef = 0)
    {
        var classDef = new UnitClassDefinition
        {
            Id          = classId,
            Name        = classId,
            Description = "",
            Role        = UnitRole.Melee,
            BaseStats   = new UnitBaseStats(MaxHp: 100, Attack: atk, Defense: def,
                                             Speed: 40, MagicAttack: matk, MagicDefense: mdef),
            Abilities   = new List<AbilityDefinition>(),
        };
        return new UnitInstance(classDef, classId);
    }

    private static AbilityDefinition PhysAbility(float mult) =>
        new("test_phys", "Test", "", ActionCost: 10, DamageType.Physical, mult, AbilityTarget.SingleEnemy);

    private static AbilityDefinition MagAbility(float mult) =>
        new("test_mag", "Test", "", ActionCost: 10, DamageType.Magical, mult, AbilityTarget.SingleEnemy);

    private static AbilityDefinition HealAbility(float mult) =>
        new("test_heal", "Test", "", ActionCost: 10, DamageType.Healing, mult, AbilityTarget.SingleAlly);

    // ── Calculate (no defence) ───────────────────────────────────────────

    [Test]
    public void Calculate_Physical_UsesAttackStat()
    {
        var attacker = MakeUnit("a", atk: 60);
        var ability  = PhysAbility(1.0f);
        Assert.That(DamageCalculator.Calculate(attacker, ability), Is.EqualTo(60));
    }

    [Test]
    public void Calculate_Magical_UsesMagicAttack()
    {
        var attacker = MakeUnit("a", matk: 50);
        var ability  = MagAbility(1.0f);
        Assert.That(DamageCalculator.Calculate(attacker, ability), Is.EqualTo(50));
    }

    [Test]
    public void Calculate_Healing_UsesMagicAttack()
    {
        var attacker = MakeUnit("a", matk: 70);
        var ability  = HealAbility(1.2f);
        Assert.That(DamageCalculator.Calculate(attacker, ability), Is.EqualTo(84));
    }

    [Test]
    public void Calculate_AlwaysAtLeastOne()
    {
        var attacker = MakeUnit("a", atk: 0);
        var ability  = PhysAbility(0.01f);
        Assert.That(DamageCalculator.Calculate(attacker, ability), Is.GreaterThanOrEqualTo(1));
    }

    [Test]
    public void Calculate_PowerMultiplier_Applied()
    {
        var attacker = MakeUnit("a", atk: 100);
        var ability  = PhysAbility(1.5f);
        Assert.That(DamageCalculator.Calculate(attacker, ability), Is.EqualTo(150));
    }

    // ── CalculateWithDefense ─────────────────────────────────────────────

    [Test]
    public void CalculateWithDefense_Physical_ReducedByDefense()
    {
        var attacker = MakeUnit("a", atk: 80);
        var target   = MakeUnit("b", def: 20);
        var ability  = PhysAbility(1.0f);
        // 80 - 20 = 60
        Assert.That(DamageCalculator.CalculateWithDefense(attacker, target, ability), Is.EqualTo(60));
    }

    [Test]
    public void CalculateWithDefense_Magical_ReducedByMagicDefense()
    {
        var attacker = MakeUnit("a", matk: 90);
        var target   = MakeUnit("b", mdef: 30);
        var ability  = MagAbility(1.0f);
        // 90 - 30 = 60
        Assert.That(DamageCalculator.CalculateWithDefense(attacker, target, ability), Is.EqualTo(60));
    }

    [Test]
    public void CalculateWithDefense_ClampedToOne_WhenDefenseExceedsRaw()
    {
        var attacker = MakeUnit("a", atk: 10);
        var target   = MakeUnit("b", def: 100);
        var ability  = PhysAbility(1.0f);
        Assert.That(DamageCalculator.CalculateWithDefense(attacker, target, ability), Is.EqualTo(1));
    }

    [Test]
    public void CalculateWithDefense_Healing_ReturnsZero()
    {
        var attacker = MakeUnit("a", matk: 70);
        var target   = MakeUnit("b");
        var ability  = HealAbility(1.2f);
        Assert.That(DamageCalculator.CalculateWithDefense(attacker, target, ability), Is.EqualTo(0));
    }
}
