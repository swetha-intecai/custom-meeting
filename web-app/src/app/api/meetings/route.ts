import { NextResponse } from "next/server";
import {
  getAccessToken,
  clearTokens,
  createCalendarEvent,
  describeGoogleError,
  normalizeCalendarDateTime,
} from "@/lib/google";

type MeetingBody = {
  title?: string;
  start?: string;
  end?: string;
  timezone?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as MeetingBody;

  const title = body.title?.trim() || "Custom Meeting";
  const timezone = body.timezone || "UTC";
  if (!body.start || !body.end) {
    return NextResponse.json(
      { error: "start and end are required (ISO 8601)" },
      { status: 400 }
    );
  }

  const start = normalizeCalendarDateTime(body.start);
  const end = normalizeCalendarDateTime(body.end);
  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end must be valid ISO 8601 datetimes" },
      { status: 400 }
    );
  }
  if (new Date(end) <= new Date(start)) {
    return NextResponse.json(
      { error: "end must be after start" },
      { status: 400 }
    );
  }

  const payload = {
    summary: title,
    start: { dateTime: start, timeZone: timezone },
    end: { dateTime: end, timeZone: timezone },
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  let accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: "not_authorized", authUrl: "/api/auth/google" },
      { status: 401 }
    );
  }

  let { status, body: event } = await createCalendarEvent(accessToken, payload);

  if (status === 401) {
    accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { error: "not_authorized", authUrl: "/api/auth/google" },
        { status: 401 }
      );
    }
    ({ status, body: event } = await createCalendarEvent(accessToken, payload));
    if (status === 401) await clearTokens();
  }

  if (status < 200 || status >= 300) {
    return NextResponse.json(
      {
        error: describeGoogleError(status, event),
        status,
        details: event,
      },
      { status: status === 401 ? 401 : 502 }
    );
  }

  const e = event as {
    hangoutLink?: string;
    htmlLink?: string;
    conferenceData?: { entryPoints?: { uri?: string }[] };
  };
  const meetLink = e?.hangoutLink ?? e?.conferenceData?.entryPoints?.[0]?.uri ?? null;

  if (!meetLink) {
    console.error(
      "[api/meetings] event created (HTTP 2xx) but no Meet link:",
      JSON.stringify(event)
    );
    return NextResponse.json(
      {
        error:
          "Google created the event but returned no Meet link — check that Google Meet is enabled for this account",
        status,
        details: event,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    title,
    start,
    end,
    meetLink,
    eventHtmlLink: e.htmlLink,
  });
}
