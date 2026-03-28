// 安全性模块

// 加密API密钥
function encryptApiKey(key) {
  if (!key) return '';
  
  try {
    // 使用简单的加密方法，实际生产环境中应使用更安全的加密方式
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    return btoa(String.fromCharCode(...data));
  } catch (error) {
    console.error('加密API密钥失败:', error);
    return '';
  }
}

// 解密API密钥
function decryptApiKey(encryptedKey) {
  if (!encryptedKey) return '';
  
  try {
    const data = atob(encryptedKey);
    const decoder = new TextDecoder();
    return decoder.decode(new Uint8Array([...data].map(char => char.charCodeAt(0))));
  } catch (error) {
    console.error('解密API密钥失败:', error);
    return '';
  }
}

// 验证API密钥格式
function validateApiKey(key) {
  if (!key) return false;
  
  // 检查密钥长度和格式
  return key.length > 10; // 简单验证，实际应根据具体API要求调整
}

// 模糊处理API密钥（用于显示）
function maskApiKey(key) {
  if (!key) return '';
  
  const length = key.length;
  if (length <= 4) return '****';
  
  const start = key.substring(0, 2);
  const end = key.substring(length - 2);
  const middle = '*'.repeat(Math.min(length - 4, 8));
  
  return `${start}${middle}${end}`;
}

// 安全地处理API请求头
function createApiHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
}

// 检查URL是否安全
function isSecureUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:';
  } catch (error) {
    console.error('Invalid URL format in security check:', url, error);
    return false;
  }
}

// 将函数挂载到全局作用域
if (typeof self !== 'undefined') {
  self.encryptApiKey = encryptApiKey;
  self.decryptApiKey = decryptApiKey;
  self.validateApiKey = validateApiKey;
  self.maskApiKey = maskApiKey;
  self.createApiHeaders = createApiHeaders;
  self.isSecureUrl = isSecureUrl;
}

// 如果支持ES6模块导出，也提供导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    encryptApiKey,
    decryptApiKey,
    validateApiKey,
    maskApiKey,
    createApiHeaders,
    isSecureUrl
  };
}
