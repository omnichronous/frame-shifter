import { applyItineraryOp, type ItineraryOp, type ItineraryState, type Leg } from '../../shared/itineraryOps'

export type { Leg }

type CollabSender = (op: ItineraryOp) => void

export const useItinerary = () => {
  const legs = useCookie<Leg[]>('itinerary-legs', {
    default: () => [],
    watch: true,
    maxAge: 60 * 10,
  })

  const isFinished = useCookie<boolean>('itinerary-finished', {
    default: () => false,
    watch: true,
  })

  const collabSender = useState<CollabSender | null>('itinerary-collab-sender', () => null)

  const origin = computed(() => legs.value[0] ?? null)

  const isLoopClosed = computed(() => {
    const first = legs.value[0]
    const last = legs.value[legs.value.length - 1]
    if (!first || !last || legs.value.length < 2) return false
    return last.code === first.code
  })

  const currentOrigin = computed(() => {
    const lastLeg = legs.value[legs.value.length - 1]
    return lastLeg?.code ?? null
  })

  const currentOriginDate = computed(() => {
    const lastLeg = legs.value[legs.value.length - 1]
    return lastLeg?.date ?? null
  })

  const applyRemoteState = (state: ItineraryState) => {
    legs.value = state.legs.map(leg => ({ ...leg }))
    isFinished.value = state.isFinished
  }

  const getSnapshot = (): ItineraryState => ({
    legs: (legs.value ?? []).map(leg => ({ ...leg })),
    isFinished: Boolean(isFinished.value),
  })

  const registerCollabSender = (sender: CollabSender | null) => {
    collabSender.value = sender
  }

  /** One brain: reducer. Boundary: live → send op; solo → write cookies from result. */
  const dispatch = (op: ItineraryOp) => {
    if (collabSender.value) {
      collabSender.value(op)
      return
    }
    applyRemoteState(applyItineraryOp(getSnapshot(), op))
  }

  const setOrigin = (code: string, date: string, lat: number, lng: number) => {
    dispatch({ type: 'setOrigin', code, date, lat, lng })
  }

  const addDestination = (code: string, date: string, lat: number, lng: number) => {
    dispatch({ type: 'addDestination', code, date, lat, lng })
  }

  const updateCurrentOriginDate = (date: string) => {
    dispatch({ type: 'updateDate', date })
  }

  const markAsFinished = () => {
    dispatch({ type: 'finish' })
  }

  const clearFinished = () => {
    isFinished.value = false
  }

  const undoLast = () => {
    dispatch({ type: 'undo' })
  }

  const reset = () => {
    dispatch({ type: 'reset' })
  }

  return {
    legs: readonly(legs),
    origin,
    isLoopClosed,
    isFinished: readonly(isFinished),
    currentOrigin,
    currentOriginDate,
    setOrigin,
    addDestination,
    updateCurrentOriginDate,
    markAsFinished,
    clearFinished,
    undoLast,
    reset,
    applyRemoteState,
    getSnapshot,
    registerCollabSender,
  }
}
