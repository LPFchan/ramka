// Writes a CycloneDX SBOM describing the published package.
//
// Usage:
//   node scripts/generate-sbom.mjs [--out <path>]   # write it
//   node scripts/generate-sbom.mjs --check          # build and validate only
//
// Enterprise intake asks for a software bill of materials, and every
// off-the-shelf generator answers by reading a lockfile — which for this package
// produces a document that says "no dependencies" and stops there. That is true,
// and also the least interesting part: what a reviewer needs to know is that
// `src/render/` carries code adapted from Base UI, which no lockfile records,
// because it was vendored precisely so it would not be a dependency.
//
// So the SBOM is written here instead: the shipped component, an explicitly
// empty dependency list, and the vendored ancestry spelled out.
//
// The artifact digest is deliberately absent. npm provenance already binds a
// published version to the tarball and the workflow run that built it, and a
// hash inside this file would have to cover the file itself.
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = join(repoRoot, 'packages', 'ramka');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const checkOnly = args.includes('--check');
const outPath = resolvePath(process.cwd(), flag('out') ?? join(packageDir, 'sbom.cdx.json'));

const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));

/** `@ramka/react` → `pkg:npm/%40ramka/react@1.2.3`; purl escapes the scope's `@`. */
function purlFor(name, version) {
  const encoded = name.startsWith('@') ? `%40${name.slice(1)}` : name;
  return `pkg:npm/${encoded}@${version}`;
}

/**
 * npm's `license` field holds either an SPDX expression or one of two sentinels:
 * `UNLICENSED`, or `SEE LICENSE IN <file>`. Only an expression belongs in
 * CycloneDX's `expression` slot; the sentinels go through as free text. An
 * undeclared license is left out rather than guessed at — a scanner reading
 * "MIT" off a document that inferred it is worse than one reading nothing.
 */
function licensesFor(declared) {
  if (!declared) return undefined;
  if (declared === 'UNLICENSED' || declared.startsWith('SEE LICENSE IN')) {
    return [{ license: { name: declared } }];
  }
  return [{ expression: declared }];
}

// Vendored instead of depended on — see THIRD-PARTY-NOTICES.md. Pinned to the
// versions the code was adapted from, so a reviewer can diff against them, and
// carrying the license the code arrived under, which is a fact about Base UI and
// independent of whatever this package is licensed as.
const VENDORED = [
  {
    name: '@base-ui/react',
    version: '1.5.0',
    license: 'MIT',
    paths: ['src/render/merge-props.ts', 'src/render/use-render.ts'],
    changes:
      'Props getters, preventBaseUIHandler() and React.lazy unwrapping were ' +
      'left out; the default element for a button part is <button>.',
  },
  {
    name: '@base-ui/utils',
    version: '0.2.9',
    license: 'MIT',
    paths: ['src/render/use-merged-refs.ts'],
    changes: 'Narrowed to the three-ref case this package uses.',
  },
];

const selfRef = purlFor(pkg.name, pkg.version);

const vendoredComponents = VENDORED.map(({ name, version, license, paths, changes }) => ({
  'bom-ref': purlFor(name, version),
  type: 'library',
  name,
  version,
  purl: purlFor(name, version),
  scope: 'required',
  licenses: licensesFor(license),
  description:
    'Adapted source, not an installed dependency: the files in ' +
    'ramka:vendoredPaths were copied from this package and modified.',
  pedigree: {
    notes: `Adapted from ${name}@${version} under its ${license} license. ${changes} See THIRD-PARTY-NOTICES.md.`,
  },
  properties: [{ name: 'ramka:vendoredPaths', value: paths.join(' ') }],
  externalReferences: [
    { type: 'distribution', url: `https://www.npmjs.com/package/${name}` },
    { type: 'vcs', url: 'https://github.com/mui/base-ui' },
  ],
}));

const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.6',
  serialNumber: `urn:uuid:${randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: {
      components: [{ type: 'application', name: 'ramka generate-sbom' }],
    },
    component: {
      'bom-ref': selfRef,
      type: 'library',
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      purl: selfRef,
      licenses: licensesFor(pkg.license),
      externalReferences: [
        { type: 'vcs', url: 'https://github.com/arturbien/ramka' },
        { type: 'distribution', url: `https://www.npmjs.com/package/${pkg.name}` },
      ],
    },
    // Peers are needed at runtime but supplied by the consumer, and a range has
    // no one resolved version to name, so they are stated as facts about the
    // component rather than invented as components of it.
    properties: Object.entries(pkg.peerDependencies ?? {}).map(([name, range]) => ({
      name: 'ramka:peerDependency',
      value: `${name}@${range}`,
    })),
  },
  components: vendoredComponents,
  dependencies: [
    // The whole point of the document: nothing is installed alongside this.
    { ref: selfRef, dependsOn: vendoredComponents.map((component) => component['bom-ref']) },
    ...vendoredComponents.map((component) => ({ ref: component['bom-ref'], dependsOn: [] })),
  ],
};

const problems = validate(bom);
if (problems.length > 0) {
  console.error('generate-sbom.mjs: the generated SBOM is not valid CycloneDX:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

if (checkOnly) {
  console.log(
    `generate-sbom.mjs: ok — ${bom.components.length + 1} components for ` +
      `${pkg.name}@${pkg.version}, ${bom.dependencies[0].dependsOn.length} vendored, ` +
      '0 installed',
  );
} else {
  // A document naming version 0.0.0 identifies nothing, and would be indexed
  // under that version by whatever consumes it. The release workflow sets the
  // real version before generating; locally, `--check` validates without it.
  if (pkg.version === '0.0.0') {
    console.error(
      'generate-sbom.mjs: refusing to write an SBOM for version 0.0.0.\n' +
        '  Releases set the version from the tag; use --check to validate the document here.',
    );
    process.exit(1);
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(bom, null, 2)}\n`);
  console.log(`generate-sbom.mjs: wrote ${outPath}`);
}

/**
 * A malformed SBOM is worse than no SBOM: it clears a checklist now and fails
 * the scanner that consumes it months later, in someone else's pipeline. The
 * fields a scanner keys off are cheap to check, so check them before release.
 */
function validate(doc) {
  const problems = [];
  if (doc.bomFormat !== 'CycloneDX') problems.push('bomFormat must be "CycloneDX"');
  if (!/^\d+\.\d+$/.test(doc.specVersion)) problems.push('specVersion must be "major.minor"');
  if (!/^urn:uuid:[0-9a-f-]{36}$/.test(doc.serialNumber)) {
    problems.push(`serialNumber is not a urn:uuid: ${doc.serialNumber}`);
  }

  const refs = new Set();
  const check = (component, where, { requireLicense = true } = {}) => {
    for (const field of ['type', 'name', 'version', 'purl']) {
      if (!component[field]) problems.push(`${where} is missing ${field}`);
    }
    // Third-party code has to name the terms it arrived under, or the document
    // fails at the one job a license scanner has. This package's own terms come
    // from its `license` field, which may legitimately not be settled yet.
    if (requireLicense && !component.licenses?.length) problems.push(`${where} has no license`);
    const ref = component['bom-ref'];
    if (!ref) problems.push(`${where} is missing bom-ref`);
    else if (refs.has(ref)) problems.push(`duplicate bom-ref: ${ref}`);
    else refs.add(ref);
  };

  check(doc.metadata.component, 'metadata.component', { requireLicense: false });
  doc.components.forEach((component, i) => check(component, `components[${i}]`));

  // A graph pointing at refs the document doesn't define is the one way this
  // file can look complete and mean nothing.
  for (const entry of doc.dependencies) {
    for (const ref of [entry.ref, ...entry.dependsOn]) {
      if (!refs.has(ref)) problems.push(`dependencies reference unknown bom-ref: ${ref}`);
    }
  }
  for (const ref of refs) {
    if (!doc.dependencies.some((entry) => entry.ref === ref)) {
      problems.push(`component has no dependencies entry: ${ref}`);
    }
  }
  return problems;
}
