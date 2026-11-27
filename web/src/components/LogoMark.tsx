import { logoMarkSvg } from '@huntclub/design';

/** The logo mark as an image source (a data: URL, which the CSP's img-src allows). */
const LOGO_SRC = `data:image/svg+xml,${encodeURIComponent(logoMarkSvg())}`;

/** The logo mark. Decorative: the app name is always written beside it. */
export function LogoMark(props: { size: number; className?: string }) {
  return (
    <img className={props.className} src={LOGO_SRC} alt="" width={props.size} height={props.size} />
  );
}
