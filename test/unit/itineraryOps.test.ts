import { describe, it, expect } from 'vitest'
import {
  applyItineraryOp,
  emptyItineraryState,
  isItineraryOp,
  type ItineraryState,
} from '../../shared/itineraryOps'

const withOrigin = (): ItineraryState =>
  applyItineraryOp(emptyItineraryState(), {
    type: 'setOrigin',
    code: 'LHR',
    date: '01/01/2026',
    lat: 51.47,
    lng: -0.46,
  })

describe('applyItineraryOp', () => {
  it('setOrigin creates first leg', () => {
    const next = withOrigin()
    expect(next.legs).toHaveLength(1)
    expect(next.legs[0]?.code).toBe('LHR')
    expect(next.isFinished).toBe(false)
  })

  it('addDestination appends a leg', () => {
    const next = applyItineraryOp(withOrigin(), {
      type: 'addDestination',
      code: 'CDG',
      date: '04/01/2026',
      lat: 49.01,
      lng: 2.55,
    })
    expect(next.legs.map(l => l.code)).toEqual(['LHR', 'CDG'])
  })

  it('updateDate changes only the last leg', () => {
    const twoLegs = applyItineraryOp(withOrigin(), {
      type: 'addDestination',
      code: 'CDG',
      date: '04/01/2026',
      lat: 49.01,
      lng: 2.55,
    })
    const next = applyItineraryOp(twoLegs, { type: 'updateDate', date: '05/01/2026' })
    expect(next.legs[0]?.date).toBe('01/01/2026')
    expect(next.legs[1]?.date).toBe('05/01/2026')
  })

  it('undo removes last leg and clears finished', () => {
    const finished = applyItineraryOp(
      applyItineraryOp(withOrigin(), {
        type: 'addDestination',
        code: 'CDG',
        date: '04/01/2026',
        lat: 49.01,
        lng: 2.55,
      }),
      { type: 'finish' },
    )
    const next = applyItineraryOp(finished, { type: 'undo' })
    expect(next.legs).toHaveLength(1)
    expect(next.isFinished).toBe(false)
  })

  it('rejects mutating ops while finished', () => {
    const finished = applyItineraryOp(withOrigin(), { type: 'finish' })
    const next = applyItineraryOp(finished, {
      type: 'addDestination',
      code: 'CDG',
      date: '04/01/2026',
      lat: 49.01,
      lng: 2.55,
    })
    expect(next).toEqual(finished)
  })

  it('replace sets full state', () => {
    const next = applyItineraryOp(emptyItineraryState(), {
      type: 'replace',
      legs: [{ code: 'AMS', date: '10/02/2026', lat: 52.3, lng: 4.76 }],
      isFinished: true,
    })
    expect(next.legs[0]?.code).toBe('AMS')
    expect(next.isFinished).toBe(true)
  })

  it('reset clears everything', () => {
    const next = applyItineraryOp(withOrigin(), { type: 'reset' })
    expect(next).toEqual(emptyItineraryState())
  })
})

describe('isItineraryOp', () => {
  it('accepts valid ops and rejects junk', () => {
    expect(isItineraryOp({ type: 'undo' })).toBe(true)
    expect(isItineraryOp({ type: 'nope' })).toBe(false)
    expect(isItineraryOp(null)).toBe(false)
  })
})
