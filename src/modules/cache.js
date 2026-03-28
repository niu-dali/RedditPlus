// 缓存模块

// 缓存对象
const cache = new Map();

// 缓存配置
const CACHE_CONFIG = {
  MAX_AGE: 3600000, // 1小时
  MAX_SIZE: 100, // 最大缓存项数
  CLEANUP_INTERVAL: 600000, // 10分钟清理一次过期缓存
  STORAGE_KEY: 'reddit_plus_cache', // localStorage存储键
  PERSISTENT_TYPES: ['subreddit', 'post'], // 需要持久化的缓存类型
  PRIORITY_LEVELS: {
    HIGH: 3,    // 高优先级（如热门板块）
    MEDIUM: 2,  // 中优先级（如普通板块）
    LOW: 1      // 低优先级（如评论）
  }
};

// 缓存项结构
class CacheItem {
  constructor(value, maxAge = CACHE_CONFIG.MAX_AGE, priority = CACHE_CONFIG.PRIORITY_LEVELS.MEDIUM) {
    this.value = value;
    this.timestamp = Date.now();
    this.maxAge = maxAge;
    this.priority = priority;
  }
  
  isExpired() {
    return Date.now() - this.timestamp > this.maxAge;
  }
  
  toJSON() {
    return {
      value: this.value,
      timestamp: this.timestamp,
      maxAge: this.maxAge,
      priority: this.priority
    };
  }
  
  static fromJSON(data) {
    const item = new CacheItem(data.value, data.maxAge, data.priority);
    item.timestamp = data.timestamp;
    return item;
  }
}

// 生成缓存键
function generateCacheKey(prefix, ...args) {
  return `${prefix}:${args.map(arg => JSON.stringify(arg)).join(':')}`;
}

// 从chrome.storage.local加载缓存
function loadFromStorage() {
  try {
    chrome.storage.local.get([CACHE_CONFIG.STORAGE_KEY], (result) => {
      if (result && result[CACHE_CONFIG.STORAGE_KEY]) {
        const parsedData = result[CACHE_CONFIG.STORAGE_KEY];
        for (const [key, data] of Object.entries(parsedData)) {
          const item = CacheItem.fromJSON(data);
          if (!item.isExpired()) {
            cache.set(key, item);
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading cache from storage:', error);
  }
}

// 保存缓存到chrome.storage.local
function saveToStorage() {
  try {
    const persistentData = {};
    for (const [key, item] of cache.entries()) {
      // 只保存需要持久化的类型
      const type = key.split(':')[0];
      if (CACHE_CONFIG.PERSISTENT_TYPES.includes(type) && !item.isExpired()) {
        persistentData[key] = item.toJSON();
      }
    }
    chrome.storage.local.set({ [CACHE_CONFIG.STORAGE_KEY]: persistentData });
  } catch (error) {
    console.error('Error saving cache to storage:', error);
  }
}

// 设置缓存
function setCache(key, value, maxAge, priority = CACHE_CONFIG.PRIORITY_LEVELS.MEDIUM) {
  // 检查缓存大小
  if (cache.size >= CACHE_CONFIG.MAX_SIZE) {
    // 清理过期缓存
    cleanupCache();
    // 如果仍然超过大小限制，按优先级删除
    if (cache.size >= CACHE_CONFIG.MAX_SIZE) {
      // 按优先级和时间戳排序，删除优先级最低、最旧的项
      const sortedKeys = [...cache.entries()]
        .sort((a, b) => {
          // 先按优先级排序
          if (a[1].priority !== b[1].priority) {
            return a[1].priority - b[1].priority;
          }
          // 优先级相同按时间戳排序
          return a[1].timestamp - b[1].timestamp;
        })
        .map(entry => entry[0]);
      
      // 删除最前面的项（优先级最低、最旧）
      const keysToDelete = sortedKeys.slice(0, cache.size - CACHE_CONFIG.MAX_SIZE + 1);
      keysToDelete.forEach(key => cache.delete(key));
    }
  }
  
  cache.set(key, new CacheItem(value, maxAge, priority));
  
  // 保存到localStorage
  saveToStorage();
}

// 获取缓存
function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  
  if (item.isExpired()) {
    cache.delete(key);
    saveToStorage(); // 更新存储
    return null;
  }
  
  return item.value;
}

// 删除缓存
function deleteCache(key) {
  cache.delete(key);
  saveToStorage(); // 更新存储
}

// 清空缓存
function clearCache() {
  cache.clear();
  try {
    chrome.storage.local.remove(CACHE_CONFIG.STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing cache from storage:', error);
  }
}

// 清理过期缓存
function cleanupCache() {
  const now = Date.now();
  let hasChanges = false;
  
  for (const [key, item] of cache.entries()) {
    if (item.isExpired()) {
      cache.delete(key);
      hasChanges = true;
    }
  }
  
  if (hasChanges) {
    saveToStorage(); // 更新存储
  }
}

// 获取缓存大小
function getCacheSize() {
  return cache.size;
}

// 启动定期清理
function startCleanupInterval() {
  setInterval(cleanupCache, CACHE_CONFIG.CLEANUP_INTERVAL);
}

// 初始化缓存
function initCache() {
  loadFromStorage();
  startCleanupInterval();
}

// 启动定期清理
initCache();

// 将函数挂载到全局作用域
if (typeof self !== 'undefined') {
  self.CACHE_CONFIG = CACHE_CONFIG;
  self.generateCacheKey = generateCacheKey;
  self.setCache = setCache;
  self.getCache = getCache;
  self.deleteCache = deleteCache;
  self.clearCache = clearCache;
  self.cleanupCache = cleanupCache;
  self.getCacheSize = getCacheSize;
}

// 如果支持ES6模块导出，也提供导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CACHE_CONFIG,
    generateCacheKey,
    setCache,
    getCache,
    deleteCache,
    clearCache,
    cleanupCache,
    getCacheSize
  };
}
