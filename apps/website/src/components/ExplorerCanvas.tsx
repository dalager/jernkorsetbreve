"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import ExplorerTooltip from "./ExplorerTooltip";
import {
  getTimeColor,
  getRecipientColor,
  getSentimentColor,
  getClusterColor,
  colorWithAlpha,
} from "@/lib/explorer-colors";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ColorMode = "time" | "recipient" | "sentiment" | "cluster";

interface Point {
  id: number;
  x: number;
  y: number;
}

interface LetterSummary {
  id: number;
  date: string;
  sender: string;
  recipient: string;
  place: string;
}

interface ClusterData {
  assignments: Record<string, number>;
  clusters: Array<{ id: number; label: string }>;
}

export interface ExplorerCanvasProps {
  points: Point[];
  letters: LetterSummary[];
  sentiments: Record<string, { cvp_mean?: number }>;
  clusters: ClusterData;
  colorMode: ColorMode;
  isAnimating: boolean;
  animationDate: Date | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildLetterMap(letters: LetterSummary[]): Map<number, LetterSummary> {
  const map = new Map<number, LetterSummary>();
  for (const l of letters) map.set(l.id, l);
  return map;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ExplorerCanvas({
  points,
  letters,
  sentiments,
  clusters,
  colorMode,
  isAnimating,
  animationDate,
}: ExplorerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* View state */
  const [size, setSize] = useState({ w: 800, h: 600 });
  const viewRef = useRef({ offsetX: 0, offsetY: 0, zoom: 1 });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startOX: 0, startOY: 0 });
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const letterMap = useRef(buildLetterMap(letters));
  useEffect(() => {
    letterMap.current = buildLetterMap(letters);
  }, [letters]);

  /* ---- Resize observer ---- */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    obs.observe(container);
    return () => obs.disconnect();
  }, []);

  /* ---- Get color for a point ---- */
  const getColor = useCallback(
    (id: number): string => {
      const letter = letterMap.current.get(id);
      switch (colorMode) {
        case "time":
          return getTimeColor(letter?.date ?? "");
        case "recipient":
          return getRecipientColor(letter?.recipient ?? "");
        case "sentiment":
          return getSentimentColor(sentiments[String(id)]?.cvp_mean ?? 0);
        case "cluster":
          return getClusterColor(clusters.assignments[String(id)] ?? 0);
        default:
          return "hsl(0, 0%, 60%)";
      }
    },
    [colorMode, sentiments, clusters]
  );

  /* ---- Draw ---- */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h } = size;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const { offsetX, offsetY, zoom } = viewRef.current;
    const padding = Math.min(w, h) * 0.1;
    const drawW = w - 2 * padding;
    const drawH = h - 2 * padding;
    const baseRadius = 5;
    const radius = baseRadius * Math.min(zoom, 3);

    // Background
    ctx.fillStyle = "#F5F0E6";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoom, zoom);

    for (const point of points) {
      const cx = point.x * drawW + padding;
      const cy = point.y * drawH + padding;
      const color = getColor(point.id);

      let alpha = 0.85;
      if (isAnimating && animationDate) {
        const letter = letterMap.current.get(point.id);
        if (letter?.date) {
          const letterTime = new Date(letter.date).getTime();
          alpha = letterTime <= animationDate.getTime() ? 0.85 : 0.08;
        }
      }

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = colorWithAlpha(color, alpha);
      ctx.fill();

      if (point.id === hoveredId) {
        ctx.strokeStyle = "#3D3229";
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();
      }
    }

    ctx.restore();
  }, [points, size, getColor, isAnimating, animationDate, hoveredId]);

  useEffect(() => {
    const raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  /* ---- Hit test ---- */
  const findNearest = useCallback(
    (mx: number, my: number): number | null => {
      const { offsetX, offsetY, zoom } = viewRef.current;
      const padding = Math.min(size.w, size.h) * 0.1;
      const drawW = size.w - 2 * padding;
      const drawH = size.h - 2 * padding;
      const threshold = 15 / zoom;

      let bestId: number | null = null;
      let bestDist = threshold * threshold;

      for (const p of points) {
        const cx = (p.x * drawW + padding) * zoom + offsetX;
        const cy = (p.y * drawH + padding) * zoom + offsetY;
        const dx = mx - cx;
        const dy = my - cy;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < bestDist) {
          bestDist = dist2;
          bestId = p.id;
        }
      }
      return bestId;
    },
    [points, size]
  );

  /* ---- Mouse handlers ---- */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (dragRef.current.dragging) {
        viewRef.current.offsetX =
          dragRef.current.startOX + (e.clientX - dragRef.current.startX);
        viewRef.current.offsetY =
          dragRef.current.startOY + (e.clientY - dragRef.current.startY);
        requestAnimationFrame(draw);
        return;
      }

      const id = findNearest(mx, my);
      setHoveredId(id);
      if (id !== null) {
        setTooltipPos({ x: mx, y: my });
      }
    },
    [findNearest, draw]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      dragRef.current = {
        dragging: true,
        startX: e.clientX,
        startY: e.clientY,
        startOX: viewRef.current.offsetX,
        startOY: viewRef.current.offsetY,
      };
    },
    []
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const id = findNearest(mx, my);
      if (id !== null) {
        window.location.href = `/letters/${id}/`;
      }
    },
    [findNearest]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const oldZoom = viewRef.current.zoom;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newZoom = Math.max(0.3, Math.min(10, oldZoom * factor));

      // Zoom around cursor position
      viewRef.current.offsetX = mx - ((mx - viewRef.current.offsetX) * newZoom) / oldZoom;
      viewRef.current.offsetY = my - ((my - viewRef.current.offsetY) * newZoom) / oldZoom;
      viewRef.current.zoom = newZoom;
      requestAnimationFrame(draw);
    },
    [draw]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredId(null);
    dragRef.current.dragging = false;
  }, []);

  /* ---- Tooltip data ---- */
  const hoveredLetter = hoveredId !== null ? letterMap.current.get(hoveredId) : null;
  const hoveredSentiment = hoveredId !== null ? (sentiments[String(hoveredId)]?.cvp_mean ?? 0) : 0;
  const hoveredClusterId = hoveredId !== null ? (clusters.assignments[String(hoveredId)] ?? 0) : 0;
  const hoveredClusterLabel =
    clusters.clusters.find((c) => c.id === hoveredClusterId)?.label ?? "";

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h, cursor: hoveredId !== null ? "pointer" : "grab", touchAction: "none" }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onWheel={handleWheel}
      />
      {hoveredId !== null && hoveredLetter && (
        <ExplorerTooltip
          x={tooltipPos.x}
          y={tooltipPos.y}
          date={hoveredLetter.date}
          sender={hoveredLetter.sender}
          recipient={hoveredLetter.recipient}
          place={hoveredLetter.place}
          sentiment={hoveredSentiment}
          clusterLabel={hoveredClusterLabel}
        />
      )}
    </div>
  );
}
