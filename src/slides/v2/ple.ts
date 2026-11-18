import type { Slide } from '../../deck/types';
import { head } from './_ch';

// PLACEHOLDER until P3 builds the 3D variants. evidence: MECHANISM (Gemma 3n; verify in P2)
export const slides: Slide[] = [{
  id: "ple",
  type: 'list',
  header: head(8),
  title: "PLE: per-layer embeddings",
  items: ["Each layer gets its own small lookup per token.", "Those tables can live off the GPU, so less of the model sits in VRAM."],
  example: true,
  notes: "evidence: MECHANISM (Gemma 3n; verify in P2)",
}];
