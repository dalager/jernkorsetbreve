/**
 * Cloudflare Pages Worker for markdown content negotiation.
 *
 * When a request includes Accept: text/markdown, this worker checks if a
 * pre-built .md file exists alongside the HTML page. If so, it serves the
 * markdown version with proper headers. Otherwise, it falls through to HTML.
 *
 * The .md files are generated at build time by scripts/generate-markdown-pages.js.
 */

export default {
  async fetch(request, env) {
    const accept = request.headers.get("Accept") || "";

    // Only intercept markdown requests
    if (!accept.includes("text/markdown")) {
      return env.ASSETS.fetch(request);
    }

    // Build the markdown file path from the request URL
    const url = new URL(request.url);
    let mdPath = url.pathname;

    // Normalize: /letters/1/ → /letters/1/index.md
    if (mdPath.endsWith("/")) {
      mdPath += "index.md";
    } else if (!mdPath.includes(".")) {
      mdPath += "/index.md";
    } else {
      // Has extension (e.g. .xml, .json) — not a page, pass through
      return env.ASSETS.fetch(request);
    }

    // Try to fetch the pre-built markdown file
    const mdUrl = new URL(mdPath, request.url);
    const mdResponse = await env.ASSETS.fetch(mdUrl.toString());

    if (!mdResponse.ok) {
      // No markdown version available, fall through to HTML
      return env.ASSETS.fetch(request);
    }

    const markdown = await mdResponse.text();
    const tokenEstimate = Math.ceil(markdown.length / 4);

    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "x-markdown-tokens": String(tokenEstimate),
        "Cache-Control": "public, max-age=3600",
        "Vary": "Accept",
      },
    });
  },
};
