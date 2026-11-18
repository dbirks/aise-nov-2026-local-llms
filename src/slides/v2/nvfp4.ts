import type { Slide } from '../../deck/types';
import { head } from './_ch';

// PLACEHOLDER until P3 builds the 3D variants. evidence: MECHANISM (verify against NVIDIA docs in P2)
export const slides: Slide[] = [{
  id: "nvfp4",
  type: 'list',
  header: head(4),
  title: "How NVFP4 packs a block",
  items: ["16 values share one FP8 scale.", "Each value gets 4 bits: a sign, two exponent bits and one mantissa bit."],
  example: true,
  notes: "evidence: MECHANISM (verify against NVIDIA docs in P2)",
}];
