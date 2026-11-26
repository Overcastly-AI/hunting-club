import { useId, type InputHTMLAttributes } from 'react';

/** A labelled text input: the label is always visible, never a placeholder only. */
export function Field(
  props: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>,
) {
  const { label, hint, ...input } = props;
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="field">
      <label htmlFor={id} className="text-label">
        {label}
      </label>
      <input id={id} aria-describedby={hint ? hintId : undefined} {...input} />
      {hint ? (
        <span id={hintId} className="muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
