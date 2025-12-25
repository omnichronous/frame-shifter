import type { UseFetchOptions } from 'nuxt/app'

export interface AirportWithPrices {
  // appended_price: number[]
  min_price: number
  airport_id: number
  ident: string
  type: string
  name: string
  latitude_deg: number
  longitude_deg: number
  elevation_ft: number
  continent: string
  iso_country: string
  iso_region: string
  municipality: string
  scheduled_service: string
  icao_code: string
  iata_code: string
  gps_code: string
  local_code: string
  home_link: string
  wikipedia_link: string
  keywords: string
  id: number
  createdAt: Date
  updatedAt: Date
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

