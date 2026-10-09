import { query } from "./db";
import { HttpError } from "./http";
import { isReservedCode, isValidCode, randomCode } from "./code";
import type { DbUser } from "./users";

export interface LinkRow {
  id: string;
  code: string;
  owner_id: string;
  target_url: string;
  image_url: string | null;
  caption: string | null;
  created_at: string;
}

export interface LinkListRow {
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

const LINK_COLUMNS = `id::text AS id, code, owner_id::text AS owner_id, target_url, image_url, caption, created_at`;

// ---------- validation ----------

const MAX_URL = 2048;
const MAX_CAPTION = 300;

export function cleanTargetUrl(input: unknown, ownHost: string): string {
  let raw = typeof input === "string" ? input.trim() : "";
  if (!raw) throw new HttpError(400, "Please enter the URL you want to shorten.");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;
  if (raw.length > MAX_URL) throw new HttpError(400, "That URL is too long.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, "That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new HttpError(400, "Only http:// and https:// links are allowed.");
  }
  if (!url.hostname.includes(".")) throw new HttpError(400, "That doesn't look like a valid URL.");
  if (ownHost && url.host.toLowerCase() === ownHost.toLowerCase()) {
    throw new HttpError(400, "You can't shorten a link that already points to this app.");
  }
  return url.toString();
}

export function cleanImageUrl(input: unknown): string | null {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) return null;
  if (raw.length > MAX_URL) throw new HttpError(400, "The image URL is too long.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, "The image URL doesn't look valid.");
  }
  if (url.protocol !== "https:") {
    throw new HttpError(400, "The image URL must start with https:// (Facebook and WhatsApp ignore http images).");
  }
  return url.toString();
}

export function cleanCaption(input: unknown): string | null {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) return null;
  if (raw.length > MAX_CAPTION) throw new HttpError(400, `The caption can be at most ${MAX_CAPTION} characters.`);
  return raw;
}

export function cleanAlias(input: unknown): string | null {
  const raw = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (!raw) return null;
  if (!isValidCode(raw)) {
    throw new HttpError(400, "Custom short code: 3-32 characters, only letters, numbers, - and _.");
  }
  if (isReservedCode(raw)) throw new HttpError(400, "That short code is reserved. Please pick another.");
  return raw;
}

// ---------- create / read / update / delete ----------

export async function createLink(
  ownerId: string,
  input: { target_url: string; image_url: string | null; caption: string | null; alias: string | null },
): Promise<LinkRow> {
  const insert = `INSERT INTO links (code, owner_id, target_url, image_url, caption)
                  VALUES ($1, $2::bigint, $3, $4, $5)
                  ON CONFLICT (code) DO NOTHING
                  RETURNING ${LINK_COLUMNS}`;

  if (input.alias) {
    const rows = await query<LinkRow>(insert, [input.alias, ownerId, input.target_url, input.image_url, input.caption]);
    if (!rows[0]) throw new HttpError(409, "That custom short code is already taken.");
    return rows[0];
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode(attempt < 5 ? 6 : 7);
    const rows = await query<LinkRow>(insert, [code, ownerId, input.target_url, input.image_url, input.caption]);
    if (rows[0]) return rows[0];
  }
  throw new HttpError(500, "Could not generate a free short code. Please try again.");
}

export async function getLinkByCode(code: string): Promise<LinkRow | null> {
  const rows = await query<LinkRow>(`SELECT ${LINK_COLUMNS} FROM links WHERE code = $1`, [code]);
  return rows[0] ?? null;
}

/** Loads a link and makes sure `user` may change it (owner or admin). */
export async function getOwnedLink(code: string, user: DbUser): Promise<LinkRow> {
  const link = await getLinkByCode(code.toLowerCase());
  if (!link) throw new HttpError(404, "Link not found.");
  if (link.owner_id !== user.telegram_id && !user.is_admin) throw new HttpError(403, "This isn't your link.");
  return link;
}

export async function updateLink(
  id: string,
  input: { target_url: string; image_url: string | null; caption: string | null },
): Promise<LinkRow> {
  const rows = await query<LinkRow>(
    `UPDATE links SET target_url = $2, image_url = $3, caption = $4, updated_at = now()
      WHERE id = $1::bigint
      RETURNING ${LINK_COLUMNS}`,
    [id, input.target_url, input.image_url, input.caption],
  );
  return rows[0];
}

export async function deleteLink(id: string): Promise<void> {
  await query(`DELETE FROM links WHERE id = $1::bigint`, [id]);
}

export async function listLinks(opts: { owner: string | null; search: string }): Promise<LinkListRow[]> {
  const search = opts.search.trim().replace(/[\\%_]/g, "\\$&");
  return query<LinkListRow>(
    `SELECT l.code, l.target_url, l.image_url, l.caption, l.created_at,
            l.owner_id::text AS owner_id, u.first_name AS owner_name, u.username AS owner_username,
            (SELECT count(*)::int FROM clicks c WHERE c.link_id = l.id) AS clicks,
            (SELECT count(DISTINCT c.visitor)::int FROM clicks c WHERE c.link_id = l.id) AS uniques,
            (SELECT count(*)::int FROM clicks c WHERE c.link_id = l.id AND c.created_at >= now() - interval '24 hours') AS clicks_24h
       FROM links l
       JOIN users u ON u.telegram_id = l.owner_id
      WHERE ($1::bigint IS NULL OR l.owner_id = $1::bigint)
        AND ($2::text = '' OR l.caption ILIKE '%' || $2::text || '%'
                           OR l.code ILIKE '%' || $2::text || '%'
                           OR l.target_url ILIKE '%' || $2::text || '%')
      ORDER BY l.created_at DESC
      LIMIT 300`,
    [opts.owner, search],
  );
}

// ---------- clicks ----------

export interface ClickInfo {
  country: string | null;
  device: string;
  os: string;
  source: string;
  visitor: string;
}

export async function recordClick(linkId: string, info: ClickInfo): Promise<void> {
  await query(
    `INSERT INTO clicks (link_id, country, device, os, source, visitor)
     VALUES ($1::bigint, $2, $3, $4, $5, $6)`,
    [linkId, info.country, info.device, info.os, info.source, info.visitor],
  );
}
