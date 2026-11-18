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
const H16 = 1.75, H4 = 0.45;                        // slab height for 16 / 4 stored bits
const DEPTH = fp => 0.16 + 0.2 * fp;                // toy relative size, floored for legibility
const X0 = -2.05, DX = 0.98, WID = 0.72;          // slab row
const BAR0 = -2.3, BAR1 = 0.9;                      // size bar span

export default function build(scene, emit) {
  const out = emitter(emit), box = new THREE.BoxGeometry(1, 1, 1);
  let recipe = 'mine', playing = true, clock = 0, beat = 0;
  const cur = LAYERS.map(l => ({ h: l.kept ? H16 : H4, c: l.kept ? 0.6 : 0.13 }));

  function label(text, x, y, z, h = 0.28) {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = 'bold 72px monospace'; c.width = Math.ceil(g.measureText(text).width) + 20; c.height = 92;
    g.font = 'bold 72px monospace'; g.fillStyle = '#111'; g.textBaseline = 'middle'; g.fillText(text, 10, 46);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    s.scale.set(h * c.width / c.height, h, 1); s.position.set(x, y, z); s.renderOrder = 10; scene.add(s); return s;
  }
  function setText(sprite, text) {
    const c = sprite.material.map.image, g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height); g.font = 'bold 72px monospace';
    g.fillStyle = '#111'; g.textBaseline = 'middle'; g.fillText(text, 10, 46);
    sprite.material.needsUpdate = true; sprite.material.map.needsUpdate = true;
  }
  const mesh = (mat, x, y, z) => { const m = new THREE.Mesh(box, mat); m.position.set(x, y, z); scene.add(m); return m; };

  // base plate under the slab row
  mesh(lam(0xc2c2c2), 0.25, -0.02, 0).scale.set(5.9, 0.03, 1.75);

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
  LAYERS.forEach((l, i) => label(l.name, X0 + i * DX, -0.55, 0.35, 0.25));

  label('small dark: 4 bits · tall outlined: kept at 16 bits', 0.3, 2.75, 0, 0.27);
  label('20.61 GB nvfp4 · 19.47 GB w4a16 (file listing)', 0.3, 3.35, 0, 0.24);
  const keptLab = label('kept at 16 bits', 1.45, 2.02, 0, 0.26);
  const track = mesh(lam(0xdedede), (BAR0 + BAR1) / 2, -1.5, 0);
  track.scale.set(BAR1 - BAR0, 0.16, 0.3);
  const fill = mesh(lam(0x222222), BAR0, -1.5, 0);
  const end = new THREE.Line(new THREE.BufferGeometry().setFromPoints(
    [new THREE.Vector3(BAR1, -1.67, 0), new THREE.Vector3(BAR1, -1.33, 0)]), new THREE.LineBasicMaterial({ color: 0x111111 }));
  scene.add(end);
  label('bf16', BAR1 + 0.3, -1.5, 0, 0.24);
  const barLab = label('toy size 00% of bf16', -1.05, -2.2, 0, 0.26);
  label('toy sizes, not GB', 1.1, -2.6, 0, 0.24);
  const pulse = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0x111111 }));
  pulse.renderOrder = 9; scene.add(pulse);

  const isKept = (i) => recipe === 'mine' && LAYERS[i].kept;
  const pct = () => {
    const sum = LAYERS.reduce((t, l) => t + l.fp * 16, 0);
    const now = LAYERS.reduce((t, l, i) => t + l.fp * (isKept(i) ? 16 : 4), 0);
    return 100 * now / sum;
  };

  return {
    view: { target: [0.3, 0.6, 0], radius: 40, theta: 0.28, phi: 1.15, size: 2.3 },
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
      pulse.position.copy(slabs[beat].position); pulse.scale.copy(slabs[beat].scale).multiplyScalar(1.12);
      pulse.visible = playing;
      const keptCount = LAYERS.filter((_, i) => isKept(i)).length;
      fill.scale.set(Math.max((BAR1 - BAR0) * p / 100, 0.02), 0.16, 0.34);
      fill.position.set(BAR0 + ((BAR1 - BAR0) * p / 100) / 2, -1.5, 0);
      keptLab.visible = keptCount > 0;
      setText(barLab, `toy size ${p.toFixed(0)}% of bf16  `);
      out({ playing, readout: `${recipe === 'mine' ? 'my recipe' : 'all 4-bit'} · ${keptCount} layers kept at bf16 · toy size ${p.toFixed(0)}% of bf16` });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      else if (name === 'step') { beat = (beat + (Number(arg) < 0 ? -1 : 1) + LAYERS.length) % LAYERS.length; clock = 0; }
      else if (name === 'recipe' && (arg === 'all' || arg === 'mine')) { recipe = arg; }
    },
  };
}
