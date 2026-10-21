import { useEffect, useRef, useState } from 'react'
import { requestCurrentLocation } from './geolocation'
import { validPoint } from './coordinates'
import type { Point } from './coordinates'

export function useLocationSelection() {
  const [latitude, updateLatitude] = useState(''), [longitude, updateLongitude] = useState('')
  const [locating, setLocating] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [focusPoint, setFocusPoint] = useState<Point | null>(null)
  const request = useRef(0), inFlight = useRef(false)
  useEffect(() => () => { ++request.current }, [])

  function cancel() {
    ++request.current; inFlight.current = false
    setLocating(false); setError(''); setMessage(''); setFocusPoint(null)
  }
  function setLatitude(value: string) { cancel(); updateLatitude(value) }
  function setLongitude(value: string) { cancel(); updateLongitude(value) }
  function selectPoint([lat, lng]: Point) {
    cancel(); updateLatitude(lat.toFixed(6)); updateLongitude(lng.toFixed(6))
  }
  async function locate() {
    if (inFlight.current) return
    const ticket = ++request.current
    inFlight.current = true; setLocating(true); setError(''); setMessage(''); setFocusPoint(null)
    try {
      const fix = await requestCurrentLocation()
      if (ticket !== request.current) return
      updateLatitude(fix.point[0].toFixed(6)); updateLongitude(fix.point[1].toFixed(6)); setFocusPoint(fix.point)
      const accuracy = fix.accuracy === null ? '' : ` Estimated accuracy: about ${Math.max(1, Math.round(fix.accuracy)).toLocaleString()} metres.`
      setMessage(`Current location selected.${accuracy} Check the pin and drag it if the issue is nearby.`)
    } catch (error) {
      if (ticket === request.current) setError(error instanceof Error ? error.message : 'Location is unavailable. Click the map or enter coordinates instead.')
    } finally {
      if (ticket === request.current) { inFlight.current = false; setLocating(false) }
    }
  }
  return { latitude, longitude, point: validPoint(latitude, longitude), focusPoint, setLatitude, setLongitude, selectPoint, locate, cancel, locating, error, message }
}
