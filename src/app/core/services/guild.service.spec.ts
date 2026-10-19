import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { GuildService } from './guild.service';
import { RosterService } from './roster.service';

describe('GuildService', () => {
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

  it('posts one contract per tier at the squad level, and keeps the board after a reload', () => {
    const guild = TestBed.inject(GuildService);
    expect(guild.partyLevel()).toBe(1);
    expect(guild.contracts().map((c) => c.tier)).toEqual(['easy', 'normal', 'hard']);
    const ids = guild.contracts().map((c) => c.id);
    TestBed.resetTestingModule();
    expect(
      TestBed.inject(GuildService)
        .contracts()
        .map((c) => c.id),
    ).toEqual(ids);
  });

  it('replaces a won contract with a new one of its tier, scaled to the squad now', () => {
    const roster = TestBed.inject(RosterService);
    const guild = TestBed.inject(GuildService);
    const won = guild.contracts()[1];
    roster.mercenaries.update((list) => list.map((m) => ({ ...m, level: 5 })));
    guild.complete(won.id);
    const next = guild.contracts()[1];
    expect(next.id).not.toBe(won.id);
    expect(next.tier).toBe('normal');
    expect(next.level).toBe(5);
    expect(guild.completed()).toBe(1);
    // Completing it again does nothing.
    guild.complete(won.id);
    expect(guild.completed()).toBe(1);
  });

  it('starts a fresh board if the saved one is unreadable', () => {
    storage.setItem('lanes.guild.v1', '{broken');
    expect(TestBed.inject(GuildService).contracts()).toHaveLength(3);
  });
});
