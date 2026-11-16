// Procedural splat generators: every file in this folder (except index.ts) default-exports a SplatProc.
// The file name (without .ts) is the `proc` key used by SplatSlide.
import type * as Spark from '@sparkjsdev/spark';
import type * as THREE from 'three';

export interface SplatProcContext {
  spark: typeof Spark;
  THREE: typeof THREE;
}

/** Build and return a SplatMesh (or any Object3D containing SplatMeshes). May be async. */
export type SplatProc = (ctx: SplatProcContext) => THREE.Object3D | Promise<THREE.Object3D>;

const mods = import.meta.glob<{ default: SplatProc }>('./*.ts', { eager: true });

export const splatProcs: Record<string, SplatProc> = Object.fromEntries(
  Object.entries(mods)
    .filter(([k]) => !k.endsWith('/index.ts'))
    .map(([k, m]) => [k.replace(/^\.\//, '').replace(/\.ts$/, ''), m.default]),
);
