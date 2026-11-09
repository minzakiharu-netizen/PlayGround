import * as THREE from 'three'
import { TEX, initTextures, texturedMaterial, signMaterial, bloodMaterial } from './textures.js'

const $ = (id) => document.getElementById(id)
const ui = Object.fromEntries(['menu','loading','loadFill','loadText','hud','objectiveText','objectiveSub','fusePips','healthFill','healthState','ammoMag','ammoReserve','reloadHint','crosshair','hitmarker','interactPrompt','promptKey','promptText','subtitle','toast','recTime','damageFlash','pause','note','noteTitle','noteTag','noteBody','noteSign','death','deathTime','deathFuses','deathLine','win','winTime','winShots','chapterCard','introWhisper','desktopHint','stick','stickKnob','btnAim','btnFire','btnReload','btnLight','btnInteract','lightBtn','rotateNotice','rotateContinue','soundBtn','muteBtn','compassObjective','compassTape'].map(id => [id, $(id)]))
const clamp = THREE.MathUtils.clamp
const clock = new THREE.Clock()
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x080a09)
scene.fog = new THREE.FogExp2(0x080a09, 0.027)
const camera = new THREE.PerspectiveCamera(73, innerWidth / innerHeight, 0.08, 95)
const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.65))
renderer.setSize(innerWidth, innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.13

initTextures()
const mats = {
  wall: texturedMaterial(TEX.wallpaper, TEX.wallpaperBump, [2.4, 1.1], { bumpScale: 0.045, roughness: 0.96 }),
  floor: texturedMaterial(TEX.floor, TEX.floorBump, [2, 1.2], { bumpScale: 0.07 }),
  carpet: texturedMaterial(TEX.carpet, null, [1, 2], { roughness: 1 }),
  ceiling: texturedMaterial(TEX.ceiling, null, [2, 2], { roughness: 1, side: THREE.DoubleSide }),
  concrete: texturedMaterial(TEX.concrete, TEX.concreteBump, [2, 2], { bumpScale: 0.065 }),
  metal: texturedMaterial(TEX.metal, TEX.metalBump, [1, 1], { bumpScale: 0.035, metalness: 0.42 }),
  door: texturedMaterial(TEX.door, TEX.doorBump, [1, 1], { bumpScale: 0.05 }),
  fabric: texturedMaterial(TEX.fabric, null, [2, 2]),
  dark: new THREE.MeshStandardMaterial({ color: 0x151713, roughness: .92 }),
  brass: new THREE.MeshStandardMaterial({ color: 0x78623b, roughness: .34, metalness: .72 }),
  bone: new THREE.MeshStandardMaterial({ color: 0xaaa18b, roughness: .8 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x7e3425, emissive: 0x45130e, emissiveIntensity: 1.5, roughness: .3 }),
  lamp: new THREE.MeshStandardMaterial({ color: 0xffdf9a, emissive: 0xffb84f, emissiveIntensity: 2.2 })
}
const world = new THREE.Group(); scene.add(world)
const colliders = []
const interactive = []
const lights = []
let player, flashlight, weapon, muzzle, enemy, exitDoor, generatorSwitch
let running = false, paused = false, ended = false, noteOpen = false
let elapsed = 0, health = 100, mag = 8, reserve = 24, shots = 0, fuses = 0, powered = false
let lightOn = true, aiming = false, reloading = false, fireCooldown = 0, reloadClock = 0
let yaw = 0, pitch = 0, moveX = 0, moveZ = 0, lookX = 0, lookY = 0, bob = 0, hurtTimer = 0
let nearest = null, audioCtx = null, masterGain = null, soundOn = true, lastStep = 0, lastEnemyAttack = 0
const keys = new Set()
const fuseLocations = [new THREE.Vector3(-10, 0, -11), new THREE.Vector3(10, 0, 1), new THREE.Vector3(-10, 0, 12)]

function box(name, x, y, z, sx, sy, sz, material, { collision = false, shadow = true, parent = world, rotation = 0 } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material)
  mesh.name = name; mesh.position.set(x, y, z); mesh.rotation.y = rotation
  mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh)
  if (collision) colliders.push({ x, z, hx: sx / 2, hz: sz / 2 })
  return mesh
}
function cylinder(name, x, y, z, rTop, rBottom, height, material, segments = 12, parent = world) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, height, segments), material)
  m.name = name; m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m
}
function sphere(name, x,y,z,r,material,parent=world) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), material); m.name=name; m.position.set(x,y,z); m.castShadow=true; parent.add(m); return m
}
function pointLight(color, intensity, distance, x,y,z, parent=world) {
  const l = new THREE.PointLight(color,intensity,distance,2); l.position.set(x,y,z); l.castShadow=false; parent.add(l); return l
}
function addInteract(obj, type, label, position, data={}) {
  obj.userData = { type, label, interactPosition: position.clone(), ...data }; interactive.push(obj); return obj
}
function sign(x,y,z,tex,w=2.1,h=.72, rotation=0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w,h), signMaterial(tex)); m.position.set(x,y,z); m.rotation.y=rotation; world.add(m); return m
}
function buildRoom() {
  // The main corridor and three open ward bays form a compact, readable floor plan.
  box('west wing floor', -9, -.12, 0, 13, .24, 44, mats.floor)
  box('east wing floor', 9, -.12, 0, 13, .24, 44, mats.floor)
  box('main runner', 0, -.095, 0, 5, .2, 44, mats.carpet)
  box('ceiling west', -9, 3.42, 0, 13, .18, 44, mats.ceiling)
  box('ceiling east', 9, 3.42, 0, 13, .18, 44, mats.ceiling)
  box('ceiling hall', 0, 3.42, 0, 5, .18, 44, mats.ceiling)
  // Outer perimeter, solid segments with the north exit opening.
  box('west perimeter', -15.55, 1.65, 0, .35, 3.3, 44, mats.wall, {collision:true})
  box('east perimeter', 15.55, 1.65, 0, .35, 3.3, 44, mats.wall, {collision:true})
  box('south perimeter west', -7.5, 1.65, 22, 16, 3.3, .35, mats.wall, {collision:true})
  box('south perimeter east', 7.5, 1.65, 22, 16, 3.3, .35, mats.wall, {collision:true})
  box('north perimeter west', -8.5, 1.65, -22, 14, 3.3, .35, mats.wall, {collision:true})
  box('north perimeter east', 8.5, 1.65, -22, 14, 3.3, .35, mats.wall, {collision:true})
  // Spine walls with three doorway gaps on each side.
  for (const side of [-1,1]) {
    const x = side * 2.58
    for (const [a,b] of [[-21.8,-14.5],[-11.5,-3.3],[-.7,7.2],[15.2,21.8]]) {
      box('hall partition', x,1.6,(a+b)/2,.3,3.2,b-a,mats.wall,{collision:true})
    }
    for (const z of [-14, -2, 10.8]) {
      // lintel and frame define walk-through thresholds without blocking them.
      box('door lintel', x,2.95,z,.48,.42,2.45,mats.door)
      box('door frame', x,1.5,z-1.28,.44,3,.18,mats.door)
      box('door frame', x,1.5,z+1.28,.44,3,.18,mats.door)
    }
  }
  // Wing cross-walls divide open rooms but leave the center aisle between rooms.
  for (const x of [-9,9]) for (const z of [-8.2,3.8,15.2]) {
    box('ward divider',x,1.55,z,12.7,3.1,.28,mats.wall,{collision:true})
  }
  // Blood smears and threshold debris.
  for (const [x,z,r] of [[-2.45,-8,.9],[2.5,5,.65],[9,-7,1.3],[-11,15,1.1],[1,17,.75]]) {
    const stain = new THREE.Mesh(new THREE.PlaneGeometry(r*2,r*1.35), bloodMaterial())
    stain.rotation.x=-Math.PI/2; stain.rotation.z=.4; stain.position.set(x,.012,z); world.add(stain)
  }
  sign(-2.39,2.2,-14,TEX.signRecords,1.45,.52,Math.PI/2)
  sign(2.39,2.2,-2,TEX.signWard,1.35,.52,-Math.PI/2)
  sign(-2.39,2.2,10.8,TEX.signChapel,1.55,.52,Math.PI/2)
  sign(0,2.2,-21.65,TEX.signGenerator,2.1,.62,0)
  sign(0,2.2,21.65,TEX.signExit,1.5,.5,Math.PI)
  buildExit()
  buildGenerator()
  buildWardProps()
  buildLights()
  buildFuseItems()
  buildNotes()
}

function buildExit() {
  const group = new THREE.Group(); world.add(group); group.position.set(0,0,21.5)
  box('exit leaf',0,1.5,0,2.7,3,.28,mats.metal,{parent:group,shadow:true})
  box('exit inset',0,1.5,-.17,2.15,2.5,.04,mats.dark,{parent:group,shadow:false})
  box('exit bar',0,1.35,-.28,1.3,.12,.1,mats.brass,{parent:group,shadow:false})
  const lamp=sphere('exit lamp',0,2.85,-.22,.11,mats.glass,group)
  exitDoor=addInteract(group,'exit','CHAINED EXIT',new THREE.Vector3(0,0,20.4))
}
function buildGenerator() {
  box('generator cabinet',0,1.15,-19.2,2.2,2.3,1.1,mats.metal,{collision:true})
  box('generator panel',0,1.35,-18.62,1.55,.9,.08,mats.dark)
  for (let i=0;i<3;i++) {
    const bulb=sphere('indicator',-.48+i*.48,1.56,-18.55,.075,i===0?mats.glass:mats.lamp)
    pointLight(i===0?0xff3020:0xc39c5e,.25,1,-.48+i*.48,1.56,-18.3)
  }
  cylinder('switch base',.65,1.12,-18.52,.11,.14,.12,mats.brass)
  const lever=cylinder('generator lever',.65,1.35,-18.52,.045,.045,.42,mats.bone,8)
  lever.rotation.z=-.42
  generatorSwitch=addInteract(lever,'generator','RESTORE POWER',new THREE.Vector3(0,0,-17.8))
}
function buildWardProps() {
  // Beds, desks, cabinets, chapel pews and scattered patient files.
  for (const [x,z,rot] of [[-11,-17,0],[-7,-5,.08],[-11,6,0],[11,-17,0],[7,-5,.08],[11,6,0]]) {
    box('iron bed frame',x,.48,z,2.6,.18,1.1,mats.metal,{collision:true,rotation:rot})
    box('mattress',x,.64,z-.04,2.35,.2,.96,mats.fabric,{rotation:rot})
    box('pillow',x,.79,z-.65,.65,.16,.48,mats.bone,{rotation:rot})
    for (const dx of [-1.1,1.1]) for (const dz of [-.38,.38]) cylinder('bed leg',x+dx,.22,z+dz,.045,.055,.48,mats.metal,8)
  }
  for (const [x,z] of [[-5,-17],[5,-5],[-5,6],[5,18]]) {
    box('desk',x,.85,z,1.8,.14,.9,mats.door,{collision:true})
    for (const dx of [-.72,.72]) for (const dz of [-.3,.3]) box('desk leg',x+dx,.42,z+dz,.09,.8,.09,mats.door,{collision:true})
    box('paper stack',x,.95,z-.06,.5,.035,.42,mats.bone)
    cylinder('desk lamp shade',x+.5,1.25,z,.17,.1,.2,mats.brass)
  }
  for (const [x,z] of [[-13,-3],[13,-15],[-13,9],[13,18]]) {
    box('wardrobe',x,1.35,z,1.25,2.7,.9,mats.door,{collision:true})
    box('wardrobe seam',x,1.35,z-.47,.04,2.4,.03,mats.dark)
    sphere('wardrobe knob',x+.38,1.3,z-.51,.055,mats.brass)
  }
  // chapel altar and pew rows
  box('altar',-9,.75,12.6,3,.2,1.3,mats.door,{collision:true})
  box('altar cloth',-9,1.12,12.55,3.05,.58,1.15,mats.fabric)
  cylinder('chapel candle',-9,1.52,12.25,.04,.04,.22,mats.bone,8)
  for (const rowZ of [9.4,11.1,14.4,16.1]) for (const x of [-11.6,-9,-6.4]) {
    box('chapel pew',x,.58,rowZ,2.2,.15,.45,mats.door,{collision:true})
    box('pew back',x,1.02,rowZ+.18,2.2,.75,.12,mats.door,{collision:true})
  }
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(2.3,3.1),new THREE.MeshBasicMaterial({map:TEX.glass,side:THREE.DoubleSide}))
  glass.position.set(-15.27,2.05,11); glass.rotation.y=Math.PI/2; world.add(glass)
  for (const [x,z] of [[-1.1,-13],[1.2,-1],[0.8,12]]) {
    // broken bedside stools / scattered crates make the lanes feel lived-in.
    box('fallen crate',x,.34,z,.65,.65,.65,mats.door,{collision:true,rotation:.18})
  }
  for (const [x,z,tex] of [[-2.38,-17,TEX.painting1],[2.38,4,TEX.painting2],[2.38,14,TEX.painting1]]) {
    const p=new THREE.Mesh(new THREE.PlaneGeometry(.9,1.15),new THREE.MeshStandardMaterial({map:tex,roughness:.88}))
    p.position.set(x,2.1,z);p.rotation.y=x<0?Math.PI/2:-Math.PI/2;world.add(p)
  }
}
function buildLights() {
  scene.add(new THREE.HemisphereLight(0x696d68,0x14120f,.22))
  const ambient = new THREE.AmbientLight(0x9b9883,.11); scene.add(ambient)
  for (const [x,z,color,intensity] of [[0,-16,0xd1b176,.36],[0,-5,0x947b54,.22],[0,7,0xb7a06c,.25],[0,18,0x7e342a,.2],[-9,-13,0x877b60,.16],[9,-1,0x877b60,.13],[-9,11,0x847750,.17]]) {
    const fixture=box('ceiling fixture',x,3.22,z,.8,.08,.28,mats.metal)
    const bulb=box('glow tube',x,3.16,z,.57,.035,.12,mats.lamp,{shadow:false})
    const l=pointLight(color,intensity,7,x,3.04,z); lights.push({light:l,base:intensity,phase:Math.random()*9})
  }
  flashlight=new THREE.SpotLight(0xffe6bc,4.2,22,Math.PI/8,.42,1.25)
  flashlight.castShadow=false; camera.add(flashlight); flashlight.position.set(.13,-.08,-.05)
  const target=new THREE.Object3D(); target.position.set(0,0,-1); camera.add(target); flashlight.target=target
  const fill=new THREE.PointLight(0xffdca8,.16,3); fill.position.set(0,0,0); camera.add(fill)
}
function buildFuseItems() {
  fuseLocations.forEach((p,i)=>{
    const g=new THREE.Group();world.add(g);g.position.copy(p);g.position.y=.9
    box('fuse ceramic',0,0,0,.2,.54,.2,mats.bone,{parent:g})
    box('fuse cap',0,.28,0,.24,.09,.24,mats.brass,{parent:g})
    box('fuse cap',0,-.28,0,.24,.09,.24,mats.brass,{parent:g})
    const glow=new THREE.PointLight(0xffc36b,.45,2);glow.position.set(0,.15,0);g.add(glow)
    const halo=new THREE.Mesh(new THREE.TorusGeometry(.35,.012,6,24),new THREE.MeshBasicMaterial({color:0xc5a66c,transparent:true,opacity:.46}))
    halo.rotation.x=Math.PI/2;halo.position.y=-.28;g.add(halo)
    addInteract(g,'fuse',`TAKE FUSE ${i+1}`,p.clone().add(new THREE.Vector3(0,.1,0)),{index:i,collected:false})
    g.userData.halo=halo
  })
}
function buildNotes() {
  const notes=[
    {p:new THREE.Vector3(-5,.99,-17), title:'THE THING IN THE WALLS', tag:'PATIENT INTAKE / 87-04', sign:'— DR. E. VALE', body:'October 6, 1987\n\nThe night staff hear movement inside the plaster. It follows the emergency lamps. It follows the sound of the generator.\n\nKeep the service light low. If the corridor goes quiet, do not mistake that for safety.'},
    {p:new THREE.Vector3(5,.99,18), title:'NIGHT SHIFT — FINAL ENTRY', tag:'SECURITY LOG / 02:14 AM', sign:'— M. HOLLIS', body:'The exit chain releases from the generator room. Three ceramic fuses. I put one in each wing because I could not carry them all.\n\nSomething is walking the hall. It does not like the pistol, but it does not stop for long. Save your rounds.'}
  ]
  notes.forEach((n,i)=>{
    const paper=box('patient file',n.p.x,n.p.y,n.p.z,.65,.025,.5,TEX.paper?new THREE.MeshStandardMaterial({map:TEX.paper,roughness:1}):mats.bone)
    const mark=new THREE.Mesh(new THREE.PlaneGeometry(.42,.12),new THREE.MeshBasicMaterial({color:0x56493a}))
    mark.position.set(n.p.x,n.p.y+.02,n.p.z);mark.rotation.x=-Math.PI/2;world.add(mark)
    addInteract(paper,'note','READ PATIENT FILE',n.p.clone(),{note:n})
  })
}

function buildEnemy() {
  enemy = new THREE.Group(); enemy.position.set(0,0,-6); world.add(enemy)
  const flesh = new THREE.MeshStandardMaterial({color:0x28251f,roughness:.96})
  const exposed = new THREE.MeshStandardMaterial({color:0x51483a,roughness:.88})
  const head = sphere('the patient',0,2.38,0,.42,flesh,enemy); head.scale.set(.76,1.15,.72)
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.46,.86,4,8),flesh); torso.position.y=1.48; torso.scale.set(.85,1,.62); torso.castShadow=true;enemy.add(torso)
  const jaw=sphere('jaw',0,2.08,-.12,.24,exposed,enemy);jaw.scale.set(.8,.45,.65)
  for(const x of [-.16,.16]) sphere('eye',x,2.46,-.31,.055,mats.glass,enemy)
  for(const x of [-.42,.42]) {
    const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.15,.83,3,6),flesh);arm.position.set(x,1.45,-.03);arm.rotation.z=x<0?-.3:.3;arm.castShadow=true;enemy.add(arm)
    const hand=sphere('hand',x*1.25,.84,-.05,.17,exposed,enemy); hand.scale.set(.7,1.2,.7)
  }
  for(const x of [-.22,.22]) {
    const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.17,.8,3,6),flesh);leg.position.set(x,.52,0);leg.castShadow=true;enemy.add(leg)
  }
  const backSpines=[]
  for(let i=0;i<5;i++) {
    const spike=new THREE.Mesh(new THREE.ConeGeometry(.1,.42,5),exposed);spike.position.set((i-2)*.14,1.7,-.38);spike.rotation.x=-.45;enemy.add(spike);backSpines.push(spike)
  }
  enemy.userData.spines=backSpines
  enemy.visible=false
}
function bootScene() {
  buildRoom(); buildEnemy()
  player=new THREE.Object3D(); player.position.set(0,0,18.3); scene.add(player)
  camera.position.set(0,1.62,0); player.add(camera)
  const gunMat=new THREE.MeshStandardMaterial({color:0x25231e,metalness:.7,roughness:.36})
  weapon=new THREE.Group();camera.add(weapon);weapon.position.set(.32,-.29,-.58)
  const grip=new THREE.Mesh(new THREE.BoxGeometry(.115,.26,.17),mats.dark);grip.rotation.z=-.12;weapon.add(grip)
  const slide=new THREE.Mesh(new THREE.BoxGeometry(.13,.13,.43),gunMat);slide.position.set(0,.1,-.12);weapon.add(slide)
  const barrel=cylinder('barrel',0,.1,-.37,.035,.035,.22,gunMat,8,weapon);barrel.rotation.x=Math.PI/2
  const sight=new THREE.Mesh(new THREE.BoxGeometry(.045,.03,.08),mats.brass);sight.position.set(0,.18,-.12);weapon.add(sight)
  muzzle=new THREE.PointLight(0xffbb60,0,4);muzzle.position.set(0,.1,-.56);weapon.add(muzzle)
  camera.rotation.order='YXZ'
  updateHud()
}
function setScreen(el,show) { el?.classList.toggle('hidden',!show); el?.setAttribute('aria-hidden',String(!show)) }
function showToast(text,duration=2100) {
  if(!ui.toast)return
  ui.toast.textContent=text;ui.toast.classList.add('show');clearTimeout(showToast.timer)
  showToast.timer=setTimeout(()=>ui.toast.classList.remove('show'),duration)
}
function say(text,duration=2700) {
  ui.subtitle.textContent=text;ui.subtitle.classList.add('show');clearTimeout(say.timer)
  say.timer=setTimeout(()=>ui.subtitle.classList.remove('show'),duration)
}
function formatTime(seconds) {
  const n=Math.floor(seconds);return `${String(Math.floor(n/3600)).padStart(2,'0')}:${String(Math.floor(n/60)%60).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`
}
function updateHud() {
  ui.healthFill.style.width=`${health}%`;ui.healthState.textContent=health>65?'STABLE':health>30?'WOUNDED':'CRITICAL'
  ui.healthState.className=health<=30?'danger':health<=65?'wounded':''
  ui.ammoMag.textContent=String(mag).padStart(2,'0');ui.ammoReserve.textContent=String(reserve).padStart(2,'0')
  ui.reloadHint.textContent=reloading?'RELOADING…':mag===0?'R · RELOAD':'R · RELOAD'
  ui.fusePips.querySelectorAll('i').forEach((p,i)=>p.classList.toggle('on',i<fuses))
  if(fuses<3){ui.objectiveText.textContent='FIND THE THREE FUSES';ui.objectiveSub.textContent='The east and west wings. The chapel.'}
  else if(!powered){ui.objectiveText.textContent='RESTORE THE GENERATOR';ui.objectiveSub.textContent='The switchboard is in the north service hall.'}
  else{ui.objectiveText.textContent='REACH THE EXIT';ui.objectiveSub.textContent='The emergency release is powered. Run.'}
  ui.recTime.textContent=formatTime(elapsed)
}
function initAudio() {
  if(audioCtx){if(audioCtx.state==='suspended')audioCtx.resume();return}
  const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return
  audioCtx=new Ctx();masterGain=audioCtx.createGain();masterGain.gain.value=soundOn?.18:0;masterGain.connect(audioCtx.destination)
  const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type='sawtooth';osc.frequency.value=47;gain.gain.value=.045;osc.connect(gain);gain.connect(masterGain);osc.start()
}
function tone(freq=240,duration=.08,type='square',volume=.1) {
  if(!audioCtx||!soundOn)return
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g);g.connect(masterGain);o.start();o.stop(audioCtx.currentTime+duration)
}
function startGame() {
  initAudio();running=true;paused=false;ended=false;noteOpen=false;elapsed=0;health=100;mag=8;reserve=24;shots=0;fuses=0;powered=false;lightOn=true;aiming=false;reloading=false;fireCooldown=0;lastEnemyAttack=0;keys.clear();moveX=0;moveZ=0;lookX=0;lookY=0
  document.body.classList.add('playing')
  flashlight.intensity=4.2
  ui.btnLight?.classList.remove('off')
  player.position.set(0,0,18.3);yaw=Math.PI;pitch=0;camera.rotation.set(0,0,0);enemy.position.set(0,0,-6);enemy.visible=true
  enemy.userData.alert=0;enemy.userData.stun=0;enemy.userData.patrol=0;enemy.userData.health=4
  interactive.filter(o=>o.userData.type==='fuse').forEach((o,i)=>{o.visible=true;o.userData.collected=false;o.position.copy(fuseLocations[i]);o.position.y=.9})
  ui.fusePips.querySelectorAll('i').forEach(p=>p.classList.remove('on'))
  setScreen(ui.menu,false);setScreen(ui.pause,false);setScreen(ui.death,false);setScreen(ui.win,false);setScreen(ui.note,false);setScreen(ui.hud,true)
  ui.loading.classList.add('hidden');ui.chapterCard.classList.add('show');setTimeout(()=>ui.chapterCard.classList.remove('show'),2600)
  if(ui.desktopHint)ui.desktopHint.classList.add('show')
  setTimeout(()=>say('“If you can hear this… don’t let it see the light.”',3500),900)
  updateHud();clock.getDelta();renderer.domElement.focus?.();resize()
  if(matchMedia('(pointer:fine)').matches&&renderer.domElement.requestPointerLock)renderer.domElement.requestPointerLock()
}
function pauseGame() {
  if(!running||ended)return
  paused=!paused;setScreen(ui.pause,paused);document.body.classList.toggle('playing',running&&!paused);if(paused&&document.pointerLockElement)document.exitPointerLock();else if(!paused&&matchMedia('(pointer:fine)').matches)renderer.domElement.requestPointerLock?.()
}
function finishGame(won) {
  ended=true;running=false;paused=false;document.body.classList.remove('playing');if(document.pointerLockElement)document.exitPointerLock()
  setScreen(ui.hud,false);setScreen(ui.pause,false);setScreen(won?ui.win:ui.death,true)
  if(won){ui.winTime.textContent=`${Math.floor(elapsed/60)}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;ui.winShots.textContent=shots}
  else {ui.deathTime.textContent=`${Math.floor(elapsed/60)}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;ui.deathFuses.textContent=`${fuses} / 3`;ui.deathLine.textContent='The sanatorium keeps what it takes.'}
  tone(won?520:80,.6,'sawtooth',.16)
}
function showNote(note) {
  noteOpen=true;paused=true;ui.noteTitle.textContent=note.title;ui.noteTag.textContent=note.tag;ui.noteSign.textContent=note.sign;ui.noteBody.textContent=note.body;setScreen(ui.note,true)
  if(document.pointerLockElement)document.exitPointerLock()
  document.body.classList.remove('playing')
}
function closeNote() { noteOpen=false;paused=false;setScreen(ui.note,false);document.body.classList.add('playing');if(matchMedia('(pointer:fine)').matches)renderer.domElement.requestPointerLock?.() }
function canMoveTo(x,z) {
  if(x < -14.9 || x > 14.9 || z < -21.2 || z > 21.1)return false
  const r=.34
  for(const c of colliders) if(Math.abs(x-c.x)<c.hx+r&&Math.abs(z-c.z)<c.hz+r)return false
  return true
}
const raycaster=new THREE.Raycaster()
const screenCenter=new THREE.Vector2(0,0)
function updateTargeting() {
  if(!running||paused||ended){nearest=null;ui.interactPrompt.classList.remove('show');ui.btnInteract?.classList.remove('show');return}
  raycaster.setFromCamera(screenCenter,camera)
  const valid=interactive.filter(o=>o.visible&&(o.userData.type!=='fuse'||!o.userData.collected))
  const hits=raycaster.intersectObjects(valid,true)
  nearest=null
  for(const hit of hits) {
    let o=hit.object
    while(o&&!o.userData?.type)o=o.parent
    if(!o?.userData?.type)continue
    const pos=o.userData.interactPosition||o.getWorldPosition(new THREE.Vector3())
    const d=player.position.distanceTo(new THREE.Vector3(pos.x,0,pos.z))
    const max=o.userData.type==='exit'?3.2:2.5
    if(d<=max){nearest=o;break}
  }
  if(nearest) {
    const locked=nearest.userData.type==='generator'&&fuses<3
    const exitLocked=nearest.userData.type==='exit'&&!powered
    ui.promptText.textContent=locked?`POWER REQUIRED · ${fuses}/3 FUSES`:exitLocked?'EXIT LOCKED — RESTORE POWER':nearest.userData.label
    ui.promptKey.textContent='E';ui.interactPrompt.classList.add('show');ui.btnInteract?.classList.add('show')
  } else {ui.interactPrompt.classList.remove('show');ui.btnInteract?.classList.remove('show')}
}
function interact() {
  if(noteOpen){closeNote();return}
  if(!running||paused||ended)return
  if(!nearest){showToast('NOTHING WITHIN REACH',1000);return}
  const {type,index,note}=nearest.userData
  if(type==='fuse') {
    nearest.userData.collected=true;nearest.visible=false;fuses++;tone(540,.12,'sine',.1);tone(760,.2,'sine',.08)
    showToast(`CERAMIC FUSE RECOVERED · ${fuses}/3`);updateHud()
    if(fuses===3){say('The generator is in the north service hall. Something heard that.',3500);enemy.userData.alert=1}
  } else if(type==='generator') {
    if(fuses<3){showToast(`MISSING FUSES · ${fuses}/3`);tone(100,.16);return}
    if(!powered){powered=true;lights.forEach(({light,base})=>light.intensity=base*1.35);tone(170,.35,'sawtooth',.16);setTimeout(()=>tone(340,.5,'sine',.12),280);showToast('POWER RESTORED — GET TO THE EXIT');say('The chain is released. Run!',2400);enemy.userData.alert=1;updateHud()}
  } else if(type==='exit') {
    if(!powered){showToast('THE CHAIN IS STILL LOCKED');return}
    tone(560,.35,'sine',.14);finishGame(true)
  } else if(type==='note')showNote(note)
}
function reload() {
  if(!running||paused||reloading||mag===8||reserve<=0)return
  reloading=true;reloadClock=1.35;tone(160,.08,'triangle',.07);showToast('RELOADING…',1200)
}
function fire() {
  if(!running||paused||ended||fireCooldown>0||reloading)return
  if(mag<=0){tone(95,.055,'square',.07);showToast('EMPTY · PRESS R TO RELOAD',1100);fireCooldown=.3;return}
  mag--;shots++;fireCooldown=.34;muzzle.intensity=3;setTimeout(()=>{if(muzzle)muzzle.intensity=0},55)
  weapon.position.z=-.48;setTimeout(()=>{if(weapon)weapon.position.z=-.58},80)
  tone(90,.12,'sawtooth',.19);tone(45,.09,'triangle',.12);updateHud()
  raycaster.setFromCamera(screenCenter,camera)
  const hit=raycaster.intersectObject(enemy,true)[0]
  if(hit&&enemy.visible&&enemy.userData.stun<=0) {
    enemy.userData.stun=1.45;enemy.userData.health=(enemy.userData.health??4)-1;enemy.userData.alert=1
    ui.hitmarker.classList.add('show');setTimeout(()=>ui.hitmarker.classList.remove('show'),180)
    tone(390,.07,'square',.08)
    if(enemy.userData.health<=0){enemy.visible=false;showToast('TARGET DOWN — KEEP MOVING',1600);setTimeout(()=>{if(running&&!ended){enemy.position.set(player.position.x>0?-6:6,0,player.position.z-5);enemy.userData.health=4;enemy.visible=true}},4800)}
  } else {enemy.userData.alert=1;showToast('THE SHOT ECHOES THROUGH THE WING',1200)}
}
function toggleLight() {lightOn=!lightOn;flashlight.intensity=lightOn?4.2:0;if(lightOn)tone(370,.045,'triangle',.04);else tone(150,.045,'triangle',.04);ui.btnLight?.classList.toggle('off',!lightOn)}
function damage(amount) {
  health=Math.max(0,health-amount);hurtTimer=.28;ui.damageFlash.classList.add('show');setTimeout(()=>ui.damageFlash.classList.remove('show'),260);tone(70,.22,'sawtooth',.14);updateHud()
  if(health<=0)finishGame(false)
}
function updateEnemy(dt) {
  if(!enemy?.visible)return
  enemy.userData.stun=Math.max(0,(enemy.userData.stun||0)-dt)
  const toPlayer=new THREE.Vector3(player.position.x-enemy.position.x,0,player.position.z-enemy.position.z)
  const distance=toPlayer.length()
  const alert=enemy.userData.alert||0
  if(distance<13||alert>0)enemy.userData.alert=Math.max(.15,alert-dt*.06)
  const active=distance<14||alert>.1
  if(active&&enemy.userData.stun<=0) {
    toPlayer.normalize();const speed=powered?1.95:1.55
    const nx=enemy.position.x+toPlayer.x*speed*dt,nz=enemy.position.z+toPlayer.z*speed*dt
    if(canMoveTo(nx,enemy.position.z))enemy.position.x=nx
    if(canMoveTo(enemy.position.x,nz))enemy.position.z=nz
    enemy.rotation.y=Math.atan2(toPlayer.x,toPlayer.z)
  } else {
    enemy.userData.patrol=(enemy.userData.patrol||0)+dt
    enemy.position.x=Math.sin(enemy.userData.patrol*.22)*2.1
    enemy.rotation.y=Math.sin(enemy.userData.patrol*.22)*.35
  }
  enemy.position.y=Math.sin(elapsed*5)*.045
  if(distance<1.38&&elapsed-lastEnemyAttack>1.3&&enemy.userData.stun<=0){lastEnemyAttack=elapsed;damage(17);say('It is on you!',1000)}
}
function updateGame(dt) {
  if(!running||paused||ended)return
  elapsed+=dt;fireCooldown=Math.max(0,fireCooldown-dt);hurtTimer=Math.max(0,hurtTimer-dt)
  if(reloading){reloadClock-=dt;if(reloadClock<=0){const n=Math.min(8-mag,reserve);mag+=n;reserve-=n;reloading=false;tone(280,.08,'triangle',.06);updateHud()}}
  const forward=(keys.has('KeyW')||keys.has('ArrowUp')?-1:0)+(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-moveZ
  const strafe=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+moveX
  const inputLen=Math.hypot(forward,strafe),speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?4.35:3.05)*(aiming?.78:1)
  if(inputLen>.05){const f=forward/inputLen*speed*dt,s=strafe/inputLen*speed*dt;const sin=Math.sin(yaw),cos=Math.cos(yaw);const dx=s*cos+f*sin,dz=-s*sin+f*cos
    if(canMoveTo(player.position.x+dx,player.position.z))player.position.x+=dx
    if(canMoveTo(player.position.x,player.position.z+dz))player.position.z+=dz
    bob+=dt*(inputLen>1.1?12:8)
    if(elapsed-lastStep>(inputLen>1.1?.34:.52)){lastStep=elapsed;tone(inputLen>1.1?62:78,.035,'triangle',.025)}
  }
  yaw-=lookX;pitch=clamp(pitch-lookY,-1.23,1.23);lookX=0;lookY=0
  camera.rotation.set(pitch,yaw,0,'YXZ');camera.position.y=1.62+Math.sin(bob)*.018
  weapon.position.y=-.29+Math.sin(bob)*.009
  camera.fov+=((aiming?54:73)-camera.fov)*Math.min(1,dt*10);camera.updateProjectionMatrix()
  updateEnemy(dt);updateTargeting();ui.recTime.textContent=formatTime(elapsed)
  if(elapsed-lastEnemyAttack>10&&enemy.visible&&Math.random()<dt*.018){tone(45,.5,'sawtooth',.08);lastEnemyAttack=elapsed-7}
  for(const item of interactive)if(item.userData.type==='fuse'&&!item.userData.collected){item.rotation.y+=dt*.45;item.userData.halo.rotation.z+=dt*.7}
  lights.forEach(({light,base,phase})=>{light.intensity=base*(.9+Math.sin(elapsed*2.7+phase)*.07+(Math.random()<dt*.012?-.35:0))})
}

const isTouchDevice = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
if(isTouchDevice) document.body.classList.add('touch')

function resize() {
  const width=window.innerWidth,height=window.innerHeight
  camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height)
  const showRotate=isTouchDevice&&height>width&&running&&!paused&&!ended&&!rotateDismissed
  ui.rotateNotice?.classList.toggle('hidden',!showRotate)
  ui.rotateNotice?.classList.toggle('visible',showRotate)
}
let rotateDismissed=false
function toggleSound() {
  soundOn=!soundOn
  if(masterGain)masterGain.gain.setTargetAtTime(soundOn?.18:0,audioCtx.currentTime,.025)
  if(ui.soundBtn)ui.soundBtn.textContent=`SOUND ${soundOn?'ON':'OFF'}`
  if(ui.muteBtn)ui.muteBtn.innerHTML=`SOUND: <span>${soundOn?'ON':'OFF'}</span>`
}
function onKeyDown(event) {
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code))event.preventDefault()
  if(event.repeat&&['Escape','KeyE','KeyF','KeyR','KeyP'].includes(event.code))return
  if(event.code==='Escape'||event.code==='KeyP') {
    if(noteOpen)closeNote()
    else if(running&&!ended)pauseGame()
    return
  }
  if(event.code==='KeyE'){interact();return}
  if(event.code==='KeyF'){if(running&&!paused)toggleLight();return}
  if(event.code==='KeyR'){reload();return}
  if(event.code==='MouseLeft'){fire();return}
  if(running&&!paused&&!ended)keys.add(event.code)
}
function onKeyUp(event) { keys.delete(event.code) }
function setAim(value) { aiming=!!value }

$('startBtn')?.addEventListener('click',startGame)
$('resumeBtn')?.addEventListener('click',pauseGame)
$('restartBtn')?.addEventListener('click',startGame)
$('retryBtn')?.addEventListener('click',startGame)
$('againBtn')?.addEventListener('click',startGame)
$('noteClose')?.addEventListener('click',closeNote)
ui.soundBtn?.addEventListener('click',toggleSound)
ui.muteBtn?.addEventListener('click',toggleSound)
ui.rotateContinue?.addEventListener('click',()=>{rotateDismissed=true;ui.rotateNotice?.classList.remove('visible')})
ui.btnReload?.addEventListener('click',reload)
ui.btnLight?.addEventListener('click',toggleLight)
ui.btnInteract?.addEventListener('click',interact)

window.addEventListener('keydown',onKeyDown,{passive:false})
window.addEventListener('keyup',onKeyUp)
window.addEventListener('blur',()=>{keys.clear();moveX=0;moveZ=0;aiming=false;if(running&&!paused&&!ended)pauseGame()})
window.addEventListener('resize',resize)
document.addEventListener('contextmenu',event=>event.preventDefault())
document.addEventListener('pointerlockchange',()=>{
  if(running&&!paused&&!ended&&!document.pointerLockElement&&matchMedia('(pointer:fine)').matches)pauseGame()
})

renderer.domElement.addEventListener('click',()=>{
  if(running&&!paused&&!ended&&matchMedia('(pointer:fine)').matches&&!document.pointerLockElement)renderer.domElement.requestPointerLock?.()
})
renderer.domElement.addEventListener('pointerdown',event=>{
  if(!running||paused||ended)return
  if(event.pointerType==='mouse') {
    if(event.button===0)fire()
    if(event.button===2)setAim(true)
  } else if(event.pointerType==='touch') {
    lookPointerId=event.pointerId;lastLookX=event.clientX;lastLookY=event.clientY
  }
})
window.addEventListener('pointerup',event=>{
  if(event.button===2)setAim(false)
  if(event.pointerId===lookPointerId)lookPointerId=null
})
window.addEventListener('pointermove',event=>{
  if(document.pointerLockElement&&event.pointerType==='mouse') {
    lookX+=event.movementX*.0022;lookY+=event.movementY*.0022
  } else if(event.pointerId===lookPointerId&&event.pointerType==='touch') {
    lookX+=(event.clientX-lastLookX)*.006;lookY+=(event.clientY-lastLookY)*.006
    lastLookX=event.clientX;lastLookY=event.clientY
  }
})
let lookPointerId=null,lastLookX=0,lastLookY=0
renderer.domElement.addEventListener('pointercancel',event=>{if(event.pointerId===lookPointerId)lookPointerId=null})

let stickPointerId=null
function updateStick(event) {
  const rect=ui.stick.getBoundingClientRect(),radius=rect.width*.36
  const dx=event.clientX-(rect.left+rect.width/2),dy=event.clientY-(rect.top+rect.height/2)
  const len=Math.hypot(dx,dy),scale=len>radius?radius/len:1
  const x=dx*scale,y=dy*scale
  moveX=x/radius;moveZ=y/radius
  ui.stickKnob.style.transform=`translate(${x}px, ${y}px)`
}
ui.stick?.addEventListener('pointerdown',event=>{
  if(!running||paused||ended)return
  event.preventDefault();stickPointerId=event.pointerId;ui.stick.setPointerCapture(event.pointerId);updateStick(event)
})
ui.stick?.addEventListener('pointermove',event=>{if(event.pointerId===stickPointerId)updateStick(event)})
function releaseStick(event) {
  if(event.pointerId!==stickPointerId)return
  stickPointerId=null;moveX=0;moveZ=0;ui.stickKnob.style.transform='translate(0px, 0px)'
}
ui.stick?.addEventListener('pointerup',releaseStick)
ui.stick?.addEventListener('pointercancel',releaseStick)
ui.btnAim?.addEventListener('pointerdown',event=>{event.preventDefault();setAim(true);ui.btnAim.setPointerCapture(event.pointerId)})
ui.btnAim?.addEventListener('pointerup',()=>setAim(false))
ui.btnAim?.addEventListener('pointercancel',()=>setAim(false))
ui.btnFire?.addEventListener('pointerdown',event=>{
  if(!isTouchDevice)return
  event.preventDefault();fire();ui.btnFire.setPointerCapture(event.pointerId)
  clearInterval(ui.btnFire.fireTimer);ui.btnFire.fireTimer=setInterval(()=>fire(),360)
})
function stopTouchFire(){clearInterval(ui.btnFire?.fireTimer)}
ui.btnFire?.addEventListener('pointerup',stopTouchFire)
ui.btnFire?.addEventListener('pointercancel',stopTouchFire)

bootScene()
resize()
ui.loadFill.style.width='100%'
requestAnimationFrame(()=>{ui.loading.classList.add('leave');setTimeout(()=>ui.loading.classList.add('hidden'),850)})
let previousFrame=performance.now()
function animate(now) {
  requestAnimationFrame(animate)
  const dt=Math.min(.05,(now-previousFrame)/1000);previousFrame=now
  updateGame(dt)
  renderer.render(scene,camera)
}
requestAnimationFrame(animate)
