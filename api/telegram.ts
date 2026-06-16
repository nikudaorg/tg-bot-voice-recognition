import { getConfig } from "../src/config.js";
import { handleTelegramUpdate } from "../src/handlers.js";
import { getHeader, getMethod, readJson, type RequestLike } from "../src/http.js";
import type { TelegramUpdate } from "../src/telegram.js";

type TelegramRequestLike = RequestLike & {
  json?: () => Promise<unknown>;
};

export default async function handler(request: TelegramRequestLike): Promise<Response> {
  if (getMethod(request) !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const config = getConfig();
  const secret = getHeader(request, "x-telegram-bot-api-secret-token");
  if (secret !== config.telegramWebhookSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await readJson<TelegramUpdate>(request);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  try {
    await handleTelegramUpdate(update);
  } catch (error) {
    console.error(error);
  }

  return new Response("ok");
}
