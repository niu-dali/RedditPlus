// 工具函数模块

// 带重试机制的fetch函数
async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
  // 使用限流请求
  return rateLimitedRequest(async () => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        // 只有429（Too Many Requests）或网络错误时才重试
        if (response.ok || (response.status !== 429 && response.status >= 400)) {
          return response;
        }
      } catch (error) {
        // 网络错误，继续重试
        console.error(`Network error on attempt ${i+1}/${retries}:`, url, error);
        if (i === retries - 1) {
          throw error;
        }
      }
      
      // 等待一段时间后重试
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
    
    // 所有重试都失败
    throw new Error('Max retries exceeded');
  });
}

// 格式化时间
function formatTime(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

// 截断文本
function truncateText(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// 验证URL格式
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (error) {
    console.error('Invalid URL format:', url, error);
    return false;
  }
}

// 生成随机ID
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// 深拷贝对象
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 节流函数
function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 将函数挂载到全局作用域
if (typeof self !== 'undefined') {
  self.fetchWithRetry = fetchWithRetry;
  self.formatTime = formatTime;
  self.truncateText = truncateText;
  self.isValidUrl = isValidUrl;
  self.generateId = generateId;
  self.deepClone = deepClone;
  self.debounce = debounce;
  self.throttle = throttle;
}

// 如果支持ES6模块导出，也提供导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fetchWithRetry,
    formatTime,
    truncateText,
    isValidUrl,
    generateId,
    deepClone,
    debounce,
    throttle
  };
}
