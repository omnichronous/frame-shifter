// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['nuxt-maplibre', '@nuxtjs/tailwindcss', '@nuxt/test-utils/module'],
  tailwindcss: {
    // Keep Tailwind config inline; the generated ESM config is loaded through Tailwind's CJS loader.
    quiet: true,
    config: {
      plugins: [() => {}],
    },
  },
  nitro: {
    preset: 'netlify',
  },
  runtimeConfig: {
    public: {
      n8nApi: '', // set via NUXT_PUBLIC_N8N_API env var
    },
  },
  $development: {
    runtimeConfig: {
      public: {
        n8nApi: 'https://omnichronous.app.n8n.cloud/webhook',
      },
    },
  },
})