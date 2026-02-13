# Jernkorsetbreve Frontend Redesign - Implementation Plan

## Overview

This plan outlines the redesign of the Jernkorsetbreve web application frontend from generic Ant Design components to a distinctive Archival Editorial design system using Tailwind CSS 4.0 and shadcn/ui.

## Current State Analysis

| Component | Status | Issues |
|-----------|--------|--------|
| LetterList.tsx | 70 lines | Generic Ant Table, no visual identity |
| LetterView.tsx | 157 lines | Inline styles, basic Card layout |
| MarkdownDiffResolver.tsx | 260 lines | Functional but cluttered UI |
| App.tsx | 17 lines | Minimal routing setup |

**Dependencies:**
- React 19.0.0 (keep)
- Ant Design 5.23.4 (remove)
- React Router 7.1.5 (upgrade to 7.2.0)
- Vite 6.1.0 (upgrade to 6.2.0)

**Test Coverage:** 24 E2E tests (must maintain)

## Design Direction

**Aesthetic:** Archival Editorial - refined minimalism with historical gravitas

**Key Principles:**
1. Letters feel like handling original documents
2. Typography is the star - readable historical text
3. Standard patterns for both humans and AI agents
4. Functional simplicity - letter reading is primary

## Phase Breakdown

### Phase 1: Foundation Setup
**Goal:** Migrate from Ant Design to Tailwind + shadcn/ui

**Tasks:**
- [ ] Install Tailwind CSS 4.0 and configure
- [ ] Set up shadcn/ui with custom theme
- [ ] Configure typography system (fonts)
- [ ] Create CSS custom properties for colors
- [ ] Set up Motion library for animations

**Validation:** Build succeeds, no visual regressions (manual)

### Phase 2: Design System Components
**Goal:** Create reusable UI primitives

**Tasks:**
- [ ] Button variants (primary, secondary, ghost)
- [ ] Card component (letter card styling)
- [ ] Table/List components with virtualization
- [ ] Typography components (LetterText, Metadata)
- [ ] Navigation components (Pagination, BackButton)
- [ ] Loading states (Skeleton, Spinner)

**Validation:** Component tests pass, visual review

### Phase 3: LetterList Redesign
**Goal:** Replace Ant Table with custom archive list

**Tasks:**
- [ ] Create LetterList component with virtualization
- [ ] Implement letter row with metadata display
- [ ] Add pagination with page size control
- [ ] Implement responsive layout (cards on mobile)
- [ ] Add skeleton loading state

**Validation:** E2E tests for Letter List pass (5 tests)

### Phase 4: LetterView Redesign
**Goal:** Create immersive letter reading experience

**Tasks:**
- [ ] Create LetterCard component with archival styling
- [ ] Implement navigation buttons (Prev/Next)
- [ ] Add correspondent badges (From/To)
- [ ] Create text display with paragraph handling
- [ ] Add modernization trigger button
- [ ] Display performance metrics

**Validation:** E2E tests for Letter Detail pass (10 tests)

### Phase 5: DiffResolver Redesign
**Goal:** Cleaner diff visualization

**Tasks:**
- [ ] Create DiffViewer component
- [ ] Implement ChangeAcceptor for individual changes
- [ ] Add bulk actions (Accept All, Reject All, Reset)
- [ ] Side-by-side or inline view toggle
- [ ] Improve change indicators

**Validation:** Modernization E2E tests pass (2 tests)

### Phase 6: Polish & Performance
**Goal:** Meet performance targets

**Tasks:**
- [ ] Font optimization and subsetting
- [ ] Code splitting validation
- [ ] Bundle size analysis
- [ ] Lighthouse audit and fixes
- [ ] Accessibility audit (WCAG 2.1 AA)

**Validation:**
- All 24 E2E tests pass
- Bundle < 200KB gzipped
- Lighthouse Performance > 90

## Agent Assignments (Claude-Flow Swarm)

### Swarm Configuration
```yaml
topology: hierarchical-mesh
maxAgents: 15
strategy: specialized
consensus: raft
```

### Agent Roster

| Agent | Type | Model | Phase | Responsibilities |
|-------|------|-------|-------|------------------|
| **Queen** | hierarchical-coordinator | sonnet | All | Orchestration, decision making |
| **Architect** | system-architect | sonnet | 1-2 | Design system, component API |
| **Stylist** | coder | sonnet | 1-2 | Tailwind config, CSS variables |
| **Component-Dev-1** | coder | sonnet | 2-3 | UI primitives, LetterList |
| **Component-Dev-2** | coder | sonnet | 4-5 | LetterView, DiffResolver |
| **Tester** | tester | haiku | 3-6 | Unit tests, integration tests |
| **E2E-Guard** | tester | haiku | 3-6 | E2E test maintenance |
| **Reviewer** | reviewer | sonnet | All | Code review, quality gates |
| **Performance** | performance-engineer | haiku | 6 | Bundle analysis, optimization |
| **Docs** | coder | haiku | 6 | Update README, component docs |

### Model Routing (ADR-026)

| Task Complexity | Model | Example Tasks |
|-----------------|-------|---------------|
| Low (< 30%) | Haiku | Test updates, doc changes, simple fixes |
| Medium (30-70%) | Sonnet | Component implementation, refactoring |
| High (> 70%) | Sonnet/Opus | Architecture decisions, complex logic |

### Task Dependencies

```
Phase 1 (Foundation)
    |
    v
Phase 2 (Design System) -----> Phase 3 (LetterList) -----> Phase 6 (Polish)
    |                                  |
    v                                  v
Phase 4 (LetterView) -----------> Phase 5 (DiffResolver)
```

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| E2E tests break | Update selectors incrementally, test after each component |
| Typography issues | Test on multiple devices/browsers early |
| Performance regression | Monitor bundle size in CI |
| Scope creep | Stick to functional simplicity principle |

## Success Criteria

1. **All 24 E2E tests pass** (critical)
2. **Bundle size < 200KB gzipped** (50% reduction)
3. **Lighthouse Performance > 90**
4. **Visual identity matches archival editorial direction**
5. **Standard patterns for AI agent interaction**

## Files to Create/Modify

### New Files
```
src/
  domains/
    letter-archive/
      components/LetterList.tsx
      components/LetterCard.tsx
      components/LetterView.tsx
      hooks/useLetters.ts
      services/letterRepository.ts
    text-modernization/
      components/DiffViewer.tsx
      components/ChangeAcceptor.tsx
      hooks/useModernization.ts
  components/
    ui/
      button.tsx
      card.tsx
      table.tsx
      skeleton.tsx
  styles/
    globals.css
    typography.css
tailwind.config.ts
components.json (shadcn config)
```

### Files to Remove
```
src/components/LetterList.tsx (old)
src/components/LetterView.tsx (old)
src/components/MarkdownDiffResolver.tsx (old)
```

### Files to Modify
```
package.json (dependencies)
vite.config.ts (CSS config)
src/App.tsx (layout wrapper)
src/main.tsx (font loading)
tests/e2e/website.spec.ts (selectors)
```

## E2E Test Selector Mapping

| Current Selector | New Selector |
|-----------------|--------------|
| `.ant-table-row` | `[data-testid="letter-row"]` |
| `.ant-card` | `[data-testid="letter-card"]` |
| `.ant-pagination` | `[data-testid="pagination"]` |
| `.ant-spin` | `[data-testid="loading"]` |
| `button:has-text("Moderniser")` | `[data-testid="modernize-btn"]` |

## Execution Command

```bash
# Initialize swarm and start implementation
npx @claude-flow/cli@latest swarm init --topology hierarchical-mesh --max-agents 15

# Spawn agents (do NOT execute - this is the plan)
# Queen coordinates all phases
# Each agent works on assigned phase
# E2E tests run after each phase
```

## Next Steps (After Plan Approval)

1. User approves this plan
2. Initialize swarm with claude-flow
3. Spawn agents with Task tool
4. Execute Phase 1 (Foundation)
5. Validate with build and manual check
6. Proceed through phases
7. Final E2E validation
