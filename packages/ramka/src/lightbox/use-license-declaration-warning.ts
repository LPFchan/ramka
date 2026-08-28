'use client';

import * as React from 'react';

import type { LicenseType } from './lightbox-license';

const LICENSE_WARNING =
  '[ramka] A license type is required.\n\n' +
  'Use license="gpl" if your use complies with GPL-3.0-only, or\n' +
  'license="commercial" if you purchased a commercial Ramka license.\n\n' +
  'https://ramka.dev/license';

/**
 * Warn in development when `Lightbox.Root` is mounted without a license
 * declaration. Honor system only: the value is never sent anywhere, and
 * omitting it does not change runtime behavior.
 */
function useLicenseDeclarationWarning(license: LicenseType | undefined): void {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (license === 'gpl' || license === 'commercial') return;
    // eslint-disable-next-line no-console
    console.warn(LICENSE_WARNING);
  }, [license]);
}

export { useLicenseDeclarationWarning };
