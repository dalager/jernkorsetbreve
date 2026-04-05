/** Convert a registry path (e.g. "portrait/page001_02.png") to optimized WebP URLs. */
export function thumbSrc(registryPath: string): string {
  return `/images/letters/thumb/${registryPath.replace(/\.png$/i, ".webp")}`;
}

export function fullSrc(registryPath: string): string {
  return `/images/letters/full/${registryPath.replace(/\.png$/i, ".webp")}`;
}
