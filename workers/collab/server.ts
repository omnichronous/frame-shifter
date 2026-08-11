import { routePartykitRequest, Server, type Connection } from 'partyserver'
import {
  applyItineraryOp,
  emptyItineraryState,
  isItineraryOp,
  type ItineraryState,
  type Leg,
} from '../../shared/itineraryOps'

export type Env = {
  ItineraryRoom: DurableObjectNamespace<ItineraryRoom>
}

const STORAGE_KEY = 'itinerary'

const isItineraryState = (value: unknown): value is ItineraryState => {
  if (typeof value !== 'object' || value === null) return false
  const state = value as Record<string, unknown>
  if (!Array.isArray(state.legs) || typeof state.isFinished !== 'boolean')
    return false
  return state.legs.every((leg): leg is Leg => {
    if (typeof leg !== 'object' || leg === null) return false
    const row = leg as Record<string, unknown>
    return (
      typeof row.code === 'string' &&
      typeof row.date === 'string' &&
      typeof row.lat === 'number' &&
      typeof row.lng === 'number'
    )
  })
}

const stateMessage = (state: ItineraryState) =>
  JSON.stringify({
    type: 'state',
    legs: state.legs,
    isFinished: state.isFinished,
  })

export class ItineraryRoom extends Server<Env> {
  static options = { hibernate: true }

  state: ItineraryState = emptyItineraryState()

  async onStart() {
    const stored = await this.ctx.storage.get(STORAGE_KEY)
    if (isItineraryState(stored)) {
      this.state = stored
    }
  }

  onConnect(connection: Connection) {
    connection.send(stateMessage(this.state))
  }

  async onMessage(_connection: Connection, message: string | ArrayBuffer) {
    if (typeof message !== 'string') return

    let parsed: unknown
    try {
      parsed = JSON.parse(message)
    } catch {
      return
    }

    if (!isItineraryOp(parsed)) return

    this.state = applyItineraryOp(this.state, parsed)
    await this.ctx.storage.put(STORAGE_KEY, this.state)
    this.broadcast(stateMessage(this.state))
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ??
      new Response('Not Found', { status: 404 })
    )
  },
} satisfies ExportedHandler<Env>
