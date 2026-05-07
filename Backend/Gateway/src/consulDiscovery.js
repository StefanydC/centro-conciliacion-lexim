// ARCHIVO: backend/gateway/src/consulDiscovery.js
'use strict';
const http = require('http');

const CONSUL_HOST = process.env.CONSUL_HOST || 'consul';
const CONSUL_PORT = parseInt(process.env.CONSUL_PORT || '8500', 10);
const CACHE_TTL   = 10_000; // 10 segundos por servicio

const _cache    = new Map(); // serviceName → { instances, expiresAt }
const _counters = new Map(); // serviceName → índice round-robin

function consulGet(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: CONSUL_HOST, port: CONSUL_PORT, path, method: 'GET' },
      (res) => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end',  () => {
          try { resolve(JSON.parse(raw)); }
          catch { reject(new Error(`Consul parse error (${path}): ${raw.slice(0, 100)}`)); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('Consul request timeout')));
    req.end();
  });
}

function pickRoundRobin(serviceName, instances) {
  const idx  = (_counters.get(serviceName) || 0) % instances.length;
  _counters.set(serviceName, idx + 1);
  const inst = instances[idx];
  return `http://${inst.address}:${inst.port}`;
}

async function discoverService(serviceName) {
  const now    = Date.now();
  const cached = _cache.get(serviceName);

  if (cached && cached.expiresAt > now) {
    return pickRoundRobin(serviceName, cached.instances);
  }

  const result = await consulGet(`/v1/health/service/${serviceName}?passing=true`);

  if (!Array.isArray(result) || result.length === 0) {
    throw new Error(`Sin instancias sanas para: ${serviceName}`);
  }

  const instances = result.map(e => ({
    address: e.Service.Address || e.Node.Address,
    port:    e.Service.Port
  }));

  _cache.set(serviceName, { instances, expiresAt: now + CACHE_TTL });
  return pickRoundRobin(serviceName, instances);
}

async function resolveService(serviceName, fallbackUrl) {
  try {
    return await discoverService(serviceName);
  } catch (err) {
    console.warn(`[CONSUL-DISC] ${serviceName} → fallback (${err.message}): ${fallbackUrl}`);
    return fallbackUrl;
  }
}

module.exports = { discoverService, resolveService };
