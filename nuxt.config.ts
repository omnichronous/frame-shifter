// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@sentry/nuxt/module', 'nuxt-maplibre', '@nuxtjs/tailwindcss', '@nuxt/test-utils/module'],

  runtimeConfig: {
    public: {
      n8nApi: '', // set via NUXT_PUBLIC_N8N_API env var
      // PartyServer Workers host (e.g. collab.frame-shifter.workers.dev)
      collabHost: '', // set via NUXT_PUBLIC_COLLAB_HOST env var
      sentryEnvironment: process.env.CONTEXT === 'production'
        ? 'production'
        : process.env.CONTEXT === 'deploy-preview'
          ? `preview-${process.env.REVIEW_ID ?? process.env.BRANCH}`
          : process.env.CONTEXT || 'development',
    },
  },
  $development: {
    runtimeConfig: {
      public: {
        n8nApi: 'https://omnichronous.app.n8n.cloud/webhook',
        collabHost: '127.0.0.1:8787',
      },
    },
  },

  nitro: {
    preset: 'netlify',
  },
  sourcemap: {
    client: 'hidden',
    server: true,
  },
  vite: {
    optimizeDeps: {
      include: [
        '@indoorequal/vue-maplibre-gl',
        'date-fns',
        '@sentry/nuxt',
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'partysocket',
      ],
    },
  },

  tailwindcss: {
    // Keep Tailwind config inline; the generated ESM config is loaded through Tailwind's CJS loader.
    quiet: true,
    config: {
      plugins: [() => { }],
    },
  },
  sentry: {
    // Netlify does not support the --import CLI flag.
    // This injects the Sentry server config as a top-level import in the Nitro server entry.
    autoInjectServerSentry: 'top-level-import',
    sourceMapsUploadOptions: {
      org: "frame-shift-development",
      project: "frame-shifter",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    },
  },

})