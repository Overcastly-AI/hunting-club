import { useEffect, useState, type RefObject } from 'react';

export interface Size {
  width: number;
  height: number;
}

/**
 * The element's content size in px, kept current by a ResizeObserver. `fallback` until the
 * first measurement (and in tests, where nothing is laid out).
 */
export function useElementSize(ref: RefObject<Element | null>, fallback: Size): Size {
  const [size, setSize] = useState<Size>(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
