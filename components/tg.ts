/* Small helpers around the Telegram Mini App script (window.Telegram.WebApp). */

declare global {
  interface Window {
    Telegram?: { WebApp?: any };
  }
}

export function webApp(): any | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

export function initData(): string {
  return webApp()?.initData || "";
}

export function haptic(kind: "success" | "error" | "tap"): void {
  try {
    const h = webApp()?.HapticFeedback;
    if (!h) return;
    if (kind === "tap") h.impactOccurred("light");
    else h.notificationOccurred(kind);
  } catch {
    /* older Telegram versions */
  }
}

export function openShare(url: string, text?: string): void {
  const link = `https://t.me/share/url?url=${encodeURIComponent(url)}${text ? `&text=${encodeURIComponent(text)}` : ""}`;
  const tg = webApp();
  if (tg?.openTelegramLink) tg.openTelegramLink(link);
  else window.open(link, "_blank");
}

export function openExternal(url: string): void {
  const tg = webApp();
  if (tg?.openLink) tg.openLink(url);
  else window.open(url, "_blank", "noopener");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function confirmDialog(message: string): Promise<boolean> {
  const tg = webApp();
  if (tg?.showConfirm && tg.isVersionAtLeast?.("6.2")) {
    return new Promise((resolve) => tg.showConfirm(message, (ok: boolean) => resolve(Boolean(ok))));
  }
  return Promise.resolve(window.confirm(message));
}
