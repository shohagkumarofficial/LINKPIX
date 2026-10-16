"use client";

import { haptic, openExternal } from "./tg";
import { Icon } from "./ui";

/**
 * Share buttons for Telegram, WhatsApp, Facebook and X (Twitter).
 * Each one opens the platform's own share page with the short link.
 * The short link carries the picture and caption through its Open Graph tags.
 */
export function ShareButtons({
  url,
  text,
  onCopy,
}: {
  url: string;
  text?: string;
  onCopy: (url: string) => void;
}) {
  const enc = encodeURIComponent;
  const withText = text ? `${text} ${url}` : url;

  const targets: Array<{ label: string; href: string }> = [
    {
      label: "Telegram",
      href: `https://t.me/share/url?url=${enc(url)}${text ? `&text=${enc(text)}` : ""}`,
    },
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(withText)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?url=${enc(url)}${text ? `&text=${enc(text)}` : ""}`,
    },
  ];

  return (
    <div className="share">
      <p className="share-title">Share</p>
      <div className="chips">
        {targets.map((t) => (
          <button
            key={t.label}
            type="button"
            className="chip"
            onClick={() => {
              haptic("tap");
              openExternal(t.href);
            }}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          className="chip chip-icon"
          onClick={() => {
            haptic("tap");
            onCopy(url);
          }}
        >
          <Icon name="copy" size={15} />
          Copy
        </button>
      </div>
    </div>
  );
}
