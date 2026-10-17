import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './ObviousMinecraftKnockoff.module.css'
import { W, H, RECIPES } from './constants.js'
import { freshState, stepGame, placeBlock, craftItem, resetChamber } from './engine.js'
import { renderGame, cameraFor } from './render.js'

// ── The Obvious Minecraft Knockoff ─────────────────────────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly: mine blocks, craft tools up the
// wood/stone/iron/diamond tech tree, survive the night. Any
// resemblance to a certain blocky sandbox is extremely on purpose and
// also legally just vibes.

function canvasToGame(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = W / rect.width, scaleY = H / rect.height
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
}

function GameCanvas({ seed }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const keysRef = useRef(new Set())
  const aimRef = useRef(null)
  const mouseDownRef = useRef(false)
  const rafRef = useRef(null)
  const [, forceTick] = useState(0)
  if (!stateRef.current) stateRef.current = freshState(seed)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    function onKeyDown(e) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(e.code)) e.preventDefault()
      keysRef.current.add(e.code)
      const state = stateRef.current
      if (e.code === 'KeyC') { state.uiPanel = state.uiPanel === 'craft' ? null : 'craft'; forceTick(t => t + 1) }
      if (e.code === 'KeyR') { stateRef.current = resetChamber(state); forceTick(t => t + 1) }
      const digit = e.code.match(/^Digit([1-9])$/)
      if (digit) state.selectedSlot = Number(digit[1]) - 1
    }
    function onKeyUp(e) { keysRef.current.delete(e.code) }
    function onMouseMove(e) {
      aimRef.current = canvasToGame(canvas, e.clientX, e.clientY) // screen-space; converted to world-space in loop()
    }
    function onMouseDown(e) {
      e.preventDefault()
      const state = stateRef.current
      if (state.uiPanel === 'craft') return
      if (e.button === 2) {
        const pos = canvasToGame(canvas, e.clientX, e.clientY)
        const worldAim = screenToWorld(state, pos)
        placeBlock(state, worldAim.x, worldAim.y)
      } else {
        mouseDownRef.current = true
      }
    }
    function onMouseUp(e) { if (e.button !== 2) mouseDownRef.current = false }
    function onContextMenu(e) { e.preventDefault() }
    function onClick(e) {
      const state = stateRef.current
      if (state.uiPanel !== 'craft') return
      const pos = canvasToGame(canvas, e.clientX, e.clientY)
      const recipeId = craftHitTest(pos)
      if (recipeId) craftItem(state, recipeId)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('contextmenu', onContextMenu)
    canvas.addEventListener('click', onClick)

    function screenToWorld(state, pos) {
      const cam = cameraFor(state)
      return { x: pos.x + cam.x, y: pos.y + cam.y }
    }

    function loop() {
      const k = keysRef.current
      const state = stateRef.current
      const input = {
        left: k.has('ArrowLeft') || k.has('KeyA'),
        right: k.has('ArrowRight') || k.has('KeyD'),
        jump: k.has('ArrowUp') || k.has('KeyW') || k.has('Space'),
        mineHeld: mouseDownRef.current && state.uiPanel !== 'craft',
        aimX: 0, aimY: 0,
      }
      let worldAim = null
      if (aimRef.current) {
        const cam = cameraFor(state)
        worldAim = { x: aimRef.current.x + cam.x, y: aimRef.current.y + cam.y }
        input.aimX = worldAim.x; input.aimY = worldAim.y
      }
      stepGame(state, input)
      renderGame(ctx, state, worldAim)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('contextmenu', onContextMenu)
      canvas.removeEventListener('click', onClick)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return <canvas ref={canvasRef} width={W} height={H} className={styles.canvas} />
}

function craftHitTest(pos) {
  const panelW = 560, panelH = 440
  const px = W / 2 - panelW / 2, py = H / 2 - panelH / 2
  const rowH = 34
  if (pos.x < px + 12 || pos.x > px + panelW - 12) return null
  const relY = pos.y - (py + 46)
  if (relY < 0) return null
  const idx = Math.floor(relY / rowH)
  if (idx < 0 || idx >= RECIPES.length) return null
  if (relY - idx * rowH > rowH - 4) return null
  return RECIPES[idx].id
}

export default function ObviousMinecraftKnockoff() {
  const [screen, setScreen] = useState('title')
  const [seed] = useState(() => Math.floor(Math.random() * 1000000))

  return (
    <div className={styles.page}>
      {screen === 'title' && (
        <div className={styles.center}>
          <h1 className={styles.title}>⛏️ The Obvious Minecraft Knockoff</h1>
          <p className={styles.blurb}>
            A procedurally generated hill of dirt, stone, and buried treasure. Mine it, craft your
            way up the wood → stone → iron → diamond tool tree, build a furnace to smelt ore, and
            survive the shamblers that show up after dark. Any resemblance to a certain blocky
            sandbox is <em>extremely</em> on purpose and also legally just vibes.
          </p>
          <p className={styles.controls}>
            ← → move · ↑ / Space jump · Left click mine/attack · Right click place block<br />
            1–9 hotbar · C crafting · R reset world
          </p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={() => setScreen('playing')}>Start Knocking Off</button>
          </div>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'playing' && <GameCanvas seed={seed} />}
    </div>
  )
}
