import * as Sentry from '@sentry/nuxt'

Sentry.init({
  dsn: 'https://bc9eec6a10ce910c3478e2cb515302de@o4505207781720064.ingest.us.sentry.io/4511892779302912',

  // Tracing
  tracesSampleRate: 1.0,

  // Logs
  enableLogs: true,
})
