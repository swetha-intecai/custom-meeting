import { NextRequest, NextResponse } from "next/server";
import { requiredEnv } from "@/lib/google";

export async function GET(request: NextRequest) {
  let authUrl: string;
  try {
    const params = new URLSearchParams({
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      redirect_uri: requiredEnv("GOOGLE_REDIRECT_URI"),
      response_type: "code",
      scope: "https://www.googleapis.com/auth/calendar.events",
      access_type: "offline",
      prompt: "consent",
    });

    // Forward the meeting form data (title/start/end/tz) through OAuth so the
    // callback can create the event with the user's chosen times.
    const state = request.nextUrl.searchParams.get("state");
    if (state) params.set("state", state);

    authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Configuration error" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(authUrl);
}
