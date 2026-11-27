// The emailed code's field, shared by the app's and the web admin's sign-in (React only, so it
// is a subpath of its own: `@huntclub/shared/useCodeEntry`; Lambdas never load React).
import { useCallback, useRef, useState } from 'react';
import { nextCode } from './signInCopy';

export interface CodeEntryOptions {
  /** Digits the code has (emailCodeRules(kind).length); undefined before a code is sent. */
  readonly maxLength: number | undefined;
  /** Sends the code. Reports its own errors; resolves when the attempt is over. */
  readonly confirm: (code: string) => Promise<unknown>;
  /** Called instead of `confirm` when the code is short or too long. */
  readonly incomplete: () => void;
}

export interface CodeEntry {
  readonly code: string;
  /** The field's text changed (typed, pasted or filled from the email). */
  readonly change: (input: string) => void;
  /** Sign in with what is in the field (the button or Enter). */
  readonly submit: () => void;
  readonly clear: () => void;
}

/**
 * The code field's value and its submit: digits only (nextCode), sent as soon as the last
 * digit lands, and one confirm at a time, so the last digit landing and a press of the button
 * or Enter never both send it. A code of the wrong length is never sent or cut down.
 */
export function useCodeEntry({ maxLength, confirm, incomplete }: CodeEntryOptions): CodeEntry {
  const [code, setCode] = useState('');
  // The latest value, read by submit and change between renders.
  const latest = useRef('');
  const confirming = useRef(false);

  const set = useCallback((value: string) => {
    latest.current = value;
    setCode(value);
  }, []);

  const send = (value: string) => {
    if (maxLength === undefined || confirming.current) return;
    if (value.length !== maxLength) {
      incomplete();
      return;
    }
    confirming.current = true;
    void confirm(value).finally(() => {
      confirming.current = false;
    });
  };

  const change = (input: string) => {
    if (maxLength === undefined) return;
    const value = nextCode(latest.current, input, maxLength);
    set(value);
    if (value.length === maxLength) send(value);
  };

  return {
    code,
    change,
    submit: () => send(latest.current),
    clear: () => set(''),
  };
}
