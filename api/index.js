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
app.use(express.static(path.join(__dirname, '../public')));

// Developer Info - TNEH GROUP
const DEVELOPER_INFO = {
  developer: "TNEH GROUP",
  telegram: "@tneh_owner",
  website: "https://tnehboomber.onrender.com",
  api_version: "1.0.0"
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
console.log(`📁 Keys file path: ${KEYS_FILE}`);

function initKeysFile() {
  try {
    const dir = path.dirname(KEYS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(KEYS_FILE)) {
      fs.writeFileSync(KEYS_FILE, JSON.stringify({}, null, 2));
      console.log('✅ Created keys.json file at:', KEYS_FILE);
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
    console.log(`📋 Loaded ${keysMap.size} keys from ${KEYS_FILE}`);
    return keysMap;
  } catch (error) {
    console.error('Error loading keys:', error.message);
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
    console.log(`💾 Saved ${keysMap.size} keys to ${KEYS_FILE}`);
    return true;
  } catch (error) {
    console.error('Error saving keys:', error.message);
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
      console.log(`🗑️ Removed expired key: ${key}`);
    }
  }
  if (changed) {
    saveKeys(validKeys);
  }
}

setInterval(cleanExpiredKeys, 60 * 60 * 1000);

// Generate all SMS APIs from api1 to api110
const SMS_APIS = [];
for (let i = 1; i <= 110; i++) {
  SMS_APIS.push({
    api_endpoint: `/api${i}`,
    api_example: `https://lmnx9-sms-spam-v11.onrender.com/api${i}?number=018XXXXXXXX`,
    api_name: `LMNx9 API${i}`
  });
}

// LMNx9 API Base URL
const LMNX9_BASE_URL = 'https://lmnx9-sms-spam-v11.onrender.com';

async function getLMNx9APIs() {
  try {
    const response = await axios.get(LMNX9_BASE_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching LMNx9 APIs:', error.message);
    return {
      all_apis: SMS_APIS,
      total_apis: SMS_APIS.length
    };
  }
}

async function sendSMS(apiEndpoint, number) {
  try {
    const response = await axios.get(`${LMNX9_BASE_URL}${apiEndpoint}?number=${number}`, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });
    return {
      success: true,
      api: apiEndpoint,
      response: response.data
    };
  } catch (error) {
    return {
      success: false,
      api: apiEndpoint,
      error: error.message
    };
  }
}

// ==================== API ENDPOINTS ====================

// Root endpoint
app.get('/', async (req, res) => {
  const apiData = await getLMNx9APIs();
  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  
  res.json({
    developer: DEVELOPER_INFO,
    all_apis: apiData.all_apis || SMS_APIS,
    total_apis: apiData.total_apis || SMS_APIS.length,
    http_code: 200,
    status: "success",
    req_time: currentTime,
    endpoints: {
      generate_key: "/api/expiredate=30&createkey",
      check_key: "/api/checkkey?key=YOUR_KEY",
      spam_bomber: "/api/spam?number=017XXXXXXXX&count=110",  // NO KEY REQUIRED
      single_send: "/api/send?key=YOUR_KEY&number=017XXXXXXXX&api=/api1",
      all_apis: "/api/apis",
      health: "/api/health"
    }
  });
});

// ================================================
// UPDATED: SMS SPAM ENDPOINT - NO API KEY REQUIRED
// ================================================
app.get('/api/spam', async (req, res) => {
  const { number, count = 10 } = req.query;
  
  // Remove key requirement - anyone can use this endpoint
  if (!number) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: number',
      developer: DEVELOPER_INFO,
      usage: '/api/spam?number=017XXXXXXXX&count=10'
    });
  }
  
  // Validate number (Bangladeshi format)
  const cleanNumber = number.replace(/[^0-9]/g, '');
  const phoneRegex = /^(01|8801)[0-9]{9}$/;
  if (!phoneRegex.test(cleanNumber)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid phone number. Use format: 017XXXXXXXX or 88017XXXXXXXX',
      developer: DEVELOPER_INFO
    });
  }
  
  let limit = parseInt(count);
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > SMS_APIS.length) limit = SMS_APIS.length;
  
  const apisToUse = SMS_APIS.slice(0, limit);
  const results = [];
  
  for (const api of apisToUse) {
    const result = await sendSMS(api.api_endpoint, cleanNumber);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    target_number: cleanNumber,
    total_requests_sent: results.length,
    successful_requests: results.filter(r => r.success).length,
    failed_requests: results.filter(r => !r.success).length,
    req_time: currentTime,
    results: results
  });
});

// ================================================
// KEY-REQUIRED ENDPOINTS (For users with API keys)
// ================================================

// Generate API Key (30 days)
app.get('/api/expiredate=30&createkey', (req, res) => {
  const apiKey = generateApiKey();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30);
  
  validKeys.set(apiKey, expiryDate);
  const saved = saveKeys(validKeys);
  
  res.json({
    success: true,
    api_key: apiKey,
    expiry_date: expiryDate.toISOString(),
    valid_days: 30,
    developer: DEVELOPER_INFO,
    message: "API key generated successfully. Valid for 30 days.",
    saved_to_file: saved,
    note: "Save this key! It won't be shown again."
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

// Single API SMS send (Requires Key)
app.get('/api/send', async (req, res) => {
  const { key, number, api } = req.query;
  
  if (!key || !number || !api) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: key, number, and api',
      developer: DEVELOPER_INFO
    });
  }
  
  if (!isKeyValid(key)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired API key',
      developer: DEVELOPER_INFO
    });
  }
  
  const result = await sendSMS(api, number);
  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    target_number: number,
    api_used: api,
    req_time: currentTime,
    result: result
  });
});

// Get all available APIs
app.get('/api/apis', async (req, res) => {
  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  
  try {
    const apiData = await getLMNx9APIs();
    res.json({
      developer: DEVELOPER_INFO,
      all_apis: apiData.all_apis || SMS_APIS,
      total_apis: apiData.total_apis || SMS_APIS.length,
      http_code: 200,
      status: "success",
      req_time: currentTime
    });
  } catch (error) {
    res.json({
      developer: DEVELOPER_INFO,
      all_apis: SMS_APIS,
      total_apis: SMS_APIS.length,
      http_code: 200,
      status: "success",
      req_time: currentTime
    });
  }
});

// Get specific API (api1 to api110) - Requires Key
app.get('/api/api:num', async (req, res) => {
  const { key, number } = req.query;
  const apiNum = req.params.num;
  const apiEndpoint = `/api${apiNum}`;
  
  if (!key || !number) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: key and number',
      developer: DEVELOPER_INFO
    });
  }
  
  if (!isKeyValid(key)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired API key',
      developer: DEVELOPER_INFO
    });
  }
  
  const result = await sendSMS(apiEndpoint, number);
  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    target_number: number,
    api_used: apiEndpoint,
    req_time: currentTime,
    result: result
  });
});

// View all saved keys (Admin endpoint)
app.get('/api/admin/keys', (req, res) => {
  try {
    const keys = {};
    for (const [key, value] of validKeys.entries()) {
      keys[key] = value.toISOString();
    }
    
    const now = new Date();
    let validCount = 0;
    for (const [key, expiryDate] of validKeys.entries()) {
      if (new Date() < expiryDate) validCount++;
    }
    
    res.json({
      success: true,
      total_keys: validKeys.size,
      valid_keys: validCount,
      expired_keys: validKeys.size - validCount,
      keys: keys,
      file_location: KEYS_FILE,
      is_render: !!process.env.RENDER
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  
  let validCount = 0;
  for (const [key, expiryDate] of validKeys.entries()) {
    if (new Date() < expiryDate) validCount++;
  }
  
  res.json({
    status: 'active',
    developer: DEVELOPER_INFO,
    timestamp: new Date().toISOString(),
    req_time: currentTime,
    uptime: process.uptime(),
    total_apis: SMS_APIS.length,
    total_keys: validKeys.size,
    valid_keys: validCount,
    keys_file_location: KEYS_FILE,
    is_render: !!process.env.RENDER,
    api_range: "API 1 to API 110",
    endpoints: {
      root: "/",
      generate_key: "/api/expiredate=30&createkey",
      check_key: "/api/checkkey?key=YOUR_KEY",
      spam_bomber: "/api/spam?number=017XXXXXXXX&count=110",  // NO KEY REQUIRED
      single_send: "/api/send?key=YOUR_KEY&number=017XXXXXXXX&api=/api1",
      specific_api: "/api/api1?key=YOUR_KEY&number=017XXXXXXXX",
      all_apis: "/api/apis",
      admin_keys: "/api/admin/keys"
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
  console.log(`🌐 Website URL: https://tnehboomber.onrender.com`);
  console.log(`👨‍💻 Developer: ${DEVELOPER_INFO.developer}`);
  console.log(`📱 Telegram: ${DEVELOPER_INFO.telegram}`);
  console.log(`📡 Total SMS APIs: ${SMS_APIS.length} (API 1 to API 110)`);
  console.log(`💾 Keys file: ${KEYS_FILE}`);
  console.log(`📋 Loaded ${validKeys.size} saved API keys`);
  console.log(`🖥️ Running on Render: ${!!process.env.RENDER}`);
  console.log(`\n🔓 FREE API ENDPOINT (No Key Required):`);
  console.log(`   GET /api/spam?number=017XXXXXXXX&count=110\n`);
});
