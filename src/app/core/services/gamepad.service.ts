import { DOCUMENT, Injectable, NgZone, OnDestroy, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';

/*
 * The standard-mapping layout, shared with the other games' controller support:
 *   D-pad / left stick  move focus           A  press the focused control
 *   B                   cancel or close      X  Guard and end the turn
 *   Y                   call an assist       LB / RB  previous / next skill
 *   LT / RT (hold)      walk left / right    Right stick  one step, or change lane
 *   View                combat log           Menu  jump to the battle toolbar
 */
export type GamepadAction =
  | 'cancel'
  | 'previous-ability'
  | 'next-ability'
  | 'move-up'
  | 'move-down'
  | 'move-left'
  | 'move-right'
  | 'end-turn'
  | 'assist'
  | 'walk-left'
  | 'walk-right'
  | 'walk-stop'
  | 'toggle-log'
  | 'menu';

type Direction = 'up' | 'down' | 'left' | 'right';

@Injectable({ providedIn: 'root' })
export class GamepadService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly actionSource = new Subject<GamepadAction>();
  public readonly actions = this.actionSource.asObservable();
  public readonly connected = signal(false);
  public readonly controllerName = signal('');

  private frame: number | null = null;
  private controllerKey = '';
  private armed = false;
  private suspended = false;
  private buttons: boolean[] = [];
  private navigation: Direction | null = null;
  private movement: Direction | null = null;
  private nextNavigationAt = 0;
  private focused: HTMLElement | null = null;

  public start(): void {
    const view = this.document.defaultView;
    if (this.frame !== null || !view?.navigator.getGamepads) return;
    view.addEventListener('blur', this.onBlur);
    view.addEventListener('focus', this.onFocus);
    view.addEventListener('pointerdown', this.clearFocusHighlight);
    view.addEventListener('keydown', this.clearFocusHighlight);
    this.document.addEventListener('visibilitychange', this.resetInput);
    this.zone.runOutsideAngular(() => {
      this.frame = view.requestAnimationFrame(this.poll);
    });
  }

  public ngOnDestroy(): void {
    const view = this.document.defaultView;
    if (this.frame !== null) view?.cancelAnimationFrame(this.frame);
    this.frame = null;
    view?.removeEventListener('blur', this.onBlur);
    view?.removeEventListener('focus', this.onFocus);
    view?.removeEventListener('pointerdown', this.clearFocusHighlight);
    view?.removeEventListener('keydown', this.clearFocusHighlight);
    this.document.removeEventListener('visibilitychange', this.resetInput);
    this.clearFocusHighlight();
    this.actionSource.complete();
  }

  private readonly poll = (time: number): void => {
    const view = this.document.defaultView;
    if (!view) return;
    let pad: Gamepad | undefined;
    try {
      pad = Array.from(view.navigator.getGamepads()).find(
        (candidate): candidate is Gamepad =>
          !!candidate?.connected && candidate.mapping === 'standard',
      );
    } catch {
      // Browsers may deny the API in an embedded page. Mouse and keyboard remain usable.
    }

    const key = pad ? `${pad.index}:${pad.id}` : '';
    if (key !== this.controllerKey) {
      this.controllerKey = key;
      this.resetInput();
      this.clearFocusHighlight();
      this.zone.run(() => {
        this.connected.set(!!pad);
        this.controllerName.set(pad?.id ?? '');
      });
    }

    if (pad && !this.document.hidden && !this.suspended && !this.isEditing()) {
      this.processInput(pad, time);
    } else {
      this.resetInput();
    }
    this.frame = view.requestAnimationFrame(this.poll);
  };

  private processInput(pad: Gamepad, time: number): void {
    const pressed = pad.buttons.map((button) => button.pressed);
    if (!this.armed) {
      // A held button must never become a fresh command after reconnecting or returning to the tab.
      this.armed = !pressed.some(Boolean) && pad.axes.every((axis) => Math.abs(axis) < 0.35);
      this.buttons = pressed;
      return;
    }

    const edge = (index: number) => pressed[index] && !this.buttons[index];
    const navigation = pressed[12]
      ? 'up'
      : pressed[13]
        ? 'down'
        : pressed[14]
          ? 'left'
          : pressed[15]
            ? 'right'
            : this.axisDirection(pad.axes[0], pad.axes[1]);
    const movement = this.axisDirection(pad.axes[2], pad.axes[3]);
    if (navigation && (navigation !== this.navigation || time >= this.nextNavigationAt)) {
      this.navigate(navigation);
      this.nextNavigationAt = time + (navigation === this.navigation ? 150 : 400);
    }

    const released = (index: number) => !pressed[index] && this.buttons[index];
    const anyEdge = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].some(edge);
    if (anyEdge || released(6) || released(7) || (movement && !this.movement)) {
      this.zone.run(() => {
        if (edge(1)) this.cancel();
        else if (edge(0)) this.activate();
        else if (!this.modal()) {
          if (edge(2)) this.actionSource.next('end-turn');
          else if (edge(3)) this.actionSource.next('assist');
          else if (edge(4)) this.actionSource.next('previous-ability');
          else if (edge(5)) this.actionSource.next('next-ability');
          else if (edge(6)) this.actionSource.next('walk-left');
          else if (edge(7)) this.actionSource.next('walk-right');
          else if (edge(8)) this.actionSource.next('toggle-log');
          else if (edge(9)) this.actionSource.next('menu');
          else if (movement && !this.movement) this.actionSource.next(`move-${movement}`);
        }
        // Letting go of a trigger always stops a walk, even under a dialog.
        if (released(6) || released(7)) this.actionSource.next('walk-stop');
      });
    }
    this.buttons = pressed;
    this.navigation = navigation;
    this.movement = movement;
  }

  private axisDirection(x = 0, y = 0): Direction | null {
    if (Math.max(Math.abs(x), Math.abs(y)) < 0.55) return null;
    return Math.abs(x) > Math.abs(y) ? (x < 0 ? 'left' : 'right') : y < 0 ? 'up' : 'down';
  }

  private modal(): HTMLElement | undefined {
    return Array.from(
      this.document.querySelectorAll<HTMLElement>(
        'dialog[open], [role="dialog"][aria-modal="true"]',
      ),
    )
      .reverse()
      .find((element) => element.getClientRects().length > 0);
  }

  private controls(): HTMLElement[] {
    return Array.from(
      (this.modal() ?? this.document).querySelectorAll<HTMLElement>(
        'button, a[href], [role="button"][tabindex]',
      ),
    ).filter(
      (element) =>
        !element.matches(':disabled, [aria-disabled="true"], [tabindex="-1"]') &&
        !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
        element.getClientRects().length > 0 &&
        this.document.defaultView?.getComputedStyle(element).visibility !== 'hidden',
    );
  }

  private navigate(direction: Direction): void {
    const controls = this.controls();
    const active = this.document.activeElement as HTMLElement;
    let next = controls[0];
    if (controls.includes(active)) {
      const current = active.getBoundingClientRect();
      const horizontal = direction === 'left' || direction === 'right';
      const sign = direction === 'left' || direction === 'up' ? -1 : 1;
      let bestScore = Infinity;
      next = active;
      for (const candidate of controls) {
        if (candidate === active) continue;
        const bounds = candidate.getBoundingClientRect();
        const dx = bounds.left + bounds.width / 2 - (current.left + current.width / 2);
        const dy = bounds.top + bounds.height / 2 - (current.top + current.height / 2);
        const along = (horizontal ? dx : dy) * sign;
        const across = Math.abs(horizontal ? dy : dx);
        const score = along + across * 3;
        if (along > 1 && score < bestScore) {
          bestScore = score;
          next = candidate;
        }
      }
    }
    if (!next) return;
    this.clearFocusHighlight();
    this.focused = next;
    next.classList.add('gamepad-focused');
    next.focus({ preventScroll: true });
    next.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  /** Moves controller focus to `element`, highlighted as D-pad focus is. */
  public focus(element: HTMLElement | null | undefined): void {
    if (!element) return;
    this.clearFocusHighlight();
    this.focused = element;
    element.classList.add('gamepad-focused');
    element.focus({ preventScroll: true });
  }

  private activate(): void {
    // A control can claim A while it shows (the aim's Fire), wherever focus has wandered.
    const claimed = this.document.querySelector<HTMLElement>('[data-pad-confirm]');
    if (claimed && !this.modal() && claimed.getClientRects().length > 0) {
      claimed.click();
      return;
    }
    const active = this.document.activeElement as HTMLElement;
    if (this.controls().includes(active)) active.click();
  }

  private cancel(): void {
    const modal = this.modal();
    if (modal) {
      modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    } else {
      this.actionSource.next('cancel');
    }
  }

  private isEditing(): boolean {
    return !!this.document.activeElement?.closest('input, textarea, select, [contenteditable]');
  }

  private readonly resetInput = (): void => {
    this.armed = false;
    this.buttons = [];
    this.navigation = null;
    this.movement = null;
    this.nextNavigationAt = 0;
  };

  private readonly onBlur = (): void => {
    this.suspended = true;
    this.resetInput();
  };

  private readonly onFocus = (): void => {
    this.suspended = false;
    this.resetInput();
  };

  private readonly clearFocusHighlight = (): void => {
    this.focused?.classList.remove('gamepad-focused');
    this.focused = null;
  };
}
