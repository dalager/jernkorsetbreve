# ADR-034: Three.js 3D Letter Explorer

## Status

Accepted (implemented 2026-03-28)

## Date

2026-03-28

## Context

The explorer page (`/explorer/`) renders 665 letter embeddings as a 2D scatter plot on an HTML Canvas (`ExplorerCanvas.tsx`, 371 lines). Users can color points by time period, recipient, sentiment, or topic cluster, and click to navigate to individual letters.

A 3D view would let users perceive clustering structure that is lost in the 2D projection -- groups that overlap in 2D may separate clearly in 3D. UMAP preserves more neighborhood structure with 3 components than with 2. The 3D coordinates are produced by ADR-033.

At 665 points, performance is not a concern for any modern WebGL implementation. The architectural questions are:

1. How to integrate a WebGL/Three.js renderer into the Next.js 16 static export without breaking SSR or inflating the default bundle.
2. How to structure the 3D component relative to the existing 2D canvas.
3. How to handle interaction patterns (rotation, zoom, hover, click) in 3D.

### Current stack constraints

- Next.js 16.2.1 with React 19.2.4 and static export to Cloudflare Pages
- No existing Three.js or WebGL dependency
- The 2D explorer uses vanilla Canvas 2D API with manual pan/zoom and hit testing
- The website targets broad browser support (desktop and mobile)

## Decision

### 1. Use React Three Fiber (R3F) v9 + drei v9

Add `@react-three/fiber` v9 and `@react-three/drei` v9 as dependencies in `apps/website/package.json`. These are the standard React bindings for Three.js, with full React 19 support as of their v9 releases.

R3F is chosen over raw Three.js because:
- The rest of the app is React; R3F keeps the component model consistent
- drei provides battle-tested utilities (OrbitControls, Html overlays, instancing) that would otherwise require significant boilerplate
- R3F handles the render loop, resize observers, and cleanup lifecycle automatically

Three.js itself (~190 KB gzipped) is a transitive dependency of R3F.

### 2. Code-split with `next/dynamic`

The 3D canvas component is loaded only when the user activates the 3D toggle. This is critical because:
- Three.js + R3F add ~190 KB gzipped to the JavaScript payload
- Most users will use the default 2D view
- Static export does not execute server components, but `next/dynamic` with `ssr: false` ensures the Three.js module graph is excluded from the initial page bundle

```typescript
// In explorer/page.tsx
const Explorer3DCanvas = dynamic(
  () => import("@/components/Explorer3DCanvas"),
  { ssr: false, loading: () => <LoadingSpinner /> }
);
```

The 2D `ExplorerCanvas` remains the default and is loaded eagerly as it is today.

### 3. 2D/3D toggle on the explorer page

Add a toggle button (or segmented control) to the existing controls row in `explorer/page.tsx`. The toggle:
- Defaults to 2D on every page load (no persistence needed)
- Swaps between `ExplorerCanvas` (2D) and `Explorer3DCanvas` (3D)
- Triggers a lazy fetch of `embeddings-3d.json` only when 3D is first activated

The color mode selector, legend, and timeline bar remain shared between both views. The `ColorMode` type and coloring logic are extracted to a shared utility so both canvases use the same palette.

### 4. Explorer3DCanvas component architecture

A new component `apps/website/src/components/Explorer3DCanvas.tsx` renders the 3D scene:

```
<Canvas>
  <OrbitControls />           -- drei: mouse/touch rotation, zoom, pan
  <ambientLight />            -- soft fill light
  <InstancedPoints />         -- 665 instanced spheres (single draw call)
  <HoverLabel />              -- drei <Html> overlay for hovered point
</Canvas>
```

**Rendering strategy**: Use Three.js `InstancedMesh` with a single `SphereGeometry` for all 665 points. At this scale, instancing is not strictly necessary for performance, but it establishes a clean pattern and keeps draw calls at 1.

**Props interface**: The 3D canvas accepts the same props as the 2D canvas (`points3d`, `letters`, `sentiments`, `clusters`, `colorMode`, `isAnimating`, `animationDate`). The `points3d` array has `{id, x, y, z}` instead of `{id, x, y}`.

### 5. Interaction patterns

| Interaction | Implementation |
|---|---|
| Orbit (rotate view) | drei `OrbitControls` with damping enabled |
| Zoom | Scroll wheel / pinch via OrbitControls |
| Pan | Right-click drag / two-finger drag via OrbitControls |
| Hover tooltip | Raycaster on `onPointerMove`; show letter metadata in a drei `<Html>` overlay positioned at the hovered point |
| Click to navigate | `router.push(\`/letters/\${id}\`)` on `onClick` raycaster hit, same as 2D |
| Animation (timeline) | Same time-based point visibility as 2D, controlled by shared `animationDate` state |

OrbitControls is configured with:
- `enableDamping: true` for smooth rotation
- `minDistance` / `maxDistance` to prevent zooming inside or too far from the point cloud
- `autoRotate: false` (user-initiated rotation only)

### 6. Coordinate mapping

The 3D coordinates from `embeddings-3d.json` are normalized to [0, 1]. The component maps them to a scene-space range (e.g., [-5, 5] on each axis) centered at the origin, so OrbitControls orbits around the center of the point cloud.

### 7. No WebGPU, no post-processing

665 points do not warrant WebGPU, bloom effects, or other advanced rendering. Plain WebGL via Three.js is sufficient. This keeps the dependency surface small and maximizes browser compatibility (WebGL is supported by 98%+ of browsers; WebGPU is still emerging).

## Alternatives Considered

### Raw Three.js without React Three Fiber

Would avoid the R3F dependency (~25 KB gzipped on top of Three.js) and give full control over the render loop. Rejected because:
- Manual lifecycle management (mount, unmount, resize, cleanup) in React is error-prone
- drei's `OrbitControls`, `Html`, and `Instance` components save hundreds of lines of imperative code
- The codebase is React-first; an imperative Three.js island would be architecturally inconsistent

### deck.gl

A data visualization layer built on WebGL, often used for map and scatter plot overlays. Rejected because:
- Heavier dependency (~300 KB gzipped) than Three.js
- Optimized for 2D map projections; 3D scatter with orbit controls is not its strength
- Less React integration than R3F

### Plotly / Plotly.gl

Could render a 3D scatter plot with minimal code. Rejected because:
- Very large bundle (~1 MB minified)
- Opinionated styling that clashes with the project's archival design system
- Limited control over interaction and appearance

### CSS 3D transforms (no WebGL)

For 665 DOM elements, CSS 3D perspective transforms could simulate a 3D scatter. Rejected because:
- Poor performance for point hover/raycasting (no GPU-accelerated hit testing)
- No true depth buffer or occlusion
- Fragile interaction model (no OrbitControls equivalent)

### Embed 3D in the existing Canvas 2D component

Could add a "fake 3D" mode with isometric projection on the 2D canvas. Rejected because:
- No true rotation or depth perception
- Increases complexity of the already 371-line ExplorerCanvas
- Users expect real 3D interaction (orbit, zoom) when a "3D" toggle is offered

## Consequences

### Positive

- Users can explore clustering structure in three dimensions, revealing groups hidden in the 2D projection
- Three.js only loads when toggled, so 2D-only users see no bundle size increase
- R3F's React integration keeps the component consistent with the rest of the codebase
- The shared color mode and timeline controls work identically in both views
- 665 points is trivial for WebGL; performance will be excellent on all devices including mobile

### Negative

- Three.js + R3F + drei add approximately 190 KB gzipped to the code-split chunk (loaded on demand)
- A new rendering paradigm (WebGL/3D) increases the surface area for visual bugs
- Mobile 3D interaction (touch orbit, pinch zoom) requires testing across devices
- The `Explorer3DCanvas` component adds ~150-200 lines to the codebase

### Risks

- React Three Fiber v9 is relatively new (released for React 19 compatibility). If bugs surface, fallback is to pin to a known-good commit or drop to raw Three.js
- Static export compatibility: R3F renders client-side only, which is correct for static export. The `ssr: false` dynamic import ensures no server-side Three.js execution. However, this must be tested with `next build` before merging
- Cloudflare Pages has no special constraints for client-side WebGL; the static HTML/JS/CSS is served as-is

## Implementation Notes

### New files

1. `apps/website/src/components/Explorer3DCanvas.tsx` -- the 3D scene component (~150-200 lines)

### Modified files

1. `apps/website/package.json` -- add `@react-three/fiber`, `@react-three/drei`, `three` as dependencies; add `@types/three` as devDependency
2. `apps/website/src/app/explorer/page.tsx` -- add 2D/3D toggle state, dynamic import of `Explorer3DCanvas`, conditional rendering, lazy fetch of `embeddings-3d.json`
3. `apps/website/src/components/ExplorerCanvas.tsx` -- extract shared color utilities to a separate module if not already shared

### New dependency versions (at time of writing)

| Package | Version | Gzipped size |
|---|---|---|
| `three` | ^0.172 | ~170 KB |
| `@react-three/fiber` | ^9.1 | ~18 KB |
| `@react-three/drei` | ^9.121 | tree-shakeable; only used utilities imported |
| `@types/three` | (devDep) | 0 (types only) |

### Testing

- E2E tests should verify the 3D toggle renders without errors and that clicking a point navigates to the letter detail page
- Visual regression is impractical for WebGL; manual testing across Chrome, Firefox, Safari, and mobile Safari is needed
- The 2D explorer must continue to pass all 24 existing E2E tests unchanged

Estimated effort: 1-2 days.

## Related

- ADR-033: 3D Embedding Coordinates (produces the `embeddings-3d.json` consumed here)
- ADR-012: Multilingual Embedding Model (the source embeddings)
- ADR-018: Visualization Suite (broader visualization roadmap that this feature fits within)
