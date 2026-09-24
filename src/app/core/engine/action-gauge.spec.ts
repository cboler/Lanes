import { describe, it, expect } from 'vitest';
import { ActionGauge } from './action-gauge';

describe('ActionGauge', () => {
  it('initializes with full gauge', () => {
    const gauge = new ActionGauge(100);
    expect(gauge.max).toBe(100);
    expect(gauge.current).toBe(100);
    expect(gauge.fraction).toBe(1);
    expect(gauge.isExhausted).toBe(false);
  });

  it('rejects non-positive max in constructor', () => {
    expect(() => new ActionGauge(0)).toThrow();
    expect(() => new ActionGauge(-10)).toThrow();
  });

  it.each([NaN, Infinity, -Infinity])('rejects a non-finite maximum (%s)', (value) => {
    expect(() => new ActionGauge(value)).toThrow();
  });

  it.each([-1, NaN, Infinity, -Infinity])('rejects invalid spend and recovery (%s)', (value) => {
    const gauge = new ActionGauge(100);
    gauge.trySpend(30);
    expect(() => gauge.trySpend(value)).toThrow();
    expect(() => gauge.recover(value)).toThrow();
    expect(gauge.current).toBe(70);
  });

  it('partially recovers a spent gauge and caps recovery at maximum', () => {
    const gauge = new ActionGauge(100);
    gauge.exhaust();
    expect(gauge.recover(45)).toBe(45);
    expect(gauge.current).toBe(45);
    expect(gauge.recover(80)).toBe(55);
    expect(gauge.current).toBe(100);
    expect(gauge.recover(0)).toBe(0);
    expect(gauge.trySpend(0)).toBe(true);
    expect(gauge.current).toBe(100);
  });

  it('spends points successfully when affordable', () => {
    const gauge = new ActionGauge(100);
    expect(gauge.trySpend(30)).toBe(true);
    expect(gauge.current).toBe(70);
    expect(gauge.fraction).toBe(0.7);
  });

  it('rejects spending when insufficient gauge remains', () => {
    const gauge = new ActionGauge(40);
    expect(gauge.trySpend(50)).toBe(false);
    expect(gauge.current).toBe(40);
  });

  it('rejects negative spend amount', () => {
    const gauge = new ActionGauge(100);
    expect(() => gauge.trySpend(-5)).toThrow();
  });

  it('exhausts gauge to zero', () => {
    const gauge = new ActionGauge(100);
    gauge.exhaust();
    expect(gauge.current).toBe(0);
    expect(gauge.isExhausted).toBe(true);
    expect(gauge.fraction).toBe(0);
  });

  it('resets gauge to maximum', () => {
    const gauge = new ActionGauge(100);
    gauge.trySpend(60);
    expect(gauge.current).toBe(40);
    gauge.reset();
    expect(gauge.current).toBe(100);
    expect(gauge.fraction).toBe(1);
  });
});
