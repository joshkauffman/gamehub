import { useEffect, useRef, useState } from 'react'
import styles from './ShipCaptainCrew.module.css'

// Every screen is laid out in the concept art's own pixel grid, then the whole
// board is scaled to the viewport as one piece. Nothing reflows, so the painting
// and the live controls can never drift apart.
export default function Stage({ width, height, plate, children }) {
  const wrapRef = useRef(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const fit = () => {
      const { width: w, height: h } = el.getBoundingClientRect()
      setScale(Math.min(w / width, h / height))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width, height])

  return (
    <div className={styles.viewport} ref={wrapRef}>
      <div
        className={styles.stage}
        style={{ width, height, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        <img src={plate} alt="" className={styles.plate} draggable="false" />
        {children}
      </div>
    </div>
  )
}

export function Hit({ x, y, w, h, onClick, label, disabled, className }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={[styles.hit, className].filter(Boolean).join(' ')}
      style={{ left: x, top: y, width: w, height: h }}
    />
  )
}
