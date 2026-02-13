# ADR-002: Domain-Driven Design Architecture

## Status
Proposed

## Context
The frontend needs clear boundaries between concerns to support maintainability and testing. Current code mixes data fetching, presentation, and business logic.

## Decision

### Bounded Contexts

#### 1. LetterArchive (Core Domain)
Primary domain for letter browsing and display.

**Entities:**
- `Letter` - Core entity with id, date, place, sender, recipient, text
- `Correspondent` - Person entity (sender/recipient)
- `Place` - Location entity
- `DateRange` - Temporal filtering

**Value Objects:**
- `LetterMetadata` - Date, place, correspondent summary
- `LetterContent` - Full text with formatting

**Services:**
- `LetterRepository` - Data access abstraction
- `ArchiveNavigator` - Pagination and navigation state

#### 2. TextModernization (Supporting Domain)
AI-powered text modernization workflow.

**Entities:**
- `ModernizationRequest` - Request state and metadata
- `DiffResult` - Computed differences
- `AcceptedChanges` - User decisions on changes

**Services:**
- `ModernizationService` - API interaction
- `DiffResolver` - Change acceptance logic

#### 3. Search (Generic Domain)
Full-text and metadata search.

**Entities:**
- `SearchQuery` - Query parameters
- `SearchResult` - Result set with relevance
- `Filter` - Faceted filtering

### Shared Kernel
- Date formatting utilities (Danish locale)
- Letter type definitions
- API response types
- Error handling patterns

### Directory Structure
```
src/
  domains/
    letter-archive/
      entities/
      services/
      hooks/
      components/
    text-modernization/
      entities/
      services/
      hooks/
      components/
    search/
      entities/
      services/
      hooks/
      components/
  shared/
    types/
    utils/
    hooks/
```

## Consequences

### Positive
- Clear separation of concerns
- Testable domain logic
- Easier to reason about features
- Supports team parallelization

### Negative
- More files and directories
- Potential for over-engineering simple features
- Learning curve for DDD patterns

## Testing Strategy
- Unit tests for domain services
- Integration tests for API interactions
- E2E tests for user workflows
