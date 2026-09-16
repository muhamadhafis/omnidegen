import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.tsx";
import { PRIVY_APP_ID, privyConfig, wagmiConfig } from "./config.ts";
import { patchCustomSchemeOpen } from "./telegram.ts";
import { dlog, installGlobalLogHooks } from "./debug-log.ts";

// Tanpa syarat: di browser biasa patch ini no-op untuk link https,
// di webview Telegram ia yang mencegah ERR_UNKNOWN_URL_SCHEME.
patchCustomSchemeOpen();
installGlobalLogHooks();
dlog(`boot: privy=${PRIVY_APP_ID ? "ok" : "KOSONG"} api=${import.meta.env.VITE_API_URL || "KOSONG"} ua=${navigator.userAgent.slice(0, 80)}`);

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <App />
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  </StrictMode>,
);
