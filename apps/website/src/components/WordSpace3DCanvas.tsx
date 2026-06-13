"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html, Line } from "@react-three/drei";
import * as THREE from "three";
import {
  THEME_COLORS,
  type WordPoint,
  type WordSpaceData,
} from "@/components/WordSpaceCanvas";

/* Map a [0,1] coordinate to [-5,5] world space, centered on the origin. */
function toWorld(v: number): number {
  return v * 10 - 5;
}

function worldPos(p: WordPoint): [number, number, number] {
  return [toWorld(p.x3), toWorld(p.y3), toWorld(p.z3)];
}

/* ------------------------------------------------------------------ */
/*  Single word: sphere + billboarded label                           */
/* ------------------------------------------------------------------ */

function WordNode({
  point,
  dim,
  active,
  labelFactor,
  onHover,
}: {
  point: WordPoint;
  dim: boolean;
  active: boolean;
  labelFactor: number;
  onHover: (p: WordPoint | null) => void;
}) {
  const color = THEME_COLORS[point.theme];
  const pos = worldPos(point);

  return (
    <group position={pos}>
      <mesh
        scale={active ? 1.6 : 1}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHover(point);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "default";
        }}
      >
        <sphereGeometry args={[0.1, 24, 16]} />
        {/* Base emissive keeps the hue vivid on the light background regardless
            of light angle, so the six themes stay distinguishable. */}
        <meshStandardMaterial
          color={color}
          emissive={new THREE.Color(color)}
          emissiveIntensity={active ? 0.85 : 0.45}
          transparent
          opacity={dim ? 0.22 : 1}
          roughness={0.4}
          metalness={0.05}
        />
      </mesh>
      {/* DOM label — cheap and crisp; avoids GPU SDF text (troika) which
          causes readPixels stalls and WebGL context loss with many labels. */}
      <Html
        position={[0, 0.2, 0]}
        center
        distanceFactor={labelFactor}
        zIndexRange={[20, 0]}
        style={{ pointerEvents: "none" }}
      >
        <span
          className="select-none whitespace-nowrap font-ui"
          style={{
            fontSize: 15,
            fontWeight: active ? 700 : 500,
            color: dim ? "#9C8F80" : "#2A231C",
            opacity: dim ? 0.45 : 1,
            textShadow:
              "0 0 2px #FFFEF8, 0 0 2px #FFFEF8, 0 0 3px #FFFEF8, 0 0 4px #FFFEF8",
          }}
        >
          {point.term}
        </span>
      </Html>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Scene                                                              */
/* ------------------------------------------------------------------ */

function Scene({
  points,
  byTerm,
  hovered,
  setHovered,
  autoRotate,
  labelFactor,
  showLinks,
}: {
  points: WordPoint[];
  byTerm: Map<string, WordPoint>;
  hovered: WordPoint | null;
  setHovered: (p: WordPoint | null) => void;
  autoRotate: boolean;
  labelFactor: number;
  showLinks: boolean;
}) {
  const neighborTerms = useMemo(
    () => (hovered ? new Set(hovered.neighbors.map((n) => n.term)) : null),
    [hovered],
  );

  const neighborLines = useMemo(() => {
    if (!hovered) return [];
    return hovered.neighbors
      .map((n) => byTerm.get(n.term))
      .filter((q): q is WordPoint => !!q)
      .map((q) => ({ key: q.term, points: [worldPos(hovered), worldPos(q)] }));
  }, [hovered, byTerm]);

  /* Persistent web of every word's nearest neighbours (toggle), among the
     currently-visible points, deduplicated and coloured by theme. */
  const persistentLines = useMemo(() => {
    if (!showLinks) return [];
    const visible = new Set(points.map((p) => p.term));
    const seen = new Set<string>();
    const out: Array<{ key: string; color: string; points: [number, number, number][] }> = [];
    for (const p of points) {
      for (const nb of p.neighbors) {
        if (!visible.has(nb.term)) continue;
        const key = [p.term, nb.term].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        const q = byTerm.get(nb.term)!;
        out.push({ key, color: THEME_COLORS[p.theme], points: [worldPos(p), worldPos(q)] });
      }
    }
    return out;
  }, [showLinks, points, byTerm]);

  return (
    <>
      <ambientLight intensity={1.0} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />
      <pointLight position={[-8, -5, 5]} intensity={0.4} />

      <OrbitControls
        autoRotate={autoRotate}
        autoRotateSpeed={0.9}
        enableDamping
        dampingFactor={0.1}
        minDistance={4}
        maxDistance={26}
        rotateSpeed={0.8}
        zoomSpeed={0.8}
        panSpeed={0.5}
      />

      {/* Floor grid in faded parchment tones */}
      <gridHelper args={[12, 12, "#D9D2C2", "#E8E3D5"]} position={[0, -5, 0]} />

      {persistentLines.map((l) => (
        <Line key={l.key} points={l.points} color={l.color} lineWidth={1} transparent opacity={0.2} />
      ))}

      {neighborLines.map((l) => (
        <Line key={l.key} points={l.points} color="#8B2323" lineWidth={2} transparent opacity={0.75} />
      ))}

      {points.map((p) => (
        <WordNode
          key={p.term}
          point={p}
          active={hovered?.term === p.term}
          dim={!!hovered && hovered.term !== p.term && !(neighborTerms?.has(p.term))}
          labelFactor={labelFactor}
          onHover={setHovered}
        />
      ))}

      {hovered && (
        <Html position={worldPos(hovered)} distanceFactor={11} zIndexRange={[100, 0]} style={{ pointerEvents: "none" }}>
          <div className="w-[260px] -translate-y-2 translate-x-3 rounded-md border border-faded/30 border-t-[3px] border-t-wax-red bg-parchment-light p-3 shadow-letter">
            <div className="font-display text-base text-ink">{hovered.term}</div>
            <div className="mb-1.5 font-ui text-[11px] text-faded">
              {hovered.themeLabel}
              {hovered.contextCount ? ` · ${hovered.contextCount} forekomster` : ""}
            </div>
            <div className="mb-0.5 font-ui text-[10px] uppercase tracking-wide text-faded">Nærmeste naboer</div>
            <div className="flex flex-wrap gap-1">
              {hovered.neighbors.map((n) => (
                <span key={n.term} className="rounded-full border border-faded/30 bg-parchment px-1.5 py-0.5 font-ui text-[11px] text-ink">
                  {n.term}
                </span>
              ))}
            </div>
          </div>
        </Html>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Top-level component                                               */
/* ------------------------------------------------------------------ */

export default function WordSpace3DCanvas({
  data,
  hidden,
}: {
  data: WordSpaceData;
  hidden: Set<string>;
}) {
  const [hovered, setHovered] = useState<WordPoint | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showLinks, setShowLinks] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const points = useMemo(
    () => data.points.filter((p) => !hidden.has(p.theme)),
    [data.points, hidden],
  );
  const byTerm = useMemo(() => new Map(data.points.map((p) => [p.term, p])), [data.points]);

  /* Keep state in sync with the Fullscreen API — this fires for the button,
     for the browser's own exit affordances, and for native <ESC>. The explicit
     keydown handler guarantees <ESC> exits even where the UA doesn't auto-exit. */
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.fullscreenElement) document.exitFullscreen?.();
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      containerRef.current?.requestFullscreen?.();
    }
  }, []);

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-4 font-ui text-ui-sm text-faded-dark">
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={showLinks} onChange={(e) => setShowLinks(e.target.checked)} />
          Naboforbindelser
        </label>
      </div>

      <div
        ref={containerRef}
        className={`relative w-full overflow-hidden rounded-md border border-faded/20 bg-parchment-light ${
          isFullscreen ? "h-screen" : "h-[560px]"
        }`}
      >
        <Canvas
          camera={{ position: [9, 4, 22], fov: 50, near: 0.1, far: 100 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
          scene={{ background: new THREE.Color("#FFFEF8") }}
        >
          <Scene
            points={points}
            byTerm={byTerm}
            hovered={hovered}
            setHovered={setHovered}
            autoRotate={autoRotate}
            labelFactor={isFullscreen ? 17 : 13}
            showLinks={showLinks}
          />
        </Canvas>

        <span className="pointer-events-none absolute bottom-2.5 left-3.5 font-ui text-xs italic text-faded">
          {data.meta.dimensions} dimensioner → 3. Træk for at rotere, scroll for at zoome.
        </span>

        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoRotate((r) => !r)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-faded/30 bg-parchment-light text-faded-dark shadow-sm transition-colors hover:text-ink"
            title={autoRotate ? "Pause rotation" : "Fortsæt rotation"}
            aria-label={autoRotate ? "Pause rotation" : "Fortsæt rotation"}
          >
            {autoRotate ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="2" y="1" width="3.5" height="12" rx="1" />
                <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <polygon points="3,1 13,7 3,13" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-faded/30 bg-parchment-light text-faded-dark shadow-sm transition-colors hover:text-ink"
            title={isFullscreen ? "Luk fuldskærm (ESC)" : "Fuldskærm"}
            aria-label={isFullscreen ? "Luk fuldskærm" : "Fuldskærm"}
          >
            {isFullscreen ? (
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 1.5V6H1.5M9 1.5V6h4.5M6 13.5V9H1.5M9 13.5V9h4.5" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1.5 5.5v-4h4M13.5 5.5v-4h-4M1.5 9.5v4h4M13.5 9.5v4h-4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {hovered?.example && (
        <p className="mt-2 font-body text-body-sm italic text-faded-dark">
          «{hovered.example}»
          {hovered.exampleLetterId != null && (
            <span className="not-italic">
              {" "}—{" "}
              <Link href={`/breve/${hovered.exampleLetterId}/`} className="text-wax-red underline">
                brev {hovered.exampleLetterId}
              </Link>
            </span>
          )}
        </p>
      )}
    </div>
  );
}
