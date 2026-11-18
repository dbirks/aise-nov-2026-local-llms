import type { Slide } from '../../deck/types';
import { head } from './_ch';

// evidence: MECHANISM
export const slides: Slide[] = [{
  id: "gguf",
  type: 'list',
  header: head(4),
  title: "GGUF comes in many sizes of the same model",
  items: ["One model, many bit-widths: Q8, Q6, Q4, and lower.", "GGUF releases often go smaller than other formats."],
  notes: "evidence: MECHANISM",
}];
