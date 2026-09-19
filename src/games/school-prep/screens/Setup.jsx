import { useState, useMemo } from 'react'
import styles from './Setup.module.css'
import { availableTopics } from '../engine/roundBuilder.js'
import { strandLabel } from '../engine/labels.js'

const SUBJECTS = [
  { id: 'math', label: 'Math', emoji: '➗' },
  { id: 'english', label: 'English', emoji: '📖' },
  { id: 'french', label: 'Français', emoji: '🇫🇷' },
]

const COUNT_PRESETS = [15, 25, 45]

export default function Setup({ onStart, historyCount, onViewHistory }) {
  const [subject, setSubject] = useState('math')
  const [countChoice, setCountChoice] = useState(15)
  const [customCount, setCustomCount] = useState('')
  const [customError, setCustomError] = useState('')
  const [timerOn, setTimerOn] = useState(true)
  const [topicFilter, setTopicFilter] = useState('')

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
      <h1 className={styles.title}>School Prep</h1>
      <p className={styles.subtitle}>RWA entrance exam practice — Math, English, Français. Nothing is marked right or wrong until you submit the whole round.</p>

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
