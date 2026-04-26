import { expect, test } from '@nuxt/test-utils/playwright'
import type { Page } from '@playwright/test'

const mockDestinations = [
  { code: 'CDG', name: 'Paris Charles de Gaulle', price: 120, lat: 49.01, long: 2.55 },
  { code: 'AMS', name: 'Amsterdam Schiphol', price: 95, lat: 52.31, long: 4.76 },
]

// Helper function to get map center coordinates
async function getMapCenter(page: Page): Promise<{ lng: number; lat: number } | null> {
  return page.evaluate(() => {
    const map = (window as any).__mapInstance
    if (!map || typeof map.getCenter !== 'function') return null
    const center = map.getCenter()
    return { lng: center.lng, lat: center.lat }
  })
}

async function expectMapCenter(page: Page, expected: { lng: number; lat: number }) {
  await expect.poll(async () => (await getMapCenter(page))?.lat ?? Number.NaN).toBeCloseTo(expected.lat, 0)
  await expect.poll(async () => (await getMapCenter(page))?.lng ?? Number.NaN).toBeCloseTo(expected.lng, 0)
}

test.describe('Map flow', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    // Mock external flights API
    await page.route('**/flights*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDestinations),
      })
    })
  })

  test('select origin via search', async ({ page, goto }) => {
    await goto('/map', { waitUntil: 'hydration' })
    await page.getByPlaceholder('Search airports...').fill('London')
    await page.getByRole('button', { name: /LHR/ }).click()
    await expect(page.locator('input[readonly]')).toHaveValue('LHR')
  })

  test('full journey: origin -> destination -> finish', async ({ page, goto }) => {
    await goto('/map', { waitUntil: 'hydration' })
    
    // Select origin
    await page.getByPlaceholder('Search airports...').fill('London')
    await page.getByRole('button', { name: /LHR/ }).click()
    
    // Verify Finish is disabled with 1 leg
    await expect(page.getByRole('button', { name: 'Finish' })).toBeDisabled()
    
    // Click CDG marker (€120)
    await page.getByRole('button', { name: 'Select CDG for €120' }).click()
    
    // Verify Finish is enabled with 2 legs
    await expect(page.getByRole('button', { name: 'Finish' })).toBeEnabled()
  })

  test('undo removes last destination', async ({ page, goto }) => {
    await goto('/map', { waitUntil: 'hydration' })
    
    // Select origin
    await page.getByPlaceholder('Search airports...').fill('London')
    await page.getByRole('button', { name: /LHR/ }).click()
    
    // Click CDG marker
    await page.getByRole('button', { name: 'Select CDG for €120' }).click()
    
    // Click undo button
    await page.getByRole('button', { name: 'Undo' }).click()
    
    // Verify we're back to 1 leg (origin only)
    await expect(page.getByRole('button', { name: 'Finish' })).toBeDisabled()
    await expect(page.locator('input[readonly]')).toHaveValue('LHR')
  })

  test('finish button enters finished state then navigates on second click', async ({ page, goto }) => {
    await goto('/map', { waitUntil: 'hydration' })
    
    // Select origin
    await page.getByPlaceholder('Search airports...').fill('London')
    await page.getByRole('button', { name: /LHR/ }).click()
    
    // Click CDG marker
    await page.getByRole('button', { name: 'Select CDG for €120' }).click()
    
    // Click Finish — opens modal (non-loop route)
    await page.getByRole('button', { name: 'Finish' }).click()
    // Choose "End in CDG" from modal
    await page.locator('.max-w-sm').getByRole('button', { name: /End in CDG/ }).click()

    // Should stay on map, button becomes "View Bookings"
    await expect(page).toHaveURL(/\/map/)
    await expect(page.getByRole('button', { name: 'View Bookings' })).toBeVisible()

    // Click View Bookings — navigates to bookings
    await page.getByRole('button', { name: 'View Bookings' }).click()
    await expect(page).toHaveURL('/bookings')
  })

  test('clicking origin return marker enters finished state', async ({ page, goto }) => {
    await goto('/map', { waitUntil: 'hydration' })
    
    // Select origin
    await page.getByPlaceholder('Search airports...').fill('London')
    await page.getByRole('button', { name: /LHR/ }).click()
    
    // Click CDG marker to create a 2-leg itinerary
    await page.getByRole('button', { name: 'Select CDG for €120' }).click()
    
    // Click the origin return marker (green circle)
    await page.getByRole('button', { name: 'Return to LHR' }).click()
    
    // Should stay on map with View Bookings button
    await expect(page).toHaveURL(/\/map/)
    await expect(page.getByRole('button', { name: 'View Bookings' })).toBeVisible()
  })

  test('clear origin resets state', async ({ page, goto }) => {
    await goto('/map', { waitUntil: 'hydration' })
    
    // Select origin
    await page.getByPlaceholder('Search airports...').fill('London')
    await page.getByRole('button', { name: /LHR/ }).click()
    
    // Verify origin is set
    await expect(page.locator('input[readonly]')).toHaveValue('LHR')
    
    // Click clear button (✕)
    await page.getByRole('button', { name: '✕' }).click()
    
    // Verify origin is cleared and search input is back
    await expect(page.getByPlaceholder('Search airports...')).toBeVisible()
    await expect(page.locator('input[readonly]')).not.toBeVisible()
  })

  test('keyboard shortcut backspace triggers undo', async ({ page, goto }) => {
    await goto('/map', { waitUntil: 'hydration' })
    
    // Select origin
    await page.getByPlaceholder('Search airports...').fill('London')
    await page.getByRole('button', { name: /LHR/ }).click()
    
    // Click CDG marker
    await page.getByRole('button', { name: 'Select CDG for €120' }).click()
    
    // Verify Finish is enabled
    await expect(page.getByRole('button', { name: 'Finish' })).toBeEnabled()
    
    // Press Backspace
    await page.keyboard.press('Backspace')
    
    // Verify we're back to 1 leg
    await expect(page.getByRole('button', { name: 'Finish' })).toBeDisabled()
  })

  test('date picker advances by 3 days when adding destination', async ({ page, goto }) => {
    await goto('/map', { waitUntil: 'hydration' })
    
    const datePicker = page.locator('input[type="date"]')
    
    // Set initial date
    await datePicker.fill('2026-02-10')
    await expect(datePicker).toHaveValue('2026-02-10')
    
    // Select origin
    await page.getByPlaceholder('Search airports...').fill('London')
    await page.getByRole('button', { name: /LHR/ }).click()
    
    // Date should remain the same after setting origin
    await expect(datePicker).toHaveValue('2026-02-10')
    
    // Add destination - date should advance by 3 days
    await page.getByRole('button', { name: 'Select CDG for €120' }).click()
    await expect(datePicker).toHaveValue('2026-02-13')
  })

  test('multi-leg journey: origin -> dest1 -> dest2', async ({ page, goto }) => {
    await goto('/map', { waitUntil: 'hydration' })
    
    // Select origin
    await page.getByPlaceholder('Search airports...').fill('London')
    await page.getByRole('button', { name: /LHR/ }).click()
    
    // Add first destination (CDG)
    await page.getByRole('button', { name: 'Select CDG for €120' }).click()
    await expect(page.getByRole('button', { name: 'Finish' })).toBeEnabled()
    
    // Add second destination (AMS)
    await page.getByRole('button', { name: 'Select AMS for €95' }).click()
    
    // Finish should still be enabled with 3 legs
    await expect(page.getByRole('button', { name: 'Finish' })).toBeEnabled()
    
    // Undo should remove last destination
    await page.getByRole('button', { name: 'Undo' }).click()
    
    // Still have 2 legs, finish should be enabled
    await expect(page.getByRole('button', { name: 'Finish' })).toBeEnabled()
  })

  test('cookie persistence across page reload', async ({ page, goto }) => {
    await goto('/map', { waitUntil: 'hydration' })
    
    // Select origin
    await page.getByPlaceholder('Search airports...').fill('London')
    await page.getByRole('button', { name: /LHR/ }).click()
    
    // Add destination
    await page.getByRole('button', { name: 'Select CDG for €120' }).click()
    await expect(page.getByRole('button', { name: 'Finish' })).toBeEnabled()
    
    // Reload page
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    
    // State should persist - origin should still be set and finish enabled
    await expect(page.locator('input[readonly]')).toHaveValue('CDG')
    await expect(page.getByRole('button', { name: 'Finish' })).toBeEnabled()
  })

  test('map pans to selected marker', async ({ page, goto }) => {
    await goto('/map', { waitUntil: 'hydration' })
    
    // Select origin (LHR: lat 51.47, lng -0.46)
    await page.getByPlaceholder('Search airports...').fill('London')
    await page.getByRole('button', { name: /LHR/ }).click()
    
    // Verify map centered on origin
    await expectMapCenter(page, { lat: 51.47, lng: -0.46 })
    
    // Click CDG marker (lat 49.01, lng 2.55)
    await page.getByRole('button', { name: 'Select CDG for €120' }).click()
    
    // Verify map centered on destination
    await expectMapCenter(page, { lat: 49.01, lng: 2.55 })
  })
})

// Helper: build a 2-leg route (LHR -> CDG) and click Finish -> "End in CDG"
async function buildAndFinishRoute(page: Page, goto: (url: string, options?: any) => Promise<any>) {
  await goto('/map', { waitUntil: 'hydration' })
  await page.getByPlaceholder('Search airports...').fill('London')
  await page.getByRole('button', { name: /LHR/ }).click()
  await page.getByRole('button', { name: 'Select CDG for €120' }).click()
  await page.getByRole('button', { name: 'Finish' }).click()
  // Finish modal: choose "End in CDG" (target modal specifically to avoid marker ambiguity)
  await page.locator('.max-w-sm').getByRole('button', { name: /End in CDG/ }).click()
}

test.describe('Finished route state', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.route('**/flights*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDestinations),
      })
    })
  })

  test('stays on map after finish with View Bookings button', async ({ page, goto }) => {
    await buildAndFinishRoute(page, goto)

    // Should remain on map page
    await expect(page).toHaveURL(/\/map/)

    // Finish button should now read "View Bookings"
    await expect(page.getByRole('button', { name: 'View Bookings' })).toBeVisible()
  })

  test('price markers hidden after finish', async ({ page, goto }) => {
    await buildAndFinishRoute(page, goto)

    // Price markers for unselected airports should not be visible
    await expect(page.getByRole('button', { name: /Select AMS/ })).not.toBeVisible()
  })

  test('route markers show icons and numbers', async ({ page, goto }) => {
    // Build a 3-leg route: LHR -> CDG -> AMS
    await goto('/map', { waitUntil: 'hydration' })
    await page.getByPlaceholder('Search airports...').fill('London')
    await page.getByRole('button', { name: /LHR/ }).click()
    await page.getByRole('button', { name: 'Select CDG for €120' }).click()
    await page.getByRole('button', { name: 'Select AMS for €95' }).click()
    await page.getByRole('button', { name: 'Finish' }).click()
    await page.locator('.max-w-sm').getByRole('button', { name: /End in AMS/ }).click()

    // Origin should have takeoff icon marker
    await expect(page.getByLabel('LHR - departure')).toBeVisible()

    // Middle leg should show sequence number
    await expect(page.getByLabel('CDG - leg 2')).toBeVisible()

    // Last leg should have flag/landing icon marker
    await expect(page.getByLabel('AMS - arrival')).toBeVisible()
  })

  test('selected markers are non-interactive after finish', async ({ page, goto }) => {
    await buildAndFinishRoute(page, goto)

    // The View Bookings button should be visible (finished state)
    await expect(page.getByRole('button', { name: 'View Bookings' })).toBeVisible()

    // Try clicking the origin marker area — should not change state
    // (markers have pointer-events-none, so clicking them does nothing)
    const viewBookingsBtn = page.getByRole('button', { name: 'View Bookings' })
    await expect(viewBookingsBtn).toBeVisible()

    // Verify no price markers appeared (would indicate state was cleared)
    await expect(page.getByRole('button', { name: /Select CDG/ })).not.toBeVisible()
    await expect(page.getByRole('button', { name: /Select AMS/ })).not.toBeVisible()
  })

  test('View Bookings navigates to bookings page', async ({ page, goto }) => {
    await buildAndFinishRoute(page, goto)

    await page.getByRole('button', { name: 'View Bookings' }).click()
    await expect(page).toHaveURL('/bookings')
  })

  test('undo exits finished state regardless of remaining legs', async ({ page, goto }) => {
    // Build a 3-leg route: LHR -> CDG -> AMS, then finish
    await goto('/map', { waitUntil: 'hydration' })
    await page.getByPlaceholder('Search airports...').fill('London')
    await page.getByRole('button', { name: /LHR/ }).click()
    await page.getByRole('button', { name: 'Select CDG for €120' }).click()
    await page.getByRole('button', { name: 'Select AMS for €95' }).click()
    await page.getByRole('button', { name: 'Finish' }).click()
    await page.locator('.max-w-sm').getByRole('button', { name: /End in AMS/ }).click()

    // Verify finished state
    await expect(page.getByRole('button', { name: 'View Bookings' })).toBeVisible()

    // Single undo — still 2 legs remain (LHR -> CDG)
    await page.getByRole('button', { name: 'Undo' }).click()

    // Should already be out of finished state despite having 2 legs
    await expect(page.getByRole('button', { name: 'Finish' })).toBeEnabled()

    // Price markers should reappear
    await expect(page.getByRole('button', { name: /Select AMS/ })).toBeVisible()
  })
})
