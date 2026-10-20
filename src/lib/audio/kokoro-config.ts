/** Hugging Face ONNX weights for in-browser Kokoro TTS (Apache-2.0). */
export const KOKORO_MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

export const KOKORO_DEFAULT_VOICE = "af_heart" as const;

export const KOKORO_DTYPE = "q8" as const;

/** Measured q8 ONNX weight file size from HF download progress (bytes). */
export const KOKORO_Q8_MODEL_BYTES = 92_361_116;
