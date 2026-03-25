# ADR-006: Historical Borders — Frontend Rendering and Interaction Design

## Status
Accepted

## Context
With optimized border GeoJSON files produced by ADR-005, we need to decide how to render and interact with them on the map page. The current map uses react-leaflet with CARTO light basemap tiles and `CircleMarker` overlays for letter places.

Key constraints:
- Letter place markers must remain visible and clickable on top of borders
- The map is already loading ~1.3 MB of data (letters.json + places.json) on page load
- The site uses a parchment/ink color theme
- Mobile must work (touch events, limited bandwidth)
- react-leaflet's `GeoJSON` component does not re-render when data prop changes — requires `key` prop workaround

## Decision

### Rendering: Stroke-only GeoJSON polygons

Historical borders render as **outlines only** (no fill). This is critical because:
- Filled polygons would obscure the letter place markers underneath
- Filled polygons would capture click events, preventing users from clicking on letter markers
- Outlines provide sufficient geographic context without visual competition

Style specification:
```
Stroke color:  #8B7D6B (warm gray, complements parchment theme)
Stroke weight: 1.5px (default), 2.5px (hover)
Stroke opacity: 0.5 (subtle enough to not dominate the basemap labels)
Fill:          none
Dash pattern:  none (solid line — dashed looks too busy with 45 polygons)
```

The color `#8B7D6B` is chosen to sit between the existing `--faded` (#7D7469) and `--ink-light` colors, ensuring the borders look like part of the parchment theme rather than a foreign overlay.

### Lazy loading

Border data is **not loaded on page mount**. It is fetched only when the user toggles borders on. This keeps the initial map load fast. Once fetched, the data is cached in component state so toggling off/on is instant.

Fetch pattern:
```
User toggles borders ON → fetch(`/data/borders-${year}.json`) → cache in state → render
User switches year → fetch other file if not cached → render
User toggles borders OFF → hide layer (data stays cached)
```

Both files (~500 KB each) should be fetched with standard browser caching. After the first visit, they'll be served from disk cache.

### Year toggle: Two discrete buttons, not a slider

The data exists for exactly two years (1914 and 1918). A slider would imply continuous data and mislead users. Two buttons labeled "1914" and "1918" make the available options explicit.

### Control placement

A floating control panel positioned in the **top-right of the map** (below the zoom controls if present, or at top-right since `zoomControl` could be customized). The panel contains:

```
+---------------------------+
|  Historiske grænser   [x] |
|   [1914]   [1918]         |
+---------------------------+
```

- Checkbox (or toggle switch) to show/hide borders
- Year buttons appear only when borders are visible
- Active year button is highlighted (ink background)
- Panel uses `bg-parchment-light` with `border-faded/20`, matching existing controls

Implementation: Absolutely positioned `div` inside the MapContainer wrapper with `z-index: 1000` and `pointer-events: auto`. This is simpler and more React-idiomatic than creating a Leaflet `L.Control` subclass.

### Country name tooltips

On hover over a border polygon, a Leaflet tooltip shows the country name. Uses Danish name (`NAME_DA`) with English fallback (`NAME`). The tooltip follows the cursor and disappears on mouseout.

Implementation: react-leaflet `GeoJSON` component's `onEachFeature` callback binds a tooltip to each feature.

### react-leaflet GeoJSON re-render

react-leaflet's `GeoJSON` component caches its initial data and does not update when the `data` prop changes. To switch between 1914 and 1918 borders, the component must be forced to unmount and remount.

Solution: Use `key={`borders-${year}`}` on the GeoJSON component. When `year` changes, React unmounts the old instance and mounts a new one with the new data.

### Rendering order (z-index)

Leaflet renders layers in DOM order. The border GeoJSON layer must be added **before** the CircleMarkers so markers render on top. In the JSX:

```tsx
<MapContainer>
  <TileLayer ... />
  {bordersVisible && <HistoricalBordersLayer year={year} />}
  {/* CircleMarkers rendered after borders = visually on top */}
  {places.map(place => <CircleMarker ... />)}
</MapContainer>
```

### Attribution

When borders are visible, add to the map attribution:
```
Borders: <a href="https://uspatial.umn.edu">U-Spatial, UMN</a>
```

This satisfies the U-Spatial license requirement ("must be cited appropriately").

## Consequences

### New files
| File | Type | Description |
|------|------|-------------|
| `components/HistoricalBordersLayer.tsx` | Create | GeoJSON layer with lazy loading and caching |
| `components/BorderToggle.tsx` | Create | Floating map control for toggle + year selection |
| `components/MapView.tsx` | Edit | Add border state, render new components, attribution |

### Performance impact
- **Initial load**: Zero impact (lazy loaded)
- **First toggle**: ~500 KB fetch + GeoJSON parse + polygon rendering. Estimated ~200–400ms on broadband, ~1–2s on 3G.
- **Year switch**: Either instant (cached) or another ~500 KB fetch
- **Rendering**: 45 stroke-only polygons with ~40,000 points. Leaflet SVG renderer handles this without issues. If mobile performance is poor, `preferCanvas={true}` on MapContainer is a fallback.

### Not included
- MiniMap component (letter detail pages) does **not** get historical borders. It's a 200px non-interactive preview — borders would add visual noise without value at that scale.
- No animated transition between 1914 and 1918 borders. The switch is instant (unmount/mount). Animating polygon morphing would require a different rendering approach and adds complexity for minimal benefit.

## Alternatives Considered

**Fill polygons with transparent colors per alliance**: Rejected. Adds visual complexity, introduces a political interpretation layer (who was "allied" changed during the war), and interferes with marker visibility.

**Use Leaflet's canvas renderer by default**: Considered but deferred. SVG renderer is fine for 45 polygons. Canvas is a fallback if mobile performance proves insufficient.

**Embed borders in the basemap tiles**: Rejected. Would require custom tile generation and hosting. CARTO light tiles are served from CDN for free; replacing them loses that benefit.
