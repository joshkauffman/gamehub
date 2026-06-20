import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import styles from './DiceRoller.module.css'
import DieSvg from './DieSvg.jsx'

const COMMON_SIDES = [4, 6, 8, 10, 12, 20, 100]

const PRESETS = [
  { label: '2d6', groups: [{ count: 2, sides: 6 }] },
  { label: '1d20', groups: [{ count: 1, sides: 20 }] },
  { label: 'Custom', groups: null },
]

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1
}

function newGroup() {
  return { id: Date.now() + Math.random(), count: 1, sides: 6 }
}

export default function DiceRoller() {
  const [mode, setMode] = useState('2d6')
  const [customGroups, setCustomGroups] = useState([newGroup()])
  const [results, setResults] = useState(null)
  const [rolling, setRolling] = useState(false)

  function getActiveGroups() {
    if (mode === 'Custom') return customGroups
    return PRESETS.find(p => p.label === mode)?.groups ?? []
  }

  function handlePreset(label) {
    setMode(label)
    setResults(null)
  }

  function updateGroup(id, field, raw) {
    const value = Math.max(1, parseInt(raw) || 1)
    setCustomGroups(gs => gs.map(g => g.id === id ? { ...g, [field]: value } : g))
  }

  function addGroup() {
    setCustomGroups(gs => [...gs, newGroup()])
  }

  function removeGroup(id) {
    setCustomGroups(gs => gs.length > 1 ? gs.filter(g => g.id !== id) : gs)
  }

  const handleRoll = useCallback(() => {
    setRolling(true)
    setResults(null)
    setTimeout(() => {
      const groups = getActiveGroups()
      const rolled = groups.map(g => ({
        sides: g.sides,
        count: g.count,
        rolls: Array.from({ length: Math.min(g.count, 20) }, () => rollDie(g.sides)),
      }))
      setResults(rolled)
      setRolling(false)
    }, 120)
  }, [mode, customGroups])

  const total = results ? results.flatMap(g => g.rolls).reduce((s, v) => s + v, 0) : null
  const breakdown = results
    ? results.map(g => `${g.count}d${g.sides}: ${g.rolls.join('+')}`).join('  |  ')
    : null

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link to="/" className={styles.backBtn}>← Home</Link>
      </div>

      <h1 className={styles.title}>Dice Roller</h1>
      <p className={styles.subtitle}>Roll for it.</p>

      <div className={styles.presets}>
        {PRESETS.map(p => (
          <button
            key={p.label}
            className={`${styles.presetBtn}${mode === p.label ? ' ' + styles.active : ''}`}
            onClick={() => handlePreset(p.label)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {mode === 'Custom' && (
        <div className={styles.customPanel}>
          <div className={styles.customTitle}>Configure Roll</div>
          <div className={styles.diceRows}>
            {customGroups.map((g, i) => (
              <div key={g.id} className={styles.diceRow}>
                {i > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>+</span>}
                <input
                  type="number"
                  className={styles.numInput}
                  value={g.count}
                  min={1}
                  max={20}
                  onChange={e => updateGroup(g.id, 'count', e.target.value)}
                />
                <span className={styles.diceLabel}>d</span>
                <select
                  className={styles.sidesSelect}
                  value={g.sides}
                  onChange={e => updateGroup(g.id, 'sides', e.target.value)}
                >
                  {COMMON_SIDES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {customGroups.length > 1 && (
                  <button className={styles.removeBtn} onClick={() => removeGroup(g.id)}>✕</button>
                )}
              </div>
            ))}
          </div>
          <button className={styles.addBtn} onClick={addGroup}>+ Add another die type</button>
        </div>
      )}

      <button className={styles.rollBtn} onClick={handleRoll}>
        {rolling ? 'Rolling…' : `Roll ${mode === 'Custom' ? customGroups.map(g => `${g.count}d${g.sides}`).join(' + ') : mode}`}
      </button>

      {results && (
        <>
          <div className={styles.results}>
            {results.map((group, gi) => (
              <div key={gi} className={styles.resultGroup}>
                <div className={styles.groupLabel}>{group.count}d{group.sides}</div>
                <div className={styles.diceGrid}>
                  {group.rolls.map((val, i) => (
                    <div key={i} className={styles.dieWrap}>
                      <DieSvg sides={group.sides} value={val} rolling={!rolling} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.totalBar}>
            <span className={styles.totalLabel}>Total</span>
            <div style={{ textAlign: 'right' }}>
              <div className={styles.totalValue}>{total}</div>
              {results.length > 1 || results[0]?.rolls.length > 1 ? (
                <div className={styles.totalBreakdown}>{breakdown}</div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
