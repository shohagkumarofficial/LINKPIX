"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { fmt, timeAgo } from "./format";
import { confirmDialog, haptic } from "./tg";
import { Empty, ErrorLine } from "./ui";

export interface AdminUser {
  telegram_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  status: "pending" | "approved" | "blocked";
  is_admin: boolean;
  created_at: string;
  links: number;
  clicks: number;
}

function nameOf(u: AdminUser): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || (u.username ? `@${u.username}` : `User ${u.telegram_id}`);
}

export function UsersTab({
  notify,
  onPending,
}: {
  notify: (message: string) => void;
  onPending: (count: number) => void;
}) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const apply = useCallback(
    (list: AdminUser[]) => {
      setUsers(list);
      onPending(list.filter((u) => u.status === "pending").length);
    },
    [onPending],
  );

  useEffect(() => {
    let cancelled = false;
    api<{ users: AdminUser[] }>("/api/admin/users")
      .then((res) => {
        if (!cancelled) {
          apply(res.users);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Couldn't load users.");
      });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  async function act(u: AdminUser, action: "approve" | "block" | "remove") {
    if (action === "block" && !(await confirmDialog(`Block ${nameOf(u)}? They will lose access to the app.`))) return;
    if (action === "remove" && !(await confirmDialog(`Remove ${nameOf(u)} and delete all their links and stats? This can't be undone.`))) return;
    setBusyId(u.telegram_id);
    try {
      const res = await api<{ users: AdminUser[] }>("/api/admin/users", { json: { id: u.telegram_id, action } });
      apply(res.users);
      haptic("success");
      notify(action === "approve" ? "Access granted" : action === "block" ? "User blocked" : "User removed");
    } catch (e) {
      haptic("error");
      notify(e instanceof ApiError ? e.message : "That didn't work. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  const pending = users?.filter((u) => u.status === "pending") ?? [];
  const others = users?.filter((u) => u.status !== "pending") ?? [];

  return (
    <div className="tab">
      <header className="tab-head">
        <h1 className="h1">Users</h1>
        <p className="lede">People ask for access by sending /start to the bot. You decide who gets in.</p>
      </header>

      {error ? <ErrorLine>{error}</ErrorLine> : null}
      {!users && !error ? <p className="muted-line">Loading…</p> : null}

      {users ? (
        <>
          <section className="block">
            <h2 className="h2">Waiting for approval</h2>
            {pending.length === 0 ? (
              <p className="muted-line">No requests right now.</p>
            ) : (
              <ul className="list">
                {pending.map((u) => (
                  <li key={u.telegram_id} className="row row-user">
                    <div className="user-text">
                      <span className="row-title">{nameOf(u)}</span>
                      <span className="row-sub">
                        {u.username ? <span>@{u.username}</span> : null}
                        <span>ID {u.telegram_id}</span>
                        <span>{timeAgo(u.created_at)}</span>
                      </span>
                    </div>
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busyId === u.telegram_id}
                        onClick={() => act(u, "approve")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm"
                        disabled={busyId === u.telegram_id}
                        onClick={() => act(u, "block")}
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="block">
            <h2 className="h2">Everyone</h2>
            {others.length === 0 ? (
              <Empty title="Just you so far">Share your bot's link. New people will appear above for approval.</Empty>
            ) : (
              <ul className="list">
                {others.map((u) => (
                  <li key={u.telegram_id} className="row row-user">
                    <div className="user-text">
                      <span className="row-title">
                        {nameOf(u)}
                        {u.is_admin ? <span className="tag">You</span> : null}
                        {u.status === "blocked" ? <span className="tag tag-bad">Blocked</span> : null}
                      </span>
                      <span className="row-sub">
                        {u.username ? <span>@{u.username}</span> : null}
                        <span>
                          {fmt(u.links)} {u.links === 1 ? "link" : "links"}
                        </span>
                        <span>
                          {fmt(u.clicks)} {u.clicks === 1 ? "click" : "clicks"}
                        </span>
                      </span>
                    </div>
                    {u.is_admin ? null : (
                      <div className="btn-row">
                        {u.status === "blocked" ? (
                          <button type="button" className="btn-text" disabled={busyId === u.telegram_id} onClick={() => act(u, "approve")}>
                            Unblock
                          </button>
                        ) : (
                          <button type="button" className="btn-text" disabled={busyId === u.telegram_id} onClick={() => act(u, "block")}>
                            Block
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-text btn-text-danger"
                          disabled={busyId === u.telegram_id}
                          onClick={() => act(u, "remove")}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
