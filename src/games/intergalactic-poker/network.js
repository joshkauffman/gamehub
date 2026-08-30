// ── Intergalactic Poker — room networking ────────────────────────────────
// Same no-backend approach as Chat Lounge / Kaboom Corral: PeerJS's free
// public broker is used purely for the initial WebRTC handshake, then game
// messages flow peer-to-peer over a data channel. Only ever two players
// (heads-up), so this is a single direct connection, not Chat Lounge's
// host-relays-to-everyone star topology.

import Peer from 'peerjs'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I — easier to read aloud
function randomCode(len = 4) {
  let s = ''
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

const PEER_PREFIX = 'intergalactic-poker-'

export function hostTable({ onReady, onGuestJoined, onGuestLeft, onMessage, onError }) {
  let peer = null
  let conn = null

  function attempt(retriesLeft) {
    const code = randomCode()
    const p = new Peer(PEER_PREFIX + code)
    p.on('open', () => { peer = p; onReady(code) })
    p.on('error', (err) => {
      if (err.type === 'unavailable-id' && retriesLeft > 0) { p.destroy(); attempt(retriesLeft - 1); return }
      onError?.(err)
    })
    p.on('connection', (c) => {
      if (conn) { c.close(); return } // heads-up only — reject a second guest
      conn = c
      conn.on('open', () => onGuestJoined())
      conn.on('data', (data) => onMessage(data))
      conn.on('close', () => { conn = null; onGuestLeft() })
    })
    peer = p
  }
  attempt(3)

  return {
    send(payload) { conn?.send(payload) },
    hasGuest() { return !!conn },
    destroy() { conn?.close(); peer?.destroy() },
  }
}

export function joinTable(code, { onOpen, onMessage, onClose, onError }) {
  const peer = new Peer()
  let conn = null
  peer.on('open', () => {
    conn = peer.connect(PEER_PREFIX + code.trim().toUpperCase(), { reliable: true })
    conn.on('open', () => onOpen())
    conn.on('data', (data) => onMessage(data))
    conn.on('close', () => onClose())
  })
  peer.on('error', (err) => onError?.(err))

  return {
    send(payload) { conn?.send(payload) },
    close() { conn?.close(); peer.destroy() },
  }
}
