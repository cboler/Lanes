using System.Collections.Generic;
using NUnit.Framework;
using Lanes.Combat.Units;
using Lanes.Data;
using Lanes.Data.Classes;

namespace Lanes.Tests;

[TestFixture]
public sealed class UnitClassRegistryTests
{
    [Test]
    public void Default_ContainsThreeClasses()
    {
        Assert.That(UnitClassRegistry.Default.Count, Is.EqualTo(6));
    }

    [Test]
    public void Default_ContainsFighter()
    {
        Assert.That(UnitClassRegistry.Default.TryGet("fighter", out var def), Is.True);
        Assert.That(def!.Id, Is.EqualTo("fighter"));
    }

    [Test]
    public void Default_ContainsCleric()
    {
        Assert.That(UnitClassRegistry.Default.TryGet("cleric", out var def), Is.True);
        Assert.That(def!.Id, Is.EqualTo("cleric"));
    }

    [Test]
    public void Default_ContainsArcher()
    {
        Assert.That(UnitClassRegistry.Default.TryGet("archer", out var def), Is.True);
        Assert.That(def!.Id, Is.EqualTo("archer"));
    }

    [Test]
    public void Get_ThrowsForUnknownId()
    {
        var reg = new UnitClassRegistry();
        Assert.Throws<KeyNotFoundException>(() => reg.Get("unknown"));
    }

    [Test]
    public void Register_AddsNewClass()
    {
        var reg = new UnitClassRegistry();
        var def = FighterClassDef.Create();
        reg.Register(def);
        Assert.That(reg.Count, Is.EqualTo(1));
        Assert.That(reg.Get("fighter"), Is.SameAs(def));
    }

    [Test]
    public void Register_ReplacesExistingClass()
    {
        var reg  = new UnitClassRegistry();
        var def1 = FighterClassDef.Create();
        var def2 = FighterClassDef.Create(themeKey: "paladin");

        reg.Register(def1);
        reg.Register(def2);

        Assert.That(reg.Count,            Is.EqualTo(1));
        Assert.That(reg.Get("fighter"),   Is.SameAs(def2));
    }

    [Test]
    public void All_ReturnsAllRegistered()
    {
        var reg = new UnitClassRegistry();
        reg.Register(FighterClassDef.Create());
        reg.Register(ClericClassDef.Create());
        reg.Register(ArcherClassDef.Create());

        Assert.That(reg.All, Has.Count.EqualTo(3));
    }

    [Test]
    public void TryGet_ReturnsFalseForUnknown()
    {
        var reg = new UnitClassRegistry();
        Assert.That(reg.TryGet("nope", out _), Is.False);
    }
}
