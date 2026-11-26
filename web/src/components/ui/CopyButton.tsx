import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, type ButtonVariant } from './Button';
import { COPIED_MS } from './sizes';

type State = 'idle' | 'copied' | 'failed';

/**
 * Copies `text` to the clipboard. The button says "Copied" for 2 s (announced politely);
 * `onCopied` lets the page show a toast as well ("Invite link copied").
 */
export function CopyButton(props: {
  text: string;
  label?: string;
  variant?: ButtonVariant;
  onCopied?: () => void;
}) {
  const [state, setState] = useState<State>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), COPIED_MS);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.text);
      setState('copied');
      props.onCopied?.();
    } catch {
      setState('failed');
    }
  };

  const label = props.label ?? 'Copy';
  return (
    <>
      <Button
        variant={props.variant ?? 'secondary'}
        icon={state === 'copied' ? Check : Copy}
        onClick={() => void copy()}
      >
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not copy' : label}
      </Button>
      <span role="status" className="visually-hidden">
        {state === 'copied'
          ? 'Copied'
          : state === 'failed'
            ? 'Could not copy. Select the text and copy it.'
            : ''}
      </span>
    </>
  );
}
