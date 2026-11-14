import { useEffect, useState } from 'react'
import { loadEarthDataset, localDataset } from '../services/earthApi.js'

const initialState = { dataset: localDataset, status: localDataset ? 'ready' : 'loading', error: '' }

export function useEarthDataset() {
  const [state, setState] = useState(initialState)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (localDataset) return
    const controller = new AbortController()
    loadEarthDataset(controller.signal).then(dataset => {
      if (!controller.signal.aborted) setState({ dataset, status: 'ready', error: '' })
    }).catch(error => {
      if (controller.signal.aborted) return
      const message = error.name === 'TimeoutError' ? 'The backend took too long to respond.'
        : error instanceof TypeError ? 'The backend could not be reached. Check its URL and CORS settings.'
          : error.message
      setState({ dataset: null, status: 'error', error: message })
    })
    return () => controller.abort()
  }, [attempt])

  function retry() {
    setState(initialState)
    setAttempt(value => value + 1)
  }

  return { ...state, retry }
}
