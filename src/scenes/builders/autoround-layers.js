// autoround variant C — selective BF16 (docs/research/v2/nvfp4-autoround.md, "Idea C").
// Six named parts of the speaker's Qwen3.8-27B quant, drawn as slabs:
//   slab height = stored bits (16 tall / 4 short); slab depth grows with a TOY relative size
//   (drawn with a floor so the small ones stay visible; the bar uses the exact numbers).
//   The size bar sums bits × toy size, so it is a relative footprint, not a file size.
// Which layers stay at 16 bits is the speaker's published recipe [SPEAKER OBSERVATION];
// the 20.61 / 19.47 GB figures are Hugging Face file listings [MEASURED]. No quality number
// is shown anywhere: none was measured.
import { THREE, lam, ease, emitter } from './_kit.js';

const LAYERS = [
  { name: 'attn', fp: 3.4, kept: false },
  { name: 'mlp', fp: 4.2, kept: false },
  { name: 'gates', fp: 0.08, kept: true },
  { name: 'out head', fp: 0.24, kept: true },
  { name: 'vision', fp: 0.26, kept: true },
  { name: 'mtp head', fp: 0.1, kept: true },
];
const NAMES = ['attn', 'mlp', 'gates', 'out\nhead', 'vision', 'mtp\nhead']; // 2-line where space is tight
const H16 = 1.75, H4 = 0.45;                        // slab height for 16 / 4 stored bits
const DEPTH = fp => 0.16 + 0.2 * fp;                // toy relative size, floored for legibility
const X0 = -2.35, DX = 1.25, WID = 0.66;          // slab row
const BAR0 = -2.3, BAR1 = 0.9;                      // size bar span
const FS = 72, LH = 92;                             // label canvas font px / line height

function drawLines(c, text) {
  const lines = String(text).split('\n'), g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height); g.font = `bold ${FS}px monospace`;
  g.fillStyle = '#111'; g.textBaseline = 'middle'; g.textAlign = 'center';
  lines.forEach((l, i) => g.fillText(l, c.width / 2, LH * i + LH / 2));
}

export default function build(scene, emit) {
  const out = emitter(emit), box = new THREE.BoxGeometry(1, 1, 1);
  let recipe = 'mine', playing = true, clock = 0, beat = 0;
  const cur = LAYERS.map(l => ({ h: l.kept ? H16 : H4, c: l.kept ? 0.6 : 0.13 }));

  // h = total sprite height; a 2-line label uses h ≈ 2 × single-line height
  function label(text, x, y, z, h = 0.38) {
    const lines = String(text).split('\n'), meas = document.createElement('canvas').getContext('2d');
    meas.font = `bold ${FS}px monospace`;
    const w = Math.ceil(Math.max(...lines.map(l => meas.measureText(l).width))) + 20;
    const c = document.createElement('canvas'); c.width = w; c.height = LH * lines.length;
    drawLines(c, text);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    s.scale.set(h * c.width / c.height, h, 1); s.position.set(x, y, z); s.renderOrder = 10; scene.add(s); return s;
  }
  function setText(sprite, text) {
    drawLines(sprite.material.map.image, text);
    sprite.material.map.needsUpdate = true;
  }
  const mesh = (mat, x, y, z) => { const m = new THREE.Mesh(box, mat); m.position.set(x, y, z); scene.add(m); return m; };

  // base plate under the slab row
  mesh(lam(0xc2c2c2), 0.77, -0.02, 0).scale.set(7.4, 0.03, 1.5);

  const mats = LAYERS.map(() => new THREE.MeshLambertMaterial({ color: 0x222222 }));
  const slabs = LAYERS.map((l, i) => {
    const m = mesh(mats[i], X0 + i * DX, 0, 0);
    m.scale.set(WID, cur[i].h, DEPTH(l.fp));
    return m;
  });
  const outlines = LAYERS.map((l, i) => {
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0x111111 }));
    e.position.copy(slabs[i].position); e.scale.copy(slabs[i].scale); e.renderOrder = 8; scene.add(e);
    return e;
  });
  // part names in front of the plate; 2-line labels keep them off each other (top line aligned)
  LAYERS.forEach((l, i) => {
    const two = NAMES[i].includes('\n');
    label(NAMES[i], X0 + i * DX, two ? -0.8 : -0.62, 0.6, two ? 0.74 : 0.38);
  });

  // file-listing figures, stacked top-right (kept on 3 short lines so nothing clips)
  label('nvfp4 · 20.61 GB', 2.55, 3.85, 0, 0.38);
  label('w4a16 · 19.47 GB', 2.55, 3.35, 0, 0.38);
  label('(file listing)', 2.55, 2.85, 0, 0.38);
  const keptLab = label('kept at 16 bits', 2.05, 2.15, 0, 0.38);
  label('dark: 4 bits', -1.73, 0.85, 0, 0.38);
  const track = mesh(lam(0xdedede), (BAR0 + BAR1) / 2, -1.6, 0.4);
  track.scale.set(BAR1 - BAR0, 0.16, 0.3);
  const fill = mesh(lam(0x222222), BAR0, -1.6, 0.4);
  fill.scale.set(0.02, 0.16, 0.34);
  const end = new THREE.Line(new THREE.BufferGeometry().setFromPoints(
    [new THREE.Vector3(BAR1, -1.77, 0.4), new THREE.Vector3(BAR1, -1.43, 0.4)]), new THREE.LineBasicMaterial({ color: 0x111111 }));
  scene.add(end);
  label('bf16', BAR1 + 0.4, -1.6, 0.4, 0.38);
  // dummy padded to '100% of bf16'; toy % is never >3 digits anyway
  const barLab = label('100% of bf16\ntoy sizes, not GB', -1.15, -1.98, 0.4, 0.74);
  const pulse = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0x111111 }));
  pulse.renderOrder = 9; scene.add(pulse);

  const isKept = (i) => recipe === 'mine' && LAYERS[i].kept;
  const pct = () => {
    const sum = LAYERS.reduce((t, l) => t + l.fp * 16, 0);
    const now = LAYERS.reduce((t, l, i) => t + l.fp * (isKept(i) ? 16 : 4), 0);
    return 100 * now / sum;
  };

  return {
    view: { target: [0.6, 0.7, 0], radius: 40, theta: 0.08, phi: 1.18, size: 2.9 },
    update(dt) {
      if (playing) { clock += dt; if (clock >= 1.1) { clock = 0; beat = (beat + 1) % LAYERS.length; } }
      const k = ease(dt, 6);
      LAYERS.forEach((l, i) => {
        const kept = isKept(i);
        cur[i].h += ((kept ? H16 : H4) - cur[i].h) * k;
        cur[i].c += ((kept ? 0.6 : 0.13) - cur[i].c) * k;
        slabs[i].scale.set(WID, cur[i].h, DEPTH(l.fp));
        slabs[i].position.y = cur[i].h / 2;
        mats[i].color.setScalar(cur[i].c);
        outlines[i].position.copy(slabs[i].position);
        outlines[i].scale.copy(slabs[i].scale);
        outlines[i].visible = kept;
      });
      const p = pct();
      // the pulse outlines the part step / back points at (visible paused too)
      pulse.position.copy(slabs[beat].position); pulse.scale.copy(slabs[beat].scale).multiplyScalar(1.12);
      const keptCount = LAYERS.filter((_, i) => isKept(i)).length;
      fill.scale.set(Math.max((BAR1 - BAR0) * p / 100, 0.02), 0.16, 0.34);
      fill.position.set(BAR0 + ((BAR1 - BAR0) * p / 100) / 2, -1.6, 0.4);
      keptLab.visible = keptCount > 0;
      setText(barLab, `${p.toFixed(0)}% of bf16\ntoy sizes, not GB`);
      out({ playing, readout: `${recipe === 'mine' ? 'my recipe' : 'all 4-bit'} · ${keptCount} layers kept at bf16 · toy size ${p.toFixed(0)}% of bf16 · pointing at ${LAYERS[beat].name}` });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      else if (name === 'step') { playing = false; beat = (beat + (Number(arg) < 0 ? -1 : 1) + LAYERS.length) % LAYERS.length; clock = 0; }
      else if (name === 'back') { playing = false; beat = (beat - 1 + LAYERS.length) % LAYERS.length; clock = 0; }
      else if (name === 'recipe' && (arg === 'all' || arg === 'mine')) { recipe = arg; }
    },
  };
}
