import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SoundService } from './sound.service';

describe('SoundService', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };

  beforeEach(() => {
    values.clear();
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    TestBed.resetTestingModule();
  });

  it('starts on, remembers being turned off and the volume, and clamps it', () => {
    const sound = TestBed.inject(SoundService);
    expect(sound.enabled()).toBe(true);
    sound.toggle();
    sound.setVolume(1.7);
    expect(sound.volume()).toBe(1);
    TestBed.resetTestingModule();
    const again = TestBed.inject(SoundService);
    expect(again.enabled()).toBe(false);
    expect(again.volume()).toBe(1);
  });

  it('plays nothing, and does not throw, where Web Audio is missing', () => {
    expect(() => TestBed.inject(SoundService).play('hit', 100)).not.toThrow();
  });
});
