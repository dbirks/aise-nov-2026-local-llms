import { THREE, lam, ease, emitter } from './_kit.js';
function box(scene,x,y,w,h,d=0.24,c=0xc8c8c8) { const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),lam(c)); m.position.set(x,y,0); scene.add(m); const e=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),new THREE.LineBasicMaterial({color:0x111111})); m.add(e); return m; }
function label(scene,text,x,y,h=0.36) { const c=document.createElement('canvas'),g=c.getContext('2d'); g.font='bold 72px sans-serif'; c.width=Math.ceil(g.measureText(text).width)+16; c.height=88; g.font='bold 72px sans-serif'; g.fillStyle='#111'; g.textBaseline='middle'; g.fillText(text,8,44); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthTest:false})); s.scale.set(h*c.width/c.height,h,1); s.position.set(x,y,0.8); s.renderOrder=10; scene.add(s); return s; }
function line(scene,x1,y1,x2,y2,width=0.07,c=0x222222) { const dx=x2-x1,dy=y2-y1; const m=box(scene,(x1+x2)/2,(y1+y2)/2,Math.hypot(dx,dy),width,0.1,c); m.rotation.z=Math.atan2(dy,dx); return m; }
const names=['model-a 27B','model-b 35B-A3B','model-c 8B'];
export default function build(scene,emit){
 const out=emitter(emit); let selected=0,playing=true,t=0;
 box(scene,-3.6,0,1.5,1.1); label(scene,'client',-3.6,0.9,0.4); label(scene,'API key',-3.6,-0.1);
 box(scene,-0.8,0,2.25,2.7); label(scene,'gateway',-0.8,1.7,0.4); label(scene,'/models',-0.8,1.05);
 const rows=names.map((n,i)=>label(scene,n,-0.8,0.52-i*0.55,0.29));
 const homes=[]; for(let i=0;i<3;i++){let y=2.1-i*2.1; box(scene,3.1,y,2.2,1.5); label(scene,`home ${i+1}`,3.1,y+0.45,0.34); label(scene,'GPU',2.55,y-0.08,0.32); label(scene,names[i],3.2,y-0.4,0.27); homes.push(line(scene,0.35,0,2,y,0.06,0x777777));}
 line(scene,-2.85,0,-1.95,0); const packet=box(scene,0,0,0.26,0.2,0.3,0x111111); const marker=box(scene,-1.75,0,0.1,0.25,0.3,0x111111); label(scene,'request / response',0,-2.9,0.35);
 return {view:{target:[0,0,0],radius:40,theta:0,phi:Math.PI/2,size:4},update(dt){if(playing)t=(t+dt)%10; homes.forEach((m,i)=>m.material.color.setHex(i===selected?0x111111:0xaaaaaa)); marker.position.y=0.52-selected*.55; rows.forEach((s,i)=>s.material.opacity=i===selected?1:.55); let u=(t%10)/10; let v=u<.5?u*2:(1-u)*2; const dest=2.1-selected*2.1; if(v<.35){packet.position.set(-2.85+v/.35*.9,0,.4);}else{let q=(v-.35)/.65; packet.position.set(-1.95+q*3.95,q*dest,.4);} out({playing,readout:`simulated · model-${'abc'[selected]} → home ${selected+1} · one machine serves the whole request`});},action(n,a){if(n==='model'){let i=names.indexOf(a);if(i>=0)selected=i;t=0;}else if(n==='play')playing=typeof a==='boolean'?a:!playing;else if(n==='step'){playing=false;t=(Math.floor(t/2.5)+1)*2.5%10;}}};
}
