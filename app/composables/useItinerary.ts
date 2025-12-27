export interface Leg {
  code: string
  date: string
  lat: number
  lng: number
}

export const useItinerary = () => {
  const legs = useState<Leg[]>('itinerary-legs', () => [])

  const origin = computed(() => legs.value[0] ?? null)

  const currentOrigin = computed(() => {
    const lastLeg = legs.value[legs.value.length - 1]
    return lastLeg?.code ?? null
  })

  const setOrigin = (code: string, date: string, lat: number, lng: number) => {
    legs.value = [{ code, date, lat, lng }]
  }

  const addDestination = (code: string, date: string, lat: number, lng: number) => {
    legs.value.push({ code, date, lat, lng })
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
    currentOrigin,
    setOrigin,
    addDestination,
    undoLast,
    reset,
  }
}

