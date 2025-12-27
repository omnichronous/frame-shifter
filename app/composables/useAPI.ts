import type { UseFetchOptions } from 'nuxt/app'

export interface AirportWithPrices {
  code: string
  name: string
  price: number
  lat: number
  long: number
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

