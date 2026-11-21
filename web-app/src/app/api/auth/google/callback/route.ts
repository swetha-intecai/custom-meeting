import { NextRequest, NextResponse } from "next/server";
import {
  saveTokens,
  requiredEnv,
  createCalendarEvent,
  describeGoogleError,
  normalizeCalendarDateTime,
} from "@/lib/google";

type MeetingState = {
  title: string;
  start: string;
  end: string;
  tz: string;
};

function parseState(raw: string): MeetingState | null {
  const p = new URLSearchParams(raw);
  const start = p.get("start");
  const end = p.get("end");
  if (!start || !end) return null;

  const normStart = normalizeCalendarDateTime(start);
  const normEnd = normalizeCalendarDateTime(end);
  if (!normStart || !normEnd) return null;
  if (new Date(normEnd) <= new Date(normStart)) return null;

  return {
    title: p.get("title")?.trim() || "Meeting",
    start: normStart,
    end: normEnd,
    tz: p.get("tz") || "UTC",
  };
}

export async function GET(req: NextRequest) {
  const fail = (message: string) => {
    console.error(`[oauth-callback] ${message}`);
    return NextResponse.redirect(
      new URL(`/meeting-created?error=${encodeURIComponent(message)}`, req.url)
    );
  };

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) return fail(`Google authorization failed (${error})`);
  if (!code) return fail("Missing OAuth code");

  let clientId: string, clientSecret: string, redirectUri: string;
  try {
    clientId = requiredEnv("GOOGLE_CLIENT_ID");
    clientSecret = requiredEnv("GOOGLE_CLIENT_SECRET");
    redirectUri = requiredEnv("GOOGLE_REDIRECT_URI");
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Configuration error");
  }

  // 1. Exchange authorization code for access_token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenText = await tokenRes.text();
  let tokens: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: unknown;
    error_description?: string;
  } = {};
  try {
    tokens = tokenText ? JSON.parse(tokenText) : {};
  } catch {
    tokens = {};
  }

  if (!tokenRes.ok || !tokens.access_token) {
    const tokenError =
      tokens.error || tokens.error_description ? tokens : tokenText;
    return fail(
      `Token exchange failed — ${describeGoogleError(tokenRes.status, tokenError)}`
    );
  }

  const accessToken = tokens.access_token;

  // Store tokens so future meetings are generated without re-authorizing
  await saveTokens({ ...tokens, access_token: accessToken });

  const rawState = req.nextUrl.searchParams.get("state");
  if (!rawState) {
    // Plain connect (no meeting data) — send the user back ready to generate
    return NextResponse.redirect(new URL("/?auth=connected", req.url));
  }

  const meeting = parseState(rawState);
  if (!meeting) {
    return fail(
      "Invalid or expired meeting details in OAuth state — please generate again"
    );
  }

  // 2. Create the Calendar event with the user's chosen date and time
  const { status, body: event } = await createCalendarEvent(accessToken, {
    summary: meeting.title,
    start: { dateTime: meeting.start, timeZone: meeting.tz },
    end: { dateTime: meeting.end, timeZone: meeting.tz },
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  });

  if (status < 200 || status >= 300) {
    return fail(
      `Calendar event creation failed — ${describeGoogleError(status, event)}`
    );
  }

  const e = event as {
    hangoutLink?: string;
    htmlLink?: string;
    conferenceData?: {
      entryPoints?: { uri?: string }[];
      status?: { statusCode?: string };
    };
  };
  const meetLink = e?.hangoutLink ?? e?.conferenceData?.entryPoints?.[0]?.uri;

  if (!meetLink) {
    // Event exists but Google returned no Meet link — log the full payload
    // so we can see conferenceData.status / entryPoints and why.
    console.error(
      "[oauth-callback] event created (HTTP 2xx) but no Meet link in response:",
      JSON.stringify(event)
    );
    return fail(
      `Google created the event but returned no Meet link (conferenceData.status: ${
        e?.conferenceData?.status?.statusCode ?? "n/a"
      }) — check that Google Meet is enabled for this account`
    );
  }

  // 3. Redirect to the result page with everything needed for sharing
  const redirectUrl = new URL("/meeting-created", req.url);
  redirectUrl.searchParams.set("meetLink", meetLink);
  redirectUrl.searchParams.set("title", meeting.title);
  redirectUrl.searchParams.set("start", meeting.start);
  redirectUrl.searchParams.set("end", meeting.end);
  redirectUrl.searchParams.set("tz", meeting.tz);
  if (e.htmlLink) {
    redirectUrl.searchParams.set("eventHtmlLink", e.htmlLink);
  }

  return NextResponse.redirect(redirectUrl);
}
