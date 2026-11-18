// deck v2 my-drafter B — the drafter-training funnel + the speaker's two verified runs.
// Six pipeline stages narrow top->bottom (data collected -> model regenerates -> hidden
// states -> train -> convert -> serve in vLLM); a packet walks the funnel on a ~12 s loop.
// The run cards carry ONLY the speaker's figures from home-k8s issues #72 / #80 (verified in
// src/scenes/builders/drafter-train.js L46-77 + docs/presentation-production-handoff.md E05):
//   #72: ~546k rows · 2 days 16 h          #80: 215,154 rows · acceptance length 1.617 vs ~1.66 baseline
// Do not imply: the drafter beat baseline (1.617 < ~1.66), or that these numbers generalise.
import { THREE, lam, ghost, ease, emitter } from './_kit.js';

const STAGES = ['agent transcripts', 'regenerate with the model', 'hidden states', 'train', 'convert', 'serve in vLLM'];
const FX = -1.1, W0 = 3.4, W1 = 1.5, PH = 0.44, GAPY = 1.0, Y0 = 2.6;
const RUNS = {
  72: { lines: ['~546k rows', '2 days 16 h'], measured: 3,  // rows/time were produced by training
        readout: 'speaker run #72 · ~546k rows · train time 2 days 16 h' },
  80: { lines: ['215,154 rows', 'acceptance 1.617', 'baseline ~1.66'], measured: 5,  // length measured when served
        readout: 'speaker run #80 · 215,154 rows · accept length 1.617 (baseline ~1.66)' },
};

export default function build(scene, emit) {
  const out = emitter(emit);
  const root = new THREE.Group(); scene.add(root);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const dark = lam(0x1b1b1b), idle = lam(0xa8a8a8), arrowMat = lam(0x555555);

  function label(text, x, y, h = 0.3, ink = '#111111', z = 1.2) {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = 'bold 72px monospace'; const w = Math.ceil(g.measureText(text).width) + 18;
    c.width = w; c.height = 84; g.font = 'bold 72px monospace'; g.fillStyle = ink;
    g.textBaseline = 'middle'; g.fillText(text, 9, 44);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
    h = Math.max(h, 0.45); s.scale.set(h * w / 84, h, 1); s.position.set(x, y, z); s.renderOrder = 10; root.add(s); return s;
  }

  // ── funnel plates + in-plate labels (dark text on idle, light on active) ─
  const plates = STAGES.map((name, i) => {
    const t = i / (STAGES.length - 1), y = Y0 - i * GAPY, w = W0 + (W1 - W0) * t;
    const m = new THREE.Mesh(box, idle); m.scale.set(w, PH, 0.5); m.position.set(FX, y, 0);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0x222222 }));
    e.scale.set(w, PH, 0.5); e.position.set(FX, y, 0);
    root.add(m, e);
    const darkInk = label(name, FX, y, 0.29, '#111111', 0.3), lightInk = label(name, FX, y, 0.29, '#f2f2f2', 0.3);
    lightInk.visible = false;
    return { m, e, darkInk, lightInk, y, w };
  });
  for (let i = 0; i < plates.length - 1; i++) { // down arrows between plates
    const g = new THREE.Group(); g.position.set(FX, Y0 - i * GAPY - GAPY / 2, 0);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), arrowMat);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.16, 10), arrowMat);
    head.position.y = -0.18; g.add(shaft, head); root.add(g);
  }
  const packet = new THREE.Mesh(box, lam(0xf0f0f0)); packet.scale.setScalar(0.2); packet.position.set(FX, Y0, 0.45);
  root.add(packet);
  // marker for the stage whose figure the selected run card shows
  const mark = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12), dark);
  mark.rotation.x = Math.PI / 2; root.add(mark);
  const markLabel = label('measured here', 0, 0, 0.26, '#111111', 0.32);

  // ── run cards ────────────────────────────────────────────────────────────
  const CX = 2.75, CW = 3.0;
  const cards = [72, 80].map((n, ci) => {
    const rows = RUNS[n].lines;
    const h = 0.75 + rows.length * 0.44, cy = ci === 0 ? 1.55 : -1.15;
    const panel = new THREE.Mesh(box, ghost(0xffffff, 0.09)); panel.scale.set(CW, h, 0.05); panel.position.set(CX, cy, -0.1);
    const fill = new THREE.Mesh(box, lam(0xcfcfcf)); fill.scale.set(CW, h, 0.05); fill.position.copy(panel.position); fill.visible = false;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0x888888 }));
    e.scale.copy(fill.scale); e.position.copy(panel.position);
    root.add(panel, fill, e);
    const headDark = new THREE.Mesh(box, lam(0x161616)); headDark.scale.set(CW - 0.3, 0.36, 0.07);
    headDark.position.set(CX, cy + h / 2 - 0.26, 0.02); headDark.visible = false; root.add(headDark);
    const titleDim = label(`run #${n}`, CX, cy + h / 2 - 0.26, 0.3, '#111111', 0.12);
    const titleLit = label(`run #${n}`, CX, cy + h / 2 - 0.26, 0.3, '#f2f2f2', 0.12); titleLit.visible = false;
    const lines = rows.map((r, i) => label(r, CX, cy + h / 2 - 0.66 - i * 0.42, 0.27, '#111111', 0.12));
    return { n, panel, fill, e, headDark, titleDim, titleLit, lines };
  });

  // ── state: initial run matches the slide control (80) ────────────────────
  let run = 80, playing = true, stage = 0, phase = 'dwell', pt = 0;
  const DWELL = 1.5, MOVE = 0.5;

  return {
    view: { target: [0.2, 0.1, 0], radius: 40, theta: 0.12, phi: 1.2, size: 3.4 },
    update(dt) {
      const k = ease(dt, 7);
      // packet walks the funnel top -> bottom, loops every ~12 s
      if (playing) {
        pt += dt;
        if (phase === 'dwell' && pt >= DWELL) { phase = 'move'; pt = 0; }
        else if (phase === 'move' && pt >= MOVE) {
          phase = 'dwell'; pt = 0; stage = (stage + 1) % STAGES.length;
        }
      }
      const goalY = Y0 - stage * GAPY + (phase === 'move' ? -Math.min(pt / MOVE, 1) * GAPY : 0);
      packet.position.y += (goalY - packet.position.y) * k;
      plates.forEach((p, i) => {
        const on = i === stage && phase === 'dwell';
        p.m.material = on ? dark : idle;
        p.darkInk.visible = !on; p.lightInk.visible = on;
        p.e.scale.y = p.m.scale.y = PH;
      });
      // run selection: highlighted card + the stage its figure was measured at
      for (const c of cards) {
        const on = c.n === run;
        c.fill.visible = on; c.panel.visible = !on;
        c.headDark.visible = on; c.titleDim.visible = !on; c.titleLit.visible = on;
        c.e.material.color.setHex(on ? 0x111111 : 0x888888);
        for (const l of c.lines) l.material.color.setHex(on ? 0x111111 : 0x9a9a9a);
      }
      const mp = plates[RUNS[run].measured], mx = FX - mp.w / 2 - 0.14;
      mark.position.set(mx, mp.y, 0.3);
      markLabel.position.set(mx, mp.y + 0.42, 0.32);
      out({ playing, readout: RUNS[run].readout });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      else if (name === 'step' || name === 'back') { playing = false; stage = (stage + (name === 'back' ? STAGES.length - 1 : 1)) % STAGES.length; phase = 'dwell'; pt = 0; }
      else if (name === 'run' && RUNS[Number(arg)]) run = Number(arg);
    },
  };
}
