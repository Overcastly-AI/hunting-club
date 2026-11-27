// An area's own fields while its shape is drawn (PropertyLineEditor with DRAW_SUBJECTS.area): its
// name, checked by the shared area schema's name rule, and for a saved area, Delete area.
import { AreaCreateSchema } from '@huntclub/shared';
import { Field, Input } from '../components/ui';
import { DeleteConfirm } from './DeleteConfirm';

/** What the draw tool says when the area has no usable name. */
export const AREA_NAME_PROBLEM = 'Enter the area name, up to 60 characters.';

/** The area's name as the shared schema reads it, or what to fix. */
export function checkAreaName(name: string): string | null {
  return AreaCreateSchema.shape.name.safeParse(name).success ? null : AREA_NAME_PROBLEM;
}

export function AreaFields(props: {
  name: string;
  onName: (name: string) => void;
  /** A saved area: it can be deleted, after a confirm step. */
  onDelete?: (() => Promise<void>) | undefined;
  onDeleteError: (error: unknown) => void;
  /** Why the delete failed (saveError). */
  error?: string | null;
}) {
  return (
    <>
      <Field label="Area name">
        <Input maxLength={60} value={props.name} onChange={(e) => props.onName(e.target.value)} />
      </Field>
      {props.onDelete ? (
        <DeleteConfirm
          noun="area"
          name={props.name}
          onDelete={props.onDelete}
          onError={props.onDeleteError}
        />
      ) : null}
      {props.error ? (
        <p className="draw__error" role="alert">
          {props.error}
        </p>
      ) : null}
    </>
  );
}
