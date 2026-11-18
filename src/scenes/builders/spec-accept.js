import { THREE, lam, ease, emitter } from './_kit.js';

const words = ['the','cat','dog','sat','ran','end'];
const q = [0.20,0.25,0.25,0.10,0.10,0.10], baseP = [0.30,0.10,0.02,0.20,0.18,0.20];
export default function build(scene, emit) {
  const group = new THREE.Group(); scene.add(group);
  const out = emitter(emit), box = new THREE.BoxGeometry(1,1,1), dark = lam(0x222222), mid = lam(0x888888), pale = lam(0xc5c5c5);
  let word = 'the', greedy = false, playing = true, beat = 0, clock = 0;
  const bars = [], residual = [], markers = [];
  function label(text,x,y,z=0,size=0.32) { const c=document.createElement('canvas'),g=c.getContext('2d'); g.font='bold 72px monospace'; c.width=Math.ceil(g.measureText(text).width)+20;c.height=92;g.font='bold 72px monospace';g.fillStyle='#111';g.textBaseline='middle';g.fillText(text,10,46);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));s.position.set(x,y,z);s.scale.set(size*c.width/c.height,size,1);s.renderOrder=10;group.add(s); }
  function mesh(mat) {const m=new THREE.Mesh(box,mat);group.add(m);return m;}
  label('q drafter',-3.15,2.05); label('p target',-3.15,0.45); label('resample',-3.15,-1.3); label('toy probabilities',0,2.55); label('accept p / q',3.35,1.55);
  for(let i=0;i<6;i++) { const x=-2+i*0.73; label(words[i],x,-2.35,0,0.28); bars.push([mesh(mid),mesh(dark)]); residual.push(mesh(dark)); markers.push(mesh(dark)); }
  const gauge=mesh(dark), gaugeBack=mesh(pale); gaugeBack.position.set(3.3,0,0);gaugeBack.scale.set(0.65,2,0.15);
  const heights=Array.from({length:6},()=>[0,0,0]);
  return {view:{target:[0,0,0],radius:40,theta:0.12,phi:1.45,size:3.1}, update(dt) {
    if(playing){clock+=dt;if(clock>=3){clock=0;beat=(beat+1)%4;}}
    const p=greedy?baseP.map((v,i)=>i===baseP.indexOf(Math.max(...baseP))?1:0):baseP;
    const diff=p.map((v,i)=>Math.max(0,v-q[i])), total=diff.reduce((a,b)=>a+b,0), idx=words.indexOf(word), prob=Math.min(1,p[idx]/q[idx]);
    const showResidual=beat>=2 && prob<1;
    for(let i=0;i<6;i++){const x=-2+i*0.73;const vals=[q[i],p[i],showResidual&&total?diff[i]/total:0];for(let j=0;j<3;j++){heights[i][j]+=(vals[j]-heights[i][j])*ease(dt,7);const m=j<2?bars[i][j]:residual[i],h=Math.max(0.005,heights[i][j]*1.15);m.position.set(x, [0.75,-0.85,-2][j]+h/2, j===0?-0.25:0.15);m.scale.set(0.4,h,0.22);}markers[i].position.set(x,-2.1,0.3);markers[i].scale.set(0.48,0.08,0.2);markers[i].visible=i===idx;}
    gauge.scale.set(0.5,Math.max(0.005,2*prob),0.25);gauge.position.set(3.3,-1+prob,0.2);
    out({playing,readout:`simulated · drafted "${word}" · p ${p[idx].toFixed(2)} q ${q[idx].toFixed(2)} · accept ${Math.round(prob*100)}%${prob<1?' · else resample':''}`});
  },action(name,arg){if(name==='play')playing=typeof arg==='boolean'?arg:!playing;else if(name==='step'){beat=(beat+(Number(arg)||1)+4)%4;clock=0;}else if(name==='word'&&['the','cat','dog'].includes(arg)){word=arg;beat=2;}else if(name==='greedy'){greedy=!!arg;beat=2;}}};
}
