/** Joins the class names that are set: `cx('a', on && 'b')`. */
export const cx = (...names: (string | false | null | undefined)[]) =>
  names.filter(Boolean).join(' ');
