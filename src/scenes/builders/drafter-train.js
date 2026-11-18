import { THREE, lam, ease, emitter } from './_kit.js';

export default function build(scene, emit) {
  const out = emitter(emit);
  const dark = lam(0x1b1b1b), mid = lam(0x777777), pale = lam(0xd8d8d8);
  const box = (x, y, w, h, d, mat = dark, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); scene.add(m); return m;
  };
  const label = (text, x, y, h = 0.3) => {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = 'bold 72px sans-serif'; const w = Math.ceil(g.measureText(text).width) + 20;
    c.width = w; c.height = 90; g.font = 'bold 72px sans-serif'; g.fillStyle = '#111';
    g.textBaseline = 'middle'; g.fillText(text, 10, 45);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
    s.scale.set(h * w / 90, h, 1); s.position.set(x, y, 1.2); scene.add(s); return s;
  };
  const xs = [-3.6, -2.16, -0.72, 0.72, 2.16, 3.6];
  const names = ['trajectories', 'rollouts', 'hidden states', 'train', 'convert', 'serve (vLLM)'];
  names.forEach((n, i) => label(n, xs[i], i % 2 === 0 ? 0.55 : 0.1, 0.28));  // two staggered rows above the stations
  box(0, -1.05, 8.6, 0.08, 1.2, mid);
  for (let j = 0; j < 3; j++) box(xs[0] + j * 0.08, -0.76 + j * 0.12, 0.8, 0.08, 0.6, dark);
  box(xs[1], -0.65, 1, 0.65, 0.55); label('target', xs[1], -0.65, 0.22).material.color.setHex(0xffffff);
  box(xs[2], -0.66, 1, 0.16, 0.6);
  for (let i = 0; i < 5; i++) box(xs[2] - 0.36 + i * 0.18, -0.53, 0.05, 0.2, 0.08, mid);
  box(xs[3], -0.7, 0.7, 0.52, 0.5);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 6, 20, Math.PI * 1.5), mid); ring.position.set(xs[3], -0.7, 0.4); scene.add(ring);
  box(xs[4], -0.7, 0.8, 0.45, 0.5, mid);
  label('convert (#72)', xs[4], -1.35, 0.23);
  box(xs[5] - 0.3, -0.7, 0.52, 0.55, 0.5); box(xs[5] + 0.35, -0.7, 0.38, 0.38, 0.5, mid);
  label('target + draft', xs[5], -1.35, 0.23);
  const packet = box(xs[0], -0.9, 0.15, 0.15, 0.18);
  label('reference tokens', 2.3, 2.4, 0.36); label('draft slots', 2.3, 1.02, 0.36);
  const slots = [], links = [];
  for (let i = 0; i < 6; i++) {
    const x = 0.8 + i * 0.6;
    box(x, 2.02, 0.455, 0.234, 0.208, mid);
    const tile = box(x, 1.43, 0.52, 0.442, 0.234); slots.push(tile);
    const link = box(x, 1.74, 0.045, 0.36, 0.08); links.push(link);
  }
  const marks = [];
  for (let i = 2; i < 6; i++) {
    const mark = box(0.8 + i * 0.6, 1.43, 0.48, 0.045, 0.08, dark, 0.2); mark.rotation.z = 0.65; marks.push(mark);
  }
  const issues = ['50', '51', '59', '60', '69', '72', '80'];
  const topics = ['first plan', 'nvfp4 plan', 'pipeline + bugs', 'corrected recipe', 'data corpus', 'serve + convert', 'agentic test'];
  const ticks = [], details = [];
  box(0, -2.25, 8.2, 0.06, 0.1, dark);
  issues.forEach((n, i) => {
    const x = -3.9 + i * 1.3;
    ticks.push(box(x, -2.25, 0.07, 0.25, 0.1, mid));
    label('#' + n, x, -2.58, 0.26);
    details.push(label(topics[i], x, -1.91, 0.22));
  });
  const figures = [label('546k rows · 2d16h', 2.6, -3.0, 0.26), label('215,154 rows · 1.617', 3.0, -3.35, 0.26), label('baseline ~1.66', 3.0, -3.7, 0.26)];
  let mode = 'teacher', stage = 'pipeline', playing = true, time = 0, step = false, displayed = 0;
  return {
    view: { target: [0.25, -0.5, 0], radius: 40, theta: 0.05, phi: 1.15, size: 3.0 },
    update(dt) {
      if (step) { time = (Math.floor(time) + 1) % 10; step = false; playing = false; }
      if (playing) time = (time + dt) % 10;
      displayed += (time - displayed) * ease(dt, 6);
      packet.position.x = -4.2 + Math.min(displayed / 8, 1) * 8.25;
      ring.rotation.z = -displayed;
      slots.forEach((tile, i) => {
        const bad = mode === 'free' && i >= 2;
        tile.material = bad ? pale : dark;
        tile.scale.setScalar(i < Math.floor(time / 1.15) ? 1 : 0.3);
        links[i].rotation.z = mode === 'teacher' ? 0 : Math.PI / 2;
        links[i].position.set(0.8 + i * 0.6 - (mode === 'free' ? 0.3 : 0), mode === 'teacher' ? 1.74 : 1.43, 0.3);
      });
      marks.forEach(m => { m.visible = mode === 'free'; });
      details.forEach(d => { d.visible = stage === 'results'; });
      figures.forEach(d => { d.visible = stage === 'results'; });
      ticks.forEach(t => { t.material = stage === 'results' ? dark : mid; });
      out({ playing, readout: `${mode === 'teacher' ? 'teacher-forced · 6 of 6 toy slots' : 'free-running · 2 of 6 toy slots'} · ${stage === 'results' ? 'served 1.617 (#80)' : 'pipeline'}` });
    },
    action(name, arg) {
      if (name === 'play') playing = !playing;
      else if (name === 'step') step = true;
      else if (name === 'mode' && (arg === 'teacher' || arg === 'free')) { mode = arg; time = 0; }
      else if (name === 'stage' && (arg === 'pipeline' || arg === 'results')) stage = arg;
      else if (name === 'reset') { time = 0; displayed = 0; }
    },
  };
}
