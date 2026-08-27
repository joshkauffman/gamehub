import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './KaboomCorral.module.css'
import { CARD_TYPES, CRITTER_TYPES, AVATARS, createGame, applyAction, buildView, chooseCPUAction } from './engine.js'
import { hostRoom, joinRoom } from './network.js'
import { PACKS, getStats, getActivePackId, setActivePackId, getUnlockedPackIds, getCardDef, recordGameEnd, recordPairPlayed } from './packs.js'

const CPU_NAMES = ['Rusty', 'Nibbles', 'Pip', 'Sable', 'Acorn', 'Marsh', 'Bramble', 'Puddle']
function randomCpuName(taken) {
  const pool = CPU_NAMES.filter(n => !taken.includes(n))
  return pool[Math.floor(Math.random() * pool.length)] || `Bot${taken.length}`
}

// ── Small shared bits ───────────────────────────────────────────────
function AvatarPicker({ value, onChange }) {
  return (
    <div className={styles.avatarRow}>
      {AVATARS.map(a => (
        <button key={a} type="button" className={`${styles.avatarBtn} ${value === a ? styles.avatarBtnActive : ''}`} onClick={() => onChange(a)}>{a}</button>
      ))}
    </div>
  )
}

// Shared face content (corner indices + big center art + name banner) so a
// playable Card button and a static display-only card (Peek results,
// discard pile) render identically.
function CardFace({ type, packId }) {
  const def = getCardDef(type, packId)
  return (
    <>
      <span className={styles.cardCorner}>{def.emoji}</span>
      <span className={`${styles.cardCorner} ${styles.cardCornerBottom}`}>{def.emoji}</span>
      <span className={styles.cardArt}>{def.emoji}</span>
      <span className={styles.cardName}>{def.name}</span>
      <span className={styles.cardDesc}>{def.blurb}</span>
    </>
  )
}
function cardVars(type, packId) {
  const def = getCardDef(type, packId)
  return { '--card-bg': def.bg, '--card-edge': def.edge }
}

function Card({ card, selected, disabled, onClick, packId }) {
  const def = getCardDef(card.type, packId)
  return (
    <button
      className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
      disabled={disabled}
      onClick={onClick}
      title={def.blurb}
      style={cardVars(card.type, packId)}
    >
      <CardFace type={card.type} packId={packId} />
    </button>
  )
}

function StaticCard({ type, packId }) {
  return (
    <div className={styles.card} style={cardVars(type, packId)}>
      <CardFace type={type} packId={packId} />
    </div>
  )
}

// ── Menu / setup screens ─────────────────────────────────────────────
function MenuScreen({ onPick, onPacks, unlockedCount }) {
  return (
    <div className={styles.center}>
      <h1 className={styles.title}>💥 Kaboom Corral</h1>
      <p className={styles.blurb}>
        A woodland card game of nerve and sabotage. Draw carefully, play your critters
        wisely, and don't be the one holding the KABOOM.
      </p>
      <div className={styles.modeRow}>
        <button className={styles.modeBtn} onClick={() => onPick('local')}>👥 Local <span>pass & play, 2–4 players</span></button>
        <button className={styles.modeBtn} onClick={() => onPick('cpu')}>🤖 Vs CPU <span>you against 1–3 bots</span></button>
        <button className={styles.modeBtn} onClick={() => onPick('online')}>🌐 Online <span>play with a room code</span></button>
      </div>
      <button className={styles.modeBtn} onClick={onPacks}>📦 Card Packs <span>{unlockedCount}/{PACKS.length} unlocked</span></button>
      <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
    </div>
  )
}

function PacksScreen({ stats, activePackId, onSelect, onBack }) {
  return (
    <div className={styles.center}>
      <h2 className={styles.h2}>📦 Card Packs</h2>
      <p className={styles.blurb}>
        Reskin the whole deck — all 12 cards, not just the critters — with a pack you've
        unlocked. Purely cosmetic — the game plays exactly the same. Your progress and
        picks are saved on this device.
      </p>
      <div className={styles.packGrid}>
        {PACKS.map(pack => {
          const unlocked = pack.isUnlocked(stats)
          const active = pack.id === activePackId
          return (
            <div key={pack.id} className={`${styles.packEntry} ${unlocked ? '' : styles.packEntryLocked}`}>
              <div className={styles.packHeader}>
                <span>{pack.icon} {pack.name}</span>
                {active && <span className={styles.packActiveBadge}>Active</span>}
              </div>
              <p className={styles.blurb}>{pack.description}</p>
              <div className={styles.modeRow}>
                {Object.keys(CARD_TYPES).map(type => <StaticCard key={type} type={type} packId={pack.id} />)}
              </div>
              {unlocked ? (
                <button className={styles.bigBtn} disabled={active} onClick={() => onSelect(pack.id)}>
                  {active ? 'In Use' : 'Use This Pack'}
                </button>
              ) : (
                <span className={styles.packRequirement}>🔒 {pack.requirement}</span>
              )}
            </div>
          )
        })}
      </div>
      <button className={styles.backBtn} onClick={onBack}>← Back</button>
    </div>
  )
}

function PlayerForm({ name, avatar, onName, onAvatar, label }) {
  return (
    <div className={styles.playerForm}>
      {label && <span className={styles.playerFormLabel}>{label}</span>}
      <input className={styles.textInput} value={name} maxLength={16} placeholder="Name" onChange={e => onName(e.target.value)} />
      <AvatarPicker value={avatar} onChange={onAvatar} />
    </div>
  )
}

function LocalSetup({ onStart, onBack }) {
  const [count, setCount] = useState(2)
  const [players, setPlayers] = useState(() => Array.from({ length: 4 }, (_, i) => ({ name: '', avatar: AVATARS[i] })))

  function update(i, patch) { setPlayers(prev => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p))) }

  function start() {
    const chosen = players.slice(0, count).map((p, i) => ({ id: `local-${i}`, name: p.name.trim() || `Player ${i + 1}`, avatar: p.avatar, isCPU: false }))
    onStart(chosen)
  }

  return (
    <div className={styles.center}>
      <h2 className={styles.h2}>Who's playing?</h2>
      <div className={styles.countRow}>
        {[2, 3, 4].map(n => (
          <button key={n} className={`${styles.countBtn} ${count === n ? styles.countBtnActive : ''}`} onClick={() => setCount(n)}>{n} players</button>
        ))}
      </div>
      {players.slice(0, count).map((p, i) => (
        <PlayerForm key={i} label={`Player ${i + 1}`} name={p.name} avatar={p.avatar} onName={v => update(i, { name: v })} onAvatar={v => update(i, { avatar: v })} />
      ))}
      <div className={styles.modeRow}>
        <button className={styles.bigBtn} onClick={start}>Start Game ▶</button>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
      </div>
    </div>
  )
}

function CPUSetup({ onStart, onBack }) {
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0])
  const [cpuCount, setCpuCount] = useState(2)

  function start() {
    const you = { id: 'you', name: name.trim() || 'You', avatar, isCPU: false }
    const taken = []
    const bots = Array.from({ length: cpuCount }, (_, i) => {
      const n = randomCpuName(taken); taken.push(n)
      return { id: `cpu-${i}`, name: n, avatar: AVATARS[(i + 2) % AVATARS.length], isCPU: true }
    })
    onStart([you, ...bots])
  }

  return (
    <div className={styles.center}>
      <h2 className={styles.h2}>You vs the bots</h2>
      <PlayerForm name={name} avatar={avatar} onName={setName} onAvatar={setAvatar} />
      <div className={styles.countRow}>
        {[1, 2, 3].map(n => (
          <button key={n} className={`${styles.countBtn} ${cpuCount === n ? styles.countBtnActive : ''}`} onClick={() => setCpuCount(n)}>{n} bot{n === 1 ? '' : 's'}</button>
        ))}
      </div>
      <div className={styles.modeRow}>
        <button className={styles.bigBtn} onClick={start}>Start Game ▶</button>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
      </div>
    </div>
  )
}

function OnlineSetup({ onHost, onJoin, onBack }) {
  const [sub, setSub] = useState('choose') // 'choose' | 'host' | 'join'
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0])
  const [code, setCode] = useState('')

  if (sub === 'choose') {
    return (
      <div className={styles.center}>
        <h2 className={styles.h2}>Play online</h2>
        <div className={styles.modeRow}>
          <button className={styles.modeBtn} onClick={() => setSub('host')}>🏠 Create a Room</button>
          <button className={styles.modeBtn} onClick={() => setSub('join')}>🔑 Join a Room</button>
        </div>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
      </div>
    )
  }

  return (
    <div className={styles.center}>
      <h2 className={styles.h2}>{sub === 'host' ? 'Create a Room' : 'Join a Room'}</h2>
      <PlayerForm name={name} avatar={avatar} onName={setName} onAvatar={setAvatar} />
      {sub === 'join' && (
        <input className={styles.textInput} value={code} maxLength={4} placeholder="Room code" onChange={e => setCode(e.target.value.toUpperCase())} />
      )}
      <div className={styles.modeRow}>
        <button
          className={styles.bigBtn}
          onClick={() => (sub === 'host' ? onHost({ name: name.trim() || 'Host', avatar }) : onJoin(code, { name: name.trim() || 'Guest', avatar }))}
        >
          {sub === 'host' ? 'Create Room ▶' : 'Join ▶'}
        </button>
        <button className={styles.backBtn} onClick={() => setSub('choose')}>← Back</button>
      </div>
    </div>
  )
}

function LobbyScreen({ code, players, isHost, onStart, onBack }) {
  return (
    <div className={styles.center}>
      <h2 className={styles.h2}>{isHost ? 'Waiting for players...' : 'Waiting for host to start...'}</h2>
      {code && (
        <div className={styles.roomCode}>
          Room code: <strong>{code}</strong>
        </div>
      )}
      <div className={styles.lobbyList}>
        {players.map(p => (
          <span key={p.id} className={styles.lobbyPlayer}>{p.avatar} {p.name}</span>
        ))}
      </div>
      {isHost ? (
        <div className={styles.modeRow}>
          <button className={styles.bigBtn} disabled={players.length < 2} onClick={onStart}>Start Game ▶</button>
          <button className={styles.backBtn} onClick={onBack}>← Cancel</button>
        </div>
      ) : (
        <button className={styles.backBtn} onClick={onBack}>← Cancel</button>
      )}
    </div>
  )
}

// ── Gameplay ─────────────────────────────────────────────────────────
function TargetPicker({ others, onPick, onCancel, prompt }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h3 className={styles.h2}>{prompt}</h3>
        <div className={styles.modeRow}>
          {others.map(p => (
            <button key={p.id} className={styles.modeBtn} onClick={() => onPick(p.id)}>{p.avatar} {p.name} <span>{p.handCount} cards</span></button>
          ))}
        </div>
        <button className={styles.backBtn} onClick={onCancel}>← Cancel</button>
      </div>
    </div>
  )
}

function InsertKaboomModal({ drawCount, onConfirm }) {
  const [pos, setPos] = useState(Math.floor(drawCount / 2))
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h3 className={styles.h2}>🛡️ Defused! Hide the KABOOM...</h3>
        <p className={styles.blurb}>Choose how deep to bury it in the deck. 0 = right on top (evil), {drawCount} = all the way at the bottom (safe).</p>
        <input type="range" min={0} max={drawCount} value={pos} onChange={e => setPos(Number(e.target.value))} className={styles.slider} />
        <p className={styles.blurb}>Depth: {pos} / {drawCount}</p>
        <button className={styles.bigBtn} onClick={() => onConfirm(pos)}>Hide It ▶</button>
      </div>
    </div>
  )
}

function PeekModal({ cards, packId, onDismiss }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h3 className={styles.h2}>🔮 Top of the deck</h3>
        <div className={styles.modeRow}>
          {cards.map((type, i) => <StaticCard key={i} type={type} packId={packId} />)}
        </div>
        <p className={styles.blurb}>Left = drawn next.</p>
        <button className={styles.bigBtn} onClick={onDismiss}>Got it</button>
      </div>
    </div>
  )
}

function GameBoard({ view, myId, onAction, peekReveal, onDismissPeek, error, packId }) {
  const [selected, setSelected] = useState([])
  const [targeting, setTargeting] = useState(null) // 'swap' | 'pair'

  useEffect(() => { setSelected([]); setTargeting(null) }, [view.activeIndex, view.pending])

  const me = view.players.find(p => p.id === myId)
  const isActive = view.players[view.activeIndex]?.id === myId
  const pendingMine = view.pending?.playerId === myId
  const pendingOther = view.pending && view.pending.playerId !== myId
  const canAct = isActive && !view.pending && !view.winnerId
  const others = view.players.filter(p => p.id !== myId && p.alive)

  function toggleCard(card) {
    if (!canAct) return
    setTargeting(null)
    setSelected(prev => {
      if (prev.includes(card.id)) return prev.filter(id => id !== card.id)
      if (prev.length >= 2) return [card.id]
      return [...prev, card.id]
    })
  }

  const selectedCards = (me?.hand || []).filter(c => selected.includes(c.id))
  const singleSimple = selectedCards.length === 1 && ['skip', 'attack', 'shuffle', 'peek'].includes(selectedCards[0].type)
  const singleSwap = selectedCards.length === 1 && selectedCards[0].type === 'swap'
  const pairMatch = selectedCards.length === 2 && selectedCards[0].type === selectedCards[1].type && CRITTER_TYPES.includes(selectedCards[0].type)

  function playSimple() { onAction({ type: 'PLAY_CARD', cardId: selectedCards[0].id }); setSelected([]) }
  function confirmTarget(targetPlayerId) {
    if (targeting === 'swap') onAction({ type: 'PLAY_SWAP', cardId: selectedCards[0].id, targetPlayerId })
    else if (targeting === 'pair') onAction({ type: 'PLAY_PAIR', cardIdA: selectedCards[0].id, cardIdB: selectedCards[1].id, targetPlayerId })
    setSelected([]); setTargeting(null)
  }

  return (
    <div className={styles.board}>
      <div className={styles.opponents}>
        {view.players.filter(p => p.id !== myId).map(p => (
          <div key={p.id} className={`${styles.oppCard} ${!p.alive ? styles.oppDead : ''} ${view.players[view.activeIndex]?.id === p.id ? styles.oppTurn : ''}`}>
            <span className={styles.oppAvatar}>{p.avatar}</span>
            <span className={styles.oppName}>{p.name}{p.isCPU ? ' 🤖' : ''}</span>
            <span className={styles.oppHand}>{p.alive ? `🂠 ×${p.handCount}` : '💀 out'}</span>
          </div>
        ))}
      </div>

      <div className={styles.tableRow}>
        <div className={styles.pileStack}>
          <div className={styles.cardBack}><span className={styles.pileCount}>{view.drawCount}</span></div>
          <span className={styles.pileLabel}>Draw</span>
        </div>
        <div className={styles.pileStack}>
          {view.discardTop ? <StaticCard type={view.discardTop.type} packId={packId} /> : <div className={styles.emptyPile}>—</div>}
          <span className={styles.pileLabel}>Discard</span>
        </div>
      </div>

      <div className={styles.status}>
        {view.winnerId ? null
          : pendingOther ? <span>{view.players.find(p => p.id === view.pending.playerId)?.name} is deciding where to hide the KABOOM...</span>
          : isActive ? <span>Your turn — {view.owed} draw{view.owed === 1 ? '' : 's'} owed</span>
          : <span>{view.players[view.activeIndex]?.name}'s turn</span>}
      </div>
      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.hand}>
        {(me?.hand || []).map(c => (
          <Card key={c.id} card={c} selected={selected.includes(c.id)} disabled={!canAct} onClick={() => toggleCard(c)} packId={packId} />
        ))}
        {(!me?.hand || me.hand.length === 0) && <span className={styles.blurb}>Your hand is empty.</span>}
      </div>

      <div className={styles.actionBar}>
        {canAct && singleSimple && <button className={styles.bigBtn} onClick={playSimple}>Play {CARD_TYPES[selectedCards[0].type].name}</button>}
        {canAct && singleSwap && <button className={styles.bigBtn} onClick={() => setTargeting('swap')}>Play Swap ▶</button>}
        {canAct && pairMatch && <button className={styles.bigBtn} onClick={() => setTargeting('pair')}>Play Pair ▶</button>}
        {canAct && selected.length === 0 && <button className={styles.bigBtn} onClick={() => onAction({ type: 'DRAW' })}>🂠 Draw Card</button>}
      </div>

      {targeting && <TargetPicker others={others} prompt="Target who?" onPick={confirmTarget} onCancel={() => setTargeting(null)} />}
      {pendingMine && <InsertKaboomModal drawCount={view.drawCount} onConfirm={(pos) => onAction({ type: 'INSERT_POSITION', position: pos })} />}
      {peekReveal && <PeekModal cards={peekReveal} packId={packId} onDismiss={onDismissPeek} />}

      <div className={styles.log}>
        {view.log.slice(-6).map((line, i) => <div key={i}>{line}</div>)}
      </div>
    </div>
  )
}

function PassDeviceGate({ player, onReady }) {
  return (
    <div className={styles.center}>
      <h2 className={styles.h2}>Pass the device to</h2>
      <p className={styles.title}>{player.avatar} {player.name}</p>
      <button className={styles.bigBtn} onClick={onReady}>I'm Ready — Show My Hand ▶</button>
    </div>
  )
}

function GameOverScreen({ view, myId, onRestart, onMenu, newlyUnlocked }) {
  const winner = view.players.find(p => p.id === view.winnerId)
  const won = winner?.id === myId
  return (
    <div className={styles.center}>
      <h1 className={styles.title}>{won ? '🏆 You Win!' : `🏆 ${winner?.name} Wins!`}</h1>
      <p className={styles.blurb}>{winner?.avatar} {winner?.name} was the last one standing in Kaboom Corral.</p>
      {newlyUnlocked?.length > 0 && (
        <div className={styles.unlockBanner}>
          {newlyUnlocked.map(pack => <div key={pack.id}>🎉 New pack unlocked: {pack.icon} {pack.name}!</div>)}
        </div>
      )}
      <div className={styles.modeRow}>
        {onRestart && <button className={styles.bigBtn} onClick={onRestart}>🔁 Play Again</button>}
        <button className={styles.backBtn} onClick={onMenu}>🏠 Main Menu</button>
      </div>
    </div>
  )
}

// ── Top-level orchestration ──────────────────────────────────────────
export default function KaboomCorral() {
  const [screen, setScreen] = useState('menu')
  const [mode, setMode] = useState(null)
  const [gameState, setGameState] = useState(null)
  const [myId, setMyId] = useState(null)
  const [error, setError] = useState(null)
  const [peekReveal, setPeekReveal] = useState(null)

  // Card packs: cosmetic-only, tracked per device (see packs.js).
  const [activePackId, setActivePackIdState] = useState(() => getActivePackId())
  const [newlyUnlocked, setNewlyUnlocked] = useState([])
  const statsAppliedRef = useRef(null)

  function selectPack(id) {
    setActivePackId(id)
    setActivePackIdState(id)
  }

  // Local pass-and-play "who's currently allowed to look" gate.
  const [revealedTurnKey, setRevealedTurnKey] = useState(null)
  const lastTurnKeyRef = useRef(null)

  // Online plumbing.
  const [roomCode, setRoomCode] = useState(null)
  const [lobbyPlayers, setLobbyPlayers] = useState([])
  const hostRef = useRef(null)
  const guestRef = useRef(null)
  const [onlineView, setOnlineView] = useState(null)

  function resetAll() {
    hostRef.current?.destroy(); hostRef.current = null
    guestRef.current?.close(); guestRef.current = null
    setGameState(null); setOnlineView(null); setMyId(null); setError(null); setPeekReveal(null)
    setRoomCode(null); setLobbyPlayers([]); setGuestLobby([]); setMode(null); setNewlyUnlocked([])
  }

  function goMenu() { resetAll(); setScreen('menu') }

  // ── Local / CPU: run the engine directly in this component ─────────
  function startLocal(players) {
    setMode('local'); setMyId(null)
    setGameState(createGame(players))
    setScreen('playing')
  }
  function startCPU(players) {
    setMode('cpu'); setMyId('you')
    setGameState(createGame(players))
    setScreen('playing')
  }

  function localDispatch(action, actingId) {
    setGameState(prev => {
      const { state, private: priv, error: err } = applyAction(prev, { ...action, playerId: actingId })
      if (err) { setError(err); setTimeout(() => setError(null), 2000); return prev }
      if (priv?.kind === 'peek') setPeekReveal(priv.payload)
      if (action.type === 'PLAY_PAIR') recordPairPlayed()
      return state
    })
  }

  // CPU auto-play loop (cpu mode only).
  const cpuBusyRef = useRef(false)
  useEffect(() => {
    if (mode !== 'cpu' || !gameState || gameState.winnerId) return
    const actorId = gameState.pending ? gameState.pending.playerId : gameState.players[gameState.activeIndex].id
    const actor = gameState.players.find(p => p.id === actorId)
    if (!actor?.isCPU || cpuBusyRef.current) return
    cpuBusyRef.current = true
    const t = setTimeout(() => {
      const action = chooseCPUAction(gameState, actorId)
      localDispatch(action, actorId)
      cpuBusyRef.current = false
    }, 900)
    return () => clearTimeout(t)
  }, [mode, gameState])

  // Local pass-and-play reveal gating.
  useEffect(() => {
    if (mode !== 'local' || !gameState) return
    const key = gameState.pending ? gameState.pending.playerId : `${gameState.activeIndex}-${gameState.turn}`
    if (lastTurnKeyRef.current !== key) {
      lastTurnKeyRef.current = key
      setRevealedTurnKey(null)
    }
  }, [mode, gameState])

  // Records a finished game's outcome once (per game object) toward this
  // device's pack-unlock progress. Only local/cpu/online-host run the
  // engine on this device, so only those modes can observe a real result.
  useEffect(() => {
    if (!gameState?.winnerId) return
    if (!['local', 'cpu', 'online-host'].includes(mode)) return
    if (statsAppliedRef.current === gameState) return
    statsAppliedRef.current = gameState
    const before = getUnlockedPackIds(getStats())
    const won = mode === 'cpu' ? gameState.winnerId === 'you' : true
    const after = getUnlockedPackIds(recordGameEnd({ won }))
    const gained = after.filter(id => !before.includes(id))
    setNewlyUnlocked(gained.map(id => PACKS.find(p => p.id === id)).filter(Boolean))
  }, [mode, gameState])

  // ── Online host ──────────────────────────────────────────────────
  function startOnlineHost({ name, avatar }) {
    setMode('online-host')
    const me = { id: 'host', name, avatar }
    setLobbyPlayers([me])
    setScreen('lobby')
    hostRef.current = hostRoom({
      onReady: (code) => setRoomCode(code),
      onGuestJoined: () => {},
      onGuestLeft: (peerId) => {
        setLobbyPlayers(prev => prev.filter(p => p.id !== peerId))
        setGameState(prev => prev) // no-op placeholder; disconnect handling kept minimal for v1
      },
      onMessage: (peerId, data) => {
        if (data.type === 'join') {
          setLobbyPlayers(prev => {
            if (prev.some(p => p.id === peerId)) return prev
            const next = [...prev, { id: peerId, name: data.name, avatar: data.avatar }]
            hostRef.current?.broadcast(() => ({ type: 'lobby', players: next }))
            return next
          })
        } else if (data.type === 'action') {
          hostDispatch(data.action, peerId)
        }
      },
      onError: (err) => setError(err.message || 'Connection error'),
    })
  }

  function broadcastViews(state) {
    hostRef.current?.broadcast((peerId) => ({ type: 'view', view: buildView(state, peerId) }))
  }

  function hostDispatch(action, actingId) {
    setGameState(prev => {
      const { state, private: priv, error: err } = applyAction(prev, { ...action, playerId: actingId })
      if (err) {
        if (actingId === 'host') { setError(err); setTimeout(() => setError(null), 2000) }
        else hostRef.current?.sendTo(actingId, { type: 'error', message: err })
        return prev
      }
      broadcastViews(state)
      if (priv) {
        if (priv.forPlayerId === 'host') setPeekReveal(priv.payload)
        else hostRef.current?.sendTo(priv.forPlayerId, { type: 'private', kind: priv.kind, payload: priv.payload })
      }
      if (action.type === 'PLAY_PAIR') recordPairPlayed()
      return state
    })
  }

  function hostStartGame() {
    const state = createGame(lobbyPlayers)
    setGameState(state)
    setMyId('host')
    setScreen('playing')
    broadcastViews(state)
  }

  // ── Online guest ─────────────────────────────────────────────────
  const [guestLobby, setGuestLobby] = useState([])
  function startOnlineJoin(code, { name, avatar }) {
    setMode('online-guest')
    setScreen('lobby')
    guestRef.current = joinRoom(code, {
      onOpen: (myPeerId) => {
        setMyId(myPeerId)
        guestRef.current.send({ type: 'join', name, avatar })
      },
      onMessage: (data) => {
        if (data.type === 'lobby') {
          setGuestLobby(data.players)
        } else if (data.type === 'view') {
          setOnlineView(data.view)
          setScreen('playing')
        } else if (data.type === 'private' && data.kind === 'peek') {
          setPeekReveal(data.payload)
        } else if (data.type === 'error') {
          setError(data.message); setTimeout(() => setError(null), 2000)
        }
      },
      onClose: () => setError('Disconnected from host.'),
      onError: (err) => setError(err.message || 'Connection error'),
    })
  }

  function guestDispatch(action) {
    guestRef.current?.send({ type: 'action', action })
  }

  function restart() {
    setNewlyUnlocked([])
    if (mode === 'local') setGameState(prev => createGame(prev.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, isCPU: p.isCPU }))))
    else if (mode === 'cpu') setGameState(prev => createGame(prev.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, isCPU: p.isCPU }))))
    else if (mode === 'online-host') hostStartGame()
  }

  const view = mode === 'online-guest' ? onlineView : (gameState ? buildView(gameState, myId) : null)

  return (
    <div className={styles.page}>
      {screen === 'menu' && (
        <MenuScreen
          onPick={(m) => { setMode(m); setScreen(m === 'online' ? 'online-setup' : `${m}-setup`) }}
          onPacks={() => setScreen('packs')}
          unlockedCount={getUnlockedPackIds(getStats()).length}
        />
      )}

      {screen === 'packs' && (
        <PacksScreen stats={getStats()} activePackId={activePackId} onSelect={selectPack} onBack={() => setScreen('menu')} />
      )}

      {screen === 'local-setup' && <LocalSetup onStart={startLocal} onBack={goMenu} />}
      {screen === 'cpu-setup' && <CPUSetup onStart={startCPU} onBack={goMenu} />}
      {screen === 'online-setup' && (
        <OnlineSetup
          onHost={startOnlineHost}
          onJoin={startOnlineJoin}
          onBack={goMenu}
        />
      )}

      {screen === 'lobby' && mode === 'online-host' && (
        <LobbyScreen code={roomCode} players={lobbyPlayers} isHost onStart={hostStartGame} onBack={goMenu} />
      )}
      {screen === 'lobby' && mode === 'online-guest' && (
        <LobbyScreen code={null} players={guestLobby} isHost={false} onBack={goMenu} />
      )}

      {screen === 'playing' && view && !view.winnerId && (
        mode === 'local' && revealedTurnKey === null ? (
          <PassDeviceGate player={view.players[view.activeIndex]} onReady={() => setRevealedTurnKey(lastTurnKeyRef.current)} />
        ) : (
          <GameBoard
            view={view}
            myId={mode === 'local' ? view.players[view.activeIndex].id : myId}
            onAction={(action) => {
              const actingId = mode === 'local' ? view.players[view.activeIndex].id : myId
              if (mode === 'local' || mode === 'cpu') localDispatch(action, actingId)
              else if (mode === 'online-host') hostDispatch(action, 'host')
              else guestDispatch(action)
            }}
            peekReveal={peekReveal}
            onDismissPeek={() => setPeekReveal(null)}
            error={error}
            packId={activePackId}
          />
        )
      )}

      {screen === 'playing' && view && view.winnerId && (
        <GameOverScreen
          view={view}
          myId={myId}
          onRestart={mode === 'local' || mode === 'cpu' || mode === 'online-host' ? restart : null}
          onMenu={goMenu}
          newlyUnlocked={newlyUnlocked}
        />
      )}
    </div>
  )
}
