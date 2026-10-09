import { neon } from "@neondatabase/serverless";

export type Row = Record<string, any>;

let client: ReturnType<typeof neon> | null = null;

function getClient() {
  if (!client) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url);
  }
  return client;
}

/**
 * Run one SQL statement with $1, $2... placeholders.
 * Always pass values through `params`, never paste them into the SQL text.
 */
export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const rows = await getClient().query(text, params as any[]);
  return rows as unknown as T[];
}
