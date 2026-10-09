export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The page link-preview robots read. The Open Graph <meta> tags must be in the
 * HTML itself, because these robots do not run JavaScript.
 */
export function ogPage(opts: { shortUrl: string; targetUrl: string; caption: string | null; imageUrl: string | null }): string {
  const title = opts.caption || opts.shortUrl;
  const e = escapeHtml;
  const image = opts.imageUrl
    ? `
<meta property="og:image" content="${e(opts.imageUrl)}">
<meta property="og:image:secure_url" content="${e(opts.imageUrl)}">
<meta name="twitter:image" content="${e(opts.imageUrl)}">`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
<meta property="og:type" content="website">
<meta property="og:title" content="${e(title)}">
<meta property="og:url" content="${e(opts.shortUrl)}">${image}
<meta name="twitter:card" content="${opts.imageUrl ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${e(title)}">
<meta name="robots" content="noindex, nofollow">
</head>
<body style="font-family:system-ui,sans-serif;text-align:center;padding:48px 16px">
<p><a href="${e(opts.targetUrl)}" rel="nofollow noopener">Continue to the link</a></p>
</body>
</html>`;
}

export function notFoundPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Link not found</title>
<meta name="robots" content="noindex">
</head>
<body style="font-family:system-ui,sans-serif;text-align:center;padding:72px 16px;color:#222">
<h1 style="font-size:20px">This link doesn't exist</h1>
<p style="color:#666">It may have been removed or typed incorrectly.</p>
</body>
</html>`;
}
