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

// True di dalam Telegram (Mini App maupun browser internal Telegram).
// initData hanya diisi saat dibuka sebagai Mini App; UA "Telegram" menutup
// kasus dibuka sebagai link biasa di browser internal Telegram.
export function inTelegram(): boolean {
  try {
    const w = tg();
    if (!!w && typeof w.initData === "string" && w.initData.length > 0) return true;
  } catch { /* lanjut cek UA */ }
  try {
    return /telegram/i.test(navigator.userAgent);
  } catch {
    return false;
  }
}

// Webview Telegram mati (ERR_UNKNOWN_URL_SCHEME) kalau ada navigasi top-level
// ke scheme mentah (metamask://…). Pola kanonis: tulis ulang scheme menjadi
// universal link https lalu buka via Telegram.WebApp.openLink (eksternal,
// aman). Privy membuka dompet via window.open(url) dan/atau anchor,
// jadi kedua vektor dicegat di sini.
let schemePatchOn = false;
let schemeHintShown = false;

const WEB_SCHEME = /^(https?|about|blob|data|javascript|mailto|tel):/i;
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

// Scheme dompet → basis universal link https (path+query dipertahankan,
// termasuk ?uri= WalletConnect). Di luar daftar ini: jangan tebak.
const SCHEME_TO_UNIVERSAL: Array<[RegExp, string]> = [
  [/^metamask:\/\//i, "https://metamask.app.link/"],
  [/^trust:\/\//i, "https://link.trustwallet.com/"],
  [/^rainbow:\/\//i, "https://rnbwapp.com/"],
  [/^cbwallet:\/\//i, "https://go.cb-w.com/"],
];

// Host universal link dompet: navigasi same-window ke sini pun harus lewat
// openLink agar Mini App tidak ditinggalkan.
const WALLET_UNIVERSAL_HOST = /^(metamask\.app\.link|link\.trustwallet\.com|rnbwapp\.com|go\.cb-w\.com)([/:?#]|$)/i;

function toUniversal(raw: string): string {
  for (const [re, base] of SCHEME_TO_UNIVERSAL) {
    if (re.test(raw)) return base + raw.replace(re, "").replace(/^\/+/, "");
  }
  return raw;
}

function isWalletHttp(url: string): boolean {
  const m = url.match(/^https?:\/\/([^/?#:]+)/i);
  return !!m && WALLET_UNIVERSAL_HOST.test(m[1]);
}

function showSchemeHintOnce() {
  if (schemeHintShown) return;
  schemeHintShown = true;
  try {
    tg()?.showAlert("Buka aplikasi dompetmu untuk approve, lalu kembali ke sini.");
  } catch { /* abaikan */ }
}

function openSchemeViaIframe(url: string) {
  try {
    const f = document.createElement("iframe");
    f.style.display = "none";
    f.src = url;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 2000);
  } catch { /* abaikan */ }
}

export function patchCustomSchemeOpen() {
  if (schemePatchOn) return;
  schemePatchOn = true;
  const openExternalHttps = (url: string, fallback: (url: string) => void) => {
    try {
      const w = tg();
      if (w?.openLink) {
        w.openLink(url);
        return;
      }
    } catch { /* jatuh ke fallback */ }
    fallback(url);
  };
  // Kembalikan true bila URL ditangani (jangan teruskan ke aslinya).
  const handleUrl = (raw: string, openBlank: (url: string) => void): boolean => {
    const u = String(raw ?? "");
    if (ANY_SCHEME.test(u) && !WEB_SCHEME.test(u)) {
      const uni = toUniversal(u);
      if (/^https?:\/\//i.test(uni)) openExternalHttps(uni, openBlank);
      else openSchemeViaIframe(u); // scheme tak dikenal: tanpa navigasi
      showSchemeHintOnce();
      return true;
    }
    if (isWalletHttp(u)) {
      openExternalHttps(u, openBlank);
      showSchemeHintOnce();
      return true;
    }
    return false;
  };
  try {
    // Vektor 1: window.open("metamask://…", …)
    const orig = window.open.bind(window);
    const blank = (url: string) => {
      try {
        orig(url, "_blank", "noopener");
      } catch { /* abaikan */ }
    };
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      try {
        if (handleUrl(String(url ?? ""), blank)) return null;
      } catch { /* jatuh ke aslinya */ }
      return orig(url, target, features);
    }) as typeof window.open;
    // Vektor 2: ketuk anchor <a href="metamask://…"> (atau .click() sintetis)
    document.addEventListener(
      "click",
      (ev) => {
        try {
          const el = ev.target as HTMLElement | null;
          const a = el?.closest?.("a[href]") as HTMLAnchorElement | null;
          if (!a) return;
          if (handleUrl(a.getAttribute("href") ?? "", blank)) {
            ev.preventDefault();
            ev.stopPropagation();
          }
        } catch { /* abaikan */ }
      },
      true,
    );
  } catch { /* abaikan */ }
}
