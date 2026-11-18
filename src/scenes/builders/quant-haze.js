import { THREE, lam, emitter } from './_kit.js';
import { WORDS, quantizeWords } from './_words.js';

export default function build(scene, emit) {
  const root = new THREE.Group(); scene.add(root);
  const out = emitter(emit), dark = lam(0x222222), faint = new THREE.LineBasicMaterial({ color: 0x888888 }), ink = new THREE.LineBasicMaterial({ color: 0x222222 });
  const dynamic = new THREE.Group(); root.add(dynamic);
  let bits = 16, playing = true, clock = 0, time = 0, data, arrows = [];
  const choices = [16, 8, 4, 3, 2];
  function label(text, x, y, z, height = 0.34, parent = root) {
    const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = 'bold 72px monospace'; c.width = Math.ceil(g.measureText(text).width) + 20; c.height = 92;
    g.font = 'bold 72px monospace'; g.fillStyle = '#111'; g.textBaseline = 'middle'; g.fillText(text, 10, 46);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); s.scale.set(height * c.width / c.height, height, 1); s.position.set(x,y,z); s.renderOrder = 10; parent.add(s); return s;
  }
  function line(a,b,mat=faint,parent=root) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a),new THREE.Vector3(...b)]), mat); parent.add(l); return l; }
  [[[-2.7,0,0],[2.8,0,0]],[[0,-2.7,0],[0,2.8,0]],[[0,0,-2.7],[0,0,2.8]]].forEach(([a,b]) => line(a,b));
  label('x',2.95,0,0); label('y',0,2.95,0); label('z',0,0,2.95);
  label('hollow: original',-1.2,-3.15,0); label('solid: rounded',1.3,-3.15,0);
  label('toy vectors; real weights',0,-3.6,0); label('mostly layer matrices',0,-4.0,0);
  function clear() { dynamic.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.isSprite) { o.material.map.dispose(); o.material.dispose(); } }); dynamic.clear(); }
  function rebuild() {
    clear(); data = quantizeWords(bits); arrows = [];
    if (bits <= 4) {
      const points = []; for (let i=-data.qmax-1;i<=data.qmax;i++) for (let j=-data.qmax-1;j<=data.qmax;j++) for (let k=-data.qmax-1;k<=data.qmax;k++) {
        const p=[i*data.scale,j*data.scale,k*data.scale]; if (p.every(v => Math.abs(v)<=2.45)) points.push(...p);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3)); dynamic.add(new THREE.Points(geo,new THREE.PointsMaterial({color:0x999999,size:0.045})));
    } else label(bits === 8 ? 'grid too fine to draw' : 'original values',0,3.35,0,0.34,dynamic);
    WORDS.forEach((w,i) => {
      const orig = new THREE.Vector3(...w.v), tip = new THREE.Vector3(...data.words[i].v);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,1,8),dark), cone = new THREE.Mesh(new THREE.ConeGeometry(0.10,0.25,8),dark);
      dynamic.add(shaft,cone);
      const cube = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.17,0.17,0.17)),ink); cube.position.copy(orig); dynamic.add(cube);
      const err = line(w.v,data.words[i].v,ink,dynamic);
      const name = label(w.word,tip.x,tip.y+0.24,tip.z,0.28,dynamic);
      arrows.push({shaft,cone,tip,orig,err,name,i});
    });
  }
  rebuild();
  return { view: { target:[0,0,0], radius:40, theta:0.5, phi:1.15, size:4.6 },
    update(dt) {
      time += dt; if (playing && (clock += dt) >= 2.5) { clock = 0; bits = choices[(choices.indexOf(bits)+1)%choices.length]; rebuild(); }
      for (const a of arrows) {
        const error = a.orig.distanceTo(a.tip), p = a.tip.clone().add(new THREE.Vector3(0,Math.sin(time*38+a.i)*error,0));
        const length = p.length(), dir = p.clone().normalize(); a.shaft.position.copy(p).multiplyScalar(0.5); a.shaft.scale.set(1,Math.max(0.001,length-0.12),1); a.shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);
        a.cone.position.copy(p); a.cone.quaternion.copy(a.shaft.quaternion); a.name.position.copy(p).add(new THREE.Vector3(0,0.24,0));
      }
      const max = Math.max(...WORDS.flatMap((w,i)=>w.v.map((v,j)=>Math.abs(v-data.words[i].v[j]))));
      out({ playing, readout: bits === 16 ? 'simulated · 16 bits · original baseline · max error 0.00' : `simulated · ${bits} bits · ${2**bits} levels · scale ${data.scale.toFixed(3)} · max error ${max.toFixed(2)}` });
    },
    action(name,arg) { if(name==='play') playing=typeof arg==='boolean'?arg:!playing; else if(name==='step') { bits=choices[(choices.indexOf(bits)+(Number(arg)<0?-1:1)+choices.length)%choices.length]; clock=0; rebuild(); } else if(name==='bits' && choices.includes(Number(arg))) { bits=Number(arg); playing=false; clock=0; rebuild(); } }
  };
}
