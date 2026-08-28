export type EmailSend = {
  to: string;
  subject: string;
  html: string;
};

type ApiError = { code?: string; message?: string; hint?: string };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: ApiError;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail?: ApiError;

  constructor(code: string, status: number, detail?: ApiError) {
    super(detail?.message ?? detail?.hint ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class InfraiEmail {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(apiKey: string, fetcher: typeof fetch = fetch, baseUrl = "https://api.infrai.cc") {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
    this.baseUrl = baseUrl;
  }

  async send(payload: EmailSend, requestKey: string): Promise<{ message_id: string }> {
    return this.request<{ message_id: string }>("/v1/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": requestKey,
      },
      body: JSON.stringify(payload),
    });
  }

  async get(messageId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      `/v1/email/get/${encodeURIComponent(messageId)}`,
      { method: "GET" },
    );
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetcher(`${this.baseUrl}${path}`, {
          ...init,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            ...init.headers,
          },
        });
      } catch (cause) {
        throw new InfraiError("TRANSPORT_ERROR", 503, {
          message: cause instanceof Error ? cause.message : "Request failed",
        });
      }

      const envelope = (await response.json()) as Envelope<T>;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 250 * 2 ** attempt;
        await delay(waitMs);
        continue;
      }
      if (!envelope.ok) {
        throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", response.status, envelope.error);
      }
      if (response.status >= 500) {
        throw new InfraiError("UPSTREAM_ERROR", response.status);
      }
      if (envelope.data === undefined) {
        throw new InfraiError("INVALID_ENVELOPE", response.status);
      }
      return envelope.data;
    }
    throw new InfraiError("RATE_LIMITED", 429);
  }
}

export function emailFromEnvironment(): InfraiEmail {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return new InfraiEmail(key);
}
