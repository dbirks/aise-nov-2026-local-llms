import { THREE, lam, emitter } from './_kit.js';

const devices = [
  { name: 'RTX 5090', cap: 32, bw: 1792, key: 'gpu', x: -2.5, z: 0 },
  { name: 'DGX Spark', cap: 128, bw: 273, key: 'spark', x: 1.5, z: 2.2 },
  { name: 'M4 Max', cap: 128, bw: 546, key: 'm4', x: 1.5, z: -0.8 },
  { name: 'Ryzen AI Max+ 395', cap: 128, bw: 256, key: 'amd', x: 1.5, z: -3.8 },
];
export default function build(scene, emit) {
  const group = new THREE.Group(); scene.add(group); const out = emitter(emit);
  const box = new THREE.BoxGeometry(1, 1, 1); let focus = 'spark', playing = true, beat = 0, clock = 0;
  function label(text, x, y, z, h = .32) {
    const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = 'bold 72px monospace'; c.width = Math.ceil(g.measureText(text).width) + 20; c.height = 92; g.font = 'bold 72px monospace'; g.fillStyle = '#111'; g.textBaseline = 'middle'; g.fillText(text, 10, 46);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); h = Math.max(h, .58); s.scale.set(h * c.width / c.height, h, 1); s.position.set(x, y, z); s.renderOrder = 10; group.add(s); return s;
  }
  const floor = new THREE.Mesh(box, lam(0xaaaaaa)); floor.scale.set(6.8,.035,4.8); floor.position.set(-.3,-.05,-.1); group.add(floor);
  label('capacity GB →', 2.4,-.6,2.7); label('bandwidth GB/s ↑', -3.4,5.5,0);
  [32,64,128].forEach(n => label(String(n), -3.83 + n / 128 * 5.33,-.3,2.35,.25));
  [250,500,1000,1800].forEach(n => label(String(n), -3.25,n / 1800 * 4.4,0,.25));
  const items = devices.map(d => {
    const g = new THREE.Group(); group.add(g); const h = d.bw / 1800 * 4.4, w = d.cap / 128 * 1.1;
    const mesh = new THREE.Mesh(box, lam(0x333333)); mesh.scale.set(w,h,.48); mesh.position.set(d.x,h/2,d.z); g.add(mesh);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({color:0x111111})); edge.scale.copy(mesh.scale); edge.position.copy(mesh.position); g.add(edge);
    label(d.name, d.key === 'gpu' ? d.x + 1.1 : d.x, d.key === 'gpu' ? h - 0.45 : h + .55, d.z, .58);
    return {d, mesh, edge};
  });
  return { view:{target:[0,2,0],radius:40,theta:.45,phi:1.0,size:4.4}, update(dt) {
    if (playing) { clock += dt; if(clock > 3) { clock = 0; beat = (beat+1)%4; } }
    items.forEach(({d,mesh,edge}) => { const active = focus === 'all' || d.key === 'gpu' || d.key === focus; mesh.material.color.setHex(active ? 0x333333 : 0xcccccc); edge.material.color.setHex(active ? 0x111111 : 0xaaaaaa); });
    const other = devices.find(d => d.key === focus);
    const readout = other ? `spec sheets · ${other.name} holds ${other.cap / 32}× more · 5090 bandwidth ${(1792 / other.bw).toFixed(1)}×` : 'spec sheets · capacity and rated bandwidth · all four';
    out({playing, readout});
  }, action(name,arg) { if(name === 'focus' && ['spark','m4','all'].includes(arg)) focus=arg; else if(name === 'play') playing=typeof arg === 'boolean' ? arg : !playing; else if(name === 'step' || name === 'back') { playing=false; const opts=['spark','m4','all']; focus=opts[(opts.indexOf(focus)+(name === 'back' ? -1 : 1)+opts.length)%opts.length]; clock=0; } } };
}
