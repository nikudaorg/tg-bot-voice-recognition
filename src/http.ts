type HeaderBag =
  | Headers
  | Record<string, string | string[] | undefined>
  | undefined;

export type RequestLike = {
  headers?: HeaderBag;
  method?: string;
  url?: string;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
};

function isHeadersInstance(headers: HeaderBag): headers is Headers {
  return typeof Headers !== "undefined" && headers instanceof Headers;
}

export function getHeader(request: RequestLike, name: string): string | null {
  const headers = request.headers;
  if (!headers) {
    return null;
  }

  if (isHeadersInstance(headers)) {
    return headers.get(name);
  }

  const direct = headers[name];
  const lower = headers[name.toLowerCase()];
  const value = direct ?? lower;

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function getMethod(request: RequestLike): string {
  return request.method || "GET";
}

export function getRequestUrl(request: RequestLike): URL {
  const rawUrl = request.url || "/";

  try {
    return new URL(rawUrl);
  } catch {
    const host = getHeader(request, "x-forwarded-host") || getHeader(request, "host");
    if (!host) {
      throw new Error("Unable to determine request host.");
    }

    const proto = getHeader(request, "x-forwarded-proto") || "https";
    return new URL(rawUrl, `${proto}://${host}`);
  }
}

export async function readJson<T>(request: RequestLike): Promise<T> {
  const maybeRequest = request as Request & { json?: () => Promise<unknown> };
  if (typeof maybeRequest.json === "function") {
    return (await maybeRequest.json()) as T;
  }

  const body = await readRawBody(request);
  return JSON.parse(body) as T;
}

async function readRawBody(request: RequestLike): Promise<string> {
  if (typeof request.on !== "function") {
    throw new Error("Request body reader is not available.");
  }

  return await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on!("data", (chunk: unknown) => {
      if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk));
        return;
      }

      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
        return;
      }

      chunks.push(Buffer.from(chunk as ArrayBuffer));
    });

    request.on!("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    request.on!("error", (error: unknown) => {
      reject(error);
    });
  });
}
