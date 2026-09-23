import { useMemo } from 'react'
import styles from './Insights.module.css'
import mathBank from '../data/math.json'
import { loadMastery } from '../engine/storage.js'
import { topicLabel } from '../engine/labels.js'

const HARDEST_COUNT = 10

function groupBy(entries, keyFn) {
  const groups = {}
  for (const e of entries) {
    const key = keyFn(e)
    groups[key] ??= { key, timesShown: 0, timesCorrect: 0, timesWrong: 0, timesIdk: 0 }
    groups[key].timesShown += e.timesShown
    groups[key].timesCorrect += e.timesCorrect
    groups[key].timesWrong += e.timesWrong
    groups[key].timesIdk += e.timesIdk
  }
  return Object.values(groups).sort((a, b) => (a.timesCorrect / a.timesShown) - (b.timesCorrect / b.timesShown))
}

export default function Insights({ onBack, backLabel = '← Back to setup' }) {
  const { entries, byGrade, byTopic, hardest } = useMemo(() => {
    const mastery = loadMastery()
    const entries = Object.entries(mastery).map(([id, m]) => ({ id, ...m }))
    const byGrade = groupBy(entries, e => e.grade)
    const byTopic = groupBy(entries, e => e.topic)
    const hardest = [...entries]
      .filter(e => e.timesShown > 0)
      .sort((a, b) => (b.timesWrong + b.timesIdk) - (a.timesWrong + a.timesIdk))
      .slice(0, HARDEST_COUNT)
      .map(e => ({ ...e, prompt: mathBank.questions.find(q => q.id === e.id)?.prompt || '(question no longer in the bank)' }))
    return { entries, byGrade, byTopic, hardest }
  }, [])

  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>Insights</h2>
      <p className={styles.subtitle}>
        Cumulative stats across every round ever played on this device — this is what to check before pruning or retuning the question bank.
      </p>

      {entries.length === 0 ? (
        <p className={styles.empty}>No data yet — play a round first.</p>
      ) : (
        <>
          <section className={styles.section}>
            <h3 className={styles.sectionLabel}>By grade level</h3>
            <p className={styles.hint}>Sorted weakest first.</p>
            <div className={styles.groupList}>
              {byGrade.map(g => (
                <div key={g.key} className={`${styles.groupRow} ${g.timesCorrect / g.timesShown < 0.5 ? styles.weak : ''}`}>
                  <span className={styles.groupName}>Grade {g.key}</span>
                  <span className={styles.groupStats}>
                    {g.timesCorrect}/{g.timesShown} correct · {g.timesWrong} wrong · {g.timesIdk} no idea
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionLabel}>By topic</h3>
            <p className={styles.hint}>Sorted weakest first.</p>
            <div className={styles.groupList}>
              {byTopic.map(t => (
                <div key={t.key} className={`${styles.groupRow} ${t.timesCorrect / t.timesShown < 0.5 ? styles.weak : ''}`}>
                  <span className={styles.groupName}>{topicLabel(t.key)}</span>
                  <span className={styles.groupStats}>
                    {t.timesCorrect}/{t.timesShown} correct · {t.timesWrong} wrong · {t.timesIdk} no idea
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionLabel}>Hardest individual questions</h3>
            <p className={styles.hint}>The questions he's missed or shrugged at the most — good candidates to weed out or revisit.</p>
            <div className={styles.questionList}>
              {hardest.map(q => (
                <div key={q.id} className={styles.questionRow}>
                  <p className={styles.questionPrompt}>
                    <span className={styles.questionGrade}>Grade {q.grade}</span>
                    {q.prompt}
                  </p>
                  <p className={styles.questionStats}>
                    Seen {q.timesShown}× · {q.timesCorrect} correct · {q.timesWrong} wrong · {q.timesIdk} no idea
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <button type="button" className={styles.backBtn} onClick={onBack}>{backLabel}</button>
    </div>
  )
}
