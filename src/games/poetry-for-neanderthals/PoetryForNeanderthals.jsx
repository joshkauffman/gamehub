import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import styles from './PoetryForNeanderthals.module.css'
import { cards } from './cards.js'

const DECKS = [
  { id: 'all', label: 'All Cards' },
  { id: 'base', label: 'Base Game' },
  { id: 'expansion', label: 'Expansion' },
]

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildDeck(filter) {
  const filtered = filter === 'all' ? cards : cards.filter(c => c.deck === filter)
  return shuffle(filtered)
}

function fmt(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function parseTimeInput(val) {
  const trimmed = val.trim()
  if (trimmed.includes(':')) {
    const [mStr, sStr] = trimmed.split(':')
    const secs = (parseInt(mStr) || 0) * 60 + (parseInt(sStr) || 0)
    return Math.max(10, Math.min(600, secs))
  }
  return Math.max(10, Math.min(600, (parseFloat(trimmed) || 1) * 60))
}

const DEFAULT_TEAMS = [
  { name: 'Team 1', score: 0 },
  { name: 'Team 2', score: 0 },
]

export default function PoetryForNeanderthals() {
  const [screen, setScreen] = useState('menu') // 'menu' | 'player' | 'manager'

  // ── Player state ──────────────────────────────────────────────────────
  const [deckFilter, setDeckFilter] = useState('all')
  const [deck, setDeck] = useState(() => buildDeck('all'))
  const [cardIndex, setCardIndex] = useState(0)

  // ── Manager state ─────────────────────────────────────────────────────
  const [scoringMode, setScoringMode] = useState('teams') // 'teams' | 'group'
  const [roundTime, setRoundTime] = useState(60)
  const [editingTime, setEditingTime] = useState(false)
  const [timeInput, setTimeInput] = useState('1:00')
  const [timerActive, setTimerActive] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60)
  const [roundDone, setRoundDone] = useState(false)
  const [teams, setTeams] = useState(DEFAULT_TEAMS.map(t => ({ ...t })))
  const [activeTeam, setActiveTeam] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const [roundScore, setRoundScore] = useState(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!timerActive) return
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(intervalRef.current)
          setTimerActive(false)
          setRoundDone(true)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [timerActive])

  function startRound() {
    setTimeLeft(roundTime)
    setRoundScore(0)
    setRoundDone(false)
    setTimerActive(true)
  }

  function endRound() {
    clearInterval(intervalRef.current)
    setTimerActive(false)
    setRoundDone(true)
  }

  function addPoints(pts) {
    if (scoringMode === 'teams') {
      setTeams(ts => ts.map((t, i) => i === activeTeam ? { ...t, score: t.score + pts } : t))
    } else {
      setRoundScore(r => r + pts)
      setTotalScore(s => s + pts)
    }
  }

  function nextTeam() {
    setActiveTeam(i => (i + 1) % teams.length)
    setRoundDone(false)
    setTimeLeft(roundTime)
  }

  function newGame() {
    clearInterval(intervalRef.current)
    setTimerActive(false)
    setRoundDone(false)
    setTimeLeft(roundTime)
    setTeams(DEFAULT_TEAMS.map(t => ({ ...t })))
    setActiveTeam(0)
    setTotalScore(0)
    setRoundScore(0)
  }

  function applyTimeEdit() {
    const secs = parseTimeInput(timeInput)
    setRoundTime(secs)
    setTimeLeft(secs)
    setEditingTime(false)
  }

  function switchScoringMode(mode) {
    if (mode === scoringMode) return
    setScoringMode(mode)
    newGame()
  }

  // ── Player helpers ────────────────────────────────────────────────────
  const currentCard = deck[cardIndex] ?? null
  const remaining = deck.length - cardIndex
  const progress = deck.length > 0 ? (cardIndex / deck.length) * 100 : 0

  function handleFilterChange(id) {
    setDeckFilter(id)
    setDeck(buildDeck(id))
    setCardIndex(0)
  }

  // ── Menu Screen ───────────────────────────────────────────────────────
  if (screen === 'menu') {
    return (
      <div className={styles.page}>
        <div className={styles.topBar}>
          <Link to="/" className={styles.backBtn}>← Home</Link>
          <span />
        </div>
        <h1 className={styles.title}>Poetry for Neanderthals</h1>
        <p className={styles.subtitle}>ONE SYLLABLE OR BUST</p>
        <div className={styles.modeCards}>
          <button className={styles.modeCard} onClick={() => setScreen('player')}>
            <span className={styles.modeIcon}>🃏</span>
            <strong className={styles.modeName}>Player</strong>
            <span className={styles.modeDesc}>Browse the card deck and read clues aloud</span>
          </button>
          <button className={styles.modeCard} onClick={() => setScreen('manager')}>
            <span className={styles.modeIcon}>⏱️</span>
            <strong className={styles.modeName}>Manager</strong>
            <span className={styles.modeDesc}>Run the timer and keep score</span>
          </button>
        </div>
      </div>
    )
  }

  // ── Player Screen ─────────────────────────────────────────────────────
  if (screen === 'player') {
    return (
      <div className={styles.page}>
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => setScreen('menu')}>← Menu</button>
          <span className={styles.counter}>
            {remaining > 0 ? `${remaining} card${remaining !== 1 ? 's' : ''} left` : 'Deck done'}
          </span>
        </div>
        <h1 className={styles.title}>Poetry for Neanderthals</h1>
        <p className={styles.subtitle}>ONE SYLLABLE OR BUST</p>
        <div className={styles.deckFilters}>
          {DECKS.map(d => (
            <button
              key={d.id}
              className={`${styles.filterBtn}${deckFilter === d.id ? ' ' + styles.active : ''}`}
              onClick={() => handleFilterChange(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className={styles.cardArea}>
          {currentCard ? (
            <div className={styles.card}>
              <div className={`${styles.cardSection} ${styles.threePoint}`}>
                <div className={styles.pointBadge}>3</div>
                <div className={styles.word}>{currentCard.threePoint}</div>
              </div>
              <div className={styles.divider} />
              <div className={`${styles.cardSection} ${styles.onePoint}`}>
                <div className={styles.pointBadge}>1</div>
                <div className={styles.word}>{currentCard.onePoint}</div>
              </div>
            </div>
          ) : (
            <div className={`${styles.card} ${styles.emptyState}`}>
              <span className={styles.emptyEmoji}>🦴</span>
              <p className={styles.emptyText}>Deck empty — reshuffle to play again!</p>
            </div>
          )}
        </div>
        <div className={styles.actions}>
          <button
            className={styles.nextBtn}
            onClick={() => setCardIndex(i => i + 1)}
            disabled={!currentCard || cardIndex >= deck.length - 1}
          >
            Next Card →
          </button>
          <button
            className={styles.reshuffleBtn}
            onClick={() => { setDeck(buildDeck(deckFilter)); setCardIndex(0) }}
          >
            Reshuffle Deck
          </button>
        </div>
        <div className={styles.progress}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    )
  }

  // ── Manager Screen ────────────────────────────────────────────────────
  const timerLow  = timeLeft <= 10 && (timerActive || roundDone)
  const timerWarn = timeLeft <= 20 && timeLeft > 10 && timerActive

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => setScreen('menu')}>← Menu</button>
        <span className={styles.mgrLabel}>Manager</span>
      </div>

      <h1 className={styles.title}>Poetry for Neanderthals</h1>

      {/* Scoring mode toggle */}
      <div className={styles.segControl}>
        <button
          className={`${styles.segBtn}${scoringMode === 'teams' ? ' ' + styles.segActive : ''}`}
          onClick={() => switchScoringMode('teams')}
          disabled={timerActive}
        >
          Teams
        </button>
        <button
          className={`${styles.segBtn}${scoringMode === 'group' ? ' ' + styles.segActive : ''}`}
          onClick={() => switchScoringMode('group')}
          disabled={timerActive}
        >
          Group
        </button>
      </div>

      {/* Time per Round */}
      <div className={styles.timeRow}>
        <span className={styles.timeLabel}>Time per Round</span>
        {editingTime ? (
          <div className={styles.timeEditRow}>
            <input
              className={styles.timeInput}
              value={timeInput}
              onChange={e => setTimeInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') applyTimeEdit()
                if (e.key === 'Escape') setEditingTime(false)
              }}
              autoFocus
              placeholder="1:00"
            />
            <button className={styles.timeConfirm} onClick={applyTimeEdit}>Set</button>
            <button className={styles.timeCancel} onClick={() => setEditingTime(false)}>✕</button>
          </div>
        ) : (
          <button
            className={styles.timeDisplay}
            onClick={() => { setTimeInput(fmt(roundTime)); setEditingTime(true) }}
            disabled={timerActive}
            title="Click to change"
          >
            {fmt(roundTime)} ✎
          </button>
        )}
      </div>

      {/* Score display */}
      {scoringMode === 'teams' ? (
        <div className={styles.teamsRow}>
          {teams.map((t, i) => (
            <div
              key={i}
              className={`${styles.teamBox}${i === activeTeam ? ' ' + styles.teamBoxActive : ''}`}
            >
              <div className={styles.teamName}>{t.name}</div>
              <div className={styles.teamScore}>{t.score}</div>
              {i === activeTeam && <div className={styles.activePip}>▶ Active</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.groupRow}>
          <div className={styles.groupBox}>
            <div className={styles.groupLabel}>Round</div>
            <div className={styles.groupValue}>{roundScore}</div>
          </div>
          <div className={`${styles.groupBox} ${styles.groupTotal}`}>
            <div className={styles.groupLabel}>Total</div>
            <div className={styles.groupValue}>{totalScore}</div>
          </div>
        </div>
      )}

      {/* Timer */}
      <div className={styles.timerSection}>
        <div
          className={`${styles.timerDisplay}${timerLow ? ' ' + styles.timerLow : timerWarn ? ' ' + styles.timerWarn : ''}`}
        >
          {fmt(timeLeft)}
        </div>

        {!timerActive && !roundDone && (
          <button className={styles.startBtn} onClick={startRound}>
            Start Round
          </button>
        )}

        {timerActive && (
          <button className={styles.endBtn} onClick={endRound}>
            End Round Early
          </button>
        )}

        {roundDone && (
          <div className={styles.roundDoneArea}>
            <p className={styles.roundDoneMsg}>
              {timeLeft === 0 ? "Time's up!" : 'Round ended'}
            </p>
            {scoringMode === 'teams' ? (
              <button className={styles.nextTeamBtn} onClick={nextTeam}>
                Next Team →
              </button>
            ) : (
              <button className={styles.startBtn} onClick={startRound}>
                Next Round
              </button>
            )}
          </div>
        )}
      </div>

      {/* Point buttons — visible only during an active round */}
      {timerActive && (
        <div className={styles.pointBtns}>
          <button className={styles.ptBtn1} onClick={() => addPoints(1)}>
            +1 Point
          </button>
          <button className={styles.ptBtn3} onClick={() => addPoints(3)}>
            +3 Points
          </button>
        </div>
      )}

      <button className={styles.newGameBtn} onClick={newGame}>
        New Game
      </button>
    </div>
  )
}
