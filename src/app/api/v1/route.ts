export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const now = new Date().toISOString();
    const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local';
    
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
        timestamp: now,
        version,
        api: 'v1',
        service: 'researchopia-annotations',
        endpoints: {
          health: '/api/v1/health',
          annotations: '/api/v1/annotations',
          'annotations-batch': '/api/v1/annotations/batch'
        }
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
