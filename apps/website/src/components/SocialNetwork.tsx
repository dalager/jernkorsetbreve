"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { NetworkData } from "@/app/network/page";
import NetworkGraph from "@/components/NetworkGraph";
import NetworkStatsPanel from "@/components/NetworkStatsPanel";

const CATEGORY_COLORS: Record<string, string> = {
  family: "#C2583A",
  military: "#4A6FA5",
  community: "#5A8A5E",
  unknown: "#9C8F80",
};

const CATEGORY_LABELS: Record<string, string> = {
  family: "Familie",
  military: "Militær",
  community: "Lokalsamfund",
  unknown: "Ukendt",
};

export default function SocialNetwork({ data }: { data: NetworkData }) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const years = useMemo(
    () => Object.keys(data.temporal_slices).map(Number).sort(),
    [data]
  );

  const filteredData = useMemo(() => {
    if (!selectedYear) return { nodes: data.nodes, edges: data.edges };
    const activeNodeIds = new Set(
      data.nodes
        .filter((n) => n.years_active.includes(selectedYear))
        .map((n) => n.id)
    );
    return {
      nodes: data.nodes.filter((n) => activeNodeIds.has(n.id)),
      edges: data.edges.filter(
        (e) =>
          e.years.includes(selectedYear) &&
          activeNodeIds.has(typeof e.source === "string" ? e.source : (e.source as { id: string }).id) &&
          activeNodeIds.has(typeof e.target === "string" ? e.target : (e.target as { id: string }).id)
      ),
    };
  }, [data, selectedYear]);

  const yearStats = selectedYear
    ? data.temporal_slices[String(selectedYear)]
    : null;

  // Play animation with cleanup on unmount
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handlePlay = () => {
    if (isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
    let idx = selectedYear ? years.indexOf(selectedYear) : 0;
    intervalRef.current = setInterval(() => {
      if (idx >= years.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsPlaying(false);
        setSelectedYear(null);
        return;
      }
      setSelectedYear(years[idx]);
      idx++;
    }, 1500);
  };

  const selectedNode = selectedNodeId
    ? data.nodes.find((n) => n.id === selectedNodeId) ?? null
    : null;

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm font-ui">
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full inline-block"
              style={{ backgroundColor: CATEGORY_COLORS[key] }}
            />
            <span className="text-faded">{label}</span>
          </div>
        ))}
      </div>

      {/* Timeline slider */}
      <div className="bg-parchment-light border border-faded/20 rounded-lg p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handlePlay}
            className="px-3 py-1.5 text-sm font-ui bg-parchment border border-faded/30 rounded hover:bg-parchment-dark transition-colors"
            title={isPlaying ? "Stop" : "Afspil"}
          >
            {isPlaying ? "⏹" : "▶"}
          </button>
          <label className="text-sm font-ui text-faded whitespace-nowrap">
            Årstal:
          </label>
          <input
            type="range"
            min={0}
            max={years.length}
            step={1}
            value={selectedYear ? years.indexOf(selectedYear) + 1 : 0}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSelectedYear(val === 0 ? null : years[val - 1]);
            }}
            className="flex-1 accent-wax-red"
          />
          <span className="text-sm font-ui text-ink font-medium min-w-[80px] text-right">
            {selectedYear ?? "Alle år"}
          </span>
        </div>
        {/* Year marks */}
        <div className="flex justify-between mt-1 px-[52px]">
          <span className="text-xs text-faded font-ui">Alle</span>
          {years.map((y) => (
            <span key={y} className="text-xs text-faded font-ui">
              {y}
            </span>
          ))}
        </div>
        {yearStats && (
          <div className="flex gap-6 mt-2 text-xs font-ui text-faded">
            <span>Noder: {yearStats.num_nodes}</span>
            <span>Kanter: {yearStats.num_edges}</span>
            <span>Tæthed: {yearStats.density.toFixed(3)}</span>
            {yearStats.new_nodes.length > 0 && (
              <span>
                Nye: {yearStats.new_nodes.length} person
                {yearStats.new_nodes.length > 1 ? "er" : ""}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Graph + detail panel */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <NetworkGraph
            nodes={filteredData.nodes}
            edges={filteredData.edges}
            categoryColors={CATEGORY_COLORS}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
        </div>
        <div className="lg:w-80 shrink-0">
          {selectedNode ? (
            <NodeDetailPanel
              node={selectedNode}
              edges={data.edges}
              nodes={data.nodes}
              categoryColors={CATEGORY_COLORS}
              categoryLabels={CATEGORY_LABELS}
              onClose={() => setSelectedNodeId(null)}
            />
          ) : (
            <NetworkStatsPanel
              globalMetrics={data.global_metrics}
              nodes={data.nodes}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------ Node Detail Panel ------ */
interface NodeDetailProps {
  node: NetworkData["nodes"][0];
  edges: NetworkData["edges"];
  nodes: NetworkData["nodes"];
  categoryColors: Record<string, string>;
  categoryLabels: Record<string, string>;
  onClose: () => void;
}

function NodeDetailPanel({
  node,
  edges,
  nodes,
  categoryColors,
  categoryLabels,
  onClose,
}: NodeDetailProps) {
  const connections = edges.filter(
    (e) => {
      const src = typeof e.source === "string" ? e.source : (e.source as { id: string }).id;
      const tgt = typeof e.target === "string" ? e.target : (e.target as { id: string }).id;
      return src === node.id || tgt === node.id;
    }
  );

  const connectedNames = connections
    .map((e) => {
      const src = typeof e.source === "string" ? e.source : (e.source as { id: string }).id;
      const tgt = typeof e.target === "string" ? e.target : (e.target as { id: string }).id;
      const otherId = src === node.id ? tgt : src;
      const other = nodes.find((n) => n.id === otherId);
      return { name: other?.canonical ?? otherId, weight: e.weight };
    })
    .sort((a, b) => b.weight - a.weight);

  return (
    <div className="bg-parchment-light border border-faded/20 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-display text-xl text-ink">{node.canonical}</h3>
          <p className="text-sm text-faded font-ui">{node.role}</p>
        </div>
        <button
          onClick={onClose}
          className="text-faded hover:text-ink text-lg leading-none"
          title="Luk"
        >
          &times;
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: categoryColors[node.category] }}
        />
        <span className="text-sm font-ui text-faded">
          {categoryLabels[node.category]}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm font-ui">
        <dt className="text-faded">Breve</dt>
        <dd className="text-ink font-medium">{node.letter_count}</dd>
        <dt className="text-faded">PageRank</dt>
        <dd className="text-ink font-medium">{node.pagerank.toFixed(4)}</dd>
        <dt className="text-faded">Betweenness</dt>
        <dd className="text-ink font-medium">
          {node.betweenness_centrality.toFixed(4)}
        </dd>
        <dt className="text-faded">Degree</dt>
        <dd className="text-ink font-medium">
          {node.degree_centrality.toFixed(3)}
        </dd>
        <dt className="text-faded">Aktive år</dt>
        <dd className="text-ink font-medium">
          {node.years_active[0]}–{node.years_active[node.years_active.length - 1]}
        </dd>
        <dt className="text-faded">Første omtale</dt>
        <dd className="text-ink font-medium">{node.first_mention}</dd>
        <dt className="text-faded">Sidste omtale</dt>
        <dd className="text-ink font-medium">{node.last_mention}</dd>
      </dl>

      {connectedNames.length > 0 && (
        <div>
          <h4 className="text-sm font-ui text-faded mb-1">
            Forbindelser ({connectedNames.length})
          </h4>
          <ul className="text-sm font-ui space-y-0.5 max-h-40 overflow-y-auto">
            {connectedNames.map((c) => (
              <li key={c.name} className="flex justify-between">
                <span className="text-ink">{c.name}</span>
                <span className="text-faded">{c.weight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <a
        href={`/search/?q=${encodeURIComponent(node.canonical)}`}
        className="block text-center text-sm font-ui text-wax-red hover:text-wax-red-dark underline"
      >
        Søg breve med {node.canonical}
      </a>
    </div>
  );
}
