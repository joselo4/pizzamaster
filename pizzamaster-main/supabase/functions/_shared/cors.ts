
// Shared CORS headers for invoking Supabase Edge Functions from the browser.
// The browser sends an OPTIONS preflight request. Always return HTTP OK with these headers.
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
