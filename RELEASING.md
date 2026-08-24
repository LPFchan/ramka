# Releasing `@ramka/react`

Releases happen in GitHub Actions and nowhere else. `publishConfig.provenance`
makes `npm publish` fail outside a supported CI provider, so a laptop cannot ship
a version even by accident.

## Cutting a release

1. Bump `version` in `packages/ramka/package.json` and land it on `main`.
2. Tag that commit and push the tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

[`release.yml`](.github/workflows/release.yml) then verifies the tag agrees with
the manifest and points at a commit on `main`, runs typecheck and tests on the
same Node version CI uses, builds, generates the SBOM, publishes, checks that the
registry recorded a provenance attestation, and creates the GitHub release with
the SBOM attached.

Running the workflow manually from the Actions tab is a rehearsal: it does
everything except publish, ending at `npm pack --dry-run` so you can see what
the tarball would contain.

## One-time setup on npmjs.com

Authentication is [npm trusted publishing][trusted-publishing] over OIDC, so
there is no `NPM_TOKEN` in this repository to rotate or leak. It has to be
configured once per package, under Settings → Trusted publishers:

| Field             | Value           |
| ----------------- | --------------- |
| Publisher         | GitHub Actions  |
| Organization/user | `arturbien`     |
| Repository        | `ramka`         |
| Workflow filename | `release.yml`   |
| Environment       | _(leave empty)_ |

The workflow filename is part of the trust relationship: renaming
`release.yml` breaks publishing until the publisher config is updated to match.

Nothing else is needed — the `id-token: write` permission on the publish job is
already in the workflow, and provenance is attached automatically when publishing
this way, which is why the workflow passes no `--provenance` flag.

For a stricter setup, point the trusted publisher at a GitHub environment with
required reviewers and add `environment:` to the publish job. Then a release also
needs a human approval before it can reach the registry.

## What a consumer can verify

Every published version carries a signed provenance attestation linking the
tarball to the commit and workflow run that produced it:

```bash
npm view @ramka/react dist.attestations   # the attestation exists
npm audit signatures                      # verify it in your own install
```

The package page on npm shows the same thing as a "Built and signed on GitHub
Actions" badge, with a link to the run.

One caveat for later: attestations require both the repository and the package to
be public. If this ever ships as a private or paid package, trusted publishing
still authenticates the release, but npm records no attestation — and the
verification step in the workflow will start failing and has to come out.

## SBOM

`scripts/generate-sbom.mjs` writes a [CycloneDX][cyclonedx] 1.6 document
describing the published package: zero installed dependencies, the peer
dependencies it expects the host app to provide, and the Base UI code vendored
into `src/render/` — which no lockfile-reading generator can see, because it was
vendored specifically so it would not be a dependency.

The file ships inside the npm tarball as `sbom.cdx.json` and is attached to the
GitHub release. It is generated, never committed: it names the version being
published, so a checked-in copy could only ever be stale.

```bash
pnpm sbom:check   # build the document and validate it (what CI runs)
pnpm sbom         # write packages/ramka/sbom.cdx.json (needs a real version)
```

The script validates the parts a scanner keys off — spec version, serial number,
purls, third-party licenses, and a dependency graph whose refs all resolve. The
package's own license is whatever `package.json` declares, so the document
follows that decision rather than asserting one. To check the output against the
official schema instead:

```bash
schema=https://raw.githubusercontent.com/CycloneDX/specification/master/schema
for f in bom-1.6.schema.json spdx.schema.json jsf-0.82.schema.json; do
  curl -sSfLO "$schema/$f"
done
npm install --no-save ajv-cli ajv-formats
npx ajv-cli validate --spec=draft7 --strict=false -c ajv-formats \
  -s bom-1.6.schema.json -r spdx.schema.json -r jsf-0.82.schema.json \
  -d packages/ramka/sbom.cdx.json
```

## Dependency updates

[`dependabot.yml`](.github/dependabot.yml) opens weekly PRs for tooling and
GitHub Actions. React and its types are grouped so they always move together;
everything else lands as one PR for minor and patch bumps, with majors separate.

Version updates wait out a cooldown — 7 days, 30 for majors — because the shape
of most npm supply-chain attacks is a release published minutes ago from a
hijacked account. Dependabot _security_ updates ignore the cooldown, so real
vulnerability fixes still arrive immediately.

Actions in `release.yml` are pinned to commit SHAs rather than tags: that job can
publish, so a moved tag on a third-party action would be a way to publish through
it. Dependabot updates the pins and rewrites the version comment beside them.

[trusted-publishing]: https://docs.npmjs.com/trusted-publishers/
[cyclonedx]: https://cyclonedx.org/
