import type { Slide } from '../../deck/types';
import { head } from './_ch';

// evidence: MECHANISM
export const slides: Slide[] = [{
  id: "engines",
  type: 'list',
  header: head(2),
  title: "An inference engine serves the weights",
  items: ["llama.cpp, vLLM, SGLang and Ollama are engines. They load the weights and answer requests.", "GGUF and safetensors are file formats. They hold the weights; they don’t run anything."],
  notes: "evidence: MECHANISM",
}];
