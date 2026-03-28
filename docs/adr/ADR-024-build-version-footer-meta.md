# ADR-024: Build Version in Footer and HTML Meta Tags

## Status

Accepted

## Date

2026-03-28

## Context

When debugging deployed versions of the website, there is no way to determine which git commit or build date is currently live. This makes it difficult to verify that a deployment succeeded or to correlate reported issues with specific code versions.

The project uses a Next.js 16 static export site (`apps/website/`) served in Docker via `node:22-alpine`. The existing `Footer.tsx` component already has a credits section. The `docker-compose.yml` already passes build args to the website service.

## Decision

1. **Inject `NEXT_PUBLIC_GIT_SHA` and `NEXT_PUBLIC_BUILD_DATE` at build time** via `next.config.ts` using `execSync("git rev-parse --short HEAD")` with fallback to environment variables. This supports both local development (reads git directly) and Docker builds (receives values as build args, since `node:22-alpine` lacks git).

2. **Display the build version in the footer** as a subtle line below the existing credits: `Build 2026-03-28 · a3f8c2d`, styled with `text-[10px] text-faded/50` to be unobtrusive.

3. **Add HTML `<meta>` tags** (`build-version`, `build-date`) in `layout.tsx` for machine-readable version identification. This enables monitoring scripts, health checks, and DevTools inspection without parsing visible text.

4. **Pass build args through Docker** by adding `ARG`/`ENV` lines in the Dockerfile and corresponding args in `docker-compose.yml`.

5. **Update the Makefile** `build` target to inject git SHA and date automatically.

## Consequences

### Positive

- Deployed version is immediately identifiable from the browser (footer or View Source)
- Meta tags enable automated monitoring and deployment verification
- Zero risk to existing functionality — purely additive changes
- Graceful degradation: shows "dev" when build info unavailable

### Negative

- Git SHA is visible in page source (acceptable for a public/open-source project)
- Values are baked in at build time and reflect the build moment, not deploy moment

## Files Changed

- `apps/website/next.config.ts` — env block with git SHA and build date
- `apps/website/src/components/Footer.tsx` — version display line
- `apps/website/src/app/layout.tsx` — meta tags
- `apps/website/Dockerfile` — ARG/ENV for build vars
- `docker-compose.yml` — build args for website service
- `Makefile` — build target with git info injection
