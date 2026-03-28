// 错误处理模块

// 错误类型定义
const ERROR_TYPES = {
  NETWORK: 'network',
  API_RATE_LIMIT: 'api_rate_limit',
  AUTHENTICATION: 'authentication',
  INVALID_RESPONSE: 'invalid_response',
  CACHE_ERROR: 'cache_error',
  UNKNOWN: 'unknown'
};

// 错误日志存储
const errorLogs = [];
const MAX_LOGS = 100;

// 错误类
class RedditCrawlerError extends Error {
  constructor(message, type = ERROR_TYPES.UNKNOWN, details = {}) {
    super(message);
    this.name = 'RedditCrawlerError';
    this.type = type;
    this.details = details;
    this.timestamp = Date.now();
  }
}

// 记录错误日志
function logError(error, context = {}) {
  const logEntry = {
    timestamp: Date.now(),
    error: {
      message: error.message,
      type: error.type || ERROR_TYPES.UNKNOWN,
      stack: error.stack,
      details: error.details || {}
    },
    context
  };
  
  errorLogs.push(logEntry);
  
  // 限制日志数量
  if (errorLogs.length > MAX_LOGS) {
    errorLogs.shift();
  }
  
  // 打印错误到控制台
  console.error(`[Reddit Crawler Error] ${error.message}`, error);
}

// 获取错误日志
function getErrorLogs(limit = 50) {
  return errorLogs.slice(-limit);
}

// 清空错误日志
function clearErrorLogs() {
  errorLogs.length = 0;
}

// 处理网络错误
function handleNetworkError(error, context = {}) {
  const networkError = new RedditCrawlerError(
    error.message || '网络请求失败',
    ERROR_TYPES.NETWORK,
    { originalError: error.message, ...context }
  );
  logError(networkError, context);
  return networkError;
}

// 处理API速率限制错误
function handleRateLimitError(response, context = {}) {
  const rateLimitError = new RedditCrawlerError(
    'API速率限制 exceeded',
    ERROR_TYPES.API_RATE_LIMIT,
    { 
      status: response.status, 
      headers: {
        'x-ratelimit-remaining': response.headers.get('x-ratelimit-remaining'),
        'x-ratelimit-reset': response.headers.get('x-ratelimit-reset')
      },
      ...context 
    }
  );
  logError(rateLimitError, context);
  return rateLimitError;
}

// 处理认证错误
function handleAuthError(response, context = {}) {
  const authError = new RedditCrawlerError(
    '需要登录Reddit',
    ERROR_TYPES.AUTHENTICATION,
    { status: response.status, ...context }
  );
  logError(authError, context);
  return authError;
}

// 处理无效响应错误
function handleInvalidResponseError(message, context = {}) {
  const invalidResponseError = new RedditCrawlerError(
    message || '无效的API响应',
    ERROR_TYPES.INVALID_RESPONSE,
    context
  );
  logError(invalidResponseError, context);
  return invalidResponseError;
}

// 处理缓存错误
function handleCacheError(error, context = {}) {
  const cacheError = new RedditCrawlerError(
    error.message || '缓存操作失败',
    ERROR_TYPES.CACHE_ERROR,
    { originalError: error.message, ...context }
  );
  logError(cacheError, context);
  return cacheError;
}

// 将函数挂载到全局作用域
if (typeof self !== 'undefined') {
  self.RedditCrawlerError = RedditCrawlerError;
  self.ERROR_TYPES = ERROR_TYPES;
  self.logError = logError;
  self.getErrorLogs = getErrorLogs;
  self.clearErrorLogs = clearErrorLogs;
  self.handleNetworkError = handleNetworkError;
  self.handleRateLimitError = handleRateLimitError;
  self.handleAuthError = handleAuthError;
  self.handleInvalidResponseError = handleInvalidResponseError;
  self.handleCacheError = handleCacheError;
}

// 如果支持ES6模块导出，也提供导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RedditCrawlerError,
    ERROR_TYPES,
    logError,
    getErrorLogs,
    clearErrorLogs,
    handleNetworkError,
    handleRateLimitError,
    handleAuthError,
    handleInvalidResponseError,
    handleCacheError
  };
}
