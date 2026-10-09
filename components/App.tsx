"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnalyticsTab } from "./AnalyticsTab";
import { api, ApiError } from "./api";
import { CreateTab } from "./CreateTab";
import { LinksTab } from "./LinksTab";
import { haptic, initData, webApp } from "./tg";
import { Icon } from "./ui";
import { UsersTab } from "./UsersTab";

type Tab = "create" | "links" | "analytics" | "users";
type Phase = "loading" | "outside" | "error" | "gate" | "ready";

interface Me {
  status: "none" | "pending" | "approved" | "blocked";
  is_admin: boolean;
  user: { id: string; first_name: string | null; username: string | null };
  base_url: string;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("create");
  const [visited, setVisited] = useState<Set<Tab>>(new Set<Tab>(["create"]));
  const [version, setVersion] = useState(0); // bumped when links change so other tabs refresh
  const [focusLink, setFocusLink] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  // Match Telegram's light/dark theme and make the app fill the screen.
  useEffect(() => {
    const tg = webApp();
    const apply = () => {
      const root = document.documentElement;
      const scheme = tg?.colorScheme;
      if (scheme === "dark" || scheme === "light") root.dataset.theme = scheme;
      else delete root.dataset.theme;
      try {
        const paper = getComputedStyle(root).getPropertyValue("--paper").trim();
        if (paper && tg) {
          tg.setHeaderColor?.(paper);
          tg.setBackgroundColor?.(paper);
          tg.setBottomBarColor?.(paper);
        }
      } catch {
        /* older Telegram versions ignore these */
      }
    };
    try {
      tg?.ready?.();
      tg?.expand?.();
      tg?.disableVerticalSwipes?.();
    } catch {
      /* ignore */
    }
    apply();
    tg?.onEvent?.("themeChanged", apply);
    return () => tg?.offEvent?.("themeChanged", apply);
  }, []);

  const load = useCallback(async () => {
    if (!initData()) {
      setPhase("outside");
      return;
    }
    setPhase("loading");
    try {
      const data = await api<Me>("/api/me");
      setMe(data);
      setPhase(data.status === "approved" ? "ready" : "gate");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setPhase("outside");
      } else {
        setError(e instanceof ApiError ? e.message : "Something went wrong.");
        setPhase("error");
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Admin: show how many people are waiting.
  useEffect(() => {
    if (phase !== "ready" || !me?.is_admin) return;
    api<{ users: Array<{ status: string }> }>("/api/admin/users")
      .then((res) => setPending(res.users.filter((u) => u.status === "pending").length))
      .catch(() => {});
  }, [phase, me?.is_admin]);

  const go = useCallback((next: Tab) => {
    setTab(next);
    setVisited((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
    window.scrollTo({ top: 0 });
    haptic("tap");
  }, []);

  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const onFocusUsed = useCallback(() => setFocusLink(null), []);
  const openAnalytics = useCallback(
    (code: string) => {
      setFocusLink(code);
      go("analytics");
    },
    [go],
  );

  // ---------- screens before access ----------

  if (phase === "loading") {
    return (
      <main className="gate">
        <p className="muted-line">Loading…</p>
      </main>
    );
  }

  if (phase === "outside") {
    return (
      <main className="gate">
        <h1 className="h1">Open this from Telegram</h1>
        <p className="lede">
          This app only works inside Telegram. Open your bot's chat and tap the Open App button next to the message box.
        </p>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="gate">
        <h1 className="h1">Couldn't load the app</h1>
        <p className="lede">{error}</p>
        <button type="button" className="btn btn-primary" onClick={load}>
          Try again
        </button>
      </main>
    );
  }

  if (phase === "gate" && me) {
    const copy =
      me.status === "pending"
        ? {
            title: "Waiting for approval",
            text: "Your request is with the admin. You'll get a message in the bot chat as soon as it's approved.",
          }
        : me.status === "blocked"
          ? { title: "Access declined", text: "The admin hasn't given you access to this app." }
          : { title: "You need access first", text: "Send /start to the bot in the chat to ask the admin for access, then come back here." };
    return (
      <main className="gate">
        <h1 className="h1">{copy.title}</h1>
        <p className="lede">{copy.text}</p>
        {me.status !== "blocked" ? (
          <button type="button" className="btn btn-primary" onClick={load}>
            Check again
          </button>
        ) : null}
      </main>
    );
  }

  if (!me) return null;

  // ---------- the app ----------

  const tabs: Array<{ id: Tab; label: string; icon: string; badge?: number }> = [
    { id: "create", label: "Create", icon: "create" },
    { id: "links", label: "Links", icon: "links" },
    { id: "analytics", label: "Analytics", icon: "chart" },
    ...(me.is_admin ? [{ id: "users" as Tab, label: "Users", icon: "users", badge: pending }] : []),
  ];

  return (
    <>
      <main className="shell">
        <section hidden={tab !== "create"}>
          <CreateTab baseUrl={me.base_url} notify={notify} onCreated={bump} />
        </section>

        {visited.has("links") ? (
          <section hidden={tab !== "links"}>
            <LinksTab
              isAdmin={me.is_admin}
              version={version}
              notify={notify}
              onChanged={bump}
              onOpenAnalytics={openAnalytics}
              onGoCreate={() => go("create")}
            />
          </section>
        ) : null}

        {visited.has("analytics") ? (
          <section hidden={tab !== "analytics"}>
            <AnalyticsTab isAdmin={me.is_admin} version={version} focusLink={focusLink} onFocusUsed={onFocusUsed} />
          </section>
        ) : null}

        {me.is_admin && visited.has("users") ? (
          <section hidden={tab !== "users"}>
            <UsersTab notify={notify} onPending={setPending} />
          </section>
        ) : null}
      </main>

      <nav className="tabbar" aria-label="Main">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "tab-btn tab-on" : "tab-btn"}
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => go(t.id)}
          >
            <span className="tab-icon">
              <Icon name={t.icon} size={22} />
              {t.badge ? <span className="badge">{t.badge}</span> : null}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <div className={toast ? "toast toast-on" : "toast"} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}
