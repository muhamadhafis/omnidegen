# Hardening: receipt-wait + status jujur + log gas (anti "sukses palsu")

Status: SIAP EKSEKUSI, tertunda permission `edit` (kembali deny).
Konteks: Tx `0x7f9f…` dikembalikan `writeContract` tapi tak pernah mined —
loop percaya hash mentah. Setelah ini, sukses hanya dilaporkan bila receipt
`success`; selebihnya throw → loop tandai `failed` + notif jujur.

## Edit 1 — src/web3.ts (tambah setelah `applySlippage`)

```ts
// pure + testable (client di-inject): tunggu receipt; bedakan mined-sukses,
// revert, dan hilang (timeout). Jangan pernah percaya hash mentah.
export async function confirmTransaction(
  client: { waitForTransactionReceipt(args: { hash: `0x${string}` }): Promise<{ status: string }> },
  hash: `0x${string}`,
  timeoutMs = 60_000,
): Promise<void> {
  const receipt = await Promise.race([
    client.waitForTransactionReceipt({ hash }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`no receipt (${timeoutMs / 1000}s): ${hash}`)), timeoutMs)),
  ]);
  if (receipt.status !== "success") throw new Error(`tx reverted: ${hash}`);
}
```

## Edit 2 — src/web3.ts (jalur real `triggerHedgeTransaction`, ganti 2 baris akhir)

```diff
   const { request } = await publicClient.simulateContract({ account, address: vault, abi: vaultAbi, functionName: "executeHedgePull", args: [userWallet as `0x${string}`, amount, minOut] });
-  return walletClient.writeContract(request);
+  const hash = await walletClient.writeContract(request);
+  const nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
+  console.log(`[hedge-tx] hash=${hash} nonce=${nonce} gas=${String(request.gas ?? "?")} maxFee=${(request.maxFeePerGas ?? request.gasPrice)?.toString() ?? "?"}`);
+  await confirmTransaction(publicClient, hash);
+  return hash;
```

## Edit 3 — src/loop.ts (`failHint`, tambah 2 mapping setelah "no deposit")

```ts
if (reason.includes("no receipt")) return "Tx terkirim tapi tak terkonfirmasi (kemungkinan dropped) — cek hash di bscscan, buat intent baru bila perlu";
if (reason.includes("revert")) return "Tx ditolak chain (revert) — cek allowance/saldo, lalu buat intent baru";
```

## Edit 4 — src/engine.test.ts (import + 2 test)

```diff
-import { applySlippage, validateHedgeRequest } from "./web3";
+import { applySlippage, confirmTransaction, validateHedgeRequest } from "./web3";
```

Tambah setelah test slippage:

```ts
test("confirmTransaction: sukses / revert / hilang", async () => {
  const ok = { waitForTransactionReceipt: async () => ({ status: "success" }) };
  await confirmTransaction(ok, "0xabc" as `0x${string}`, 1000);
  const bad = { waitForTransactionReceipt: async () => ({ status: "reverted" }) };
  await expect(confirmTransaction(bad, "0xabc" as `0x${string}`, 1000)).rejects.toThrow("reverted");
  const hang = { waitForTransactionReceipt: () => new Promise<{ status: string }>(() => {}) };
  await expect(confirmTransaction(hang, "0xabc" as `0x${string}`, 50)).rejects.toThrow("no receipt");
  expect(failHint("no receipt (60s): 0xabc")).toContain("dropped");
  expect(failHint("tx reverted: 0xabc")).toContain("revert");
});
```

Catatan: `failHint` perlu import di engine.test.ts bila belum ada —
cek baris import (saat ini hanya shouldTrigger, tickOnce, failHint? — engine.test.ts
line 2: `import { shouldTrigger, tickOnce, failHint } from "./loop";` SUDAH ADA).

## Verifikasi

```bash
bun test                    # target 30+/30+
bunx tsc --noEmit -p tsconfig.json
```

Perhatian: `request.gas` / `request.maxFeePerGas` bertipe opsional di viem —
pakai optional chaining seperti di atas; sesuaikan bila tsc komplain (tanpa `any`).

## Setelah deploy + restart backend

- Retry: buat TP baru → `/crash` → log kini menampilkan `[hedge-tx] hash… nonce…
  gas…` lalu sukses ATAU `[hedge-gagal]` jujur (tak ada lagi sukses palsu).
- Intent gagal berstatus `failed` → user buat intent baru (tidak hangus diam-diam).
