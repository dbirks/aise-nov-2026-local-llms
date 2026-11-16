// Splat proc: `qwen-kvcache` — an illustrative paged KV-cache ribbon, built live in the browser
// from Spark procedural splats and animated per frame with SplatMesh.onFrame (no file, no bake).
//
// Mechanism it stands for: the KV cache is managed as PAGES, not one contiguous slab. Blocks are
// allocated in chunks along the token axis and shared by every layer; a page can sit in the pool
// allocated-but-empty. The picture grows along x = "more tokens = more pages used", and shows the
// not-yet-filled part of the pool as faint outlines — so "long context" is NOT the same as "the
// whole cache is filled/occupied."
//
// Layout: rows = 8 model layers (y). columns along x = blocks of 16 tokens each (24 blocks wide).
// Each block is a slab of flat splats drawn as a small cuboid (light top, mid front, dark side).
//   FILLED pages .......... DARK  (0.08..0.16) — occupied, reads as a solid wall
//   ALLOCATED-BUT-EMPTY ... LIGHT outline (0.8) — the free pool, deliberately faint
// The boundary between them is the allocation frontier.
//
// Animation: two SplatMeshes share one onFrame clock. Filled splats are stored in growth order so
// revealing a PREFIX of that mesh grows the dark frontier along x; outline splats are stored in
// reverse order so shrinking ITS prefix leaves only the pages ahead of the frontier. Per frame we
// only set two integer counts — O(1), no re-bake. The ribbon grows, holds, and loops.
//
// Illustrative: invented block count / size / occupancy; no real engine numbers.
// Axes: x = token order (blocks of 16), y = layer rows, z = depth.
import type { SplatProc } from './index';
import type { PackedSplats, SplatMesh } from '@sparkjsdev/spark';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROWS = 8;            // layers
const NCOL = 16;           // token-blocks along the ribbon (each block = 16 tokens, illustrative)
const PITCHX = 0.25;       // column pitch (block + gap)
const PITCHY = 0.46;       // row pitch
const BW = 0.19, BD = 0.5, BH = 0.3; // block slab dimensions
const THICK = 0.022;       // surface-splat thin axis
const PERIOD = 11;         // seconds per grow/shrink loop
const FILL_MIN = 4, FILL_MAX = 15; // frontier always between these so the shot always shows contrast

const proc: SplatProc = async ({ spark, THREE }) => {
  const center = new THREE.Vector3();
  const scales = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const color = new THREE.Color();
  const rand = rng(90210);

  const disc = (
    splats: PackedSplats, x: number, y: number, z: number,
    r1: number, r2: number, normal: 0 | 1 | 2, gray: number, opacity: number,
  ) => {
    const inPlane = normal === 0 ? [1, 2] : normal === 1 ? [0, 2] : [0, 1];
    scales.set(0, 0, 0);
    scales.setComponent(inPlane[0], r1);
    scales.setComponent(inPlane[1], r2);
    scales.setComponent(normal, THICK);
    center.set(x, y, z);
    color.setRGB(gray, gray, gray);
    splats.pushSplat(center, scales, q, opacity, color);
  };

  // Filled block = a small cuboid: light top, mid front (+z), dark side (+x). Constant splat count.
  const GX = 4, GZ = 8, GY = 4;
  const FILLED_PER = GX * GZ + GX * GY + GZ * GY; // top + front + side
  const filledBlock = (splats: PackedSplats, cx: number, cy: number, cz: number, layer: number) => {
    const top = 0.19 + layer * 0.008;            // subtle per-layer lift so rows separate
    const front = 0.1, side = 0.05;
    for (let i = 0; i < GX; i++) for (let k = 0; k < GZ; k++) {
      const px = cx - BW / 2 + ((i + 0.5) / GX) * BW + (rand() - 0.5) * 0.008;
      const pz = cz - BD / 2 + ((k + 0.5) / GZ) * BD + (rand() - 0.5) * 0.008;
      disc(splats, px, cy + BH / 2, pz, BW / GX * 0.7, BD / GZ * 0.7, 1, top, 1.0);
    }
    for (let i = 0; i < GX; i++) for (let j = 0; j < GY; j++) {
      const px = cx - BW / 2 + ((i + 0.5) / GX) * BW;
      const py = cy - BH / 2 + ((j + 0.5) / GY) * BH;
      disc(splats, px, py, cz + BD / 2, BW / GX * 0.7, BH / GY * 0.7, 2, front, 1.0);
    }
    for (let k = 0; k < GZ; k++) for (let j = 0; j < GY; j++) {
      const pz = cz - BD / 2 + ((k + 0.5) / GZ) * BD;
      const py = cy - BH / 2 + ((j + 0.5) / GY) * BH;
      disc(splats, cx + BW / 2, py, pz, BD / GZ * 0.7, BH / GY * 0.7, 0, side, 1.0);
    }
  };

  // Empty-page outline = a light wireframe ring on the block's top footprint. Constant count.
  const OX = 5, OZ = 9;
  const OUT_PER = 2 * OX + 2 * OZ;
  const outlineBlock = (splats: PackedSplats, cx: number, cy: number, cz: number) => {
    const gy = cy + BH / 2;
    for (let i = 0; i < OX; i++) {
      const px = cx - BW / 2 + (i / (OX - 1)) * BW;
      disc(splats, px, gy, cz - BD / 2, 0.018, 0.018, 1, 0.82, 0.85);
      disc(splats, px, gy, cz + BD / 2, 0.018, 0.018, 1, 0.82, 0.85);
    }
    for (let k = 0; k < OZ; k++) {
      const pz = cz - BD / 2 + (k / (OZ - 1)) * BD;
      disc(splats, cx - BW / 2, gy, pz, 0.018, 0.018, 1, 0.82, 0.85);
      disc(splats, cx + BW / 2, gy, pz, 0.018, 0.018, 1, 0.82, 0.85);
    }
  };

  const colX = (c: number) => -2.0 + (c + 0.5) * PITCHX;
  const rowY = (r: number) => -((ROWS - 1) / 2) * PITCHY + r * PITCHY;

  // onFrame drives both meshes off one clock. filled/outline assigned below before any frame runs.
  let filled: SplatMesh | undefined;
  let outline: SplatMesh | undefined;
  const PER_COL_FILLED = FILLED_PER * ROWS;
  const PER_COL_OUTLINE = OUT_PER * ROWS;
  const onFrame = ({ time }: { time: number }) => {
    if (!filled?.packedSplats || !outline?.packedSplats) return;
    const cyc = (time % PERIOD) / PERIOD;                 // 0..1
    // Smooth ping-pong frontier: grows to FILL_MAX then recedes to FILL_MIN and loops, so every
    // frame (and every screenshot) shows both the dark filled pages and the faint empty outlines.
    const tri = 0.5 - 0.5 * Math.cos(2 * Math.PI * cyc);  // 0..1..0 eased
    const reveal = Math.round(FILL_MIN + (FILL_MAX - FILL_MIN) * tri);
    filled.packedSplats.numSplats = reveal * PER_COL_FILLED;
    outline.packedSplats.numSplats = (NCOL - reveal) * PER_COL_OUTLINE;
  };

  const filledMesh = new spark.SplatMesh({
    constructSplats: splats => {
      for (let c = 0; c < NCOL; c++)          // growth order: column by column
        for (let r = 0; r < ROWS; r++)
          filledBlock(splats, colX(c), rowY(r), 0, r);
    },
    onFrame,
  });
  const outlineMesh = new spark.SplatMesh({
    constructSplats: splats => {
      for (let c = NCOL - 1; c >= 0; c--)      // REVERSE order: prefix = the pages ahead
        for (let r = 0; r < ROWS; r++)
          outlineBlock(splats, colX(c), rowY(r), 0);
    },
  });
  filled = filledMesh;
  outline = outlineMesh;

  const group = new THREE.Group();
  group.add(filledMesh, outlineMesh);
  await Promise.all([filledMesh.initialized, outlineMesh.initialized]);
  return group;
};

export default proc;
