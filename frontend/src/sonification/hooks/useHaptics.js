import { useSyncExternalStore } from 'react'
import { getHapticsEnabled, hapticsSupported, setHapticsEnabled, subscribeHaptics } from '../haptics/HapticPlayer.js'

// `supported` is false on iPhone, desktops and Firefox for Android, where the control is hidden.
export function useHaptics() {
  const enabled = useSyncExternalStore(subscribeHaptics, getHapticsEnabled, () => true)
  return { supported: hapticsSupported(), enabled, setEnabled: setHapticsEnabled }
}
