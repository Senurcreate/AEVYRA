import type { EicFrameTelemetry, SpatialCell } from '../types/sonification';

export type MLFrame = { frameId:string; year:number; image:string; litShare:number; meanBrightness:number; centroidX:number; changeVsPrev:number|null; grewShare:number|null; fadedShare:number|null; strips:number[][]; verified?:boolean };
export type MLFeatures = {storyId:string; frames:MLFrame[]};
const clamp=(v:number,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(v)?v:min));
const avg=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
export function adaptNightLights(data:MLFeatures):EicFrameTelemetry[] {
 const frames=[...data.frames].sort((a,b)=>a.year-b.year);
 if(!frames.length)return [];
 const baseline=frames.find(f=>f.year===2012);
 if(!baseline)throw Error('2012 reference frame is required');
 if(new Set(frames.map(f=>f.year)).size!==frames.length)throw Error('Duplicate years');
 const maxNet=Math.max(1e-8,...frames.map(f=>Math.abs((f.grewShare??0)-(f.fadedShare??0))));
 const maxCumulative=Math.max(1e-8,...frames.map(f=>Math.abs(f.litShare-baseline.litShare)));
 return frames.map((f,index)=>{
  if(f.strips.length!==baseline.strips.length||!f.strips.length)throw Error(`Invalid spatial strips in ${f.year}`);
  const spatialCells:SpatialCell[]=f.strips.map((strip,i)=>{
   const bs=baseline.strips[i];
   // Tier-weighted visual proxy; weights are artistic, not calibrated radiance.
   const brightness=(s:number[])=>clamp((s[1]??0)*0.33+(s[2]??0)*0.67+(s[3]??0));
   return {x:(i+.5)/f.strips.length,y:.5,intensity:brightness(strip),coverage:clamp(1-(strip[0]??1)),delta:clamp(brightness(strip)-brightness(bs),-1,1)};
  });
  const coverages=spatialCells.map(c=>c.coverage), mean=avg(coverages);
  const concentration=clamp(Math.sqrt(avg(coverages.map(v=>(v-mean)**2)))*2);
  const net=(f.grewShare??0)-(f.fadedShare??0);
  const increase=clamp(f.grewShare??0), decrease=clamp(f.fadedShare??0);
  return {
   datasetId:'night-lights-2012-2023',frameIndex:index,timestampSec:index*2.4,
   sourceFilename:f.image,phase:'annual',year:f.year,
   metrics:{globalIntensity:clamp(f.meanBrightness),litCoverage:clamp(f.litShare),spatialDensity:concentration,
    yearOverYearDelta:clamp(net/maxNet,-1,1),cumulativeDelta:clamp((f.litShare-baseline.litShare)/maxCumulative,-1,1),
    hotspotAnomaly:clamp(Math.max(...spatialCells.map(c=>Math.abs(c.delta)))),increaseFraction:increase,decreaseFraction:decrease},
   spatialCells,
   accessibilitySummary:`${f.year}: ${(f.litShare*100).toFixed(3)}% of analyzed pixels classified as illuminated; mean visual brightness ${f.meanBrightness.toFixed(6)}. ${f.verified===false?'ML features not independently verified.':''}`,
   metadata:{extractionMethod:'ml',processingVersion:'adapter-2.0.0-unverified',referenceYear:2012}
  };
 });
}
