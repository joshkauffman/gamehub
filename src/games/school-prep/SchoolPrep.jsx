import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './SchoolPrep.module.css'
import Setup from './screens/Setup.jsx'
import Question from './screens/Question.jsx'
import Review from './screens/Review.jsx'
import Results from './screens/Results.jsx'
import History from './screens/History.jsx'
import Timer from './components/Timer.jsx'
import ProgressStrip from './components/ProgressStrip.jsx'
import { buildRound } from './engine/roundBuilder.js'
import { scoreRound } from './engine/scoring.js'
import { saveRound, loadRound, clearRound, loadHistory, appendHistory, markSeen, recordVisit } from './engine/storage.js'

const GRACE_SECONDS = 20

export default function SchoolPrep() {
  const [round, setRound] = useState(() => {
    const saved = loadRound()
    return saved && saved.phase !== 'results' ? saved : null
  })
  const [resultsScore, setResultsScore] = useState(null)
  const [historyView, setHistoryView] = useState(false)
  const [graceSecondsLeft, setGraceSecondsLeft] = useState(null)
  const [timerHidden, setTimerHidden] = useState(false)
  const [visits, setVisits] = useState(null)
  const visitCounted = useRef(false)

  // Count one visit per page load. The ref guards against StrictMode's
  // dev-mode double effect run.
  useEffect(() => {
    if (visitCounted.current) return
    visitCounted.current = true
    setVisits(recordVisit())
  }, [])

  const activeRoundTicking = round != null && round.phase !== 'results'

  // Persist to localStorage whenever the round changes, so a refresh
  // mid-round restores it. Kept as its own effect (not scattered saveRound
  // calls inside each updater) since setState updater functions run twice
  // under StrictMode in dev — a side effect inside one would double-fire.
  useEffect(() => {
    if (round) saveRound(round)
  }, [round])

  // Countdown: ticks once a second whenever a round is in progress.
  useEffect(() => {
    if (!activeRoundTicking) return undefined
    const id = setInterval(() => {
      setRound(prev => {
        if (!prev) return prev
        const timeUsedSeconds = prev.timeUsedSeconds + 1
        let next = { ...prev, timeUsedSeconds }
        const timesUp = prev.timerOn && prev.durationSeconds != null && timeUsedSeconds >= prev.durationSeconds
        if (timesUp && prev.phase !== 'review' && prev.phase !== 'review-edit' && !prev.timesUp) {
          next = { ...next, phase: 'review', timesUp: true }
        }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [activeRoundTicking])

  // Grace period after time's up: a short window to look at the Review
  // screen before the round auto-submits.
  useEffect(() => {
    if (!round?.timesUp) { setGraceSecondsLeft(null); return }
    setGraceSecondsLeft(g => g ?? GRACE_SECONDS)
  }, [round?.timesUp])

  useEffect(() => {
    if (graceSecondsLeft == null) return undefined
    if (graceSecondsLeft <= 0) {
      finalize()
      return undefined
    }
    const t = setTimeout(() => setGraceSecondsLeft(g => g - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graceSecondsLeft])

  function handleStart(config) {
    setRound(buildRound(config))
    setResultsScore(null)
    setHistoryView(false)
  }

  function updateAndAdvance(question, choiceIndex, action) {
    setRound(prev => {
      const answers = { ...prev.answers }
      const status = { ...prev.status }
      if (action === 'unsure') {
        delete answers[question.id]
        status[question.id] = 'unsure'
      } else {
        answers[question.id] = choiceIndex
        status[question.id] = action
      }

      let next = { ...prev, answers, status }

      if (prev.phase === 'questions') {
        const editingBehind = prev.currentIndex < prev.maxIndexReached
        let currentIndex = editingBehind ? prev.maxIndexReached : prev.currentIndex + 1
        const maxIndexReached = Math.max(prev.maxIndexReached, currentIndex)
        if (currentIndex >= prev.questions.length) {
          const comebackQueue = prev.questions
            .filter(q => status[q.id] === 'unsure' && answers[q.id] == null)
            .map(q => q.id)
          next = comebackQueue.length > 0
            ? { ...next, phase: 'comeback', comebackQueue, comebackIndex: 0 }
            : { ...next, phase: 'review' }
        } else {
          next = { ...next, currentIndex, maxIndexReached }
        }
      } else if (prev.phase === 'comeback') {
        const comebackIndex = prev.comebackIndex + 1
        next = comebackIndex >= prev.comebackQueue.length
          ? { ...next, phase: 'review' }
          : { ...next, comebackIndex }
      }

      return next
    })
  }

  function handleEditFromReview(index) {
    setRound(prev => ({ ...prev, phase: 'review-edit', reviewEditIndex: index }))
  }

  function handleSaveEdit(choiceIndex) {
    setRound(prev => {
      const q = prev.questions[prev.reviewEditIndex]
      const answers = { ...prev.answers, [q.id]: choiceIndex }
      const status = { ...prev.status, [q.id]: prev.status[q.id] === 'flagged' ? 'flagged' : 'sure' }
      return { ...prev, answers, status, phase: 'review' }
    })
  }

  // Not a setRound(prev => ...) updater deliberately: it has side effects
  // (writing history, clearing storage), and StrictMode's dev-mode double
  // invocation of updater functions would otherwise append the round to
  // history twice.
  function finalize() {
    if (!round) return
    const timeUsedSeconds = round.timerOn
      ? round.timeUsedSeconds
      : Math.round((Date.now() - round.startedAt) / 1000)
    const finalRound = { ...round, timeUsedSeconds }
    const score = scoreRound(finalRound)
    appendHistory({
      date: Date.now(),
      subject: finalRound.subject,
      score: score.correctCount,
      total: score.total,
      percent: score.percent,
      timeUsedSeconds,
    })
    markSeen(finalRound.subject, finalRound.questions.map(q => q.id))
    clearRound()
    setResultsScore(score)
    setGraceSecondsLeft(null)
    setRound(null)
  }

  function backToSetup() {
    setResultsScore(null)
    setHistoryView(false)
    setRound(null)
  }

  const secondsLeft = round?.durationSeconds != null ? round.durationSeconds - round.timeUsedSeconds : null

  return (
    <div className={styles.page}>
      <Link to="/" className={styles.backBtn}>← Home</Link>

      {historyView ? (
        <History history={loadHistory()} onBack={() => setHistoryView(false)} />
      ) : resultsScore ? (
        <Results score={resultsScore} onRestart={backToSetup} onViewHistory={() => setHistoryView(true)} />
      ) : !round ? (
        <Setup onStart={handleStart} visits={visits} historyCount={loadHistory().length} onViewHistory={() => setHistoryView(true)} />
      ) : (
        <RoundView
          round={round}
          secondsLeft={secondsLeft}
          timerHidden={timerHidden}
          onToggleTimerVisibility={() => setTimerHidden(h => !h)}
          onAnswer={updateAndAdvance}
          onEditFromReview={handleEditFromReview}
          onSaveEdit={handleSaveEdit}
          onSubmit={finalize}
          onJump={index => setRound(prev => (
            index > prev.maxIndexReached ? prev : { ...prev, currentIndex: index }
          ))}
          graceSecondsLeft={graceSecondsLeft}
        />
      )}
    </div>
  )
}

function RoundView({ round, secondsLeft, timerHidden, onToggleTimerVisibility, onAnswer, onEditFromReview, onSaveEdit, onSubmit, onJump, graceSecondsLeft }) {
  const passageFor = q => q.passageId ? round.passages.find(p => p.id === q.passageId) : null

  if (round.phase === 'review') {
    return (
      <>
        {round.timerOn && <Timer secondsLeft={secondsLeft} visible={!timerHidden} low={secondsLeft < 60} />}
        {round.timesUp && graceSecondsLeft != null && (
          <div className={styles.timesUpBanner}>Time's up! Auto-submitting in {graceSecondsLeft}s — finish reviewing now.</div>
        )}
        <Review round={round} onEdit={onEditFromReview} onSubmit={onSubmit} />
      </>
    )
  }

  if (round.phase === 'review-edit') {
    const q = round.questions[round.reviewEditIndex]
    return (
      <>
        {round.timerOn && <Timer secondsLeft={secondsLeft} visible={!timerHidden} low={secondsLeft < 60} />}
        <Question
          question={q}
          passage={passageFor(q)}
          index={round.reviewEditIndex}
          total={round.questions.length}
          initialSelected={round.answers[q.id] ?? null}
          reviewMode
          onSaveEdit={onSaveEdit}
        />
      </>
    )
  }

  const isComeback = round.phase === 'comeback'
  const q = isComeback
    ? round.questions.find(x => x.id === round.comebackQueue[round.comebackIndex])
    : round.questions[round.currentIndex]
  const index = isComeback ? round.comebackIndex : round.currentIndex
  const total = isComeback ? round.comebackQueue.length : round.questions.length

  return (
    <>
      {round.timerOn && <Timer secondsLeft={secondsLeft} visible={!timerHidden} low={secondsLeft < 60} />}
      <button type="button" className={styles.timerToggle} onClick={onToggleTimerVisibility}>
        {timerHidden ? 'Show timer' : 'Hide timer'}
      </button>
      {!isComeback && (
        <ProgressStrip
          questions={round.questions}
          answers={round.answers}
          status={round.status}
          currentIndex={round.currentIndex}
          maxIndexReached={round.maxIndexReached}
          onJump={onJump}
        />
      )}
      {isComeback && <p className={styles.comebackNote}>Come-back pass — questions you were unsure about, {index + 1} of {total}.</p>}
      <Question
        question={q}
        passage={passageFor(q)}
        index={index}
        total={total}
        initialSelected={round.answers[q.id] ?? null}
        onSure={choiceIndex => onAnswer(q, choiceIndex, 'sure')}
        onFlag={choiceIndex => onAnswer(q, choiceIndex, 'flagged')}
        onUnsure={choiceIndex => onAnswer(q, choiceIndex, 'unsure')}
      />
    </>
  )
}
