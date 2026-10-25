// ============================================================
// api/proxy.js — WEBSHARE proxy pool + agents
// ============================================================
const http = require('http');
const https = require('https');
const net = require('net');
const tls = require('tls');

const RAW_PROXIES = [
  '45.38.107.97:6014:rzghlmjq:cdujuj74ccnx',
  '64.137.96.74:6641:rzghlmjq:cdujuj74ccnx',
  '198.23.243.226:6361:rzghlmjq:cdujuj74ccnx',
  '38.154.185.97:6370:rzghlmjq:cdujuj74ccnx',
  '84.247.60.125:6095:rzghlmjq:cdujuj74ccnx',
  '191.96.254.138:6185:rzghlmjq:cdujuj74ccnx',
  '198.46.161.42:5092:rzghlmjq:cdujuj74ccnx',
  '64.137.10.153:5803:rzghlmjq:cdujuj74ccnx',
  '104.164.49.38:7693:rzghlmjq:cdujuj74ccnx',
  '23.26.71.145:5628:rzghlmjq:cdujuj74ccnx'
];

class ProxyPool {
  constructor(raw) {
    this.proxies = raw.map((line, idx) => {
      const [host, port, username, password] = line.split(':');
      return {
        id: idx, host, port: parseInt(port, 10), username, password,
        auth: Buffer.from(`${username}:${password}`).toString('base64'),
        failures: 0, success: 0, disabled: false, lastError: null, lastUsed: null
      };
    });
    this.cursor = 0;
    this.maxFailures = 5;
  }
  next() {
    const live = this.proxies.filter(p => !p.disabled);
    if (!live.length) return null;
    const p = live[this.cursor % live.length];
    this.cursor = (this.cursor + 1) % Math.max(1, live.length);
    p.lastUsed = Date.now();
    return p;
  }
  report(proxy, ok, err = null) {
    if (!proxy) return;
    if (ok) { proxy.success++; proxy.failures = 0; }
    else {
      proxy.failures++;
      proxy.lastError = err ? String(err).slice(0, 120) : 'error';
      if (proxy.failures >= this.maxFailures) proxy.disabled = true;
    }
  }
  snapshot() {
    return this.proxies.map(p => ({
      id: p.id, host: p.host, port: p.port, success: p.success,
      failures: p.failures, disabled: p.disabled,
      lastError: p.lastError, lastUsed: p.lastUsed
    }));
  }
  stats() {
    const live = this.proxies.filter(p => !p.disabled).length;
    return {
      total: this.proxies.length, live, dead: this.proxies.length - live,
      ok_calls: this.proxies.reduce((s, p) => s + p.success, 0),
      failed_calls: this.proxies.reduce((s, p) => s + p.failures, 0)
    };
  }
}

const proxyPool = new ProxyPool(RAW_PROXIES);

function tunnelAgent(proxy) {
  return new https.Agent({
    keepAlive: true, maxSockets: 256, maxFreeSockets: 128,
    timeout: 15000, scheduling: 'fifo', rejectUnauthorized: false,
    createConnection: (opts, cb) => {
      const host = opts.host, port = opts.port || 443;
      const sock = net.connect(proxy.port, proxy.host);
      let connected = false;
      sock.once('connect', () => {
        connected = true;
        sock.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\nProxy-Authorization: Basic ${proxy.auth}\r\n\r\n`);
      });
      let buf = '';
      const onData = (chunk) => {
        buf += chunk.toString('latin1');
        const idx = buf.indexOf('\r\n\r\n');
        if (idx < 0) return;
        sock.removeListener('data', onData);
        const head = buf.slice(0, idx);
        const rest = buf.slice(idx + 4);
        const status = parseInt(head.split(' ')[1], 10);
        if (status !== 200) { sock.destroy(); return cb(new Error(`proxy CONNECT ${status}`)); }
        if (rest) sock.unshift(Buffer.from(rest, 'latin1'));
        const secure = tls.connect({ socket: sock, servername: host, rejectUnauthorized: false });
        secure.once('secureConnect', () => cb(null, secure));
        secure.once('error', (e) => cb(e));
      };
      sock.on('data', onData);
      sock.once('error', (e) => { if (!connected) cb(e); });
    }
  });
}

function plainProxyAgent(proxy) {
  return new http.Agent({
    keepAlive: true, maxSockets: 256, maxFreeSockets: 128, timeout: 15000, scheduling: 'fifo',
    createConnection: (opts, cb) => {
      const host = opts.host, port = opts.port || 80;
      const sock = net.connect(proxy.port, proxy.host);
      sock.once('connect', () => {
        sock.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\nProxy-Authorization: Basic ${proxy.auth}\r\n\r\n`);
      });
      let buf = '';
      const onData = (chunk) => {
        buf += chunk.toString('latin1');
        const idx = buf.indexOf('\r\n\r\n');
        if (idx < 0) return;
        sock.removeListener('data', onData);
        const rest = buf.slice(idx + 4);
        const status = parseInt(buf.slice(0, idx).split(' ')[1], 10);
        if (status !== 200) { sock.destroy(); return cb(new Error(`proxy CONNECT ${status}`)); }
        if (rest) sock.unshift(Buffer.from(rest, 'latin1'));
        cb(null, sock);
      };
      sock.on('data', onData);
      sock.once('error', (e) => cb(e));
    }
  });
}

const DIRECT_HTTPS = new https.Agent({ keepAlive: true, maxSockets: 2048, maxFreeSockets: 512, timeout: 12000, rejectUnauthorized: false });
const DIRECT_HTTP  = new http.Agent({ keepAlive: true, maxSockets: 2048, maxFreeSockets: 512, timeout: 12000 });

function agentsFor(url) {
  const isHttps = url.startsWith('https://');
  const p = proxyPool.next();
  if (!p) {
    return {
      httpsAgent: isHttps ? DIRECT_HTTPS : undefined,
      httpAgent: !isHttps ? DIRECT_HTTP : undefined,
      proxy: null
    };
  }
  return {
    httpsAgent: isHttps ? tunnelAgent(p) : undefined,
    httpAgent: !isHttps ? plainProxyAgent(p) : undefined,
    proxy: p
  };
}

module.exports = { proxyPool, agentsFor };
