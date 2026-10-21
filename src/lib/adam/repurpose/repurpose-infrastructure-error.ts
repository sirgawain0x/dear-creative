/** Fail-fast when repurpose media pipeline prerequisites are missing (ffmpeg, slide render). */
export class RepurposeInfrastructureError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly clientMessage: string,
    readonly code: string,
    logDetail?: string,
  ) {
    super(logDetail ?? clientMessage);
    this.name = "RepurposeInfrastructureError";
  }
}
