// ── Chat Lounge — room networking ─────────────────────────────────────
// Same no-backend approach as Kaboom Corral's online mode: PeerJS's free
// public broker is used purely for the initial WebRTC handshake, then
// everything flows peer-to-peer over data channels. Topology is a star —
// every guest connects only to the host, and the host relays chat/roster
// messages out to everyone else — so this scales to a small group chat
// without needing a full mesh of connections between every pair of guests.

import Peer from 'peerjs'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I — easier to read aloud
function randomCode(len = 4) {
  let s = ''
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

const PEER_PREFIX = 'chat-lounge-'

export function hostRoom({ onReady, onGuestJoined, onGuestLeft, onMessage, onError }) {
  let peer = null
  const connections = new Map() // peerId -> DataConnection

  function attempt(retriesLeft) {
    const code = randomCode()
    const p = new Peer(PEER_PREFIX + code)
    p.on('open', () => { peer = p; onReady(code) })
    p.on('error', (err) => {
      if (err.type === 'unavailable-id' && retriesLeft > 0) { p.destroy(); attempt(retriesLeft - 1); return }
      onError?.(err)
    })
    p.on('connection', (conn) => {
      conn.on('open', () => { connections.set(conn.peer, conn); onGuestJoined(conn.peer) })
      conn.on('data', (data) => onMessage(conn.peer, data))
      conn.on('close', () => { connections.delete(conn.peer); onGuestLeft(conn.peer) })
    })
    peer = p
  }
  attempt(3)

  return {
    sendTo(guestPeerId, payload) { connections.get(guestPeerId)?.send(payload) },
    broadcast(payload) { connections.forEach(conn => conn.send(payload)) },
    guestIds() { return Array.from(connections.keys()) },
    destroy() { connections.forEach(c => c.close()); peer?.destroy() },
  }
}

export function joinRoom(code, { onOpen, onMessage, onClose, onError }) {
  const peer = new Peer()
  let conn = null
  peer.on('open', (myPeerId) => {
    conn = peer.connect(PEER_PREFIX + code.trim().toUpperCase(), { reliable: true })
    conn.on('open', () => onOpen(myPeerId))
    conn.on('data', (data) => onMessage(data))
    conn.on('close', () => onClose())
  })
  peer.on('error', (err) => onError?.(err))

  return {
    send(payload) { conn?.send(payload) },
    close() { conn?.close(); peer.destroy() },
  }
}
