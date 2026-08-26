// The tarball is packed from this directory, so the LICENSE at the repo root
// never reaches it — and a GPL artifact that conveys no license text is a
// compliance gap, not a cosmetic one. Copy it in at build time rather than
// committing a second copy that can drift out of sync with the real one.

import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(packageDir, '..', '..', 'LICENSE');
const destination = join(packageDir, 'LICENSE');

copyFileSync(source, destination);
console.log('copy-license: LICENSE -> packages/ramka/LICENSE');
