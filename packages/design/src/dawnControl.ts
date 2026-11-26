/**
 * The dawn scene's pause button behaviour, framework-free and without the scene itself (so the
 * site's small pause script and the admin's sign-in page do not pull in the sprites).
 * The site's script and the admin's sign-in page both call bindDawnPause.
 */

/** The scene's <svg> (dawnSceneSvg); pages find it by this class. */
export const DAWN_CLASS = 'dawn';

/** A host element for the scene where a page needs one (React): it takes no space itself. */
export const DAWN_ART_CLASS = 'dawn-art';

/** Put this class on the scene's <svg> to pause every animation in it. */
export const DAWN_PAUSED_CLASS = 'dawn--paused';

/** The scene's pause button (placed by dawnSceneCss). */
export const DAWN_PAUSE_BUTTON_CLASS = 'dawn-pause';

/** sessionStorage key: the visitor paused the background in this tab. */
export const DAWN_PAUSED_KEY = 'huntclub.dawnPaused';

/** The button's two labels (from @huntclub/shared, so every page says the same thing). */
export interface DawnPauseLabels {
  readonly pause: string;
  readonly play: string;
}

/**
 * The parts of the DOM this uses, typed here because the design package has no DOM types
 * (an Element, an HTMLButtonElement and sessionStorage all fit).
 */
export interface DawnScene {
  readonly classList: {
    toggle(token: string, force?: boolean): boolean;
    contains(token: string): boolean;
  };
}
export interface DawnPauseButton {
  textContent: string | null;
  /** The DOM types it as boolean or "until-found"; this only ever sets false. */
  hidden: boolean | string;
  setAttribute(name: string, value: string): void;
  addEventListener(type: 'click', listener: () => void): void;
  removeEventListener(type: 'click', listener: () => void): void;
}
export interface DawnStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The tab's sessionStorage; reading it can throw, so only inside the try blocks below. */
const sessionStore = (): DawnStorage =>
  (globalThis as unknown as { sessionStorage: DawnStorage }).sessionStorage;

/** Storage can be missing or throw (private mode, blocked site data): never let that break the page. */
function remembered(storage: () => DawnStorage): boolean {
  try {
    return storage().getItem(DAWN_PAUSED_KEY) === '1';
  } catch {
    return false;
  }
}

function remember(storage: () => DawnStorage, paused: boolean): void {
  try {
    if (paused) storage().setItem(DAWN_PAUSED_KEY, '1');
    else storage().removeItem(DAWN_PAUSED_KEY);
  } catch {
    // Not remembered; the button still works for this page.
  }
}

/**
 * Wires the pause button to the scene: each press toggles DAWN_PAUSED_CLASS on the <svg>,
 * swaps the label and sets aria-pressed, and the choice is kept for the tab in sessionStorage.
 * Shows the button (it starts `hidden` where it is rendered without script). Returns a cleanup.
 */
export function bindDawnPause(
  scene: DawnScene,
  button: DawnPauseButton,
  labels: DawnPauseLabels,
  storage: () => DawnStorage = sessionStore,
): () => void {
  const show = (paused: boolean) => {
    scene.classList.toggle(DAWN_PAUSED_CLASS, paused);
    button.textContent = paused ? labels.play : labels.pause;
    button.setAttribute('aria-pressed', String(paused));
  };
  show(remembered(storage));
  button.hidden = false;
  const onClick = () => {
    const paused = !scene.classList.contains(DAWN_PAUSED_CLASS);
    show(paused);
    remember(storage, paused);
  };
  button.addEventListener('click', onClick);
  return () => button.removeEventListener('click', onClick);
}
