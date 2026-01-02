import { readFileSync } from 'fs'
import { join } from 'path'
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

function loadAirports(): Airport[] {
  if (airportsCache.length > 0) {
    return airportsCache
  }

  const csvPath = join(process.cwd(), 'app/assets/airports.csv')
  const csvContent = readFileSync(csvPath, 'utf-8')
  
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

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const searchTerm = (query.q as string || '').toLowerCase().trim()

  const airports = loadAirports()

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
