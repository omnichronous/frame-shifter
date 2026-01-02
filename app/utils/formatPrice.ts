export function formatPrice(price: number): string {
  if (price === 0) return '€0'
  if (price >= 1000) return `€${(price / 1000).toFixed(1)}k`
  return `€${price}`
}
