import Papa from 'papaparse'

interface AirportRow {
  iata_code: string
  name: string
  latitude_deg: string
  longitude_deg: string
  municipality: string
  iso_country: string
}

interface Airport {
  code: string
  name: string
  lat: number
  lng: number
  municipality: string
  country: string
}

let airportsCache: Airport[] = []

async function loadAirports(): Promise<Airport[]> {
  if (airportsCache.length > 0) {
    return airportsCache
  }

  const csvContent = await useStorage('assets:server').getItem<string>('airports.csv')

  if (!csvContent) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to load airports data' })
  }

  const parsed = Papa.parse<AirportRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
  })

  airportsCache = parsed.data
    .filter((row: AirportRow) => row.iata_code && row.iata_code.trim() !== '')
    .map((row: AirportRow) => ({
      code: row.iata_code.trim(),
      name: row.name || '',
      lat: parseFloat(row.latitude_deg) || 0,
      lng: parseFloat(row.longitude_deg) || 0,
      municipality: row.municipality || '',
      country: row.iso_country || '',
    }))

  return airportsCache
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const searchTerm = (query.q as string || '').toLowerCase().trim()

  const airports = await loadAirports()

  if (!searchTerm) {
    return airports.slice(0, 20)
  }

  const results = airports.filter(airport =>
    airport.code.toLowerCase().includes(searchTerm) ||
    airport.name.toLowerCase().includes(searchTerm) ||
    airport.municipality.toLowerCase().includes(searchTerm)
  )

  return results.slice(0, 20)
})
