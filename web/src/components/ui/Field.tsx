import { ChevronDown, CircleAlert } from 'lucide-react';
import {
  createContext,
  useContext,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cx } from './cx';
import { useFieldIds, type FieldControlProps } from './fieldIds';
import { ICON } from './sizes';

const FieldContext = createContext<FieldControlProps | null>(null);

/** The id and description of the enclosing Field's control (inputs read it). */
const useFieldControl = () => useContext(FieldContext) ?? {};

/**
 * A label (always visible, never a placeholder only), one control (Input, Select or
 * Textarea), a hint and an error with an icon. The control is wired up through context.
 */
export function Field(props: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { control, hintId, errorId } = useFieldIds(props.hint, props.error);
  return (
    <div className={cx('ui-field', props.className)}>
      <label htmlFor={control.id} className="ui-field__label">
        {props.label}
      </label>
      <FieldContext.Provider value={control}>{props.children}</FieldContext.Provider>
      {props.hint ? (
        <span id={hintId} className="ui-field__hint">
          {props.hint}
        </span>
      ) : null}
      {props.error ? (
        <span id={errorId} className="ui-field__error">
          <CircleAlert size={ICON.sm} aria-hidden />
          {props.error}
        </span>
      ) : null}
    </div>
  );
}

export function Input(
  props: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> },
) {
  const { className, ...input } = props;
  return <input {...useFieldControl()} {...input} className={cx('ui-input', className)} />;
}

export function Textarea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> },
) {
  const { className, ...textarea } = props;
  return <textarea {...useFieldControl()} {...textarea} className={cx('ui-textarea', className)} />;
}

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * The native <select>, drawn with the tokens. (Radix Select injects a <style> element, which
 * the CSP blocks; the native control also brings the platform's own picker on phones.)
 */
export function Select(
  props: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
    options: readonly SelectOption[];
    ref?: Ref<HTMLSelectElement>;
  },
) {
  const { className, options, ...select } = props;
  return (
    <span className="ui-select-wrap">
      <select {...useFieldControl()} {...select} className={cx('ui-select', className)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={ICON.md} aria-hidden />
    </span>
  );
}
