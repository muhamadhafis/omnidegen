// Minimal Telegram WebApp binding (tanpa dep tambahan).
export function tg(): any {
  return (window as any)?.Telegram?.WebApp;
}

export function initTelegram() {
  try {
    tg()?.ready();
    tg()?.expand();
  } catch {
    /* bukan di Telegram: jalan sebagai web biasa */
  }
}

export function shortAddr(a?: string): string {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}
