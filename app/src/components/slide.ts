/** How far (as a share of the travel) the thumb must be dragged to confirm. */
export const SLIDE_CONFIRM_AT = 0.85;

/** Thumb offset for a drag of `dx`, kept inside the track. */
export function clampSlide(dx: number, travel: number): number {
  return Math.min(Math.max(0, dx), Math.max(0, travel));
}

/** Whether a drag released at `dx` confirms. */
export function slideConfirms(dx: number, travel: number): boolean {
  return travel > 0 && clampSlide(dx, travel) >= travel * SLIDE_CONFIRM_AT;
}
