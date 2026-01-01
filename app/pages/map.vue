<script setup lang="ts">
import { addDays, format, parse, subDays } from 'date-fns'
import type { AirportWithPrices } from '~/composables/useAPI'
import type { Leg } from '~/composables/useItinerary'

type LngLat = [number, number]

// Date state - HTML input uses YYYY-MM-DD format
const date = ref('2026-01-29')

// Convert to/from API format (DD/MM/YYYY)
const dateForApi = computed(() => {
  const parsed = parse(date.value, 'yyyy-MM-dd', new Date())
  return format(parsed, 'dd/MM/yyyy')
})

const MARKER_BASE_CLASS = 'rounded-full transition-transform hover:scale-110 cursor-pointer shadow-md border-2 border-white'
const MARKER_PRICE_CLASS = 'px-2 py-1 text-xs font-semibold whitespace-nowrap'
const MARKER_DOT_CLASS = 'w-4 h-4'
const MARKER_ORIGIN_CLASS = 'w-6 h-6 bg-green-600 ring-4 ring-green-200'
const MARKER_ACTIVE_CLASS = 'bg-orange-600'
const MARKER_DEFAULT_CLASS = 'bg-blue-500 text-white'

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
    date: dateForApi.value,
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
      dateForApi.value,
      airport.lat,
      airport.long
    )
  } else {
    addDestination(
      airport.code,
      dateForApi.value,
      airport.lat,
      airport.long
    )
    // Add 3 days for next destination
    const currentDate = parse(date.value, 'yyyy-MM-dd', new Date())
    const newDate = addDays(currentDate, 3)
    date.value = format(newDate, 'yyyy-MM-dd')
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

const canFinish = computed(() => legs.value.length >= 2)

const pathAirportCodes = computed(() => new Set(legs.value.map(leg => leg.code)))

const isSelected = (airport: AirportWithPrices) => {
  return origin.value?.code === airport.code || pathAirportCodes.value.has(airport.code)
}

const getMarkerClass = (airport: AirportWithPrices) => {
  if (origin.value?.code === airport.code) return MARKER_ORIGIN_CLASS
  if (pathAirportCodes.value.has(airport.code)) return MARKER_ACTIVE_CLASS
  return MARKER_DEFAULT_CLASS
}

const formatPrice = (price: number): string => {
  if (price === 0) return '€0'
  if (price >= 1000) return `€${(price / 1000).toFixed(1)}k`
  return `€${price}`
}

// Split airports for z-index: unselected first, then selected (on top)
const unselectedAirports = computed(() => 
  availableAirports.value.filter(a => !isSelected(a))
)

const selectedAirports = computed(() => 
  availableAirports.value.filter(a => isSelected(a))
)

// Custom undo that also reverts the date
const handleUndo = () => {
  if (!canUndo.value) return
  
  // If undoing a destination (not the origin), subtract 3 days
  if (legs.value.length > 1) {
    const currentDate = parse(date.value, 'yyyy-MM-dd', new Date())
    const newDate = subDays(currentDate, 3)
    date.value = format(newDate, 'yyyy-MM-dd')
  }
  
  undoLast()
}

// Keyboard shortcuts
onMounted(() => {
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Backspace' && canUndo.value) {
      handleUndo()
    }
  }
  window.addEventListener('keydown', handleKeydown)
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
})
</script>

<template>
  <ClientOnly>
    <div class="relative h-screen w-full">
      <!-- Header -->
      <header class="fixed top-0 left-0 right-0 z-50 bg-white shadow-md">
        <div class="flex items-center gap-3 px-4 py-3">
          <div class="flex-1">
            <label class="block text-xs text-gray-600 mb-1">Flying out of</label>
            <input
              type="text"
              :value="currentOrigin || 'Select origin'"
              readonly
              class="w-full h-10 px-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 text-sm"
            >
          </div>
          <div class="flex-1">
            <label class="block text-xs text-gray-600 mb-1">on</label>
            <input
              v-model="date"
              type="date"
              class="w-full h-10 px-3 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
            >
          </div>
        </div>
      </header>

      <MglMap map-style="https://demotiles.maplibre.org/style.json" :center="[0, 0]" :zoom="2">
      <!-- Unselected markers (with prices) -->
      <MglMarker
        v-for="airport in unselectedAirports" :key="airport.code"
        :coordinates="[airport.long, airport.lat]">
        <template #marker>
          <button
            :class="[MARKER_BASE_CLASS, MARKER_PRICE_CLASS, MARKER_DEFAULT_CLASS]"
            class="!z-10"
            @click.stop="onMarkerClick(airport)"
          >
            {{ formatPrice(airport.price) }}
          </button>
        </template>
      </MglMarker>

      <!-- Selected markers (dots, rendered on top) -->
      <MglMarker
        v-for="airport in selectedAirports" :key="`selected-${airport.code}`"
        :coordinates="[airport.long, airport.lat]">
        <template #marker>
          <button
            :class="[MARKER_BASE_CLASS, MARKER_DOT_CLASS, getMarkerClass(airport)]"
            class="!z-20"
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
            @click="handleUndo"
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
            class="flex-1 h-11 rounded-lg bg-orange-600 text-white font-medium text-base active:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canFinish"
            @click="navigateTo('/bookings')"
          >
            Finish
          </button>
        </div>
      </footer>
    </div>
  </ClientOnly>
</template>