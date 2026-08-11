import { watch, type Ref } from 'vue'
import {
  isRoomStateMessage,
  type ItineraryOp,
  type ItineraryState,
} from '#shared/itineraryOps'

export type CollabConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'

export type CollabSocket = {
  send: (data: string) => void
  addEventListener: (type: string, listener: (event: MessageEvent | Event) => void) => void
  close: () => void
}

type SessionDeps = {
  registerCollabSender: (sender: ((op: ItineraryOp) => void) | null) => void
  applyRemoteState: (state: ItineraryState) => void
  setStatus: (status: CollabConnectionStatus) => void
  /**
   * Shared state, not per-session: adding `?room=` remounts the page, so a share
   * started on one page instance has to be finished by the next one.
   */
  pendingHostSnapshot: Ref<ItineraryState | null>
}

/**
 * Owns PartySocket open/close/message lifecycle for a shared itinerary room.
 * Keeps outbound ops wired across reconnects; waits for host snapshot before share proceeds.
 */
export const createCollabSocketSession = (deps: SessionDeps) => {
  const pendingHostSnapshot = deps.pendingHostSnapshot
  let awaitingHostSyncAck = false
  let activeSocket: CollabSocket | null = null

  const attachSender = (socket: CollabSocket) => {
    deps.registerCollabSender((op) => {
      socket.send(JSON.stringify(op))
    })
  }

  const sendHostSnapshotIfNeeded = (socket: CollabSocket) => {
    const snapshot = pendingHostSnapshot.value
    if (!snapshot || awaitingHostSyncAck) return
    socket.send(JSON.stringify({
      type: 'replace',
      legs: snapshot.legs,
      isFinished: snapshot.isFinished,
    }))
    awaitingHostSyncAck = true
  }

  const setPendingHostSnapshot = (snapshot: ItineraryState | null) => {
    pendingHostSnapshot.value = snapshot
    awaitingHostSyncAck = false
  }

  const whenHostSynced = () => {
    if (!pendingHostSnapshot.value) {
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      const stop = watch(pendingHostSnapshot, (snapshot) => {
        if (snapshot) return
        stop()
        resolve()
      }, { flush: 'sync' })
    })
  }

  const bind = (socket: CollabSocket) => {
    activeSocket = socket
    attachSender(socket)

    socket.addEventListener('open', () => {
      activeSocket = socket
      attachSender(socket)
      deps.setStatus('connected')
      sendHostSnapshotIfNeeded(socket)
    })

    socket.addEventListener('message', (event: MessageEvent | Event) => {
      if (!('data' in event) || typeof event.data !== 'string') return

      let parsed: unknown
      try {
        parsed = JSON.parse(event.data)
      }
      catch {
        return
      }

      if (!isRoomStateMessage(parsed)) return

      const snapshot = pendingHostSnapshot.value

      if (snapshot) {
        sendHostSnapshotIfNeeded(socket)
        if (awaitingHostSyncAck) {
          if (parsed.legs.length === 0 && snapshot.legs.length > 0) {
            return
          }
          pendingHostSnapshot.value = null
          awaitingHostSyncAck = false
        }
        else {
          return
        }
      }

      deps.applyRemoteState({
        legs: parsed.legs,
        isFinished: parsed.isFinished,
      })
    })

    socket.addEventListener('close', () => {
      if (activeSocket === socket) {
        deps.registerCollabSender(null)
        deps.setStatus('idle')
        activeSocket = null
        awaitingHostSyncAck = false
      }
    })

    socket.addEventListener('error', () => {
      deps.setStatus('error')
    })
  }

  const unbind = () => {
    // A session that never held a connection must not clear shared collab state:
    // Nuxt mounts the next page before unmounting the old one, so the outgoing
    // page would otherwise reset status/sender for the newer live session.
    const ownedConnection = activeSocket !== null
    activeSocket?.close()
    activeSocket = null
    awaitingHostSyncAck = false
    if (ownedConnection) {
      deps.registerCollabSender(null)
      deps.setStatus('idle')
    }
  }

  return {
    bind,
    unbind,
    setPendingHostSnapshot,
    whenHostSynced,
  }
}

type ShareRoomFlowDeps = {
  ensureRoomAndHostSnapshot: () => Promise<string>
  whenHostSynced: () => Promise<void>
  buildUrl: (roomId: string) => string
  copyUrl: (url: string) => Promise<void>
}

/** Host share: room id + snapshot first, clipboard only after snapshot is in the room. */
export const runShareRoomFlow = async (deps: ShareRoomFlowDeps) => {
  const id = await deps.ensureRoomAndHostSnapshot()
  await deps.whenHostSynced()
  const url = deps.buildUrl(id)
  try {
    await deps.copyUrl(url)
  }
  catch {
    // Clipboard may be denied.
  }
}
