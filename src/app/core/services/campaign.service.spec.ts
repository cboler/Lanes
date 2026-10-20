import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CAMPAIGN } from '../models/campaign-story';
import { CampaignService } from './campaign.service';
import { RosterService } from './roster.service';

describe('CampaignService', () => {
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
  const [first, second] = CAMPAIGN[0].missions;

  beforeEach(() => {
    values.clear();
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    TestBed.resetTestingModule();
  });

  it('pays a first win once, opens the next mission, and remembers it after a reload', () => {
    const roster = TestBed.inject(RosterService);
    const campaign = TestBed.inject(CampaignService);
    expect(campaign.next()?.id).toBe(first.id);
    expect(campaign.isUnlocked(second.id)).toBe(false);
    const gold = roster.gold();

    const reward = campaign.complete(first.id, 'report-1');
    expect(reward).toEqual({ missionId: first.id, gold: first.reward.gold, items: [] });
    expect(roster.gold()).toBe(gold + first.reward.gold);
    // Asking again for the same battle shows the same reward without paying it twice.
    expect(campaign.complete(first.id, 'report-1')).toEqual(reward);
    // A replay pays nothing extra.
    expect(campaign.complete(first.id, 'report-2')).toBeNull();
    expect(roster.gold()).toBe(gold + first.reward.gold);
    expect(campaign.next()?.id).toBe(second.id);
    expect(campaign.isUnlocked(second.id)).toBe(true);

    TestBed.resetTestingModule();
    expect(TestBed.inject(CampaignService).cleared()).toEqual([first.id]);
  });

  it('hands over the reward items of a mission with its gold', () => {
    const roster = TestBed.inject(RosterService);
    const campaign = TestBed.inject(CampaignService);
    campaign.complete(first.id, 'a');
    const reward = campaign.complete(second.id, 'b')!;
    expect(reward.items).toEqual(second.reward.items);
    for (const item of second.reward.items!) expect(roster.count(item)).toBeGreaterThan(0);
  });

  it('starts over if the saved progress is unreadable', () => {
    storage.setItem('lanes.campaign.v1', '{broken');
    expect(TestBed.inject(CampaignService).cleared()).toEqual([]);
  });
});
