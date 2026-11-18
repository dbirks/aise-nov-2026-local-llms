import { THREE, lam, emitter } from './_kit.js';
export default function build(scene, emit) {
 const g=new THREE.Group(); scene.add(g); const out=emitter(emit), box=new THREE.BoxGeometry(1,1,1), mat=lam(0x333333); let lane='all',playing=true,beat=0,clock=0;
 function label(s,x,y,h=0.32,parent=g){const c=document.createElement('canvas'),p=c.getContext('2d');p.font='bold 72px monospace';c.width=Math.ceil(p.measureText(s).width)+20;c.height=92;p.font='bold 72px monospace';p.fillStyle='#111';p.textBaseline='middle';p.fillText(s,10,46);const v=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));v.scale.set(h*c.width/c.height,h,1);v.position.set(x,y,0.5);parent.add(v);return v;}
 function line(ps,parent){const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(ps.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color:0x111111}));parent.add(l);}
 function arrow(x,y,x2,y2,parent){const a=new THREE.Vector3(x,y,0),d=new THREE.Vector3(x2-x,y2-y,0);parent.add(new THREE.ArrowHelper(d.clone().normalize(),a,d.length(),0x111111,0.12,0.08));}
 const names=['EAGLE-3','DFlash','DSpark','DFlash2'], passes=['6 passes','1 pass','1 + head','1 + selector'], groups=[], slots=[];
 label('drafter passes',-3.1,2.8,0.3); label('draft slots',1.1,2.8,0.3);
 names.forEach((n,r)=>{const row=new THREE.Group();g.add(row);groups.push(row);const y=2-r*1.35;label(n,-3.05,y+0.28,0.33,row);label(passes[r],-3.05,y-0.14,0.3,row); const cells=[];slots.push(cells);
 for(let i=0;i<6;i++){const x=-0.8+i*0.8,m=new THREE.Mesh(box,mat);m.position.set(x,y,0);m.scale.set(0.48,0.28,0.25);row.add(m);cells.push(m);if(i&&r===0)arrow(x-0.52,y,x-0.27,y,row);if(i&&r===2)arrow(x-0.52,y+0.33,x-0.27,y+0.33,row);if(i&&r===3)arrow(x-0.52,y+0.33,x-0.27,y+0.33,row);}
 if(r===0)label('target hidden states',1.2,y-0.43,0.27,row); else {line([[-1.05,y+0.31,0],[-1.05,y+0.48,0],[3.45,y+0.48,0],[3.45,y+0.31,0]],row);label(r===1?'bidirectional block':r===2?'parallel + head':'parallel + selector',1.15,y-0.42,0.27,row);}
 if(r===3)label('no paper · version-dependent',1.1,y-0.76,0.26,row);
 });
 return {view:{target:[0,0,0],radius:40,theta:0,phi:Math.PI/2,size:3.8},update(dt){if(playing){clock+=dt;if(clock>2){clock=0;beat=(beat+1)%6;}}groups.forEach((row,i)=>{row.visible=lane==='all'||lane===names[i];slots[i].forEach((m,j)=>m.scale.z=j===beat?0.5:0.25);});const i=names.indexOf(lane);out({playing,readout:lane==='all'?'mechanism · dflash: 1 drafter pass for 6 slots · target verifies all':`mechanism · ${lane.toLowerCase()}: ${passes[i]} for 6 slots · target verifies`});},action(name,arg){if(name==='play')playing=typeof arg==='boolean'?arg:!playing;else if(name==='step'){beat=(beat+(Number(arg)||1)+6)%6;clock=0;}else if(name==='lane'&&['all',...names].includes(arg))lane=arg;}};
}
