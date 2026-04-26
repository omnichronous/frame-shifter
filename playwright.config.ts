import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import type { ConfigOptions } from '@nuxt/test-utils/playwright'

const e2eHost = 'http://127.0.0.1:3000'

export default defineConfig<ConfigOptions>({
  testDir: 'test/e2e',
  use: {
    nuxt: {
      rootDir: fileURLToPath(new URL('.', import.meta.url)),
      host: e2eHost,
    },
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'pnpm dev',
    url: e2eHost,
    reuseExistingServer: true,
    timeout: 120000,
  },
})
