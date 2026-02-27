using NUnit.Framework;
using Lanes.Combat;
using Lanes.Combat.Units;
using Lanes.Data;
using Lanes.Data.Classes;

namespace Lanes.Tests;

/// <summary>
/// Verifies Fighter class definition values, ability contracts,
/// and interaction with the damage calculator.
/// </summary>
[TestFixture]
public sealed class FighterTests
{
    private UnitClassDefinition _def = null!;

    [SetUp]
    public void SetUp() => _def = FighterClassDef.Create();

    [Test]
    public void Fighter_Id_IsFighter() =>
        Assert.That(_def.Id, Is.EqualTo("fighter"));

    [Test]
    public void Fighter_Role_IsTank() =>
        Assert.That(_def.Role, Is.EqualTo(UnitRole.Tank));

    [Test]
    public void Fighter_HasThreeAbilities() =>
        Assert.That(_def.Abilities, Has.Count.EqualTo(3));

    [Test]
    public void Fighter_ShieldBash_IsPhysical()
    {
        var ability = _def.Abilities[0];
        Assert.That(ability.Id,         Is.EqualTo("shield_bash"));
        Assert.That(ability.DamageType, Is.EqualTo(DamageType.Physical));
        Assert.That(ability.CrossLane,  Is.False);
    }

    [Test]
    public void Fighter_Provoke_HitsSameLane()
    {
        var ability = _def.Abilities[1];
        Assert.That(ability.Id,     Is.EqualTo("provoke"));
        Assert.That(ability.Target, Is.EqualTo(AbilityTarget.SameLaneEnemies));
    }

    [Test]
    public void Fighter_Bulwark_TargetsSelf()
    {
        var ability = _def.Abilities[2];
        Assert.That(ability.Id,     Is.EqualTo("bulwark"));
        Assert.That(ability.Target, Is.EqualTo(AbilityTarget.SingleAlly));
    }

    [Test]
    public void Fighter_Stats_HighHpAndDefense()
    {
        Assert.That(_def.BaseStats.MaxHp,   Is.GreaterThanOrEqualTo(150));
        Assert.That(_def.BaseStats.Defense, Is.GreaterThan(_def.BaseStats.Attack / 2));
    }

    [Test]
    public void Fighter_DamageOutput_IsPositive()
    {
        var unit    = new UnitInstance(_def, "Test Fighter");
        var ability = _def.Abilities[0]; // shield_bash
        int dmg     = DamageCalculator.Calculate(unit, ability);
        Assert.That(dmg, Is.GreaterThan(0));
    }

    [Test]
    public void Fighter_ThemeKey_DefaultsToId()
    {
        Assert.That(_def.ThemeKey, Is.EqualTo(_def.Id));
    }

    [Test]
    public void Fighter_CustomThemeKey_IsPreserved()
    {
        var reskinned = FighterClassDef.Create(themeKey: "paladin");
        Assert.That(reskinned.ThemeKey, Is.EqualTo("paladin"));
        Assert.That(reskinned.Id,       Is.EqualTo("fighter"));
    }

    [Test]
    public void Fighter_IsRegistered_InDefaultRegistry()
    {
        Assert.That(UnitClassRegistry.Default.TryGet("fighter", out _), Is.True);
    }
}
