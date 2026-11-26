import type { ReactNode } from 'react';
import { TONE_ICONS, type Tone } from './Badge';
import { ICON } from './sizes';

export type BannerTone = Exclude<Tone, 'neutral'>;

/**
 * An inline message in a page or card: icon, optional title, text and one action. All text
 * is in the tone's colour on its tint (pairs held by the contrast test). `live` announces
 * it when it appears (alert for danger, status otherwise).
 */
export function Banner(props: {
  tone: BannerTone;
  title?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  live?: boolean;
}) {
  const Icon = TONE_ICONS[props.tone];
  const role = props.live ? (props.tone === 'danger' ? 'alert' : 'status') : undefined;
  return (
    <div className={`ui-banner ui-banner--${props.tone}`} role={role}>
      <Icon className="ui-banner__icon" size={ICON.md} aria-hidden />
      <div className="ui-banner__body">
        {props.title ? <p className="ui-banner__title">{props.title}</p> : null}
        <p className="ui-banner__text">{props.children}</p>
      </div>
      {props.action ? <div className="ui-banner__action">{props.action}</div> : null}
    </div>
  );
}
