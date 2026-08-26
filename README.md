# ramka

An unstyled, accessible image gallery primitive library for React — in the style of Radix UI and Base UI.

> _ramka_ (РАмка) is Polish for "frame".

This repository is a pnpm + Turborepo monorepo containing:

- **[`packages/ramka`](./packages/ramka)** — the publishable component library.
- **[`apps/docs`](./apps/docs)** — the Next.js documentation site, styled with Tailwind CSS.

## Prerequisites

- Node.js >= 18 (this repo is developed against Node 22 — see [`.nvmrc`](./.nvmrc)).
- [pnpm](https://pnpm.io) 9.

## Getting started

```bash
pnpm install
pnpm dev
```

`pnpm dev` runs the library in watch mode and the docs site (`http://localhost:3000`) in parallel via Turborepo.

## Scripts

| Command          | Description                                                  |
| ---------------- | ------------------------------------------------------------ |
| `pnpm dev`       | Run the library watcher and the docs site in parallel.       |
| `pnpm build`     | Build the library, then the docs site.                       |
| `pnpm lint`      | Lint every workspace.                                        |
| `pnpm typecheck` | Type-check every workspace.                                  |
| `pnpm format`    | Format the repo with Prettier.                               |
| `pnpm clean`     | Remove build artifacts and `node_modules`.                   |

## Workspace layout

```
.
├── apps/
│   └── docs/      # Next.js 15 + Tailwind v4 docs site
└── packages/
    └── ramka/     # The publishable primitive library
```

## License

Dual-licensed: [GPL-3.0-only](./LICENSE), or a commercial license for a
proprietary project whose source you do not want to make available under the
GPL. The header of [LICENSE](./LICENSE) explains which applies to you.
