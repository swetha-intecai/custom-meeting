"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  title: string;
  date: string;
  start: string;
  end: string;
};

const inputClass =
  "h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10";

const labelClass =
  "flex flex-col gap-1.5 text-[13px] font-medium text-zinc-600";

function addMinutes(hhmm: string, mins: number): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  let total = Number(m[1]) * 60 + Number(m[2]) + mins;
  if (total >= 24 * 60) total = 24 * 60 - 1;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60
  ).padStart(2, "0")}`;
}

function Logo() {
  return (
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
  );
}

export default function HomePage() {
  const [form, setForm] = useState<FormState>({
    title: "",
    date: "",
    start: "10:00",
    end: "10:30",
  });
  const [timezone, setTimezone] = useState("");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d) => {
        const auth = params.get("auth");
        setConnected(auth === "connected" || Boolean(d.connected));
        setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
        setForm((f) => ({
          ...f,
          date: f.date || new Date().toISOString().slice(0, 10),
        }));
        if (auth === "connected") {
          setNotice("Google connected — you're ready to generate.");
          window.history.replaceState({}, "", "/");
        }
        if (auth === "error") {
          setError(
            `Google authorization failed (${params.get("reason") ?? "unknown"})`
          );
        }
      })
      .catch(() => setConnected(false));
  }, []);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const title = form.title.trim();
    const start = `${form.date}T${form.start}`;
    const end = `${form.date}T${form.end}`;
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (!title) return setError("Please enter a meeting title.");
    if (!form.date || !form.start || !form.end)
      return setError("Please pick a date, start time and end time.");
    if (new Date(end) <= new Date(start))
      return setError("End time must be after the start time.");

    const payload = {
      title,
      start,
      end,
      timezone: tz,
    };

    setPending(true);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (!data.meetLink) {
          setError(
            "The event was created but Google returned no Meet link — check that Google Meet is enabled for your account."
          );
          return;
        }
        const q = new URLSearchParams({
          meetLink: data.meetLink,
          title: data.title,
          start: data.start,
          end: data.          end,
          tz,
        });
        if (data.eventHtmlLink) q.set("eventHtmlLink", data.eventHtmlLink);
        router.push(`/meeting-created?${q.toString()}`);
        return;
      }

      if (res.status === 401) {
        // Not connected yet (or session expired) — go through Google OAuth
        // carrying the form data in `state` so the callback can create the
        // event with the chosen times.
        const state = new URLSearchParams({
          title,
          start,
          end,
          tz,
        });
        // Hard navigation: the OAuth route responds with a redirect to
        // Google, which the client-side router cannot follow.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(
          `${window.location.origin}/api/auth/google?${new URLSearchParams({
            state: state.toString(),
          })}`
        );
        return;
      }

      const data = await res.json().catch(() => null);
      setError(
        data?.error ??
          data?.details?.error?.message ??
          "Something went wrong. Please try again."
      );
    } catch {
      setError("Network error — please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden font-sans text-zinc-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_85%_-10%,rgba(36,200,117,0.18),transparent_60%),radial-gradient(50%_40%_at_0%_100%,rgba(38,132,252,0.12),transparent_60%)]"
      />

      <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8 sm:py-12">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="text-[15px] font-semibold tracking-tight">
              Meet Link Generator
            </span>
          </div>
          {connected !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-600 backdrop-blur">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connected ? "bg-emerald-500" : "bg-zinc-400"
                }`}
              />
              {connected ? "Google connected" : "Not connected"}
            </span>
          )}
        </header>

        <section className="mt-10 text-center sm:mt-14 sm:text-left">
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Create a Google Meet link{" "}
            <span className="text-emerald-600">in seconds</span>
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-600">
            Pick a date and time, generate a shareable Meet link, and send it
            straight to your participants on WhatsApp.
          </p>
        </section>

        {notice && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {notice}
          </div>
        )}
        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-7 rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-[0_10px_40px_-18px_rgba(0,0,0,0.18)] sm:p-7"
        >
          <label className={labelClass}>
            Meeting title
            <input
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Sprint planning"
              className={inputClass}
            />
          </label>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className={labelClass}>
              Date
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => update("date", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Start time
              <input
                type="time"
                required
                value={form.start}
                onChange={(e) => {
                  update("start", e.target.value);
                  const next = addMinutes(e.target.value, 30);
                  if (next) update("end", next);
                }}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              End time
              <input
                type="time"
                required
                value={form.end}
                onChange={(e) => update("end", e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <div className="mt-4 flex items-center gap-1.5 text-xs text-zinc-500">
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" strokeLinecap="round" />
            </svg>
            Times are in your timezone
            {timezone ? ` · ${timezone}` : ""}
          </div>

          <button
            type="submit"
            disabled={pending}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-500 hover:to-green-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="opacity-25"
                  />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <rect x="2.5" y="6.5" width="12.5" height="11" rx="2.5" />
                  <path d="M16.5 10.2 21.5 7v10l-5-3.2z" />
                </svg>
                Generate Meet Link
              </>
            )}
          </button>

          <p className="mt-3 text-center text-xs text-zinc-500">
            First time? You&apos;ll approve Google access once — after that,
            generation is instant.
          </p>
        </form>

        <ol className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["1", "Pick a time", "Choose your meeting date, start and end."],
            ["2", "Generate link", "We create the event and Meet link."],
            ["3", "Share it", "Copy the link or send it on WhatsApp."],
          ].map(([n, title, desc]) => (
            <li
              key={n}
              className="rounded-2xl border border-zinc-200/80 bg-white/70 p-4 backdrop-blur"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                {n}
              </span>
              <p className="mt-2 text-sm font-semibold">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                {desc}
              </p>
            </li>
          ))}
        </ol>

        <footer className="mt-auto pt-10 text-center text-xs text-zinc-400">
          Meetings are created in your Google Calendar · Google Meet link
          generator
        </footer>
      </div>
    </main>
  );
}
