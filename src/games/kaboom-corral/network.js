// ── Kaboom Corral — online mode networking ────────────────────────────
// No backend of our own: this leans on PeerJS's free public broker purely
// for the initial handshake (WebRTC signaling), then talks peer-to-peer
// over a data channel. Architecture is host-authoritative — the host runs
// the one real copy of the engine (see engine.js) and broadcasts a
// redacted view to each guest; guests only ever send small "I'd like to do
// this" action intents back. That keeps every hand private to its owner
// and avoids needing to keep multiple engine copies in sync.

import Peer from 'peerjs'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I — easier to read aloud
function randomCode(len = 4) {
  let s = ''
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

const PEER_PREFIX = 'kaboom-corral-'

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
    broadcast(buildPayloadFor) {
      connections.forEach((conn, peerId) => conn.send(buildPayloadFor(peerId)))
    },
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
