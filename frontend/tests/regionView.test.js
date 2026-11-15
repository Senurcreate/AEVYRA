import assert from 'node:assert/strict'
import test from 'node:test'
import { featureDatasets } from '../src/sonification/adapters/mlFeatures.js'
import { flatRegionView, getRegionView, projectToGlobe } from '../src/data/regionView.js'

const inside = (view, eps = 1e-9) => view.left >= -eps && view.top >= -eps &&
  view.left + view.width <= 1 + eps && view.top + view.height <= 1 + eps && view.width > 0 && view.height > 0

test('global and unknown stories have no regional view', () => {
  assert.equal(getRegionView('aerosols', 200, 'global'), null)
  assert.equal(getRegionView('nope', 1, 'asia'), null)
  assert.equal(getRegionView('aerosols', 999999, 'asia'), null)
})

test('flat-map regions are windows of the global image that contain the whole region', () => {
  for (const kind of ['night-lights', 'aerosols']) {
    const dataset = featureDatasets[kind]
    const [width, height] = dataset.resolution
    for (const region of dataset.regions) {
      const info = getRegionView(kind, dataset.frames[0][dataset.step], region.id)
      assert.equal(info.status, 'ok', kind + '/' + region.id)
      const { view } = info
      assert.ok(inside(view), kind + '/' + region.id + ' stays inside the image')
      assert.ok(Math.abs(view.aspect - (view.width * width) / (view.height * height)) < 1e-9)
      for (const [west, east, south, north] of region.boxes) {
        assert.ok(view.left <= (west + 180) / 360 + 1e-9 && view.left + view.width >= (east + 180) / 360 - 1e-9, region.id + ' width')
        assert.ok(view.top <= (90 - north) / 180 + 1e-9 && view.top + view.height >= (90 - south) / 180 - 1e-9, region.id + ' height')
      }
      for (const box of view.outlines) {
        assert.ok(box.left >= -1e-9 && box.top >= -1e-9 && box.left + box.width <= 1 + 1e-9 && box.top + box.height <= 1 + 1e-9)
      }
      assert.ok(view.aspect >= 1.2 && view.aspect <= 2.7, region.id + ' aspect ' + view.aspect)
    }
  }
})

test('a region view is the same for every frame of a flat map, and never a thin sliver', () => {
  const dataset = featureDatasets.aerosols
  const first = getRegionView('aerosols', dataset.frames[0][dataset.step], 'antarctica').view
  const last = getRegionView('aerosols', dataset.frames.at(-1)[dataset.step], 'antarctica').view
  assert.deepEqual(first, last)
  assert.ok(first.height > 0.1, 'Antarctica is a very wide strip, so its window is made taller')
})

test('Africa on a flat map frames Africa', () => {
  const africa = flatRegionView([[-20, 52, -36, 12], [-20, 35, 12, 36]], 2).outlines
  assert.equal(africa.length, 2)
})

function globeInverse(x, y, camera, disc, resolution) {
  const rad = Math.PI / 180
  const u0 = (x * resolution[0] - disc.centerX) / 960
  const v0 = (disc.centerY - y * resolution[1]) / 960
  const c = Math.cos(camera.rollDeg * rad)
  const s = Math.sin(camera.rollDeg * rad)
  const u = c * u0 + s * v0
  const v = -s * u0 + c * v0
  const z = Math.sqrt(Math.max(0, 1 - u * u - v * v))
  const lat0 = camera.centerLat * rad
  return {
    lat: Math.asin(z * Math.sin(lat0) + v * Math.cos(lat0)) / rad,
    lon: camera.centerLon + Math.atan2(u, z * Math.cos(lat0) - v * Math.sin(lat0)) / rad,
  }
}

test('globe projection is the exact inverse of the pixel to lon/lat conversion used for the ML regions', () => {
  const dataset = featureDatasets.co2
  for (const frame of dataset.frames) {
    for (const [x, y] of [[0.5, 0.5], [0.42, 0.4], [0.55, 0.62], [0.47, 0.3]]) {
      const { lon, lat } = globeInverse(x, y, frame.camera, dataset.globeDisc, dataset.resolution)
      const back = projectToGlobe(lon, lat, frame.camera, dataset.globeDisc, dataset.resolution)
      assert.ok(Math.abs(back.x - x) < 1e-6 && Math.abs(back.y - y) < 1e-6, 'frame ' + frame.frameNumber)
      assert.ok(back.front > 0)
    }
  }
})

test('CO₂ regions get a window only when the ML data trusts them, and the window sits on the globe', () => {
  const dataset = featureDatasets.co2
  let shown = 0
  let hidden = 0
  for (const frame of dataset.frames) {
    for (const region of dataset.regions) {
      const raw = frame.regions[region.id]
      const info = getRegionView('co2', frame.frameNumber, region.id)
      if (raw.reliable) {
        assert.equal(info.status, 'ok', 'frame ' + frame.frameNumber + ' ' + region.id)
        assert.ok(inside(info.view), 'window inside the image')
        assert.ok(info.view.approximate)
        // the window must overlap the visible globe disc
        const cx = info.view.left + info.view.width / 2
        const cy = info.view.top + info.view.height / 2
        const dx = (cx * dataset.resolution[0] - dataset.globeDisc.centerX) / 960
        const dy = (cy * dataset.resolution[1] - dataset.globeDisc.centerY) / 960
        assert.ok(Math.hypot(dx, dy) < 1.15, 'window centre is on or near the globe')
        shown++
      } else {
        assert.equal(info.status, 'hidden')
        assert.ok(info.visibleFraction < 0.5)
        hidden++
      }
    }
  }
  assert.ok(shown > 10 && hidden > 5, shown + ' shown, ' + hidden + ' hidden')
})
