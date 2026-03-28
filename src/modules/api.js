// API模块 - 抽象API请求逻辑

// API配置
const API_CONFIG = {
  BASE_URL: 'https://www.reddit.com',
  HEADERS: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  },
  ENDPOINTS: {
    SUBREDDIT: '/r/{subreddit}.json',
    COMMENTS: '{permalink}.json',
    POST: '/comments/{postId}.json'
  }
};

// 构建API URL
function buildUrl(endpoint, params = {}) {
  let url = API_CONFIG.BASE_URL + endpoint;
  
  // 替换路径参数
  for (const [key, value] of Object.entries(params)) {
    if (url.includes(`{${key}}`)) {
      url = url.replace(`{${key}}`, value);
    }
  }
  
  // 添加查询参数
  const queryParams = Object.entries(params)
    .filter(([key]) => !endpoint.includes(`{${key}}`))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  
  if (queryParams) {
    url += (url.includes('?') ? '&' : '?') + queryParams;
  }
  
  return url;
}

// 发送API请求
async function apiRequest(endpoint, params = {}, options = {}) {
  try {
    const url = buildUrl(endpoint, params);
    const response = await fetchWithRetry(url, {
      headers: {
        ...API_CONFIG.HEADERS,
        ...options.headers
      },
      ...options
    });
    
    return response;
  } catch (error) {
    throw handleNetworkError(error, { endpoint, params });
  }
}

// 获取板块内容
async function getSubreddit(subreddit, params = {}) {
  return apiRequest(API_CONFIG.ENDPOINTS.SUBREDDIT, {
    subreddit,
    limit: params.limit || 10,
    ...params
  });
}

// 获取评论
async function getComments(permalink, params = {}) {
  return apiRequest(API_CONFIG.ENDPOINTS.COMMENTS, {
    permalink,
    limit: params.limit || 10,
    comment: params.comment,
    ...params
  });
}

// 获取帖子详情
async function getPost(postId, params = {}) {
  return apiRequest(API_CONFIG.ENDPOINTS.POST, {
    postId,
    ...params
  });
}

// 将函数挂载到全局作用域
if (typeof self !== 'undefined') {
  self.API_CONFIG = API_CONFIG;
  self.buildUrl = buildUrl;
  self.apiRequest = apiRequest;
  self.getSubreddit = getSubreddit;
  self.getComments = getComments;
  self.getPost = getPost;
}

// 如果支持ES6模块导出，也提供导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    API_CONFIG,
    buildUrl,
    apiRequest,
    getSubreddit,
    getComments,
    getPost
  };
}
