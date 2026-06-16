import { getConfig } from "../src/config.js";
import { getMethod, getRequestUrl, type RequestLike } from "../src/http.js";
import { setWebhook } from "../src/telegram.js";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export default async function handler(request: RequestLike): Promise<Response> {
  if (getMethod(request) !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

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
