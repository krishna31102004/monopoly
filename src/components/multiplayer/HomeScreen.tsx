"use client";

import Link from "next/link";

export function HomeScreen() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-sm text-center">
        {/* Title */}
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
          Private Board Game
        </div>
        <h1 className="mb-1 text-4xl font-black tracking-tight text-white">
          World Cities
        </h1>
        <p className="mb-10 text-sm text-slate-400">
          A city-themed Monopoly-style game for friends.
        </p>

        {/* Action cards */}
        <div className="grid gap-3">
          {/* Local play */}
          <Link
            href="/play"
            className="block rounded-xl border border-slate-700 bg-slate-900 px-6 py-4 text-left transition hover:border-slate-600 hover:bg-slate-800"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Pass &amp; Play
            </p>
            <p className="mt-0.5 text-lg font-black text-white">Play Local</p>
            <p className="mt-1 text-xs text-slate-400">
              One device, multiple players taking turns.
            </p>
          </Link>

          {/* Create private room */}
          <Link
            href="/create"
            className="block rounded-xl border border-emerald-700 bg-emerald-950 px-6 py-4 text-left transition hover:border-emerald-500 hover:bg-emerald-900"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
              Multiplayer
            </p>
            <p className="mt-0.5 text-lg font-black text-emerald-100">
              Create Private Room
            </p>
            <p className="mt-1 text-xs text-emerald-400">
              Get a room code and invite up to 5 friends.
            </p>
          </Link>

          {/* Join room */}
          <Link
            href="/join"
            className="block rounded-xl border border-slate-700 bg-slate-900 px-6 py-4 text-left transition hover:border-slate-600 hover:bg-slate-800"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Multiplayer
            </p>
            <p className="mt-0.5 text-lg font-black text-white">Join a Room</p>
            <p className="mt-1 text-xs text-slate-400">
              Enter a room code shared by the host.
            </p>
          </Link>
        </div>

        <p className="mt-10 text-xs text-slate-600">
          Private rooms only. No accounts. No strangers.
        </p>
      </div>
    </main>
  );
}
