"use client";

import dynamic from "next/dynamic";

const MiniMap = dynamic(() => import("@/components/MiniMap"), { ssr: false });

interface MiniMapWrapperProps {
  lat: number;
  lng: number;
  placeName: string;
}

export default function MiniMapWrapper(props: MiniMapWrapperProps) {
  return <MiniMap {...props} />;
}
