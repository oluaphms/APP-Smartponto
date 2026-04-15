/**
 * Rotas /api/rep/:slug consolidadas (1 Serverless Function — limite Vercel Hobby: 12 funções).
 * URLs mantidas: /api/rep/status, /api/rep/punches, /api/rep/sync, /api/rep/punch, /api/rep/import-afd
 */

import { handleRepSlug } from '../../modules/rep-integration/repApiRoutes';

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const slug = parts[2] ?? '';
  return handleRepSlug(request, slug);
}
