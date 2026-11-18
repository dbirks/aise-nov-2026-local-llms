// deck v2 drafter-vram B — one VRAM column, two tenants.
// A fixed 32-TOY-UNIT column filled bottom-up: target weights, drafter weights, target KV,
// drafter KV, free. Context grows both KV slabs linearly; the drafter window toggle clamps
// the drafter KV slab (sliding-window attention caps it, like DFlash/DSpark in Speculators).
// Every size here is a TOY unit chosen so the default 32k state leaves 6 units free — it is
// NOT GiB, not a measured model. Do not imply: real GB values, or that the drafter is free.
import { THREE, lam, ease, emitter } from './_kit.js';

const CAP = 32;                    // toy units in the column
const U = 0.15;                    // world units per toy unit
const X = 0.35, CW = 2.6, DEPTH = 1.1, Y0 = -2.4;
const TW = 10, DW = 3;             // toy sizes of the two weight bands
const RATE = 0.25;                 // toy KV units per k-context (both caches, illustrative)
const WINDOW = 5;                  // drafter KV cap when the window is on
const CTXS = [8, 32, 128];

export default function build(scene, emit) {
  const out = emitter(emit);
  const root = new THREE.Group(); scene.add(root);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x111111 });
  const thinMat = new THREE.LineBasicMaterial({ color: 0x777777 });
  const edge = () => { const e = new THREE.LineSegments(new THREE.EdgesGeometry(box), edgeMat); root.add(e); return e; };

  function label(text, x, y, h = 0.3, ink = '#111111', z = 1.2) {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = 'bold 64px monospace'; const w = Math.ceil(g.measureText(text).width) + 18;
    c.width = w; c.height = 84; g.font = 'bold 64px monospace'; g.fillStyle = ink;
    g.textBaseline = 'middle'; g.fillText(text, 9, 44);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
    s.scale.set(h * w / 84, h, 1); s.position.set(x, y, z); s.renderOrder = 10; root.add(s); return s;
  }
  function setLabel(l, text, y) { // rebuild the sprite only when text/row changes
    if (l.s && l.text === text) { l.s.position.y = y; return; }
    if (l.s) { root.remove(l.s); l.s.material.map.dispose(); l.s.material.dispose(); }
    l.text = text; l.s = label(text, 2.7, y, 0.3, '#111111', 0.4);
  }
  function pattern(kind) { // 'blocks-big' | 'blocks-fine' | 'hatch' -> tileable canvas texture
    const c = document.createElement('canvas'); c.width = c.height = 40;
    const g = c.getContext('2d');
    g.fillStyle = kind === 'hatch' ? '#e6e6e6' : '#c2c2c2'; g.fillRect(0, 0, 40, 40);
    g.strokeStyle = '#161616'; g.lineWidth = 3;
    if (kind === 'hatch') {
      for (let k = -40; k < 80; k += 14) { g.beginPath(); g.moveTo(k, 40); g.lineTo(k + 40, 0); g.stroke(); }
    } else {
      const step = kind === 'blocks-big' ? 40 : 20;
      for (let k = 0; k <= 40; k += step) { g.beginPath(); g.moveTo(0, k); g.lineTo(40, k); g.stroke(); g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 40); g.stroke(); }
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ── column shell: floor, dark ceiling = the 32-unit budget ──────────────
  const ceil = new THREE.Mesh(box, lam(0x111111)); ceil.scale.set(CW + 0.5, 0.08, DEPTH + 0.1);
  ceil.position.set(X, Y0 + CAP * U + 0.05, 0);
  const floor = new THREE.Mesh(box, lam(0x8a8a8a)); floor.scale.set(CW + 0.5, 0.07, DEPTH + 0.1);
  floor.position.set(X, Y0 - 0.04, 0);
  const shell = edge(); shell.scale.set(CW, CAP * U, DEPTH); shell.position.set(X, Y0 + CAP * U / 2, 0);
  root.add(ceil, floor);
  label("32 toy units", X, Y0 + CAP * U + 0.05, 0.26, "#efefe8", 0.05);
  label('VRAM budget', X - CW / 2 - 1.5, Y0 - 0.45, 0.3);
  for (const n of [8, 16, 24]) {
    const tick = new THREE.Mesh(box, lam(0x777777)); tick.scale.set(0.25, 0.03, 0.06);
    tick.position.set(X - CW / 2 - 0.16, Y0 + n * U, 0); root.add(tick);
    label(String(n), X - CW / 2 - 0.62, Y0 + n * U, 0.26, '#111111', 0.05);
  }

  // ── slabs ────────────────────────────────────────────────────────────────
  function slab(material, tex) {
    const m = new THREE.Mesh(box, material); root.add(m);
    return { m, e: edge(), tex };
  }
  const tw = slab(lam(0x1a1a1a));
  const dw = slab(lam(0x4a4a4a));
  const kvTexT = pattern('blocks-big'), kvTexD = pattern('blocks-fine'), hatchTex = pattern('hatch');
  const tKV = slab(new THREE.MeshBasicMaterial({ map: kvTexT }), kvTexT);
  const dKV = slab(new THREE.MeshBasicMaterial({ map: kvTexD }), kvTexD);
  const over = slab(new THREE.MeshBasicMaterial({ map: hatchTex }), hatchTex);
  const free = new THREE.LineSegments(new THREE.EdgesGeometry(box), thinMat); root.add(free);
  // dark cap plate on top of the drafter KV slab when the window clamps it
  const cap = new THREE.Mesh(box, lam(0x111111)); root.add(cap);

  // ── right-hand labels (de-collided every frame) ─────────────────────────
  const LX = 2.7, GAP = 0.48;
  const mk = () => ({ s: null, text: '', lead: new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), thinMat), w: 2.4 });
  const labels = [mk(), mk(), mk(), mk(), mk(), mk()]; // weights ×2, kvs ×2, free, doesn't fit
  labels.forEach(l => root.add(l.lead));

  // ── state: defaults match the slide's control initials (32k, window on) ─
  let ctx = 32, windowOn = true, playing = true, clock = 0;
  let kvT = ctx * RATE, kvD = Math.min(ctx * RATE, WINDOW); // animated current sizes

  function model() {
    const raw = ctx * RATE;
    const d = windowOn ? Math.min(raw, WINDOW) : raw;
    const used = TW + DW + raw + d;
    return { raw, d, free: Math.max(0, CAP - used), over: Math.max(0, used - CAP), capped: windowOn && raw > WINDOW };
  }

  return {
    view: { target: [0.6, 0.1, 0], radius: 40, theta: 0.18, phi: 1.18, size: 3.4 },
    update(dt) {
      const k = ease(dt, 6);
      if (playing) { clock += dt; if (clock >= 4) { clock = 0; ctx = CTXS[(CTXS.indexOf(ctx) + 1) % 3]; } }
      const t = model();
      kvT += (t.raw - kvT) * k; kvD += (t.d - kvD) * k;
      const TOP = Y0 + CAP * U;
      const setSlab = (s, y, units) => {
        const drawU = Math.min(units, Math.max((TOP - y) / U, 0));   // clip at the ceiling
        const h = Math.max(drawU * U, 0.001);
        s.m.scale.set(CW, h, DEPTH); s.e.scale.copy(s.m.scale);
        s.m.position.set(X, y + h / 2, 0); s.e.position.copy(s.m.position);
        if (s.tex) s.tex.repeat.set(3, Math.max(drawU * 1.2, 0.05));
        s.m.visible = s.e.visible = drawU > 0.02;
        return y + h;
      };
      let y = Y0;
      y = setSlab(tw, y, TW);
      y = setSlab(dw, y, DW);
      const kvTop = y = setSlab(tKV, y, kvT);
      const dkTop = y = setSlab(dKV, y, kvD);
      // overflow above the ceiling, drawn compressed so it stays on screen
      const overH = Math.min(t.over * U, 2.1);
      setSlab(over, TOP, t.over > 0.02 ? overH / U : 0);
      // free space left inside the column
      const freeH = Math.max((CAP - Math.min(TW + DW + kvT + kvD, CAP)) * U, 0.001);
      free.scale.set(CW, freeH, DEPTH); free.position.set(X, Math.min(dkTop, TOP) + freeH / 2, 0);
      const showFree = t.over <= 0 && t.free > 0.3;
      free.visible = showFree;
      cap.visible = t.capped && t.over <= 0;
      cap.scale.set(CW + 0.3, 0.06, DEPTH + 0.08); cap.position.set(X, Math.min(dkTop, TOP) + 0.03, 0);

      const rows = [
        [labels[0], Y0 + TW * U / 2, `target weights · ${TW}`, true],
        [labels[1], Y0 + (TW + DW / 2) * U, `drafter weights · ${DW}`, true],
        [labels[2], (Y0 + (TW + DW) * U + kvTop) / 2, `target kv · ${t.raw}`, true],
        [labels[3], Math.min((kvTop + dkTop) / 2, TOP + overH + 0.4), `drafter kv · ${t.d}${t.capped ? ' · capped' : ''}`, true],
        [labels[4], Math.min(dkTop, TOP) + freeH / 2, `free · ${t.free}`, showFree],
        [labels[5], TOP + overH / 2, "doesn't fit", t.over > 0.02],
      ].sort((a, b) => a[1] - b[1]);
      let prev = -Infinity;
      for (const [l, ideal, text, show] of rows) {
        l.lead.visible = show;
        if (!show) { l.s && (l.s.visible = false); continue; }
        const yy = Math.max(ideal, prev + GAP); prev = yy;
        setLabel(l, text, yy); l.s.visible = true;
        l.lead.geometry.setFromPoints([
          new THREE.Vector3(X + CW / 2 + 0.05, ideal, 0.45),
          new THREE.Vector3(2.7 - (l.s ? l.s.scale.x : 2) / 2 - 0.08, yy, 0.45),
        ]);
      }

      const units = t.over > 0 ? `${t.over} units over` : `${t.free} units free`;
      const capWord = windowOn && t.capped ? 'capped by window' : 'uncapped';
      out({ playing, readout: `simulated · ${ctx}k context · drafter kv ${capWord} · ${units}` });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      else if (name === 'step') { ctx = CTXS[(CTXS.indexOf(ctx) + 1) % 3]; clock = 0; }
      else if (name === 'ctx' && CTXS.includes(Number(arg))) { ctx = Number(arg); clock = 0; }
      else if (name === 'window') windowOn = typeof arg === 'boolean' ? arg : !windowOn;
    },
  };
}
