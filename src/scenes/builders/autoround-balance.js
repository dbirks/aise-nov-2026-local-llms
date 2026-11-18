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

const X = [-2.0, -0.85, 0.3, 1.45];    // weight columns
const XT = 2.6;                         // stacked-total towers
const ZB = -1.1, ZF = 1.1;              // back = plain rounding, front = tuned rounding
const F = 4.5;                            // world units per unit of output error
const DUR = [3.5, 2.5, 3, 1];           // beats: plain → weight 1 flips → totals settle → hold

export default function build(scene, emit) {
  const out = emitter(emit), box = new THREE.BoxGeometry(1, 1, 1);
  const dark = lam(0x1c1c1c), dim = lam(0x8c8c8c);
  let input = 'cal', playing = true, clock = 0, beat = 0;
  const cur = { back: [0, 0, 0, 0], front: [0, 0, 0, 0] };

  function label(text, x, y, z, h = 0.28) {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = 'bold 72px monospace'; c.width = Math.ceil(g.measureText(text).width) + 20; c.height = 92;
    g.font = 'bold 72px monospace'; g.fillStyle = '#111'; g.textBaseline = 'middle'; g.fillText(text, 10, 46);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    s.scale.set(h * c.width / c.height, h, 1); s.position.set(x, y, z); s.renderOrder = 10; scene.add(s); return s;
  }
  // redraw a sprite in place; the dummy text is padded to the widest value it will ever hold
  function setText(sprite, text) {
    const c = sprite.material.map.image, g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height); g.font = 'bold 72px monospace';
    g.fillStyle = '#111'; g.textBaseline = 'middle'; g.fillText(text, 10, 46);
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
  mesh(lam(0x4a4a4a), 0.4, -0.02, ZB).scale.set(5.6, 0.035, 0.14);
  mesh(lam(0x4a4a4a), 0.4, -0.02, ZF).scale.set(5.6, 0.035, 0.14);

  const back = [0, 1, 2, 3].map(() => mesh(dim, 0, 0, ZB)), front = [0, 1, 2, 3].map(() => mesh(dark, 0, 0, ZF));
  const bTot = [0, 1, 2, 3].map(() => mesh(dim, XT, 0, ZB)), fTot = [0, 1, 2, 3].map(() => mesh(dark, XT, 0, ZF));
  const flipBox = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0x111111 }));
  flipBox.renderOrder = 8; scene.add(flipBox);

  label('rounding errors add up, then cancel', 0.2, 3.35, 0, 0.3);
  label('back: plain rounding · front: tuned rounding', 0.2, 2.9, 0, 0.27);
  label('total error', XT, 2.5, 0, 0.27);
  X.forEach((x, i) => label(`w ${W[i].toFixed(2)}`, x, 2.15, 0, 0.25));
  const xLab = X.map(x => label('x 0.0 ', x, 1.75, 0, 0.25));
  const nums = X.map(x => label('0.000 ', x, -1.05, ZF, 0.24));
  const totB = label('0.000 ', XT, 2.05, ZB, 0.27);
  const totF = label('0.000 ', XT, 1.5, ZF, 0.27);
  const flipLab = label('flipped', X[FLIP], -1.55, ZF, 0.25);
  label('bar height = rounding error × input · toy row, s = 0.20', 0.35, -2.05, 0, 0.26);
  flipLab.visible = false;

  function showInputs() {
    const x = XS[input];
    X.forEach((_, i) => setText(xLab[i], `x ${x[i].toFixed(1)} `));
  }
  showInputs();

  return {
    view: { target: [0.2, 0.95, 0], radius: 40, theta: 0.3, phi: 1.12, size: 2.2 },
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
        setText(nums[i], `${cur.front[i].toFixed(3)} `);
        nums[i].material.opacity = beat >= 2 || !playing ? 1 : 0.3;
      }
      flipBox.position.set(X[FLIP], cur.front[FLIP] * F / 2, ZF);
      flipBox.scale.set(0.62, Math.max(Math.abs(cur.front[FLIP]) * F, 0.12) * 1.25, 0.6);
      flipBox.visible = flipped; flipLab.visible = flipped;
      setText(totB, `${accB.toFixed(3)} `);
      setText(totF, `${accF.toFixed(3)} `);
      out({ playing, readout: `simulated · ${NAMES[input]} input · error ${sum(b).toFixed(3)} plain vs ${sum(f).toFixed(3)} tuned` });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      else if (name === 'step') { beat = (beat + (Number(arg) < 0 ? -1 : 1) + DUR.length) % DUR.length; clock = 0; }
      else if (name === 'input' && XS[arg]) { input = arg; beat = 0; clock = 0; showInputs(); }
    },
  };
}
