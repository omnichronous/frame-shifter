import { describe, it, expect } from 'vitest'
import { formatPrice } from '../../app/utils/formatPrice'

describe('formatPrice', () => {
  it('returns €0 for zero', () => expect(formatPrice(0)).toBe('€0'))
  it('returns €500 for 500', () => expect(formatPrice(500)).toBe('€500'))
  it('returns €1.5k for 1500', () => expect(formatPrice(1500)).toBe('€1.5k'))
  it('returns €2.0k for 2000', () => expect(formatPrice(2000)).toBe('€2.0k'))
})
