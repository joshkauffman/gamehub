import { useState, useMemo, useRef } from 'react'
import styles from './Setup.module.css'
import { availableTopics } from '../engine/roundBuilder.js'
import { strandLabel } from '../engine/labels.js'

const SUBJECTS = [
  { id: 'math', label: 'Math', emoji: '➗' },
  { id: 'english', label: 'English', emoji: '📖' },
  { id: 'french', label: 'Français', emoji: '🇫🇷' },
]

const COUNT_PRESETS = [15, 25, 45]

export default function Setup({ onStart, visits, globalVisits, historyCount, onViewHistory }) {
  const [subject, setSubject] = useState('math')
  const [countChoice, setCountChoice] = useState(15)
  const [customCount, setCustomCount] = useState('')
  const [customError, setCustomError] = useState('')
  const [timerOn, setTimerOn] = useState(true)
  const [topicFilter, setTopicFilter] = useState('')
  const [showVisits, setShowVisits] = useState(false)
  const infoRef = useRef(null)

  const topics = useMemo(() => availableTopics(subject), [subject])

  function handleCustomChange(raw) {
    setCustomCount(raw)
    if (raw === '') { setCustomError(''); return }
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      setCustomError('Enter a whole number from 1 to 100.')
    } else {
      setCustomError('')
    }
  }

  // Shared by "Start round" and "Make a Printable Version" — both need the
  // same validated question count.
  function resolveCount() {
    if (countChoice !== 'custom') return countChoice
    const n = Number(customCount)
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      setCustomError('Enter a whole number from 1 to 100.')
      return null
    }
    return n
  }

  function handleStart() {
    const count = resolveCount()
    if (count == null) return
    onStart({ subject, count, timerOn, topicFilter: topicFilter || null })
  }

  function handlePrint() {
    const count = resolveCount()
    if (count == null) return
    const params = new URLSearchParams({ subject, count: String(count) })
    if (topicFilter) params.set('topic', topicFilter)
    window.open(`/school-prep/print?${params.toString()}`, '_blank')
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>
        School <button type="button" className={styles.secretP} onClick={() => setShowVisits(v => !v)}>P</button>rep
      </h1>
      {showVisits && (
        <p className={styles.visitCount}>
          {globalVisits
            ? `Opens: ${globalVisits.opens} · Unique visitors: ${globalVisits.uniques} (this browser: ${visits ?? 0} opens)`
            : `Opens (this browser): ${visits ?? 0}`}
        </p>
      )}
      <p className={styles.subtitle}>RWA entrance exam practice — Math, English, Français. Nothing is marked right or wrong until you submit the whole round.</p>
      <button type="button" className={styles.infoBtn} onClick={() => infoRef.current?.showModal()}>
        ℹ️ More Info
      </button>

      <dialog
        ref={infoRef}
        className={styles.dialog}
        aria-labelledby="school-prep-info-title"
        onClick={e => { if (e.target === infoRef.current) infoRef.current.close() }}
      >
        <h2 id="school-prep-info-title" className={styles.dialogTitle}>About School Prep</h2>
        <h3 className={styles.dialogHeading}>What it is for</h3>
        <p>
          Practice for a school entrance exam (RWA) in Math, English and Français. Every question is multiple choice,
          and nothing is marked until the whole round is submitted, like a real test.
        </p>
        <h3 className={styles.dialogHeading}>Where the questions come from</h3>
        <p>
          All of the questions were written with AI. It was given practice tests to learn from, including a Grade 5 diagnostic
          test from a teacher and sample tests found online, and it wrote new questions in the same style. Math questions are
          generated fresh every round, so the numbers change. The order of questions is shuffled each time.
        </p>
        <h3 className={styles.dialogHeading}>Your options on each question</h3>
        <ul className={styles.dialogList}>
          <li><strong>Submit answer:</strong> pick an answer, then submit it and move on. You can still change it later from the review screen at the end.</li>
          <li><strong>Let's come back to this to review:</strong> saves your answer but flags the question, so you can look at it again at the end.</li>
          <li><strong>I am unsure, come back at the end:</strong> skips the question without an answer. It comes back after the last question so you can try again.</li>
        </ul>
        <p>Before the round is final there is a review screen where you can open any question and change your answer. Wrong answers are highlighted in red on the results page.</p>
        <h3 className={styles.dialogHeading}>How hard is it?</h3>
        <p>
          The difficulty is a guess based on whatever practice material could be found. It is not known to match the real exam.
          Please treat this as best-effort practice, not a prediction of the real test or a score to worry about.
        </p>
        <div className={styles.dialogActions}>
          <button type="button" className={styles.dialogClose} onClick={() => infoRef.current?.close()}>Close</button>
        </div>
      </dialog>

      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>Subject</h2>
        <div className={styles.subjectRow}>
          {SUBJECTS.map(s => (
            <button
              key={s.id}
              type="button"
              className={`${styles.subjectBtn} ${subject === s.id ? styles.active : ''}`}
              onClick={() => { setSubject(s.id); setTopicFilter('') }}
            >
              <span className={styles.subjectEmoji}>{s.emoji}</span>
              {s.label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>Number of questions</h2>
        <div className={styles.countRow}>
          {COUNT_PRESETS.map(n => (
            <button
              key={n}
              type="button"
              className={`${styles.countBtn} ${countChoice === n ? styles.active : ''}`}
              onClick={() => setCountChoice(n)}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.countBtn} ${countChoice === 'custom' ? styles.active : ''}`}
            onClick={() => setCountChoice('custom')}
          >
            Custom
          </button>
        </div>
        {countChoice === 'custom' && (
          <div className={styles.customRow}>
            <input
              type="number"
              min={1}
              max={100}
              value={customCount}
              onChange={e => handleCustomChange(e.target.value)}
              placeholder="1–100"
              className={styles.customInput}
            />
            {customError && <span className={styles.error}>{customError}</span>}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>Timer</h2>
        <label className={styles.toggleRow}>
          <input type="checkbox" checked={timerOn} onChange={e => setTimerOn(e.target.checked)} />
          {timerOn ? `On — ${(countChoice === 'custom' ? (Number(customCount) || 0) : countChoice)} minute${(countChoice === 'custom' ? Number(customCount) : countChoice) === 1 ? '' : 's'} (1 min per question)` : 'Off'}
        </label>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>Topic filter (optional)</h2>
        <select value={topicFilter} onChange={e => setTopicFilter(e.target.value)} className={styles.select}>
          <option value="">All topics</option>
          {topics.map(t => <option key={t} value={t}>{strandLabel(t)}</option>)}
        </select>
      </section>

      <button type="button" className={styles.startBtn} onClick={handleStart}>
        Start round →
      </button>

      <div className={styles.printRow}>
        <p className={styles.printHint}>Prefer paper? Print this subject and question count as a worksheet with an answer key.</p>
        <button type="button" className={styles.printBtn} onClick={handlePrint}>
          🖨️ Make a Printable Version
        </button>
      </div>

      {historyCount > 0 && (
        <button type="button" className={styles.historyBtn} onClick={onViewHistory}>
          📊 View history ({historyCount} round{historyCount === 1 ? '' : 's'})
        </button>
      )}
    </div>
  )
}
