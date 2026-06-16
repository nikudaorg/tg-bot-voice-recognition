export type AppConfig = {
  openaiApiKey: string;
  telegramBotToken: string;
  telegramWebhookSecret: string;
  webhookSetupSecret: string;
  openaiTranscriptionModel: string;
  allowedTelegramUserIds: Set<number>;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseAllowedTelegramUserIds(): Set<number> {
  const raw = requireEnv("ALLOWED_TELEGRAM_USER_IDS");
  const ids = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const parsed = Number(value);
      if (!Number.isInteger(parsed)) {
        throw new Error(
          "ALLOWED_TELEGRAM_USER_IDS must be a comma-separated list of integer Telegram user IDs.",
        );
      }
      return parsed;
    });

  if (ids.length === 0) {
    throw new Error("ALLOWED_TELEGRAM_USER_IDS must contain at least one Telegram user ID.");
  }

  return new Set(ids);
}

export function getConfig(): AppConfig {
  return {
    openaiApiKey: requireEnv("OPENAI_API_KEY"),
    telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
    telegramWebhookSecret: requireEnv("TELEGRAM_WEBHOOK_SECRET"),
    webhookSetupSecret: requireEnv("WEBHOOK_SETUP_SECRET"),
    openaiTranscriptionModel:
      process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || "gpt-4o-mini-transcribe",
    allowedTelegramUserIds: parseAllowedTelegramUserIds(),
  };
}
