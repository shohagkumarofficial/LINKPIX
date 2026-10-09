import { createHash } from "node:crypto";

/**
 * Link-preview robots (Facebook, WhatsApp, Telegram...) identify themselves in
 * the User-Agent header. They get the preview page; real people get redirected.
 */
const CRAWLER_PATTERN = new RegExp(
  [
    "facebookexternalhit", "facebot", "meta-external", "meta-webindexer",
    "^whatsapp", "telegrambot", "twitterbot", "linkedinbot", "slackbot", "slack-imgproxy",
    "discordbot", "pinterest", "skypeuripreview", "vkshare", "redditbot", "applebot",
    "googlebot", "google-inspectiontool", "bingbot", "bingpreview", "yandex", "baiduspider",
    "duckduckbot", "embedly", "iframely", "mastodon", "line-poker", "kakaotalk-scrap",
    "bot\\b", "crawler", "spider", "crawl", "slurp", "headless", "lighthouse",
    "curl/", "wget/", "python-requests", "httpclient", "node-fetch", "go-http-client", "axios",
  ].join("|"),
  "i",
);

export function isCrawler(ua: string | null): boolean {
  if (!ua) return true;
  if (CRAWLER_PATTERN.test(ua)) return true;
  // Real browsers start with Mozilla/ (or Opera/ for Opera Mini, Dalvik/ for some Android apps).
  return !/^(mozilla|opera|dalvik)\//i.test(ua);
}

export function parseDevice(ua: string): { device: "mobile" | "tablet" | "desktop"; os: string } {
  let device: "mobile" | "tablet" | "desktop" = "desktop";
  if (/ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) device = "tablet";
  else if (/mobi|iphone|ipod|android|opera mini|blackberry|windows phone/i.test(ua)) device = "mobile";

  let os = "Other";
  if (/windows phone/i.test(ua)) os = "Windows Phone";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/mac os x|macintosh/i.test(ua)) os = "macOS";
  else if (/cros/i.test(ua)) os = "ChromeOS";
  else if (/linux/i.test(ua)) os = "Linux";
  return { device, os };
}

const REFERRER_HOSTS: Array<[RegExp, string]> = [
  [/(^|\.)(facebook|fb)\.com$|(^|\.)fb\.me$|^l\.facebook\.com$/i, "Facebook"],
  [/(^|\.)messenger\.com$/i, "Messenger"],
  [/(^|\.)instagram\.com$/i, "Instagram"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/i, "WhatsApp"],
  [/(^|\.)(t\.me|telegram\.org|telegram\.me|web\.telegram\.org)$/i, "Telegram"],
  [/(^|\.)(twitter\.com|x\.com|t\.co)$/i, "X (Twitter)"],
  [/(^|\.)(youtube\.com|youtu\.be)$/i, "YouTube"],
  [/(^|\.)linkedin\.com$/i, "LinkedIn"],
  [/(^|\.)reddit\.com$/i, "Reddit"],
  [/(^|\.)pinterest\.[a-z.]+$/i, "Pinterest"],
  [/(^|\.)tiktok\.com$/i, "TikTok"],
  [/(^|\.)google\.[a-z.]+$/i, "Google"],
];

/**
 * Where did this visit come from? Priority:
 * 1. a ?src= label you add yourself (best for campaigns)
 * 2. the in-app browser named in the User-Agent (Facebook app, Instagram...)
 * 3. the Referer header
 */
const SRC_ALIASES: Record<string, string> = {
  fb: "Facebook", facebook: "Facebook",
  wa: "WhatsApp", whatsapp: "WhatsApp",
  tg: "Telegram", telegram: "Telegram",
  ig: "Instagram", instagram: "Instagram",
  msgr: "Messenger", messenger: "Messenger",
  tw: "X (Twitter)", x: "X (Twitter)", twitter: "X (Twitter)",
  yt: "YouTube", youtube: "YouTube",
  tt: "TikTok", tiktok: "TikTok",
  li: "LinkedIn", linkedin: "LinkedIn",
};

export function detectSource(ua: string, referer: string | null, srcParam: string | null): string {
  const label = (srcParam || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
  if (label) return SRC_ALIASES[label] ?? label;

  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return /messenger/i.test(ua) ? "Messenger" : "Facebook";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return "TikTok";
  if (/Twitter/i.test(ua)) return "X (Twitter)";
  if (/LinkedInApp/i.test(ua)) return "LinkedIn";
  if (/Snapchat/i.test(ua)) return "Snapchat";
  if (/Telegram/i.test(ua)) return "Telegram";
  if (/WhatsApp/i.test(ua)) return "WhatsApp";

  if (referer) {
    try {
      const host = new URL(referer).hostname;
      for (const [pattern, name] of REFERRER_HOSTS) if (pattern.test(host)) return name;
      return host.replace(/^www\./, "");
    } catch {
      /* ignore bad referer */
    }
  }
  return "Direct";
}

export function visitorHash(ip: string, ua: string): string {
  const salt = process.env.WEBHOOK_SECRET || "salt";
  return createHash("sha256").update(`${ip}|${ua}|${salt}`).digest("hex").slice(0, 16);
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "0.0.0.0"
  );
}
