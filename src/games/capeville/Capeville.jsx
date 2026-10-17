import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './Capeville.module.css'
import { W, H } from './constants.js'
import {
  POWERS, ELEMENTS, EMBLEMS, MASKS, PRIMARY_COLORS, ACCENT_COLORS, CAPE_COLORS,
  SKIN_TONES, HAIR_STYLES, HAIR_COLORS, EYE_COLORS, freshHero,
} from './heroData.js'
import { freshState, stepGame, rescueProgress } from './engine.js'
import { render, drawHero } from './render.js'

// ── Capeville ───────────────────────────────────────────────────────────
// An original game, not a knockoff of anything: design your own
// superhero — name, catchphrase, costume colors, emblem, cape, mask,
// and one power — then take them out for a patrol around an original
// city to try the power out for real. Every bit of the hero is drawn
// from scratch in render.js based entirely on what you picked here; the
// city (engine.js / cityData.js) is a simple top-down free-roam patrol
// where touching trouble always resolves it, and your power mainly
// changes how you get around and gives you one signature move.

function HeroPreview({ hero }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')
    ctx.clearRect(0, 0, 200, 220)
    const g = ctx.createLinearGradient(0, 0, 0, 220)
    g.addColorStop(0, '#2a3a6a')
    g.addColorStop(1, '#0f1530')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 200, 220)
    ctx.save()
    ctx.translate(40, 20)
    ctx.scale(2.2, 2.2)
    drawHero(ctx, hero, { x: 0, y: 0, w: 28, h: 34, facing: 'down', flying: false, carrying: null }, 30)
    ctx.restore()
  }, [hero])
  return <canvas ref={canvasRef} width={200} height={220} className={styles.previewCanvas} />
}

function Swatch({ color, selected, onClick }) {
  return (
    <button
      type="button"
      className={`${styles.swatch} ${selected ? styles.swatchSelected : ''}`}
      style={{ background: color }}
      onClick={onClick}
      aria-label={color}
    />
  )
}

function CreatorScreen({ hero, setHero, onLaunch }) {
  const power = POWERS.find(p => p.id === hero.powerId)
  return (
    <div className={styles.creatorWrap}>
      <div className={styles.creatorLeft}>
        <HeroPreview hero={hero} />
        <p className={styles.heroNamePreview}>{hero.name || 'Unnamed Hero'}</p>
        {hero.catchphrase && <p className={styles.catchphrasePreview}>&ldquo;{hero.catchphrase}&rdquo;</p>}
      </div>

      <div className={styles.creatorRight}>
        <label className={styles.fieldLabel}>Hero name</label>
        <input
          className={styles.textInput}
          value={hero.name}
          maxLength={24}
          placeholder="e.g. Crimson Comet"
          onChange={e => setHero({ ...hero, name: e.target.value })}
        />

        <label className={styles.fieldLabel}>Catchphrase (optional)</label>
        <input
          className={styles.textInput}
          value={hero.catchphrase}
          maxLength={40}
          placeholder="e.g. Justice never sleeps!"
          onChange={e => setHero({ ...hero, catchphrase: e.target.value })}
        />

        <label className={styles.fieldLabel}>Skin tone</label>
        <div className={styles.swatchRow}>
          {SKIN_TONES.map(c => (
            <Swatch key={c} color={c} selected={hero.skinTone === c} onClick={() => setHero({ ...hero, skinTone: c })} />
          ))}
        </div>

        <label className={styles.fieldLabel}>Suit color</label>
        <div className={styles.swatchRow}>
          {PRIMARY_COLORS.map(c => (
            <Swatch key={c} color={c} selected={hero.primaryColor === c} onClick={() => setHero({ ...hero, primaryColor: c })} />
          ))}
        </div>

        <label className={styles.fieldLabel}>Accent color</label>
        <div className={styles.swatchRow}>
          {ACCENT_COLORS.map(c => (
            <Swatch key={c} color={c} selected={hero.accentColor === c} onClick={() => setHero({ ...hero, accentColor: c })} />
          ))}
        </div>

        <label className={styles.fieldLabel}>Emblem</label>
        <div className={styles.pillRow}>
          {EMBLEMS.map(em => (
            <button key={em} type="button" className={`${styles.pillBtn} ${hero.emblem === em ? styles.pillSelected : ''}`} onClick={() => setHero({ ...hero, emblem: em })}>
              {em}
            </button>
          ))}
        </div>

        <label className={styles.fieldLabel}>Mask</label>
        <div className={styles.pillRow}>
          {MASKS.map(m => (
            <button key={m.id} type="button" className={`${styles.pillBtn} ${hero.mask === m.id ? styles.pillSelected : ''}`} onClick={() => setHero({ ...hero, mask: m.id })}>
              {m.name}
            </button>
          ))}
          <button type="button" className={`${styles.pillBtn} ${hero.cape ? styles.pillSelected : ''}`} onClick={() => setHero({ ...hero, cape: !hero.cape })}>
            {hero.cape ? '✓ Cape' : 'No Cape'}
          </button>
        </div>

        {hero.cape && (
          <>
            <label className={styles.fieldLabel}>Cape color</label>
            <div className={styles.swatchRow}>
              {CAPE_COLORS.map(c => (
                <Swatch key={c} color={c} selected={hero.capeColor === c} onClick={() => setHero({ ...hero, capeColor: c })} />
              ))}
            </div>
          </>
        )}

        {hero.mask !== 'full' && (
          <>
            <label className={styles.fieldLabel}>Eye color</label>
            <div className={styles.swatchRow}>
              {EYE_COLORS.map(c => (
                <Swatch key={c} color={c} selected={hero.eyeColor === c} onClick={() => setHero({ ...hero, eyeColor: c })} />
              ))}
            </div>

            <label className={styles.fieldLabel}>Hair style</label>
            <div className={styles.pillRow}>
              {HAIR_STYLES.map(h => (
                <button key={h.id} type="button" className={`${styles.pillBtn} ${hero.hairStyle === h.id ? styles.pillSelected : ''}`} onClick={() => setHero({ ...hero, hairStyle: h.id })}>
                  {h.name}
                </button>
              ))}
            </div>

            {hero.hairStyle !== 'bald' && (
              <>
                <label className={styles.fieldLabel}>Hair color</label>
                <div className={styles.swatchRow}>
                  {HAIR_COLORS.map(c => (
                    <Swatch key={c} color={c} selected={hero.hairColor === c} onClick={() => setHero({ ...hero, hairColor: c })} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <label className={styles.fieldLabel}>Power</label>
        <div className={styles.powerGrid}>
          {POWERS.map(pw => (
            <button
              key={pw.id}
              type="button"
              className={`${styles.powerCard} ${hero.powerId === pw.id ? styles.powerSelected : ''}`}
              onClick={() => setHero({ ...hero, powerId: pw.id })}
            >
              <span className={styles.powerIcon}>{pw.icon}</span>
              <span className={styles.powerName}>{pw.name}</span>
            </button>
          ))}
        </div>
        <p className={styles.powerDesc}>{power.desc}</p>

        {hero.powerId === 'blast' && (
          <>
            <label className={styles.fieldLabel}>Energy type</label>
            <div className={styles.pillRow}>
              {ELEMENTS.map(el => (
                <button
                  key={el.id}
                  type="button"
                  className={`${styles.pillBtn} ${hero.elementId === el.id ? styles.pillSelected : ''}`}
                  style={hero.elementId === el.id ? { borderColor: el.color, color: el.color } : undefined}
                  onClick={() => setHero({ ...hero, elementId: el.id })}
                >
                  {el.name}
                </button>
              ))}
            </div>
          </>
        )}

        <button className={styles.bigBtn} onClick={onLaunch}>🏙️ Test in the City</button>
      </div>
    </div>
  )
}

function GameCanvas({ hero, onBack }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const keysRef = useRef(new Set())
  const rafRef = useRef(null)
  const [, setTick] = useState(0)
  if (!stateRef.current) stateRef.current = freshState(hero)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    function onKeyDown(e) {
      const blocked = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)
      if (blocked) e.preventDefault()
      keysRef.current.add(e.code)
    }
    function onKeyUp(e) { keysRef.current.delete(e.code) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    function loop() {
      const k = keysRef.current
      const input = {
        left: k.has('ArrowLeft') || k.has('KeyA'),
        right: k.has('ArrowRight') || k.has('KeyD'),
        up: k.has('ArrowUp') || k.has('KeyW'),
        down: k.has('ArrowDown') || k.has('KeyS'),
        ability: k.has('Space') || k.has('KeyZ'),
      }
      stepGame(stateRef.current, input)
      render(ctx, stateRef.current)
      setTick(t => t + 1)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const { done, total } = rescueProgress(stateRef.current)

  return (
    <div className={styles.canvasWrap}>
      <canvas ref={canvasRef} width={W} height={H} className={styles.canvas} />
      <div className={styles.cityBar}>
        <span>{done}/{total} crime scenes stopped</span>
        <button className={styles.smallBtn} onClick={onBack}>← Back to HQ (edit hero)</button>
      </div>
    </div>
  )
}

export default function Capeville() {
  const [hero, setHero] = useState(() => freshHero())
  const [screen, setScreen] = useState('intro')

  return (
    <div className={styles.page}>
      {screen === 'intro' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🦸 Capeville</h1>
          <p className={styles.blurb}>
            Design your own superhero from scratch — name, catchphrase, skin tone, hair, suit and
            cape colors, emblem, mask, and one real power — then head out and try them for a patrol
            around Capeville. Fly over the skyline, out-run traffic, hurl a car, or sling elemental
            bolts. Crime scenes fight back now, too: get in close and press the ability button to
            punch, dash through, blast, or throw a villain down for the count — whatever you build
            is what you'll actually get to play.
          </p>
          <button className={styles.bigBtn} onClick={() => setScreen('creator')}>✏️ Create Your Hero</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'creator' && (
        <div className={styles.creatorPage}>
          <CreatorScreen hero={hero} setHero={setHero} onLaunch={() => setScreen('city')} />
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'city' && (
        <div className={styles.cityPage}>
          <GameCanvas hero={hero} onBack={() => setScreen('creator')} />
        </div>
      )}
    </div>
  )
}
