// 请求限流模块

// 限流配置
const RATE_LIMIT_CONFIG = {
  MAX_REQUESTS_PER_MINUTE: 60, // 每分钟最大请求数
  MIN_REQUEST_INTERVAL: 1000, // 最小请求间隔（毫秒）
  WINDOW_SIZE: 60000, // 时间窗口大小（毫秒）
  BURST_LIMIT: 10 // 突发请求限制
};

// 请求记录
const requestTimestamps = [];

// 上次请求时间
let lastRequestTime = 0;

// 等待队列
const requestQueue = [];

// 队列处理状态
let isProcessingQueue = false;

// 检查是否允许请求
function allowRequest() {
  const now = Date.now();
  
  // 清理过期的请求记录
  const cutoffTime = now - RATE_LIMIT_CONFIG.WINDOW_SIZE;
  const recentRequests = requestTimestamps.filter(timestamp => timestamp > cutoffTime);
  requestTimestamps.length = 0;
  requestTimestamps.push(...recentRequests);
  
  // 检查请求频率
  if (recentRequests.length >= RATE_LIMIT_CONFIG.MAX_REQUESTS_PER_MINUTE) {
    return false;
  }
  
  // 检查请求间隔
  if (now - lastRequestTime < RATE_LIMIT_CONFIG.MIN_REQUEST_INTERVAL) {
    return false;
  }
  
  return true;
}

// 记录请求
function recordRequest() {
  const now = Date.now();
  requestTimestamps.push(now);
  lastRequestTime = now;
}

// 延迟执行函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 限流请求处理
async function rateLimitedRequest(requestFn) {
  return new Promise(async (resolve, reject) => {
    // 添加到队列
    requestQueue.push({ requestFn, resolve, reject });
    
    // 处理队列
    if (!isProcessingQueue) {
      processQueue();
    }
  });
}

// 处理请求队列
async function processQueue() {
  if (requestQueue.length === 0) {
    isProcessingQueue = false;
    return;
  }
  
  isProcessingQueue = true;
  
  const { requestFn, resolve, reject } = requestQueue.shift();
  
  try {
    // 检查是否允许请求
    if (allowRequest()) {
      // 执行请求
      recordRequest();
      const result = await requestFn();
      resolve(result);
    } else {
      // 等待后重试
      await delay(RATE_LIMIT_CONFIG.MIN_REQUEST_INTERVAL);
      // 重新添加到队列
      requestQueue.unshift({ requestFn, resolve, reject });
    }
  } catch (error) {
    console.error('Error in rate limited request:', error);
    reject(error);
  } finally {
    // 继续处理下一个请求
    setTimeout(processQueue, 100);
  }
}

// 获取当前请求计数
function getRequestCount() {
  const now = Date.now();
  const cutoffTime = now - RATE_LIMIT_CONFIG.WINDOW_SIZE;
  return requestTimestamps.filter(timestamp => timestamp > cutoffTime).length;
}

// 清空请求记录
function clearRequestHistory() {
  requestTimestamps.length = 0;
  lastRequestTime = 0;
}

// 获取队列长度
function getQueueLength() {
  return requestQueue.length;
}

// 将函数挂载到全局作用域
if (typeof self !== 'undefined') {
  self.RATE_LIMIT_CONFIG = RATE_LIMIT_CONFIG;
  self.rateLimitedRequest = rateLimitedRequest;
  self.getRequestCount = getRequestCount;
  self.clearRequestHistory = clearRequestHistory;
  self.getQueueLength = getQueueLength;
}

// 如果支持ES6模块导出，也提供导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RATE_LIMIT_CONFIG,
    rateLimitedRequest,
    getRequestCount,
    clearRequestHistory,
    getQueueLength
  };
}
