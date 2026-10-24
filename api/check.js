#!/usr/bin/env node
// api/check.js — probe every API in SMS_APIS once, rank live vs dead
// usage: node api/check.js [--phone 01712345678] [--concurrency 40] [--timeout 8000]
// writes: api/check-report.json  (per-API result)
// prints: live / total / dead summary + top 40 live

const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const axios = require('axios');

// pull SMS_APIS out of index.js without starting express
const MOD = require('./index.js');
const SMS_APIS = MOD.SMS_APIS;

const ARGS = process.argv.slice(2);
function arg(name, def) {
  const i = ARGS.indexOf('--' + name);
  return i >= 0 ? ARGS[i + 1] : def;
}

const PHONE   = (arg('phone', '01712345678') || '').replace(/[^0-9]/g, '');
const CONC    = parseInt(arg('concurrency', '40'), 10);
const TIMEOUT = parseInt(arg('timeout', '8000'), 10);
const OUT     = path.resolve(__dirname, arg('out', 'check-report.json'));

const HTTPS_AGENT = new https.Agent({ keepAlive: true, maxSockets: 512, rejectUnauthorized: false });
const HTTP_AGENT  = new http.Agent({ keepAlive: true, maxSockets: 512 });

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36';

function buildBody(api, phone) {
  const now = new Date().toISOString().slice(0, 19);
  const rand = () => Math.random().toString(36).slice(2, 12);
  const expand = (o) => {
    if (o === null || o === undefined) return o;
    if (Array.isArray(o)) return o.map(expand);
    if (typeof o === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(o)) out[k] = expand(v);
      return out;
    }
    if (typeof o === 'string') {
      return o
        .replace(/{phone}/g, phone)
        .replace(/{phone_e164}/g, '88' + phone)
        .replace(/{phone_10}/g, phone.slice(-10))
        .replace(/{count}/g, '1')
        .replace(/{ts}/g, String(Date.now()))
        .replace(/{name}/g, 'Test')
        .replace(/{firstName}/g, 'Test')
        .replace(/{lastName}/g, 'Khan')
        .replace(/{email}/g, rand() + '@gmail.com')
        .replace(/{device}/g, rand())
        .replace(/randomName/g, 'Test')
        .replace(/randomEmail/g, rand() + '@gmail.com')
        .replace(/currentTime/g, String(Date.now()))
        .replace(/\bnow\b/g, now);
    }
    return o;
  };
  return expand(api.body);
}

async function probe(api) {
  const start = Date.now();
  let url = typeof api.url === 'string' ? api.url : '';
  url = url
    .replace(/{phone}/g, PHONE)
    .replace(/{phone_e164}/g, '88' + PHONE)
    .replace(/{phone_10}/g, PHONE.slice(-10))
    .replace(/{count}/g, '1')
    .replace(/{ts}/g, String(Date.now()));

  const headers = Object.assign(
    { 'User-Agent': UA, 'Accept': 'application/json, text/plain, */*' },
    api.headers || {}
  );

  const isHttps = url.startsWith('https://');
  const cfg = {
    method: api.method || 'GET',
    url,
    headers,
    timeout: api.timeout || TIMEOUT,
    validateStatus: () => true,
    httpsAgent: isHttps ? HTTPS_AGENT : undefined,
    httpAgent: !isHttps ? HTTP_AGENT : undefined,
    maxRedirects: 3
  };

  if (cfg.method === 'POST') {
    const body = buildBody(api, PHONE);
    if (typeof body === 'string') {
      cfg.data = body;
    } else if (api.isFormData) {
      cfg.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      cfg.data = new URLSearchParams(body).toString();
    } else {
      cfg.data = body;
    }
  }

  let status = null, errorMsg = null, bodyLen = 0, preview = '';
  try {
    const r = await axios(cfg);
    status = r.status;
    const txt = typeof r.data === 'string' ? r.data : JSON.stringify(r.data || {});
    bodyLen = txt.length;
    preview = txt.slice(0, 200);
  } catch (e) {
    errorMsg = (e.code || e.message || 'ERR').slice(0, 120);
    status = e.response ? e.response.status : null;
  }
  const ms = Date.now() - start;

  // "live" heuristic:
  //   status 2xx/3xx -> live
  //   status 4xx -> live-but-rejected (endpoint exists, input rejected)
  //   status 5xx or network err/timeout -> dead
  let verdict = 'dead';
  if (status && status >= 200 && status < 400) verdict = 'live';
  else if (status && status >= 400 && status < 500) verdict = 'reachable';
  else if (!status && errorMsg && /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN/i.test(errorMsg)) verdict = 'dead';

  return {
    id: api.id, name: api.name, method: api.method || 'GET',
    url, status, ms, verdict, error: errorMsg,
    bodyLen, preview
  };
}

async function run() {
  console.log(`probing ${SMS_APIS.length} APIs  phone=${PHONE}  conc=${CONC}  timeout=${TIMEOUT}ms\n`);
  const results = [];
  let idx = 0;
  let done = 0;

  async function worker() {
    while (idx < SMS_APIS.length) {
      const api = SMS_APIS[idx++];
      const r = await probe(api);
      results.push(r);
      done++;
      if (done % 25 === 0 || done === SMS_APIS.length) {
        process.stdout.write(`  ${done}/${SMS_APIS.length}\r`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, SMS_APIS.length) }, worker));
  process.stdout.write('\n');

  const live      = results.filter(r => r.verdict === 'live');
  const reachable = results.filter(r => r.verdict === 'reachable');
  const dead      = results.filter(r => r.verdict === 'dead');

  const summary = {
    phone: PHONE,
    total: results.length,
    live: live.length,
    reachable: reachable.length,
    dead: dead.length,
    runAt: new Date().toISOString(),
    results
  };
  fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
  console.log(`\n== summary ==`);
  console.log(`total     ${results.length}`);
  console.log(`live      ${live.length}      (2xx/3xx)`);
  console.log(`reachable ${reachable.length}      (4xx — endpoint exists, rejected input)`);
  console.log(`dead      ${dead.length}      (5xx / no route / timeout)`);
  console.log(`\nreport:   ${OUT}\n`);

  const bySpeed = [...live].sort((a, b) => a.ms - b.ms);
  console.log(`== top live (fastest) ==`);
  for (const r of bySpeed.slice(0, 40)) {
    console.log(`  ${String(r.ms).padStart(5)}ms  ${String(r.status)}  #${r.id}  ${r.name}`);
  }
  if (live.length > 40) console.log(`  … +${live.length - 40} more in ${OUT}`);

  const byName = results.sort((a, b) => a.id - b.id);
  fs.writeFileSync(OUT, JSON.stringify({ ...summary, results: byName }, null, 2));
}

run().catch(e => { console.error('fatal:', e); process.exit(1); });
