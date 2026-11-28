// The phones the web layouts are checked on in a real browser (web/scripts/shoot.ts and
// site/scripts/shoot.mjs), from the UAT iPhone audit: the smallest current iPhone held upright,
// a standard one both ways, and the largest on its side. CSS px of the window Safari leaves the
// page with its bars showing (Playwright's device sizes), except the SE, whose whole 375 by 667
// screen is the window and `fold` is where Safari's bottom bar starts.

/** One phone held one way up. */
export interface PhoneViewport {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** Where the first screen ends, when Safari's bars cover part of the window. */
  readonly fold?: number;
}

type PhoneName = 'sePortrait' | 'iphone15Portrait' | 'iphone15Landscape' | 'proMaxLandscape';

export const PHONE_VIEWPORTS: Readonly<Record<PhoneName, PhoneViewport>> = {
  sePortrait: { name: 'iPhone SE portrait', width: 375, height: 667, fold: 548 },
  iphone15Portrait: { name: 'iPhone 15 portrait', width: 393, height: 659 },
  iphone15Landscape: { name: 'iPhone 15 landscape', width: 734, height: 343 },
  proMaxLandscape: { name: 'iPhone 15 Pro Max landscape', width: 814, height: 380 },
};
