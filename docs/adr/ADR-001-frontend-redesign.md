# ADR-001: Frontend Redesign - Archival Editorial Design System

## Status
Proposed

## Context
The current Jernkorsetbreve frontend uses generic Ant Design components with inline styles. It lacks visual identity appropriate for a historical letter archive. The interface needs to be:
- Distinctive yet functional for historical document viewing
- Accessible to both humans and AI agents
- Simple and recognizable (not boutique)
- Maintainable with modern tooling

## Decision

### Design Direction: Archival Editorial
A refined minimalist aesthetic with historical gravitas. Letters feel like handling original documents in an archive.

### Typography System
| Purpose | Font | Rationale |
|---------|------|-----------|
| Display/Headers | Cormorant Garamond | Historical elegance for titles |
| Letter Text | Source Serif 4 | Optimized for reading historical content |
| UI Elements | IBM Plex Sans | Clean, accessible interface text |

### Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| `--parchment` | #F5F0E6 | Primary background |
| `--ink` | #3D3229 | Primary text |
| `--wax-red` | #8B2323 | Accent, buttons, links |
| `--faded` | #7D7469 | Secondary text, metadata |
| `--cream` | #FFFEF8 | Card backgrounds |

### Tech Stack Migration
- **Remove**: Ant Design, @ant-design/icons
- **Add**: Tailwind CSS 4.0, shadcn/ui, Motion library
- **Keep**: React 19, React Router 7, Vite 6

### Component Architecture
```
src/
  components/
    ui/           # shadcn/ui primitives
    archive/      # Letter archive components
      LetterCard.tsx
      LetterList.tsx
      LetterView.tsx
      CorrespondentBadge.tsx
    modernization/
      DiffViewer.tsx
      ChangeAcceptor.tsx
    layout/
      Header.tsx
      Navigation.tsx
      Container.tsx
```

## Consequences

### Positive
- Distinctive visual identity matching historical content
- Lighter bundle (Ant Design is heavy)
- Better customization with Tailwind
- Improved accessibility with semantic HTML
- Standard patterns for AI agent interaction

### Negative
- Migration effort from Ant Design
- Team needs to learn Tailwind/shadcn patterns
- E2E tests need selector updates

### Risks
- Typography may not render well on all devices
- Color contrast needs accessibility validation

## Compliance
- WCAG 2.1 AA color contrast minimum
- Semantic HTML for screen readers
- Keyboard navigation support
