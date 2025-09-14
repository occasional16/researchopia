export const runtime = 'nodejs';

export async function GET() {
  try {
    const uptime = process.uptime();
    const now = new Date().toISOString();
    return new Response(
      JSON.stringify({ status: 'ok', uptime, timestamp: now }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ status: 'error', message: err?.message || 'unknown error' }),
      { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } }
    );
  }
}
