// Scene `profiles` — handoff §3 A03 (chapter 07, closing): "no best setup, only your workload".
//
// Six pillars stand on one plinth. Each pillar is one LIMIT the talk spent a chapter on; the small
// number under it is that chapter. The plinth is static (the limits do not change); the pillars are
// the workload's demand on them, at three QUALITATIVE levels — low / med / high:
//   height  = how much this workload leans on that limit
//   shade   = same emphasis again (dark = leaned on, light = barely used) so the row reads at a glance
//   cap plate = the workload's load sitting on top of a limit it actually leans on (med = small plate,
//               high = wide plate, low = none)
// Picking a profile (or letting the loop cycle them) re-emphasises the row. Nothing here is a
// measurement: no numbers, no axis units, no ranking of setups — the levels are the speaker's
// framing of his own chapters (HYPOTHESIS / OPINION + SYNTHETIC DEMO). It must not read as "this
// profile wins", as a hardware comparison, or as any Mac/MLX claim.
import { THREE, lam, ease, emitter } from './_kit.js';

// pillar order = chapter order in the talk
const LIM = [
  { name: ['vram', 'capacity', ''], ch: '01' },        // will it fit at all
  { name: ['memory', 'bandwidth', ''], ch: '01' },     // how fast the weights stream
  { name: ['kv', 'context', 'room'], ch: '02' },       // where the conversation goes
  { name: ['prefix', 'reuse', ''], ch: '03' },         // shared prefixes
  { name: ['concurrency', '', ''], ch: '03' },       // several requests at once
  { name: ['data', 'stays', 'local'], ch: '00' },      // why bother at all
];
// emphasis levels 0 = low, 1 = med, 2 = high — qualitative, from the talk's own chapters
const PROF = {
  coding: {
    label: 'coding agent', lv: [1, 1, 2, 2, 2, 1],
    line: 'coding agent leans on kv room, prefix reuse, concurrency',
  },
  private: {
    label: 'private / offline', lv: [1, 0, 1, 0, 0, 2],
    line: 'private / offline leans on data staying local · med vram capacity, kv room',
  },
  chat: {
    label: 'cheap chat', lv: [0, 1, 0, 0, 0, 0],
    line: 'cheap chat leans on memory bandwidth · every other limit low',
  },
  long: {
    label: 'long context', lv: [1, 1, 2, 1, 0, 0],
    line: 'long context leans on kv room · med vram, bandwidth, prefix reuse',
  },
};
const PK = ['coding', 'private', 'chat', 'long'];

const N = LIM.length;
const SP = 1.52;                 // pillar pitch (world units)
const PW = 0.60;                 // pillar width / depth
const H0 = 0.72, HD = 0.79;      // pillar height = H0 + HD * level  (low 0.72 · med 1.51 · high 2.30)
const CAP_T = 0.13;              // cap plate thickness
const ROW_A = -1.18;             // top edge of the pillar-name block, even pillars
const ROW_B = -2.95;             // …odd pillars (staggered so names need no squeezing)
const BEAT = 3.4;                // s per profile while playing (4 profiles ≈ 13.6 s loop)

// greyscale only: light = barely used, dark = leaned on (the post shader maps luminance to sage)
const C_LO = new THREE.Color(0xa9a9a9), C_MD = new THREE.Color(0x626262), C_HI = new THREE.Color(0x1f1f1f);
const cAt = (t, out) => (t <= 1
  ? out.copy(C_LO).lerp(C_MD, Math.max(0, Math.min(1, t)))
  : out.copy(C_MD).lerp(C_HI, Math.max(0, Math.min(1, t - 1))));

/**
 * Short dark-on-transparent text sprite. `lines` are drawn top-aligned, each occupying `h` world
 * units; `maxW` squeezes the sprite horizontally (never the glyph height) so labels can't collide.
 */
function mkText(lines, { h = 0.4, maxW = 0, font = 'bold 64px ui-monospace, "DejaVu Sans Mono", monospace' } = {}) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
  const box = { sprite: sp, h, w: 0 };
  const set = ls => {
    const arr = (Array.isArray(ls) ? ls : [String(ls)]).map(t => t);
    const meas = document.createElement('canvas').getContext('2d');
    meas.font = font;
    const lh = 78, pad = 10;
    const wpx = Math.max(...arr.map(t => Math.max(30, Math.ceil(meas.measureText(t).width))));
    const cv = document.createElement('canvas');
    cv.width = wpx + pad * 2; cv.height = arr.length * lh + pad * 2;
    const g = cv.getContext('2d');
    g.font = font; g.fillStyle = '#161616'; g.textBaseline = 'middle';
    arr.forEach((t, i) => { g.fillText(t, pad, pad + i * lh + lh / 2); });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    sp.material.map?.dispose();
    sp.material.map = tex; sp.material.needsUpdate = true;
    box.h = h * (arr.length + (pad * 2) / lh);   // `h` is the per-LINE world height
    box.w = box.h * (cv.width / cv.height);
    // over-wide labels are squeezed horizontally only, so glyph height (legibility) is preserved
    sp.scale.set(maxW && box.w > maxW ? maxW : box.w, box.h, 1);
  };
  set(lines);
  box.set = set;
  return box;
}

export default function build(scene, emit) {
  const out = emitter(emit);

  // ── plinth: the fixed set of limits the talk covered ────────────────────
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(8.9, 0.46, 0.8), lam(0x4f4f4f));
  plinth.position.set(0, -0.23, 0);
  scene.add(plinth);

  // ── pillars (height + shade = emphasis) and load caps (plate = "leans on") ──
  const pillars = [], caps = [], xs = [];
  for (let i = 0; i < N; i++) {
    const x = (i - (N - 1) / 2) * SP;
    xs.push(x);
    const p = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff));
    p.scale.set(PW, H0, PW);
    p.position.set(x, H0 / 2, 0);
    const c = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lam(0x171717));
    c.scale.set(0.02, CAP_T, 0.78);
    c.position.set(x, H0 + CAP_T / 2, 0);
    c.visible = false;
    scene.add(p, c);
    pillars.push(p); caps.push(c);

    const ch = mkText([LIM[i].ch], { h: 0.32 });
    ch.sprite.position.set(x, -0.8, 0);
    scene.add(ch.sprite);

    // names sit under their own pillar, on two staggered rows so nothing has to be squeezed
    const nm = mkText(LIM[i].name, { h: 0.5, maxW: 2.7 });
    nm.sprite.position.set(x, (i % 2 ? ROW_B : ROW_A) - nm.h / 2, 0);
    scene.add(nm.sprite);
  }

  // ── headline, active profile, legend ───────────────────────────────────
  const title = mkText(['what are you running?'], { h: 0.58 });
  title.sprite.position.set(0, 3.35, 0);
  scene.add(title.sprite);

  const lblProf = mkText([PROF.coding.label], { h: 0.42 });
  lblProf.sprite.position.set(0, 2.82, 0);
  scene.add(lblProf.sprite);

  const legend = mkText(['chapter number under each pillar · tall + dark = leans on'], { h: 0.34, maxW: 7.6 });
  legend.sprite.position.set(0, -5.0, 0);
  scene.add(legend.sprite);

  // ── state ──────────────────────────────────────────────────────────────
  let playing = true, pi = 0, beat = 0, prof = 'coding';
  const lv = LIM.map((_, i) => PROF[prof].lv[i]);

  const setProfile = k => {
    if (!PROF[k] || k === prof) return;
    prof = k; pi = PK.indexOf(k); beat = 0;
    lblProf.set([PROF[k].label]);   // sprite scale is about its centre, so it stays put
  };

  return {
    view: { target: [-1.32, -0.7, 0], radius: 40, theta: 0.35, phi: 1.42, size: 4.25 },
    update(dt) {
      if (playing) {
        beat += dt;
        if (beat >= BEAT) { beat -= BEAT; pi = (pi + 1) % PK.length; setProfile(PK[pi]); }
      }
      const tgt = PROF[prof].lv;
      for (let i = 0; i < N; i++) {
        lv[i] += (tgt[i] - lv[i]) * ease(dt, 6);
        const h = H0 + HD * lv[i];
        const p = pillars[i];
        p.scale.set(PW, h, PW);
        p.position.y = h / 2;
        cAt(lv[i], p.material.color);
        // load plate only where the workload actually leans on the limit
        const ct = Math.max(0, Math.min(1.55, lv[i] - 0.45)) / 1.55;
        const cap = caps[i];
        cap.visible = ct > 0.02;
        cap.scale.set(0.70 + 0.44 * ct, CAP_T, 0.8);
        cap.position.set(xs[i], h + CAP_T / 2, 0);
      }
      out({
        playing,
        profile: prof,
        levels: LIM.map((_, i) => ['low', 'med', 'high'][Math.round(lv[i])]),
        readout: PROF[prof].line,
      });
    },
    action(name, arg) {
      if (name === 'play') { playing = !playing; beat = 0; }
      else if (name === 'step') { playing = false; pi = (pi + 1) % PK.length; setProfile(PK[pi]); }
      else if (name === 'back') { playing = false; pi = (pi - 1 + PK.length) % PK.length; setProfile(PK[pi]); }
      else if (name === 'profile') setProfile(String(arg));
    },
  };
}
