import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SAVE_KEYS, createSaveFile, parseSaveFile } from '../core/models/save-file.model';
import { BattleStateService } from '../core/services/battle-state.service';

/** Settings and save data: back up, restore, or start over. */
@Component({
  selector: 'app-options',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="options-page" aria-labelledby="options-title">
      <header class="options-card">
        <a routerLink="/guild" class="tactical-btn secondary">◀ Guild Hall</a>
        <h1 id="options-title">Options</h1>
      </header>

      <section class="options-card" aria-labelledby="battle-options-title">
        <h2 id="battle-options-title">Battle</h2>
        <p>
          Timing aims ranged and magic skills and chains melee combos. Off, every attack lands at
          normal power.
        </p>
        <button
          type="button"
          class="tactical-btn secondary"
          id="options-timing-btn"
          [class.active-gold]="battle.timingEnabled()"
          [attr.aria-pressed]="battle.timingEnabled()"
          (click)="battle.toggleTiming()"
        >
          🎯 Timing: {{ battle.timingEnabled() ? 'ON' : 'OFF' }}
        </button>
      </section>

      <section class="options-card" aria-labelledby="save-title">
        <h2 id="save-title">Save data</h2>
        <p>
          Your roster, gold, items, campaign and contracts are saved in this browser only. Download
          a backup to keep them safe or to carry them to another device, then restore it there.
        </p>
        <div class="options-actions">
          <button
            type="button"
            class="tactical-btn primary"
            id="export-save-btn"
            (click)="export()"
          >
            ⬇ Download backup
          </button>
          <button
            type="button"
            class="tactical-btn secondary"
            id="import-save-btn"
            (click)="pick()"
          >
            ⬆ Restore from backup
          </button>
          <input
            #file
            type="file"
            accept=".json,application/json"
            class="visually-hidden"
            id="import-save-input"
            tabindex="-1"
            aria-label="Backup file to restore"
            (change)="restore(file.files?.[0])"
          />
        </div>
        @if (message()) {
          <p class="options-message" role="status" id="save-message">{{ message() }}</p>
        }
        <h3>Start over</h3>
        <p>Erases every saved mercenary, item and mission on this device. This cannot be undone.</p>
        <button
          type="button"
          class="tactical-btn danger"
          id="reset-save-btn"
          (click)="reset()"
          (blur)="confirmingReset.set(false)"
        >
          {{ confirmingReset() ? 'Press again to erase everything' : 'Start a new game' }}
        </button>
      </section>

      <p class="options-footnote">
        <a routerLink="/status">Diagnostics</a>
      </p>
    </section>
  `,
  styles: `
    .options-page {
      display: grid;
      gap: var(--space-4);
      max-width: 760px;
      margin: 0 auto;
    }

    .options-card {
      padding: var(--space-4);
      border: 1px solid var(--border-gilded);
      border-radius: var(--radius-md);
      background: var(--bg-surface);

      h1 {
        margin: var(--space-3) 0 0;
      }

      h2 {
        margin: 0 0 var(--space-2);
        font-size: var(--font-size-lg);
        color: var(--color-gold-antique);
      }

      h3 {
        margin: var(--space-4) 0 var(--space-1);
        font-size: var(--font-size-base);
      }

      p {
        margin: 0 0 var(--space-3);
        color: var(--text-secondary);
      }

      button {
        min-height: 44px;
      }
    }

    .options-actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .options-message {
      margin: var(--space-3) 0 0 !important;
      color: #ffd36a !important;
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }

    .options-footnote {
      margin: 0;
      text-align: center;
      font-size: var(--font-size-sm);
    }
  `,
})
export class OptionsComponent {
  protected readonly battle = inject(BattleStateService);
  private readonly document = inject(DOCUMENT);
  private readonly file = viewChild.required<ElementRef<HTMLInputElement>>('file');
  protected readonly message = signal('');
  protected readonly confirmingReset = signal(false);

  private get storage(): Storage | undefined {
    try {
      return this.document.defaultView?.localStorage;
    } catch {
      return undefined;
    }
  }

  protected export(): void {
    const storage = this.storage;
    if (!storage) {
      this.message.set('Device storage is unavailable, so there is nothing to back up.');
      return;
    }
    const save = createSaveFile(storage);
    const url = URL.createObjectURL(new Blob([JSON.stringify(save)], { type: 'application/json' }));
    const link = this.document.createElement('a');
    link.href = url;
    link.download = `lanes-backup-${save.savedAt.slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url));
    this.message.set('Backup downloaded.');
  }

  protected pick(): void {
    this.file().nativeElement.click();
  }

  protected async restore(file: File | undefined): Promise<void> {
    if (!file) return;
    const data = parseSaveFile(await file.text());
    this.file().nativeElement.value = '';
    const storage = this.storage;
    if (!data || !storage) {
      this.message.set('That file is not a Lanes backup, so nothing was changed.');
      return;
    }
    for (const key of SAVE_KEYS) {
      const value = data[key];
      if (value === undefined) storage.removeItem(key);
      else storage.setItem(key, value);
    }
    // Every service reads its save when the game starts, so start it again.
    this.reload();
  }

  protected reset(): void {
    if (!this.confirmingReset()) {
      this.confirmingReset.set(true);
      return;
    }
    for (const key of SAVE_KEYS) this.storage?.removeItem(key);
    this.reload();
  }

  private reload(): void {
    this.document.defaultView?.location.assign(this.document.baseURI);
  }
}
