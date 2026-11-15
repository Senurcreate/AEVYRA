import type { DatasetSonificationProfile, EicDatasetId } from '../types/sonification';
import { nightLightsProfile } from './nightLightsProfile';
const profiles: Partial<Record<EicDatasetId, DatasetSonificationProfile>> = {
  [nightLightsProfile.datasetId]: nightLightsProfile,
};
export function getSonificationProfile(id: EicDatasetId): DatasetSonificationProfile {
  const profile = profiles[id];
  if (!profile) throw new Error(`No sonification profile registered for ${id}`);
  return profile;
}
