import type { Slide } from '../../deck/types';
import { head } from './_ch';

// opening
export const slides: Slide[] = [{
  id: "open",
  type: 'list',
  header: head(0),
  title: "Six months of running models at home and at work",
  items: ["What I learned, roughly in the order I learned it", "Terms get defined as they come up"],
  notes: "opening",
}];
