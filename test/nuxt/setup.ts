import { vi } from 'vitest'

// Mock the vue-maplibre-gl library
// Note: mockComponent from @nuxt/test-utils/runtime is hoisted and cannot be used in setup files
vi.mock('@indoorequal/vue-maplibre-gl', async () => {
  const { defineComponent } = await import('vue')
  
  return {
    default: {},
    MglMap: defineComponent({
      name: 'MglMap',
      template: '<div class="mgl-map"><slot /></div>',
    }),
    MglMarker: defineComponent({
      name: 'MglMarker',
      template: '<div class="mgl-marker"><slot name="marker" /></div>',
    }),
    MglGeoJsonSource: defineComponent({
      name: 'MglGeoJsonSource',
      template: '<div class="mgl-geojson-source"><slot /></div>',
    }),
    MglLineLayer: defineComponent({
      name: 'MglLineLayer',
      template: '<div class="mgl-line-layer"></div>',
    }),
  }
})
