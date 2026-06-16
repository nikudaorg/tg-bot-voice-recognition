# Telegram Voice Transcriber for Vercel

A Telegram bot that:

- receives `voice` and `audio` messages
- asks for confirmation before transcribing
- sends the file to OpenAI speech-to-text
- streams partial transcript drafts to Telegram using the current Bot API draft streaming method
- posts the final transcript back into the chat

## Deploy

1. Push this repo to GitHub.
2. Import it into Vercel.
3. Add these environment variables:

```bash
OPENAI_API_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
WEBHOOK_SETUP_SECRET=...
ALLOWED_TELEGRAM_USER_IDS=123456789,987654321
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
```

4. Deploy.
5. Open:

```text
https://your-domain.example/api/setup-webhook?secret=YOUR_WEBHOOK_SETUP_SECRET
```

That registers `https://your-domain.example/api/telegram` as the Telegram webhook and sets Telegram's secret token header.

## Local dev

```bash
npm install
npm run dev
```

Then expose the local server with a tunnel and point Telegram webhook setup at the public URL.

## Notes

- The webhook handler is stateless, so it works on Vercel without Redis or a database.
- Access is restricted to Telegram user IDs listed in `ALLOWED_TELEGRAM_USER_IDS`.
- Telegram draft streaming currently targets private chats. In non-private chats, the bot still sends the final transcript.
- Transcript text is sanitized and HTML-escaped before sending to Telegram so accidental formatting characters do not break the output.

## References

- OpenAI speech-to-text guide: https://developers.openai.com/api/docs/guides/speech-to-text
- OpenAI transcription API reference: https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create
- Telegram Bot API: https://core.telegram.org/bots/api
- Vercel Functions: https://vercel.com/docs/functions
