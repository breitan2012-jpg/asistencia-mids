import express from 'express';
export function createHttpApp(service, { origins = [], secureCookies = true, transport = 'cookie', trustProxy = false, healthCheck = false } = {}) {
  if (!['cookie', 'bearer'].includes(transport)) throw new Error('Invalid session transport');
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  if (healthCheck) app.get('/healthz', (req, res) => res.set('Cache-Control', 'no-store').json({ ok: true }));
  app.use((req, res, next) => {
    res.set({ 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Vary': 'Cookie, Origin' });
    const origin = req.get('Origin');
    if (transport === 'bearer') {
      if (!origin || !origins.includes(origin)) return res.status(403).json({ error: 'Solicitud de origen no autorizado.' });
      res.set('Access-Control-Allow-Origin', origin);
      if (req.method === 'OPTIONS') {
        const method = req.get('Access-Control-Request-Method');
        const headers = (req.get('Access-Control-Request-Headers') || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
        if (!['GET', 'POST'].includes(method) || headers.some(h => !['authorization', 'content-type', 'x-mids-request'].includes(h))) return res.sendStatus(403);
        return res.set({ 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-MIDS-Request', 'Access-Control-Max-Age': '600' }).sendStatus(204);
      }
      if (req.get('X-MIDS-Request') !== '1') return res.status(403).json({ error: 'Solicitud inválida.' });
    }
    if (req.method !== 'GET' && (!origin || !origins.includes(origin) || req.get('X-MIDS-Request') !== '1' || !req.is('application/json'))) return res.status(403).json({ error: 'Solicitud de origen no autorizado.' });
    if (transport === 'cookie' && req.get('Sec-Fetch-Site') === 'cross-site') return res.status(403).json({ error: 'Solicitud de origen no autorizado.' });
    next();
  });
  app.use(express.json({ limit: '300kb' }));
  app.all('/api/:action', async (req, res) => {
    try {
      if ((req.params.action === 'session' && req.method !== 'GET') || (req.params.action !== 'session' && req.method !== 'POST')) return res.status(405).json({ error: 'Método no permitido.' });
      const cookie = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('__session='))?.slice(10);
      const authorization = req.get('Authorization') || '';
      if (transport === 'bearer' && authorization && !/^Bearer [\w-]{43}$/.test(authorization)) return res.status(401).json({ error: 'Sesión inválida.' });
      const token = transport === 'bearer' ? authorization.slice(7) || undefined : cookie;
      const result = await service.dispatch({ action: req.params.action, body: req.body || {}, token, ip: req.ip || req.socket.remoteAddress, origin: req.get('Origin') });
      if (transport === 'cookie' && result.token) res.cookie('__session', result.token, { httpOnly: true, secure: secureCookies, sameSite: 'strict', path: '/', maxAge: 180 * 86400000 });
      res.json(transport === 'bearer' && result.token ? { ...result.data, sessionToken: result.token } : result.data);
    } catch (error) {
      const status = error.status || 500;
      if (status === 500) console.error('MIDS request failed', { action: req.params.action, code: error.code || 'internal' });
      res.status(status).json({ error: status === 500 ? 'No se pudo completar la operación. Intenta de nuevo.' : error.message });
    }
  });
  app.use((error, req, res, next) => res.status(error.status === 413 ? 413 : 400).json({ error: 'Solicitud inválida o demasiado grande.' }));
  return app;
}
