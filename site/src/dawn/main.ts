// The home hero's one script (bundled by `vite build --mode client`, self-hosted): wires the
// pause button to the dawn scene, which is already in the HTML and animates without it.
import { bindDawnPause, DAWN_CLASS, DAWN_PAUSE_BUTTON_CLASS } from '@huntclub/design/dawnControl';
// The copy's own entry, not the package index: keeps this script to the button's few lines.
import { dawnPauseCopy } from '@huntclub/shared/signInCopy';

const scene = document.querySelector(`.${DAWN_CLASS}`);
const button = document.querySelector<HTMLButtonElement>(`.${DAWN_PAUSE_BUTTON_CLASS}`);
if (scene && button) bindDawnPause(scene, button, dawnPauseCopy);
