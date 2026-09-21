# Eksekusi reskin iOS terang (emas disetujui, mode DURING)

Semua rasio kontras di bawah TERVERIFIKASI contrast-check.py.
File yang disentuh hanya di miniapp/. Backend nol perubahan.

## 0. Verifikasi pra-eksekusi (telah jalan, PASS semua)

- #1C1C1E/putih 17.01, #636366/putih 5.99, #111/#F0B90B 10.48,
  #1C1C1E/#F0B90B 9.44, #1A7F37/putih 5.08, #D70015/putih 5.38,
  #005FCC/putih 5.98, #8A6D00/putih 4.92
- DITOLAK: #8E8E93 teks (3.26), #007AFF teks (4.02), #AEAEB2 (2.21),
  emas #F0B90B sebagai warna TEKS di putih (~1.6)

## 1. index.css — fondasi (anchor: baris 3-37 terverifikasi)

- Blok `@theme inline`: tambah `--color-link: var(--link);`,
  `--color-line: var(--line);`, `--color-amberink: var(--amberink);`
- `:root`: bg #F2F2F7, card #FFFFFF, text #1C1C1E, muted #636366,
  accent #F0B90B (tetap), accent-text #1C1C1E, green #1A7F37, red #D70015,
  border #D1D1D6, TAMBAH line #8E8E93, link #005FCC, amberink #8A6D00,
  color-scheme light. Alasan tiap warna: tabel §0 (R-31).
- `html color-scheme` → light.

## 2. index.css — komponen (nomor baris dari baca penuh 607 baris)

- `.status-card`: hapus `border-color: #363636` (ikut --border).
- `.badge`: border + color → var(--amberink) (label status real Testnet).
- `.tx`, `.utility-link`: color → var(--link); utility min-height 36→44.
- `.tx` tambah min-height:44px + align-items:center (sudah inline-flex).
- `.warn` → var(--amberink). `.err`/`.ok` otomatis ikut var.
- `.strategy-type` → var(--amberink).
- `.readiness-dot` → var(--amberink) (pending; ready hijau otomatis).
- `.tab-trigger`: hapus border (tanpa border tak ada isu boundary),
  min-height 36→44, radius 6→10; active: `background: var(--accent);
  color: #1C1C1E` (9.44 PASS, sinyal selected tak ambigu).
- `.icon-button, .tooltip-trigger`: tambah `position: relative;` +
  `::before { content:""; position:absolute; inset:-6px; }` (hit 44, visual 32
  tetap — diizinkan eksplisit oleh skill). Hover: bg rgba(0,0,0,0.05),
  color var(--text).
- Semua `outline: 2px solid var(--accent)` (icon-button/tooltip/a/tab/err)
  → `var(--link)` (alasan: emas 1.6:1 tak terlihat di putih).
- `.chips` (baru, WalletShortcuts selama ini unstyled!):
  `.chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }`
  `.chip { min-height:44px; padding:8px 14px; border:1px solid var(--line);
  border-radius:8px; background:var(--card); color:var(--text);
  font-size:14px; font-weight:600; }` (boundary 3.26 PASS via --line).
- Washes rgba → triplet baru: green (26,127,55), red (215,0,21);
  emas (240,185,11) dipertahankan (teks di atasnya --text 17:1, aman).
  Berlaku: .readiness(.is-ready border), .link-status×4, .strategy-status×4,
  .tx-*×3, icon/tooltip hover, tab active, spinner (spinner + alasan:
  selalu berdampingan teks status).
- `.strategy-item`, Surface/Notice borders → var(--border) otomatis.
- `.debug-log`: SENGAJA tetap gelap + komentar alasan (konsol debug).

## 3. Komponen tsx (ganti class/hardcode, tanpa ubah logika)

- Button.tsx: default `bg-[#1a1a1a]` → `bg-card`; `hover:border-accent` →
  `hover:border-line`; `focus-visible:outline-accent` → `outline-link`
  (3 kemunculan outline-accent: base cva). Primary emas+teks gelap TETAP.
- Input.tsx: `border-border` → `border-line`; `focus-visible:border-accent`
  → `border-link`; `ring-accent` → `ring-link`.
- slider.tsx: bubble `text-accent` → `text-foreground`; thumb
  `border-accent` → `border-amberink`; tambah hit area
  `relative before:absolute before:-inset-3 before:content-[""]`;
  `focus-visible:outline-accent` → `outline-link`; Range bg-accent TETAP
  + alasan (nilai selalu ada sebagai teks % + input).
- tooltip.tsx + popover.tsx: `bg-[#1a1a1a]` → `bg-card`;
  Arrow `fill-[#1a1a1a]` → `fill-card`; trigger `hover:text-accent` →
  `hover:text-foreground`, `hover:bg-accent/10` → `hover:bg-black/5`,
  `focus-visible:outline-accent` → `outline-link`.
- StatusBadge.tsx: pending `text-accent` → `text-muted` (5.99 PASS;
  ikon+teks eksplisit jadi bukan sinyal warna-saja).
- Surface.tsx: `rounded-lg` → `rounded-[14px]` (alasan: kartu grup iOS).
- config.ts:42 `theme: "dark"` → `"light"` (Privy modal ikut terang).
- index.html: theme-color `#0f1115` → `#F2F2F7`.
- telegram.ts initTelegram: tambah `setHeaderColor('#F2F2F7')` +
  `setBackgroundColor('#F2F2F7')` dalam try/catch (alasan: chrome Telegram
  selaras, tanpa kilat gelap). Verifikasi: aman bila API tak ada (catch).

## 4. Copy audit (grep saat eksekusi, tanpa ubah makna)

- Em dash: TIDAK ADA di UI Mini App (hanya `→`/`↗` sebagai penanda arah/link
  eksternal + teks arah aset — punya tujuan, dicatat di laporan).
- Emoji: TIDAK ADA di UI Mini App (hanya chat bot, di luar cakupan).
- CTA sudah spesifik (Wrap BNB/Approve Vault/Unwrap/Tukar — lolos R-15).
- Ikon Lucide: catat relevansi per ikon di laporan (dompet/panah/tanda:
  relevan; tak ada sparkle/bintang/robot).

## 5. Fase iOS bentuk + tipografi — SISA EKSEKUSI (tertunda permission)

Status saat plan ditulis: tema + TxLink/Section/SectionTitle SUDAH teraplikasi
(terverifikasi via grep); di bawah ini HANYA yang belum.

5a. Tipografi (index.css, anchor terverifikasi baris 61-74):
```diff
 h1 {
   margin: 0;
-  font-size: 18px;
-  letter-spacing: -0.01em;
+  font-size: 20px;
+  font-weight: 600;
+  letter-spacing: -0.02em;
 }
 
 h2 {
   display: flex;
   align-items: center;
   flex-wrap: wrap;
   gap: 6px;
   margin: 0 0 6px;
-  font-size: 14px;
+  font-size: 15px;
+  font-weight: 600;
+  letter-spacing: -0.01em;
 }
```
Alasan: Title 3 iOS 20 / Headline dikompres ke 15 demi kepadatan dompet.

5b. Segmented iOS (ganti sisa gaya tab emas; emas tetap di CTA+range):
```diff
+.token-tabs,
+.panel-tabs {
+  background: #e9e9ee;
+  border-radius: 10px;
+  padding: 3px;
+}
+
 .tab-trigger {
   width: 100%;
   min-width: 0;
   min-height: 44px;
   border: 0;
-  border-radius: 10px;
+  border-radius: 7px;
   padding: 6px 10px;
   background: transparent;
   color: var(--muted);
   font-size: 13px;
   font-weight: 600;
   white-space: nowrap;
   cursor: pointer;
   touch-action: manipulation;
   -webkit-tap-highlight-color: transparent;
 }
 
 .tab-trigger[data-state="active"] {
-  background: var(--accent);
-  color: #1c1c1e;
+  background: #ffffff;
+  color: #1c1c1e;
+  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
 }
```
CATATAN: blok `.token-tabs` lama (grid 2 kolom + gap) dan `.panel-tabs`
(grid 3 kolom + gap + margin) TETAP, hanya tambah background/radius/padding.
Kontras muted-di-track 4.95:1 PASS (terverifikasi script).

5c. Varian destructive (Button.tsx + 2 call sites):
```diff
       default: "border-line bg-card text-foreground hover:border-amberink",
       primary: "w-full border-accent bg-accent text-accent-foreground hover:brightness-95",
       ghost: "border-transparent bg-transparent text-foreground hover:border-line",
+      destructive: "border-transparent bg-transparent text-danger",
```
TokenTabs tombol Cabut Izin: `variant="ghost"` → `variant="destructive"`.
StrategiesPanel tombol X: `variant="ghost"` → `variant="destructive"`
(anchor: cari `variant="ghost"` di kedua file — masing-masing tepat 1).
Teks #D70015 5.38:1 PASS. Alasan: merah khusus aksi merusak (iOS idiom).

5d. Verifikasi: `bunx tsc --noEmit && bun run lint && bun run build`
(workdir miniapp) + tulis laporan Delivery Gate.

## 6. Fase Layout — komponen reusable (disetujui: TxLink + Section)

Keputusan sadar: segmented iOS asli menggantikan tab-aktif emas (override
keputusan sebelumnya — user kini minta bentuk iOS; emas tetap di CTA primer +
range slider sebagai aksen tunggal).

5a. Tipografi (mapping HIG, jaga kepadatan dompet):
- h1 judul app 18px → 20px semibold tracking -0.02em (index.css h1).
- h2 section 14px → 15px semibold tracking -0.01em (alasan: Headline iOS 17
  penuh terlalu besar untuk baris ber-tooltip; dicatat).
- Body/metric 14px, sekunder 13/12/11px, input 16px (anti-zoom iOS): TETAP.
- Mono angka/address/hash: TETAP + alasan (tabular figures, bukan estetika).
- `text-xs` label AmountInput (12px muted 5.99): TETAP.

5b. Segmented control iOS (TokenTabs + StrategiesPanel):
- `.token-tabs, .panel-tabs`: tambah `background: #E9E9EE; border-radius: 10px;
  padding: 3px;` (track). Hapus gap? PERTAHANKAN gap 8px (jarak baca antar
  segmen; track tetap menyatu secara visual).
- `.tab-trigger`: hapus background logika lama → transparan, teks muted;
  `[data-state="active"]`: `background: #ffffff; color: #1C1C1E;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12); border: 0`.
- Verifikasi script saat eksekusi: muted #636366 di atas track #E9E9EE
  (ekspektasi ~5.3 PASS; bila FAIL → fallback teks unselected #1C1C1E
  dan catat di laporan).

5c. Varian destructive (iOS red-text button):
- Button.tsx tambah varian `destructive: "border-transparent bg-transparent
  text-danger"` (teks #D70015 5.38 PASS).
- TokenTabs tombol Cabut Izin + StrategiesPanel tombol X: `ghost` → `destructive`.

5d. Yang SENGAJA tidak diubah (dicatat, bukan kelalaian):
- Input bordered (kepatuhan boundary 3:1 menang atas filled-style iOS).
- Thumb slider border amberink (boundary); range emas (aksen + nilai selalu teks).
- Tanpa tab-bar/nav (single-screen tool), tanpa pull-to-refresh, tanpa switch.

## 6. Fase Layout — komponen reusable (disetujui: TxLink + Section)

Temuan audit: link Tx ditulis 2x (StrategiesPanel lokal + TokenTabs inline —
TokenTabs bahkan me-link hash `0xmock…` mati; shared guard memperbaikinya),
pola header kartu `h2 + InfoTooltip` di AlarmCard + TokenTabs, wrapper
`setup-flow + flow-label` di App. StatRow (baris metrik) SENGAJA dibiarkan
inline (ekstraksi over-abstraksi untuk div sebaris).

5a. `ui/TxLink.tsx` baru (gantikan helper lokal StrategiesPanel 1:1):
```tsx
import { SCAN_TX } from "../../config";
import { ExternalLink } from "lucide-react";

export default function TxLink({ hash }: { hash?: string | null }) {
  // Guard di sini (bukan di pemanggil): hanya hash real 64-hex yang boleh
  // jadi link explorer. Mock/tx-hash kosong me-render null.
  if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) return null;
  return (
    <a className="tx" href={SCAN_TX(hash)} target="_blank" rel="noreferrer">
      Lihat Tx <ExternalLink aria-hidden="true" size={14} strokeWidth={1.8} />
    </a>
  );
}
```
Alasan ikon-vs-panah (R-04/R-08): satu isyarat link-eksternal yang konsisten
di semua tempat; panah `↗` teks dihapus dari StrategiesPanel.

5b. StrategiesPanel: hapus helper lokal (baris 46-53), import TxLink bersama,
pemakaian `<TxLink hash={...} />` tak berubah.

5c. TokenTabs (baris 211-215): ganti blok `<a>` dengan `<TxLink hash={activeHash} />`;
hapus import SCAN_TX + ExternalLink bila tak terpakai lain. Efek samping
disengaja: link mock mati hilang (perbaikan kejujuran).

5d. `ui/Section.tsx` baru (wrapper + label, dipakai App sekali — untuk
konsistensi pertumbuhan, dicatat):
```tsx
import type { ReactNode } from "react";

export default function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="setup-flow" aria-label={label}>
      <div className="flow-label">{label}</div>
      {children}
    </div>
  );
}
```
App: ganti div.setup-flow "Aksi token" dengan `<Section label="Aksi token">`.

5e. `ui/SectionTitle.tsx` baru (pola h2 + tooltip, dipakai AlarmCard + TokenTabs):
```tsx
import type { ReactNode } from "react";
import { InfoTooltip } from "./tooltip";

export default function SectionTitle({ children, tip }: { children: ReactNode; tip: string }) {
  return (
    <h2 className="text-foreground">{children} <InfoTooltip>{tip}</InfoTooltip></h2>
  );
}
```
AlarmCard: ganti `<h2>Alarm <InfoTooltip>…` (teks tip pindah ke prop).
TokenTabs baris 179: ganti `<h2 …>{title} <InfoTooltip>{tip}</InfoTooltip></h2>`
dengan `<SectionTitle tip={tip}>{title}</SectionTitle>`.

## 6. Gates + Delivery Gate + build

- Khusus periksa: tidak ada sisa hex gelap (grep `#[0-9a-f]` di src/),
  tidak ada sisa `outline-accent|text-accent|bg-\[#1a` (kecuali debug-log +
  Range dengan alasan).
- `bunx tsc --noEmit && bun run lint && bun run build` (workdir miniapp).
- Laporan PASS/FAIL: blok Hard Gate (semua no), Purpose-Gate (alasan per
  teknik: emas, mono angka, uppercase micro-label, animasi spinner/press),
  Liveliness (dials E1/R2/M1 + motif grup-iOS + aksen emas tunggal),
  Craftsmanship (C-1..C-5 + locks).
