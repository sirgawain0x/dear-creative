/** Client-side phases while Adam is producing a chat reply (UI only). */
export type AdamAgentGenerationPhase =
  | "idle"
  | "waiting"
  | "streaming"
  | "done"
  | "error";

export function isAdamChatBusy(phase: AdamAgentGenerationPhase): boolean {
  return phase === "waiting" || phase === "streaming";
}

export function adamChatAriaBusy(phase: AdamAgentGenerationPhase): boolean {
  return isAdamChatBusy(phase);
}

export function adamChatLiveStatusLabel(
  phase: AdamAgentGenerationPhase,
): string | null {
  switch (phase) {
    case "waiting":
      return "Adam is thinking";
    case "streaming":
      return "Adam is responding";
    case "error":
      return "Adam could not finish the response";
    default:
      return null;
  }
}
