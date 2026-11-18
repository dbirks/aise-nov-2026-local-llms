// Illustrative weight payloads, not complete files; Q4_K_M is a checkpoint-dependent example.
import { THREE, lam, M, Q, P, S, ease, emitter, rng } from './_kit.js';

export default function build(scene, emit) {
  const out = emitter(emit), box = new THREE.BoxGeometry(1, 1, 1);
  const dark = lam(0x222222), mid = lam(0x666666), pale = lam(0xcacaca);
  const mesh = (mat, x, y, z, w, h, d) => {
    const m = new THREE.Mesh(box, mat); m.position.set(x, y, z); m.scale.set(w, h, d); scene.add(m); return m;
  };
  function label(text, x, y, z, h = 0.32) {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = 'bold 72px sans-serif'; c.width = Math.ceil(g.measureText(text).width) + 20; c.height = 90;
    g.font = 'bold 72px sans-serif'; g.fillStyle = '#111'; g.textBaseline = 'middle'; g.fillText(text, 10, 45);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, depthWrite: false }));
    s.scale.set(h * c.width / c.height, h, 1); s.position.set(x, y, z); s.renderOrder = 10; scene.add(s); return s;
  }
  const rand = rng(505), values = Array.from({ length: 64 }, () => 0.08 + rand() * 0.92);
  const heights = values.slice(), cubes = new THREE.InstancedMesh(box, dark, 64); cubes.frustumCulled = false; scene.add(cubes);
  label('toy weight tensor', 0, 4.2, -0.6, 0.4);
  const crates = [-2.05, 2.05].map((x, i) => {
    const body = mesh(pale, x, 0.72, 0, 3.5, 0.65, 0.8);
    const rim = mesh(dark, x, 1.07, 0, 3.5, 0.06, 0.84);
    const bar = mesh(dark, x, 0.3, 0.55, 3.5, 0.1, 0.12);
    label(i ? 'safetensors' : 'GGUF', x, 1.48, 0, 0.38);
    label('bits / weight', x, 0.08, 0.55, 0.29);
    return { body, rim, bar, x };
  });
  const schemes = [
    [label('F16', -2.05, 0.76, 0.48), label('Q8_0', -2.05, 0.76, 0.48), label('Q4_K_M', -2.05, 0.76, 0.48)],
    [label('BF16', 2.05, 0.76, 0.48), label('FP8', 2.05, 0.76, 0.48), label('INT4 W4A16', 2.05, 0.76, 0.48), label('NVFP4', 2.05, 0.76, 0.48)],
  ];
  const fp4Status = [label('NVFP4 off', 2.05, -0.28, 0.55, 0.27), label('NVFP4 on', 2.05, -0.28, 0.55, 0.27)];
  label('check per model + version', 0, -0.7, 1.2, 0.3);
  ['llama.cpp', 'vLLM', 'SGLang'].forEach((name, i) => {
    const x = (i - 1) * 2.15;
    mesh(i === 0 ? dark : mid, x, -1.15, 1.3, 1.8, 0.1, 0.5);
    label(name, x, -1.42, 1.3, 0.31);
  });
  let scheme = 'fp16', fp4 = false, playing = true, time = 0, beat = 0;
  const names = ['fp16', 'q8', 'q4'];
  function advance() { beat = (beat + 1) % 3; scheme = names[beat]; time = 0; }
  return {
    view: { target: [0, 1.3, 0], radius: 40, theta: 0.15, phi: 1.13, size: 4.1 },
    update(dt) {
      if (playing && (time += dt) > 3.5) advance();
      const index = names.indexOf(scheme), bits = scheme === 'fp16' ? [16, 16] : scheme === 'q8' ? [8.5, 8] : [4.8, fp4 ? 4.5 : 4.125];
      fp4Status[0].visible = !fp4; fp4Status[1].visible = fp4;
      schemes.forEach((group, side) => group.forEach((s, i) => { s.visible = i === (side && index === 2 && fp4 ? 3 : index); }));
      for (let i = 0; i < 64; i++) {
        const v = values[i], target = index === 0 ? v : Math.round(v * (index === 1 ? 31 : 7)) / (index === 1 ? 31 : 7);
        heights[i] += (target - heights[i]) * ease(dt, 7);
        const h = 0.12 + heights[i] * 1.1;
        cubes.setMatrixAt(i, M.compose(P.set((i % 8 - 3.5) * 0.32, 2.0 + h / 2, (Math.floor(i / 8) - 3.5) * 0.25 - 0.2), Q, S.set(0.27, h, 0.2)));
      }
      cubes.instanceMatrix.needsUpdate = true;
      crates.forEach((c, i) => {
        const width = 3.5 * bits[i] / 16;
        for (const m of [c.body, c.rim, c.bar]) { m.scale.x += (width - m.scale.x) * ease(dt, 6); m.position.x = c.x - 1.75 + m.scale.x / 2; }
      });
      const suffix = fp4 ? 'nvfp4' : 'int4 g128';
      out({ playing, readout: scheme === 'q4' ? `4-bit · gguf ~4.8 b/w · ${suffix} ${fp4 ? '4.5' : '~4.1'} b/w · same source tensor` : `${scheme === 'q8' ? '8-bit · gguf 8.5 · fp8 8' : 'fp16 · f16 16 · bf16 16'} b/w · nvfp4 ${fp4 ? 'on' : 'off'}` });
    },
    action(name, arg) {
      if (name === 'play') playing = !playing;
      else if (name === 'step') { playing = false; advance(); }
      else if (name === 'scheme' && names.includes(String(arg)) && scheme !== arg) { scheme = String(arg); beat = names.indexOf(scheme); playing = false; time = 0; }
      else if (name === 'fp4' && fp4 !== Boolean(arg)) { fp4 = Boolean(arg); playing = false; }
    },
  };
}
