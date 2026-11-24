import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './Extras.module.css'
import hub from './Hub.module.css'
import { Modal } from './HubWidgets.jsx'
import { SHOP } from './coins.js'
import { BADGES } from './badges.js'
import { PRESETS, FLOATER_CHOICES, PATTERNS } from './themes.js'
import { SPECIES, STAGE_NAMES, TREAT_PRICE, MAX_TREATS, PET_LINES } from './pet.js'
import { sfx } from './sound.js'

// ── Shop, badges, player cards, theme studio, special days, the ghost and
// the pet. Rendered inside Home's .page, so theme tokens apply. ──

// Emojis drifting across the backdrop (themes, seasons, birthdays).
export function Floaters({ items, mode = 'fly', count = 7 }) {
  const list = useMemo(() => Array.from({ length: count }, (_, k) => ({
    e: items[k % items.length],
    pos: 4 + ((k * 37) % 92),
    delay: -((k * 5.3) % 17),
    dur: (mode === 'fly' ? 17 : 11) + ((k * 7) % 9),
    size: 1.1 + ((k * 3) % 5) * 0.2,
  })), [items, mode, count])
  return (
    <span className={styles.floaters} aria-hidden="true">
      {list.map((f, k) => (
        <span
          key={k}
          className={`${styles.floater} ${styles['float_' + mode]}`}
          style={mode === 'fly'
            ? { top: `${f.pos}%`, animationDelay: `${f.delay}s`, animationDuration: `${f.dur}s`, fontSize: `${f.size}rem` }
            : { left: `${f.pos}%`, animationDelay: `${f.delay}s`, animationDuration: `${f.dur}s`, fontSize: `${f.size}rem` }}
        >{f.e}</span>
      ))}
    </span>
  )
}

export function SeasonBanner({ text, birthday }) {
  return <div className={`${styles.season} ${birthday ? styles.seasonBday : ''}`}>{text}</div>
}

// ── The hub ghost ──
// Every so often he peeks out from behind a game card on screen. Click him
// for a joke, a hint, or a coin (getMessage decides; it returns a string).
export function Ghost({ getMessage, often }) {
  const [spot, setSpot] = useState(null) // { x, y, side }
  const [msg, setMsg] = useState(null)
  const timers = useRef([])
  useEffect(() => {
    const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
    const peek = () => {
      // Any tile on screen (game cards, trophies, favorites…) but not the wide banners.
      const cards = [...document.querySelectorAll('[data-fall]')].filter(el => {
        const r = el.getBoundingClientRect()
        return r.top > 130 && r.bottom < innerHeight - 20 && r.width > 0 && r.width < 420
      })
      if (!cards.length || document.hidden) { later(peek, 8000); return }
      const r = cards[Math.floor(Math.random() * cards.length)].getBoundingClientRect()
      const side = Math.random() < 0.5 ? 'left' : 'right'
      setSpot({ x: side === 'left' ? r.left : r.right, y: r.top + r.height * (0.25 + Math.random() * 0.4), side })
      later(() => setSpot(s => (s && !s.talking ? null : s)), 8000)
      later(peek, (often ? 25000 : 45000) + Math.random() * 35000)
    }
    later(peek, often ? 6000 : 12000)
    const hideOnScroll = () => setSpot(s => (s && !s.talking ? null : s))
    window.addEventListener('scroll', hideOnScroll, { passive: true })
    return () => { timers.current.forEach(clearTimeout); window.removeEventListener('scroll', hideOnScroll) }
  }, [often])
  function click() {
    sfx('secret')
    setMsg(getMessage())
    setSpot(s => ({ ...s, talking: true }))
    timers.current.push(setTimeout(() => { setMsg(null); setSpot(null) }, 7000))
  }
  if (!spot) return null
  return (
    <div className={`${styles.ghostWrap} ${styles['ghost_' + spot.side]}`} style={{ left: spot.x, top: spot.y }}>
      <button className={styles.ghost} onClick={click} aria-label="A friendly ghost! Click him">👻</button>
      {msg && <div className={styles.ghostSays}>{msg}</div>}
    </div>
  )
}

// ── Coins chip + Hub Shop ──
export function CoinChip({ balance, onClick, bump }) {
  return (
    <button className={`${styles.coinChip} ${bump ? styles.coinBump : ''}`} onClick={onClick} title="Hub coins — click for the shop">
      🪙 <b>{balance}</b>
    </button>
  )
}

const SHOP_TABS = [
  { id: 'frame', label: '🖼️ Card frames' },
  { id: 'theme', label: '🎨 Themes' },
  { id: 'avatar', label: '🦊 Avatars' },
  { id: 'hat', label: '🎩 Pet stuff' },
]
export function ShopDialog({ wallet, onBuy, onEquip, onUseTheme, onClose }) {
  const [tab, setTab] = useState('frame')
  const [ask, setAsk] = useState(null)
  const items = SHOP.filter(i => i.kind === tab)
  return (
    <Modal title="🛍️ Hub Shop" onClose={onClose} wide>
      <div className={styles.shopTop}>
        <span className={styles.wallet}>🪙 {wallet.balance} coins</span>
        <span className={hub.small} style={{ margin: 0 }}>Earn coins from daily challenges, secrets, badges, trophies, ratings… and the ghost. 👻</span>
      </div>
      <div className={styles.tabs}>
        {SHOP_TABS.map(t => <button key={t.id} className={`${styles.tab} ${tab === t.id ? styles.tabOn : ''}`} onClick={() => { sfx('click'); setTab(t.id) }}>{t.label}</button>)}
      </div>
      <div className={styles.shopGrid}>
        {items.map(item => {
          const owned = wallet.owned.includes(item.id)
          const on = (item.kind === 'frame' && wallet.frame === item.id) || (item.kind === 'hat' && wallet.petHat === item.id)
          return (
            <div key={item.id} className={`${styles.shopItem} ${owned ? styles.owned : ''}`}>
              <span className={`${styles.shopIcon} ${item.kind === 'frame' ? styles['frameDemo_' + item.id.split(':')[1]] : ''}`}>{item.icon}</span>
              <b>{item.name}</b>
              {item.desc && <span className={styles.shopDesc}>{item.desc}</span>}
              {!owned && (ask === item.id
                ? <span className={hub.row} style={{ marginTop: 0 }}>
                    <button className={hub.primary} onClick={() => { onBuy(item); setAsk(null) }}>Buy!</button>
                    <button className={hub.ghost} onClick={() => setAsk(null)}>No</button>
                  </span>
                : <button className={hub.primary} disabled={wallet.balance < item.price} onClick={() => { sfx('click'); setAsk(item.id) }}>🪙 {item.price}</button>)}
              {owned && item.kind === 'frame' && <button className={on ? hub.primary : hub.ghost} onClick={() => onEquip('frame', item.id)}>{on ? '✓ Using' : 'Use'}</button>}
              {owned && item.kind === 'hat' && <button className={on ? hub.primary : hub.ghost} onClick={() => onEquip('petHat', item.id)}>{on ? '✓ Wearing' : 'Wear'}</button>}
              {owned && item.kind === 'theme' && <button className={hub.ghost} onClick={() => onUseTheme(item.id.split(':')[1])}>Use it</button>}
              {owned && item.kind === 'avatar' && <span className={styles.shopDesc}>✓ Yours! Pick it in “Edit player”.</span>}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

// ── Badge book ──
export function BadgeBook({ earned, onClose }) {
  const got = BADGES.filter(b => earned[b.id]).length
  return (
    <Modal title={`🏅 Badge Book · ${got}/${BADGES.length}`} onClose={onClose} wide>
      <div className={styles.badgeGrid}>
        {BADGES.map(b => {
          const on = !!earned[b.id]
          return (
            <div key={b.id} className={`${styles.badge} ${on ? styles.badgeOn : ''}`} title={on ? `Earned ${new Date(earned[b.id]).toLocaleDateString()}` : 'Not yet!'}>
              <span className={styles.badgeIcon}>{b.icon}</span>
              <b>{on ? b.name : '???'}</b>
              <span className={styles.badgeHow}>{b.how}</span>
            </div>
          )
        })}
      </div>
      <p className={hub.small}>Every new badge is worth 🪙 10.</p>
    </Modal>
  )
}

// ── Player card ──
export function PlayerCard({ profile, isMe, wallet, badges, stats, favorite, topTrophies, pet, onSave, onSwitch, onClose }) {
  const [editing, setEditing] = useState(false)
  const [about, setAbout] = useState(profile.about || '')
  const [birthday, setBirthday] = useState(profile.birthday || '')
  const myBadges = BADGES.filter(b => badges[b.id])
  return (
    <Modal title={`${profile.avatar} ${profile.name}`} onClose={onClose} wide>
      <div className={`${styles.card} ${wallet.frame ? styles['frame_' + wallet.frame.split(':')[1]] : ''}`}>
        <div className={styles.cardLeft}>
          <span className={styles.cardAvatar}>{profile.avatar}</span>
          <span className={styles.cardName}>{profile.name}</span>
          {pet && <span className={styles.cardPet}>{pet.emoji} {pet.name} · lvl {pet.level}</span>}
          <span className={styles.wallet}>🪙 {wallet.balance}</span>
        </div>
        <div className={styles.cardRight}>
          {!editing && (
            <>
              <p className={styles.about}>{profile.about ? `“${profile.about}”` : isMe ? 'Tell everyone about yourself! (Edit below)' : 'No “about me” yet.'}</p>
              {profile.birthday && <div className={styles.cardLine}>🎂 Birthday: {new Date(`2000-${profile.birthday}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</div>}
              <div className={styles.cardLine}>🎮 {stats.plays} games played · 🧭 {stats.tried} tried · ⏱️ {stats.time}</div>
              {favorite && <div className={styles.cardLine}>❤️ Most played: {favorite.emoji} {favorite.title}</div>}
              {topTrophies.length > 0 && <div className={styles.cardLine}>🏆 {topTrophies.map(t => `${{ gold: '🥇', silver: '🥈', bronze: '🥉' }[t.medal]} ${t.game.emoji}`).join('  ')}</div>}
              <div className={styles.cardBadges}>
                {myBadges.length ? myBadges.map(b => <span key={b.id} title={b.name}>{b.icon}</span>) : <span className={hub.small} style={{ margin: 0 }}>No badges yet</span>}
              </div>
            </>
          )}
          {editing && (
            <div className={hub.profileForm}>
              <label className={hub.field}><span>About me</span>
                <input value={about} maxLength={80} onChange={e => setAbout(e.target.value)} placeholder="I like dinosaurs and scary games!" />
              </label>
              <label className={hub.field}><span>Birthday (the hub throws a party!)</span>
                <input type="date" value={birthday ? `2000-${birthday}` : ''} onChange={e => setBirthday(e.target.value ? e.target.value.slice(5) : '')} />
              </label>
            </div>
          )}
        </div>
      </div>
      <div className={hub.row}>
        {isMe && !editing && <button className={hub.ghost} onClick={() => setEditing(true)}>✏️ Edit my card</button>}
        {editing && <button className={hub.primary} onClick={() => { onSave({ about: about.trim(), birthday }); setEditing(false) }}>Save</button>}
        {editing && <button className={hub.ghost} onClick={() => setEditing(false)}>Cancel</button>}
        {!editing && <button className={hub.primary} onClick={onSwitch}>🔄 Switch player</button>}
      </div>
    </Modal>
  )
}

// ── Theme studio ──
export function ThemeStudio({ initial, onPreview, onSave, onCancel }) {
  const [cfg, setCfg] = useState(initial)
  const set = (k, v) => { const next = { ...cfg, [k]: v }; setCfg(next); onPreview(next) }
  const colors = [['bg', 'Background'], ['accent', 'Buttons'], ['glowA', 'Glow 1'], ['glowB', 'Glow 2'], ['glowC', 'Glow 3']]
  return (
    <Modal title="🎨 Make your own theme" onClose={onCancel}>
      <p className={hub.small} style={{ marginTop: 0 }}>Changes show up behind this box as you go.</p>
      <div className={styles.studioRow}>
        <button className={`${styles.tab} ${!cfg.light ? styles.tabOn : ''}`} onClick={() => set('light', false)}>🌙 Dark</button>
        <button className={`${styles.tab} ${cfg.light ? styles.tabOn : ''}`} onClick={() => set('light', true)}>☀️ Light</button>
      </div>
      <div className={styles.colors}>
        {colors.map(([k, label]) => (
          <label key={k} className={styles.color}>
            <input type="color" value={cfg[k]} onChange={e => set(k, e.target.value)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <div className={styles.studioLabel}>Background pattern</div>
      <div className={styles.studioRow}>
        {PATTERNS.map(p => <button key={p.id} className={`${styles.tab} ${cfg.pattern === p.id ? styles.tabOn : ''}`} onClick={() => set('pattern', p.id)}>{p.label}</button>)}
      </div>
      <div className={styles.studioLabel}>Floating things</div>
      <div className={styles.studioRow}>
        {FLOATER_CHOICES.map(f => (
          <button key={f || 'none'} className={`${styles.emojiPick} ${(cfg.floaters[0] || '') === f ? styles.tabOn : ''}`} onClick={() => set('floaters', f ? [f] : [])}>{f || '🚫'}</button>
        ))}
      </div>
      <div className={styles.studioLabel}>Or start from</div>
      <div className={styles.studioRow}>
        {Object.entries(PRESETS).map(([id, p]) => (
          <button key={id} className={styles.tab} onClick={() => { const next = { ...p, name: cfg.name }; setCfg(next); onPreview(next) }}>{p.name}</button>
        ))}
      </div>
      <div className={hub.row}>
        <button className={hub.primary} onClick={() => onSave(cfg)}>Save my theme</button>
        <button className={hub.ghost} onClick={onCancel}>Cancel</button>
      </div>
    </Modal>
  )
}

// ── The pet ──
export function PetWidget({ info, hat, onOpen }) {
  const [line, setLine] = useState(null)
  useEffect(() => {
    const t = setInterval(() => {
      if (Math.random() < 0.5) return
      const lines = PET_LINES[info.mood]
      setLine(lines[Math.floor(Math.random() * lines.length)])
      setTimeout(() => setLine(null), 3500)
    }, 14000)
    return () => clearInterval(t)
  }, [info.mood])
  return (
    <button className={`${styles.pet} ${styles['pet_' + info.mood]}`} onClick={() => { sfx('heart'); onOpen() }} aria-label={`Your pet ${info.name}`} title={`${info.name} — click to visit`}>
      {line && <span className={styles.petSays}>{line}</span>}
      <span className={styles.petBody} style={{ fontSize: `${1.9 + info.stage * 0.22}rem` }}>
        {hat && info.stage > 0 && <span className={styles.petHat}>{hat}</span>}
        {info.emoji}
      </span>
      {info.mood === 'sleepy' && <span className={styles.zzz}>💤</span>}
    </button>
  )
}

export function PetDialog({ pet, info, hat, wallet, onFeed, onRename, onClose }) {
  const [name, setName] = useState(pet.name || '')
  const [hearts, setHearts] = useState(0)
  const sp = SPECIES[pet.species]
  const moodText = { egg: 'It’s an egg. Play games to keep it warm and it’ll hatch!', happy: 'Happy! You played today. 😊', full: 'Full and happy! 😋', sleepy: 'Sleepy… play a game today to wake it up! 💤', lonely: 'Lonely… it missed you! Play a game? 🥺' }[info.mood]
  const canFeed = info.stage > 0 && info.fedToday < MAX_TREATS && wallet.balance >= TREAT_PRICE
  return (
    <Modal title={`${info.emoji} ${info.name}`} onClose={onClose}>
      <div className={styles.petStage}>
        {Array.from({ length: hearts }, (_, k) => <span key={k} className={styles.heartUp} style={{ left: `${30 + ((k * 23) % 40)}%`, animationDelay: `${(k % 3) * 0.1}s` }}>💖</span>)}
        <span className={styles.petBig}>
          {hat && info.stage > 0 && <span className={styles.petHatBig}>{hat}</span>}
          {info.emoji}
        </span>
      </div>
      <div className={styles.petMood}>{moodText}</div>
      <div className={styles.petMeta}>{STAGE_NAMES[info.stage]} · level {info.level}</div>
      <div className={hub.bar} style={{ maxWidth: '100%', margin: '0.4rem 0 0.2rem' }}>
        <span style={{ width: `${info.pct}%` }} /><em>{info.next ? `${Math.floor(info.xp)}/${info.next} XP to grow` : 'Fully grown!'}</em>
      </div>
      {info.stage > 0 && (
        <div className={styles.growRow}>
          {sp.stages.map((e, k) => <span key={k} className={k < info.stage ? styles.grown : styles.notYet}>{k < info.stage ? e : '❔'}</span>)}
        </div>
      )}
      <p className={hub.small}>Grows when you play games (every minute and every game you open). Treats give a boost!</p>
      {info.stage > 0 && (
        <label className={hub.field}><span>Name</span>
          <input value={name} maxLength={14} onChange={e => setName(e.target.value)} onBlur={() => onRename(name.trim())} placeholder={sp.name} />
        </label>
      )}
      <div className={hub.row}>
        <button className={hub.primary} disabled={!canFeed} onClick={() => { onFeed(); setHearts(h => h + 4) }}>
          🍪 Give a treat (🪙 {TREAT_PRICE})
        </button>
        <button className={hub.ghost} onClick={onClose}>Bye!</button>
      </div>
      {info.stage > 0 && info.fedToday >= MAX_TREATS && <p className={hub.small}>“I’m stuffed!” — come back tomorrow for more treats.</p>}
    </Modal>
  )
}
