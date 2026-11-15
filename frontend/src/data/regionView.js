import { featureDatasets } from '../sonification/adapters/mlFeatures.js'

// Regional views are cut out of the same display image as the global view, using the same lon/lat boxes the ML
// region numbers were computed from. No extra image files exist: the browser just shows a zoomed window of the
// frame, so the picture always matches the numbers.
//
// A view is { left, top, width, height } in fractions of the whole image, plus `aspect` (pixel width / height)
// and, for flat maps, the region boxes drawn inside the window.

const RAD = Math.PI / 180
const PAD = 0.07                       // breathing room around the region, as a share of its own size
const ASPECT_MIN = 1.25
const ASPECT_MAX = 2.6                 // a very wide strip (Antarctica) is made taller instead of shown as a sliver
// The globe frames were fitted with this limb radius in analysis pixels (ml_co2/scripts/fit_camera.py).
const GLOBE_LIMB_RADIUS = 960
const GLOBE_MIN_FRONT = 0.12           // ignore points squashed right at the globe edge when sizing the window

const clamp = (value, low, high) => Math.min(high, Math.max(low, value))

// Resize [low, high] (image fractions) to `size`, centred where possible and kept inside 0..1.
function fitSpan(low, high, size) {
  size = Math.min(1, size)
  const start = clamp((low + high) / 2 - size / 2, 0, 1 - size)
  return [start, start + size]
}

// Grow a window so its pixel aspect ratio lands inside the allowed range, then keep it inside the image.
function framed([u0, u1], [v0, v1], imageAspect) {
  let width = (u1 - u0) * (1 + 2 * PAD)
  let height = (v1 - v0) * (1 + 2 * PAD)
  const aspect = () => (width * imageAspect) / height
  if (aspect() > ASPECT_MAX) height = (width * imageAspect) / ASPECT_MAX
  if (aspect() < ASPECT_MIN) width = (height * ASPECT_MIN) / imageAspect
  const [left] = fitSpan(u0, u1, width)
  const [top] = fitSpan(v0, v1, height)
  width = Math.min(1, width)
  height = Math.min(1, height)
  return { left, top, width, height, aspect: (width * imageAspect) / height }
}

// Flat equirectangular maps: longitude and latitude map linearly onto the image.
export function flatRegionView(boxes, imageAspect) {
  const fractions = boxes.map(([west, east, south, north]) => ({
    u0: (west + 180) / 360, u1: (east + 180) / 360, v0: (90 - north) / 180, v1: (90 - south) / 180,
  }))
  const view = framed(
    [Math.min(...fractions.map(f => f.u0)), Math.max(...fractions.map(f => f.u1))],
    [Math.min(...fractions.map(f => f.v0)), Math.max(...fractions.map(f => f.v1))],
    imageAspect,
  )
  return {
    ...view,
    outlines: fractions.map(f => ({
      left: (f.u0 - view.left) / view.width, top: (f.v0 - view.top) / view.height,
      width: (f.u1 - f.u0) / view.width, height: (f.v1 - f.v0) / view.height,
    })),
  }
}

// Orthographic projection of a lon/lat onto the globe frame, using the estimated camera of that frame.
// This is the exact inverse of the pixel -> lon/lat conversion used when the regional numbers were computed.
export function projectToGlobe(lon, lat, camera, disc, resolution) {
  const lat0 = camera.centerLat * RAD
  const dLon = (lon - camera.centerLon) * RAD
  const phi = lat * RAD
  const front = Math.sin(lat0) * Math.sin(phi) + Math.cos(lat0) * Math.cos(phi) * Math.cos(dLon)
  const u = Math.cos(phi) * Math.sin(dLon)
  const v = Math.cos(lat0) * Math.sin(phi) - Math.sin(lat0) * Math.cos(phi) * Math.cos(dLon)
  const roll = camera.rollDeg * RAD
  const u0 = Math.cos(roll) * u - Math.sin(roll) * v
  const v0 = Math.sin(roll) * u + Math.cos(roll) * v
  return {
    front,
    x: (disc.centerX + GLOBE_LIMB_RADIUS * u0) / resolution[0],
    y: (disc.centerY - GLOBE_LIMB_RADIUS * v0) / resolution[1],
  }
}

export function globeRegionView(boxes, camera, disc, resolution) {
  const points = []
  for (const [west, east, south, north] of boxes) {
    for (let lon = west; lon <= east + 1e-9; lon += 3) {
      for (let lat = south; lat <= north + 1e-9; lat += 3) {
        const point = projectToGlobe(lon, lat, camera, disc, resolution)
        if (point.front > GLOBE_MIN_FRONT) points.push(point)
      }
    }
  }
  if (!points.length) return null
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  return {
    ...framed([Math.min(...xs), Math.max(...xs)], [Math.min(...ys), Math.max(...ys)], resolution[0] / resolution[1]),
    outlines: [],
    approximate: true,
  }
}

// What to show for a region at one observation.
//   null                     -> not a regional view (global, or no ML data for this story)
//   { status: 'ok', view }   -> show this window of the frame
//   { status: 'hidden', visibleFraction } -> CO₂ only: the region faces away from the camera in this frame
export function getRegionView(kind, step, regionId) {
  const dataset = featureDatasets[kind]
  if (!dataset || regionId === 'global') return null
  const region = dataset.regions.find(item => item.id === regionId)
  const frame = dataset.frames.find(item => item[dataset.step] === step)
  const [width, height] = dataset.resolution ?? []
  if (!region?.boxes || !frame || !(width > 0 && height > 0)) return null

  if (kind !== 'co2') return { status: 'ok', view: flatRegionView(region.boxes, width / height) }

  const raw = frame.regions?.[regionId]
  if (!raw || !frame.camera || !dataset.globeDisc) return null
  if (raw.reliable !== true) return { status: 'hidden', visibleFraction: raw.visibleFraction ?? 0 }
  const view = globeRegionView(region.boxes, frame.camera, dataset.globeDisc, [width, height])
  return view ? { status: 'ok', view } : { status: 'hidden', visibleFraction: raw.visibleFraction ?? 0 }
}
