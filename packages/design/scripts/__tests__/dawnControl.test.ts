import {
  bindDawnPause,
  DAWN_PAUSED_CLASS,
  DAWN_PAUSED_KEY,
  type DawnPauseButton,
  type DawnStorage,
} from '../../src/dawnControl';

const LABELS = { pause: 'Pause', play: 'Play' };

/** Just enough of an <svg>, a <button> and sessionStorage for the controller. */
function fakes(stored: Record<string, string> = {}) {
  const classes = new Set<string>();
  const scene = {
    classList: {
      toggle: (token: string, force?: boolean) => {
        const on = force ?? !classes.has(token);
        if (on) classes.add(token);
        else classes.delete(token);
        return on;
      },
      contains: (token: string) => classes.has(token),
    },
  };
  let click: (() => void) | undefined;
  const attributes: Record<string, string> = {};
  const button: DawnPauseButton = {
    textContent: null,
    hidden: true,
    setAttribute: (name, value) => void (attributes[name] = value),
    addEventListener: (_type, listener) => void (click = listener),
    removeEventListener: () => void (click = undefined),
  };
  const storage: DawnStorage = {
    getItem: (key) => stored[key] ?? null,
    setItem: (key, value) => void (stored[key] = value),
    removeItem: (key) => void delete stored[key],
  };
  return { scene, classes, button, attributes, storage, stored, press: () => click?.() };
}

describe('dawn pause button', () => {
  it('starts playing, then pauses and plays on each press', () => {
    const f = fakes();
    bindDawnPause(f.scene, f.button, LABELS, () => f.storage);
    expect(f.button.hidden).toBe(false);
    expect(f.button.textContent).toBe(LABELS.pause);
    expect(f.attributes['aria-pressed']).toBe('false');

    f.press();
    expect(f.classes.has(DAWN_PAUSED_CLASS)).toBe(true);
    expect(f.button.textContent).toBe(LABELS.play);
    expect(f.attributes['aria-pressed']).toBe('true');
    expect(f.stored[DAWN_PAUSED_KEY]).toBe('1');

    f.press();
    expect(f.classes.has(DAWN_PAUSED_CLASS)).toBe(false);
    expect(f.button.textContent).toBe(LABELS.pause);
    expect(f.attributes['aria-pressed']).toBe('false');
    expect(f.stored[DAWN_PAUSED_KEY]).toBeUndefined();
  });

  it('remembers a pause for the tab', () => {
    const f = fakes({ [DAWN_PAUSED_KEY]: '1' });
    bindDawnPause(f.scene, f.button, LABELS, () => f.storage);
    expect(f.classes.has(DAWN_PAUSED_CLASS)).toBe(true);
    expect(f.button.textContent).toBe(LABELS.play);
    expect(f.attributes['aria-pressed']).toBe('true');
  });

  it('still works when storage is blocked', () => {
    const f = fakes();
    const blocked = (): DawnStorage => {
      throw new Error('SecurityError');
    };
    bindDawnPause(f.scene, f.button, LABELS, blocked);
    f.press();
    expect(f.classes.has(DAWN_PAUSED_CLASS)).toBe(true);
  });

  it('lets go of the button on cleanup', () => {
    const f = fakes();
    bindDawnPause(f.scene, f.button, LABELS, () => f.storage)();
    f.press();
    expect(f.classes.has(DAWN_PAUSED_CLASS)).toBe(false);
  });
});
