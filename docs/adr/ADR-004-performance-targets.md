# ADR-004: Performance Targets

## Status
Proposed

## Context
Performance is critical for historical document viewing. Users expect quick navigation between letters.

## Decision

### Core Web Vitals Targets
| Metric | Target | Current (Estimated) |
|--------|--------|---------------------|
| LCP | < 2.5s | ~3s (Ant Design overhead) |
| FID | < 100ms | ~150ms |
| CLS | < 0.1 | ~0.2 (table layout shifts) |
| TTFB | < 200ms | ~150ms |

### Bundle Size Targets
| Metric | Target | Current |
|--------|--------|---------|
| Initial JS | < 150KB gzipped | ~280KB (Ant Design) |
| Initial CSS | < 30KB gzipped | ~80KB (Ant Design CSS) |
| Total initial | < 200KB gzipped | ~400KB |

### Load Time Targets
| Page | Target | Current E2E Threshold |
|------|--------|----------------------|
| Letter List | < 2s | 10s |
| Letter Detail | < 1s | 5s |
| Navigation (Next/Prev) | < 500ms | N/A |
| Modernization API | < 3s | N/A |

### Optimization Strategies

#### Code Splitting
- Route-based splitting (already via React Router)
- Lazy load modernization components
- Dynamic import for diff library

#### Asset Optimization
- Font subsetting (Latin + Danish characters)
- Preload critical fonts
- Image optimization (if any added)

#### Caching
- API response caching (letters don't change)
- Service worker for offline reading
- Font caching

#### Rendering
- Virtualized list for 665 letters
- Skeleton loading states
- Optimistic navigation

### Monitoring
- Lighthouse CI in GitHub Actions
- Bundle analyzer in build
- Performance E2E assertions

## Consequences

### Positive
- 50% bundle size reduction
- Faster initial load
- Better mobile experience

### Negative
- Additional build complexity
- Font loading considerations
- Caching invalidation complexity

## Validation
- All 24 E2E tests must pass performance assertions
- Lighthouse scores > 90 for Performance
