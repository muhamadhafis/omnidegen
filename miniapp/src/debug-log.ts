// Ring buffer log ringan untuk diagnosa (connect wallet, linking, deep-link).
// Selalu aktif (murah), ditampilkan hanya saat ?debug=1.
export type LogEntry = { t: string; msg: string };

const MAX = 120;
const entries: LogEntry[] = [];
const listeners = new Set<() => void>();

function stamp(): string {
  try {
    return new Date().toISOString().slice(11, 19);
  } catch {
    return "??:??:??";
  }
}

export function dlog(msg: string) {
  entries.push({ t: stamp(), msg });
  if (entries.length > MAX) entries.splice(0, entries.length - MAX);
  try {
    console.log(`[miniapp] ${msg}`);
  } catch { /* abaikan */ }
  listeners.forEach((fn) => {
    try {
      fn();
    } catch { /* abaikan */ }
  });
}

export function getLogs(): LogEntry[] {
  return entries.slice();
}

export function subscribeLogs(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

let hooksOn = false;
// Tangkap error yang selama ini "tenggelam" (skipped errors).
export function installGlobalLogHooks() {
  if (hooksOn) return;
  hooksOn = true;
  try {
    window.addEventListener("error", (e) => dlog(`window.onerror: ${(e as ErrorEvent).message || "?"}`));
    window.addEventListener("unhandledrejection", (e) => {
      const r = (e as PromiseRejectionEvent).reason;
      dlog(`unhandledrejection: ${r instanceof Error ? r.message : String(r).slice(0, 200)}`);
    });
  } catch { /* abaikan */ }
}
