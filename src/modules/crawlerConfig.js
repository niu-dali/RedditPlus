// 爬虫配置模块

// 默认爬虫配置
const DEFAULT_CRAWLER_CONFIG = {
  // 爬取配置
  CRAWL: {
    MAX_POSTS: 10,          // 最大帖子数
    MAX_COMMENTS: 5,        // 最大评论数
    COMMENT_DEPTH: 2,       // 评论深度
    SORT_BY: 'score',       // 排序方式: score, new, hot
    TIME_FILTER: 'day'      // 时间过滤: hour, day, week, month, year, all
  },
  
  // 缓存配置
  CACHE: {
    ENABLED: true,          // 是否启用缓存
    DURATION: {
      SUBREDDIT: 300000,    // 板块缓存时间（5分钟）
      COMMENTS: 600000,     // 评论缓存时间（10分钟）
      POST: 900000          // 帖子缓存时间（15分钟）
    },
    PRIORITY: {
      SUBREDDIT: 2,         // 板块缓存优先级
      COMMENTS: 1,          // 评论缓存优先级
      POST: 3               // 帖子缓存优先级
    }
  },
  
  // 请求配置
  REQUEST: {
    TIMEOUT: 10000,         // 请求超时时间（10秒）
    RETRIES: 3,             // 重试次数
    DELAY: 1000,            // 重试延迟（1秒）
    RATE_LIMIT: {
      MAX_REQUESTS_PER_MINUTE: 60,  // 每分钟最大请求数
      MIN_INTERVAL: 1000             // 最小请求间隔（1秒）
    }
  },
  
  // 错误处理配置
  ERROR: {
    LOG_ENABLED: true,      // 是否启用错误日志
    MAX_LOGS: 100           // 最大日志数量
  }
};

// 当前配置
let currentConfig = { ...DEFAULT_CRAWLER_CONFIG };

// 获取配置
function getConfig() {
  return { ...currentConfig };
}

// 获取特定部分的配置
function getConfigSection(section) {
  return { ...currentConfig[section] };
}

// 更新配置
function updateConfig(newConfig) {
  currentConfig = {
    ...currentConfig,
    ...newConfig
  };
  
  // 保存配置到localStorage
  try {
    localStorage.setItem('reddit_plus_crawler_config', JSON.stringify(currentConfig));
  } catch (error) {
    console.error('Error saving crawler config:', error);
  }
}

// 重置配置为默认值
function resetConfig() {
  currentConfig = { ...DEFAULT_CRAWLER_CONFIG };
  try {
    localStorage.removeItem('reddit_plus_crawler_config');
  } catch (error) {
    console.error('Error resetting crawler config:', error);
  }
}

// 从localStorage加载配置
function loadConfig() {
  try {
    const storedConfig = localStorage.getItem('reddit_plus_crawler_config');
    if (storedConfig) {
      currentConfig = JSON.parse(storedConfig);
    }
  } catch (error) {
    console.error('Error loading crawler config:', error);
    // 加载失败时使用默认配置
    currentConfig = { ...DEFAULT_CRAWLER_CONFIG };
  }
}

// 初始化配置
function initConfig() {
  loadConfig();
}

// 初始化配置
initConfig();

// 将函数挂载到全局作用域
if (typeof self !== 'undefined') {
  self.DEFAULT_CRAWLER_CONFIG = DEFAULT_CRAWLER_CONFIG;
  self.getConfig = getConfig;
  self.getConfigSection = getConfigSection;
  self.updateConfig = updateConfig;
  self.resetConfig = resetConfig;
  self.loadConfig = loadConfig;
}

// 如果支持ES6模块导出，也提供导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_CRAWLER_CONFIG,
    getConfig,
    getConfigSection,
    updateConfig,
    resetConfig,
    loadConfig
  };
}
