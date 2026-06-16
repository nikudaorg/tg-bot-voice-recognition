import { getConfig } from "./config.js";

export type TelegramFileRef = {
  file_id: string;
  file_size?: number;
  mime_type?: string;
  file_name?: string;
};

export type TelegramMessage = {
  message_id: number;
  chat: {
    id: number;
    type: string;
  };
  from?: {
    id: number;
  };
  text?: string;
  voice?: TelegramFileRef;
  audio?: TelegramFileRef;
  reply_to_message?: TelegramMessage;
};

export type TelegramCallbackQuery = {
  id: string;
  from?: {
    id: number;
  };
  data?: string;
  message?: TelegramMessage;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramFile = {
  file_path: string;
  file_size?: number;
};

type RichMessagePayload = {
  chat_id: number;
  rich_message: {
    html: string;
    skip_entity_detection: boolean;
  };
  reply_parameters?: {
    message_id: number;
  };
};

const TELEGRAM_API_BASE = "https://api.telegram.org";
const DRAFT_WINDOW_LIMIT = 3600;
const FINAL_CHUNK_LIMIT = 3500;

function telegramApiUrl(method: string): string {
  const { telegramBotToken } = getConfig();
  return `${TELEGRAM_API_BASE}/bot${telegramBotToken}/${method}`;
}

function telegramFileUrl(filePath: string): string {
  const { telegramBotToken } = getConfig();
  return `${TELEGRAM_API_BASE}/file/bot${telegramBotToken}/${filePath}`;
}

async function telegramRequest<T>(method: string, body: unknown): Promise<T> {
  const response = await fetch(telegramApiUrl(method), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Telegram ${method} failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as TelegramApiResponse<T>;
  if (!payload.ok || payload.result === undefined) {
    throw new Error(payload.description || `Telegram ${method} failed`);
  }

  return payload.result;
}

export function extractAudioSource(message: TelegramMessage): {
  kind: "voice" | "audio";
  file: TelegramFileRef;
} | null {
  if (message.voice) {
    return { kind: "voice", file: message.voice };
  }
  if (message.audio) {
    return { kind: "audio", file: message.audio };
  }
  return null;
}

export function isPrivateChat(message: TelegramMessage): boolean {
  return message.chat.type === "private";
}

export function sanitizeTranscriptText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[^\P{Cc}\n\t]/gu, "")
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function toRichHtml(title: string | undefined, text: string): string {
  const safeText = escapeHtml(text) || '(empty transcript)';
  return title !== undefined
    ? `<b>${escapeHtml(title)}</b>\n\n${safeText}`
    : safeText;
}

function sliceDraftWindow(text: string): string {
  if (text.length <= DRAFT_WINDOW_LIMIT) {
    return text;
  }
  return `...${text.slice(-DRAFT_WINDOW_LIMIT + 3)}`;
}

function chunkText(text: string): string[] {
  if (!text) {
    return ["(empty transcript)"];
  }

  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > FINAL_CHUNK_LIMIT) {
    let splitAt = remaining.lastIndexOf("\n", FINAL_CHUNK_LIMIT);
    if (splitAt < FINAL_CHUNK_LIMIT / 2) {
      splitAt = remaining.lastIndexOf(" ", FINAL_CHUNK_LIMIT);
    }
    if (splitAt < FINAL_CHUNK_LIMIT / 2) {
      splitAt = FINAL_CHUNK_LIMIT;
    }

    parts.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining) {
    parts.push(remaining);
  }

  return parts;
}

export async function sendConfirmation(message: TelegramMessage): Promise<void> {
  const source = extractAudioSource(message);
  if (!source) {
    return;
  }

  const label = source.kind === "voice" ? "voice message" : "audio file";
  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,
    text: `Transcribe this ${label}?`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Transcribe", callback_data: "tx:confirm" },
          { text: "Cancel", callback_data: "tx:cancel" },
        ],
      ],
    },
    reply_parameters: {
      message_id: message.message_id,
    },
  });
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  await telegramRequest("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  });
}

export async function editConfirmationMessage(
  chatId: number,
  messageId: number,
  text: string,
): Promise<void> {
  await telegramRequest("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
  });
}

export async function sendDraft(chatId: number, draftId: number, text: string): Promise<void> {
  await telegramRequest("sendRichMessageDraft", {
    chat_id: chatId,
    draft_id: draftId,
    rich_message: {
      html: toRichHtml("Transcribing...", sliceDraftWindow(text)),
      skip_entity_detection: true,
    },
  });
}

export async function sendFinalTranscript(
  chatId: number,
  replyToMessageId: number,
  transcript: string,
): Promise<void> {
  const parts = chunkText(transcript);

  for (let index = 0; index < parts.length; index += 1) {
    // const title =
    //   parts.length === 1 ? "Transcript" : `Transcript (${index + 1}/${parts.length})`;

    const payload: RichMessagePayload = {
      chat_id: chatId,
      rich_message: {
        html: toRichHtml(undefined, parts[index]),
        skip_entity_detection: true
      }
    };

    if (index === 0) {
      payload.reply_parameters = { message_id: replyToMessageId };
    }

    await telegramRequest('sendRichMessage', payload);
  }
}

export async function sendErrorMessage(chatId: number, replyToMessageId: number): Promise<void> {
  await telegramRequest("sendMessage", {
    chat_id: chatId,
    text: "Transcription failed. Try again with a shorter or clearer recording.",
    reply_parameters: {
      message_id: replyToMessageId,
    },
  });
}

export async function sendUnauthorizedMessage(chatId: number): Promise<void> {
  await telegramRequest("sendMessage", {
    chat_id: chatId,
    text: "You are not allowed to use this bot.",
  });
}

export async function getFileBytes(fileId: string): Promise<{
  bytes: Uint8Array;
  filePath: string;
}> {
  const file = await telegramRequest<TelegramFile>("getFile", {
    file_id: fileId,
  });

  const response = await fetch(telegramFileUrl(file.file_path));
  if (!response.ok) {
    throw new Error(`Telegram file download failed with HTTP ${response.status}`);
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    filePath: file.file_path,
  };
}

export async function setWebhook(webhookUrl: string): Promise<void> {
  const { telegramWebhookSecret } = getConfig();
  await telegramRequest("setWebhook", {
    url: webhookUrl,
    secret_token: telegramWebhookSecret,
    allowed_updates: ["message", "callback_query"],
  });
}
