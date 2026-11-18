// autoround variant B — the worked toy from docs/research/v2/nvfp4-autoround.md ("Idea B").
// One 4-weight row w = [0.52, 0.52, -0.52, 0.32], scale s = 0.20, three toy input vectors.
// Bar height = signed output contribution of a weight's rounding error: (w_hat_i − w_i) · x_i.
// Back row = plain rounding (RTN), front row = tuned rounding (offset V = [0, -0.2, 0, 0]).
// Every number is computed from this toy in JS; nothing here is measured on a real model.
import { THREE, lam, ease, emitter } from './_kit.js';

const W = [0.52, 0.52, -0.52, 0.32];
const SCALE = 0.2;
const XS = { cal: [1, 1, -0.5, 0.5], held1: [1, 0.8, -0.4, 0.6], held2: [1, -0.5, 0.5, 1] };
const NAMES = { cal: 'calibration', held1: 'similar', held2: 'different' };
const RTN = [0, 0, 0, 0];
const V = [0, -0.2, 0, 0];
const FLIP = 1;                                  // the one weight the toy tunes
const qOf = (i, v) => Math.round(W[i] / SCALE + v) * SCALE;
const contrib = (v, x) => W.map((_, i) => (qOf(i, v[i]) - W[i]) * x[i]);
const sum = a => a.reduce((t, n) => t + n, 0);
const trim3 = v => v.toFixed(3).replace(/\.?0+$/, '').replace(/^-?$/, '0');

const X = [-2.1, -0.68, 0.74, 2.16];    // weight columns
const XT = 3.05;                        // stacked-total towers
const ZB = -1.1, ZF = 1.1;              // back = plain rounding, front = tuned rounding
const F = 4.5;                            // world units per unit of output error
const DUR = [3.5, 2.5, 3, 1];           // beats: plain → weight 1 flips → totals settle → hold

const FS = 72, LH = 92;                 // label canvas font px / line height
function drawLines(c, text) {
  const lines = String(text).split('\n'), g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height); g.font = `bold ${FS}px monospace`;
  g.fillStyle = '#111'; g.textBaseline = 'middle'; g.textAlign = 'center';
  lines.forEach((l, i) => g.fillText(l, c.width / 2, LH * i + LH / 2));
}

export default function build(scene, emit) {
  const out = emitter(emit), box = new THREE.BoxGeometry(1, 1, 1);
  const dark = lam(0x1c1c1c), dim = lam(0x8c8c8c);
  let input = 'cal', playing = true, clock = 0, beat = 0;
  const cur = { back: [0, 0, 0, 0], front: [0, 0, 0, 0] };

  // h = total sprite height; a 2-line label uses h ≈ 2 × single-line height
  function label(text, x, y, z, h = 0.4) {
    const lines = String(text).split('\n'), meas = document.createElement('canvas').getContext('2d');
    meas.font = `bold ${FS}px monospace`;
    const w = Math.ceil(Math.max(...lines.map(l => meas.measureText(l).width))) + 20;
    const c = document.createElement('canvas'); c.width = w; c.height = LH * lines.length;
    drawLines(c, text);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    s.scale.set(h * c.width / c.height, h, 1); s.position.set(x, y, z); s.renderOrder = 10; scene.add(s); return s;
  }
  // redraw a sprite in place; the dummy text is padded to the widest value it will ever hold
  function setText(sprite, text) {
    drawLines(sprite.material.map.image, text);
    sprite.material.map.needsUpdate = true;
  }
  const mesh = (mat, x, y, z) => { const m = new THREE.Mesh(box, mat); m.position.set(x, y, z); scene.add(m); return m; };
  const setBar = (m, x, z, value, w = 0.42, d = 0.4) => {
    m.position.set(x, value * F / 2, z); m.scale.set(w, Math.max(Math.abs(value) * F, 0.004), d);
  };
  const setSeg = (m, z, from, to) => {
    m.position.set(XT, (from + to) * F / 2, z); m.scale.set(0.3, Math.max(Math.abs(to - from) * F, 0.004), 0.5);
  };

  // zero line for each row: bars above it push the layer output up, below it pull it down
  mesh(lam(0x4a4a4a), 0.35, -0.02, ZB).scale.set(5.5, 0.035, 0.14);
  mesh(lam(0x4a4a4a), 0.35, -0.02, ZF).scale.set(5.5, 0.035, 0.14);

  const back = [0, 1, 2, 3].map(() => mesh(dim, 0, 0, ZB)), front = [0, 1, 2, 3].map(() => mesh(dark, 0, 0, ZF));
  const bTot = [0, 1, 2, 3].map(() => mesh(dim, XT, 0, ZB)), fTot = [0, 1, 2, 3].map(() => mesh(dark, XT, 0, ZF));
  const flipBox = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0x111111 }));
  flipBox.renderOrder = 8; scene.add(flipBox);

  // row identifiers sit at the left end of each row
  label('plain', -2.95, 0.52, ZB, 0.39);
  label('tuned', -2.95, 0.52, ZF, 0.39);
  // one 2-line label per column: weight on top, current input below
  // (dummy text is padded to the widest value any redraw will ever hold)
  const wxLab = X.map((x, i) => label(`w ${W[i].toFixed(2)}\nx -0.50`, x, 1.78, 0, 0.78));
  const nums = X.map(x => label('-0.096', x, -1.05, ZF, 0.39));
  const totB = label('0.224', XT, 2.05, ZB, 0.39);
  const totF = label('0.224', XT, 1.5, ZF, 0.39);
  const flipLab = label('flipped', X[FLIP], 0.3, ZF, 0.39);
  label('bar height = error × input\ntoy row · s = 0.20', 0.25, -2.1, 0, 0.78);
  flipLab.visible = false;

  function showInputs() {
    const x = XS[input];
    X.forEach((_, i) => setText(wxLab[i], `w ${W[i].toFixed(2)}\nx ${x[i].toFixed(2)}`));
  }
  showInputs();

  return {
    view: { target: [-0.05, -0.1, 0], radius: 40, theta: 0.14, phi: 1.12, size: 3.0 },
    update(dt) {
      if (playing) { clock += dt; if (clock >= DUR[beat]) { clock = 0; beat = (beat + 1) % DUR.length; } }
      const k = ease(dt, 6), x = XS[input], flipped = beat >= 1;
      const b = contrib(RTN, x), f = contrib(V, x);
      let accB = 0, accF = 0;
      for (let i = 0; i < 4; i++) {
        cur.back[i] += (b[i] - cur.back[i]) * k;
        // the front row starts as plain rounding, then the tuned value takes over
        cur.front[i] += ((flipped ? f[i] : b[i]) - cur.front[i]) * k;
        setBar(back[i], X[i], ZB, cur.back[i]);
        setBar(front[i], X[i], ZF, cur.front[i]);
        setSeg(bTot[i], ZB, accB, accB + cur.back[i]); accB += cur.back[i];
        setSeg(fTot[i], ZF, accF, accF + cur.front[i]); accF += cur.front[i];
        setText(nums[i], trim3(cur.front[i]));
        nums[i].material.opacity = beat >= 2 || !playing ? 1 : 0.3;
      }
      flipBox.position.set(X[FLIP], cur.front[FLIP] * F / 2, ZF);
      flipBox.scale.set(0.62, Math.max(Math.abs(cur.front[FLIP]) * F, 0.12) * 1.25, 0.6);
      flipBox.visible = flipped; flipLab.visible = flipped;
      setText(totB, trim3(accB));
      setText(totF, trim3(accF));
      totB.position.y = Math.max(accB * F, 0.1) + 0.32;
      totF.position.y = Math.max(accF * F, 0.1) + 0.32;
      out({ playing, readout: `simulated · ${NAMES[input]} input · error ${sum(b).toFixed(3)} plain vs ${sum(f).toFixed(3)} tuned` });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      else if (name === 'step') { playing = false; beat = (beat + (Number(arg) < 0 ? -1 : 1) + DUR.length) % DUR.length; clock = 0; }
      else if (name === 'back') { playing = false; beat = (beat - 1 + DUR.length) % DUR.length; clock = 0; }
      else if (name === 'input' && XS[arg]) { input = arg; beat = 0; clock = 0; showInputs(); }
    },
  };
}
