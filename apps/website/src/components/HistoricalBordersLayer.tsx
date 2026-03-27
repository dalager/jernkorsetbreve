"use client";

import { useEffect, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import type { Layer, PathOptions } from "leaflet";

interface BorderFeatureProperties {
  NAME: string;
  NAME_DA: string;
}

interface HistoricalBordersLayerProps {
  year: 1914 | 1918;
}

const borderStyle: PathOptions = {
  color: "#8B7D6B",
  weight: 2,
  opacity: 0.5,
  fill: false,
  className: "historical-border",
};

const hoverStyle: PathOptions = {
  weight: 3,
  opacity: 0.8,
};

// Cache fetched data across renders
const dataCache: Record<string, GeoJSON.FeatureCollection | null> = {};

export default function HistoricalBordersLayer({
  year,
}: HistoricalBordersLayerProps) {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(
    dataCache[year] || null
  );
  const [loading, setLoading] = useState(!dataCache[year]);
  const map = useMap();

  useEffect(() => {
    if (dataCache[year]) {
      setData(dataCache[year]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/data/borders-${year}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch borders-${year}.json`);
        return res.json();
      })
      .then((geojson) => {
        dataCache[year] = geojson;
        setData(geojson);
      })
      .catch((err) => {
        console.error("Failed to load historical borders:", err);
      })
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => {
    if (!loading && data) {
      // Update attribution when borders are visible
      const attr = map.attributionControl;
      const borderAttr =
        'Grænser: <a href="https://uspatial.umn.edu">U-Spatial, UMN</a>';
      attr.addAttribution(borderAttr);
      return () => {
        attr.removeAttribution(borderAttr);
      };
    }
  }, [map, loading, data]);

  if (!data) return null;

  function onEachFeature(
    feature: GeoJSON.Feature<GeoJSON.Geometry, BorderFeatureProperties>,
    layer: Layer
  ) {
    const props = feature.properties;
    const name = props.NAME_DA || props.NAME || "";
    if (name) {
      (layer as L.Path).bindTooltip(name, {
        sticky: true,
        className: "border-tooltip",
      });
    }
    (layer as L.Path).on({
      mouseover: (e) => {
        (e.target as L.Path).setStyle(hoverStyle);
      },
      mouseout: (e) => {
        (e.target as L.Path).setStyle(borderStyle);
      },
    });
  }

  return (
    <GeoJSON
      key={`borders-${year}`}
      data={data}
      style={() => borderStyle}
      onEachFeature={onEachFeature}
    />
  );
}
