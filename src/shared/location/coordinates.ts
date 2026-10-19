export type Point = [number, number]
export function parseCoordinate(value: string) { return value.trim() ? Number(value) : Number.NaN }
export function validPoint(latitude: string, longitude: string): Point | null {
  const lat = parseCoordinate(latitude); const lng = parseCoordinate(longitude)
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? [lat, lng] : null
}
