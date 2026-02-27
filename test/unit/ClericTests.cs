using NUnit.Framework;
using Lanes.Combat;
using Lanes.Combat.Units;
using Lanes.Data;
using Lanes.Data.Classes;

namespace Lanes.Tests;

/// <summary>
/// Verifies Cleric class definition values, ability contracts,
/// and healing/magic interactions.
/// </summary>
[TestFixture]
public sealed class ClericTests
{
    private UnitClassDefinition _def = null!;

    [SetUp]
    public void SetUp() => _def = ClericClassDef.Create();

    [Test]
    public void Cleric_Id_IsCleric() =>
        Assert.That(_def.Id, Is.EqualTo("cleric"));

    [Test]
    public void Cleric_Role_IsSupport() =>
        Assert.That(_def.Role, Is.EqualTo(UnitRole.Support));

    [Test]
    public void Cleric_HasThreeAbilities() =>
        Assert.That(_def.Abilities, Has.Count.EqualTo(3));

    [Test]
    public void Cleric_Mend_IsHealingAndCrossLane()
    {
        var ability = _def.Abilities[0];
        Assert.That(ability.Id,         Is.EqualTo("mend"));
        Assert.That(ability.DamageType, Is.EqualTo(DamageType.Healing));
        Assert.That(ability.CrossLane,  Is.True);
        Assert.That(ability.Target,     Is.EqualTo(AbilityTarget.SingleAllyAnyLane));
    }

    [Test]
    public void Cleric_HolySmite_IsMagical()
    {
        var ability = _def.Abilities[1];
        Assert.That(ability.Id,         Is.EqualTo("holy_smite"));
        Assert.That(ability.DamageType, Is.EqualTo(DamageType.Magical));
        Assert.That(ability.Target,     Is.EqualTo(AbilityTarget.SingleEnemy));
    }

    [Test]
    public void Cleric_Bless_HealsAllAllies()
    {
        var ability = _def.Abilities[2];
        Assert.That(ability.Id,         Is.EqualTo("bless"));
        Assert.That(ability.DamageType, Is.EqualTo(DamageType.Healing));
        Assert.That(ability.Target,     Is.EqualTo(AbilityTarget.AllAllies));
        Assert.That(ability.CrossLane,  Is.True);
    }

    [Test]
    public void Cleric_MagicAttack_IsHigherThanPhysical()
    {
        Assert.That(_def.BaseStats.MagicAttack, Is.GreaterThan(_def.BaseStats.Attack));
    }

    [Test]
    public void Cleric_HealingOutput_IsPositive()
    {
        var unit    = new UnitInstance(_def, "Test Cleric");
        var ability = _def.Abilities[0]; // mend
        int heal    = DamageCalculator.Calculate(unit, ability);
        Assert.That(heal, Is.GreaterThan(0));
    }

    [Test]
    public void Cleric_CalculateWithDefense_Healing_ReturnsZero()
    {
        var cleric = new UnitInstance(_def, "Cleric");
        var dummy  = new UnitInstance(_def, "Dummy");
        var mend   = _def.Abilities[0];
        // Healing should not interact with defence.
        Assert.That(DamageCalculator.CalculateWithDefense(cleric, dummy, mend), Is.EqualTo(0));
    }

    [Test]
    public void Cleric_ThemeKey_CanBeReplaced()
    {
        var reskinned = ClericClassDef.Create(themeKey: "shaman");
        Assert.That(reskinned.ThemeKey, Is.EqualTo("shaman"));
        Assert.That(reskinned.Id,       Is.EqualTo("cleric"));
    }

    [Test]
    public void Cleric_IsRegistered_InDefaultRegistry()
    {
        Assert.That(UnitClassRegistry.Default.TryGet("cleric", out _), Is.True);
    }
}
