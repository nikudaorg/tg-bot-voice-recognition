import { getConfig } from "../src/config.js";
import { handleTelegramUpdate } from "../src/handlers.js";
import type { TelegramUpdate } from "../src/telegram.js";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const config = getConfig();
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== config.telegramWebhookSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
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
