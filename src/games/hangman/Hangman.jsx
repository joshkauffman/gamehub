import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import styles from './Hangman.module.css'
import HangmanSvg from './HangmanSvg.jsx'

const MAX_WRONG = 6
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const COMMON_WORDS = new Set([
  'a','i','an','am','as','at','be','by','do','go','he','if','in','is','it',
  'me','my','no','of','on','or','so','to','up','us','we','vs',
])

async function validateWord(word) {
  const w = word.toLowerCase().trim()
  if (COMMON_WORDS.has(w)) return true
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`)
    return res.ok
  } catch {
    return true
  }
}

async function validatePhrase(phrase) {
  const words = phrase.trim().split(/\s+/)
  const checks = await Promise.all(words.map(validateWord))
  return checks.every(Boolean)
}

// ── Setup screen ──────────────────────────────────────────────
function SetupScreen({ onConfirm }) {
  const [value, setValue] = useState('')
  const [show, setShow] = useState(true)  // visible by default
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleConfirm() {
    const trimmed = value.trim()
    if (!trimmed) return
    if (trimmed.replace(/\s/g, '').length < 5) {
      setStatus('error')
      setErrorMsg('Must be at least 5 letters long.')
      return
    }
    setStatus('checking')
    setErrorMsg('')
    const valid = await validatePhrase(trimmed)
    if (!valid) {
      setStatus('error')
      setErrorMsg(`"${trimmed}" doesn't look like a real word or phrase. Try again.`)
      return
    }
    setStatus('idle')
    onConfirm(trimmed.toUpperCase())
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleConfirm()
  }

  return (
    <div className={styles.setupCard}>
      <p className={styles.setupLabel}>Player 1 — Enter a word or phrase</p>

      <div className={styles.inputRow}>
        <input
          className={styles.wordInput}
          type={show ? 'text' : 'password'}
          placeholder="Type your word…"
          value={value}
          onChange={e => { setValue(e.target.value); setStatus('idle'); setErrorMsg('') }}
          onKeyDown={handleKey}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <button className={styles.showToggle} onClick={() => setShow(s => !s)}>
          {show ? 'Hide' : 'Show'}
        </button>
      </div>

      {errorMsg && <p className={styles.error}>{errorMsg}</p>}

      <button
        className={styles.primaryBtn}
        onClick={handleConfirm}
        disabled={!value.trim() || status === 'checking'}
      >
        {status === 'checking' ? 'Checking…' : 'Confirm Word'}
      </button>
    </div>
  )
}

// ── Pass screen ───────────────────────────────────────────────
function PassScreen({ onStart }) {
  return (
    <div className={styles.passScreen}>
      <div className={styles.passEmoji}>🙈</div>
      <h2 className={styles.passHeading}>Word confirmed!</h2>
      <p className={styles.passSubtext}>
        Pass the device to Player 2.<br />When they're ready, tap below.
      </p>
      <button className={styles.primaryBtn} style={{ maxWidth: 320 }} onClick={onStart}>
        I'm ready — Start Game
      </button>
    </div>
  )
}

// ── Game screen ───────────────────────────────────────────────
function GameScreen({ phrase, onPlayAgain }) {
  const letters = phrase.replace(/\s/g, '').split('').map(c => c.toUpperCase())
  const uniqueLetters = [...new Set(letters)]

  const [guessed, setGuessed] = useState(new Set())
  const [missedRevealed, setMissedRevealed] = useState(false)

  const wrongGuesses = [...guessed].filter(l => !uniqueLetters.includes(l))
  const wrongCount = wrongGuesses.length
  const won = uniqueLetters.every(l => guessed.has(l))
  const lost = wrongCount >= MAX_WRONG
  const over = won || lost

  // Lose: reveal missed letters after 1 s
  useEffect(() => {
    if (!lost) return
    const timer = setTimeout(() => setMissedRevealed(true), 1000)
    return () => clearTimeout(timer)
  }, [lost])

  const guess = useCallback((letter) => {
    if (guessed.has(letter) || over) return
    setGuessed(prev => new Set([...prev, letter]))
  }, [guessed, over])

  useEffect(() => {
    function onKey(e) {
      const l = e.key.toUpperCase()
      if (ALPHABET.includes(l)) guess(l)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [guess])

  const words = phrase.split(' ')

  return (
    <div className={styles.gameLayout}>
      <div className={styles.hangmanWrap}>
        <HangmanSvg wrongCount={wrongCount} />
        {won && (
          <div className={styles.winOverlay}>
            <div className={styles.endEmoji}>🎉</div>
            <h2 className={`${styles.endHeading} ${styles.win}`}>You got it!</h2>
            <button className={styles.primaryBtn} style={{ maxWidth: 220 }} onClick={onPlayAgain}>
              Play Again
            </button>
          </div>
        )}
      </div>

      <p className={styles.wrongLetters}>
        {wrongGuesses.length > 0 ? `Wrong: ${wrongGuesses.join(' ')}` : ' '}
      </p>

      <div className={styles.wordDisplay}>
        {words.map((word, wi) => (
          <div key={wi} className={styles.wordGroup}>
            {word.split('').map((ch, ci) => {
              const upper = ch.toUpperCase()
              const revealed = guessed.has(upper)
              const missed = !revealed && missedRevealed
              return (
                <div key={ci} className={styles.letterBox}>
                  <span className={
                    `${styles.letterChar}` +
                    `${revealed ? ' ' + styles.revealed : ''}` +
                    `${missed ? ' ' + styles.wrong : ''}`
                  }>
                    {revealed || missed ? upper : ' '}
                  </span>
                  <div className={styles.letterLine} />
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {!over && (
        <div className={styles.keyboard}>
          {ALPHABET.map(letter => {
            const isRight = guessed.has(letter) && uniqueLetters.includes(letter)
            const isWrong = guessed.has(letter) && !uniqueLetters.includes(letter)
            return (
              <button
                key={letter}
                className={
                  `${styles.keyBtn}` +
                  `${isRight ? ' ' + styles.guessedRight : ''}` +
                  `${isWrong ? ' ' + styles.guessedWrong : ''}`
                }
                onClick={() => guess(letter)}
                disabled={guessed.has(letter)}
              >
                {letter}
              </button>
            )
          })}
        </div>
      )}

      {missedRevealed && (
        <div className={styles.endScreen} style={{ marginTop: '1rem' }}>
          <div className={styles.endEmoji}>💀</div>
          <h2 className={`${styles.endHeading} ${styles.lose}`}>Game over!</h2>
          <button className={styles.primaryBtn} style={{ maxWidth: 280 }} onClick={onPlayAgain}>
            Play Again
          </button>
        </div>
      )}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────
export default function Hangman() {
  const [phase, setPhase] = useState('setup')
  const [phrase, setPhrase] = useState('')

  function handleConfirm(confirmed) {
    setPhrase(confirmed)
    setPhase('pass')
  }

  function handlePlayAgain() {
    setPhrase('')
    setPhase('setup')
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link to="/" className={styles.backBtn}>← Home</Link>
      </div>

      <h1 className={styles.title}>Hangman</h1>

      {phase === 'setup' && <SetupScreen onConfirm={handleConfirm} />}
      {phase === 'pass'  && <PassScreen onStart={() => setPhase('playing')} />}
      {phase === 'playing' && (
        <GameScreen phrase={phrase} onPlayAgain={handlePlayAgain} />
      )}
    </div>
  )
}
