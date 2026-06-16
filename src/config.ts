export type AppConfig = {
  openaiApiKey: string;
  telegramBotToken: string;
  telegramWebhookSecret: string;
  webhookSetupSecret: string;
  openaiTranscriptionModel: string;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getConfig(): AppConfig {
  return {
    openaiApiKey: requireEnv("OPENAI_API_KEY"),
    telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
    telegramWebhookSecret: requireEnv("TELEGRAM_WEBHOOK_SECRET"),
    webhookSetupSecret: requireEnv("WEBHOOK_SETUP_SECRET"),
    openaiTranscriptionModel:
      process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || "gpt-4o-mini-transcribe",
  };
}
