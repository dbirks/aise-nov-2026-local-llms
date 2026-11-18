import type { Slide } from '../../deck/types';
import { head } from './_ch';

// PLACEHOLDER until P3 builds the 3D variants. evidence: SYNTHETIC DEMO (3D coordinates). open: exact hidden_size from config.json.
export const slides: Slide[] = [{
  id: "embed-vec",
  type: 'list',
  header: head(4),
  title: "Each word becomes a list of numbers",
  items: ["Here, three numbers each, so we can plot them.", "In a model like Qwen3.8-27B it’s thousands of numbers per token."],
  example: true,
  notes: "evidence: SYNTHETIC DEMO (3D coordinates). open: exact hidden_size from config.json.",
}];
