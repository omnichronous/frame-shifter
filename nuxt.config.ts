// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['nuxt-maplibre', '@nuxtjs/tailwindcss', '@nuxt/test-utils/module'],
  $development: {
    runtimeConfig: {
      public: {
        n8nApi: 'https://omnichronous.app.n8n.cloud/webhook',
      },
    },
  },
})