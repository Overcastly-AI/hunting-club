import { qrSvg } from '@huntclub/shared';
import { useMemo } from 'react';

/**
 * A QR code from the shared renderer (`qrSvg` in @huntclub/shared, which also draws the
 * public site's /join QR, from the same encoder the app uses): dark modules on a light
 * background with the quiet zone phone cameras need.
 */
export function QrCode(props: { value: string; label: string; size?: number }) {
  const { value, label, size } = props;
  const svg = useMemo(
    () => qrSvg(value, { label, ...(size ? { size } : {}) }),
    [value, label, size],
  );
  return <span className="qr" dangerouslySetInnerHTML={{ __html: svg }} />;
}
