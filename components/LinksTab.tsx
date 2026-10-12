"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, uploadImage } from "./api";
import { fmt, hostOf, timeAgo } from "./format";
import { confirmDialog, copyText, haptic, openExternal, openShare } from "./tg";
import { Empty, ErrorLine, Icon, Segmented, Thumb } from "./ui";

export interface LinkItemData {
  code: string;
  target_url: string;
  image_url: string | null;
  caption: string | null;
  created_at: string;
  owner_id: string;
  owner_name: string | null;
  owner_username: string | null;
  clicks: number;
  uniques: number;
  clicks_24h: number;
}

const TAGS: Array<{ label: string; src: string }> = [
  { label: "Facebook", src: "facebook" },
  { label: "WhatsApp", src: "whatsapp" },
  { label: "Telegram", src: "telegram" },
  { label: "Instagram", src: "instagram" },
];

export function LinksTab({
  isAdmin,
  version,
  notify,
  onChanged,
  onOpenAnalytics,
  onGoCreate,
}: {
  isAdmin: boolean;
  version: number;
  notify: (message: string) => void;
  onChanged: () => void;
  onOpenAnalytics: (code: string) => void;
  onGoCreate: () => void;
}) {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [rows, setRows] = useState<LinkItemData[] | null>(null);
  const [base, setBase] = useState("");
  const [error, setError] = useState("");
  const [openCode, setOpenCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await api<{ links: LinkItemData[]; base_url: string }>(
          `/api/links?scope=${scope}&q=${encodeURIComponent(q.trim())}`,
        );
        if (cancelled) return;
        setRows(res.links);
        setBase(res.base_url);
        setError("");
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Couldn't load your links.");
      }
    }, q ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, scope, version]);

  return (
    <div className="tab">
      <header className="tab-head">
        <h1 className="h1">Links</h1>
        {rows ? (
          <p className="lede">
            {rows.length === 0 && !q ? "Nothing here yet." : `${fmt(rows.length)} ${rows.length === 1 ? "link" : "links"}`}
          </p>
        ) : null}
      </header>

      <div className="filters">
        <label className="search">
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder="Search by caption, code or address"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search links"
          />
        </label>
        {isAdmin ? (
          <Segmented
            value={scope}
            onChange={setScope}
            label="Whose links"
            options={[
              { value: "mine", label: "Mine" },
              { value: "all", label: "Everyone" },
            ]}
          />
        ) : null}
      </div>

      {error ? <ErrorLine>{error}</ErrorLine> : null}

      {rows === null && !error ? <p className="muted-line">Loading…</p> : null}

      {rows && rows.length === 0 ? (
        q ? (
          <Empty title="No matches">Try a different word, or clear the search.</Empty>
        ) : (
          <Empty
            title="No links yet"
            action={
              <button type="button" className="btn btn-primary" onClick={onGoCreate}>
                Create your first link
              </button>
            }
          >
            Links you create show up here with their click counts.
          </Empty>
        )
      ) : null}

      {rows && rows.length > 0 ? (
        <ul className="list">
          {rows.map((l) => (
            <LinkRow
              key={l.code}
              link={l}
              base={base}
              showOwner={scope === "all"}
              open={openCode === l.code}
              onToggle={() => setOpenCode(openCode === l.code ? null : l.code)}
              notify={notify}
              onChanged={onChanged}
              onOpenAnalytics={onOpenAnalytics}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function LinkRow({
  link,
  base,
  showOwner,
  open,
  onToggle,
  notify,
  onChanged,
  onOpenAnalytics,
}: {
  link: LinkItemData;
  base: string;
  showOwner: boolean;
  open: boolean;
  onToggle: () => void;
  notify: (message: string) => void;
  onChanged: () => void;
  onOpenAnalytics: (code: string) => void;
}) {
  const shortUrl = `${base}/${link.code}`;
  const title = link.caption || hostOf(link.target_url);
  const [editing, setEditing] = useState(false);

  async function copy(text: string, message = "Link copied") {
    notify((await copyText(text)) ? message : "Couldn't copy. Press and hold to copy.");
    haptic("tap");
  }

  async function remove() {
    if (!(await confirmDialog("Delete this link? People who click it will see an error, and its stats are lost."))) return;
    try {
      await api(`/api/links/${link.code}`, { method: "DELETE" });
      haptic("success");
      notify("Link deleted");
      onChanged();
    } catch (e) {
      haptic("error");
      notify(e instanceof ApiError ? e.message : "Couldn't delete the link.");
    }
  }

  return (
    <li className={open ? "row row-open" : "row"}>
      <button type="button" className="row-main" onClick={onToggle} aria-expanded={open}>
        <Thumb src={link.image_url} fallback={title} />
        <span className="row-text">
          <span className="row-title">{title}</span>
          <span className="row-sub">
            <span className="row-code">{link.code}</span>
            <span>{timeAgo(link.created_at)}</span>
            {showOwner ? <span>{link.owner_name || link.owner_username || "Unknown"}</span> : null}
          </span>
        </span>
        <span className="row-count">
          <span className="row-num">{fmt(link.clicks)}</span>
          <span className="row-unit">{link.clicks === 1 ? "click" : "clicks"}</span>
        </span>
      </button>

      {open ? (
        <div className="row-detail">
          {editing ? (
            <EditForm
              link={link}
              onDone={(saved) => {
                setEditing(false);
                if (saved) {
                  notify("Changes saved");
                  onChanged();
                }
              }}
            />
          ) : (
            <>
              <p className="detail-url">{shortUrl.replace(/^https?:\/\//, "")}</p>
              <p className="detail-dest">
                Goes to <span>{link.target_url}</span>
              </p>

              <dl className="mini-stats">
                <div>
                  <dt>Total clicks</dt>
                  <dd>{fmt(link.clicks)}</dd>
                </div>
                <div>
                  <dt>Unique visitors</dt>
                  <dd>{fmt(link.uniques)}</dd>
                </div>
                <div>
                  <dt>Last 24 hours</dt>
                  <dd>{fmt(link.clicks_24h)}</dd>
                </div>
              </dl>

              <div className="btn-row btn-row-wrap">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => copy(shortUrl)}>
                  <Icon name="copy" size={16} />
                  Copy
                </button>
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => openShare(shortUrl, link.caption || undefined)}>
                  <Icon name="share" size={16} />
                  Share
                </button>
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => onOpenAnalytics(link.code)}>
                  <Icon name="chart" size={16} />
                  Analytics
                </button>
              </div>

              <div className="tagbox">
                <p className="tagbox-title">Copy a tracked link</p>
                <p className="help">Adds a tag so Analytics can tell where each click came from.</p>
                <div className="chips">
                  {TAGS.map((t) => (
                    <button
                      key={t.src}
                      type="button"
                      className="chip"
                      onClick={() => copy(`${shortUrl}?src=${t.src}`, `${t.label} link copied`)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="btn-row btn-row-wrap">
                <button type="button" className="btn-text" onClick={() => setEditing(true)}>
                  <Icon name="edit" size={16} />
                  Edit
                </button>
                <button type="button" className="btn-text" onClick={() => openExternal(link.target_url)}>
                  <Icon name="external" size={16} />
                  Open destination
                </button>
                <button type="button" className="btn-text btn-text-danger" onClick={remove}>
                  <Icon name="trash" size={16} />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}

function EditForm({ link, onDone }: { link: LinkItemData; onDone: (saved: boolean) => void }) {
  const [target, setTarget] = useState(link.target_url);
  const [image, setImage] = useState(link.image_url ?? "");
  const [caption, setCaption] = useState(link.caption ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/links/${link.code}`, {
        method: "PATCH",
        json: { target_url: target, image_url: image, caption },
      });
      haptic("success");
      onDone(true);
    } catch (err) {
      haptic("error");
      setError(err instanceof ApiError ? err.message : "Couldn't save the changes.");
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={save} noValidate>
      <div className="field">
        <label htmlFor={`e-target-${link.code}`}>Link to shorten</label>
        <input
          id={`e-target-${link.code}`}
          type="url"
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`e-image-${link.code}`}>Picture</label>
        <div className="btn-row">
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
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
        </div>
        <input
          id={`e-image-${link.code}`}
          type="url"
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          value={image}
          onChange={(e) => setImage(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`e-caption-${link.code}`}>Caption</label>
        <textarea
          id={`e-caption-${link.code}`}
          rows={2}
          maxLength={300}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
      </div>
      <p className="help">
        Facebook and WhatsApp remember old previews. After changing the picture or caption, refresh the preview in
        Facebook's Sharing Debugger.
      </p>
      {error ? <ErrorLine>{error}</ErrorLine> : null}
      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={busy || !target.trim()}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => onDone(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
