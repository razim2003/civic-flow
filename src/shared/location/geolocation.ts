import { validPoint } from './coordinates'
import type { Point } from './coordinates'

type LocationFix = { point: Point; accuracy: number | null }
const fallback = 'Your current location could not be found. Click the map or enter coordinates instead.'

/** A single, explicitly requested fix. Never starts background location tracking. */
export function requestCurrentLocation(): Promise<LocationFix> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(new Error('Current location requires a secure connection. Click the map or enter coordinates instead.'))
      return
    }
    if (!navigator.geolocation) {
      reject(new Error('This browser does not support current location. Click the map or enter coordinates instead.'))
      return
    }
    try {
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        const point = validPoint(String(coords.latitude), String(coords.longitude))
        if (!point) { reject(new Error(fallback)); return }
        resolve({ point, accuracy: Number.isFinite(coords.accuracy) && coords.accuracy >= 0 ? coords.accuracy : null })
      }, ({ code }) => {
        const message = code === 1 ? 'Location access was blocked. Allow location in your browser settings and try again, or click the map.'
          : code === 3 ? 'Finding your location took too long. Try again, click the map or enter coordinates.'
            : fallback
        reject(new Error(message))
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
    } catch { reject(new Error(fallback)) }
  })
}
