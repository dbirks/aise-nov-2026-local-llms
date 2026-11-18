import { THREE, lam, emitter } from './_kit.js';
import { WORDS } from './_words.js';

export default function build(scene, emit) {
  const out = emitter(emit), group = new THREE.Group(); scene.add(group);
  let selected = 0, playing = true, clock = 0;
  function label(text, x, y, z, height = 0.25) {
    const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = 'bold 72px monospace'; c.width = Math.ceil(g.measureText(text).width) + 24; c.height = 96;
    g.font = 'bold 72px monospace'; g.fillStyle = '#111'; g.textBaseline = 'middle'; g.fillText(text, 12, 48);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); s.scale.set(height * c.width / c.height, height, 1); s.position.set(x,y,z); s.renderOrder = 10; group.add(s); return s;
  }
  function line(a,b,color=0xbbbbbb) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a),new THREE.Vector3(...b)]),new THREE.LineBasicMaterial({color})); group.add(l); }
  for (let i=-2;i<=3;i++) { line([i,0,-2],[i,0,2],0xdddddd); line([-2,0,i],[3,0,i],0xdddddd); }
  for (let axis=0;axis<3;axis++) { const end=[0,0,0]; end[axis]=3; line([0,0,0],end,0xaaaaaa); for(let i=1;i<=3;i++){const a=[0,0,0],b=[0,0,0]; a[axis]=b[axis]=i; a[(axis+1)%3]=-.06;b[(axis+1)%3]=.06;line(a,b,0xaaaaaa);} }
  const arrows=[], rows=[];
  WORDS.forEach((w,i)=>{
    const v=new THREE.Vector3(...w.v), len=v.length(), dir=v.clone().normalize(), material=lam(0x777777);
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,Math.max(.01,len-.18),8),material); shaft.position.copy(dir.clone().multiplyScalar((len-.18)/2)); shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir); group.add(shaft);
    const tip=new THREE.Mesh(new THREE.ConeGeometry(.09,.22,8),material); tip.position.copy(dir.clone().multiplyScalar(len-.1)); tip.quaternion.copy(shaft.quaternion); group.add(tip); arrows.push(material);
    // Stagger labels vertically to preserve readability in the fixed overview.
    label(w.word, 3.45, 2.65-i*.38, 0, .25); line(w.v,[3.0,2.65-i*.38,0],0xcccccc);
    rows.push(label(`${w.word.padEnd(12)} [ ${w.v.map(n=>n.toFixed(2).padStart(5)).join(' ')} ]`, .65,-1.05-i*.34,0,.23));
  });
  line([-2.2,-.85,0],[-2.2,-3.35,0],0x777777); line([3.45,-.85,0],[3.45,-3.35,0],0x777777);
  return { view:{target:[.6,-.3,0],radius:40,theta:.1,phi:1.24,size:3.8}, update(dt){if(playing){clock+=dt;if(clock>=1.5){clock=0;selected=(selected+1)%WORDS.length;}} arrows.forEach((m,i)=>m.color.setHex(i===selected?0x111111:0x999999)); rows.forEach((s,i)=>s.material.color.setHex(i===selected?0x111111:0x888888)); const w=WORDS[selected];out({playing,readout:`simulated · ${w.word} = [${w.v.map(n=>n.toFixed(2)).join(', ')}] · 3 numbers per word`});}, action(name,arg){if(name==='play') playing=typeof arg==='boolean'?arg:!playing; else if(name==='step'){selected=(selected+(Number(arg)||1)+WORDS.length)%WORDS.length;clock=0;} else if(name==='word'){const i=WORDS.findIndex(w=>w.word===arg);if(i>=0){selected=i;playing=false;clock=0;}}} };
}
