import { describe, it, expect, beforeEach } from 'vitest'

describe('useItinerary collab bridge', () => {
  beforeEach(() => {
    const { reset, registerCollabSender } = useItinerary()
    registerCollabSender(null)
    reset()
  })

  it('sends ops through collab sender instead of writing cookies locally', () => {
    const { setOrigin, addDestination, legs, registerCollabSender } = useItinerary()
    const sent: unknown[] = []
    registerCollabSender(op => sent.push(op))

    setOrigin('LHR', '01/01/2026', 51.47, -0.46)
    addDestination('CDG', '04/01/2026', 49.01, 2.55)

    expect(legs.value).toHaveLength(0)
    expect(sent).toEqual([
      { type: 'setOrigin', code: 'LHR', date: '01/01/2026', lat: 51.47, lng: -0.46 },
      { type: 'addDestination', code: 'CDG', date: '04/01/2026', lat: 49.01, lng: 2.55 },
    ])
  })

  it('applyRemoteState mirrors room state into cookies', () => {
    const { applyRemoteState, legs, isFinished } = useItinerary()
    applyRemoteState({
      legs: [{ code: 'AMS', date: '10/02/2026', lat: 52.3, lng: 4.76 }],
      isFinished: true,
    })
    expect(legs.value).toHaveLength(1)
    expect(legs.value[0]?.code).toBe('AMS')
    expect(isFinished.value).toBe(true)
  })

  it('solo mode still mutates cookies when no sender is registered', () => {
    const { setOrigin, legs } = useItinerary()
    setOrigin('LHR', '01/01/2026', 51.47, -0.46)
    expect(legs.value).toHaveLength(1)
    expect(legs.value[0]?.code).toBe('LHR')
  })
})
