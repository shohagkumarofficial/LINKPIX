import { query } from "./db";
import { HttpError, env } from "./http";
import { verifyInitData, type TgUser } from "./telegram";

export type UserStatus = "pending" | "approved" | "blocked";

export interface DbUser {
  telegram_id: string; // BIGINT comes back from the database as a string
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  status: UserStatus;
  is_admin: boolean;
  created_at: string;
}

const USER_COLUMNS = `telegram_id::text AS telegram_id, username, first_name, last_name, status, is_admin, created_at`;

export function adminId(): string {
  return env("ADMIN_TELEGRAM_ID").trim();
}

export async function getUser(id: string | number): Promise<DbUser | null> {
  const rows = await query<DbUser>(`SELECT ${USER_COLUMNS} FROM users WHERE telegram_id = $1::bigint`, [String(id)]);
  return rows[0] ?? null;
}

/** Creates or refreshes the admin row. The admin is always approved. */
export async function ensureAdmin(tg: TgUser): Promise<DbUser> {
  const rows = await query<DbUser>(
    `INSERT INTO users (telegram_id, username, first_name, last_name, status, is_admin, approved_at)
     VALUES ($1::bigint, $2, $3, $4, 'approved', TRUE, now())
     ON CONFLICT (telegram_id) DO UPDATE SET
       username = EXCLUDED.username,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       status = 'approved',
       is_admin = TRUE
     RETURNING ${USER_COLUMNS}`,
    [String(tg.id), tg.username ?? null, tg.first_name ?? null, tg.last_name ?? null],
  );
  return rows[0];
}

/** Creates a pending user, or refreshes the name of an existing one. */
export async function registerUser(tg: TgUser): Promise<{ user: DbUser; inserted: boolean }> {
  const rows = await query<DbUser & { inserted: boolean }>(
    `INSERT INTO users (telegram_id, username, first_name, last_name, status)
     VALUES ($1::bigint, $2, $3, $4, 'pending')
     ON CONFLICT (telegram_id) DO UPDATE SET
       username = EXCLUDED.username,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name
     RETURNING ${USER_COLUMNS}, (xmax = 0) AS inserted`,
    [String(tg.id), tg.username ?? null, tg.first_name ?? null, tg.last_name ?? null],
  );
  const { inserted, ...user } = rows[0];
  return { user: user as DbUser, inserted: Boolean(inserted) };
}

export async function setUserStatus(id: string, status: UserStatus): Promise<DbUser | null> {
  const rows = await query<DbUser>(
    `UPDATE users
        SET status = $2::text,
            approved_at = CASE WHEN $2::text = 'approved' THEN now() ELSE approved_at END
      WHERE telegram_id = $1::bigint AND is_admin = FALSE
      RETURNING ${USER_COLUMNS}`,
    [id, status],
  );
  return rows[0] ?? null;
}

export async function deleteUser(id: string): Promise<boolean> {
  const rows = await query(`DELETE FROM users WHERE telegram_id = $1::bigint AND is_admin = FALSE RETURNING telegram_id`, [id]);
  return rows.length > 0;
}

export interface AdminUserRow extends DbUser {
  links: number;
  clicks: number;
}

export async function listUsers(): Promise<AdminUserRow[]> {
  return query<AdminUserRow>(
    `SELECT u.telegram_id::text AS telegram_id, u.username, u.first_name, u.last_name, u.status, u.is_admin, u.created_at,
            (SELECT count(*)::int FROM links l WHERE l.owner_id = u.telegram_id) AS links,
            (SELECT count(*)::int FROM clicks c JOIN links l ON l.id = c.link_id WHERE l.owner_id = u.telegram_id) AS clicks
       FROM users u
      ORDER BY (u.status = 'pending') DESC, u.is_admin DESC, u.created_at DESC`,
  );
}

// ---------- request authentication ----------

export const INIT_DATA_HEADER = "x-telegram-init-data";

/** Verifies the Mini App signature and returns who is calling, plus their database row (if any). */
export async function identify(req: Request): Promise<{ tg: TgUser; user: DbUser | null }> {
  const initData = req.headers.get(INIT_DATA_HEADER) || "";
  const tg = verifyInitData(initData, env("BOT_TOKEN"));
  if (!tg) throw new HttpError(401, "Please open this app from inside Telegram.");

  if (String(tg.id) === adminId()) {
    return { tg, user: await ensureAdmin(tg) };
  }
  return { tg, user: await getUser(tg.id) };
}

/** Only approved users (and the admin) get through. */
export async function requireUser(req: Request): Promise<DbUser> {
  const { user } = await identify(req);
  if (!user) throw new HttpError(403, "No access yet.", { status: "none" });
  if (user.status !== "approved") throw new HttpError(403, "No access.", { status: user.status });
  return user;
}

export async function requireAdmin(req: Request): Promise<DbUser> {
  const user = await requireUser(req);
  if (!user.is_admin) throw new HttpError(403, "Admins only.");
  return user;
}
