import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GamepadAction, GamepadService } from './gamepad.service';

describe('GamepadService browser polling', () => {
  let service: GamepadService;
  let pad: Gamepad;
  let pads: (Gamepad | null)[];
  let frame: FrameRequestCallback;
  let hidden: boolean;
  let container: HTMLElement;
  let originalGamepads: PropertyDescriptor | undefined;
  let actions: GamepadAction[];

  function tick(time = 0): void {
    frame(time);
  }

  function press(index: number, pressed = true): void {
    (pad.buttons[index] as { pressed: boolean }).pressed = pressed;
  }

  function axes(x: number, y = 0, rightX = 0, rightY = 0): void {
    (pad.axes as number[]).splice(0, 4, x, y, rightX, rightY);
  }

  function render(html: string): HTMLElement[] {
    container.innerHTML = html;
    return Array.from(container.querySelectorAll<HTMLElement>('*')).map((element) => {
      const rect = new DOMRect(
        Number(element.dataset['x'] ?? 0),
        Number(element.dataset['y'] ?? 0),
        80,
        44,
      );
      vi.spyOn(element, 'getClientRects').mockReturnValue([rect] as unknown as DOMRectList);
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect);
      return element;
    });
  }

  beforeEach(() => {
    hidden = false;
    originalGamepads = Object.getOwnPropertyDescriptor(navigator, 'getGamepads');
    pad = {
      id: 'Standard test controller',
      index: 0,
      connected: true,
      mapping: 'standard',
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      axes: [0, 0, 0, 0],
    } as unknown as Gamepad;
    pads = [pad];
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => pads });
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frame = callback;
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    service = TestBed.inject(GamepadService);
    actions = [];
    service.actions.subscribe((action) => actions.push(action));
    service.start();
  });

  afterEach(() => {
    service.ngOnDestroy();
    container.remove();
    vi.restoreAllMocks();
    if (originalGamepads) Object.defineProperty(navigator, 'getGamepads', originalGamepads);
    else Reflect.deleteProperty(navigator, 'getGamepads');
  });

  it('recognizes standard controllers and tolerates missing or denied gamepad access', () => {
    tick();
    expect(service.connected()).toBe(true);
    expect(service.controllerName()).toBe('Standard test controller');
    pads = [{ ...pad, mapping: '' }];
    tick();
    expect(service.connected()).toBe(false);

    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => {
        throw new DOMException('Not permitted', 'SecurityError');
      },
    });
    expect(() => tick()).not.toThrow();
    expect(service.connected()).toBe(false);
  });

  it('requires neutral controls before arming and activates a held A button only once', () => {
    const [button] = render('<button>Guard</button>');
    const clicked = vi.fn();
    button.addEventListener('click', clicked);
    button.focus();
    press(0);
    tick();
    tick(100);
    expect(clicked).not.toHaveBeenCalled();
    press(0, false);
    tick(120);
    press(0);
    tick(140);
    tick(500);
    expect(clicked).toHaveBeenCalledTimes(1);
    press(0, false);
    tick(520);
    press(0);
    tick(540);
    expect(clicked).toHaveBeenCalledTimes(2);
  });

  it('uses spatial focus navigation and repeats navigation without activating controls', () => {
    const [first, disabled, second, hiddenButton, third] = render(`
      <button data-x="0">First</button>
      <button data-x="100" disabled>Disabled</button>
      <button data-x="200">Second</button>
      <button data-x="250" aria-hidden="true">Hidden</button>
      <button data-x="300">Third</button>
    `);
    const clicked = vi.fn();
    container.addEventListener('click', clicked);
    tick();
    press(15);
    tick(10);
    expect(document.activeElement).toBe(first);
    tick(200);
    expect(document.activeElement).toBe(first);
    tick(411);
    expect(document.activeElement).toBe(second);
    tick(562);
    expect(document.activeElement).toBe(third);
    expect(disabled.classList.contains('gamepad-focused')).toBe(false);
    expect(hiddenButton.classList.contains('gamepad-focused')).toBe(false);
    expect(first.classList.contains('gamepad-focused')).toBe(false);
    expect(third.classList.contains('gamepad-focused')).toBe(true);
    expect(clicked).not.toHaveBeenCalled();
  });

  it('ignores stick drift and emits one movement until the right stick is released', () => {
    tick();
    axes(0.2, -0.2, 0.3, 0.2);
    tick(10);
    expect(actions).toEqual([]);
    axes(0, 0, 1, 0);
    tick(20);
    tick(500);
    axes(0, 0, 0, -1);
    tick(600);
    expect(actions).toEqual(['move-right']);
    axes(0, 0, 0, 0);
    tick(700);
    axes(0, 0, 0, -1);
    tick(800);
    expect(actions).toEqual(['move-right', 'move-up']);
  });

  it('emits shoulder and cancel commands only on their press edges', () => {
    tick();
    for (const index of [4, 5, 1]) {
      press(index);
      tick();
      tick();
      press(index, false);
      tick();
    }
    expect(actions).toEqual(['previous-ability', 'next-ability', 'cancel']);
  });

  it.each(['disconnect', 'blur', 'visibility'] as const)(
    'requires release before accepting a held confirm after %s',
    (interruption) => {
      const [button] = render('<button>Deploy</button>');
      const clicked = vi.fn();
      button.addEventListener('click', clicked);
      button.focus();
      tick();
      press(0);
      tick();
      expect(clicked).toHaveBeenCalledTimes(1);

      if (interruption === 'disconnect') pads = [];
      else if (interruption === 'blur') window.dispatchEvent(new Event('blur'));
      else {
        hidden = true;
        document.dispatchEvent(new Event('visibilitychange'));
      }
      tick();
      if (interruption === 'disconnect') pads = [pad];
      else if (interruption === 'blur') window.dispatchEvent(new Event('focus'));
      else {
        hidden = false;
        document.dispatchEvent(new Event('visibilitychange'));
      }
      tick();
      tick();
      expect(clicked).toHaveBeenCalledTimes(1);
      press(0, false);
      tick();
      press(0);
      tick();
      expect(clicked).toHaveBeenCalledTimes(2);
    },
  );

  it('scopes navigation and activation to a modal and suppresses battlefield commands', () => {
    const [outside, modal, inside] = render(`
      <button>Outside</button>
      <div role="dialog" aria-modal="true"><button>Close</button></div>
    `);
    const outsideClick = vi.fn();
    const insideClick = vi.fn();
    const modalEscape = vi.fn();
    outside.addEventListener('click', outsideClick);
    inside.addEventListener('click', insideClick);
    modal.addEventListener('keydown', modalEscape);
    outside.focus();
    tick();
    press(0);
    tick();
    expect(outsideClick).not.toHaveBeenCalled();
    press(0, false);
    press(13);
    tick();
    expect(document.activeElement).toBe(inside);
    press(13, false);
    press(0);
    tick();
    expect(insideClick).toHaveBeenCalledTimes(1);
    press(0, false);
    press(5);
    axes(0, 0, 1);
    tick();
    press(5, false);
    press(1);
    tick();
    expect(actions).toEqual([]);
    expect(modalEscape).toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }));
  });

  it('does not take over a focused form field and requires neutral input when leaving it', () => {
    const [input, button] = render('<input aria-label="Name"><button>Continue</button>');
    const clicked = vi.fn();
    button.addEventListener('click', clicked);
    tick();
    input.focus();
    press(15);
    press(0);
    press(5);
    axes(0, 0, 1);
    tick();
    expect(document.activeElement).toBe(input);
    expect(actions).toEqual([]);
    button.focus();
    tick();
    expect(clicked).not.toHaveBeenCalled();
    press(15, false);
    press(0, false);
    press(5, false);
    axes(0);
    tick();
    press(0);
    tick();
    expect(clicked).toHaveBeenCalledTimes(1);
  });
});
