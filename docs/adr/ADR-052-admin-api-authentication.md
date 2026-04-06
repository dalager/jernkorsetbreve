# ADR-052: Admin API Authentication

## Status

Accepted (2026-04-06)

## Date

2026-04-06

## Context

The admin API currently has no authentication. Any client that can reach the API can read, create, update, and delete registry data. CORS is not restricted.

For local development this is acceptable. For deployment — even on an internal network — this is a security risk. A single misconfigured firewall rule or leaked URL exposes the entire editorial dataset to modification.

The admin will be used by 1-3 domain experts (historians, family members). They are non-technical. The authentication mechanism must be simple to use and simple to operate.

## Decision

### Shared API Key (Phase 1)

Implement a shared API key passed via the `X-API-Key` header. The key is set via environment variable `ADMIN_API_KEY`.

**Backend changes** (`src/lib/auth.ts`):

Express middleware that checks the header on all mutating endpoints (PUT, POST, DELETE) and on export endpoints. GET endpoints for browsing data remain open (read-only access without key).

```typescript
// src/lib/auth.ts
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const configuredKey = process.env.ADMIN_API_KEY
  if (!configuredKey) return next() // No key configured = dev mode, allow all

  const providedKey = req.headers['x-api-key']
  if (providedKey !== configuredKey) {
    return res.status(401).json({ error: 'Invalid or missing API key' })
  }
  next()
}
```

Apply as middleware on write routes: `router.put('/persons/:id', requireApiKey, updatePerson)`.

**Frontend changes**:

Store the API key in `localStorage` after prompting the user once. Send it on every mutating request via the `X-API-Key` header in `lib/api.ts`. Show a simple "Log ind" (Log in) form if a write request returns 401.

**CORS changes**:

Restrict CORS origins in production via `CORS_ORIGIN` environment variable. Default remains `*` for local development.

### Why not OAuth/SSO/JWT?

For 1-3 users editing JSON files, OAuth adds significant complexity (provider setup, token refresh, session management) without proportional benefit. A shared API key provides:
- Protection against accidental public exposure
- Zero infrastructure dependencies (no identity provider)
- Simple key rotation (change env var, restart)

If the user base grows beyond ~5 people or individual accountability is needed, upgrade to a proper auth system in a future ADR.

## Alternatives Considered

### A. HTTP Basic Auth

Simple but credentials are sent base64-encoded (not encrypted) on every request. Requires HTTPS to be safe. API keys have the same risk but are more conventional for API authentication.

### B. OAuth2 / OIDC (Google, GitHub)

Proper individual identity. Excessive for 1-3 non-technical users who don't have GitHub accounts. Would require setting up an OAuth app, handling redirects, managing tokens.

### C. IP allowlisting

Restrict API access by source IP. Fragile (home IPs change), does not work behind NAT, and provides no protection if someone on the same network acts maliciously.

### D. No authentication (current state)

Acceptable for local development only. Unacceptable for any deployed instance.

## Consequences

### Positive
- Write operations are protected from unauthorized access
- Zero infrastructure overhead (just an environment variable)
- Development mode (no key set) works exactly as before
- Key can be shared with editors via secure channel (Signal, email)

### Negative
- Shared key = no individual audit trail (mitigated by ADR-051 change log)
- Key must be kept secret (leaked key = full write access)
- No key rotation mechanism beyond restart
- Read endpoints remain open (acceptable for this dataset — letters are public domain)

## Depends On
- ADR-054 (deployment architecture — where the env var is set)
