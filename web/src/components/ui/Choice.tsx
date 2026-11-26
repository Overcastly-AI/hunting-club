import { Check, type LucideIcon } from 'lucide-react';
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from './cx';
import { ICON } from './sizes';

type NativeCheckbox = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'>;

/** A native checkbox with its label (and optional hint): the whole row toggles it. */
export function Checkbox(props: NativeCheckbox & { label: ReactNode; hint?: ReactNode }) {
  const { label, hint, className, ...input } = props;
  const hintId = useId();
  return (
    <label className={cx('ui-check', className)}>
      <span className="ui-check__box">
        <input
          {...input}
          type="checkbox"
          className="ui-check__input"
          aria-describedby={hint ? hintId : undefined}
        />
        <Check className="ui-check__icon" size={ICON.md} strokeWidth={3} aria-hidden />
      </span>
      <span className="ui-check__text">
        <span className="ui-check__label">{label}</span>
        {hint ? (
          <span id={hintId} className="ui-check__hint">
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}

/** An on/off setting that applies at once: a native checkbox with role="switch". */
export function Switch(props: NativeCheckbox & { label: ReactNode }) {
  const { label, className, ...input } = props;
  return (
    <label className={cx('ui-switch', className)}>
      <input {...input} type="checkbox" role="switch" className="ui-switch__input" />
      <span className="ui-switch__track" aria-hidden="true">
        <span className="ui-switch__thumb" />
      </span>
      <span className="ui-switch__label">{label}</span>
    </label>
  );
}

export interface ChoiceOption<V extends string> {
  value: V;
  label: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  /** Segmented only: a thumbnail above the label (Topo / Aerial). */
  preview?: ReactNode;
  disabled?: boolean;
}

interface ChoiceGroupProps<V extends string> {
  legend: ReactNode;
  /** Hide the legend visually (it is still the group's name for screen readers). */
  hideLegend?: boolean;
  options: readonly ChoiceOption<V>[];
  value: V;
  onChange: (value: V) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * One choice from a few, as native radios in a fieldset: arrow keys move the choice, Tab
 * leaves the group. `card` stacks bordered rows (with hints); `segmented` is a compact
 * row (Topo / Aerial, Monthly / Yearly) whose selected item is the accent fill.
 */
function ChoiceGroup<V extends string>(
  props: ChoiceGroupProps<V> & { appearance: 'card' | 'segmented'; block?: boolean },
) {
  const name = useId();
  const segmented = props.appearance === 'segmented';
  return (
    <fieldset className={cx('ui-choice-group', props.className)} disabled={props.disabled}>
      <legend className={cx('ui-choice-group__legend', props.hideLegend && 'visually-hidden')}>
        {props.legend}
      </legend>
      <div
        className={
          segmented ? cx('ui-segmented', props.block && 'ui-segmented--block') : 'ui-radio-list'
        }
      >
        {props.options.map((o) => {
          const radio = (
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={props.value === o.value}
              disabled={o.disabled}
              onChange={() => props.onChange(o.value)}
              className={segmented ? 'ui-segment__input' : 'ui-radio__input'}
            />
          );
          const Icon = o.icon;
          return segmented ? (
            <label key={o.value} className="ui-segment">
              {radio}
              {o.preview ? <span className="ui-segment__preview">{o.preview}</span> : null}
              <span className="ui-segment__row">
                {Icon ? <Icon size={ICON.md} aria-hidden /> : null}
                {o.label}
              </span>
            </label>
          ) : (
            <label key={o.value} className="ui-radio ui-radio--card">
              {radio}
              <span className="ui-radio__text">
                <span className="ui-radio__label">{o.label}</span>
                {o.hint ? <span className="ui-radio__hint">{o.hint}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function RadioGroup<V extends string>(props: ChoiceGroupProps<V>) {
  return <ChoiceGroup {...props} appearance="card" />;
}

export function Segmented<V extends string>(props: ChoiceGroupProps<V> & { block?: boolean }) {
  return <ChoiceGroup {...props} appearance="segmented" />;
}
