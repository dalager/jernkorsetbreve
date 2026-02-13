# ADR-003: Testing Strategy

## Status
Proposed

## Context
The current E2E test suite (24 tests) covers critical workflows. The redesign must maintain this coverage while adding unit and integration tests.

## Decision

### Testing Pyramid

#### Unit Tests (Target: 80% coverage)
- Domain logic (DiffResolver, ArchiveNavigator)
- Utility functions (date formatting, text processing)
- React hooks (custom hooks for data fetching)

**Framework:** Vitest + React Testing Library

#### Integration Tests
- API service integration
- State management flows
- Component composition

**Framework:** Vitest + MSW (Mock Service Worker)

#### E2E Tests (Current: 24 tests)
- Critical user journeys
- Cross-browser compatibility
- Performance benchmarks

**Framework:** Playwright (existing)

### Test Data Strategy
- Mock API responses for unit/integration
- Real API for E2E (via Docker Compose)
- Fixture files for consistent test data

### Selector Strategy for Redesign
Replace Ant Design selectors with semantic HTML:

| Current | Proposed |
|---------|----------|
| `.ant-table-row` | `[data-testid="letter-row"]` |
| `.ant-card` | `[data-testid="letter-card"]` |
| `.ant-pagination` | `[data-testid="pagination"]` |
| `.ant-spin` | `[data-testid="loading"]` |

### Performance Testing
- Lighthouse CI integration
- Bundle size monitoring
- Load time assertions in E2E

### Coverage Requirements
- Maintain 24 E2E tests passing
- Add 50+ unit tests for domain logic
- Add 20+ integration tests for services

## Consequences

### Positive
- Confidence in refactoring
- Faster feedback with unit tests
- Documentation through tests

### Negative
- Test maintenance overhead
- Initial test writing time
- Mock synchronization with API
