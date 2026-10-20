/**
 * Schedules PCM chunks from Kokoro on the main thread Web Audio graph.
 */
export class KokoroStreamPlayer {
  private context: AudioContext | null = null;
  private nextStartTime = 0;
  private totalSamples = 0;
  private sampleRate = 24_000;
  private paused = false;
  private pauseStartedAt = 0;
  private pauseOffsetSec = 0;

  get estimatedDurationSec(): number {
    return this.totalSamples / this.sampleRate;
  }

  get currentTimeSec(): number {
    if (!this.context) {
      return 0;
    }
    if (this.paused) {
      return this.pauseOffsetSec;
    }
    return Math.max(0, this.context.currentTime - this.pauseStartedAt + this.pauseOffsetSec);
  }

  async ensureContext(): Promise<AudioContext> {
    if (!this.context) {
      this.context = new AudioContext();
      this.nextStartTime = this.context.currentTime;
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
    return this.context;
  }

  async enqueuePcm(audio: Float32Array, samplingRate: number): Promise<void> {
    const ctx = await this.ensureContext();
    this.sampleRate = samplingRate;
    const buffer = ctx.createBuffer(1, audio.length, samplingRate);
    buffer.copyToChannel(new Float32Array(audio), 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startAt = Math.max(this.nextStartTime, ctx.currentTime);
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;
    this.totalSamples += audio.length;
  }

  async pause(): Promise<void> {
    if (!this.context || this.paused) {
      return;
    }
    this.pauseOffsetSec = this.currentTimeSec;
    this.pauseStartedAt = this.context.currentTime;
    this.paused = true;
    await this.context.suspend();
  }

  async resume(): Promise<void> {
    if (!this.context || !this.paused) {
      return;
    }
    this.paused = false;
    await this.context.resume();
    this.pauseStartedAt = this.context.currentTime;
  }

  setPlaybackRate(rate: number): void {
    // Kokoro chunks are pre-rendered; changing rate would require re-synthesis.
    void rate;
  }

  async stop(): Promise<void> {
    if (this.context) {
      await this.context.close();
    }
    this.context = null;
    this.nextStartTime = 0;
    this.totalSamples = 0;
    this.paused = false;
    this.pauseOffsetSec = 0;
    this.pauseStartedAt = 0;
  }
}
