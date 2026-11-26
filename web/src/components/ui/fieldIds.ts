import { useId, type ReactNode } from 'react';

/** What a control needs from its Field: its id and how it is described. */
export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
}

/**
 * Ids for a labelled control with an optional hint and error: the control is described by
 * whichever of them show, and is invalid while there is an error.
 */
export function useFieldIds(hint?: ReactNode, error?: ReactNode) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ');
  const control: FieldControlProps = {
    id,
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    ...(error ? { 'aria-invalid': true } : {}),
  };
  return { control, hintId, errorId };
}
