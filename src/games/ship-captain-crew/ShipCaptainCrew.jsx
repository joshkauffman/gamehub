import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styles from './ShipCaptainCrew.module.css'
import Stage, { Hit } from './Stage.jsx'
import Die from './Die.jsx'
import { HOME, THEMES, THEME_ORDER, DEFAULT_THEME } from './themes.js'

const THEME_KEY = 'scc-theme'
const ROUND_OPTIONS = [5, 8, 10]
const MAX_ROLLS = 3
const ROLES = ['ship', 'captain', 'crew']
const ROLE_LABEL = { ship: 'Ship', captain: 'Captain', crew: 'Crew' }
const ROLE_VALUE = { ship: 6, captain: 5, crew: 4 }
const FX_MS = 620

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

// One sentence that always says what the player is chasing and what it is worth.
// Nothing else on the board explains the 6-then-5-then-4 order, so this line is
// the whole tutorial.
function statusLine(game) {
  const need = ROLES.find(r => !game.dice.some(d => d.role === r))
  const rolled = game.dice.some(d => d.value !== null)
  const rollsTxt = `${game.rollsLeft} roll${game.rollsLeft === 1 ? '' : 's'} left`
  if (need) {
    if (game.rollsLeft === 0) return `No ${ROLE_LABEL[need]} — this turn scores 0`
    return `${rolled ? 'Still need' : 'Need'} a ${ROLE_VALUE[need]}` +
           ` for your ${ROLE_LABEL[need]} · ${rollsTxt}`
  }
  const cargo = computeTurnScore(game.dice)
  if (game.rollsLeft === 0) return `Cargo ${cargo} — end turn to bank it`
  return `All aboard · cargo ${cargo} · ${rollsTxt}`
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
  // which dice are mid-tumble and which just locked in, plus a counter that
  // restarts those animations when the same die rolls twice in a row
  const [fx, setFx] = useState({ rolling: [], claiming: [], seq: 0 })
  // roll and endTurn read `game` from the closure, so a second click landing
  // before React commits would act on the stale turn; this blocks until it does
  const pending = useRef(false)

  useEffect(() => { pending.current = false })

  useEffect(() => { localStorage.setItem(THEME_KEY, theme) }, [theme])

  useEffect(() => {
    if (!fx.seq) return
    const id = setTimeout(() => setFx(f => ({ ...f, rolling: [], claiming: [] })), FX_MS)
    return () => clearTimeout(id)
  }, [fx.seq])

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
    setFx({ rolling: [], claiming: [], seq: 0 })
    setScreen('game')
  }

  function roll() {
    if (!game || game.rollsLeft <= 0 || pending.current) return
    pending.current = true
    const rolled = game.dice.map(d =>
      d.role !== null || d.held ? d : { ...d, value: rollValue() })
    const dice = assignRoles(rolled)
    const moved = i => game.dice[i].role === null && !game.dice[i].held
    setGame({ ...game, dice, rollsLeft: game.rollsLeft - 1 })
    setFx({
      rolling: dice.map((d, i) => moved(i) && d.role === null),
      claiming: dice.map((d, i) => moved(i) && d.role !== null),
      seq: fx.seq + 1,
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
    if (!game || pending.current) return
    pending.current = true
    const score = computeTurnScore(game.dice)
    const scores = game.scores.map((s, i) => i === game.currentPlayer ? s + score : s)
    const isLast = game.currentPlayer === game.players.length - 1
    const nextRound = isLast ? game.round + 1 : game.round
    setFx({ rolling: [], claiming: [], seq: 0 })
    if (nextRound > game.totalRounds) {
      setGame({ ...game, scores })
      setScreen('results')
      return
    }
    setGame({
      ...game,
      scores,
      round: nextRound,
      currentPlayer: isLast ? 0 : game.currentPlayer + 1,
      dice: freshDice(),
      rollsLeft: MAX_ROLLS,
    })
  }

  const backToHome = useCallback(() => {
    setScreen('home')
    setGame(null)
  }, [])

  const hasRolled = !!game && game.dice.some(d => d.value !== null)
  const canRoll = !!game && game.rollsLeft > 0
  const claimed = ROLES.map(r => !!game && game.dice.some(d => d.role === r))
  // done / next / waiting — the one state machine every theme's header runs on
  const nextRole = claimed.indexOf(false)
  const slotState = claimed.map((c, i) => c ? 'done' : i === nextRole ? 'next' : 'wait')

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

          {/* Role header, one state machine in three costumes: the column the
              player must fill next pulses, filled columns take a warm glow and
              a lit mark, the rest wait dimmed. Harbor lights the stars its
              painting already has; the other two plates never print 6/5/4 at
              all, so their mark is a coin carrying the number. */}
          {t.glow && t.glow.cols.map((c, i) => (
            <div key={i} className={styles.claimGlow}
                 style={{ left: c.x, top: t.glow.y, width: c.w, height: t.glow.h,
                          '--glow': t.glow.alpha ?? 0.42,
                          opacity: slotState[i] === 'done' ? 1 : 0 }} />
          ))}
          {t.marker && t.marker.xs.map((x, i) => (
            <img
              key={i} src={t.marker.img} alt=""
              className={[styles.marker, styles[`mark_${slotState[i]}`]].join(' ')}
              style={{ left: x, top: t.marker.y, width: t.marker.w, height: t.marker.h }}
            />
          ))}
          {t.coin && t.coin.xs.map((x, i) => (
            <span key={i}
                  className={[styles.coin, styles[`coin_${slotState[i]}`]].join(' ')}
                  style={{ left: x - t.coin.size / 2, top: t.coin.y,
                           width: t.coin.size, height: t.coin.size,
                           fontSize: t.coin.size * 0.56, color: t.coin.ink }}>
              {ROLE_VALUE[ROLES[i]]}
            </span>
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
              rolling={!!fx.rolling[i]} claiming={!!fx.claiming[i]} fxKey={fx.seq}
              x={t.die.xs[i]} y={t.die.tops}
              disabled={d.role !== null || d.value === null}
              onClick={() => toggleHold(i)}
            />
          ))}

          <div className={styles.status} role="status" aria-live="polite"
               style={{ left: t.status.x, top: t.status.y, width: t.status.w,
                        height: t.status.h }}>
            <span style={{ color: t.ink, background: t.status.chip }}>
              {statusLine(game)}
            </span>
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

      {playerCount === 1 && (
        <div className={styles.rules}
             style={{ left: H.rules.x, top: H.rules.y,
                      width: H.rules.w, height: H.rules.h }}>
          <span className={styles.rulesTitle}>How to Play</span>
          <span>
            Three rolls a turn with five dice. Claim a <b>6</b> for your Ship,
            then a <b>5</b> for the Captain, then a <b>4</b> for the Crew —
            strictly in that order.
          </span>
          <span>
            Once all three are aboard, the two dice left over are your cargo.
            Their total is the turn's score, so reroll them while you can.
          </span>
        </div>
      )}

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

      <div className={styles.resultsNote}
           style={{ left: 130, top: 540 + standings.length * 92 + 26, width: 528 }}>
        {standings.length > 1
          ? `${standings[0].name} wins by ${standings[0].score - standings[1].score}` +
            ` after ${game.totalRounds} rounds`
          : `${game.totalRounds} rounds · ` +
            `${(game.scores[0] / game.totalRounds).toFixed(1)} cargo a turn`}
      </div>

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
