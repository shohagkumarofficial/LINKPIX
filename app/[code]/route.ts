import { isValidCode } from "@/lib/code";
import { baseUrl } from "@/lib/http";
import { getLinkByCode, recordClick } from "@/lib/links";
import { notFoundPage, ogPage } from "@/lib/og";
import { clientIp, detectSource, isCrawler, parseDevice, visitorHash } from "@/lib/ua";

export const dynamic = "force-dynamic";

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
};

function notFound(): Response {
  return new Response(notFoundPage(), { status: 404, headers: HTML_HEADERS });
}

async function serve(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code: rawCode } = await ctx.params;
  const code = (rawCode || "").toLowerCase();
  // Cheap rejection of things like /favicon.ico before touching the database.
  if (!isValidCode(code)) return notFound();

  let link;
  try {
    link = await getLinkByCode(code);
  } catch (e) {
    console.error("link lookup failed", e);
    return new Response("Temporary error, please try again.", { status: 503, headers: { "cache-control": "no-store" } });
  }
  if (!link) return notFound();

  const ua = req.headers.get("user-agent") || "";

  // Robots reading the preview (and HEAD checks): show the Open Graph page, don't count a click.
  if (isCrawler(ua) || req.method === "HEAD") {
    const html = ogPage({
      shortUrl: `${baseUrl(req)}/${link.code}`,
      targetUrl: link.target_url,
      caption: link.caption,
      imageUrl: link.image_url,
    });
    return new Response(html, { status: 200, headers: HTML_HEADERS });
  }

  // A real person: count the visit, then send them on.
  try {
    const url = new URL(req.url);
    const { device, os } = parseDevice(ua);
    await recordClick(link.id, {
      country: req.headers.get("x-vercel-ip-country"),
      device,
      os,
      source: detectSource(ua, req.headers.get("referer"), url.searchParams.get("src")),
      visitor: visitorHash(clientIp(req.headers), ua),
    });
  } catch (e) {
    // Never let a tracking problem stop the redirect.
    console.error("click tracking failed", e);
  }

  return new Response(null, {
    status: 302,
    headers: { location: link.target_url, "cache-control": "no-store" },
  });
}

export const GET = serve;
export const HEAD = serve;
