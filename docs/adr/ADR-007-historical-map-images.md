# ADR-007: Historical Map Images — Deferred from Leaflet Overlay

## Status
Accepted

## Context
The `historical_data/maps/` directory contains raster map images:

| File | Description |
|------|-------------|
| `europe_1914.gif` | Political map of Europe in 1914 |
| `warplans_eastern_front1914.jpg` | Eastern front war plans |
| `1914-08-17_1914-08-23_Tannenberg.jpg` | Battle of Tannenberg, phase 1 |
| `1914-08-23_1914-08-26_Tannenberg.jpg` | Battle of Tannenberg, phase 2 |
| `1914-08-27_1914-08-30_Tannenberg.jpg` | Battle of Tannenberg, phase 3 |

Issue #6 asks whether these could be used as tile overlays on the Leaflet map.

## Decision

**Do not overlay raster map images on the Leaflet map.** Defer to a future issue if needed.

### Reasons

1. **No georeferencing metadata**: The images lack projection information (no `.jgw`/`.pgw` world files, no embedded GeoTIFF metadata, no known corner coordinates). To use them as Leaflet `ImageOverlay`s, we would need exact lat/lng bounds for each image corner.

2. **Manual georeferencing is error-prone**: Identifying control points (cities, rivers, coastlines) on a 1914 map and mapping them to modern coordinates requires cartographic expertise and trial-and-error. The result would be approximate at best, with visible misalignment against modern basemap tiles.

3. **Resolution mismatch**: These are single images (not tiled). A `europe_1914.gif` covering all of Europe would be blurry when zoomed in past level 6-7, while the CARTO basemap tiles remain sharp. This creates a jarring visual experience.

4. **The GeoJSON borders solve the primary need**: The issue's core ask — showing historical borders — is addressed by the vector border overlay (ADR-005/006). The raster maps would add atmospheric value but are not essential.

### Future possibilities

If there is interest in using these images, the recommended approach would be:

- **Static illustrations**: Display them as reference images on an "Om projektet" page or in a modal accessible from the map page. No georeferencing needed.
- **Tannenberg battle maps**: These have date ranges that align with battle data. They could be shown alongside the Battle of Tannenberg entry in the battle correlation section, as contextual illustrations rather than map overlays.
- **External georeferenced sources**: Services like the David Rumsey Map Collection or MapWarper have pre-georeferenced historical maps available as tile layers. These could be explored as an alternative to manually georeferencing the local images.

## Consequences

- The raster images remain in `historical_data/maps/` for reference but are not processed or served by the website
- Issue #6 is fully addressed by the GeoJSON border overlay alone
- A future issue can be opened specifically for raster map integration if desired
