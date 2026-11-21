import { cookies } from "next/headers";

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing or empty ${name} — check .env.local in the project root (web-app/)`
    );
  }
  return value;
}

const ACCESS_TOKEN = "g_access_token";
const REFRESH_TOKEN = "g_refresh_token";
const EXPIRES_AT = "g_expires_at";

const COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function saveTokens(tokens: {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}) {
  const store = await cookies();
  store.set(ACCESS_TOKEN, tokens.access_token, {
    ...COOKIE,
    maxAge: 60 * 60 * 24 * 30,
  });
  if (tokens.refresh_token) {
    store.set(REFRESH_TOKEN, tokens.refresh_token, {
      ...COOKIE,
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  const expiresIn = tokens.expires_in ?? 3600;
  store.set(EXPIRES_AT, String(Date.now() + expiresIn * 1000), {
    ...COOKIE,
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearTokens() {
  const store = await cookies();
  store.delete(ACCESS_TOKEN);
  store.delete(REFRESH_TOKEN);
  store.delete(EXPIRES_AT);
}

export async function isConnected(): Promise<boolean> {
  const store = await cookies();
  return Boolean(store.get(ACCESS_TOKEN)?.value || store.get(REFRESH_TOKEN)?.value);
}

async function refreshAccessToken(): Promise<string | null> {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_TOKEN)?.value;
  if (!refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;

  const data = await res.json();
  if (!data.access_token) return null;
  await saveTokens({
    access_token: data.access_token,
    refresh_token: refreshToken,
    expires_in: data.expires_in,
  });
  return data.access_token as string;
}

export async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  const accessToken = store.get(ACCESS_TOKEN)?.value;
  const expiresAt = Number(store.get(EXPIRES_AT)?.value ?? 0);

  if (accessToken && Date.now() < expiresAt - 60_000) return accessToken;
  return refreshAccessToken();
}

const CALENDAR_EVENTS_URL =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1";

/**
 * Google's dateTime parser is strict RFC3339. Our clients send naive
 * datetimes like "2026-11-25T10:00" (from <input type="datetime-local">),
 * so normalize them to include seconds: "2026-11-25T10:00:00".
 * Values that already carry seconds or a UTC offset are returned unchanged.
 */
export function normalizeCalendarDateTime(value: string): string | null {
  if (Number.isNaN(Date.parse(value))) return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/.exec(value);
  if (m) return `${m[1]}T${m[2]}:${m[3] ?? "00"}`;
  return value;
}

/**
 * Extract the human-readable error from a Google API response body so the
 * exact cause (status, reason, message) can be logged and shown to the user.
 */
export function describeGoogleError(status: number, body: unknown): string {
  const b = body as {
    error?:
      | string
      | {
          message?: string;
          status?: string;
          errors?: { reason?: string; message?: string }[];
        };
    error_description?: string;
  } | null;

  const err = b?.error;
  const message =
    (typeof err === "object" ? err?.message : undefined) ??
    b?.error_description ??
    (typeof err === "string" ? err : undefined) ??
    (typeof body === "string" && body
      ? body.slice(0, 300)
      : "Unknown error");
  const reason =
    typeof err === "object" && err?.errors?.[0]?.reason
      ? ` [${err.errors[0].reason}]`
      : "";
  const statusLabel =
    typeof err === "object" && err?.status ? ` (${err.status})` : "";
  return `Google API error ${status}${reason}${statusLabel}: ${message}`;
}

/**
 * Insert a Calendar event with conferenceData. Parses the body safely (never
 * throws on non-JSON error pages) and logs the full status + body to the
 * server console whenever Google rejects the request.
 */
export async function createCalendarEvent(
  accessToken: string,
  payload: Record<string, unknown>
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(CALENDAR_EVENTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 500) };
    }
  }

  if (!res.ok) {
    console.error(
      `[google-calendar] event insert failed — HTTP ${res.status}`,
      text
    );
  }

  return { status: res.status, body };
}
