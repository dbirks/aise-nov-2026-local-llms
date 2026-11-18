import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';

export const slide: Slide = {
  id: 'b05', type: 'scene', scene: 'formats', chip: chip(1),
  caption: { title: 'A file format is not a diet', body: 'GGUF and safetensors are containers for the same kind of weight tensors. The file gets smaller because the numbers inside are quantized, not because of the extension.' },
  controls: [
    { kind: 'choice', action: 'scheme', label: 'precision', options: [{ label: 'fp16', value: 'fp16' }, { label: '8-bit', value: 'q8' }, { label: '4-bit', value: 'q4' }], initial: 'fp16' },
    { kind: 'toggle', action: 'fp4', label: 'nvfp4 instead of int4', initial: false },
  ],
  notes: meta({
    id: 'B05', claim: 'A file format is not a quantization scheme; stored weight precision determines the payload.',
    evidence: ['MECHANISM', 'SYNTHETIC DEMO', 'OPEN / VERSION-DEPENDENT'],
    simulated: '8×8 toy magnitudes and schematic snapping; crate lengths are illustrative payload bits per weight, not complete file sizes. F16/BF16: 16; Q8_0: 8 + 16/32 = 8.5; FP8: 8 payload bits excluding scales; Q4_K_M: ~4.8 example, varies with tensor mix; symmetric INT4 group 128 with FP16 scale: 4 + 16/128 = 4.125; NVFP4: 4 + 8/16 = 4.5 excluding global tensor scale and padding.',
    not: 'GGUF is always more compressed; GGUF is an engine; headline bit-width equals total storage; engine compatibility is universal; the two quantized reconstructions are identical.',
    open: 'Check per-model and version support, actual tensor mixes, scale types and metadata; V1/V2 comparison captures and V3 browser review remain outstanding.',
    sources: ['https://github.com/ggml-org/llama.cpp/wiki/Tensor-Encoding-Schemes', 'https://github.com/ggml-org/llama.cpp/blob/master/tools/quantize/README.md', 'https://github.com/ggml-org/llama.cpp/issues/8263', 'https://docs.vllm.ai/projects/compressed-tensors/en/latest/api/compressed_tensors/quantization/quant_args/', 'https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/quantized-types-schemes.html', 'https://docs.nvidia.com/deeplearning/transformer-engine/features/low_precision_training/nvfp4/nvfp4.html'],
  }),
};
