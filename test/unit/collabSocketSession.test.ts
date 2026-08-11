import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import {
  createCollabSocketSession,
  runShareRoomFlow,
  type CollabSocket,
} from '../../app/utils/collabSocketSession'
import type { ItineraryOp, ItineraryState } from '../../shared/itineraryOps'

type Listener = (event: MessageEvent | Event) => void

const createMockSocket = () => {
  const listeners = new Map<string, Listener[]>()
  const sent: string[] = []

  const socket: CollabSocket & { emit: (type: string, event: MessageEvent | Event) => void; sent: string[] } = {
    sent,
    send: (data: string) => {
      sent.push(data)
    },
    addEventListener: (type: string, listener: Listener) => {
      const list = listeners.get(type) ?? []
      list.push(listener)
      listeners.set(type, list)
    },
    close: () => {
      socket.emit('close', new Event('close'))
    },
    emit: (type: string, event: MessageEvent | Event) => {
      for (const listener of listeners.get(type) ?? []) {
        listener(event)
      }
    },
  }

  return socket
}

describe('createCollabSocketSession', () => {
  it('still forwards mutator ops after a reconnect', () => {
    let sender: ((op: ItineraryOp) => void) | null = null
    const applyRemoteState = vi.fn()
    const setStatus = vi.fn()

    const session = createCollabSocketSession({
      registerCollabSender: (next) => {
        sender = next
      },
      applyRemoteState,
      setStatus,
      pendingHostSnapshot: ref<ItineraryState | null>(null),
    })

    const socket = createMockSocket()
    session.bind(socket)
    socket.emit('open', new Event('open'))

    expect(sender).not.toBeNull()
    sender!({ type: 'undo' })
    expect(socket.sent.some(payload => payload.includes('"type":"undo"'))).toBe(true)

    socket.sent.length = 0
    socket.emit('close', new Event('close'))
    socket.emit('open', new Event('open'))

    expect(sender).not.toBeNull()
    sender!({ type: 'addDestination', code: 'CDG', date: '04/01/2026', lat: 49.01, lng: 2.55 })
    expect(socket.sent.some(payload => payload.includes('"type":"addDestination"'))).toBe(true)
  })
})

describe('runShareRoomFlow', () => {
  it('copies the share URL only after the host snapshot has landed', async () => {
    const order: string[] = []
    let releaseSync!: () => void

    const flow = runShareRoomFlow({
      ensureRoomAndHostSnapshot: async () => {
        order.push('ensure')
        return 'room1'
      },
      whenHostSynced: () => new Promise<void>((resolve) => {
        releaseSync = () => {
          order.push('synced')
          resolve()
        }
      }),
      buildUrl: roomId => `https://example.test/map?room=${roomId}`,
      copyUrl: async () => {
        order.push('copy')
      },
    })

    await Promise.resolve()
    expect(order).toEqual(['ensure'])

    releaseSync()
    await flow
    expect(order).toEqual(['ensure', 'synced', 'copy'])
  })
})

describe('createCollabSocketSession across a page remount', () => {
  it('seeds the room from a snapshot set by the previous page instance', () => {
    const pendingHostSnapshot = ref<ItineraryState | null>(null)
    const legs = [{ code: 'DUB', date: '01/01/2026', lat: 53.42, lng: -6.27 }]
    const deps = {
      registerCollabSender: vi.fn(),
      applyRemoteState: vi.fn(),
      setStatus: vi.fn(),
      pendingHostSnapshot,
    }

    // Share starts on the page instance that is about to be replaced.
    createCollabSocketSession(deps).setPendingHostSnapshot({ legs, isFinished: false })

    // Adding `?room=` mounts a new page, so a new session owns the connection.
    const remounted = createCollabSocketSession({ ...deps })
    const socket = createMockSocket()
    remounted.bind(socket)
    socket.emit('open', new Event('open'))

    expect(socket.sent.some(payload => payload.includes('"type":"replace"'))).toBe(true)

    // The empty bootstrap of the brand-new room must not overwrite local legs.
    socket.emit(
      'message',
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'state', legs: [], isFinished: false }),
      }),
    )
    expect(deps.applyRemoteState).not.toHaveBeenCalled()
  })
})

describe('createCollabSocketSession host sync', () => {
  it('whenHostSynced resolves after the host snapshot message, not the empty bootstrap', async () => {
    const session = createCollabSocketSession({
      registerCollabSender: vi.fn(),
      applyRemoteState: vi.fn(),
      setStatus: vi.fn(),
      pendingHostSnapshot: ref<ItineraryState | null>(null),
    })

    session.setPendingHostSnapshot({
      legs: [{ code: 'LHR', date: '01/01/2026', lat: 51.47, lng: -0.46 }],
      isFinished: false,
    })

    const socket = createMockSocket()
    session.bind(socket)
    socket.emit('open', new Event('open'))

    let synced = false
    const wait = session.whenHostSynced().then(() => {
      synced = true
    })

    socket.emit(
      'message',
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'state', legs: [], isFinished: false }),
      }),
    )
    await Promise.resolve()
    expect(synced).toBe(false)

    socket.emit(
      'message',
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'state',
          legs: [{ code: 'LHR', date: '01/01/2026', lat: 51.47, lng: -0.46 }],
          isFinished: false,
        }),
      }),
    )
    await wait
    expect(synced).toBe(true)
  })
})
