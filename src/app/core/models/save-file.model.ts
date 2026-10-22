/*
 * A backup of everything the game saves in this browser, as one file the player can keep
 * or carry to another device. Each entry is stored exactly as saved; the services check
 * their own data when it loads, so a backup only has to be the right shape.
 */

/** Every key the game saves under. */
export const SAVE_KEYS = [
  'lanes.roster.v1',
  'lanes.guild.v1',
  'lanes.campaign.v1',
  'lanes.overworld.v1',
  'lanes.defense-plan.v1',
  'lanes.timing.v1',
] as const;

export interface SaveFile {
  readonly game: 'lanes';
  readonly version: 1;
  readonly savedAt: string;
  readonly data: Partial<Record<(typeof SAVE_KEYS)[number], string>>;
}

export function createSaveFile(storage: Pick<Storage, 'getItem'>, now = new Date()): SaveFile {
  const data: SaveFile['data'] = {};
  for (const key of SAVE_KEYS) {
    const value = storage.getItem(key);
    if (value !== null) data[key] = value;
  }
  return { game: 'lanes', version: 1, savedAt: now.toISOString(), data };
}

/** The entries of a backup file's text, or null if it is not a Lanes backup with a roster. */
export function parseSaveFile(text: string): SaveFile['data'] | null {
  let raw: Partial<SaveFile>;
  try {
    raw = JSON.parse(text) as Partial<SaveFile>;
  } catch {
    return null;
  }
  if (!raw || raw.game !== 'lanes' || raw.version !== 1 || !raw.data) return null;
  if (typeof raw.data !== 'object') return null;
  const data: SaveFile['data'] = {};
  for (const key of SAVE_KEYS) {
    const value = (raw.data as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.length <= 1_000_000) data[key] = value;
  }
  return data['lanes.roster.v1'] ? data : null;
}
