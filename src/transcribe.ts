import OpenAI from "openai";

import { getConfig } from "./config.js";

export type TranscriptionStreamCallbacks = {
  onDelta?: (text: string) => Promise<void> | void;
};

type TranscriptEvent = {
  type: string;
  delta?: string;
  text?: string;
};

const openai = new OpenAI({
  apiKey: getConfig().openaiApiKey,
});

export async function transcribeAudio(
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
  callbacks: TranscriptionStreamCallbacks = {},
): Promise<string> {
  const { openaiTranscriptionModel } = getConfig();
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

  const file = new File([buffer], filename, {
    type: mimeType || "application/octet-stream",
  });

  const stream = (await openai.audio.transcriptions.create({
    file,
    model: openaiTranscriptionModel,
    response_format: "text",
    stream: true,
  })) as AsyncIterable<TranscriptEvent>;

  let fullText = "";

  for await (const event of stream) {
    if (event.type === "transcript.text.delta" && event.delta) {
      fullText += event.delta;
      await callbacks.onDelta?.(fullText);
    }

    if (event.type === "transcript.text.done" && event.text) {
      fullText = event.text;
    }
  }

  return fullText.trim();
}
