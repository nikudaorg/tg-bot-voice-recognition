import { getConfig } from "../src/config.js";
import { handleTelegramUpdate } from "../src/handlers.js";
import { readJson } from "../src/http.js";
import type { TelegramUpdate } from "../src/telegram.js";

export async function POST(request: Request): Promise<Response> {
  const config = getConfig();
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
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
