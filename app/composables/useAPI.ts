import type { UseFetchOptions } from 'nuxt/app'

export interface AirportWithPrices {
  code: string
  name: string
  price: number
  lat: number
  long: number
}

export interface TripRequest {
  fly_from: string
  fly_to: string
  date_from: string
  date_to: string
}

export interface TripOption {
  price: number
  duration: number
  deep_link: string
}

export interface TripResponse {
  data: TripOption[]
}


export function useAPI<T = AirportWithPrices[]>(
  url: string | (() => string),
  options?: UseFetchOptions<T>,
) {
  const config = useRuntimeConfig()
  const apiFetch = $fetch.create({
    baseURL: config.public.n8nApi,
  })

  return useFetch(url, {
    ...options,
    $fetch: apiFetch,
  })
}

