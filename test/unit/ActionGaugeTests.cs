using System;
using NUnit.Framework;
using Lanes.Combat;

namespace Lanes.Tests;

[TestFixture]
public sealed class ActionGaugeTests
{
    [Test]
    public void NewGauge_IsFull()
    {
        var gauge = new ActionGauge(100f);
        Assert.That(gauge.Current, Is.EqualTo(100f));
        Assert.That(gauge.IsExhausted, Is.False);
        Assert.That(gauge.Fraction, Is.EqualTo(1f));
    }

    [Test]
    public void TrySpend_AffordableCost_Succeeds()
    {
        var gauge = new ActionGauge(100f);
        bool result = gauge.TrySpend(30f);
        Assert.That(result,        Is.True);
        Assert.That(gauge.Current, Is.EqualTo(70f));
    }

    [Test]
    public void TrySpend_ExactlyFull_Succeeds()
    {
        var gauge = new ActionGauge(100f);
        bool result = gauge.TrySpend(100f);
        Assert.That(result,           Is.True);
        Assert.That(gauge.IsExhausted, Is.True);
    }

    [Test]
    public void TrySpend_TooExpensive_Fails_AndDoesNotChange()
    {
        var gauge = new ActionGauge(50f);
        bool result = gauge.TrySpend(60f);
        Assert.That(result,        Is.False);
        Assert.That(gauge.Current, Is.EqualTo(50f));
    }

    [Test]
    public void TrySpend_NegativeCost_Throws()
    {
        var gauge = new ActionGauge(100f);
        Assert.Throws<ArgumentOutOfRangeException>(() => gauge.TrySpend(-1f));
    }

    [Test]
    public void Exhaust_SetsCurrentToZero()
    {
        var gauge = new ActionGauge(80f);
        gauge.Exhaust();
        Assert.That(gauge.IsExhausted, Is.True);
        Assert.That(gauge.Current,     Is.EqualTo(0f));
    }

    [Test]
    public void Reset_RestoresFull()
    {
        var gauge = new ActionGauge(100f);
        gauge.TrySpend(60f);
        gauge.Reset();
        Assert.That(gauge.Current, Is.EqualTo(100f));
    }

    [Test]
    public void Fraction_ReflectsRemaining()
    {
        var gauge = new ActionGauge(100f);
        gauge.TrySpend(25f);
        Assert.That(gauge.Fraction, Is.EqualTo(0.75f).Within(0.001f));
    }

    [Test]
    public void Constructor_NegativeMax_Throws()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => _ = new ActionGauge(-1f));
    }

    [Test]
    public void Constructor_ZeroMax_Throws()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => _ = new ActionGauge(0f));
    }
}
