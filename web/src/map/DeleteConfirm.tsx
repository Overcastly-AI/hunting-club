// Deleting a stand or an area: a Delete button, then a confirm step that names what goes
// (Delete it, or Keep it). Errors are the caller's (saveError), shown with its other words.
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui';

export function DeleteConfirm(props: {
  /** "stand", "area": the button says Delete stand. */
  noun: string;
  /** Its name, in the question ("Delete Creek Stand?"). */
  name: string;
  onDelete: () => Promise<void>;
  /** Called with the failure; the step stays open to try again. */
  onError: (error: unknown) => void;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = `Delete ${props.noun}`;
  if (!confirming)
    return (
      <Button
        variant="danger"
        size="sm"
        icon={Trash2}
        onClick={() => setConfirming(true)}
        disabled={props.disabled}
      >
        {label}
      </Button>
    );
  const remove = async () => {
    setBusy(true);
    try {
      await props.onDelete();
    } catch (e) {
      props.onError(e);
      setBusy(false);
    }
  };
  return (
    <div className="draw__confirm" role="group" aria-label={label}>
      <p className="draw__problem">
        Delete {props.name.trim() || `this ${props.noun}`}? This cannot be undone.
      </p>
      <div className="draw__actions">
        <Button
          variant="danger-filled"
          size="sm"
          icon={Trash2}
          loading={busy}
          onClick={() => void remove()}
        >
          {label}
        </Button>
        <Button size="sm" onClick={() => setConfirming(false)} disabled={busy}>
          Keep it
        </Button>
      </div>
    </div>
  );
}
