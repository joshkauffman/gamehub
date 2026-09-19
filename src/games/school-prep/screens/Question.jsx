import { useEffect, useState } from 'react'
import styles from './Question.module.css'
import ChoiceList from '../components/ChoiceList.jsx'
import PassagePanel from '../components/PassagePanel.jsx'

const KEY_TO_INDEX = { a: 0, b: 1, c: 2, d: 3 }

export default function Question({ question, passage, index, total, initialSelected, reviewMode, onSure, onFlag, onUnsure, onSaveEdit }) {
  const [selected, setSelected] = useState(initialSelected ?? null)

  useEffect(() => {
    setSelected(initialSelected ?? null)
  }, [question.id, initialSelected])

  useEffect(() => {
    function handleKey(e) {
      const key = e.key.toLowerCase()
      if (KEY_TO_INDEX[key] != null) {
        setSelected(KEY_TO_INDEX[key])
      } else if (e.key === 'Enter' && selected != null) {
        // Prevent the browser's own "Enter activates the focused button"
        // behaviour from double-firing alongside this handler — React can
        // reuse the same DOM button across question re-renders, leaving an
        // old button focused and pointed at the new question.
        e.preventDefault()
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        reviewMode ? onSaveEdit(selected) : onSure(selected)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selected, reviewMode, onSure, onSaveEdit])

  const body = (
    <div>
      <h2 className={styles.prompt}>{question.prompt}</h2>
      <ChoiceList choices={question.choices} selected={selected} onSelect={setSelected} />
    </div>
  )

  return (
    <div className={styles.wrap}>
      <p className={styles.counter}>Question {index + 1} of {total}</p>

      {passage ? (
        <div className={styles.withPassage}>
          <PassagePanel passage={passage} />
          {body}
        </div>
      ) : body}

      {reviewMode ? (
        <div className={styles.actions}>
          <button type="button" className={styles.primaryBtn} disabled={selected == null} onClick={e => { e.currentTarget.blur(); onSaveEdit(selected) }}>
            Save answer
          </button>
        </div>
      ) : (
        <div className={styles.actions}>
          <button type="button" className={styles.primaryBtn} disabled={selected == null} onClick={e => { e.currentTarget.blur(); onSure(selected) }}>
            I am sure of this
          </button>
          <button type="button" className={styles.secondaryBtn} disabled={selected == null} onClick={e => { e.currentTarget.blur(); onFlag(selected) }}>
            Let's come back to this to review
          </button>
          <button type="button" className={styles.ghostBtn} onClick={e => { e.currentTarget.blur(); onUnsure(selected) }}>
            I am unsure, come back at the end
          </button>
        </div>
      )}

      <p className={styles.hint}>Keyboard: A–D to pick, Enter to confirm.</p>
    </div>
  )
}
