const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Developer Info
const DEVELOPER_INFO = {
  developer: "TNEH GROUP",
  telegram: "@tneh_owner",
  website: "https://tnehboomber.onrender.com",
  api_version: "1.0.0"
};

// API Keys storage
const validKeys = new Map();

// Generate API Key
function generateApiKey() {
  return 'TNEH-' + Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Check if key is valid
function isKeyValid(key) {
  if (!validKeys.has(key)) return false;
  const expiryDate = validKeys.get(key);
  return new Date() < expiryDate;
}

// SMS Spam API endpoints
const SMS_APIS = [
  "/api1", "/api2", "/api3", "/api4", "/api5", "/api6", "/api7", "/api8", "/api9", "/api10",
  "/api11", "/api12", "/api13", "/api14", "/api15", "/api16", "/api17", "/api18", "/api19", "/api20",
  "/api21", "/api22", "/api23", "/api24", "/api25", "/api26", "/api27", "/api28", "/api29", "/api30",
  "/api31", "/api32", "/api33", "/api34", "/api35", "/api36", "/api37", "/api38", "/api39", "/api40",
  "/api41", "/api42", "/api43", "/api44", "/api45", "/api46", "/api47", "/api48", "/api49", "/api50",
  "/api51", "/api52", "/api53", "/api54", "/api55", "/api56", "/api57", "/api58", "/api59", "/api60",
  "/api61", "/api62", "/api63", "/api64", "/api65", "/api66", "/api67", "/api68", "/api69", "/api70",
  "/api71", "/api72", "/api73", "/api74", "/api75", "/api76", "/api77", "/api78", "/api79", "/api80",
  "/api81", "/api82", "/api83", "/api84", "/api85", "/api86", "/api87", "/api88", "/api89", "/api90",
  "/api91", "/api92", "/api93", "/api94", "/api95", "/api96", "/api97", "/api98", "/api99", "/api100"
];

// Send SMS function
async function sendSMS(apiEndpoint, number) {
  try {
    const response = await axios.get(`https://lmnx9-sms-spam-v11.onrender.com${apiEndpoint}?number=${number}`, {
      timeout: 10000
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

// Main SMS Spam endpoint
app.get('/api/spam', async (req, res) => {
  const { key, number, count = 10 } = req.query;
  
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
  
  // Validate number (Bangladeshi format)
  const phoneRegex = /^(01|8801|+8801)[0-9]{9}$/;
  if (!phoneRegex.test(number) && !phoneRegex.test(number.replace('+', ''))) {
    return res.status(400).json({
      success: false,
      error: 'Invalid phone number. Use format: 017XXXXXXXX or 88017XXXXXXXX',
      developer: DEVELOPER_INFO
    });
  }
  
  let limit = parseInt(count);
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > 100) limit = 100;
  
  const apisToUse = SMS_APIS.slice(0, limit);
  const results = [];
  
  for (const api of apisToUse) {
    const result = await sendSMS(api, number);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 500)); // Delay between requests
  }
  
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    target_number: number,
    total_requests_sent: results.length,
    successful_requests: results.filter(r => r.success).length,
    failed_requests: results.filter(r => !r.success).length,
    results: results
  });
});

// Single API SMS send
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
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    target_number: number,
    api_used: api,
    result: result
  });
});

// Create API Key (30 days)
app.get('/api/expiredate=30&createkey', (req, res) => {
  const apiKey = generateApiKey();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30);
  
  validKeys.set(apiKey, expiryDate);
  
  res.json({
    success: true,
    api_key: apiKey,
    expiry_date: expiryDate.toISOString(),
    valid_days: 30,
    developer: DEVELOPER_INFO,
    message: "API key generated successfully. Valid for 30 days."
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

// Get available APIs list
app.get('/api/apis', (req, res) => {
  const apis = SMS_APIS.map(api => ({
    api_endpoint: api,
    api_example: `https://tnehboomber.onrender.com/api/send?key=YOUR_KEY&number=017XXXXXXXX&api=${api}`,
    api_name: `TNEH SMS API ${api.replace('/api', '')}`
  }));
  
  res.json({
    success: true,
    total_apis: apis.length,
    all_apis: apis,
    developer: DEVELOPER_INFO
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'active',
    timestamp: new Date().toISOString(),
    developer: DEVELOPER_INFO,
    endpoints: [
      '/api/expiredate=30&createkey',
      '/api/checkkey?key=YOUR_KEY',
      '/api/spam?key=YOUR_KEY&number=017XXXXXXXX&count=10',
      '/api/send?key=YOUR_KEY&number=017XXXXXXXX&api=/api1',
      '/api/apis'
    ]
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: "TNEH BOOMER APP",
    description: "SMS Spam & Bomber API Service",
    developer: DEVELOPER_INFO,
    endpoints: {
      generate_key: "/api/expiredate=30&createkey",
      check_key: "/api/checkkey?key=YOUR_KEY",
      spam_bomb: "/api/spam?key=YOUR_KEY&number=017XXXXXXXX&count=10",
      single_send: "/api/send?key=YOUR_KEY&number=017XXXXXXXX&api=/api1",
      list_apis: "/api/apis",
      health: "/api/health"
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`TNEH BOOMER APP running on port ${PORT}`);
  console.log(`Website URL: https://tnehboomber.onrender.com`);
});
