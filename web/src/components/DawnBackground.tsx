import {
  bindDawnPause,
  DAWN_ART_CLASS,
  DAWN_CLASS,
  DAWN_PAUSE_BUTTON_CLASS,
} from '@huntclub/design/dawnControl';
import { dawnSceneSvg } from '@huntclub/design/dawnScene';
import { dawnPauseCopy } from '@huntclub/shared';
import { memo, useEffect, useRef } from 'react';
// The scene's CSS (../../dawn-stylesheet.ts): bundled into this lazy chunk's stylesheet file.
import 'virtual:dawn-scene.css';

/** The scene's markup: static, from our own package (no user input), so inlining it is safe. */
const SCENE = { __html: dawnSceneSvg() };

/**
 * The dawn scene behind the sign-in card, with its pause button. Loaded lazily by the sign-in
 * page only, so signed-in pages never download it. Its parent must be positioned.
 */
function DawnBackground() {
  const art = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const scene = art.current?.querySelector(`.${DAWN_CLASS}`);
    if (!scene || !button.current) return;
    return bindDawnPause(scene, button.current, dawnPauseCopy);
  }, []);
  return (
    <>
      <div
        className={DAWN_ART_CLASS}
        aria-hidden="true"
        ref={art}
        dangerouslySetInnerHTML={SCENE}
      />
      <button
        className={`button ${DAWN_PAUSE_BUTTON_CLASS}`}
        type="button"
        aria-pressed="false"
        ref={button}
      >
        {dawnPauseCopy.pause}
      </button>
    </>
  );
}

// Never re-rendered: the pause button's label and state belong to bindDawnPause.
export default memo(DawnBackground);
