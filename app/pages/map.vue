<script setup lang="ts">
import { addDays, format, parse } from 'date-fns'
import type { Map } from 'maplibre-gl'

definePageMeta({
  alias: '/'
})

type LngLat = [number, number]

// Date state before origin is set
const pendingDate = ref('2026-09-13')

const MARKER_BASE_CLASS = 'rounded-full transition-transform hover:scale-110 cursor-pointer shadow-md border-2 border-white'
const MARKER_PRICE_CLASS = 'px-2 py-1 text-xs font-semibold whitespace-nowrap'
const MARKER_DOT_CLASS = 'w-4 h-4'
const MARKER_ORIGIN_CLASS = 'w-6 h-6 bg-green-600 ring-4 ring-green-200'
const MARKER_ACTIVE_CLASS = 'bg-orange-600'
const MARKER_DEFAULT_CLASS = 'bg-blue-500 text-white'

const { legs, origin, isLoopClosed, currentOrigin, currentOriginDate, setOrigin, addDestination, updateCurrentOriginDate, undoLast } = useItinerary()

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
const { data: destinations, status: destinationStatus, error: destinationError, execute: fetchDestinations } = await useAPI('/flights', {
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
    destinations.value = undefined
    fetchDestinations()
  }
})

const dismissError = ref(false)
watch(destinationError, () => { dismissError.value = false })

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

// GeoJSON dashed line for return preview (shown when finish modal is open)
const returnPreviewGeoJson = computed(() => {
  if (!showFinishModal.value || !origin.value || legs.value.length < 2) {
    return { type: 'FeatureCollection' as const, features: [] }
  }
  const lastLeg = legs.value[legs.value.length - 1]
  if (!lastLeg) return { type: 'FeatureCollection' as const, features: [] }
  return {
    type: 'FeatureCollection' as const,
    features: [{
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [lastLeg.lng, lastLeg.lat],
          [origin.value.lng, origin.value.lat]
        ] as LngLat[]
      },
      properties: {}
    }]
  }
})

const canUndo = computed(() => legs.value.length > 0)

const canFinish = computed(() => legs.value.length >= 2)

const canCloseLoop = computed(() => canFinish.value && !isLoopClosed.value)

// Finish modal state
const showFinishModal = ref(false)

const handleFinish = () => {
  if (isLoopClosed.value) {
    navigateTo('/bookings')
    return
  }
  showFinishModal.value = true
}

const handleEndInLastCity = () => {
  showFinishModal.value = false
  navigateTo('/bookings')
}

const handleReturnToOrigin = () => {
  if (!origin.value) return
  const parsedDate = parse(currentDate.value, 'yyyy-MM-dd', new Date())
  const newDate = addDays(parsedDate, 3)
  const newDateApi = format(newDate, 'dd/MM/yyyy')
  addDestination(origin.value.code, newDateApi, origin.value.lat, origin.value.lng)
  showFinishModal.value = false
  navigateTo('/bookings')
}

const lastLegCode = computed(() => {
  const lastLeg = legs.value[legs.value.length - 1]
  return lastLeg?.code ?? ''
})

const pathAirportCodes = computed(() => new Set(legs.value.map(leg => leg.code)))

const isLastLeg = (airport: AirportWithPrices) => {
  const lastLeg = legs.value[legs.value.length - 1]
  return lastLeg?.code === airport.code && airport.code !== origin.value?.code
}

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
          <!-- Origin marker with return hint -->
          <div
            v-if="origin?.code === airport.code && canCloseLoop"
            class="group relative flex flex-col items-center !z-20"
          >
            <div
              class="absolute bottom-full mb-2 px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium whitespace-nowrap shadow-lg opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 pointer-events-none"
            >
              Return to {{ airport.code }}
              <span class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
            <button
              type="button"
              class="relative flex items-center justify-center w-8 h-8 rounded-full bg-green-600 text-white shadow-md border-2 border-white cursor-pointer hover:scale-110 transition-transform"
              :aria-label="`Return to ${airport.code}`"
              @click.stop="handleReturnToOrigin()"
            >
              <svg class="relative w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
            </button>
          </div>
          <!-- Last leg marker with end-here hint -->
          <div
            v-else-if="isLastLeg(airport) && canCloseLoop"
            class="group relative flex flex-col items-center !z-20"
          >
            <div
              class="absolute bottom-full mb-2 px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium whitespace-nowrap shadow-lg opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 pointer-events-none"
            >
              End in {{ airport.code }}
              <span class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
            <button
              type="button"
              class="relative flex items-center justify-center w-8 h-8 rounded-full bg-orange-600 text-white shadow-md border-2 border-white cursor-pointer hover:scale-110 transition-transform"
              :aria-label="`End in ${airport.code}`"
              @click.stop="handleEndInLastCity"
            >
              <svg class="relative w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </button>
          </div>
          <!-- Normal selected marker -->
          <button
            v-else
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

      <!-- Dashed return preview line (shown when finish modal is open) -->
      <MglGeoJsonSource source-id="return-preview" :data="returnPreviewGeoJson">
        <MglLineLayer
          layer-id="return-preview"
          :layout="{ 'line-cap': 'round', 'line-join': 'round' }"
          :paint="{
            'line-color': '#ff6200',
            'line-width': 2,
            'line-dasharray': [4, 4]
          }"
        />
      </MglGeoJsonSource>
      </MglMap>

      <!-- Destination loading overlay -->
      <Transition name="fade">
        <div
          v-if="destinationStatus === 'pending'"
          class="absolute inset-0 z-40 flex items-center justify-center bg-black/10 pointer-events-none"
        >
          <div class="rounded-xl bg-white/90 px-4 py-3 shadow-lg flex items-center gap-2 text-sm font-medium text-gray-600">
            <svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="text-gray-700" fill="currentColor">
              <path d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,20a9,9,0,1,1,9-9A9,9,0,0,1,12,21Z" opacity="0.25" />
              <rect class="origin-center animate-[spin_9s_linear_infinite]" x="11" y="6" rx="1" width="2" height="7" />
              <rect class="origin-center animate-[spin_0.75s_linear_infinite]" x="11" y="11" rx="1" width="2" height="9" />
            </svg>
            Loading destinations…
          </div>
        </div>
      </Transition>

      <!-- Destination error banner -->
      <div
        v-if="destinationError && !dismissError"
        class="absolute bottom-20 left-4 right-4 z-50 flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 shadow-lg"
      >
        <span class="flex-1 text-sm text-red-700">Failed to load destinations</span>
        <button
          type="button"
          class="text-sm font-medium text-red-700 hover:text-red-900 transition-colors"
          @click="destinations = undefined; fetchDestinations()"
        >
          Retry
        </button>
        <button
          type="button"
          class="text-red-400 hover:text-red-600 transition-colors"
          @click="dismissError = true"
        >
          ✕
        </button>
      </div>

      <!-- Finish modal -->
      <Transition name="fade">
        <div
          v-if="showFinishModal"
          class="absolute inset-0 z-50 flex items-center justify-center bg-black/30"
          @click.self="showFinishModal = false"
        >
          <div class="bg-white rounded-xl shadow-lg px-6 py-5 mx-4 max-w-sm w-full">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-base font-semibold text-gray-900">How should your trip end?</h2>
              <button
                type="button"
                class="text-gray-400 hover:text-gray-600 transition-colors"
                @click="showFinishModal = false"
              >
                ✕
              </button>
            </div>
            <div class="flex flex-col gap-3">
              <button
                type="button"
                class="w-full h-11 rounded-lg bg-gray-100 text-gray-700 font-medium text-sm active:bg-gray-200 transition-colors"
                @click="handleEndInLastCity"
              >
                End in {{ lastLegCode }}
              </button>
              <button
                type="button"
                class="w-full h-11 rounded-lg bg-orange-600 text-white font-medium text-sm active:bg-orange-700 transition-colors"
                @click="handleReturnToOrigin"
              >
                Return to {{ origin?.code }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

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
            @click="handleFinish"
          >
            Finish
          </button>
        </div>
      </footer>
    </div>
  </ClientOnly>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>