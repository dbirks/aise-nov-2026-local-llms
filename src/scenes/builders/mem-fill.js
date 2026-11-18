import { THREE, lam, ease, emitter } from './_kit.js';

export default function build(scene, emit) {
  const group = new THREE.Group(); scene.add(group); const out = emitter(emit), box = new THREE.BoxGeometry(1,1,1);
  let size = 20, playing = true, clock = 0, beat = 0, fill = 0;
  function label(text,x,y,z,h=.34) { const c=document.createElement('canvas'), g=c.getContext('2d'); g.font='bold 72px monospace'; c.width=Math.ceil(g.measureText(text).width)+20; c.height=92; g.font='bold 72px monospace'; g.fillStyle='#111'; g.textBaseline='middle'; g.fillText(text,10,46); const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false})); h=Math.max(h,.52); s.scale.set(h*c.width/c.height,h,1); s.position.set(x,y,z); s.renderOrder=10; group.add(s); return s; }
  function block(x,y,z,w,h,d,mat) { const m=new THREE.Mesh(box,mat); m.position.set(x,y,z); m.scale.set(w,h,d); group.add(m); return m; }
  const solid=lam(0x333333), line=new THREE.LineBasicMaterial({color:0x111111});
  const specs=[{name:'RTX 5090',cap:32,bw:1792,x:-2.4,w:1.05},{name:'DGX Spark',cap:128,bw:273,x:1.5,w:4.2}];
  const items=specs.map(d=>{
    const tank=new THREE.LineSegments(new THREE.EdgesGeometry(box),line); tank.position.set(d.x,1.8,0); tank.scale.set(d.w,3.6,.8); group.add(tank);
    block(d.x,3.95,0,Math.max(.16,d.bw/1792*.8),.55,.5,solid);
    label(d.name,d.x,5.05,0,.34); 
    const model=block(d.x,0,0,d.w*.8,.01,.6,lam(0x555555));
    const hatch=new THREE.Group(); group.add(hatch);
    const fit=label("doesn't fit",d.x,-.55,0,.3), time=label('',d.x,-1,0,.3);
    return {d,model,hatch,fit,time};
  });
  
  function setText(sprite,text) { const c=sprite.material.map.image,g=c.getContext('2d'); g.clearRect(0,0,c.width,c.height); g.font='bold 72px monospace'; g.fillStyle='#111'; g.textBaseline='middle'; g.fillText(text,10,46); sprite.material.map.needsUpdate=true; }
  // Allocate enough canvas width for dynamic time labels.
  items.forEach(({time}) => { const c=time.material.map.image; c.width=700; time.scale.x=time.scale.y*c.width/c.height; });
  return {view:{target:[0,2,0],radius:40,theta:.08,phi:1.3,size:3.8},update(dt){
    if(playing){clock+=dt;if(clock>3){clock=0;beat=(beat+1)%4;}} fill += (1-fill)*ease(dt,6);
    items.forEach(({d,model,hatch,fit,time})=>{ const h=Math.min(size/d.cap*3.6, 4.25); model.scale.y=Math.max(.01,h*fill); model.position.y=model.scale.y/2; fit.visible=size>d.cap;
      while(hatch.children.length){const o=hatch.children[0]; hatch.remove(o); o.geometry.dispose();} if(size>d.cap){ for(let i=0;i<7;i++){const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(d.x-d.w*.4,3.6+i*.17,.32),new THREE.Vector3(d.x+d.w*.4,3.6+i*.17+.35,.32)]),line); hatch.add(l);}}
      time.visible=false;
    });
    out({playing,readout:`spec math · ${size} GB · read once: ${Math.round(size/1792*1000)} ms on 5090, ${Math.round(size/273*1000)} ms on spark (lower bound)`});
  },action(name,arg){if(name==='model' && [20,60,110].includes(Number(arg))){size=Number(arg);fill=0;} else if(name==='play') playing=typeof arg==='boolean'?arg:!playing; else if(name==='step'||name==='back'){playing=false;const opts=[20,60,110];size=opts[(opts.indexOf(size)+(name==='back'?-1:1)+opts.length)%opts.length];clock=0;fill=0;}}};
}
