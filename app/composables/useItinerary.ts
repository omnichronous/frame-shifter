export interface Leg {
  code: string
  date: string
  lat: number
  lng: number
}

export const useItinerary = () => {
  const legs = useCookie<Leg[]>('itinerary-legs', {
    default: () => [],
    watch: true,
  })

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

  const setOrigin = (code: string, date: string, lat: number, lng: number) => {
    legs.value = [{ code, date, lat, lng }]
  }

  const addDestination = (code: string, date: string, lat: number, lng: number) => {
    legs.value.push({ code, date, lat, lng })
  }

  const updateCurrentOriginDate = (date: string) => {
    const lastLeg = legs.value[legs.value.length - 1]
    if (lastLeg) {
      lastLeg.date = date
    }
  }

  const undoLast = () => {
    if (legs.value.length > 0) {
      legs.value.pop()
    }
  }

  const reset = () => {
    legs.value = []
  }

  return {
    legs: readonly(legs),
    origin,
    isLoopClosed,
    currentOrigin,
    currentOriginDate,
    setOrigin,
    addDestination,
    updateCurrentOriginDate,
    undoLast,
    reset,
  }
}

