"use client";

import { useState, useEffect } from "react";
import SocialNetwork from "@/components/SocialNetwork";

interface NetworkNode {
  id: string;
  canonical: string;
  category: "family" | "military" | "community" | "unknown";
  role: string;
  letter_count: number;
  first_mention: string;
  last_mention: string;
  degree_centrality: number;
  betweenness_centrality: number;
  pagerank: number;
  temporal_persistence: number;
  years_active: number[];
}

interface NetworkEdge {
  source: string;
  target: string;
  weight: number;
  years: number[];
}

interface TemporalSlice {
  density: number;
  num_nodes: number;
  num_edges: number;
  new_nodes: string[];
}

interface GlobalMetrics {
  total_nodes: number;
  total_edges: number;
  average_degree: number;
  connected_components: number;
  density: number;
}

export interface NetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  temporal_slices: Record<string, TemporalSlice>;
  global_metrics: GlobalMetrics;
}

export default function NetworkPage() {
  const [data, setData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/data/social-network.json");
        if (!res.ok) throw new Error("Kunne ikke hente netværksdata");
        const json: NetworkData = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ukendt fejl");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center">
        <div className="animate-pulse">
          <div className="h-8 bg-parchment-dark rounded w-48 mx-auto mb-4" />
          <div className="h-4 bg-parchment-dark rounded w-64 mx-auto" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center">
        <h1 className="font-display text-3xl text-ink mb-4">Socialt netværk</h1>
        <p className="text-faded">Data er ikke tilgængelig: {error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-ink mb-2">Socialt netværk</h1>
        <p className="text-faded font-ui text-sm">
          Personerne i Peters breve og deres forbindelser, 1911–1918
        </p>
      </div>
      <SocialNetwork data={data} />
    </div>
  );
}
