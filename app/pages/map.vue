<script setup lang="ts">
const { data } = await useAPI('/flights', {
  server: false,
  query: {
    origin: 'DUB',
    date: '29/01/2026',
  },
})
</script>

<template>
  <ClientOnly>
    <div style="height: 100vh; width: 100%">
      <MglMap map-style="https://demotiles.maplibre.org/style.json" :center="[0, 0]" :zoom="2">
        <MglMarker
          v-for="airport in data" :key="airport.id"
          :coordinates="[airport.longitude_deg, airport.latitude_deg]" />
      </MglMap>
    </div>
  </ClientOnly>
</template>