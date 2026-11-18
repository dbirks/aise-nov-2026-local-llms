import { THREE, lam, ease, emitter } from './_kit.js';

const W = [[0.68,-0.12,0.05,0.31],[0.31,0.45,-0.27,0.02],[-0.09,0.22,0.58,-0.40],[0.14,-0.33,0.07,0.49]];
const inputs = [[1,0.5,-0.25,0.8],[-0.6,1,0.3,-0.2]];
const dot = (row, h) => row.reduce((sum, v, i) => sum + v * h[i], 0);

export default function build(scene, emit) {
  const layout = new THREE.Group(); layout.scale.x = 0.8; scene.add(layout);
  const out = emitter(emit), box = new THREE.BoxGeometry(1, 1, 1);
  const solid = lam(0x222222), errorMat = lam(0x080808);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x777777 });
  const levelMat = new THREE.LineBasicMaterial({ color: 0xb0b0b0, transparent: true, opacity: 0.65 });
  let bits = 4, group = 'tensor', input = 1, playing = true, beat = 0, clock = 0;
  let wq, y, yq, scales;
  const current = Array(16).fill(0), currentH = Array(4).fill(0), currentY = Array(4).fill(0), currentQ = Array(4).fill(0);
  const bars = [], outlines = [], hbars = [], ybars = [], yout = [], errors = [];
  const levels = new THREE.Group(); layout.add(levels);
  const marker = new THREE.Mesh(box, errorMat); marker.scale.set(0.12, 0.05, 0.32); layout.add(marker);
  function label(text, x, y, z, height = 0.32) {
    const canvas = document.createElement('canvas'), g = canvas.getContext('2d');
    g.font = 'bold 72px monospace'; canvas.width = Math.ceil(g.measureText(text).width) + 20; canvas.height = 92;
    g.font = 'bold 72px monospace'; g.fillStyle = '#111'; g.textBaseline = 'middle'; g.fillText(text, 10, 46);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }));
    sprite.scale.set(height * canvas.width / canvas.height / 0.8, height, 1); sprite.position.set(x, y, z); sprite.renderOrder = 10; layout.add(sprite); return sprite;
  }
  function bar(material) { const m = new THREE.Mesh(box, material); layout.add(m); return m; }
  function outline() { const e = new THREE.LineSegments(new THREE.EdgesGeometry(box), lineMat); layout.add(e); return e; }
  function setBar(obj, x, z, value, width, depth, factor = 1.55) {
    const height = Math.max(Math.abs(value) * factor, 0.002);
    obj.position.set(x, value * factor / 2, z); obj.scale.set(width, height, depth);
  }
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    bars.push(bar(solid)); outlines.push(outline());
    setBar(outlines[r * 4 + c], -3.25 + c * 0.5, (r - 1.5) * 0.54, W[r][c], 0.36, 0.36);
  }
  for (let i = 0; i < 4; i++) { hbars.push(bar(solid)); ybars.push(bar(solid)); yout.push(outline()); errors.push(bar(errorMat)); }
  const plane = new THREE.Mesh(box, lam(0x999999)); plane.position.set(-0.1, -0.018, 0); plane.scale.set(6.8, 0.025, 2.15); layout.add(plane);
  label('weights W', -2.5, 2.35, 0); label('input h', 0, 2.35, 0); label('output y', 2.35, 2.35, 0);
  label('outline: original', -1.6, -1.45, 0, 0.3); label('solid: quantized', -1.6, -1.85, 0, 0.3);
  label('y   yq   |error|', 2.35, 1.85, 0, 0.32);
  let codeLabel;
  function recompute() {
    const max = Math.max(...W.flat().map(Math.abs)), qmax = 2 ** (bits - 1) - 1;
    scales = W.map(row => (group === 'tensor' ? max : Math.max(...row.map(Math.abs))) / qmax);
    wq = W.map((row, r) => row.map(v => Math.max(-qmax - 1, Math.min(qmax, Math.round(v / scales[r]))) * scales[r]));
    const h = inputs[input - 1]; y = W.map(row => dot(row, h)); yq = wq.map(row => dot(row, h));
    while (levels.children.length) { const item = levels.children[0]; levels.remove(item); item.geometry.dispose(); }
    // Lines represent representable levels in each row's own scale, clipped to the visible value range.
    for (let r = 0; r < 4; r++) for (let q = -qmax - 1; q <= qmax; q++) {
      const v = q * scales[r]; if (Math.abs(v) > 0.72) continue;
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-3.48, v * 1.55, (r - 1.5) * 0.54 - 0.23), new THREE.Vector3(-1.52, v * 1.55, (r - 1.5) * 0.54 - 0.23)]);
      levels.add(new THREE.Line(geometry, levelMat));
    }
    if (codeLabel) { layout.remove(codeLabel); codeLabel.material.map.dispose(); codeLabel.material.dispose(); }
    codeLabel = label(`toy int${bits} [${-qmax-1},${qmax}] × scale`, 1.9, -1.45, 0, 0.3);
  }
  label('not nvfp4', 1.9, -1.85, 0, 0.3);
  recompute();
  return {
    view: { target: [-0.15, 0, 0], radius: 40, theta: 0.13, phi: 1.12, size: 2.6 },
    update(dt) {
      if (playing) { clock += dt; if (clock >= 3) { clock = 0; beat = (beat + 1) % 4; } }
      const k = ease(dt, 7), h = inputs[input - 1];
      marker.position.set(3.15, 0.04, (beat - 1.5) * 0.54);
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) { const i = r * 4 + c; current[i] += (wq[r][c] - current[i]) * k; setBar(bars[i], -3.25 + c * 0.5, (r - 1.5) * 0.54, current[i], 0.24, 0.24); }
        currentH[r] += (h[r] - currentH[r]) * k; currentY[r] += (y[r] - currentY[r]) * k; currentQ[r] += (yq[r] - currentQ[r]) * k;
        const z = (r - 1.5) * 0.54;
        setBar(hbars[r], 0, z, currentH[r], 0.32, 0.32);
        setBar(yout[r], 1.85, z, currentY[r], 0.34, 0.34);
        setBar(ybars[r], 2.35, z, currentQ[r], 0.32, 0.32);
        setBar(errors[r], 2.85, z, Math.abs(currentQ[r] - currentY[r]), 0.18, 0.22, 5);
      }
      const maxError = Math.max(...y.map((v, i) => Math.abs(yq[i] - v)));
      out({ playing, readout: `int${bits} · per ${group} · max |yq−y| ${maxError.toFixed(3)} · y0 ${y[0].toFixed(3)}→${yq[0].toFixed(3)} · h${input}` });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      else if (name === 'step') { playing = false; beat = (beat + (Number(arg) || 1) + 4) % 4; clock = 0; }
      else if (name === 'back') { playing = false; beat = (beat - (Number(arg) || 1) + 4) % 4; clock = 0; }
      else if (name === 'bits' && [2,3,4,8].includes(Number(arg))) { bits = Number(arg); recompute(); }
      else if (name === 'group' && ['tensor','row'].includes(arg)) { group = arg; recompute(); }
      else if (name === 'input' && [1,2].includes(Number(arg))) { input = Number(arg); recompute(); }
    },
  };
}
