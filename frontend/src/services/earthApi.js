import { demoData } from '../data/demoData.js'
import productionData from '../data/production.json' with { type: 'json' }
import { isWebUrl, parseDataset } from './earthData.js'

const mode = import.meta.env?.VITE_DATA_MODE?.trim() || 'mock'

export const localDataset = mode === 'mock' ? parseDataset(demoData, { demo: true })
  : mode === 'production' ? parseDataset(productionData) : null

export async function fetchEarthDataset({ signal, baseUrl = import.meta.env?.VITE_API_BASE_URL, origin = window.location.origin } = {}) {
  const configured = baseUrl?.trim()
  if (!configured) throw new Error('Set VITE_API_BASE_URL to connect to the backend.')

  let base
  try {
    if (!/^https?:\/\//i.test(configured) && !/^\/(?!\/)/.test(configured)) throw new Error()
    if (configured.includes('\\')) throw new Error()
    base = new URL(configured, origin)
    if (!isWebUrl(base) || base.search || base.hash) throw new Error()
    base.pathname = base.pathname.replace(/\/?$/, '/')
  } catch {
    throw new Error('Set VITE_API_BASE_URL to an HTTPS URL, a localhost HTTP URL, or a same-origin path.')
  }

  // Provisional route. The backend team can change it here when the contract is agreed.
  const timeout = AbortSignal.timeout(15000)
  const requestSignal = signal ? AbortSignal.any([timeout, signal]) : timeout
  const response = await fetch(new URL('v1/observations', base), {
    signal: requestSignal,
    headers: { Accept: 'application/json' },
    credentials: 'omit',
  })
  if (!response.ok) throw new Error('The backend returned HTTP ' + response.status + '.')
  let payload
  try { payload = await response.json() } catch {
    requestSignal.throwIfAborted()
    throw new Error('The backend did not return valid JSON.')
  }
  return parseDataset(payload, { base })
}

export function loadEarthDataset(signal) {
  if (mode === 'api') return fetchEarthDataset({ signal })
  return Promise.reject(new Error('Set VITE_DATA_MODE to mock, api, or production.'))
}
