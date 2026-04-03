"use client";

import { useMemo } from "react";

interface GlobalMetrics {
  total_nodes: number;
  total_edges: number;
  average_degree: number;
  connected_components: number;
  density: number;
}

interface Node {
  id: string;
  canonical: string;
  category: string;
  pagerank: number;
  betweenness_centrality: number;
  letter_count: number;
}

interface Props {
  globalMetrics: GlobalMetrics;
  nodes: Node[];
}

export default function NetworkStatsPanel({ globalMetrics, nodes }: Props) {
  const topPageRank = useMemo(
    () => [...nodes].sort((a, b) => b.pagerank - a.pagerank).slice(0, 5),
    [nodes]
  );

  const topBetweenness = useMemo(
    () =>
      [...nodes]
        .sort((a, b) => b.betweenness_centrality - a.betweenness_centrality)
        .slice(0, 5),
    [nodes]
  );

  return (
    <div className="bg-parchment-light border border-faded/20 rounded-lg p-4 space-y-4">
      <h3 className="font-display text-lg text-ink">Netværksstatistik</h3>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm font-ui">
        <dt className="text-faded">Noder</dt>
        <dd className="text-ink font-medium">{globalMetrics.total_nodes}</dd>
        <dt className="text-faded">Kanter</dt>
        <dd className="text-ink font-medium">{globalMetrics.total_edges}</dd>
        <dt className="text-faded">Tæthed</dt>
        <dd className="text-ink font-medium">
          {globalMetrics.density.toFixed(4)}
        </dd>
        <dt className="text-faded">Gns. grad</dt>
        <dd className="text-ink font-medium">
          {globalMetrics.average_degree.toFixed(2)}
        </dd>
        <dt className="text-faded">Komponenter</dt>
        <dd className="text-ink font-medium">
          {globalMetrics.connected_components}
        </dd>
      </dl>

      <div>
        <h4 className="text-sm font-ui text-faded mb-1">Top 5 PageRank</h4>
        <ol className="text-sm font-ui space-y-0.5">
          {topPageRank.map((n, i) => (
            <li key={n.id} className="flex justify-between">
              <span className="text-ink">
                {i + 1}. {n.canonical}
              </span>
              <span className="text-faded">{n.pagerank.toFixed(4)}</span>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <h4 className="text-sm font-ui text-faded mb-1">
          Top 5 Betweenness Centrality
        </h4>
        <ol className="text-sm font-ui space-y-0.5">
          {topBetweenness.map((n, i) => (
            <li key={n.id} className="flex justify-between">
              <span className="text-ink">
                {i + 1}. {n.canonical}
              </span>
              <span className="text-faded">
                {n.betweenness_centrality.toFixed(4)}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <p className="text-xs text-faded font-ui pt-2 border-t border-faded/20">
        Klik en node i grafen for at se detaljer om personen.
      </p>
    </div>
  );
}
