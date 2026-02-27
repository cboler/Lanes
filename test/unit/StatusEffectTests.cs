using NUnit.Framework;
using Lanes.Combat;

namespace Lanes.Tests;

/// <summary>
/// Tests for the status effect system: creation, ticking,
/// expiry, and stat modification.
/// </summary>
[TestFixture]
public sealed class StatusEffectTests
{
    // ── Construction ─────────────────────────────────────────────────────

    [Test]
    public void NewEffect_HasCorrectProperties()
    {
        var effect = new StatusEffectInstance(StatusEffectType.Poison, remainingTurns: 3, potency: 10);
        Assert.Multiple(() =>
        {
            Assert.That(effect.Type,           Is.EqualTo(StatusEffectType.Poison));
            Assert.That(effect.RemainingTurns, Is.EqualTo(3));
            Assert.That(effect.Potency,        Is.EqualTo(10));
            Assert.That(effect.IsExpired,       Is.False);
        });
    }

    [Test]
    public void Constructor_ThrowsOnZeroDuration()
    {
        Assert.Throws<System.ArgumentOutOfRangeException>(
            () => new StatusEffectInstance(StatusEffectType.Stun, 0, 1));
    }

    [Test]
    public void Constructor_ThrowsOnZeroPotency()
    {
        Assert.Throws<System.ArgumentOutOfRangeException>(
            () => new StatusEffectInstance(StatusEffectType.Stun, 1, 0));
    }

    // ── Tick ─────────────────────────────────────────────────────────────

    [Test]
    public void Tick_DecrementsDuration()
    {
        var effect = new StatusEffectInstance(StatusEffectType.AttackUp, 2, 5);
        effect.Tick();
        Assert.That(effect.RemainingTurns, Is.EqualTo(1));
    }

    [Test]
    public void Tick_ExpiresAfterAllTurns()
    {
        var effect = new StatusEffectInstance(StatusEffectType.DefenseDown, 1, 5);
        effect.Tick();
        Assert.That(effect.IsExpired, Is.True);
    }

    [Test]
    public void Tick_DoesNotGoBelowZero()
    {
        var effect = new StatusEffectInstance(StatusEffectType.Stun, 1, 1);
        effect.Tick();
        effect.Tick(); // extra tick after expiry
        Assert.That(effect.RemainingTurns, Is.EqualTo(0));
    }
}
