import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useItinerary } from '#imports'
import MapPage from '~/pages/map.vue'

// Mock useAPI composable with proper ref import
vi.mock('~/composables/useAPI', async () => {
  const { ref } = await import('vue')
  return {
    useAPI: vi.fn(() => ({
      data: ref([]),
      execute: vi.fn(),
    })),
  }
})

describe('map.vue', () => {
  beforeEach(() => {
    const { reset } = useItinerary()
    reset()
  })

  it('Undo button disabled when no legs', async () => {
    const wrapper = await mountSuspended(MapPage)
    const buttons = wrapper.findAll('button')
    const undoBtn = buttons.find(btn => btn.text().includes('Undo'))
    expect(undoBtn?.exists()).toBe(true)
    expect(undoBtn!.attributes('disabled')).toBeDefined()
  })

  it('Undo button enabled after setting origin', async () => {
    const { setOrigin } = useItinerary()
    setOrigin('LHR', '01/01/2026', 51.47, -0.46)
    
    const wrapper = await mountSuspended(MapPage)
    const buttons = wrapper.findAll('button')
    const undoBtn = buttons.find(btn => btn.text().includes('Undo'))
    expect(undoBtn?.exists()).toBe(true)
    expect(undoBtn!.attributes('disabled')).toBeUndefined()
  })

  it('Finish button disabled with less than 2 legs', async () => {
    const wrapper = await mountSuspended(MapPage)
    const buttons = wrapper.findAll('button')
    const finishBtn = buttons.find(btn => btn.text().includes('Finish'))
    expect(finishBtn?.exists()).toBe(true)
    expect(finishBtn!.attributes('disabled')).toBeDefined()
  })

  it('Finish button enabled with 2 or more legs', async () => {
    const { setOrigin, addDestination } = useItinerary()
    setOrigin('LHR', '01/01/2026', 51.47, -0.46)
    addDestination('CDG', '04/01/2026', 49.01, 2.55)
    
    const wrapper = await mountSuspended(MapPage)
    const buttons = wrapper.findAll('button')
    const finishBtn = buttons.find(btn => btn.text().includes('Finish'))
    expect(finishBtn?.exists()).toBe(true)
    expect(finishBtn!.attributes('disabled')).toBeUndefined()
  })

  it('shows search input when no origin set', async () => {
    const wrapper = await mountSuspended(MapPage)
    const searchInput = wrapper.find('input[placeholder="Search airports..."]')
    expect(searchInput.exists()).toBe(true)
  })

  it('shows readonly input when origin is set', async () => {
    const { setOrigin } = useItinerary()
    setOrigin('LHR', '01/01/2026', 51.47, -0.46)
    
    const wrapper = await mountSuspended(MapPage)
    const readonlyInput = wrapper.find('input[readonly]')
    expect(readonlyInput.exists()).toBe(true)
    expect((readonlyInput.element as HTMLInputElement).value).toBe('LHR')
  })
})
