import type { EicFrameTelemetry } from '../types/sonification';

export class VideoTelemetryScheduler {
  private frames: EicFrameTelemetry[];
  private raf: number | null = null;
  private lastIndex = -1;
  constructor(
    private video: HTMLVideoElement,
    frames: EicFrameTelemetry[],
    private onFrame: (frame: EicFrameTelemetry) => void,
  ) {
    this.frames = [...frames].sort((a,b) => a.timestampSec-b.timestampSec);
    if (this.frames.some((f,i) => i>0 && f.timestampSec === this.frames[i-1].timestampSec)) {
      throw new Error('Duplicate telemetry timestamps');
    }
  }
  private findFrameIndex(time: number): number {
    let low=0, high=this.frames.length-1, result=-1;
    while (low<=high) {
      const mid=(low+high)>>>1;
      if (this.frames[mid].timestampSec <= time) { result=mid; low=mid+1; }
      else high=mid-1;
    }
    return result;
  }
  private tick = () => {
    const index=this.findFrameIndex(this.video.currentTime);
    if (index!==this.lastIndex) {
      this.lastIndex=index;
      if (index>=0) this.onFrame(this.frames[index]);
    }
    if (!this.video.paused && !this.video.ended) this.raf=requestAnimationFrame(this.tick);
    else this.raf=null;
  };
  start(): void {
    this.stop();
    this.lastIndex=-1;
    this.tick();
  }
  /** Seek can be called on video seeking/seeked events. */
  refresh(): void {
    this.lastIndex=-1;
    const index=this.findFrameIndex(this.video.currentTime);
    this.lastIndex=index;
    if (index>=0) this.onFrame(this.frames[index]);
  }
  stop(): void {
    if (this.raf!==null) cancelAnimationFrame(this.raf);
    this.raf=null;
  }
}
