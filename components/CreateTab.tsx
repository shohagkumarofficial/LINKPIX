"use client";

import { useRef, useState } from "react";
import { api, ApiError, uploadImage } from "./api";
import { SharePreview, type ImageState } from "./SharePreview";
import { copyText, haptic, openShare } from "./tg";
import { ErrorLine, Icon } from "./ui";

interface Created {
  short_url: string;
  code: string;
}

export function CreateTab({
  baseUrl,
  notify,
  onCreated,
}: {
  baseUrl: string;
  notify: (message: string) => void;
  onCreated: () => void;
}) {
  const [target, setTarget] = useState("");
  const [image, setImage] = useState("");
  const [caption, setCaption] = useState("");
  const [alias, setAlias] = useState("");
  const [showAlias, setShowAlias] = useState(false);
  const [imageState, setImageState] = useState<ImageState>("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      setImage(await uploadImage(file));
      haptic("success");
    } catch (err) {
      haptic("error");
      setError(err instanceof ApiError ? err.message : "Couldn't upload the picture.");
    } finally {
      setUploading(false);
    }
  }

  const host = (() => {
    try {
      return new URL(baseUrl).host;
    } catch {
      return "your-link.app";
    }
  })();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<{ short_url: string; link: { code: string } }>("/api/links", {
        json: { target_url: target, image_url: image, caption, alias },
      });
      setCreated({ short_url: res.short_url, code: res.link.code });
      haptic("success");
      onCreated();
    } catch (err) {
      haptic("error");
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setTarget("");
    setImage("");
    setCaption("");
    setAlias("");
    setShowAlias(false);
    setCreated(null);
    setError("");
    window.scrollTo({ top: 0 });
  }

  async function copy(url: string) {
    notify((await copyText(url)) ? "Link copied" : "Couldn't copy. Press and hold the link to copy it.");
    haptic("tap");
  }

  const imageHelp: Record<ImageState, string> = {
    none: "A direct link to a picture. 1200 × 630 pixels works best.",
    loading: "Checking the image…",
    ok: "Image loads.",
    bad: "This link doesn't open as a picture. Check it and try again.",
    insecure: "Use a link that starts with https://. Facebook and WhatsApp skip http images.",
  };

  return (
    <div className="tab">
      <header className="tab-head">
        <h1 className="h1">New link</h1>
        <p className="lede">Paste the link, then choose the picture and caption people see when you share it.</p>
      </header>

      <SharePreview
        host={host}
        code={created?.code ?? "a1b2c3"}
        caption={caption}
        image={image}
        onImageState={setImageState}
      />

      {created ? (
        <section className="result" aria-live="polite">
          <h2 className="h2">Your link is ready</h2>
          <p className="result-url">{created.short_url}</p>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => copy(created.short_url)}>
              <Icon name="copy" size={18} />
              Copy link
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => openShare(created.short_url, caption || undefined)}>
              <Icon name="share" size={18} />
              Share
            </button>
          </div>
          <p className="help">
            To see which platform your clicks come from, add a tag to the end when you post, for example{" "}
            <button type="button" className="inline-copy" onClick={() => copy(`${created.short_url}?src=facebook`)}>
              {created.short_url.replace(/^https?:\/\//, "")}?src=facebook
            </button>
            .
          </p>
          <button type="button" className="btn-text" onClick={reset}>
            Create another link
          </button>
        </section>
      ) : (
        <form className="form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="f-target">Link to shorten</label>
            <input
              id="f-target"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://example.com/your-offer"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="f-image">Picture</label>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Icon name="image" size={16} />
                {uploading ? "Uploading…" : image ? "Choose another" : "Upload picture"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                onChange={pickFile}
              />
              <span className="help">JPG, PNG, WebP or GIF, up to 4 MB</span>
            </div>
            <input
              id="f-image"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="…or paste a picture link (https://)"
              value={image}
              onChange={(e) => setImage(e.target.value)}
            />
            <p className={imageState === "bad" || imageState === "insecure" ? "help help-bad" : "help"}>
              {imageHelp[imageState]}
            </p>
          </div>

          <div className="field">
            <label htmlFor="f-caption">Caption</label>
            <textarea
              id="f-caption"
              rows={2}
              maxLength={300}
              placeholder="The headline shown above your link"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            <p className="help help-right">{caption.length} / 300</p>
          </div>

          {showAlias ? (
            <div className="field">
              <label htmlFor="f-alias">Custom short code</label>
              <div className="prefixed">
                <span>{host}/</span>
                <input
                  id="f-alias"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={32}
                  placeholder="summer-sale"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                />
              </div>
              <p className="help">Letters, numbers, - and _ only. Leave empty for a random code.</p>
            </div>
          ) : (
            <button type="button" className="btn-text btn-text-left" onClick={() => setShowAlias(true)}>
              Choose your own short code
            </button>
          )}

          {error ? <ErrorLine>{error}</ErrorLine> : null}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy || !target.trim()}>
            {busy ? "Creating…" : "Create link"}
          </button>
        </form>
      )}
    </div>
  );
}
