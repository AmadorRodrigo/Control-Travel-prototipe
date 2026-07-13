export function generateUUID() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function" &&
    window.isSecureContext
  ) {
    return crypto.randomUUID();
  }
  // Fallback using getRandomValues — works on HTTP (non-secure context)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r =
      typeof crypto !== "undefined" && crypto.getRandomValues
        ? (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> (c === "x" ? 0 : 1)
        : (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
