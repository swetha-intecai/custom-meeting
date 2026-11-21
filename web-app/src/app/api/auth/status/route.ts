import { NextResponse } from "next/server";
import { isConnected } from "@/lib/google";

export async function GET() {
  return NextResponse.json({ connected: await isConnected() });
}
