<script setup lang="ts">
import { ref, computed } from 'vue'

type LngLat = [number, number]

const { data } = await useAPI('/flights', {
  server: false,
  query: {
    origin: 'DUB',
    date: '29/01/2026',
  },
})

const selected = ref<LngLat[]>([])

const onMarkerClick = (coord: LngLat) => {
  // toggle in selection
  const idx = selected.value.findIndex(
    ([lng, lat]) => lng === coord[0] && lat === coord[1]
  )
  if (idx >= 0) {
    selected.value.splice(idx, 1)
  } else {
    selected.value.push(coord)
  }
}

// GeoJSON LineString from selected markers (in click order)
const pathGeoJson = computed(() => ({
  type: 'FeatureCollection' as const,
  features: selected.value.length < 2
    ? []
    : [{
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: selected.value
        },
        properties: {}
      }]
}))
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
              :class="{ active: selected.some(([lng, lat]) =>
                lng === airport.longitude_deg && lat === airport.latitude_deg
              ) }"
              @click.stop="onMarkerClick([airport.longitude_deg, airport.latitude_deg])"
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