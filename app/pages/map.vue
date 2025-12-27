<script setup lang="ts">
import type { AirportWithPrices } from '~/composables/useAPI'
import type { Leg } from '~/composables/useItinerary'

type LngLat = [number, number]

const date = '29/01/2026'

const MARKER_BASE_CLASS = 'rounded-full transition-transform hover:scale-110 cursor-pointer shadow-md border-2 border-white'
const MARKER_ORIGIN_CLASS = 'w-6 h-6 bg-green-600 ring-4 ring-green-200'
const MARKER_ACTIVE_CLASS = 'w-4 h-4 bg-orange-600'
const MARKER_DEFAULT_CLASS = 'w-4 h-4 bg-blue-500'

const { legs, origin, currentOrigin, setOrigin, addDestination, undoLast } = useItinerary()

const createAirportFromLeg = (leg: Leg): AirportWithPrices => ({
  code: leg.code,
  name: leg.code,
  price: 0,
  lat: leg.lat,
  long: leg.lng
})

// Fetch destinations based on current origin
const { data: destinations } = await useAPI('/flights', {
  server: false,
  query: computed(() => ({
    origin: currentOrigin.value ?? 'DUB',
    date,
  })),
})

// Combine destinations from API with airports from the current path
const availableAirports = computed(() => {
  const destinationsFromApi = destinations.value ?? []
  const destinationCodes = new Set(destinationsFromApi.map(a => a.code))
  
  const additionalPathAirports = legs.value
    .filter(leg => !destinationCodes.has(leg.code))
    .map(createAirportFromLeg)
  
  return [...destinationsFromApi, ...additionalPathAirports]
})

const onMarkerClick = (airport: AirportWithPrices) => {
  if (!origin.value) {
    setOrigin(
      airport.code,
      date,
      airport.lat,
      airport.long
    )
  } else {
    addDestination(
      airport.code,
      date,
      airport.lat,
      airport.long
    )
  }
}

// GeoJSON LineString from legs
const pathGeoJson = computed(() => {
  const coordinates: LngLat[] = legs.value.map((leg: Leg) => [leg.lng, leg.lat])

  return {
    type: 'FeatureCollection' as const,
    features: coordinates.length < 2
      ? []
      : [{
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates
          },
          properties: {}
        }]
  }
})

const canUndo = computed(() => legs.value.length > 0)

const pathAirportCodes = computed(() => new Set(legs.value.map(leg => leg.code)))

const getMarkerClass = (airport: AirportWithPrices) => {
  if (origin.value?.code === airport.code) return MARKER_ORIGIN_CLASS
  if (pathAirportCodes.value.has(airport.code)) return MARKER_ACTIVE_CLASS
  return MARKER_DEFAULT_CLASS
}

// Keyboard shortcuts
onMounted(() => {
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Backspace' && canUndo.value) {
      undoLast()
    }
  }
  window.addEventListener('keydown', handleKeydown)
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
})
</script>

<template>
  <ClientOnly>
    <div class="relative h-screen w-full">
      <MglMap map-style="https://demotiles.maplibre.org/style.json" :center="[0, 0]" :zoom="2">
      <MglMarker
        v-for="airport in availableAirports" :key="airport.code"
        :coordinates="[airport.long, airport.lat]">
        <template #marker>
          <button
            :class="[MARKER_BASE_CLASS, getMarkerClass(airport)]"
            @click.stop="onMarkerClick(airport)"
          />
        </template>
      </MglMarker>

      <!-- Path between clicked markers -->
      <MglGeoJsonSource source-id="clicked-path" :data="pathGeoJson">
        <MglLineLayer
          layer-id="clicked-path"
          :layout="{ 'line-cap': 'round', 'line-join': 'round' }"
          :paint="{
            'line-color': '#ff6200',
            'line-width': 3
          }"
        />
      </MglGeoJsonSource>
      </MglMap>

      <!-- Bottom Sheet Footer -->
      <footer class="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-lg">
        <div class="flex items-center justify-between gap-4 px-4 py-4">
          <button
            type="button"
            class="flex-1 h-11 rounded-lg bg-gray-100 text-gray-700 font-medium text-base active:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canUndo"
            @click="undoLast"
          >
            Undo
          </button>
          <!-- <button
            type="button"
            class="flex-1 h-11 rounded-lg bg-gray-100 text-gray-700 font-medium text-base active:bg-gray-200 transition-colors"
          >
            Add
          </button> -->
          <button
            type="button"
            class="flex-1 h-11 rounded-lg bg-orange-600 text-white font-medium text-base active:bg-orange-700 transition-colors"
          >
            Finish
          </button>
        </div>
      </footer>
    </div>
  </ClientOnly>
</template>