<script setup lang="ts">
import { formatDuration } from 'date-fns'
import type { TripRequest, TripResponse } from '~/composables/useAPI'

const { legs } = useItinerary()

// Route guard - redirect if no valid itinerary
if (legs.value.length < 2) {
  await navigateTo('/map')
}

// Transform legs to API request format (snapshot, not reactive)
const tripRequests: TripRequest[] = legs.value.slice(0, -1).map((leg, i) => {
  const nextLeg = legs.value[i + 1]
  if (!nextLeg) return null
  return {
    fly_from: leg.code,
    fly_to: nextLeg.code,
    date_from: leg.date,
    date_to: leg.date,
  }
}).filter((req): req is TripRequest => req !== null)

// Fetch booking options from /trips endpoint
const config = useRuntimeConfig()
const { data: tripData, error, pending } = useLazyFetch<TripResponse>('/trips', {
  baseURL: config.public.n8nApi,
  method: 'POST',
  body: { requests: tripRequests },
})

const bookingOptions = computed(() => tripData.value?.data ?? [])

// Format itinerary summary for display
const itinerarySummary = computed(() =>
  legs.value.map(leg => leg.code).join(' → ')
)

// Format duration from seconds to human readable
const formatTripDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return formatDuration({ hours, minutes })
}

// Format price with currency
const formatPrice = (price: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
  }).format(price)
}

const handleBooking = (deepLink: string) => {
  window.open(deepLink, '_blank', 'noopener,noreferrer')
}

const goBackToMap = () => {
  navigateTo('/map')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="fixed top-0 left-0 right-0 z-50 bg-white shadow-md">
      <div class="px-4 py-3">
        <div class="flex items-center gap-3 mb-2">
          <button
            type="button"
            class="p-2 -ml-2 text-gray-600 hover:text-gray-900 transition-colors"
            @click="goBackToMap"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 class="text-lg font-semibold text-gray-900">Booking Options</h1>
        </div>
        <div class="text-sm text-gray-600">
          {{ itinerarySummary }}
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="pt-24 pb-6 px-4">
      <!-- Loading state -->
      <div v-if="pending" class="space-y-4">
        <div v-for="i in 3" :key="i" class="bg-white rounded-lg shadow-md p-4">
          <div class="animate-pulse space-y-3">
            <div class="h-6 bg-gray-200 rounded w-1/3" />
            <div class="h-4 bg-gray-200 rounded w-1/2" />
            <div class="h-10 bg-gray-200 rounded" />
          </div>
        </div>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="bg-white rounded-lg shadow-md p-6 text-center">
        <div class="text-red-600 mb-4">
          <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="font-medium">Failed to load booking options</p>
        </div>
        <button
          type="button"
          class="px-6 py-2 bg-orange-600 text-white rounded-lg font-medium active:bg-orange-700 transition-colors"
          @click="goBackToMap"
        >
          Back to Map
        </button>
      </div>

      <!-- Results -->
      <div v-else-if="bookingOptions.length > 0" class="space-y-4">
        <div
          v-for="(option, index) in bookingOptions"
          :key="index"
          class="bg-white rounded-lg shadow-md p-4"
        >
          <div class="flex items-center justify-between mb-3">
            <div>
              <div class="text-2xl font-bold text-gray-900">
                {{ formatPrice(option.price) }}
              </div>
              <div class="text-sm text-gray-600">
                {{ formatTripDuration(option.duration) }}
              </div>
            </div>
          </div>
          <button
            type="button"
            class="w-full h-11 rounded-lg bg-orange-600 text-white font-medium text-base active:bg-orange-700 transition-colors"
            @click="handleBooking(option.deep_link)"
          >
            Book Now
          </button>
        </div>
      </div>

      <!-- No results -->
      <div v-else class="bg-white rounded-lg shadow-md p-6 text-center">
        <p class="text-gray-600 mb-4">No booking options available for this itinerary.</p>
        <button
          type="button"
          class="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium active:bg-gray-200 transition-colors"
          @click="goBackToMap"
        >
          Edit Route
        </button>
      </div>
    </main>
  </div>
</template>

