import { pathToFileURL } from 'node:url';

export function healthUrl(base) {
  const url = new URL(base);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.onrender.com') ||
      url.username || url.password || url.port || url.search || url.hash ||
      (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('RENDER_SERVICE_URL must be the HTTPS origin of your onrender.com service');
  }
  return new URL('/api/ping', url);
}

export async function ping(base, { request = fetch, pause = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  const url = healthUrl(base);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await request(url, {
        redirect: 'error', signal: AbortSignal.timeout(65000),
        headers: { 'User-Agent': 'freellmapi-render-healthcheck/1.0' },
      });
      if (!response.ok) throw new Error(`Health check returned HTTP ${response.status}`);
      const body = await response.json();
      if (body.status !== 'ok') throw new Error('Unexpected health response');
      console.log('Render health endpoint is ready');
      return;
    } catch (error) {
      if (attempt === 3) throw error;
      console.warn(`Health attempt ${attempt} failed; retrying`);
      await pause(5000);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  ping(process.env.RENDER_SERVICE_URL).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
