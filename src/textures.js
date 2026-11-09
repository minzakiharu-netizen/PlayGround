import * as THREE from 'three'

export const TEX = {}

function rng(seed = 1) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvas(size, draw) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')
  draw(ctx, size)
  return c
}

function tex(source, repeatX = 1, repeatY = 1, srgb = true, anisotropy = 8) {
  const t = new THREE.CanvasTexture(source)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeatX, repeatY)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = anisotropy
  t.needsUpdate = true
  return t
}

function grain(ctx, size, amount = 0.14, mono = false) {
  const img = ctx.getImageData(0, 0, size, size)
  const d = img.data
  const r = rng(size + 7)
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 255 * amount
    if (mono) {
      d[i] = Math.max(0, Math.min(255, d[i] + n))
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n))
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n))
    } else {
      d[i] = Math.max(0, Math.min(255, d[i] + n * 0.8))
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * 0.9))
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 1.2))
    }
  }
  ctx.putImageData(img, 0, 0)
}

function stains(ctx, size, seed, count = 18, color = 'rgba(33,24,15,') {
  const r = rng(seed)
  for (let i = 0; i < count; i++) {
    const x = r() * size
    const y = r() * size
    const rad = 10 + r() * size * 0.18
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
    g.addColorStop(0, color + (0.06 + r() * 0.13) + ')')
    g.addColorStop(0.62, color + (0.025 + r() * 0.06) + ')')
    g.addColorStop(1, color + '0)')
    ctx.fillStyle = g
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
}

function scratches(ctx, size, seed, count = 55, alpha = 0.14) {
  const r = rng(seed)
  ctx.lineWidth = 0.7
  for (let i = 0; i < count; i++) {
    const x = r() * size
    const y = r() * size
    const len = 4 + r() * 50
    const angle = r() * Math.PI * 2
    ctx.strokeStyle = `rgba(216,204,178,${alpha * (0.2 + r() * 0.8)})`
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len)
    ctx.stroke()
  }
}

function makeWallpaper() {
  return canvas(512, (ctx, s) => {
    const grad = ctx.createLinearGradient(0, 0, s, 0)
    grad.addColorStop(0, '#514d3e')
    grad.addColorStop(0.5, '#595443')
    grad.addColorStop(1, '#4a4739')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, s, s)

    // faded vertical wall bands
    for (let x = 0; x < s; x += 64) {
      ctx.fillStyle = x % 128 === 0 ? 'rgba(25,28,22,.09)' : 'rgba(184,174,143,.035)'
      ctx.fillRect(x, 0, 32, s)
    }

    // damask-like repeat
    ctx.save()
    ctx.translate(s / 2, s / 2)
    for (let gy = -2; gy <= 2; gy++) {
      for (let gx = -2; gx <= 2; gx++) {
        ctx.save()
        ctx.translate(gx * 96, gy * 96 + (gx % 2) * 48)
        ctx.strokeStyle = 'rgba(182,168,128,.105)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(0, -24)
        ctx.bezierCurveTo(20, -15, 18, 9, 0, 20)
        ctx.bezierCurveTo(-18, 9, -20, -15, 0, -24)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, -14)
        ctx.bezierCurveTo(7, -8, 7, 5, 0, 10)
        ctx.bezierCurveTo(-7, 5, -7, -8, 0, -14)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(0, 28, 5, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
    }
    ctx.restore()

    // damp/mould, bottom heavy
    const bottom = ctx.createLinearGradient(0, s * 0.55, 0, s)
    bottom.addColorStop(0, 'rgba(20,22,17,0)')
    bottom.addColorStop(1, 'rgba(15,18,14,.45)')
    ctx.fillStyle = bottom
    ctx.fillRect(0, 0, s, s)

    stains(ctx, s, 4, 15, 'rgba(37,29,19,')
    stains(ctx, s, 9, 7, 'rgba(12,18,14,')
    scratches(ctx, s, 12, 38, 0.09)

    // peeled strips
    const r = rng(22)
    for (let i = 0; i < 4; i++) {
      const x = r() * s
      const y = r() * s * 0.5
      const w = 9 + r() * 20
      const h = 20 + r() * 90
      ctx.fillStyle = 'rgba(134,118,92,.35)'
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.bezierCurveTo(x + w, y + 6, x + w * 0.7, y + h * 0.6, x + w * 0.3, y + h)
      ctx.lineTo(x + w * 0.1, y + h * 0.9)
      ctx.bezierCurveTo(x + w * 0.3, y + h * 0.5, x - w * 0.1, y + 4, x, y)
      ctx.fill()
      ctx.strokeStyle = 'rgba(33,25,16,.22)'
      ctx.stroke()
    }
    grain(ctx, s, 0.18)
  })
}

function makeWoodFloor() {
  return canvas(512, (ctx, s) => {
    ctx.fillStyle = '#2c2119'
    ctx.fillRect(0, 0, s, s)
    const r = rng(25)
    const rows = 8
    const rh = s / rows
    for (let row = 0; row < rows; row++) {
      const y = row * rh
      const shade = 26 + r() * 18
      const g = ctx.createLinearGradient(0, y, 0, y + rh)
      g.addColorStop(0, `rgb(${shade + 12},${shade - 2},${shade - 8})`)
      g.addColorStop(0.5, `rgb(${shade + 3},${shade - 8},${shade - 12})`)
      g.addColorStop(1, `rgb(${shade - 5},${shade - 12},${shade - 14})`)
      ctx.fillStyle = g
      ctx.fillRect(0, y + 2, s, rh - 3)
      // grain
      for (let i = 0; i < 22; i++) {
        const yy = y + 4 + r() * (rh - 8)
        ctx.strokeStyle = `rgba(${10 + r() * 20},${7 + r() * 12},${3 + r() * 8},${0.15 + r() * 0.2})`
        ctx.lineWidth = 0.5 + r()
        ctx.beginPath()
        ctx.moveTo(0, yy)
        for (let x = 0; x < s; x += 16) ctx.lineTo(x, yy + Math.sin(x * 0.035 + r() * 5) * 2)
        ctx.stroke()
      }
      // plank joins
      ctx.fillStyle = 'rgba(4,5,4,.62)'
      ctx.fillRect(0, y, s, 2)
      const join = (r() * s)
      ctx.fillRect(join, y, 1, rh)
    }
    stains(ctx, s, 37, 12, 'rgba(8,8,6,')
    scratches(ctx, s, 41, 60, 0.16)
    grain(ctx, s, 0.22)
  })
}

function makeCeiling() {
  return canvas(512, (ctx, s) => {
    ctx.fillStyle = '#4b4a40'
    ctx.fillRect(0, 0, s, s)
    stains(ctx, s, 51, 23, 'rgba(44,36,24,')
    stains(ctx, s, 56, 8, 'rgba(15,18,15,')
    // cracks
    const r = rng(58)
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = 'rgba(17,15,12,.35)'
      ctx.lineWidth = 0.6
      ctx.beginPath()
      let x = r() * s, y = r() * s
      ctx.moveTo(x, y)
      for (let j = 0; j < 6; j++) {
        x += (r() - 0.5) * 50
        y += (r() - 0.5) * 50
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    grain(ctx, s, 0.15)
  })
}

function makeCarpet() {
  return canvas(512, (ctx, s) => {
    ctx.fillStyle = '#4d1c19'
    ctx.fillRect(0, 0, s, s)
    const r = rng(70)
    ctx.strokeStyle = 'rgba(178,145,92,.32)'
    ctx.lineWidth = 5
    ctx.strokeRect(20, 20, s - 40, s - 40)
    ctx.lineWidth = 1
    ctx.strokeRect(34, 34, s - 68, s - 68)
    for (let i = 0; i < 12; i++) {
      const y = 48 + i * 36
      ctx.strokeStyle = 'rgba(164,134,88,.14)'
      ctx.beginPath()
      ctx.moveTo(40, y)
      ctx.lineTo(s - 40, y + 6)
      ctx.stroke()
    }
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(${20 + r() * 30},${8 + r() * 12},${6 + r() * 9},${0.08 + r() * 0.25})`
      ctx.fillRect(r() * s, r() * s, 1 + r() * 3, 1 + r() * 3)
    }
    stains(ctx, s, 75, 10, 'rgba(7,7,5,')
    grain(ctx, s, 0.25)
  })
}

function makeConcrete() {
  return canvas(512, (ctx, s) => {
    ctx.fillStyle = '#514f47'
    ctx.fillRect(0, 0, s, s)
    const r = rng(91)
    for (let i = 0; i < 1800; i++) {
      const v = 35 + r() * 45
      ctx.fillStyle = `rgba(${v},${v},${v - 4},${0.15 + r() * 0.3})`
      ctx.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 2)
    }
    for (let i = 0; i < 8; i++) {
      const x = r() * s
      ctx.fillStyle = 'rgba(30,28,24,.15)'
      ctx.fillRect(x, 0, 2, s)
    }
    stains(ctx, s, 96, 16, 'rgba(17,14,10,')
    grain(ctx, s, 0.2)
  })
}

function makeMetal() {
  return canvas(512, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, s, s)
    g.addColorStop(0, '#3b3f3c')
    g.addColorStop(0.42, '#5c5d54')
    g.addColorStop(0.5, '#454743')
    g.addColorStop(1, '#292d2b')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    scratches(ctx, s, 113, 130, 0.25)
    stains(ctx, s, 117, 20, 'rgba(58,35,19,')
    grain(ctx, s, 0.13)
  })
}

function makeDoorWood() {
  return canvas(512, (ctx, s) => {
    ctx.fillStyle = '#39291f'
    ctx.fillRect(0, 0, s, s)
    const r = rng(122)
    for (let i = 0; i < 75; i++) {
      const x = r() * s
      ctx.strokeStyle = `rgba(${15 + r() * 25},${9 + r() * 18},${4 + r() * 10},${0.12 + r() * 0.23})`
      ctx.lineWidth = 0.5 + r() * 2
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.bezierCurveTo(x + (r() - 0.5) * 24, s * 0.33, x + (r() - 0.5) * 20, s * 0.66, x + (r() - 0.5) * 12, s)
      ctx.stroke()
    }
    scratches(ctx, s, 128, 60, 0.13)
    stains(ctx, s, 132, 8, 'rgba(13,9,6,')
    grain(ctx, s, 0.16)
  })
}

function makeFabric() {
  return canvas(256, (ctx, s) => {
    ctx.fillStyle = '#6b6455'
    ctx.fillRect(0, 0, s, s)
    ctx.strokeStyle = 'rgba(30,27,22,.16)'
    for (let i = 0; i < s; i += 3) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(0, i); ctx.stroke()
    }
    stains(ctx, s, 141, 9, 'rgba(42,26,15,')
    grain(ctx, s, 0.17)
  })
}

function makeBlood() {
  return canvas(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s)
    const r = rng(161)
    ctx.fillStyle = 'rgba(61,8,6,.88)'
    for (let i = 0; i < 38; i++) {
      const x = s * 0.5 + (r() - 0.5) * s * 0.62
      const y = s * 0.5 + (r() - 0.5) * s * 0.5
      const rad = 2 + r() * 18
      ctx.beginPath()
      ctx.ellipse(x, y, rad * (0.7 + r() * 0.9), rad, r() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let i = 0; i < 34; i++) {
      const x = s * 0.5 + (r() - 0.5) * s * 0.86
      const y = s * 0.5 + (r() - 0.5) * s * 0.82
      ctx.beginPath()
      ctx.arc(x, y, 0.7 + r() * 4, 0, Math.PI * 2)
      ctx.fill()
    }
    // drag marks
    ctx.strokeStyle = 'rgba(49,5,4,.36)'
    ctx.lineWidth = 8
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(s * 0.35, s * 0.4 + i * 10)
      ctx.lineTo(s * 0.6, s * 0.6 + i * 12)
      ctx.stroke()
    }
  })
}

function makeStainedGlass() {
  return canvas(512, (ctx, s) => {
    ctx.fillStyle = '#101815'
    ctx.fillRect(0, 0, s, s)
    const r = rng(177)
    const palette = ['#243b38', '#39504a', '#4e3b2c', '#6a3124', '#8a6235', '#425b46', '#202c38', '#885148']
    const cols = 8, rows = 14
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = palette[Math.floor(r() * palette.length)]
        const px = x * (s / cols), py = y * (s / rows)
        ctx.beginPath()
        ctx.moveTo(px + 2, py + 2)
        ctx.lineTo(px + s / cols - 2, py + 3)
        ctx.lineTo(px + s / cols - 4, py + s / rows - 2)
        ctx.lineTo(px + 4, py + s / rows - 4)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = 'rgba(8,10,8,.9)'
        ctx.lineWidth = 3
        ctx.stroke()
      }
    }
    // leaded arch
    ctx.strokeStyle = '#090b09'
    ctx.lineWidth = 12
    ctx.beginPath()
    ctx.moveTo(40, s)
    ctx.lineTo(40, 140)
    ctx.quadraticCurveTo(s / 2, 0, s - 40, 140)
    ctx.lineTo(s - 40, s)
    ctx.stroke()
    // halo figure
    ctx.strokeStyle = 'rgba(198,174,119,.36)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(s / 2, s * 0.43, 80, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = 'rgba(18,22,18,.54)'
    ctx.beginPath()
    ctx.ellipse(s / 2, s * 0.56, 28, 88, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(30,32,25,.9)'
    ctx.beginPath()
    ctx.arc(s / 2, s * 0.38, 24, 0, Math.PI * 2)
    ctx.fill()
    grain(ctx, s, 0.08)
  })
}

function makePainting(seed, variant = 0) {
  return canvas(256, (ctx, s) => {
    const r = rng(seed)
    const g = ctx.createLinearGradient(0, 0, s, s)
    g.addColorStop(0, variant ? '#24271f' : '#392f22')
    g.addColorStop(0.55, variant ? '#3c3b2e' : '#54422d')
    g.addColorStop(1, '#121410')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    // dim background frame / landscape
    ctx.fillStyle = 'rgba(14,17,14,.38)'
    ctx.fillRect(18, 18, s - 36, s - 36)
    // head + shoulders silhouette
    ctx.fillStyle = variant ? 'rgba(26,29,24,.9)' : 'rgba(22,18,13,.92)'
    ctx.beginPath()
    ctx.ellipse(s / 2, s * 0.76, s * 0.3, s * 0.36, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(s / 2, s * 0.37, s * 0.13, s * 0.17, 0, 0, Math.PI * 2)
    ctx.fill()
    // pale face
    ctx.fillStyle = 'rgba(126,119,97,.46)'
    ctx.beginPath()
    ctx.ellipse(s / 2, s * 0.36, s * 0.095, s * 0.128, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(10,10,8,.72)'
    ctx.fillRect(s / 2 - 14, s * 0.35, 9, 3)
    ctx.fillRect(s / 2 + 5, s * 0.35, 9, 3)
    ctx.fillRect(s / 2 - 5, s * 0.44, 10, 1.5)
    ctx.strokeStyle = 'rgba(194,175,133,.2)'
    ctx.lineWidth = 2
    ctx.strokeRect(18, 18, s - 36, s - 36)
    stains(ctx, s, seed, 10, 'rgba(18,13,8,')
    scratches(ctx, s, seed + 1, 25, 0.2)
    grain(ctx, s, 0.18)
  })
}

function makeSign(text, sub = '', color = '#cfc4a9', bg = 'rgba(18,19,16,.86)') {
  return canvas(512, (ctx, s) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, s, s)
    ctx.strokeStyle = 'rgba(205,191,158,.26)'
    ctx.lineWidth = 4
    ctx.strokeRect(18, 18, s - 36, s - 36)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = color
    ctx.font = '600 66px Georgia, serif'
    ctx.fillText(text, s / 2, sub ? s * 0.43 : s / 2)
    if (sub) {
      ctx.font = '400 24px Georgia, serif'
      ctx.fillStyle = 'rgba(205,191,158,.5)'
      ctx.fillText(sub, s / 2, s * 0.61)
    }
    stains(ctx, s, text.length * 23, 10, 'rgba(15,13,10,')
    scratches(ctx, s, text.length * 31, 34, 0.2)
  })
}

function makePaper() {
  return canvas(256, (ctx, s) => {
    ctx.fillStyle = '#c8bea2'
    ctx.fillRect(0, 0, s, s)
    ctx.strokeStyle = 'rgba(80,72,55,.22)'
    ctx.lineWidth = 1
    for (let y = 54; y < s - 20; y += 15) {
      ctx.beginPath(); ctx.moveTo(23, y); ctx.lineTo(s - 23, y + (Math.random() - 0.5) * 2); ctx.stroke()
    }
    stains(ctx, s, 201, 7, 'rgba(86,60,24,')
    grain(ctx, s, 0.1)
  })
}

export function initTextures() {
  TEX.wallpaperCanvas = makeWallpaper()
  TEX.floorCanvas = makeWoodFloor()
  TEX.ceilingCanvas = makeCeiling()
  TEX.carpetCanvas = makeCarpet()
  TEX.concreteCanvas = makeConcrete()
  TEX.metalCanvas = makeMetal()
  TEX.doorCanvas = makeDoorWood()
  TEX.fabricCanvas = makeFabric()
  TEX.bloodCanvas = makeBlood()
  TEX.glassCanvas = makeStainedGlass()
  TEX.paperCanvas = makePaper()

  TEX.wallpaper = tex(TEX.wallpaperCanvas, 1, 1)
  TEX.floor = tex(TEX.floorCanvas, 1, 1)
  TEX.ceiling = tex(TEX.ceilingCanvas, 1, 1)
  TEX.carpet = tex(TEX.carpetCanvas, 1, 1)
  TEX.concrete = tex(TEX.concreteCanvas, 1, 1)
  TEX.metal = tex(TEX.metalCanvas, 1, 1)
  TEX.door = tex(TEX.doorCanvas, 1, 1)
  TEX.fabric = tex(TEX.fabricCanvas, 2, 2)
  TEX.blood = tex(TEX.bloodCanvas, 1, 1)
  TEX.glass = tex(TEX.glassCanvas, 1, 1)
  TEX.paper = tex(TEX.paperCanvas, 1, 1)
  TEX.painting1 = tex(makePainting(301, 0), 1, 1)
  TEX.painting2 = tex(makePainting(322, 1), 1, 1)
  TEX.signRecords = tex(makeSign('RECORDS', 'WEST WING · STAFF ONLY'), 1, 1)
  TEX.signWard = tex(makeSign('WARD 7', 'QUARANTINE'), 1, 1)
  TEX.signChapel = tex(makeSign('CHAPEL', 'SILENCE IS PRAYER'), 1, 1)
  TEX.signGenerator = tex(makeSign('GENERATOR', 'HIGH VOLTAGE'), 1, 1)
  TEX.signExit = tex(makeSign('EXIT', 'EMERGENCY RELEASE'), 1, 1)

  // separate bump maps share the source canvas but not repeat state
  TEX.wallpaperBump = tex(TEX.wallpaperCanvas, 1, 1, false)
  TEX.floorBump = tex(TEX.floorCanvas, 1, 1, false)
  TEX.doorBump = tex(TEX.doorCanvas, 1, 1, false)
  TEX.metalBump = tex(TEX.metalCanvas, 1, 1, false)
  TEX.concreteBump = tex(TEX.concreteCanvas, 1, 1, false)
}

export function cloneTexture(t, rx, ry) {
  const c = t.clone()
  c.needsUpdate = true
  c.wrapS = c.wrapT = THREE.RepeatWrapping
  c.repeat.set(rx, ry)
  return c
}

export function texturedMaterial(baseTexture, bumpTexture, repeats, opts = {}) {
  const t = cloneTexture(baseTexture, repeats[0], repeats[1])
  const b = bumpTexture ? cloneTexture(bumpTexture, repeats[0], repeats[1]) : null
  return new THREE.MeshStandardMaterial({
    map: t,
    bumpMap: b || undefined,
    bumpScale: opts.bumpScale ?? 0.035,
    color: opts.color ?? 0xffffff,
    roughness: opts.roughness ?? 0.9,
    metalness: opts.metalness ?? 0.02,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    side: opts.side ?? THREE.FrontSide,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    depthWrite: opts.depthWrite ?? true,
  })
}

export function signMaterial(texture) {
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.72, metalness: 0.12, emissive: 0x17130b, emissiveIntensity: 0.24 })
}

export function bloodMaterial() {
  return new THREE.MeshStandardMaterial({
    map: TEX.blood,
    color: 0x52110c,
    transparent: true,
    opacity: 0.7,
    roughness: 0.34,
    metalness: 0.08,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  })
}
