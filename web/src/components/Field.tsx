import type { InputHTMLAttributes } from 'react';
import { useFieldIds } from './ui/fieldIds';

/**
 * A labelled text input: the label is always visible, never a placeholder only. `error`
 * shows under the input and marks it invalid (aria-invalid, aria-describedby).
 * The current pages' look; the redesign's Field is ./ui/Field (pages move to it in P3).
 */
export function Field(
  props: {
    label: string;
    hint?: string;
    error?: string | null;
  } & InputHTMLAttributes<HTMLInputElement>,
) {
  const { label, hint, error, ...input } = props;
  const { control, hintId, errorId } = useFieldIds(hint, error);
  return (
    <div className="field">
      <label htmlFor={control.id} className="text-label">
        {label}
      </label>
      <input {...control} {...input} />
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
