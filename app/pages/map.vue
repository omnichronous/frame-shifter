<script setup lang="ts">
import { ref, computed } from 'vue'
import type { AirportWithPrices } from '~/composables/useAPI'

type LngLat = [number, number]

const date = '29/01/2026'

const { data } = await useAPI('/flights', {
  server: false,
  query: {
    origin: 'DUB',
    date,
  },
})

const selected = ref<Array<{ code: string, date: string }>>([])

const onMarkerClick = (airport: AirportWithPrices) => {
  // toggle in selection
  const idx = selected.value.findIndex(
    (item) => item.code === airport.iata_code && item.date === date
  )
  if (idx >= 0) {
    selected.value.splice(idx, 1)
  } else {
    selected.value.push({ code: airport.iata_code, date })
  }
}

// GeoJSON LineString from selected markers (in click order)
const pathGeoJson = computed(() => {
  const coordinates: LngLat[] = selected.value
    .map((item) => {
      const airport = data.value?.find((a) => a.iata_code === item.code)
      return airport ? [airport.longitude_deg, airport.latitude_deg] : null
    })
    .filter((coord): coord is LngLat => coord !== null)

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
</script>

<template>
  <ClientOnly>
    <div style="height: 100vh; width: 100%">
      <MglMap map-style="https://demotiles.maplibre.org/style.json" :center="[0, 0]" :zoom="2">
        <MglMarker
          v-for="airport in data" :key="airport.id"
          :coordinates="[airport.longitude_deg, airport.latitude_deg]">
          <template #marker>
            <button
              class="marker"
              :class="{ active: selected.some((item) =>
                item.code === airport.iata_code && item.date === date
              ) }"
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
.marker.active {
  color: #ff6200;
}
</style>