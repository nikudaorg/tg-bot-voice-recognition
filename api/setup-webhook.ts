import { getConfig } from "../src/config.js";
import { getRequestUrl } from "../src/http.js";
import { setWebhook } from "../src/telegram.js";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const { webhookSetupSecret } = getConfig();
  const url = getRequestUrl(request);
  const secret = url.searchParams.get("secret");

  if (secret !== webhookSetupSecret) {
    return json({ ok: false, error: "Invalid setup secret." }, 401);
  }

  const webhookUrl = `${url.origin}/api/telegram`;
  await setWebhook(webhookUrl);

  return json({
    ok: true,
    webhookUrl,
  });
}
