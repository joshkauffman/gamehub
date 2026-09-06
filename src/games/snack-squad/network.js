// ── Snack Squad — Trading Post networking ───────────────────────────────
// Same no-backend approach as Chat Lounge: PeerJS's free public broker is
// used purely for the initial WebRTC handshake, then trade/battle
// messages flow directly peer-to-peer. Unlike Chat Lounge this is a
// strict 1:1 connection (one player trading or battling one other), so
// there's no roster/broadcast — just a single data channel.

import Peer from 'peerjs'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I — easier to read aloud
function randomCode(len = 4) {
  let s = ''
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

const PEER_PREFIX = 'snack-squad-trade-'

export function hostRoom({ onReady, onGuestJoined, onGuestLeft, onMessage, onError }) {
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
      if (conn) { c.close(); return } // one guest only — this is a 1:1 room
      conn = c
      conn.on('open', () => onGuestJoined())
      conn.on('data', (data) => onMessage(data))
      conn.on('close', () => onGuestLeft())
    })
    peer = p
  }
  attempt(3)

  return {
    send(payload) { conn?.send(payload) },
    destroy() { conn?.close(); peer?.destroy() },
  }
}

export function joinRoom(code, { onOpen, onMessage, onClose, onError }) {
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
