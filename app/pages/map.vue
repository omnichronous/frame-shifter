<script setup lang="ts">
import type { AirportWithPrices } from '~/composables/useAPI'
import type { Leg } from '~/composables/useItinerary'

type LngLat = [number, number]

const date = '29/01/2026'

const { legs, origin, currentOrigin, setOrigin, addDestination, undoLast } = useItinerary()

// Fetch destinations based on current origin
const { data: destinations } = await useAPI('/flights', {
  server: false,
  query: computed(() => ({
    origin: currentOrigin.value ?? 'DUB',
    date,
  })),
})

// Show all airports initially, then only destinations after origin is selected
const availableAirports = computed(() => {
  if (!origin.value) {
    return destinations.value ?? []
  }
  return destinations.value ?? []
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
            class="marker"
            :class="{
              origin: origin?.code === airport.code,
              active: legs.some((leg: Leg) => leg.code === airport.code)
            }"
            @click.stop="onMarkerClick(airport)"
          >
            ●
          </button>
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

<style scoped>
.marker {
  background: transparent;
  border: none;
  font-size: 24px;
  cursor: pointer;
}
.marker.origin {
  color: #16a34a;
}
.marker.active {
  color: #ff6200;
}
</style>