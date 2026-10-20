import { describe, expect, it } from 'vitest';
import { createSaveFile, parseSaveFile } from './save-file.model';

describe('save files', () => {
  const stored = new Map([
    ['lanes.roster.v1', '{"version":2}'],
    ['lanes.campaign.v1', '{"version":1,"cleared":[]}'],
    ['someone-else', 'x'],
  ]);
  const storage = { getItem: (key: string) => stored.get(key) ?? null };

  it('backs up only the game’s own keys, exactly as saved, and reads them back', () => {
    const save = createSaveFile(storage, new Date('2026-10-20T12:00:00Z'));
    expect(save).toEqual({
      game: 'lanes',
      version: 1,
      savedAt: '2026-10-20T12:00:00.000Z',
      data: {
        'lanes.roster.v1': '{"version":2}',
        'lanes.campaign.v1': '{"version":1,"cleared":[]}',
      },
    });
    expect(parseSaveFile(JSON.stringify(save))).toEqual(save.data);
  });

  it('refuses files that are not a Lanes backup with a roster', () => {
    expect(parseSaveFile('not json')).toBeNull();
    expect(parseSaveFile(JSON.stringify({ game: 'other', version: 1, data: {} }))).toBeNull();
    expect(
      parseSaveFile(
        JSON.stringify({ game: 'lanes', version: 1, data: { 'lanes.guild.v1': '{}' } }),
      ),
    ).toBeNull();
    // Unknown keys and non-text values are dropped.
    expect(
      parseSaveFile(
        JSON.stringify({
          game: 'lanes',
          version: 1,
          data: { 'lanes.roster.v1': '{}', 'lanes.guild.v1': 5, evil: 'x' },
        }),
      ),
    ).toEqual({ 'lanes.roster.v1': '{}' });
  });
});
