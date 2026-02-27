using NUnit.Framework;
using Lanes.Combat;
using Lanes.Combat.Units;
using Lanes.Data;
using Lanes.Data.Classes;

namespace Lanes.Tests;

/// <summary>
/// Verifies Gunner class definition values, ability contracts,
/// and interaction with the damage calculator.
/// </summary>
[TestFixture]
public sealed class GunnerTests
{
    private UnitClassDefinition _def = null!;

    [SetUp]
    public void SetUp() => _def = GunnerClassDef.Create();

    [Test]
    public void Gunner_Id_IsGunner() =>
        Assert.That(_def.Id, Is.EqualTo("gunner"));

    [Test]
    public void Gunner_Role_IsRanged() =>
        Assert.That(_def.Role, Is.EqualTo(UnitRole.Ranged));

    [Test]
    public void Gunner_HasThreeAbilities() =>
        Assert.That(_def.Abilities, Has.Count.EqualTo(3));

    [Test]
    public void Gunner_QuickFire_IsPhysical()
    {
        var ability = _def.Abilities[0];
        Assert.That(ability.Id,         Is.EqualTo("quick_fire"));
        Assert.That(ability.DamageType, Is.EqualTo(DamageType.Physical));
        Assert.That(ability.CrossLane,  Is.False);
    }

    [Test]
    public void Gunner_Snipe_IsCrossLane()
    {
        var ability = _def.Abilities[1];
        Assert.That(ability.Id,        Is.EqualTo("snipe"));
        Assert.That(ability.CrossLane, Is.True);
        Assert.That(ability.Target,    Is.EqualTo(AbilityTarget.SingleEnemyAnyLane));
    }

    [Test]
    public void Gunner_ExplosiveShot_HasFriendlyFire()
    {
        var ability = _def.Abilities[2];
        Assert.That(ability.Id,           Is.EqualTo("explosive_shot"));
        Assert.That(ability.FriendlyFire, Is.True);
        Assert.That(ability.Target,       Is.EqualTo(AbilityTarget.SameLaneEnemies));
    }

    [Test]
    public void Gunner_Stats_HighAttack()
    {
        Assert.That(_def.BaseStats.Attack, Is.GreaterThan(70));
    }

    [Test]
    public void Gunner_DamageOutput_IsPositive()
    {
        var unit    = new UnitInstance(_def, "Test Gunner");
        var ability = _def.Abilities[0]; // quick_fire
        int dmg     = DamageCalculator.Calculate(unit, ability);
        Assert.That(dmg, Is.GreaterThan(0));
    }

    [Test]
    public void Gunner_ThemeKey_DefaultsToId()
    {
        Assert.That(_def.ThemeKey, Is.EqualTo(_def.Id));
    }

    [Test]
    public void Gunner_CustomThemeKey_IsPreserved()
    {
        var reskinned = GunnerClassDef.Create(themeKey: "musketeer");
        Assert.That(reskinned.ThemeKey, Is.EqualTo("musketeer"));
        Assert.That(reskinned.Id,       Is.EqualTo("gunner"));
    }

    [Test]
    public void Gunner_IsRegistered_InDefaultRegistry()
    {
        Assert.That(UnitClassRegistry.Default.TryGet("gunner", out _), Is.True);
    }
}
