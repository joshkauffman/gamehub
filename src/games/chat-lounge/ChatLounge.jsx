import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './ChatLounge.module.css'
import { hostRoom, joinRoom } from './network.js'

const AVATARS = ['🦊', '🦉', '🐿️', '🦔', '🐢', '🦝', '🐇', '🦫', '🐸', '🐱', '🐶', '🦄']

let msgCounter = 0
function nextMsgId() { msgCounter += 1; return `m${msgCounter}` }
function systemMsg(text) { return { id: nextMsgId(), kind: 'system', text, ts: Date.now() } }
function chatMsg(from, text) { return { id: nextMsgId(), kind: 'chat', from, text, ts: Date.now() } }

function AvatarPicker({ value, onChange }) {
  return (
    <div className={styles.avatarRow}>
      {AVATARS.map(a => (
        <button key={a} type="button" className={`${styles.avatarBtn} ${value === a ? styles.avatarBtnActive : ''}`} onClick={() => onChange(a)}>{a}</button>
      ))}
    </div>
  )
}

// ── Menu: personalize, then create or join a room ──────────────────────
function MenuScreen({ name, avatar, onName, onAvatar, onHost, onJoin, error }) {
  const [code, setCode] = useState('')
  return (
    <div className={styles.page}>
      <div className={styles.center}>
        <h1 className={styles.title}>💬 Chat Lounge</h1>
        <p className={styles.blurb}>
          Start a private chat and invite people with a short room code, or join a chat
          someone shared with you. No accounts, nothing saved anywhere — just this room,
          while it's open.
        </p>

        <div className={styles.playerForm}>
          <input className={styles.textInput} value={name} maxLength={16} placeholder="Your name" onChange={e => onName(e.target.value)} />
          <AvatarPicker value={avatar} onChange={onAvatar} />
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <button className={styles.bigBtn} onClick={onHost}>🏠 Start a Private Chat</button>

        <div className={styles.joinRow}>
          <input className={styles.textInput} value={code} maxLength={4} placeholder="Room code" onChange={e => setCode(e.target.value.toUpperCase())} />
          <button className={styles.bigBtn} disabled={!code.trim()} onClick={() => onJoin(code)}>Join ▶</button>
        </div>

        <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
      </div>
    </div>
  )
}

function ConnectingScreen({ text, onCancel }) {
  return (
    <div className={styles.page}>
      <div className={styles.center}>
        <h2 className={styles.h2}>{text}</h2>
        <button className={styles.backBtn} onClick={onCancel}>← Cancel</button>
      </div>
    </div>
  )
}

// ── The chat itself ────────────────────────────────────────────────────
function ChatScreen({ role, roomCode, myId, chatState, draft, setDraft, onSend, onLeave, error }) {
  const listRef = useRef(null)
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatState.messages])

  return (
    <div className={styles.chatShell}>
      <div className={styles.chatHeader}>
        <div className={styles.participants}>
          {chatState.participants.map(p => (
            <span key={p.id} className={styles.participant} title={p.name}>
              {p.avatar} {p.name}{p.id === myId ? ' (you)' : ''}
            </span>
          ))}
        </div>
        <div className={styles.headerRight}>
          {role === 'host' && roomCode && <span className={styles.roomCodeSmall}>Code: <strong>{roomCode}</strong></span>}
          <button className={styles.backBtn} onClick={onLeave}>← Leave</button>
        </div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.messages} ref={listRef}>
        {chatState.messages.length === 0 && <p className={styles.blurb}>No messages yet — say hi!</p>}
        {chatState.messages.map(m => (
          m.kind === 'system' ? (
            <div key={m.id} className={styles.systemMsg}>{m.text}</div>
          ) : (
            <div key={m.id} className={`${styles.msgRow} ${m.from.id === myId ? styles.msgRowMine : ''}`}>
              <span className={styles.msgAvatar}>{m.from.avatar}</span>
              <div className={styles.msgBubble}>
                <span className={styles.msgName}>{m.from.name}</span>
                <span className={styles.msgText}>{m.text}</span>
              </div>
            </div>
          )
        ))}
      </div>

      <form
        className={styles.composer}
        onSubmit={e => { e.preventDefault(); if (draft.trim()) { onSend(draft); setDraft('') } }}
      >
        <input
          className={styles.composerInput}
          value={draft}
          maxLength={500}
          placeholder="Type a message..."
          onChange={e => setDraft(e.target.value)}
        />
        <button className={styles.bigBtn} type="submit" disabled={!draft.trim()}>Send</button>
      </form>
    </div>
  )
}

// ── Top-level orchestration ──────────────────────────────────────────
export default function ChatLounge() {
  const [screen, setScreen] = useState('menu') // 'menu' | 'connecting' | 'chat'
  const [role, setRole] = useState(null) // 'host' | 'guest'
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0])
  const [myId, setMyId] = useState(null)
  const [roomCode, setRoomCode] = useState(null)
  const [chatState, setChatState] = useState({ messages: [], participants: [] })
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(null)

  const hostRef = useRef(null)
  const guestRef = useRef(null)

  // Always tear down any live connection if the player navigates away.
  useEffect(() => () => { hostRef.current?.destroy(); guestRef.current?.close() }, [])

  function resetAll() {
    hostRef.current?.destroy(); hostRef.current = null
    guestRef.current?.close(); guestRef.current = null
    setRole(null); setMyId(null); setRoomCode(null)
    setChatState({ messages: [], participants: [] }); setDraft(''); setError(null)
  }
  function goMenu() { resetAll(); setScreen('menu') }

  function startHost() {
    const me = { id: 'host', name: name.trim() || 'Host', avatar }
    setRole('host'); setMyId('host')
    setChatState({ messages: [], participants: [me] })
    setScreen('connecting')
    hostRef.current = hostRoom({
      onReady: (code) => { setRoomCode(code); setScreen('chat') },
      onGuestJoined: () => {},
      onGuestLeft: (peerId) => {
        setChatState(prev => {
          const left = prev.participants.find(p => p.id === peerId)
          if (!left) return prev
          const participants = prev.participants.filter(p => p.id !== peerId)
          const messages = [...prev.messages, systemMsg(`${left.name} left the chat.`)].slice(-200)
          hostRef.current?.broadcast({ type: 'update', messages, participants })
          return { messages, participants }
        })
      },
      onMessage: (peerId, data) => {
        if (data.type === 'join') {
          setChatState(prev => {
            if (prev.participants.some(p => p.id === peerId)) return prev
            const participants = [...prev.participants, { id: peerId, name: data.name, avatar: data.avatar }]
            const messages = [...prev.messages, systemMsg(`${data.name} joined the chat.`)].slice(-200)
            hostRef.current?.broadcast({ type: 'update', messages, participants })
            return { messages, participants }
          })
        } else if (data.type === 'chat' && typeof data.text === 'string') {
          setChatState(prev => {
            const sender = prev.participants.find(p => p.id === peerId)
            if (!sender) return prev
            const messages = [...prev.messages, chatMsg(sender, data.text.slice(0, 500))].slice(-200)
            hostRef.current?.broadcast({ type: 'update', messages, participants: prev.participants })
            return { ...prev, messages }
          })
        }
      },
      onError: (err) => setError(err.message || 'Connection error — try again.'),
    })
  }

  function startGuest(code) {
    setRole('guest')
    setScreen('connecting')
    guestRef.current = joinRoom(code, {
      onOpen: (myPeerId) => {
        setMyId(myPeerId)
        setScreen('chat')
        guestRef.current.send({ type: 'join', name: name.trim() || 'Guest', avatar })
      },
      onMessage: (data) => {
        if (data.type === 'update') setChatState({ messages: data.messages, participants: data.participants })
      },
      onClose: () => setError('Disconnected from the host.'),
      onError: (err) => { setError(err.message || "Couldn't connect — check the code and try again."); setScreen('menu') },
    })
  }

  function sendMessage(text) {
    const trimmed = text.trim().slice(0, 500)
    if (!trimmed) return
    if (role === 'host') {
      setChatState(prev => {
        const me = prev.participants.find(p => p.id === 'host')
        const messages = [...prev.messages, chatMsg(me, trimmed)].slice(-200)
        hostRef.current?.broadcast({ type: 'update', messages, participants: prev.participants })
        return { ...prev, messages }
      })
    } else {
      guestRef.current?.send({ type: 'chat', text: trimmed })
    }
  }

  if (screen === 'menu') {
    return <MenuScreen name={name} avatar={avatar} onName={setName} onAvatar={setAvatar} onHost={startHost} onJoin={startGuest} error={error} />
  }
  if (screen === 'connecting') {
    return <ConnectingScreen text={role === 'host' ? 'Setting up your room...' : 'Connecting...'} onCancel={goMenu} />
  }
  return (
    <ChatScreen
      role={role}
      roomCode={roomCode}
      myId={myId}
      chatState={chatState}
      draft={draft}
      setDraft={setDraft}
      onSend={sendMessage}
      onLeave={goMenu}
      error={error}
    />
  )
}
