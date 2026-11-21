"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type Share = {
  meetLink: string;
  title: string;
  dateStr: string;
  timeStr: string;
  tz: string;
};

function buildWhatsAppText({ meetLink, title, dateStr, timeStr, tz }: Share) {
  return [
    "Hi!",
    "",
    `You're invited to *${title}*.`,
    "",
    `📅 Date: ${dateStr}`,
    `🕐 Time: ${timeStr}${tz ? ` (${tz})` : ""}`,
    "",
    "Join the Google Meet:",
    meetLink,
  ].join("\n");
}

function CopyButton({
  onCopy,
  children,
  variant = "dark",
}: {
  onCopy: () => void;
  children: React.ReactNode;
  variant?: "dark" | "outline";
}) {
  const [copied, setCopied] = useState(false);

  const handle = async () => {
    await onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const styles =
    variant === "dark"
      ? "bg-zinc-900 text-white hover:bg-zinc-700"
      : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50";

  return (
    <button
      type="button"
      onClick={handle}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${styles}`}
    >
      {copied ? (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden
        >
          <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <rect
            x="9"
            y="9"
            width="12"
            height="12"
            rx="2"
            className="stroke-current"
          />
          <path
            d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
            strokeLinecap="round"
          />
        </svg>
      )}
      {copied ? "Copied!" : children}
    </button>
  );
}

function ResultCard() {
  const sp = useSearchParams();
  const meetLink = sp.get("meetLink");
  const title = sp.get("title") || "Meeting";
  const start = sp.get("start");
  const end = sp.get("end");
  const tz = sp.get("tz") || "";
  const eventHtmlLink = sp.get("eventHtmlLink");
  const error = sp.get("error");

  const share = useMemo<Share | null>(() => {
    if (!meetLink || !start || !end) return null;
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
    return {
      meetLink,
      title,
      dateStr: s.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      timeStr: `${s.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })} – ${e.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })}`,
      tz,
    };
  }, [meetLink, title, start, end, tz]);

  const whatsappText = share ? buildWhatsAppText(share) : "";

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-white p-6 shadow-[0_10px_40px_-18px_rgba(0,0,0,0.18)] sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden
          >
            <path d="M12 8v5M12 17h.01" strokeLinecap="round" />
            <circle cx="12" cy="12" r="9" />
          </svg>
          Something went wrong
        </span>
        <h1 className="mt-4 text-xl font-bold tracking-tight">
          Could not create the meeting
        </h1>
        <p className="mt-2 text-sm text-zinc-600">{error}</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white transition hover:bg-zinc-700"
        >
          ← Back to home
        </Link>
      </div>
    );
  }

  if (!meetLink || !share) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-[0_10px_40px_-18px_rgba(0,0,0,0.18)] sm:p-8">
        <h1 className="text-xl font-bold tracking-tight">No meeting found</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Generate a Meet link from the home page to see it here.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white transition hover:bg-zinc-700"
        >
          Create a meeting
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-[0_10px_40px_-18px_rgba(0,0,0,0.18)] sm:p-8">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden
        >
          <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Meeting ready
      </span>

      <h1 className="mt-4 text-2xl font-bold leading-tight tracking-tight">
        {title}
      </h1>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600">
        <span className="inline-flex items-center gap-1.5">
          <svg
            className="h-4 w-4 text-zinc-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4M16 3v4M3 11h18" strokeLinecap="round" />
          </svg>
          {share.dateStr}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg
            className="h-4 w-4 text-zinc-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" />
          </svg>
          {share.timeStr}
          {share.tz ? ` · ${share.tz}` : ""}
        </span>
      </div>

      {/* Meet link */}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex h-12 flex-1 items-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 px-4">
          <span className="truncate font-mono text-[13px] text-zinc-700">
            {meetLink}
          </span>
        </div>
        <CopyButton
          onCopy={() => navigator.clipboard.writeText(meetLink)}
          variant="dark"
        >
          Copy link
        </CopyButton>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a
          href={meetLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 px-5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-500 hover:to-green-400"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <rect x="2.5" y="6.5" width="12.5" height="11" rx="2.5" />
            <path d="M16.5 10.2 21.5 7v10l-5-3.2z" />
          </svg>
          Join Meet
        </a>
        {eventHtmlLink && (
          <a
            href={eventHtmlLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-900"
          >
            View in Google Calendar
          </a>
        )}
      </div>

      {/* WhatsApp share */}
      <div className="mt-7 border-t border-zinc-100 pt-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
            <svg
              className="h-4 w-4 text-emerald-600"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 2C6.5 2 2 6.1 2 11.2c0 1.8.5 3.5 1.5 5L2 22l6-1.6c1.2.5 2.5.8 3.9.8 5.5 0 10-4.1 10-9.2S17.5 2 12 2zm0 16.8c-1.3 0-2.6-.3-3.7-.9l-.4-.2-3.5.9.9-3.4-.2-.4c-.7-1.2-1.1-2.5-1.1-3.9C4 7.1 7.6 3.8 12 3.8s8 3.3 8 7.4-3.6 7.6-8 7.6z" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-semibold">Share on WhatsApp</p>
            <p className="text-xs text-zinc-500">
              Copy-pasteable message with date, time and link
            </p>
          </div>
        </div>

        <div className="mt-4 whitespace-pre-wrap rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm leading-relaxed text-zinc-700">
          {whatsappText}
        </div>

        <div className="mt-3 flex flex-wrap gap-2.5">
          <CopyButton
            onCopy={() => navigator.clipboard.writeText(whatsappText)}
            variant="outline"
          >
            Copy message
          </CopyButton>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 text-sm font-semibold text-white transition hover:bg-[#1fb857]"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 2C6.5 2 2 6.1 2 11.2c0 1.8.5 3.5 1.5 5L2 22l6-1.6c1.2.5 2.5.8 3.9.8 5.5 0 10-4.1 10-9.2S17.5 2 12 2zm0 16.8c-1.3 0-2.6-.3-3.7-.9l-.4-.2-3.5.9.9-3.4-.2-.4c-.7-1.2-1.1-2.5-1.1-3.9C4 7.1 7.6 3.8 12 3.8s8 3.3 8 7.4-3.6 7.6-8 7.6z" />
            </svg>
            Open WhatsApp
          </a>
        </div>
      </div>

      <div className="mt-7 border-t border-zinc-100 pt-5">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-500 underline underline-offset-4 hover:text-zinc-900"
        >
          ← Create another meeting
        </Link>
      </div>
    </div>
  );
}

export default function MeetingCreatedPage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden font-sans text-zinc-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_85%_-10%,rgba(36,200,117,0.18),transparent_60%),radial-gradient(50%_40%_at_0%_100%,rgba(38,132,252,0.12),transparent_60%)]"
      />
      <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-8 sm:py-12">
        <header className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-md shadow-emerald-500/25">
            <svg
              className="h-5 w-5 text-white"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <rect x="2.5" y="6.5" width="12.5" height="11" rx="2.5" />
              <path d="M16.5 10.2 21.5 7v10l-5-3.2z" />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Meet Link Generator
          </span>
        </header>

        <div className="mt-8">
          <Suspense
            fallback={
              <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
                Loading…
              </div>
            }
          >
            <ResultCard />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
