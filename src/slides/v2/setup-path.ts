import type { Slide } from '../../deck/types';
import { head } from './_ch';

// evidence: SPEAKER OBSERVATION
export const slides: Slide[] = [{
  id: "setup-path",
  type: 'list',
  header: head(3),
  title: "Ollama, then llama.cpp, then vLLM",
  items: ["Ollama got me running.", "Reddit threads full of flags pulled me to llama.cpp. vLLM came later."],
  notes: "evidence: SPEAKER OBSERVATION",
}];
