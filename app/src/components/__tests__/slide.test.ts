import { SLIDE_CONFIRM_AT, clampSlide, slideConfirms } from '../slide';

describe('slide to confirm', () => {
  const travel = 200;

  it('keeps the thumb inside the track', () => {
    expect(clampSlide(-30, travel)).toBe(0);
    expect(clampSlide(120, travel)).toBe(120);
    expect(clampSlide(500, travel)).toBe(travel);
  });

  it('confirms only near the end of the track', () => {
    expect(slideConfirms(travel * SLIDE_CONFIRM_AT - 1, travel)).toBe(false);
    expect(slideConfirms(travel * SLIDE_CONFIRM_AT, travel)).toBe(true);
    expect(slideConfirms(1000, travel)).toBe(true);
  });

  it('never confirms a tap or before the track is measured', () => {
    expect(slideConfirms(0, travel)).toBe(false);
    expect(slideConfirms(50, 0)).toBe(false);
  });
});
