import { getConfig } from "../src/config.js";
import { setWebhook } from "../src/telegram.js";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function getRequestUrl(request: Request): URL {
  try {
    return new URL(request.url);
  } catch {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (!host) {
      throw new Error("Unable to determine request host.");
    }

    const proto = request.headers.get("x-forwarded-proto") || "https";
    return new URL(request.url, `${proto}://${host}`);
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
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
