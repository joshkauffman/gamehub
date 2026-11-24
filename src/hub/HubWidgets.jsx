import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styles from './Hub.module.css'
import { AVATARS } from './profiles.js'
import { averageOf } from './social.js'
import { sfx } from './sound.js'

// ── Shared bits for the home page's newer features: profiles, Surprise Me,
// ratings, game-of-the-week voting, the daily challenge and confetti. Colours come from Home.module.css's theme tokens,
// which these inherit because they're rendered inside .page. ──

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${wide ? styles.modalWide : ''}`} role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2>{title}</h2>
          <button className={styles.x} onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Profiles ──
export function ProfileChip({ profile, onClick }) {
  return (
    <button className={styles.profileChip} onClick={onClick} title="Switch player">
      <span className={styles.profileAvatar}>{profile.avatar}</span>
      <span>{profile.name}</span>
      <span className={styles.caret}>▾</span>
    </button>
  )
}

export function ProfilePicker({ profiles, extraAvatars = [], onPick, onAdd, onEdit, onDelete, onCard, onClose }) {
  const [mode, setMode] = useState(null) // null | 'add' | profile id being edited
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[1])
  const [confirmDel, setConfirmDel] = useState(false)
  const editing = profiles.list.find(p => p.id === mode)

  function startEdit(p) { setMode(p.id); setName(p.name); setAvatar(p.avatar); setConfirmDel(false) }
  function startAdd() { setMode('add'); setName(''); setAvatar(AVATARS[(profiles.list.length * 3 + 1) % AVATARS.length]) }
  function submit(e) {
    e.preventDefault()
    if (mode === 'add') onAdd(name, avatar)
    else onEdit(mode, { name, avatar })
    setMode(null)
  }

  return (
    <Modal title={mode === 'add' ? 'New player' : editing ? `Edit ${editing.name}` : '👋 Who’s playing?'} onClose={onClose}>
      {!mode && (
        <>
          <div className={styles.profileGrid}>
            {profiles.list.map(p => (
              <div key={p.id} className={`${styles.profileCard} ${p.id === profiles.active ? styles.profileOn : ''}`}>
                <button className={styles.profileMain} onClick={() => onPick(p.id)}>
                  <span className={styles.profileBig}>{p.avatar}</span>
                  <span className={styles.profileName}>{p.name}</span>
                </button>
                <button className={styles.profileEdit} onClick={() => startEdit(p)} aria-label={`Edit ${p.name}`}>✏️</button>
                {onCard && <button className={styles.profileCardBtn} onClick={() => onCard(p.id)} aria-label={`${p.name}'s player card`}>🪪</button>}
              </div>
            ))}
            {profiles.list.length < 8 && (
              <button className={`${styles.profileCard} ${styles.profileAdd}`} onClick={startAdd}>
                <span className={styles.profileBig}>➕</span>
                <span className={styles.profileName}>Add player</span>
              </button>
            )}
          </div>
          <p className={styles.small}>Everyone gets their own favorites, stats, theme and daily challenge. (Trophies come from the games’ own saves, so they’re shared.)</p>
        </>
      )}
      {mode && (
        <form onSubmit={submit} className={styles.profileForm}>
          <label className={styles.field}>
            <span>Name</span>
            <input autoFocus value={name} maxLength={16} onChange={e => setName(e.target.value)} placeholder="Type a name" />
          </label>
          <div className={styles.avatarGrid}>
            {[...AVATARS, ...extraAvatars.filter(a => !AVATARS.includes(a))].map(a => (
              <button type="button" key={a} className={`${styles.avatarBtn} ${a === avatar ? styles.avatarOn : ''}`} onClick={() => setAvatar(a)}>{a}</button>
            ))}
          </div>
          <div className={styles.row}>
            <button type="submit" className={styles.primary} disabled={!name.trim()}>{mode === 'add' ? `Add ${avatar} ${name.trim() || '…'}` : 'Save'}</button>
            <button type="button" className={styles.ghost} onClick={() => setMode(null)}>Back</button>
            {editing && profiles.list.length > 1 && (
              confirmDel
                ? <button type="button" className={styles.danger} onClick={() => { onDelete(mode); setMode(null) }}>Really delete {editing.name}?</button>
                : <button type="button" className={styles.ghost} onClick={() => setConfirmDel(true)}>🗑️ Delete</button>
            )}
          </div>
        </form>
      )}
    </Modal>
  )
}

// ── Surprise me: a slot-machine spin through the game emojis ──
export function SurpriseSpin({ games, onClose, onPlay }) {
  const navigate = useNavigate()
  const [spinKey, setSpinKey] = useState(0)
  const [shown, setShown] = useState(() => games[0])
  const [landed, setLanded] = useState(false)
  useEffect(() => {
    setLanded(false)
    const target = games[Math.floor(Math.random() * games.length)]
    let delay = 45, elapsed = 0, timer
    const step = () => {
      elapsed += delay
      if (elapsed > 2200) { setShown(target); setLanded(true); sfx('win'); return }
      setShown(games[Math.floor(Math.random() * games.length)])
      sfx('tick')
      delay *= 1.11
      timer = setTimeout(step, delay)
    }
    timer = setTimeout(step, delay)
    return () => clearTimeout(timer)
  }, [spinKey, games])
  return (
    <Modal title="🎲 Surprise me!" onClose={onClose}>
      <div className={styles.slot}>
        <div className={`${styles.slotWindow} ${landed ? styles.slotLanded : ''}`}>
          <span key={shown.id + landed} className={styles.slotEmoji}>{shown.emoji}</span>
        </div>
        <div className={styles.slotTitle}>{landed ? shown.title : 'Spinning…'}</div>
        {landed && <p className={styles.small}>{shown.description}</p>}
        <div className={styles.row}>
          <button className={styles.primary} disabled={!landed} onClick={() => { onPlay(shown); navigate(shown.path) }}>▶ Play it!</button>
          <button className={styles.ghost} disabled={!landed} onClick={() => setSpinKey(k => k + 1)}>🔄 Spin again</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Ratings ──
export function Stars({ value, onChange, size = 'big' }) {
  const [hover, setHover] = useState(0)
  return (
    <span className={`${styles.stars} ${size === 'big' ? styles.starsBig : ''}`} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          type="button"
          key={n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className={(hover || value) >= n ? styles.starOn : ''}
          onMouseEnter={() => setHover(n)}
          onClick={() => { sfx('click'); onChange(n) }}
        >★</button>
      ))}
    </span>
  )
}

export function RatingDialog({ game, profile, existing, family, profilesById, onSave, onSkip, onClose, afterPlay }) {
  const [stars, setStars] = useState(existing?.stars || 0)
  const [note, setNote] = useState(existing?.note || '')
  const others = Object.entries(family || {}).filter(([pid]) => pid !== profile.id && profilesById[pid])
  return (
    <Modal title={afterPlay ? `How was ${game.emoji} ${game.title}?` : `Rate ${game.emoji} ${game.title}`} onClose={onClose}>
      <div className={styles.rateBox}>
        <div className={styles.rateWho}>{profile.avatar} {profile.name}’s rating</div>
        <Stars value={stars} onChange={setStars} />
        <input className={styles.noteInput} value={note} maxLength={140} onChange={e => setNote(e.target.value)} placeholder="Say something about it (optional)" />
        <div className={styles.row}>
          <button className={styles.primary} disabled={!stars} onClick={() => onSave(stars, note)}>Save ⭐</button>
          {afterPlay ? <button className={styles.ghost} onClick={onSkip}>Not now</button> : <button className={styles.ghost} onClick={onClose}>Cancel</button>}
        </div>
        {others.length > 0 && (
          <div className={styles.others}>
            <div className={styles.small}>What everyone else thinks:</div>
            {others.map(([pid, r]) => (
              <div key={pid} className={styles.otherRow}>
                <span>{profilesById[pid].avatar} {profilesById[pid].name}</span>
                <span className={styles.goldStars}>{'★'.repeat(r.stars)}<span className={styles.dimStars}>{'★'.repeat(5 - r.stars)}</span></span>
                {r.note && <span className={styles.quote}>“{r.note}”</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

export function StarChip({ entry, onClick }) {
  const avg = averageOf(entry)
  const n = Object.keys(entry || {}).length
  return (
    <button
      className={`${styles.starChip} ${n ? styles.starChipOn : ''}`}
      onClick={e => { e.preventDefault(); e.stopPropagation(); onClick() }}
      title={n ? `${avg.toFixed(1)} stars from ${n} player${n > 1 ? 's' : ''} — click to rate` : 'Rate this game'}
      aria-label={n ? `Rated ${avg.toFixed(1)} stars, click to rate` : 'Rate this game'}
    >
      {n ? `★ ${avg % 1 ? avg.toFixed(1) : avg}` : '☆'}
    </button>
  )
}

// ── Game of the week voting ──
export function VoteDialog({ games, votesNext, profile, profilesById, onVote, onClose }) {
  const [q, setQ] = useState('')
  const mine = votesNext?.[profile.id]
  const counts = {}
  for (const [pid, id] of Object.entries(votesNext || {})) (counts[id] ||= []).push(pid)
  const shown = games.filter(g => g.title.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (counts[b.id]?.length || 0) - (counts[a.id]?.length || 0))
  return (
    <Modal title="🗳️ Vote for next week’s game" onClose={onClose} wide>
      <p className={styles.small}>Each player gets one vote. The game with the most votes becomes next week’s Game of the Week. (No votes = a random pick.) Voting as <b>{profile.avatar} {profile.name}</b>.</p>
      <input className={styles.noteInput} value={q} onChange={e => setQ(e.target.value)} placeholder="Find a game…" />
      <div className={styles.voteGrid}>
        {shown.map(g => (
          <button key={g.id} className={`${styles.voteCard} ${mine === g.id ? styles.voteMine : ''}`} onClick={() => { sfx('click'); onVote(mine === g.id ? null : g.id) }}>
            <span className={styles.voteEmoji}>{g.emoji}</span>
            <span className={styles.voteTitle}>{g.title}</span>
            {counts[g.id] && <span className={styles.voters}>{counts[g.id].map(pid => profilesById[pid]?.avatar || '🙂').join('')}</span>}
          </button>
        ))}
      </div>
    </Modal>
  )
}

// ── Daily challenge card ──
export function DailyCard({ today, progress, streak, hint, gameLink, celebrate }) {
  const pct = Math.round((progress.have / progress.need) * 100)
  const done = today.done
  return (
    <div className={`${styles.daily} ${done ? styles.dailyDone : ''} ${celebrate ? styles.dailyPop : ''}`}>
      <span className={styles.dailyIcon}>{done ? '✅' : '🧩'}</span>
      <span className={styles.dailyBody}>
        <span className={styles.dailyLabel}>Today’s challenge</span>
        <span className={styles.dailyText}>{today.ch.text}</span>
        {hint && !done && <span className={styles.dailyHint}>💡 Hint: {hint}</span>}
        {!done && progress.need > 1 && (
          <span className={styles.bar}><span style={{ width: `${pct}%` }} /><em>{today.ch.type === 'time' ? `${Math.floor(progress.have / 60)}/${progress.need / 60} min` : `${progress.have}/${progress.need}`}</em></span>
        )}
        {done && <span className={styles.dailyHint}>Done! Come back tomorrow for a new one.</span>}
      </span>
      <span className={styles.dailyStats}>
        <span>🔥 {streak.current} day{streak.current === 1 ? '' : 's'}</span>
        <span>⭐ {streak.total} done</span>
        {gameLink && !done && <Link to={gameLink.path} className={styles.dailyGo}>Go →</Link>}
      </span>
    </div>
  )
}

// ── Confetti ──
export function Confetti({ burst }) {
  const bits = useMemo(() => Array.from({ length: 60 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    dur: 1.6 + Math.random() * 1.4,
    hue: Math.floor(Math.random() * 360),
    rot: Math.random() * 720 - 360,
    w: 6 + Math.random() * 6,
    key: `${burst}-${i}`,
  })), [burst])
  if (!burst) return null
  return (
    <div className={styles.confetti} aria-hidden="true">
      {bits.map(b => (
        <span key={b.key} style={{ left: `${b.left}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, background: `hsl(${b.hue} 90% 60%)`, width: b.w, height: b.w * 0.5, '--rot': `${b.rot}deg` }} />
      ))}
    </div>
  )
}
