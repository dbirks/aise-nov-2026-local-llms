import { THREE, lam, emitter } from './_kit.js';
import { WORDS, quantizeWords } from './_words.js';

export default function build(scene, emit) {
  const root = new THREE.Group(); scene.add(root); const dynamic = new THREE.Group(); root.add(dynamic);
  const out = emitter(emit), ink = new THREE.LineBasicMaterial({color:0x222222}), solid = lam(0x222222);
  const choices = [16,8,4,3,2]; let bits=16, word='Germany', playing=true, clock=0, data;
  function label(text,x,y,z,h=0.34,parent=root) {
    const c=document.createElement('canvas'), g=c.getContext('2d'); g.font='bold 72px monospace'; c.width=Math.ceil(g.measureText(text).width)+20; c.height=92; g.font='bold 72px monospace'; g.fillStyle='#111'; g.textBaseline='middle'; g.fillText(text,10,46);
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false})); s.scale.set(h*c.width/c.height,h,1); s.position.set(x,y,z); s.renderOrder=10; parent.add(s); return s;
  }
  function line(points,parent=dynamic) { const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),ink); parent.add(l); }
  function clear() { dynamic.traverse(o=>{if(o.geometry)o.geometry.dispose(); if(o.isSprite){o.material.map.dispose();o.material.dispose();}}); dynamic.clear(); }
  label('hollow: original',-1.5,2.95,0); label('solid: rounded',1.4,2.95,0);
  label('toy vectors; real weights',0,-3.4,0); label('mostly layer matrices',0,-3.8,0);
  function rebuild() {
    clear(); data=quantizeWords(bits); const index=WORDS.findIndex(w=>w.word===word), original=WORDS[index], quant=data.words[index];
    for(let axis=0;axis<3;axis++) {
      const y=1.9-axis*1.15, z=(axis-1)*0.16, orig=original.v[axis], snapped=quant.v[axis];
      line([[-3,y,z],[3,y,z]]); label('xyz'[axis],-3.35,y,z,0.4,dynamic);
      if(bits<=4) { for(let q=-data.qmax-1;q<=data.qmax;q++) {const x=q*data.scale; if(Math.abs(x)<=3) line([[x,y-0.10,z],[x,y+0.10,z]]); } }
      else { for(let x=-3;x<=3;x+=0.12) line([[x,y-0.08,z],[x+0.06,y+0.08,z]]); }
      const marker=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.19,0.19,0.19)),ink); marker.position.set(orig,y+0.34,z); dynamic.add(marker);
      const cube=new THREE.Mesh(new THREE.BoxGeometry(0.19,0.19,0.19),solid); cube.position.set(snapped,y,z); dynamic.add(cube);
      line([[orig,y+0.2,z],[orig,y+0.14,z],[snapped,y+0.14,z],[snapped,y+0.08,z]]);
      const equation=bits===16 ? `${'xyz'[axis]}  ${orig.toFixed(2)}  original` : `${'xyz'[axis]}  ${orig.toFixed(2)} → ${quant.q[axis]} × ${data.scale.toFixed(3)} = ${snapped.toFixed(2)}`;
      label(equation,0,y-0.42,z,0.3,dynamic);
    }
    label(bits>=8?'levels too dense to draw':'ticks: allowed levels',0,-1.85,0,0.34,dynamic);
    label(word,0,2.5,0,0.4,dynamic);
  }
  rebuild();
  return { view:{target:[0,-0.25,0],radius:40,theta:0,phi:Math.PI/2,size:4.4},
    update(dt) { if(playing && (clock+=dt)>=2.5){clock=0;bits=choices[(choices.indexOf(bits)+1)%choices.length];rebuild();} const i=WORDS.findIndex(w=>w.word===word), v=WORDS[i].v[0], q=data.words[i];
      out({playing,readout:bits===16?`simulated · ${word} · 16 bits · x ${v.toFixed(2)} · original`:`simulated · ${word} · ${bits} bits · x ${v.toFixed(2)} → ${q.q[0]} × ${data.scale.toFixed(3)} = ${q.v[0].toFixed(2)}`}); },
    action(name,arg) { if(name==='play') playing=typeof arg==='boolean'?arg:!playing; else if(name==='step'){bits=choices[(choices.indexOf(bits)+(Number(arg)<0?-1:1)+choices.length)%choices.length];clock=0;rebuild();} else if(name==='bits' && choices.includes(Number(arg))){bits=Number(arg);playing=false;clock=0;rebuild();} else if(name==='word' && WORDS.some(w=>w.word===arg)){word=arg;rebuild();} }
  };
}
