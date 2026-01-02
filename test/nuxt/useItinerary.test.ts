import { describe, it, expect, beforeEach } from 'vitest'
import { useItinerary } from '#imports'

describe('useItinerary', () => {
  beforeEach(() => {
    const { reset } = useItinerary()
    reset()
  })

  it('setOrigin creates first leg', () => {
    const { setOrigin, legs, origin } = useItinerary()
    setOrigin('LHR', '01/01/2026', 51.47, -0.46)
    expect(legs.value).toHaveLength(1)
    expect(origin.value?.code).toBe('LHR')
  })

  it('addDestination appends leg', () => {
    const { setOrigin, addDestination, legs } = useItinerary()
    setOrigin('LHR', '01/01/2026', 51.47, -0.46)
    addDestination('CDG', '04/01/2026', 49.01, 2.55)
    expect(legs.value).toHaveLength(2)
  })

  it('undoLast removes last leg', () => {
    const { setOrigin, addDestination, undoLast, legs } = useItinerary()
    setOrigin('LHR', '01/01/2026', 51.47, -0.46)
    addDestination('CDG', '04/01/2026', 49.01, 2.55)
    undoLast()
    expect(legs.value).toHaveLength(1)
  })

  it('currentOrigin returns last leg code', () => {
    const { setOrigin, addDestination, currentOrigin } = useItinerary()
    setOrigin('LHR', '01/01/2026', 51.47, -0.46)
    addDestination('CDG', '04/01/2026', 49.01, 2.55)
    expect(currentOrigin.value).toBe('CDG')
  })
})
