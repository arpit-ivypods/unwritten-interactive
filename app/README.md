# Unwritten app

The viewer app for the Unwritten POC: Next.js 16, React 19, TypeScript, Tailwind v4, Zustand, GSAP. Local only; all viewer state is in the browser's localStorage and nothing is sent anywhere.

```bash
pnpm install
pnpm exec playwright install chromium   # once: for the end-to-end tests and for placeholder cards
pnpm dev                                # http://localhost:3210
```

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on port 3210 |
| `pnpm build` / `pnpm start` | Production build, served on port 3210 |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | ESLint, TypeScript, unit tests |
| `pnpm test:e2e` / `pnpm test:e2e:prod` | Playwright against the dev server / against a fresh production build on port 3211 |
| `pnpm placeholders` | Regenerate placeholder media and manifests under `public/media` (needs ffmpeg) |
| `pnpm content:check` | Check `public/media` against the content contract |

Episode videos (`public/media/**/*.mp4`) are not in git. After a fresh checkout run `pnpm placeholders`.

Everything an engineer needs to know (routes, file ownership, the content manifest, the state model and product rules) is in [`../docs/contracts.md`](../docs/contracts.md). This is Next.js 16: read `AGENTS.md` before writing code.
