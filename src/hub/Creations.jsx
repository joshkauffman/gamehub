import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './Extras.module.css'
import hub from './Hub.module.css'
import { Modal } from './HubWidgets.jsx'
import { PIECES, currentClue } from './treasureMap.js'
import { IDEA_KINDS, IDEA_LOOKS, IDEA_PLAYERS, HEROES, GOODIES, BADDIES, BACKGROUNDS, SPEEDS } from './creations.js'
import { sfx } from './sound.js'

// ── Photo gallery, treasure map, idea box and the mini-game maker ──

export function PhotoStrip({ photos, catalog, profilesById, onOpen }) {
  return (
    <div className={styles.photoStrip}>
      {photos.map((p, i) => (
        <button key={p.id} className={styles.photo} onClick={() => onOpen(i)} data-fall>
          <img src={p.src} alt={`Photo from ${catalog[p.game]?.title || p.game}`} />
          <span className={styles.photoTag}>{catalog[p.game]?.emoji} {profilesById[p.by]?.avatar || ''}</span>
        </button>
      ))}
    </div>
  )
}

export function PhotoViewer({ photos, index, catalog, profilesById, onDelete, onClose }) {
  const [i, setI] = useState(index)
  const [ask, setAsk] = useState(false)
  const p = photos[Math.min(i, photos.length - 1)]
  if (!p) return null
  const game = catalog[p.game]
  return (
    <Modal title={`📸 ${game ? `${game.emoji} ${game.title}` : 'Photo'}`} onClose={onClose} wide>
      <img className={styles.bigPhoto} src={p.src} alt="" />
      <div className={styles.photoMeta}>
        Taken by {profilesById[p.by] ? `${profilesById[p.by].avatar} ${profilesById[p.by].name}` : 'someone'} · {new Date(p.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
      </div>
      <div className={hub.row}>
        <button className={hub.ghost} disabled={i === 0} onClick={() => { setI(i - 1); setAsk(false) }}>← Newer</button>
        <a className={hub.ghost} href={p.src} download={`gamehub-${p.game}-${p.id}.jpg`}>⬇️ Save</a>
        {ask
          ? <button className={hub.danger} onClick={() => { onDelete(p.id); setAsk(false) }}>Really delete?</button>
          : <button className={hub.ghost} onClick={() => setAsk(true)}>🗑️ Delete</button>}
        <button className={hub.ghost} disabled={i >= photos.length - 1} onClick={() => { setI(i + 1); setAsk(false) }}>Older →</button>
      </div>
    </Modal>
  )
}

// ── Treasure map ── an island in 3×2 torn pieces; missing ones are fogged.
export function MapDialog({ map, onSolve, onClose }) {
  const all = map.found >= PIECES.length
  return (
    <Modal title="🗺️ The Secret Treasure Map" onClose={onClose} wide>
      <div className={styles.mapWrap}>
        <svg viewBox="0 0 300 200" className={styles.mapSvg}>
          <defs>
            <pattern id="waves" width="20" height="10" patternUnits="userSpaceOnUse"><path d="M0 5 Q5 0 10 5 T20 5" fill="none" stroke="#8a6b3a" strokeWidth="0.8" opacity="0.5" /></pattern>
          </defs>
          <rect width="300" height="200" fill="#ecd9a8" />
          <rect width="300" height="200" fill="url(#waves)" />
          <path d="M60 110 C50 60 120 35 170 50 C230 40 265 85 245 125 C235 165 170 175 120 165 C80 160 65 140 60 110 Z" fill="#c9a75f" stroke="#7a5a2a" strokeWidth="2" />
          <path d="M95 115 C100 95 130 85 150 95" fill="none" stroke="#7a5a2a" strokeDasharray="4 4" strokeWidth="2" />
          <path d="M150 95 C175 110 190 95 205 115" fill="none" stroke="#7a5a2a" strokeDasharray="4 4" strokeWidth="2" />
          <text x="78" y="128" fontSize="18">🌴</text>
          <text x="160" y="75" fontSize="16">⛰️</text>
          <text x="120" y="150" fontSize="14">🌴</text>
          <text x="225" y="150" fontSize="13">🦀</text>
          <text x="20" y="40" fontSize="16">🧭</text>
          <text x="250" y="35" fontSize="16">🐙</text>
          <text x="22" y="180" fontSize="15">⛵</text>
          <g className={all ? styles.xMark : ''} onClick={all && !map.solved ? onSolve : undefined} style={{ cursor: all && !map.solved ? 'pointer' : 'default' }}>
            <circle cx="210" cy="122" r="16" fill="transparent" />
            <path d="M201 113 L219 131 M219 113 L201 131" stroke="#b71c1c" strokeWidth="5" strokeLinecap="round" />
          </g>
        </svg>
        <div className={styles.mapFog}>
          {PIECES.map((_, k) => <span key={k} className={k < map.found ? styles.pieceFound : styles.pieceMissing}>{k < map.found ? '' : '?'}</span>)}
        </div>
      </div>
      <div className={styles.mapText}>
        {map.solved ? (
          <>🏴‍☠️ You found the treasure! <Link to="/treasure-dig" className={styles.mapLink}>Play Treasure Dig →</Link></>
        ) : all ? (
          <>All 6 pieces! Now click the big ❌ on the map!</>
        ) : (
          <>
            <b>{map.found}/{PIECES.length} pieces.</b> 💡 {currentClue(map)}
            <span className={styles.mapSmall}>Pieces only peek out for a few seconds once you’ve been playing a while. Keep your eyes open and click it fast!</span>
          </>
        )}
      </div>
    </Modal>
  )
}

// ── Idea box ── big, tappable choices so a kid can fill it in.
function Chips({ options, value, onChange, multi }) {
  return (
    <div className={styles.studioRow}>
      {options.map(o => {
        const on = multi ? value.includes(o) : value === o
        return (
          <button type="button" key={o} className={`${styles.tab} ${on ? styles.tabOn : ''}`}
            onClick={() => { sfx('click'); onChange(multi ? (on ? value.filter(x => x !== o) : [...value, o]) : o) }}>{o}</button>
        )
      })}
    </div>
  )
}

const IDEA_EMOJIS = ['🎮', '🐉', '🦖', '🚀', '👻', '🏰', '⚔️', '🐱', '🦈', '🤖', '🧙', '🏎️', '🌋', '🍕', '🦄', '🧟', '🐸', '🪐', '💎', '⚽']

export function IdeaBox({ profile, onSave, onClose }) {
  const [idea, setIdea] = useState({ name: '', emoji: '🎮', kinds: [], looks: [], players: IDEA_PLAYERS[0], hero: '', win: '', extra: '' })
  const set = (k) => (v) => setIdea(i => ({ ...i, [k]: v }))
  const ok = idea.name.trim() && (idea.kinds.length || idea.hero.trim() || idea.win.trim())
  return (
    <Modal title="💡 Game Idea Box" onClose={onClose} wide>
      <p className={hub.small} style={{ marginTop: 0 }}>Got an idea for a new game? Put it here and it goes on the <b>Coming Soon</b> shelf. Idea by <b>{profile.avatar} {profile.name}</b>.</p>
      <div className={styles.ideaForm}>
        <label className={hub.field}><span>What’s it called?</span>
          <input autoFocus value={idea.name} maxLength={40} onChange={e => set('name')(e.target.value)} placeholder="Super Dino Space Battle" />
        </label>
        <div className={styles.studioLabel}>Pick a picture for it</div>
        <div className={styles.studioRow}>
          {IDEA_EMOJIS.map(e => <button type="button" key={e} className={`${styles.emojiPick} ${idea.emoji === e ? styles.tabOn : ''}`} onClick={() => set('emoji')(e)}>{e}</button>)}
        </div>
        <div className={styles.studioLabel}>What do you do in it? (pick lots!)</div>
        <Chips options={IDEA_KINDS} value={idea.kinds} onChange={set('kinds')} multi />
        <div className={styles.studioLabel}>What does it look like?</div>
        <Chips options={IDEA_LOOKS} value={idea.looks} onChange={set('looks')} multi />
        <div className={styles.studioLabel}>How many players?</div>
        <Chips options={IDEA_PLAYERS} value={idea.players} onChange={set('players')} />
        <label className={hub.field}><span>Who are the characters?</span>
          <input value={idea.hero} maxLength={120} onChange={e => set('hero')(e.target.value)} placeholder="A dinosaur with a jetpack and his robot friend" />
        </label>
        <label className={hub.field}><span>How do you win?</span>
          <input value={idea.win} maxLength={120} onChange={e => set('win')(e.target.value)} placeholder="Beat the giant space octopus" />
        </label>
        <label className={hub.field}><span>Anything else?</span>
          <input value={idea.extra} maxLength={160} onChange={e => set('extra')(e.target.value)} placeholder="There's a secret level made of candy" />
        </label>
      </div>
      <div className={hub.row}>
        <button className={hub.primary} disabled={!ok} onClick={() => onSave({ ...idea, name: idea.name.trim(), id: Date.now().toString(36), by: profile.id, at: Date.now(), likes: [] })}>💡 Put it in the box</button>
        <button className={hub.ghost} onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  )
}

export function IdeaCard({ idea, profilesById, myId, onLike, onDelete }) {
  const [ask, setAsk] = useState(false)
  const by = profilesById[idea.by]
  const liked = idea.likes?.includes(myId)
  return (
    <div className={styles.idea} data-fall>
      <span className={styles.ideaStamp}>COMING SOON?</span>
      <span className={styles.ideaEmoji}>{idea.emoji}</span>
      <b className={styles.ideaName}>{idea.name}</b>
      <span className={styles.ideaBy}>idea by {by ? `${by.avatar} ${by.name}` : 'someone'}</span>
      {(idea.kinds.length > 0 || idea.looks.length > 0) && <span className={styles.ideaTags}>{[...idea.kinds, ...idea.looks, idea.players].join(' · ')}</span>}
      {idea.hero && <span className={styles.ideaLine}>🦸 {idea.hero}</span>}
      {idea.win && <span className={styles.ideaLine}>🏁 {idea.win}</span>}
      {idea.extra && <span className={styles.ideaLine}>✨ {idea.extra}</span>}
      <span className={styles.ideaFoot}>
        <button className={`${styles.like} ${liked ? styles.likeOn : ''}`} onClick={() => onLike(idea.id)}>👍 {idea.likes?.length || 0}</button>
        {ask
          ? <button className={hub.danger} style={{ padding: '0.25rem 0.7rem', fontSize: '0.75rem' }} onClick={() => onDelete(idea.id)}>Delete it?</button>
          : <button className={styles.trash} onClick={() => setAsk(true)} aria-label="Delete idea">🗑️</button>}
      </span>
    </div>
  )
}

// ── Mini-game maker ──
export const NEW_MINI = { name: '', hero: '🐸', good: ['🍕'], bad: ['💣'], bg: 'space', speed: 'medium', mode: 'fall', goal: { type: 'score', n: 20 } }

export function MakerDialog({ initial, profile, onSave, onTry, onClose }) {
  const [g, setG] = useState(initial)
  const set = (k, v) => setG(x => ({ ...x, [k]: v }))
  const toggle = (k, e) => setG(x => {
    const list = x[k].includes(e) ? x[k].filter(y => y !== e) : [...x[k], e].slice(-4)
    return { ...x, [k]: k === 'good' && !list.length ? x[k] : list }
  })
  const finished = { ...g, name: g.name.trim() || `${profile.name}’s Game` }
  return (
    <Modal title="🛠️ Mini-Game Maker" onClose={onClose} wide>
      <div className={styles.makerPreview} style={{ background: BACKGROUNDS[g.bg].css }}>
        <span className={styles.makerThings}>{g.good.join(' ')}</span>
        {g.bad.length > 0 && <span className={styles.makerBad}>{g.bad.join(' ')}</span>}
        <span className={`${styles.makerHero} ${g.mode === 'fly' ? styles.makerHeroFly : ''}`}>{g.hero}</span>
      </div>
      <div className={styles.ideaForm}>
        <label className={hub.field}><span>Name your game</span>
          <input value={g.name} maxLength={30} onChange={e => set('name', e.target.value)} placeholder={`${profile.name}’s Game`} />
        </label>
        <div className={styles.studioLabel}>1. Pick your hero</div>
        <div className={styles.studioRow}>{HEROES.map(e => <button key={e} className={`${styles.emojiPick} ${g.hero === e ? styles.tabOn : ''}`} onClick={() => set('hero', e)}>{e}</button>)}</div>
        <div className={styles.studioLabel}>2. What do you catch? (up to 4)</div>
        <div className={styles.studioRow}>{GOODIES.map(e => <button key={e} className={`${styles.emojiPick} ${g.good.includes(e) ? styles.tabOn : ''}`} onClick={() => toggle('good', e)}>{e}</button>)}</div>
        <div className={styles.studioLabel}>3. What do you dodge? (up to 4, or none)</div>
        <div className={styles.studioRow}>{BADDIES.map(e => <button key={e} className={`${styles.emojiPick} ${g.bad.includes(e) ? styles.tabOn : ''}`} onClick={() => toggle('bad', e)}>{e}</button>)}</div>
        <div className={styles.studioLabel}>4. Where is it?</div>
        <div className={styles.studioRow}>{Object.entries(BACKGROUNDS).map(([id, b]) => <button key={id} className={`${styles.tab} ${g.bg === id ? styles.tabOn : ''}`} onClick={() => set('bg', id)}>{b.name}</button>)}</div>
        <div className={styles.studioLabel}>5. Which way do things come?</div>
        <div className={styles.studioRow}>
          <button className={`${styles.tab} ${g.mode === 'fall' ? styles.tabOn : ''}`} onClick={() => set('mode', 'fall')}>⬇️ Falling from the sky</button>
          <button className={`${styles.tab} ${g.mode === 'fly' ? styles.tabOn : ''}`} onClick={() => set('mode', 'fly')}>⬅️ Flying at you</button>
        </div>
        <div className={styles.studioLabel}>6. How fast?</div>
        <div className={styles.studioRow}>{Object.entries(SPEEDS).map(([id, s]) => <button key={id} className={`${styles.tab} ${g.speed === id ? styles.tabOn : ''}`} onClick={() => set('speed', id)}>{s.name}</button>)}</div>
        <div className={styles.studioLabel}>7. How do you win?</div>
        <div className={styles.studioRow}>
          {[10, 20, 50].map(n => <button key={n} className={`${styles.tab} ${g.goal.type === 'score' && g.goal.n === n ? styles.tabOn : ''}`} onClick={() => set('goal', { type: 'score', n })}>Catch {n}</button>)}
          {[30, 60].map(n => <button key={n} className={`${styles.tab} ${g.goal.type === 'survive' && g.goal.n === n ? styles.tabOn : ''}`} onClick={() => set('goal', { type: 'survive', n })}>Survive {n}s</button>)}
          <button className={`${styles.tab} ${g.goal.type === 'endless' ? styles.tabOn : ''}`} onClick={() => set('goal', { type: 'endless' })}>♾️ Forever (high score)</button>
        </div>
      </div>
      <div className={hub.row}>
        <button className={hub.ghost} onClick={() => onTry(finished)}>▶ Try it</button>
        <button className={hub.primary} onClick={() => onSave({ ...finished, id: g.id || Date.now().toString(36), by: g.by || profile.id, at: g.at || Date.now() })}>💾 Save my game</button>
      </div>
    </Modal>
  )
}

export function MiniGameCard({ game, profilesById, myId, onPlay, onEdit, onDelete }) {
  const [ask, setAsk] = useState(false)
  const by = profilesById[game.by]
  const best = Math.max(0, ...Object.values(game.best || {}))
  return (
    <div className={styles.mini} style={{ background: BACKGROUNDS[game.bg]?.css }} data-fall>
      <button className={styles.miniPlay} onClick={() => onPlay(game)}>
        <span className={styles.miniHero}>{game.hero}</span>
        <span className={`${styles.miniTitle} ${BACKGROUNDS[game.bg]?.dark ? '' : styles.miniDarkText}`}>{game.name}</span>
        <span className={`${styles.miniInfo} ${BACKGROUNDS[game.bg]?.dark ? '' : styles.miniDarkText}`}>
          {game.good.join('')} {game.bad.length ? `vs ${game.bad.join('')}` : ''} · by {by?.avatar || '🙂'}{best ? ` · best ${best}` : ''}
        </span>
      </button>
      <span className={styles.miniTools}>
        {game.by === myId && <button onClick={() => onEdit(game)} aria-label="Edit">✏️</button>}
        {ask ? <button onClick={() => onDelete(game.id)}>Delete?</button> : <button onClick={() => setAsk(true)} aria-label="Delete">🗑️</button>}
      </span>
    </div>
  )
}
