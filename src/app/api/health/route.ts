export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const uptime = process.uptime();
    const now = new Date().toISOString();
    const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local';
    const region = process.env.VERCEL_REGION || 'unknown';
    
    // CORS headers for browser extension
    const headers = {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    return new Response(
      JSON.stringify({ 
        status: 'ok', 
        uptime, 
        timestamp: now,
        version,
        region,
        nodeVersion: process.version
      }),
      {
        status: 200,
        headers,
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ status: 'error', message: err?.message || 'unknown error' }),
      { 
        status: 500, 
        headers: { 
          'content-type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    );
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
