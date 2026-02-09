<script setup lang="ts">
import { addDays, format, parse } from 'date-fns'
import type { Map } from 'maplibre-gl'

definePageMeta({
  alias: '/'
})

type LngLat = [number, number]

// Date state before origin is set
const pendingDate = ref('2026-01-29')

const MARKER_BASE_CLASS = 'rounded-full transition-transform hover:scale-110 cursor-pointer shadow-md border-2 border-white'
const MARKER_PRICE_CLASS = 'px-2 py-1 text-xs font-semibold whitespace-nowrap'
const MARKER_DOT_CLASS = 'w-4 h-4'
const MARKER_ORIGIN_CLASS = 'w-6 h-6 bg-green-600 ring-4 ring-green-200'
const MARKER_ACTIVE_CLASS = 'bg-orange-600'
const MARKER_DEFAULT_CLASS = 'bg-blue-500 text-white'

const { legs, origin, currentOrigin, currentOriginDate, setOrigin, addDestination, updateCurrentOriginDate, undoLast } = useItinerary()

// Map instance reference
const mapInstance = ref<Map | null>(null)

// Initial map center - must be a constant to maintain reference stability.
// Using [1.5, 51] inline would create a new array on every render,
// causing Vue to see it as a prop change and reset the map position.
const INITIAL_MAP_CENTER: [number, number] = [1.5, 51]

// Handler for map load event
const onMapLoad = (event: { map: Map }) => {
  mapInstance.value = event.map
  
  // Expose map instance for E2E testing
  if (process.dev || import.meta.env.MODE === 'test') {
    (window as any).__mapInstance = event.map
  }
}

// Writable computed that reads/writes date from legs or pendingDate
const currentDate = computed({
  get: () => {
    if (!currentOriginDate.value) {
      return pendingDate.value
    }
    // Convert from API format (DD/MM/YYYY) to HTML input format (YYYY-MM-DD)
    const parsed = parse(currentOriginDate.value, 'dd/MM/yyyy', new Date())
    return format(parsed, 'yyyy-MM-dd')
  },
  set: (value: string) => {
    // Convert from HTML input format (YYYY-MM-DD) to API format (DD/MM/YYYY)
    const parsed = parse(value, 'yyyy-MM-dd', new Date())
    const apiFormat = format(parsed, 'dd/MM/yyyy')
    
    if (!currentOriginDate.value) {
      pendingDate.value = value
    } else {
      updateCurrentOriginDate(apiFormat)
    }
  }
})

// Convert current date to API format for queries
const dateForApi = computed(() => {
  if (!currentOriginDate.value) {
    const parsed = parse(pendingDate.value, 'yyyy-MM-dd', new Date())
    return format(parsed, 'dd/MM/yyyy')
  }
  return currentOriginDate.value
})

const createAirportFromLeg = (leg: Leg): AirportWithPrices => ({
  code: leg.code,
  name: leg.code,
  price: 0,
  lat: leg.lat,
  long: leg.lng
})

// Airport search for origin selector
interface AirportOption {
  code: string
  name: string
  lat: number
  lng: number
  municipality: string
  country: string
}

const searchQuery = ref('')
const showAirportDropdown = ref(false)

const { data: airportOptions } = useFetch<AirportOption[]>('/api/airports', {
  query: computed(() => ({ q: searchQuery.value })),
  server: false,
})

const onAirportSelect = (airport: AirportOption) => {
  setOrigin(airport.code, dateForApi.value, airport.lat, airport.lng)
  searchQuery.value = ''
  showAirportDropdown.value = false
  // Watch will trigger fetchDestinations
}

const formatAirportOption = (airport: AirportOption) => {
  return `${airport.code} - ${airport.name}${airport.municipality ? `, ${airport.municipality}` : ''} (${airport.country})`
}

const handleSearchBlur = () => {
  // Delay hiding dropdown to allow click events to fire
  window.setTimeout(() => {
    showAirportDropdown.value = false
  }, 200)
}

// Fetch destinations based on current origin (only when origin is set)
const { data: destinations, execute: fetchDestinations } = await useAPI('/flights', {
  server: false,
  query: computed(() => ({
    origin: currentOrigin.value,
    date: dateForApi.value,
  })),
  immediate: !!currentOrigin.value,
  watch: false,
})

// Watch for date/origin changes and refetch destinations
watch([currentOrigin, currentOriginDate], ([newOrigin, newDate]) => {
  if (newOrigin && newDate) {
    fetchDestinations()
  }
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
    // Watch will trigger fetchDestinations
  } else {
    // Calculate new date (+3 days) and add destination in one atomic operation
    const parsedDate = parse(currentDate.value, 'yyyy-MM-dd', new Date())
    const newDate = addDays(parsedDate, 3)
    const newDateApi = format(newDate, 'dd/MM/yyyy')
    
    addDestination(
      airport.code,
      newDateApi,
      airport.lat,
      airport.long
    )
    // Watch will trigger fetchDestinations
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

// Split airports for z-index: unselected first, then selected (on top)
const unselectedAirports = computed(() => 
  availableAirports.value.filter(a => !isSelected(a))
)

const selectedAirports = computed(() => 
  availableAirports.value.filter(a => isSelected(a))
)

// Undo - removing leg automatically reverts its date
const handleUndo = () => {
  if (!canUndo.value) return
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

// Pan to last selected marker
watch(legs, (newLegs) => {
  const lastLeg = newLegs[newLegs.length - 1]
  if (lastLeg && mapInstance.value) {
    mapInstance.value.flyTo({
      center: [lastLeg.lng, lastLeg.lat],
      duration: 800
    })
  }
})
</script>

<template>
  <ClientOnly>
    <div class="relative h-screen w-full overflow-hidden">
      <!-- Header -->
      <header class="fixed top-0 left-0 right-0 z-50 bg-white shadow-md">
        <div class="flex items-center gap-3 px-4 py-3">
          <div class="flex-1 relative">
            <label class="block text-xs text-gray-600 mb-1">Flying out of</label>
            <div class="relative">
              <input
                v-if="!currentOrigin"
                v-model="searchQuery"
                type="text"
                placeholder="Search airports..."
                class="w-full h-10 px-3 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                @focus="showAirportDropdown = true"
                @blur="handleSearchBlur"
              >
              <input
                v-else
                type="text"
                :value="currentOrigin"
                readonly
                class="w-full h-10 px-3 pr-10 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 text-sm"
              >
              <button
                v-if="currentOrigin"
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                @click="undoLast()"
              >
                ✕
              </button>
            </div>
            
            <!-- Airport dropdown -->
            <div
              v-if="showAirportDropdown && !currentOrigin && airportOptions?.length"
              class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50"
            >
              <button
                v-for="airport in airportOptions"
                :key="airport.code"
                type="button"
                class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 active:bg-gray-200 transition-colors"
                @mousedown.prevent="onAirportSelect(airport)"
              >
                {{ formatAirportOption(airport) }}
              </button>
            </div>
          </div>
          <div class="flex-1">
            <label class="block text-xs text-gray-600 mb-1">on</label>
            <input
              v-model="currentDate"
              type="date"
              class="w-full h-10 px-3 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
            >
          </div>
        </div>
      </header>

      <MglMap map-style="https://demotiles.maplibre.org/style.json" :center="INITIAL_MAP_CENTER" :zoom="4" @map:load="onMapLoad">
      
      <!-- Unselected markers (with prices) -->
      <MglMarker
        v-for="airport in unselectedAirports" :key="airport.code"
        :coordinates="[airport.long, airport.lat]">
        <template #marker>
          <button
            :class="[MARKER_BASE_CLASS, MARKER_PRICE_CLASS, MARKER_DEFAULT_CLASS]"
            class="!z-10"
            :aria-label="`Select ${airport.code} for ${formatPrice(airport.price)}`"
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
            :aria-label="`Selected airport ${airport.code}`"
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