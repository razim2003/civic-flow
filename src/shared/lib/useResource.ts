import { useCallback, useEffect, useRef, useState } from 'react'

/** Ignore late reads after account changes, unmounts or a newer request. */
export function useResource<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const sequence = useRef(0)
  const mounted = useRef(false)
  const reload = useCallback(async () => {
    const ticket = ++sequence.current
    setLoading(true); setError(null)
    try { const result = await loader(); if (mounted.current && ticket === sequence.current) setData(result) }
    catch (error) { if (mounted.current && ticket === sequence.current) { setData(null); setError(error) } }
    finally { if (mounted.current && ticket === sequence.current) setLoading(false) }
  }, [loader])
  useEffect(() => {
    mounted.current = true; setData(null)
    void reload()
    return () => { mounted.current = false; ++sequence.current }
  }, [reload])
  return { data, loading, error, reload }
}
