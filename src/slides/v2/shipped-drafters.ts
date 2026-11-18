import type { Slide } from '../../deck/types';
import { head } from './_ch';

// evidence: OPEN / VERSION-DEPENDENT. Name releases only with sources.
export const slides: Slide[] = [{
  id: "shipped-drafters",
  type: 'list',
  header: head(7),
  title: "Model makers now ship a matched drafter",
  items: ["The drafter is trained against that exact model.", "Which releases include one changes month to month."],
  notes: "evidence: OPEN / VERSION-DEPENDENT. Name releases only with sources.",
}];
