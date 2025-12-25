<template>
  <ClientOnly>
    <div style="height: 100vh; width: 100%">
      <MglMap
        map-style="https://demotiles.maplibre.org/style.json"
        :center="[0, 0]"
        :zoom="2"
      />
    </div>
  </ClientOnly>
</template>

