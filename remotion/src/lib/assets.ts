import { createContext, useContext } from "react";
import { staticFile } from "remotion";

// Where user media and voiceover files live under remotion/public/. Real renders use "data" (a
// symlink to the server's data folder, created at render time). The checked-in demo uses "demo"
// (remotion/public/demo/). Only these two values are ever honoured, so a prop can't point
// rendering at some other part of the disk.
export type AssetBase = "data" | "demo";
export const resolveAssetBase = (value: unknown): AssetBase => (value === "demo" ? "demo" : "data");

export const AssetBaseContext = createContext<AssetBase>("data");

export function assetUrl(base: AssetBase, relPath: string): string {
  return staticFile(`${base}/${relPath}`);
}

export function useAssetUrl(): (relPath: string) => string {
  const base = useContext(AssetBaseContext);
  return (relPath) => assetUrl(base, relPath);
}
