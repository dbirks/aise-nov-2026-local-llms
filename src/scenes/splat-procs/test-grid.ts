// Splat proc: `test-grid` — a 20×20×20 cubic lattice of tiny Gaussians, dark at the bottom and
// light at the top. Pure browser procedural data (Spark's PackedSplats.pushSplat), no trained
// asset, so it is the honest control for the pixel pipeline: any colour in the output would be a
// bug in the post shader, not in the splats.
import type { SplatProc } from './index';

const N = 20;          // splats per edge → N³ = 8000
const EDGE = 4;        // world units of the cube
const RADIUS = 0.06;   // Gaussian scale of one splat (all three axes)

const proc: SplatProc = ({ spark, THREE }) => {
  const center = new THREE.Vector3();
  const scales = new THREE.Vector3(RADIUS, RADIUS, RADIUS);
  const quaternion = new THREE.Quaternion();
  const color = new THREE.Color();
  const step = EDGE / (N - 1);
  const half = EDGE / 2;

  return new spark.SplatMesh({
    constructSplats: splats => {
      for (let iy = 0; iy < N; iy++) {
        // 0 at the bottom, 1 at the top: the luminance ramp the post shader should quantize.
        const up = iy / (N - 1);
        const gray = 0.08 + up * 0.87;
        color.setRGB(gray, gray, gray);
        for (let iz = 0; iz < N; iz++) {
          for (let ix = 0; ix < N; ix++) {
            center.set(-half + ix * step, -half + iy * step, -half + iz * step);
            splats.pushSplat(center, scales, quaternion, 1.0, color);
          }
        }
      }
    },
  });
};

export default proc;
