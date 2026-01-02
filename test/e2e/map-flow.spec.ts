import { expect, test } from '@nuxt/test-utils/playwright'

const mockDestinations = [
  { code: 'CDG', name: 'Paris Charles de Gaulle', price: 120, lat: 49.01, long: 2.55 },
  { code: 'AMS', name: 'Amsterdam Schiphol', price: 95, lat: 52.31, long: 4.76 },
]

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

  test('finish button navigates to bookings', async ({ page, goto }) => {
    await goto('/map', { waitUntil: 'hydration' })
    
    // Select origin
    await page.getByPlaceholder('Search airports...').fill('London')
    await page.getByRole('button', { name: /LHR/ }).click()
    
    // Click CDG marker
    await page.getByRole('button', { name: 'Select CDG for €120' }).click()
    
    // Click Finish button
    await page.getByRole('button', { name: 'Finish' }).click()
    
    // Verify navigation to bookings page
    await expect(page).toHaveURL('/bookings')
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
})
