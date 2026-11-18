import type { Slide } from '../../deck/types';
import { head } from './_ch';

// PLACEHOLDER until P3 builds the 3D variants. evidence: SPEAKER OBSERVATION
export const slides: Slide[] = [{
  id: "setup-egpu",
  type: 'list',
  header: head(3),
  title: "My work laptop has to stay my work laptop",
  items: ["Client work runs in Windows and WSL, and the data can’t leave the laptop.", "So the GPU sits in an external enclosure on Thunderbolt 4."],
  example: true,
  notes: "evidence: SPEAKER OBSERVATION",
}];
