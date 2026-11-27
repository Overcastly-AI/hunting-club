import { useCallback, useEffect, useState } from 'react';

const SECOND_MS = 1000;

/**
 * A countdown in whole seconds: `start()` sets it to `seconds`, and it ticks down to 0
 * once a second (no timer runs while it is at 0). `remaining` is 0 when it is over.
 */
export function useCooldown(seconds: number): { remaining: number; start: () => void } {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const remaining = endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / SECOND_MS));

  useEffect(() => {
    if (remaining === 0) return;
    const timer = setInterval(() => setNow(Date.now()), SECOND_MS);
    return () => clearInterval(timer);
  }, [remaining]);

  const start = useCallback(() => {
    const at = Date.now();
    setNow(at);
    setEndsAt(at + seconds * SECOND_MS);
  }, [seconds]);

  return { remaining, start };
}
