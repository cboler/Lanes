using System.Collections.Generic;
using NUnit.Framework;
using Lanes.Combat;
using Lanes.Combat.Units;

namespace Lanes.Tests;

/// <summary>
/// Tests for status effect integration with UnitInstance:
/// application, querying, stat modification, ticking (incl. poison),
/// and clearing on battle reset.
/// </summary>
[TestFixture]
public sealed class UnitStatusEffectTests
{
    private static UnitClassDefinition SimpleClassDef() =>
        new()
        {
            Id          = "test",
            Name        = "Test",
            Description = "",
            Role        = UnitRole.Melee,
            BaseStats   = new UnitBaseStats(MaxHp: 100, Attack: 50, Defense: 20, Speed: 40),
            Abilities   = new List<AbilityDefinition>(),
        };

    // ── HasEffect / IsStunned ────────────────────────────────────────────

    [Test]
    public void NewUnit_HasNoEffects()
    {
        var unit = new UnitInstance(SimpleClassDef(), "Hero");
        Assert.That(unit.StatusEffects, Is.Empty);
        Assert.That(unit.IsStunned,     Is.False);
    }

    [Test]
    public void ApplyStatusEffect_AddsEffect()
    {
        var unit = new UnitInstance(SimpleClassDef(), "Hero");
        unit.ApplyStatusEffect(new StatusEffectInstance(StatusEffectType.Poison, 2, 5));
        Assert.That(unit.StatusEffects, Has.Count.EqualTo(1));
        Assert.That(unit.HasEffect(StatusEffectType.Poison), Is.True);
    }

    [Test]
    public void IsStunned_WhenStunApplied()
    {
        var unit = new UnitInstance(SimpleClassDef(), "Hero");
        unit.ApplyStatusEffect(new StatusEffectInstance(StatusEffectType.Stun, 1, 1));
        Assert.That(unit.IsStunned, Is.True);
    }

    // ── Stat modifiers ───────────────────────────────────────────────────

    [Test]
    public void EffectiveAttack_IncreasedByAttackUp()
    {
        var unit = new UnitInstance(SimpleClassDef(), "Hero");
        unit.ApplyStatusEffect(new StatusEffectInstance(StatusEffectType.AttackUp, 2, 10));
        Assert.That(unit.EffectiveAttack, Is.EqualTo(60)); // 50 + 10
    }

    [Test]
    public void EffectiveAttack_DecreasedByAttackDown()
    {
        var unit = new UnitInstance(SimpleClassDef(), "Hero");
        unit.ApplyStatusEffect(new StatusEffectInstance(StatusEffectType.AttackDown, 2, 15));
        Assert.That(unit.EffectiveAttack, Is.EqualTo(35)); // 50 - 15
    }

    [Test]
    public void EffectiveAttack_ClampedToZero()
    {
        var unit = new UnitInstance(SimpleClassDef(), "Hero");
        unit.ApplyStatusEffect(new StatusEffectInstance(StatusEffectType.AttackDown, 2, 999));
        Assert.That(unit.EffectiveAttack, Is.EqualTo(0));
    }

    [Test]
    public void EffectiveDefense_IncreasedByDefenseUp()
    {
        var unit = new UnitInstance(SimpleClassDef(), "Hero");
        unit.ApplyStatusEffect(new StatusEffectInstance(StatusEffectType.DefenseUp, 2, 10));
        Assert.That(unit.EffectiveDefense, Is.EqualTo(30)); // 20 + 10
    }

    [Test]
    public void EffectiveDefense_DecreasedByDefenseDown()
    {
        var unit = new UnitInstance(SimpleClassDef(), "Hero");
        unit.ApplyStatusEffect(new StatusEffectInstance(StatusEffectType.DefenseDown, 2, 5));
        Assert.That(unit.EffectiveDefense, Is.EqualTo(15)); // 20 - 5
    }

    [Test]
    public void MultipleBuffs_Stack()
    {
        var unit = new UnitInstance(SimpleClassDef(), "Hero");
        unit.ApplyStatusEffect(new StatusEffectInstance(StatusEffectType.AttackUp, 2, 10));
        unit.ApplyStatusEffect(new StatusEffectInstance(StatusEffectType.AttackUp, 3, 5));
        Assert.That(unit.EffectiveAttack, Is.EqualTo(65)); // 50 + 10 + 5
    }

    // ── TickStatusEffects ────────────────────────────────────────────────

    [Test]
    public void TickStatusEffects_PoisonDealsDamage()
    {
        var unit = new UnitInstance(SimpleClassDef(), "Hero");
        unit.ApplyStatusEffect(new StatusEffectInstance(StatusEffectType.Poison, 2, 8));
        int poisonDmg = unit.TickStatusEffects();
        Assert.Multiple(() =>
        {
            Assert.That(poisonDmg,       Is.EqualTo(8));
            Assert.That(unit.CurrentHp, Is.EqualTo(92)); // 100 - 8
        });
    }

    [Test]
    public void TickStatusEffects_RemovesExpiredEffects()
    {
        var unit = new UnitInstance(SimpleClassDef(), "Hero");
        unit.ApplyStatusEffect(new StatusEffectInstance(StatusEffectType.Stun, 1, 1));
        Assert.That(unit.IsStunned, Is.True);

        unit.TickStatusEffects();
        Assert.That(unit.IsStunned, Is.False);
        Assert.That(unit.StatusEffects, Is.Empty);
    }

    [Test]
    public void TickStatusEffects_KeepsNonExpiredEffects()
    {
        var unit = new UnitInstance(SimpleClassDef(), "Hero");
        unit.ApplyStatusEffect(new StatusEffectInstance(StatusEffectType.AttackUp, 3, 10));
        unit.TickStatusEffects();
        Assert.That(unit.HasEffect(StatusEffectType.AttackUp), Is.True);
        Assert.That(unit.StatusEffects, Has.Count.EqualTo(1));
    }

    // ── ResetForBattle ───────────────────────────────────────────────────

    [Test]
    public void ResetForBattle_ClearsStatusEffects()
    {
        var unit = new UnitInstance(SimpleClassDef(), "Hero");
        unit.ApplyStatusEffect(new StatusEffectInstance(StatusEffectType.Poison, 5, 10));
        unit.ApplyStatusEffect(new StatusEffectInstance(StatusEffectType.Stun, 2, 1));

        unit.ResetForBattle();

        Assert.That(unit.StatusEffects, Is.Empty);
        Assert.That(unit.IsStunned,     Is.False);
    }
}
