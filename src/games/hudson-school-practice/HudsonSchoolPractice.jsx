import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './HudsonSchoolPractice.module.css'
import Setup from './screens/Setup.jsx'
import Question from './screens/Question.jsx'
import Results from './screens/Results.jsx'
import History from './screens/History.jsx'
import Insights from './screens/Insights.jsx'
import { buildRound } from './engine/roundBuilder.js'
import { scoreRound } from './engine/scoring.js'
import { saveRound, loadRound, clearRound, loadHistory, appendHistory, markSeen, recordAnswer } from './engine/storage.js'

export default function HudsonSchoolPractice() {
  const [round, setRound] = useState(() => loadRound())
  const [resultsScore, setResultsScore] = useState(null)
  const [view, setView] = useState(null) // null | 'history' | 'insights'

  // Persist to localStorage whenever the round changes, so a refresh
  // mid-round restores it.
  useEffect(() => {
    if (round) saveRound(round)
  }, [round])

  function handleStart(config) {
    setRound(buildRound(config))
    setResultsScore(null)
    setView(null)
  }

  // A plain event handler, not a setState updater, so the side effect
  // (writing to the mastery map) only fires once per answer — React 18
  // StrictMode double-invokes updater functions in dev, which would
  // otherwise double-count this answer.
  function handleSubmit(choiceIndex) {
    const q = round.questions[round.currentIndex]
    const outcome = choiceIndex === q.answerIndex ? 'correct' : 'incorrect'
    recordAnswer(q, outcome)
    setRound(prev => ({
      ...prev,
      answers: { ...prev.answers, [q.id]: choiceIndex },
      outcomes: { ...prev.outcomes, [q.id]: outcome },
    }))
  }

  function handleIdk() {
    const q = round.questions[round.currentIndex]
    recordAnswer(q, 'idk')
    setRound(prev => ({
      ...prev,
      answers: { ...prev.answers, [q.id]: null },
      outcomes: { ...prev.outcomes, [q.id]: 'idk' },
    }))
  }

  function handleNext() {
    if (round.currentIndex + 1 >= round.questions.length) {
      finalize()
    } else {
      setRound(prev => ({ ...prev, currentIndex: prev.currentIndex + 1 }))
    }
  }

  function finalize() {
    if (!round) return
    const score = scoreRound(round)
    appendHistory({
      date: Date.now(),
      score: score.correctCount,
      wrong: score.wrongCount,
      idk: score.idkCount,
      total: score.total,
      percent: score.percent,
    })
    markSeen(round.questions.map(q => q.id))
    clearRound()
    setResultsScore(score)
    setRound(null)
  }

  function backToSetup() {
    setResultsScore(null)
    setView(null)
    setRound(null)
  }

  return (
    <div className={styles.page}>
      <Link to="/" className={styles.backBtn}>← Home</Link>

      {view === 'history' ? (
        <History
          history={loadHistory()}
          onBack={() => setView(null)}
          backLabel={resultsScore ? '← Back to results' : '← Back to setup'}
        />
      ) : view === 'insights' ? (
        <Insights
          onBack={() => setView(null)}
          backLabel={resultsScore ? '← Back to results' : '← Back to setup'}
        />
      ) : resultsScore ? (
        <Results
          score={resultsScore}
          onRestart={backToSetup}
          onViewHistory={() => setView('history')}
          onViewInsights={() => setView('insights')}
        />
      ) : !round ? (
        <Setup
          onStart={handleStart}
          historyCount={loadHistory().length}
          onViewHistory={() => setView('history')}
          onViewInsights={() => setView('insights')}
        />
      ) : (
        <RoundView round={round} onSubmit={handleSubmit} onIdk={handleIdk} onNext={handleNext} />
      )}
    </div>
  )
}

function RoundView({ round, onSubmit, onIdk, onNext }) {
  const q = round.questions[round.currentIndex]
  const revealed = round.outcomes[q.id] != null

  return (
    <Question
      question={q}
      index={round.currentIndex}
      total={round.questions.length}
      revealed={revealed}
      selectedAnswerIndex={round.answers[q.id] ?? null}
      outcome={round.outcomes[q.id]}
      onSubmit={onSubmit}
      onIdk={onIdk}
      onNext={onNext}
    />
  )
}
