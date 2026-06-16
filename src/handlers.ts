import {
  answerCallbackQuery,
  editConfirmationMessage,
  extractAudioSource,
  getFileBytes,
  isPrivateChat,
  sanitizeTranscriptText,
  sendConfirmation,
  sendDraft,
  sendErrorMessage,
  sendFinalTranscript,
  sendUnauthorizedMessage,
  type TelegramMessage,
  type TelegramUpdate,
} from "./telegram.js";
import { getConfig } from "./config.js";
import { transcribeAudio } from "./transcribe.js";

function sourceFilename(message: TelegramMessage, kind: "voice" | "audio"): string {
  if (kind === "audio" && message.audio?.file_name) {
    return message.audio.file_name;
  }
  if (kind === "voice") {
    return "voice-message.ogg";
  }
  return "audio-file";
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  if (update.message) {
    if (!isAuthorizedMessage(update.message)) {
      if (update.message.chat.type === "private") {
        await sendUnauthorizedMessage(update.message.chat.id);
      }
      return;
    }

    await handleIncomingMessage(update.message);
    return;
  }

  if (update.callback_query) {
    if (!isAuthorizedCallback(update.callback_query)) {
      await answerCallbackQuery(update.callback_query.id, "Not allowed.");
      return;
    }

    await handleCallback(update.callback_query);
  }
}

async function handleIncomingMessage(message: TelegramMessage): Promise<void> {
  if (!extractAudioSource(message)) {
    return;
  }

  await sendConfirmation(message);
}

async function handleCallback(
  callbackQuery: NonNullable<TelegramUpdate["callback_query"]>,
): Promise<void> {
  const action = callbackQuery.data;
  const confirmationMessage = callbackQuery.message;

  if (!action || !confirmationMessage) {
    await answerCallbackQuery(callbackQuery.id, "Missing callback context.");
    return;
  }

  const originalMessage = confirmationMessage.reply_to_message;
  const source = originalMessage ? extractAudioSource(originalMessage) : null;

  if (action === "tx:cancel") {
    await answerCallbackQuery(callbackQuery.id, "Cancelled.");
    await editConfirmationMessage(
      confirmationMessage.chat.id,
      confirmationMessage.message_id,
      "Cancelled.",
    );
    return;
  }

  if (action !== "tx:confirm" || !originalMessage || !source) {
    await answerCallbackQuery(callbackQuery.id, "The original audio is no longer available.");
    await editConfirmationMessage(
      confirmationMessage.chat.id,
      confirmationMessage.message_id,
      "The original audio is no longer available. Send it again.",
    );
    return;
  }

  await answerCallbackQuery(callbackQuery.id, "Transcribing...");
  await editConfirmationMessage(
    confirmationMessage.chat.id,
    confirmationMessage.message_id,
    "Transcribing...",
  );

  try {
    const { bytes, filePath } = await getFileBytes(source.file.file_id);
    const filename = sourceFilename(originalMessage, source.kind);
    const mimeType = source.file.mime_type || mimeTypeFromPath(filePath);

    let lastDraftSentAt = 0;
    let lastDraftText = "";
    const transcript = sanitizeTranscriptText(
      await transcribeAudio(bytes, filename, mimeType, {
        onDelta: async (partialText) => {
          if (!isPrivateChat(confirmationMessage)) {
            return;
          }

          const now = Date.now();
          const text = sanitizeTranscriptText(partialText);
          if (!text || text === lastDraftText) {
            return;
          }

          if (now - lastDraftSentAt < 500) {
            return;
          }

          lastDraftText = text;
          lastDraftSentAt = now;
          await sendDraft(
            confirmationMessage.chat.id,
            originalMessage.message_id,
            text,
          );
        },
      }),
    );

    await sendFinalTranscript(
      confirmationMessage.chat.id,
      originalMessage.message_id,
      transcript,
    );
    await editConfirmationMessage(
      confirmationMessage.chat.id,
      confirmationMessage.message_id,
      "Transcription sent.",
    );
  } catch (error) {
    console.error(error);
    await sendErrorMessage(confirmationMessage.chat.id, originalMessage.message_id);
    await editConfirmationMessage(
      confirmationMessage.chat.id,
      confirmationMessage.message_id,
      "Transcription failed.",
    );
  }
}

function mimeTypeFromPath(filePath: string): string {
  const normalized = filePath.toLowerCase();
  if (normalized.endsWith(".ogg")) {
    return "audio/ogg";
  }
  if (normalized.endsWith(".mp3")) {
    return "audio/mpeg";
  }
  if (normalized.endsWith(".m4a")) {
    return "audio/mp4";
  }
  if (normalized.endsWith(".wav")) {
    return "audio/wav";
  }
  if (normalized.endsWith(".webm")) {
    return "audio/webm";
  }
  return "application/octet-stream";
}

function isAuthorizedMessage(message: TelegramMessage): boolean {
  const userId = message.from?.id;
  if (userId === undefined) {
    return false;
  }

  return getConfig().allowedTelegramUserIds.has(userId);
}

function isAuthorizedCallback(
  callbackQuery: NonNullable<TelegramUpdate["callback_query"]>,
): boolean {
  const userId = callbackQuery.from?.id;
  if (userId === undefined) {
    return false;
  }

  return getConfig().allowedTelegramUserIds.has(userId);
}
