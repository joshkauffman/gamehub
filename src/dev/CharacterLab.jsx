import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { addInkOutline } from '../games/shared/charKit.js'
import { buildMonsters, poseMonster } from '../games/totally-scary-horror-game/models.js'
import { createAssets } from '../games/totally-scary-horror-game/scene.js'
import { makeFigure, makeCritter } from '../games/loot-and-scoot/LootAndScoot.jsx'
import { makeBenderModel } from '../games/avatar/Avatar.jsx'
import { BENDERS } from '../games/avatar/constants.js'
import { makeDragonModel } from '../games/wings-of-fire/WingsOfFire.jsx'
import { TRIBES } from '../games/wings-of-fire/constants.js'
import { makeDinoModel, makeBossModel } from '../games/dino-suit-up/DinoSuitUp.jsx'
import { SUIT_TIERS, BOSSES } from '../games/dino-suit-up/constants.js'
import { buildMonsterModel, ALL_MONSTERS } from '../games/lil-monster-battles/LilMonsterBattles.jsx'
import { makeMobMesh } from '../games/obvious-minecraft-knockoff/ObviousMinecraftKnockoff.jsx'
import { makeSpiritFigure, makeBird } from '../games/world3d/World3D.jsx'
import { getCreatureTexture, getPlayerTexture } from '../games/dungeon-crawler-free-roam/DungeonCrawlerFreeRoam.jsx'
import { MONSTER_DEFS, CLASSES, RACES } from '../games/dungeon-crawler-free-roam/gameEngine.js'

// ── Dev-only: every 3D game's characters lined up on turntables ──────────
// /dev/characters?game=loot  (only routed in `npm run dev`). Lets the
// character models be compared and polished without playing to them.
// Add &ink=1 to preview the shared ink outline on models that lack one.

function sprite(tex, s = 1.6) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }))
  sp.scale.set(s, s, 1)
  sp.position.y = s / 2
  const g = new THREE.Group()
  g.add(sp)
  return g
}

const LINEUPS = {
  horror: () => {
    const ms = buildMonsters(createAssets())
    const only = new URLSearchParams(location.search).get('only')?.split(',')
    return Object.entries(ms).filter(([id]) => !only || only.includes(id)).map(([id, m]) => ({ label: id, obj: m.group, tick: t => poseMonster(m, t, {}) }))
  },
  loot: () => [
    { label: 'player', obj: makeFigure({ shirt: 0x2c3e66, hat: 0x1a1a22, mask: true, bag: true }) },
    { label: 'guard', obj: makeFigure({ shirt: 0x34507a, pants: 0x1c2638, hat: 0x1c2638 }) },
    { label: 'fence', obj: makeFigure({ shirt: 0x7a3a5a, skin: 0xc08a5a }) },
    { label: 'shop', obj: makeFigure({ shirt: 0x3a7a5a, skin: 0xe8b890 }) },
    ...['cat', 'raven', 'raccoon', 'pup'].map(k => ({ label: k, obj: makeCritter(k), scale: 2.2 })),
  ],
  avatar: () => BENDERS.map(b => ({ label: b.name || b.key, obj: makeBenderModel(b.key), yaw: Math.PI })),
  wings: () => TRIBES.map(t => ({ label: t.name || t.key, obj: makeDragonModel(t.key), scale: 0.45, yaw: Math.PI * 0.8, lift: 1.4 })),
  dino: () => [
    ...SUIT_TIERS.map((s, i) => ({ label: s.name, obj: makeDinoModel(i), scale: 0.38, yaw: Math.PI })),
    ...BOSSES.map((b, i) => ({ label: b.name, obj: makeBossModel(i), scale: 0.3, yaw: Math.PI })),
  ],
  lil: () => ALL_MONSTERS.map(d => ({ label: d.name, obj: buildMonsterModel(d).group })),
  mine: () => [0, 1, 2].map(k => { const m = makeMobMesh(); return { label: 'shambler', obj: m, tick: t => { m.position.x = Math.sin(t + k) * 0.3; m.userData.animate(t) } } }),
  world: () => [
    ...[0x8fd3ff, 0xffb38f, 0xc49fff].map(c => ({ label: 'spirit', obj: makeSpiritFigure(c), scale: 0.5 })),
    ...[0xff7a5c, 0x5cc8ff, 0xffd45c].map(c => ({ label: 'bird', obj: makeBird(c), scale: 4 })),
  ],
  dungeon: () => [
    ...CLASSES.flatMap(c => RACES.slice(0, 1).map(r => ({ label: `${c.id}`, obj: sprite(getPlayerTexture(c.id, r.id, null, null)) }))),
    ...Object.entries(MONSTER_DEFS).slice(0, 24).map(([id, m]) => ({ label: id, obj: sprite(getCreatureTexture(m), 1.4) })),
  ],
}

export default function CharacterLab() {
  const params = new URLSearchParams(location.search)
  const [game, setGame] = useState(params.get('game') || 'loot')
  const ink = params.get('ink') === '1'
  const zoom = Number(params.get('zoom')) || 1 // e.g. &zoom=2.5 for a close look
  const focus = Number(params.get('focus')) || 0 // which item a zoomed camera centres near
  const mount = useRef(null)
  useEffect(() => {
    const el = mount.current
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(2, devicePixelRatio))
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x9fb4c8)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 1.6))
    const sun = new THREE.DirectionalLight(0xffffff, 2.2)
    sun.position.set(4, 8, 6)
    scene.add(sun)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x7d8f73 }))
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)

    const items = LINEUPS[game]()
    const cols = Math.min(8, items.length)
    const spacing = 2.4
    const labels = []
    items.forEach((it, i) => {
      const holder = new THREE.Group()
      holder.add(it.obj)
      if (it.scale) holder.scale.setScalar(it.scale)
      if (ink) addInkOutline(holder)
      const r = Math.floor(i / cols), c = i % cols
      holder.position.set((c - (cols - 1) / 2) * spacing, it.lift || 0, -r * spacing * 1.3)
      scene.add(holder)
      it.holder = holder
      labels.push({ text: it.label, pos: holder.position.clone() })
    })
    const rows = Math.ceil(items.length / cols)
    const camera = new THREE.PerspectiveCamera(32, el.clientWidth / el.clientHeight, 0.1, 200)
    const w = cols * spacing
    const fx = zoom > 1 ? -((cols - 1) / 2) * spacing + spacing * (focus + 1.5) : 0
    camera.position.set(fx, 1.2 + (2.2 + rows * 1.2) / zoom, (w * 0.9 + 3) / zoom)
    camera.lookAt(fx, 0.9, zoom > 1 ? 0 : -(rows - 1) * spacing * 0.65)

    let raf
    const t0 = performance.now()
    const loop = () => {
      const t = (performance.now() - t0) / 1000
      items.forEach((it, i) => {
        it.holder.rotation.y = (it.yaw || 0) + Math.sin(t * 0.5 + i) * 0.9
        it.tick?.(t)
      })
      renderer.render(scene, camera)
      raf = requestAnimationFrame(loop)
    }
    loop()
    window.__lab = { scene, camera, items }
    return () => { cancelAnimationFrame(raf); renderer.dispose(); renderer.forceContextLoss(); el.removeChild(renderer.domElement) }
  }, [game, ink, zoom, focus])

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#111' }}>
      <div style={{ display: 'flex', gap: 6, padding: 6, flexWrap: 'wrap' }}>
        {Object.keys(LINEUPS).map(k => (
          <button key={k} onClick={() => { history.replaceState(null, '', `?game=${k}${ink ? '&ink=1' : ''}`); setGame(k) }} style={{ padding: '4px 10px', background: k === game ? '#8f88ff' : '#333', color: '#fff', border: 0, borderRadius: 6 }}>{k}</button>
        ))}
      </div>
      <div ref={mount} style={{ flex: 1 }} />
    </div>
  )
}
