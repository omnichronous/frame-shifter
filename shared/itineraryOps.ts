export interface Leg {
  code: string
  date: string
  lat: number
  lng: number
}

export interface ItineraryState {
  legs: Leg[]
  isFinished: boolean
}

export type ItineraryOp =
  | { type: 'setOrigin'; code: string; date: string; lat: number; lng: number }
  | { type: 'addDestination'; code: string; date: string; lat: number; lng: number }
  | { type: 'updateDate'; date: string }
  | { type: 'undo' }
  | { type: 'finish' }
  | { type: 'reset' }
  | { type: 'replace'; legs: Leg[]; isFinished: boolean }

export const emptyItineraryState = (): ItineraryState => ({
  legs: [],
  isFinished: false,
})

const isLeg = (value: unknown): value is Leg => {
  if (typeof value !== 'object' || value === null) return false
  const leg = value as Record<string, unknown>
  return (
    typeof leg.code === 'string'
    && typeof leg.date === 'string'
    && typeof leg.lat === 'number'
    && typeof leg.lng === 'number'
  )
}

export type RoomStateMessage = {
  type: 'state'
  legs: Leg[]
  isFinished: boolean
}

export const isRoomStateMessage = (value: unknown): value is RoomStateMessage => {
  if (typeof value !== 'object' || value === null) return false
  const message = value as Record<string, unknown>
  return (
    message.type === 'state'
    && Array.isArray(message.legs)
    && message.legs.every(isLeg)
    && typeof message.isFinished === 'boolean'
  )
}

export const isItineraryOp = (value: unknown): value is ItineraryOp => {
  if (typeof value !== 'object' || value === null) return false
  const op = value as Record<string, unknown>
  if (typeof op.type !== 'string') return false

  switch (op.type) {
    case 'setOrigin':
    case 'addDestination':
      return (
        typeof op.code === 'string'
        && typeof op.date === 'string'
        && typeof op.lat === 'number'
        && typeof op.lng === 'number'
      )
    case 'updateDate':
      return typeof op.date === 'string'
    case 'undo':
    case 'finish':
    case 'reset':
      return true
    case 'replace':
      return Array.isArray(op.legs) && op.legs.every(isLeg) && typeof op.isFinished === 'boolean'
    default:
      return false
  }
}

/**
 * Pure reducer for itinerary ops. When finished, only undo/reset/replace apply.
 * Returns the previous state unchanged for rejected ops.
 */
export const applyItineraryOp = (
  state: ItineraryState,
  op: ItineraryOp,
): ItineraryState => {
  if (state.isFinished && op.type !== 'undo' && op.type !== 'reset' && op.type !== 'replace') {
    return state
  }

  switch (op.type) {
    case 'setOrigin':
      return {
        legs: [{ code: op.code, date: op.date, lat: op.lat, lng: op.lng }],
        isFinished: false,
      }
    case 'addDestination':
      return {
        legs: [...state.legs, { code: op.code, date: op.date, lat: op.lat, lng: op.lng }],
        isFinished: false,
      }
    case 'updateDate': {
      if (state.legs.length === 0) return state
      const legs = state.legs.map((leg, index) =>
        index === state.legs.length - 1 ? { ...leg, date: op.date } : leg,
      )
      return { ...state, legs }
    }
    case 'undo': {
      if (state.legs.length === 0) {
        return { legs: [], isFinished: false }
      }
      return {
        legs: state.legs.slice(0, -1),
        isFinished: false,
      }
    }
    case 'finish':
      return { ...state, isFinished: true }
    case 'reset':
      return emptyItineraryState()
    case 'replace':
      return {
        legs: op.legs.map(leg => ({ ...leg })),
        isFinished: op.isFinished,
      }
  }
}
