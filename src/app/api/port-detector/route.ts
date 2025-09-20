export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const port = process.env.PORT || '3000';
    const host = process.env.HOST || 'localhost';
    
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
        port: port,
        host: host,
        baseUrl: `http://${host}:${port}`,
        apiUrl: `http://${host}:${port}/api/v1`,
        timestamp: new Date().toISOString()
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
