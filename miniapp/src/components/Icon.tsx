type IconName = "wallet" | "copy" | "logout" | "info" | "wrap" | "shield" | "revoke" | "chat" | "external" | "check";

const paths: Record<IconName, string> = {
  wallet: "M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Zm0 2.5h18m-4 4h.01",
  copy: "M8 8V5.5A1.5 1.5 0 0 1 9.5 4h9A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H16M6.5 8h8A1.5 1.5 0 0 1 16 9.5v9a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 5 18.5v-9A1.5 1.5 0 0 1 6.5 8Z",
  logout: "M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10m5-4 4-4-4-4m4 4H9",
  info: "M12 17v-5m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  wrap: "M7 7h10l-2.5-2.5M17 17H7l2.5 2.5M17 7a7 7 0 0 1 0 10M7 17A7 7 0 0 1 7 7",
  shield: "m12 3 7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Zm-3 9 2 2 4-4",
  revoke: "M5 5l14 14M19 5 5 19",
  chat: "M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4.1a2.5 2.5 0 0 1-2.5-2.4v-7Z",
  external: "M14 5h5v5m0-5-8 8M18 13v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 17.5v-11A1.5 1.5 0 0 1 5.5 5H10",
  check: "m5 12 4 4L19 6",
};

export default function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d={paths[name]} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
