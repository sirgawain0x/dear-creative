/** Whether TTS/audio may continue or fall back after navigation teardown or fetch abort. */
export function mayContinuePlayback(
  sessionActive: boolean,
  aborted = false,
): boolean {
  return sessionActive && !aborted;
}
