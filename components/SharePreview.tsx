"use client";

import { useEffect, useState } from "react";
import { Icon, Segmented } from "./ui";

type Platform = "facebook" | "whatsapp" | "telegram";

export type ImageState = "none" | "loading" | "ok" | "bad" | "insecure";

const PLATFORMS: Array<{ value: Platform; label: string }> = [
  { value: "facebook", label: "Facebook" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
];

const PLACEHOLDER: Record<ImageState, string> = {
  none: "Your image appears here",
  loading: "Loading image",
  ok: "",
  bad: "This image can't be loaded",
  insecure: "Image link must start with https://",
};

/**
 * Shows roughly how the link will look when it is shared.
 * Layouts are approximations: each app crops and styles previews a little differently.
 */
export function SharePreview({
  host,
  code,
  caption,
  image,
  onImageState,
}: {
  host: string;
  code: string;
  caption: string;
  image: string;
  onImageState?: (s: ImageState) => void;
}) {
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [result, setResult] = useState<{ src: string; ok: boolean } | null>(null);

  const src = image.trim();
  const insecure = /^http:\/\//i.test(src);
  const canLoad = /^https:\/\/.+/i.test(src);

  let state: ImageState = "none";
  if (src) {
    if (insecure) state = "insecure";
    else if (!canLoad) state = "bad";
    else if (result?.src === src) state = result.ok ? "ok" : "bad";
    else state = "loading";
  }

  useEffect(() => {
    onImageState?.(state);
  }, [state, onImageState]);

  const title = caption.trim();

  const media = (
    <>
      <div className="pv-ph">
        <Icon name="image" size={26} />
        {PLACEHOLDER[state] ? <span>{PLACEHOLDER[state]}</span> : null}
      </div>
      {canLoad ? (
        <img
          key={src}
          className={state === "ok" ? "pv-img pv-img-on" : "pv-img"}
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onLoad={() => setResult({ src, ok: true })}
          onError={() => setResult({ src, ok: false })}
        />
      ) : null}
    </>
  );

  const titleEl = <span className={title ? "pv-title" : "pv-title pv-empty"}>{title || "Your caption appears here"}</span>;

  return (
    <section className="preview" aria-label="Share preview">
      <div className="preview-head">
        <h2 className="h2">How it looks when shared</h2>
        <Segmented value={platform} options={PLATFORMS} onChange={setPlatform} label="Preview style" />
      </div>

      <div className="pv-stage">
        {platform === "facebook" ? (
          <div className="pv pv-fb">
            <div className="pv-media pv-media-wide">{media}</div>
            <div className="pv-body">
              <span className="pv-host">{host}</span>
              {titleEl}
            </div>
          </div>
        ) : null}

        {platform === "whatsapp" ? (
          <div className="pv pv-wa">
            <div className="pv-wa-card">
              <div className="pv-media pv-media-wide">{media}</div>
              <div className="pv-body">
                {titleEl}
                <span className="pv-host">{host}</span>
              </div>
            </div>
            <span className="pv-wa-link">
              {host}/{code}
            </span>
          </div>
        ) : null}

        {platform === "telegram" ? (
          <div className="pv pv-tg">
            <span className="pv-tg-bar" aria-hidden="true" />
            <div className="pv-tg-main">
              <span className="pv-tg-site">{host}</span>
              {titleEl}
              <div className="pv-media pv-media-wide pv-media-tg">{media}</div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
