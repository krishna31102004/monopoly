import type { GameLogEntry } from "@/types/game";

type GameLogProps = {
  entries: GameLogEntry[];
};

export function GameLog({ entries }: GameLogProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            Game Log
          </p>
          <h2 className="text-base font-black text-slate-950">Recent Actions</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
          {entries.length}
        </span>
      </div>

      <ol className="max-h-52 overflow-y-auto divide-y divide-slate-100">
        {entries.map((entry, index) => (
          <li
            key={entry.id}
            className={`flex items-start gap-2 px-4 py-2.5 ${
              index === 0 ? "bg-slate-50" : ""
            }`}
          >
            {index === 0 ? (
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
            ) : (
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-200" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-xs leading-5 ${index === 0 ? "font-bold text-slate-900" : "font-semibold text-slate-600"}`}>
                {entry.message}
              </p>
              <time className="text-[9px] font-semibold text-slate-400">
                {new Date(entry.createdAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </time>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
