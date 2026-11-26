import { useId, type InputHTMLAttributes } from 'react';

/**
 * A labelled text input: the label is always visible, never a placeholder only. `error`
 * shows under the input and marks it invalid (aria-invalid, aria-describedby).
 */
export function Field(
  props: {
    label: string;
    hint?: string;
    error?: string | null;
  } & InputHTMLAttributes<HTMLInputElement>,
) {
  const { label, hint, error, ...input } = props;
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ');
  return (
    <div className="field">
      <label htmlFor={id} className="text-label">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...input}
      />
      {hint ? (
        <span id={hintId} className="muted">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
