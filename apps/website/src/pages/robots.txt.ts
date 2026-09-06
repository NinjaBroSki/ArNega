import type { APIRoute } from 'astro';

/** robots.txt with an absolute sitemap URL derived from the deployed site. */
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL(
    `${import.meta.env.BASE_URL.replace(/\/$/, '')}/sitemap-index.xml`,
    site ?? 'http://localhost:4321',
  ).href;
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
