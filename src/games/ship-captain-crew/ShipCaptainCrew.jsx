import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styles from './ShipCaptainCrew.module.css'
import Stage, { Hit } from './Stage.jsx'
import Die from './Die.jsx'
import { HOME, THEMES, THEME_ORDER, DEFAULT_THEME } from './themes.js'

const THEME_KEY = 'scc-theme'
const ROUND_OPTIONS = [5, 8, 10]
const MAX_ROLLS = 3
const ROLES = ['ship', 'captain', 'crew']

function rollValue() {
  return Math.floor(Math.random() * 6) + 1
}

function freshDice() {
  return Array.from({ length: 5 }, () => ({ value: null, role: null, held: false }))
}

// Ship (6) must be claimed before captain (5), and captain before crew (4).
function assignRoles(dice) {
  const next = dice.map(d => ({ ...d }))
  let ready = true
  for (const [role, value] of [['ship', 6], ['captain', 5], ['crew', 4]]) {
    if (next.some(d => d.role === role)) continue
    if (!ready) break
    const d = next.find(d => d.role === null && d.value === value)
    if (d) d.role = role
    else ready = false
  }
  return next
}

function computeTurnScore(dice) {
  if (!ROLES.every(r => dice.some(d => d.role === r))) return 0
  return dice.filter(d => d.role === null).reduce((sum, d) => sum + (d.value || 0), 0)
}

function Art({ src, box, style }) {
  return (
    <img
      src={src} alt="" draggable="false"
      style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h,
               pointerEvents: 'none', ...style }}
    />
  )
}

function Serif({ box, size, color, weight = 700, align, children, style }) {
  const cls = [styles.serif, align === 'left' ? styles.alignLeft : '',
               align === 'right' ? styles.alignRight : ''].filter(Boolean).join(' ')
  return (
    <div
      className={cls}
      style={{
        left: box.x, top: box.y, width: box.w, height: box.h,
        fontSize: size, color, fontWeight: weight, ...style,
      }}
    >
      <span>{children}</span>
    </div>
  )
}

export default function ShipCaptainCrew() {
  const navigate = useNavigate()
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || DEFAULT_THEME)
  const [menuOpen, setMenuOpen] = useState(false)
  const [screen, setScreen] = useState('home')

  const [playerCount, setPlayerCount] = useState(1)
  const [rounds, setRounds] = useState(8)
  const [names, setNames] = useState(['', ''])
  const [game, setGame] = useState(null)

  useEffect(() => { localStorage.setItem(THEME_KEY, theme) }, [theme])

  const t = THEMES[theme] || THEMES[DEFAULT_THEME]

  function startGame() {
    const players = playerCount === 2
      ? [names[0].trim() || 'Player 1', names[1].trim() || 'Player 2']
      : [names[0].trim() || 'You']
    setGame({
      players,
      scores: players.map(() => 0),
      round: 1,
      totalRounds: rounds,
      currentPlayer: 0,
      dice: freshDice(),
      rollsLeft: MAX_ROLLS,
    })
    setScreen('game')
  }

  function roll() {
    setGame(g => {
      if (!g || g.rollsLeft <= 0) return g
      const rolled = g.dice.map(d =>
        d.role !== null || d.held ? d : { ...d, value: rollValue() })
      return { ...g, dice: assignRoles(rolled), rollsLeft: g.rollsLeft - 1 }
    })
  }

  function toggleHold(i) {
    setGame(g => {
      if (!g) return g
      const d = g.dice[i]
      if (d.role !== null || d.value === null) return g
      return { ...g, dice: g.dice.map((die, k) => k === i ? { ...die, held: !die.held } : die) }
    })
  }

  function endTurn() {
    setGame(g => {
      if (!g) return g
      const score = computeTurnScore(g.dice)
      const scores = g.scores.map((s, i) => i === g.currentPlayer ? s + score : s)
      const isLast = g.currentPlayer === g.players.length - 1
      const nextRound = isLast ? g.round + 1 : g.round
      if (nextRound > g.totalRounds) {
        setScreen('results')
        return { ...g, scores }
      }
      return {
        ...g,
        scores,
        round: nextRound,
        currentPlayer: isLast ? 0 : g.currentPlayer + 1,
        dice: freshDice(),
        rollsLeft: MAX_ROLLS,
      }
    })
  }

  const backToHome = useCallback(() => {
    setScreen('home')
    setGame(null)
  }, [])

  const hasRolled = !!game && game.dice.some(d => d.value !== null)
  const canRoll = !!game && game.rollsLeft > 0
  const claimed = ROLES.map(r => !!game && game.dice.some(d => d.role === r))

  return (
    <div className={styles.page} data-theme={theme}>
      <div className={styles.chrome}>
        <Link to="/" className={styles.chromeBtn}>← GameHub</Link>
        <button className={styles.chromeBtn} onClick={() => setMenuOpen(v => !v)}>
          ☸ {t.name}
        </button>
      </div>

      {menuOpen && (
        <div className={styles.themeMenu}>
          {THEME_ORDER.map(key => (
            <button
              key={key}
              className={[styles.themeOption, key === theme ? styles.themeOptionOn : '']
                .filter(Boolean).join(' ')}
              onClick={() => { setTheme(key); setMenuOpen(false) }}
            >
              <span className={styles.swatchRow}>
                {THEMES[key].swatch.map((c, i) => (
                  <span key={i} className={styles.swatchDot} style={{ background: c }} />
                ))}
              </span>
              {THEMES[key].name}
            </button>
          ))}
        </div>
      )}

      {screen === 'home' && (
        <SetupScreen
          playerCount={playerCount} setPlayerCount={setPlayerCount}
          rounds={rounds} setRounds={setRounds}
          names={names} setNames={setNames}
          onStart={startGame}
          onWheel={() => setMenuOpen(v => !v)}
        />
      )}

      {screen === 'game' && game && (
        <Stage width={t.w} height={t.h} plate={t.plate}>
          {t.bakedBack && <Hit {...t.bakedBack} label="Back to GameHub"
                               onClick={() => navigate('/')} />}
          {t.bakedGear && <Hit {...t.bakedGear} label="Change theme"
                               onClick={() => setMenuOpen(v => !v)} />}

          {/* claimed-role feedback: harbor lights the stars it already has
              painted; the other two get a warm glow behind the badge, which
              adds to the artwork rather than covering any of it */}
          {t.marker && t.marker.xs.map((x, i) => (
            <img
              key={i} src={t.marker.img} alt=""
              className={[styles.marker, claimed[i] ? '' : styles.markerOff].filter(Boolean).join(' ')}
              style={{ left: x, top: t.marker.y, width: t.marker.w, height: t.marker.h }}
            />
          ))}
          {t.glow && t.glow.cols.map((c, i) => (
            <div key={i} className={styles.claimGlow}
                 style={{ left: c.x, top: t.glow.y, width: c.w, height: t.glow.h,
                          opacity: claimed[i] ? 1 : 0 }} />
          ))}

          <div className={styles.roundTag}
               style={{ left: t.roundTag.x, top: t.roundTag.y, width: t.roundTag.w,
                        height: t.roundTag.h, color: t.ink,
                        fontSize: t.roundTag.size || 26,
                        letterSpacing: t.roundTag.tracking || '0.14em',
                        background: t.roundTag.chip || 'transparent' }}>
            Round {game.round} of {game.totalRounds}
          </div>

          {game.dice.map((d, i) => (
            <Die
              key={i} theme={t} value={d.value} role={d.role} held={d.held}
              ghost={d.value === null} slot={i}
              x={t.die.xs[i]} y={t.die.tops}
              disabled={d.role !== null || d.value === null}
              onClick={() => toggleHold(i)}
            />
          ))}

          <div className={styles.rolls}
               style={{ left: t.rolls.x, top: t.rolls.y, width: t.rolls.w,
                        height: t.rolls.h, color: t.inkSoft }}>
            {game.rollsLeft > 0
              ? `${game.rollsLeft} roll${game.rollsLeft === 1 ? '' : 's'} left`
              : 'No rolls left — score this turn'}
          </div>

          {game.players.map((name, i) => {
            const p = t.scores.panels[i]
            const pick = v => Array.isArray(v) ? v[i] : v
            return (
              <div key={i}>
                {game.currentPlayer === i && (
                  <div className={styles.activeFrame}
                       style={{ left: p.frame.x, top: p.frame.y,
                                width: p.frame.w, height: p.frame.h }} />
                )}
                <Serif box={p.name} size={t.scores.nameSize} align={p.name.align}
                       color={pick(t.scores.nameColor)}
                       style={{ letterSpacing: t.scores.letterSpacing,
                                textTransform: t.scores.uppercase ? 'uppercase' : 'none' }}>
                  {name}
                </Serif>
                <Serif box={p.value} size={t.scores.valueSize} align={p.value.align}
                       color={pick(t.scores.valueColor)}>
                  {game.scores[i]}
                </Serif>
              </div>
            )
          })}

          {game.players.length === 1 && (
            <div className={styles.emptySeat}
                 style={{ left: t.scores.panels[1].frame.x, top: t.scores.panels[1].frame.y,
                          width: t.scores.panels[1].frame.w,
                          height: t.scores.panels[1].frame.h }} />
          )}

          <ActionBar theme={t} canRoll={canRoll} hasRolled={hasRolled}
                     onRoll={roll} onEnd={endTurn} onNew={backToHome} />
        </Stage>
      )}

      {screen === 'results' && game && (
        <ResultsScreen game={game} onAgain={backToHome} onWheel={() => setMenuOpen(v => !v)} />
      )}
    </div>
  )
}

// --------------------------------------------------------------- setup ------

function SetupScreen({ playerCount, setPlayerCount, rounds, setRounds, names, setNames,
                       onStart, onWheel }) {
  const H = HOME
  return (
    <Stage width={H.w} height={H.h} plate={H.plate}>
      <Hit {...H.wheel} label="Change theme" onClick={onWheel} />

      {[1, 2].map(n => {
        const box = H.playerPills[n - 1]
        const on = playerCount === n
        return (
          <button
            key={n}
            className={[styles.pill, on ? '' : styles.pillOff].filter(Boolean).join(' ')}
            style={{ left: box.x, top: box.y, width: box.w, height: box.h, fontSize: 38 }}
            onClick={() => setPlayerCount(n)}
          >
            {on && <span className={styles.pillSkin}
                         style={{ borderImageSource: `url(${H.pill})` }} />}
            <img src={H.anchor} alt="" className={styles.pillAnchor}
                 style={{ width: 46, height: 48, filter: on ? 'none' : 'grayscale(1) opacity(0.45)' }} />
            <span className={styles.pillLabel} style={{ color: on ? '#182f58' : '#9b9891' }}>
              {n} Player{n > 1 ? 's' : ''}
            </span>
          </button>
        )
      })}

      <Art src={H.roundsLabel.img} box={H.roundsLabel} />
      {ROUND_OPTIONS.map((n, i) => {
        const box = H.roundPills[i]
        const on = rounds === n
        return (
          <button
            key={n}
            className={[styles.pill, on ? '' : styles.pillOff].filter(Boolean).join(' ')}
            style={{ left: box.x, top: box.y, width: box.w, height: box.h, fontSize: 46 }}
            onClick={() => setRounds(n)}
          >
            {on && <span className={styles.pillSkin}
                         style={{ borderImageSource: `url(${H.pill})` }} />}
            <span className={styles.pillLabel} style={{ color: on ? '#182f58' : '#9b9891' }}>
              {n}
            </span>
            {on && (
              <img src={H.star} alt="" className={styles.pillStar}
                   style={{ width: 36, height: 34, top: -16 }} />
            )}
          </button>
        )
      })}

      {H.players.map((p, i) => (
        (i === 0 || playerCount === 2) && (
          <div key={i}>
            <Art src={H.avatars[i]} box={p.avatar} />
            <Art src={H.labels[i]} box={p.label} />
            <div className={styles.field}
                 style={{ left: p.field.x, top: p.field.y,
                          width: p.field.w, height: p.field.h,
                          borderImageSource: `url(${H.field})` }} />
            <input
              className={styles.nameInput}
              style={{ left: p.field.x + 16, top: p.field.y + 10,
                       width: p.field.w - 32, height: p.field.h - 20 }}
              placeholder={i === 0 ? 'Captain' : 'First Mate'}
              aria-label={`Player ${i + 1} name`}
              maxLength={16}
              value={names[i]}
              onChange={e => setNames(prev => prev.map((v, k) => k === i ? e.target.value : v))}
            />
          </div>
        )
      ))}

      <Hit {...H.cta} label="Set sail" onClick={onStart} />
    </Stage>
  )
}

// ------------------------------------------------------------- results ------

function ResultsScreen({ game, onAgain, onWheel }) {
  const H = HOME
  const standings = game.players
    .map((name, i) => ({ name, score: game.scores[i] }))
    .sort((a, b) => b.score - a.score)

  return (
    <Stage width={H.w} height={H.h} plate={H.plate}>
      <Hit {...H.wheel} label="Change theme" onClick={onWheel} />

      <div className={styles.resultsTitle}
           style={{ left: 88, top: 430, width: 612, fontSize: 54 }}>
        Voyage Complete
      </div>

      {standings.map((p, i) => (
        <div key={p.name + i} className={styles.resultRow}
             style={{ left: 130, top: 540 + i * 92, width: 528, fontSize: 40 }}>
          <span style={{ fontWeight: i === 0 ? 700 : 500 }}>
            {i === 0 && standings.length > 1 ? '★ ' : ''}{p.name}
          </span>
          <span style={{ fontWeight: 700 }}>{p.score}</span>
        </div>
      ))}

      <Hit {...H.cta} label="Play again" onClick={onAgain} />
    </Stage>
  )
}

// ----------------------------------------------------------- action bar -----

function ActionBar({ theme, canRoll, hasRolled, onRoll, onEnd, onNew }) {
  const a = theme.actions

  // the harbor painting already carries its own control bar — only hit areas
  if (a.baked) {
    return (
      <>
        <Hit {...a.roll} label="Roll dice" onClick={onRoll} disabled={!canRoll} />
        <Hit {...a.end} label="End turn" onClick={onEnd} disabled={!hasRolled} />
        <Hit {...a.again} label="New game" onClick={onNew} />
      </>
    )
  }

  const btn = (box, label, onClick, disabled) => (
    <button
      className={[styles.actionBtn, a.banner ? '' : styles.actionPlain].filter(Boolean).join(' ')}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h,
               fontSize: a.labelSize, color: a.labelColor }}
      onClick={onClick}
      disabled={disabled}
    >
      {a.banner && (
        <span className={styles.actionBanner}
              style={{ borderImageSource: `url(${a.banner})` }} />
      )}
      <span className={styles.actionLabel}>{label}</span>
    </button>
  )

  return (
    <>
      {btn(a.roll, canRoll && hasRolled ? 'Roll Again' : 'Roll Dice', onRoll, !canRoll)}
      {btn(a.end, 'End Turn', onEnd, !hasRolled)}
      {btn(a.again, 'New Game', onNew, false)}
    </>
  )
}
