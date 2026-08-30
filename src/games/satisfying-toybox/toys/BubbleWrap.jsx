import { useCallback, useRef, useState } from 'react'
import styles from '../SatisfyingToybox.module.css'
import { playPop } from '../sound.js'

const COLS = 10
const ROWS = 8
const TOTAL = COLS * ROWS

function freshSheet() { return new Array(TOTAL).fill(false) }

export default function BubbleWrap() {
  const [popped, setPopped] = useState(freshSheet)
  const draggingRef = useRef(false)

  const pop = useCallback(i => {
    setPopped(prev => {
      if (prev[i]) return prev
      const next = prev.slice()
      next[i] = true
      return next
    })
    playPop(420 + Math.random() * 180, 0.08)
  }, [])

  const poppedCount = popped.reduce((n, v) => n + (v ? 1 : 0), 0)
  const done = poppedCount === TOTAL

  return (
    <div className={styles.toyPanel}>
      <div className={styles.toyToolbar}>
        <span className={styles.toyStat}>{poppedCount} / {TOTAL} popped</span>
        <button className={styles.toyBtn} onClick={() => setPopped(freshSheet())}>New Sheet</button>
      </div>
      <div
        className={styles.bubbleGrid}
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
        onPointerDown={() => { draggingRef.current = true }}
        onPointerUp={() => { draggingRef.current = false }}
        onPointerLeave={() => { draggingRef.current = false }}
      >
        {popped.map((isPopped, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.bubble} ${isPopped ? styles.bubblePopped : ''}`}
            onPointerDown={() => pop(i)}
            onPointerEnter={() => { if (draggingRef.current) pop(i) }}
            aria-label={isPopped ? 'popped bubble' : 'bubble'}
          />
        ))}
      </div>
      {done && <p className={styles.toyMsg}>🎉 All popped! Hit "New Sheet" for more.</p>}
    </div>
  )
}
