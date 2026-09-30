import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import {
  Mercenary,
  generateStarterRoster,
  parseMercenary,
  seededRandom,
} from '../models/mercenary.model';
import { getClassDefinition } from '../models/unit-class.model';

const STORAGE_KEY = 'lanes.roster.v1';
export const SQUAD_LIMIT = 4;

interface SavedRoster {
  version: 1;
  mercenaries: Mercenary[];
  squadIds: string[];
}

@Injectable({ providedIn: 'root' })
export class RosterService {
  private readonly document = inject(DOCUMENT);
  public readonly warning = signal('');
  public readonly mercenaries = signal<Mercenary[]>([]);
  public readonly squadIds = signal<string[]>([]);

  /** Squad members in selection order. */
  public readonly squad = computed(() =>
    this.squadIds()
      .map((id) => this.mercenaries().find((merc) => merc.id === id))
      .filter((merc): merc is Mercenary => !!merc),
  );

  constructor() {
    const saved = this.load() ?? this.createStarter();
    this.mercenaries.set(saved.mercenaries);
    this.squadIds.set(saved.squadIds);
    if (!this.warning()) this.persist();
  }

  public toggleSquad(id: string): void {
    const current = this.squadIds();
    if (current.includes(id)) {
      // A squad never drops below one member, matching the squad builder.
      if (current.length > 1) this.squadIds.set(current.filter((other) => other !== id));
    } else if (current.length < SQUAD_LIMIT && this.mercenaries().some((m) => m.id === id)) {
      this.squadIds.set([...current, id]);
    }
    this.persist();
  }

  public classOf(merc: Mercenary) {
    return getClassDefinition(merc.classId);
  }

  private createStarter(): SavedRoster {
    const mercenaries = generateStarterRoster(seededRandom(Date.now() ^ (Math.random() * 2 ** 32)));
    return {
      version: 1,
      mercenaries,
      squadIds: mercenaries.slice(0, SQUAD_LIMIT).map((m) => m.id),
    };
  }

  private load(): SavedRoster | null {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const raw = JSON.parse(stored) as Partial<SavedRoster>;
      if (raw.version !== 1 || !Array.isArray(raw.mercenaries) || !Array.isArray(raw.squadIds)) {
        throw new Error('Unrecognized roster format.');
      }
      const mercenaries: Mercenary[] = [];
      for (const candidate of raw.mercenaries) {
        const merc = parseMercenary(candidate);
        if (!merc || mercenaries.some((other) => other.id === merc.id)) {
          throw new Error('Invalid mercenary.');
        }
        mercenaries.push(merc);
      }
      if (!mercenaries.length) throw new Error('Empty roster.');
      const squadIds = [
        ...new Set(raw.squadIds.filter((id) => mercenaries.some((merc) => merc.id === id))),
      ].slice(0, SQUAD_LIMIT);
      if (!squadIds.length) squadIds.push(mercenaries[0].id);
      return { version: 1, mercenaries, squadIds };
    } catch {
      this.warning.set('Saved roster could not be loaded; a new roster was created.');
      return null;
    }
  }

  private persist(): void {
    const data: SavedRoster = {
      version: 1,
      mercenaries: this.mercenaries(),
      squadIds: this.squadIds(),
    };
    try {
      const storage = this.document.defaultView?.localStorage;
      if (!storage) throw new Error('Device storage unavailable.');
      storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      this.warning.set('Roster is kept for this session, but device storage is unavailable.');
    }
  }
}
