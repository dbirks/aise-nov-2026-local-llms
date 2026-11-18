import type { Slide } from '../../deck/types';
import { head } from './_ch';

// PLACEHOLDER until P3 builds the 3D variants. must not imply: pooled VRAM or one model split across machines
export const slides: Slide[] = [{
  id: "collective-request",
  type: 'list',
  header: head(9),
  title: "What a request does",
  items: ["Your API key shows the models on offer at /models.", "Pick one, and the gateway sends the request to the machine running it."],
  example: true,
  notes: "must not imply: pooled VRAM or one model split across machines",
}];
