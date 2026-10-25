import {
  Component,
  DOCUMENT,
  HostListener,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { GamepadService } from './core/services/gamepad.service';
import { BattleStateService } from './core/services/battle-state.service';
import { RosterService } from './core/services/roster.service';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  protected readonly gamepad = inject(GamepadService);
  protected readonly roster = inject(RosterService);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly battle = inject(BattleStateService);
  private readonly location = signal('/');
  protected readonly onMap = computed(() => this.location().split(/[?#]/)[0] === '/');
  protected readonly inBattle = computed(() => this.location().split(/[?#]/)[0] === '/battle');
  protected readonly battleInProgress = computed(
    () => this.battle.units().length > 0 && this.battle.battleStatus() === 'active',
  );
  protected readonly title = signal('Lanes');
  protected readonly canInstall = signal(false);

  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private installPromptListener?: (e: Event) => void;
  private returnFocus: HTMLElement | null = null;

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) this.location.set(event.urlAfterRedirects);
    });
    this.gamepad.actions.pipe(takeUntilDestroyed()).subscribe((action) => {
      if (action === 'menu' && !this.inBattle()) this.openCompany();
      if (action === 'cancel' && !this.onMap() && !this.inBattle())
        void this.router.navigate(['/']);
    });
  }

  protected openCompany(): void {
    if (this.document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]:not(dialog)'))
      return;
    this.returnFocus = this.document.activeElement as HTMLElement | null;
    this.document.querySelector<HTMLDialogElement>('#company-menu')?.showModal();
    const control = this.document.getElementById('nav-link-overworld');
    if (this.gamepad.connected()) this.gamepad.focus(control);
    else control?.focus();
  }

  protected closeCompany(event?: Event): void {
    event?.preventDefault();
    this.document.querySelector<HTMLDialogElement>('#company-menu')?.close();
    const control = this.returnFocus?.isConnected
      ? this.returnFocus
      : this.document.getElementById('company-menu-btn');
    if (this.gamepad.connected()) this.gamepad.focus(control);
    else control?.focus({ preventScroll: true });
  }

  protected trapCompanyFocus(event: Event): void {
    const key = event as KeyboardEvent;
    const controls = this.document.querySelectorAll<HTMLElement>(
      '#company-menu a, #company-menu button',
    );
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (this.document.activeElement === (key.shiftKey ? first : last)) {
      key.preventDefault();
      (key.shiftKey ? last : first)?.focus();
    }
  }

  @HostListener('document:keydown', ['$event'])
  protected key(event: KeyboardEvent): void {
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      this.document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]:not(dialog)') ||
      /INPUT|SELECT|TEXTAREA/.test((event.target as HTMLElement)?.tagName)
    )
      return;
    if (event.key.toLowerCase() === 'c' && !this.inBattle()) {
      event.preventDefault();
      this.openCompany();
    } else if (event.key === 'Escape' && !this.onMap() && !this.inBattle()) {
      event.preventDefault();
      void this.router.navigate(['/']);
    }
  }

  ngOnInit(): void {
    this.gamepad.start();
    if (typeof window !== 'undefined') {
      this.installPromptListener = (e: Event) => {
        e.preventDefault();
        this.deferredPrompt = e as BeforeInstallPromptEvent;
        this.canInstall.set(true);
      };
      window.addEventListener('beforeinstallprompt', this.installPromptListener);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      if (this.installPromptListener) {
        window.removeEventListener('beforeinstallprompt', this.installPromptListener);
      }
    }
  }

  protected async installApp(): Promise<void> {
    if (!this.deferredPrompt) return;
    await this.deferredPrompt.prompt();
    const choice = await this.deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      this.canInstall.set(false);
      this.deferredPrompt = null;
    }
  }
}
