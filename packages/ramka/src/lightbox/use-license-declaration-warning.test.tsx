import { render } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LightboxRoot } from './lightbox-root';

const LICENSE_WARNING =
  '[ramka] A license type is required.\n\n' +
  'Use license="gpl" if your use complies with GPL-3.0-only, or\n' +
  'license="commercial" if you purchased a commercial Ramka license.\n\n' +
  'https://ramka.dev/license';

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('license declaration (honor system)', () => {
  it('warns in development when license is omitted, without blocking render', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const { container } = render(
      <LightboxRoot>
        <span>gallery</span>
      </LightboxRoot>,
    );

    expect(container).toHaveTextContent('gallery');
    expect(warn).toHaveBeenCalledWith(LICENSE_WARNING);
  });

  it.each(['gpl', 'commercial'] as const)('stays quiet in development when license=%s', (license) => {
    vi.stubEnv('NODE_ENV', 'development');

    render(<LightboxRoot license={license}>ok</LightboxRoot>);

    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn in production when license is omitted', () => {
    vi.stubEnv('NODE_ENV', 'production');

    render(<LightboxRoot>ok</LightboxRoot>);

    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn under the test runner when license is omitted', () => {
    render(<LightboxRoot>ok</LightboxRoot>);

    expect(warn).not.toHaveBeenCalled();
  });
});
