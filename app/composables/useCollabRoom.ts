import PartySocket from 'partysocket'
import type { ItineraryState } from '../../shared/itineraryOps'
import {
  createCollabSocketSession,
  runShareRoomFlow,
  type CollabConnectionStatus,
} from '../utils/collabSocketSession'

const createRoomId = () => crypto.randomUUID().replaceAll('-', '').slice(0, 10)

export const useCollabRoom = () => {
  const route = useRoute()
  const router = useRouter()
  const config = useRuntimeConfig()
  const { applyRemoteState, getSnapshot, registerCollabSender } = useItinerary()

  const connectionStatus = useState<CollabConnectionStatus>(
    'collab-connection-status',
    () => 'idle',
  )

  // Shared so it outlives the page remount that adding `?room=` triggers: the
  // freshly mounted session seeds the room instead of wiping local legs.
  const pendingHostSnapshot = useState<ItineraryState | null>(
    'collab-pending-host-snapshot',
    () => null,
  )

  const roomId = computed(() => {
    const value = route.query.room
    return typeof value === 'string' && value.length > 0 ? value : null
  })

  const isLive = computed(() => connectionStatus.value === 'connected')

  const session = createCollabSocketSession({
    registerCollabSender,
    applyRemoteState,
    setStatus: (status) => {
      connectionStatus.value = status
    },
    pendingHostSnapshot,
  })

  const socketRef = shallowRef<PartySocket | null>(null)

  const disconnect = () => {
    session.unbind()
    socketRef.value = null
  }

  const connect = (id: string) => {
    if (!import.meta.client) return

    const host = config.public.collabHost
    if (!host || typeof host !== 'string') {
      connectionStatus.value = 'error'
      return
    }

    disconnect()
    connectionStatus.value = 'connecting'

    // PartyServer routePartykitRequest: binding ItineraryRoom → party "itinerary-room"
    const socket = new PartySocket({
      host,
      party: 'itinerary-room',
      room: id,
    })
    socketRef.value = socket
    session.bind(socket)
  }

  watch(
    roomId,
    (id) => {
      if (id) {
        connect(id)
      }
      else {
        session.setPendingHostSnapshot(null)
        disconnect()
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    disconnect()
  })

  const shareRoom = async () => {
    if (!import.meta.client) return

    await runShareRoomFlow({
      ensureRoomAndHostSnapshot: async () => {
        const id = roomId.value ?? createRoomId()
        if (!roomId.value) {
          session.setPendingHostSnapshot(getSnapshot())
          await router.push({
            query: {
              ...route.query,
              room: id,
            },
          })
        }
        return id
      },
      whenHostSynced: () => session.whenHostSynced(),
      buildUrl: (id) => {
        const url = new URL(window.location.href)
        url.searchParams.set('room', id)
        return url.toString()
      },
      copyUrl: async (url) => {
        await navigator.clipboard.writeText(url)
      },
    })
  }

  return {
    roomId,
    isLive,
    connectionStatus: readonly(connectionStatus),
    shareRoom,
  }
}
