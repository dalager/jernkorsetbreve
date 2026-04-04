"use client";

import { useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";

interface Node {
  id: string;
  canonical: string;
  category: string;
  letter_count: number;
  pagerank: number;
  betweenness_centrality: number;
  role: string;
}

interface Edge {
  source: string | { id: string };
  target: string | { id: string };
  weight: number;
  years: number[];
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  canonical: string;
  category: string;
  letter_count: number;
  pagerank: number;
  betweenness_centrality: number;
  role: string;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  weight: number;
}

interface Props {
  nodes: Node[];
  edges: Edge[];
  categoryColors: Record<string, string>;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
}

const WIDTH = 800;
const HEIGHT = 560;

export default function NetworkGraph({
  nodes,
  edges,
  categoryColors,
  selectedNodeId,
  onSelectNode,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);

  // Scale node radius: sqrt scale, clamped
  const radiusScale = useCallback(() => {
    const maxCount = Math.max(...nodes.map((n) => n.letter_count), 1);
    return (count: number) => {
      const base = Math.sqrt(count / maxCount);
      return 5 + base * 20; // 5px min, 25px max
    };
  }, [nodes]);

  // Scale edge width
  const edgeWidthScale = useCallback(() => {
    const maxWeight = Math.max(...edges.map((e) => e.weight), 1);
    return (weight: number) => 0.5 + (weight / maxWeight) * 4;
  }, [edges]);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const getRadius = radiusScale();
    const getWidth = edgeWidthScale();

    // Prepare data copies for D3 mutation
    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = edges.map((e) => ({
      source: typeof e.source === "string" ? e.source : e.source.id,
      target: typeof e.target === "string" ? e.target : e.target.id,
      weight: e.weight,
    }));

    // Container with zoom
    const g = svg.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoom);

    // Links
    const linkGroup = g.append("g").attr("class", "links");
    const link = linkGroup
      .selectAll<SVGLineElement, SimLink>("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", "#B0A998")
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", (d) => getWidth(d.weight));

    // Nodes
    const nodeGroup = g.append("g").attr("class", "nodes");
    const node = nodeGroup
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes, (d) => d.id)
      .join("g")
      .attr("cursor", "pointer");

    node
      .append("circle")
      .attr("r", (d) => getRadius(d.letter_count))
      .attr("fill", (d) => categoryColors[d.category] ?? "#9C8F80")
      .attr("stroke", "#FFFEF8")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.85);

    // Labels for nodes with letter_count > 10
    node
      .filter((d) => d.letter_count > 10)
      .append("text")
      .text((d) => d.canonical)
      .attr("text-anchor", "middle")
      .attr("dy", (d) => getRadius(d.letter_count) + 14)
      .attr("font-size", "11px")
      .attr("font-family", "var(--font-ui)")
      .attr("fill", "#3D3229")
      .attr("pointer-events", "none");

    // Tooltip
    const tooltip = d3
      .select(svgRef.current.parentElement!)
      .append("div")
      .attr(
        "class",
        "absolute pointer-events-none bg-parchment-light border border-faded/30 rounded px-3 py-2 text-sm font-ui shadow-letter"
      )
      .style("opacity", "0")
      .style("z-index", "10");

    // Hover interactions
    node
      .on("mouseenter", (event, d) => {
        const connected = new Set<string>();
        connected.add(d.id);
        simLinks.forEach((l) => {
          const src = typeof l.source === "object" ? (l.source as SimNode).id : String(l.source);
          const tgt = typeof l.target === "object" ? (l.target as SimNode).id : String(l.target);
          if (src === d.id) connected.add(tgt);
          if (tgt === d.id) connected.add(src);
        });

        node.select("circle").attr("opacity", (n) =>
          connected.has(n.id) ? 1 : 0.15
        );
        node.select("text").attr("opacity", (n) =>
          connected.has(n.id) ? 1 : 0.15
        );
        link
          .attr("stroke-opacity", (l) => {
            const src = typeof l.source === "object" ? (l.source as SimNode).id : String(l.source);
            const tgt = typeof l.target === "object" ? (l.target as SimNode).id : String(l.target);
            return src === d.id || tgt === d.id ? 0.8 : 0.05;
          })
          .attr("stroke", (l) => {
            const src = typeof l.source === "object" ? (l.source as SimNode).id : String(l.source);
            const tgt = typeof l.target === "object" ? (l.target as SimNode).id : String(l.target);
            return src === d.id || tgt === d.id
              ? categoryColors[d.category] ?? "#B0A998"
              : "#B0A998";
          });

        tooltip
          .html(
            `<strong>${d.canonical}</strong><br/>` +
              `<span style="color:#7D7469">${d.role}</span><br/>` +
              `Breve: ${d.letter_count}<br/>` +
              `PageRank: ${d.pagerank.toFixed(4)}`
          )
          .style("left", `${event.offsetX + 12}px`)
          .style("top", `${event.offsetY - 10}px`)
          .style("opacity", "1");
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", `${event.offsetX + 12}px`)
          .style("top", `${event.offsetY - 10}px`);
      })
      .on("mouseleave", () => {
        node.select("circle").attr("opacity", 0.85);
        node.select("text").attr("opacity", 1);
        link.attr("stroke-opacity", 0.5).attr("stroke", "#B0A998");
        tooltip.style("opacity", "0");
      })
      .on("click", (_event, d) => {
        onSelectNode(d.id === selectedNodeId ? null : d.id);
      });

    // Drag behavior
    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    node.call(drag);

    // Force simulation
    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(80)
          .strength((d) => Math.min(d.weight / 50, 0.8))
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(WIDTH / 2, HEIGHT / 2))
      .force(
        "collision",
        d3.forceCollide<SimNode>().radius((d) => getRadius(d.letter_count) + 4)
      )
      .force("x", d3.forceX(WIDTH / 2).strength(0.05))
      .force("y", d3.forceY(HEIGHT / 2).strength(0.05))
      .on("tick", () => {
        link
          .attr("x1", (d) => (d.source as SimNode).x!)
          .attr("y1", (d) => (d.source as SimNode).y!)
          .attr("x2", (d) => (d.target as SimNode).x!)
          .attr("y2", (d) => (d.target as SimNode).y!);
        node.attr("transform", (d) => `translate(${d.x},${d.y})`);
      });

    simulationRef.current = simulation;

    // Highlight selected node
    if (selectedNodeId) {
      node.select("circle").attr("stroke", (d) =>
        d.id === selectedNodeId ? "#8B2323" : "#FFFEF8"
      ).attr("stroke-width", (d) =>
        d.id === selectedNodeId ? 3 : 1.5
      );
    }

    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [nodes, edges, categoryColors, selectedNodeId, onSelectNode, radiusScale, edgeWidthScale]);

  return (
    <div className="relative bg-parchment-light border border-faded/20 rounded-lg overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        style={{ maxHeight: "560px" }}
      />
    </div>
  );
}
