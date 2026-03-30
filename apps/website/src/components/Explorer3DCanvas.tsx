"use client";

import { useRef, useMemo, useState, useCallback, useEffect } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import ExplorerTooltip from "./ExplorerTooltip";
import {
  getTimeColor,
  getRecipientColor,
  getSentimentColor,
  getClusterColor,
} from "@/lib/explorer-colors";
import type { ColorMode } from "./ExplorerCanvas";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Point3D {
  id: number;
  x: number;
  y: number;
  z: number;
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

export interface Explorer3DCanvasProps {
  points: Point3D[];
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

/** Map a [0,1] coordinate to [-5, 5] world space, centered at origin. */
function toWorld(v: number): number {
  return v * 10 - 5;
}

function buildLetterMap(letters: LetterSummary[]): Map<number, LetterSummary> {
  const map = new Map<number, LetterSummary>();
  for (const l of letters) map.set(l.id, l);
  return map;
}

function getColorForPoint(
  id: number,
  letterMap: Map<number, LetterSummary>,
  colorMode: ColorMode,
  sentiments: Record<string, { cvp_mean?: number }>,
  clusters: ClusterData
): string {
  const letter = letterMap.get(id);
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
}

/* ------------------------------------------------------------------ */
/*  Shared geometry and material (module-level singletons)             */
/* ------------------------------------------------------------------ */

const SPHERE_GEO = new THREE.SphereGeometry(0.05, 24, 16);
const MATERIAL = new THREE.MeshLambertMaterial();

/* ------------------------------------------------------------------ */
/*  PointCloud — instanced mesh of spheres                             */
/* ------------------------------------------------------------------ */

interface PointCloudProps {
  points: Point3D[];
  letterMap: Map<number, LetterSummary>;
  colorMode: ColorMode;
  sentiments: Record<string, { cvp_mean?: number }>;
  clusters: ClusterData;
  isAnimating: boolean;
  animationDate: Date | null;
  hoveredIndex: number | null;
  onHoverChange: (index: number | null) => void;
  onPointClick: (id: number) => void;
}

function PointCloud({
  points,
  letterMap,
  colorMode,
  sentiments,
  clusters,
  isAnimating,
  animationDate,
  hoveredIndex,
  onHoverChange,
  onPointClick,
}: PointCloudProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  // Keep refs to avoid stale closures in useFrame
  const colorModeRef = useRef(colorMode);
  const sentimentsRef = useRef(sentiments);
  const clustersRef = useRef(clusters);
  const hoveredRef = useRef(hoveredIndex);
  useEffect(() => {
    colorModeRef.current = colorMode;
    sentimentsRef.current = sentiments;
    clustersRef.current = clusters;
    hoveredRef.current = hoveredIndex;
  });

  /** Pre-compute animation alpha per point (memoised on deps). */
  const animationAlphas = useMemo(() => {
    if (!isAnimating || !animationDate) return null;
    const cutoff = animationDate.getTime();
    return points.map((p) => {
      const letter = letterMap.get(p.id);
      if (!letter?.date) return 0.85;
      return new Date(letter.date).getTime() <= cutoff ? 0.85 : 0.1;
    });
  }, [points, letterMap, isAnimating, animationDate]);

  /** Update instance transforms and colors every frame. */
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const alpha = animationAlphas ? animationAlphas[i] : 0.85;
      const isHovered = i === hoveredRef.current;
      const scale = alpha < 0.5 ? 0.5 : isHovered ? 1.5 : 1.0;

      dummy.position.set(toWorld(p.x), toWorld(p.y), toWorld(p.z));
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const hslStr = getColorForPoint(
        p.id,
        letterMap,
        colorModeRef.current,
        sentimentsRef.current,
        clustersRef.current
      );
      tempColor.setStyle(hslStr);

      // Emissive-like highlight on hover
      if (isHovered) {
        tempColor.lerp(new THREE.Color(1, 1, 1), 0.25);
      }

      // Dim faded-out (future) points during animation
      if (alpha < 0.5) {
        tempColor.multiplyScalar(0.4);
      }

      mesh.setColorAt(i, tempColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined) {
        onHoverChange(e.instanceId);
        document.body.style.cursor = "pointer";
      }
    },
    [onHoverChange]
  );

  const handlePointerOut = useCallback(() => {
    onHoverChange(null);
    document.body.style.cursor = "default";
  }, [onHoverChange]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined && e.instanceId < points.length) {
        onPointClick(points[e.instanceId].id);
      }
    },
    [points, onPointClick]
  );

  if (points.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[SPHERE_GEO, MATERIAL, points.length]}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  HoverOverlay — drei <Html> tooltip at 3D position                  */
/* ------------------------------------------------------------------ */

interface HoverOverlayProps {
  point: Point3D;
  letter: LetterSummary;
  sentiment: number;
  clusterLabel: string;
}

function HoverOverlay({
  point,
  letter,
  sentiment,
  clusterLabel,
}: HoverOverlayProps) {
  return (
    <Html
      position={[toWorld(point.x), toWorld(point.y), toWorld(point.z)]}
      distanceFactor={10}
      zIndexRange={[100, 0]}
      style={{ pointerEvents: "none" }}
    >
      <ExplorerTooltip
        x={14}
        y={-10}
        date={letter.date}
        sender={letter.sender}
        recipient={letter.recipient}
        place={letter.place}
        sentiment={sentiment}
        clusterLabel={clusterLabel}
      />
    </Html>
  );
}

/* ------------------------------------------------------------------ */
/*  Scene — internal component rendered inside <Canvas>                */
/* ------------------------------------------------------------------ */

interface SceneProps extends Explorer3DCanvasProps {
  hoveredIndex: number | null;
  onHoverChange: (index: number | null) => void;
  autoRotate: boolean;
}

function Scene({
  points,
  letters,
  sentiments,
  clusters,
  colorMode,
  isAnimating,
  animationDate,
  hoveredIndex,
  onHoverChange,
  autoRotate,
}: SceneProps) {
  const letterMap = useMemo(() => buildLetterMap(letters), [letters]);

  const handlePointClick = useCallback((id: number) => {
    window.location.href = `/letters/${id}/`;
  }, []);

  /* Resolve tooltip data for the hovered point */
  const hoveredPoint =
    hoveredIndex !== null && hoveredIndex < points.length
      ? points[hoveredIndex]
      : null;
  const hoveredLetter =
    hoveredPoint ? letterMap.get(hoveredPoint.id) ?? null : null;
  const hoveredSentiment =
    hoveredPoint
      ? (sentiments[String(hoveredPoint.id)]?.cvp_mean ?? 0)
      : 0;
  const hoveredClusterId =
    hoveredPoint
      ? (clusters.assignments[String(hoveredPoint.id)] ?? 0)
      : 0;
  const hoveredClusterLabel =
    clusters.clusters.find((c) => c.id === hoveredClusterId)?.label ?? "";

  return (
    <>
      {/* Lighting: strong ambient + point lights for vivid instance colors */}
      <ambientLight intensity={0.8} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-8, -5, 5]} intensity={0.8} />

      {/* Subtle fog to enhance depth — fades to parchment background */}
      {/* <fog attach="fog" args={["#201718", 15, 35]} /> */}

      <OrbitControls
        autoRotate={autoRotate}
        autoRotateSpeed={1}
        enableDamping
        dampingFactor={0.1}
        minDistance={3}
        maxDistance={25}
        rotateSpeed={0.8}
        zoomSpeed={0.8}
        panSpeed={0.5}
      />

      {/* Grid plane beneath the point cloud */}
      <gridHelper
        args={[18, 18, "#4b4844", "#442674"]}
        position={[0, -5.5, 0]}
        rotation={[0, 0, 0]}
      />

      <PointCloud
        points={points}
        letterMap={letterMap}
        colorMode={colorMode}
        sentiments={sentiments}
        clusters={clusters}
        isAnimating={isAnimating}
        animationDate={animationDate}
        hoveredIndex={hoveredIndex}
        onHoverChange={onHoverChange}
        onPointClick={handlePointClick}
      />

      {hoveredPoint && hoveredLetter && (
        <HoverOverlay
          point={hoveredPoint}
          letter={hoveredLetter}
          sentiment={hoveredSentiment}
          clusterLabel={hoveredClusterLabel}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Explorer3DCanvas — top-level exported component                    */
/* ------------------------------------------------------------------ */

export default function Explorer3DCanvas(props: Explorer3DCanvasProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  if (props.points.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="font-ui text-faded">Indlæser 3D-data…</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [8, 3, 22], fov: 50, near: 0.1, far: 100 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
        scene={{ background: new THREE.Color("#2c2922") }}
      >
        <Scene
          {...props}
          hoveredIndex={hoveredIndex}
          onHoverChange={setHoveredIndex}
          autoRotate={autoRotate}
        />
      </Canvas>
      <button
        type="button"
        onClick={() => setAutoRotate((r) => !r)}
        className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
        title={autoRotate ? "Pause rotation" : "Resume rotation"}
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
    </div>
  );
}
