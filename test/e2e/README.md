# E2E Tests

End-to-end tests using Playwright with `@nuxt/test-utils/playwright` for proper Nuxt SSR/hydration handling.

## Running Tests

```bash
# Standard mode
npm run test:e2e

# UI mode (interactive debugging)
npm run test:e2e:ui

# Headed mode (see browser)
npm run test:e2e:headed
```

## Test Coverage

**User Flows** (9 tests)
- Origin selection via search
- Full journey (origin → destination → finish)
- Multi-leg journey (3+ destinations)
- Finish button navigation to bookings

**State Management**
- Date picker (+3 day auto-advance per leg)
- Cookie persistence across page reload
- Undo functionality (button and Backspace key)
- Clear origin (✕ button)

## Test Architecture

**E2E tests** (this directory) - Full user flows through browser UI  
**Unit tests** (`test/nuxt/useItinerary.test.ts`) - State management logic
