# react-image-gallery

An unstyled, accessible image gallery primitive library for React — in the style of Radix UI and Base UI.

This repository is a pnpm + Turborepo monorepo containing:

- **[`packages/react-image-gallery`](./packages/react-image-gallery)** — the publishable component library.
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
│   └── docs/                   # Next.js 15 + Tailwind v4 docs site
└── packages/
    └── react-image-gallery/    # The publishable primitive library
```

## License

MIT
