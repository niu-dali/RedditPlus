// Reddit爬虫模块

// 爬取Reddit板块内容
async function crawlSubreddit(subreddit, options = {}) {
  // 获取配置
  const crawlConfig = getConfigSection('CRAWL');
  const cacheConfig = getConfigSection('CACHE');
  
  // 合并默认选项和用户选项
  const { 
    maxPosts = crawlConfig.MAX_POSTS, 
    includeComments = true, 
    commentLimit = crawlConfig.MAX_COMMENTS,
    commentDepth = crawlConfig.COMMENT_DEPTH,
    sortBy = crawlConfig.SORT_BY,
    timeFilter = crawlConfig.TIME_FILTER
  } = options;
  
  try {
    // 生成缓存键
    const cacheKey = generateCacheKey('subreddit', subreddit, maxPosts, includeComments, commentLimit, commentDepth, sortBy, timeFilter);
    
    // 检查缓存
    if (cacheConfig.ENABLED) {
      try {
        const cachedResult = getCache(cacheKey);
        if (cachedResult) {
          return cachedResult;
        }
      } catch (cacheError) {
        handleCacheError(cacheError, { cacheKey, operation: 'get' });
        // 缓存错误不影响主流程
      }
    }
    
    // 使用API模块发送请求
    const response = await getSubreddit(subreddit, {
      limit: maxPosts,
      sort: sortBy,
      t: timeFilter
    });
    
    if (response.status === 403) {
      // 可能是未登录或被限制
      const authError = handleAuthError(response, { subreddit, maxPosts });
      const result = { success: false, error: authError.message, errorType: authError.type, needsLogin: true };
      // 不缓存错误结果
      return result;
    }
    
    if (response.status === 429) {
      // API速率限制
      const rateLimitError = handleRateLimitError(response, { subreddit, maxPosts });
      const result = { success: false, error: rateLimitError.message, errorType: rateLimitError.type };
      // 不缓存错误结果
      return result;
    }
    
    if (!response.ok) {
      const networkError = handleNetworkError(new Error(`HTTP error! status: ${response.status}`), { subreddit, maxPosts, status: response.status });
      return { success: false, error: networkError.message, errorType: networkError.type, subreddit };
    }
    
    const data = await response.json();
    
    // 检查响应数据结构
    if (!data.data || !Array.isArray(data.data.children)) {
      const invalidResponseError = handleInvalidResponseError('Invalid response structure from Reddit API', { subreddit, maxPosts });
      return { success: false, error: invalidResponseError.message, errorType: invalidResponseError.type, subreddit };
    }
    
    const posts = data.data.children.map(child => {
      const post = child.data;
      return {
        id: post.id,
        title: post.title,
        url: post.url,
        score: post.score,
        author: post.author,
        created: post.created_utc,
        num_comments: post.num_comments,
        selftext: post.selftext,
        permalink: post.permalink, // 使用API返回的相对路径
        subreddit: subreddit,
        analyzed: false
      };
    });
    
    // 爬取评论
    if (includeComments) {
      const commentPromises = posts.map(post => crawlComments(post.permalink, commentLimit, commentDepth));
      const commentsResults = await Promise.all(commentPromises);
      
      posts.forEach((post, index) => {
        post.comments = commentsResults[index];
      });
    }
    
    const result = {
      success: true,
      posts: posts.sort((a, b) => b.score - a.score) // 根据分数从高到低排序
    };
    
    // 缓存结果
    if (cacheConfig.ENABLED) {
      try {
        setCache(cacheKey, result, cacheConfig.DURATION.SUBREDDIT, cacheConfig.PRIORITY.SUBREDDIT);
      } catch (cacheError) {
        handleCacheError(cacheError, { cacheKey, operation: 'set' });
        // 缓存错误不影响主流程
      }
    }
    
    return result;
  } catch (error) {
    const handledError = handleNetworkError(error, { subreddit, maxPosts: options.maxPosts });
    return { success: false, error: handledError.message, errorType: handledError.type, subreddit };
  }
}

// 爬取评论
async function crawlComments(permalink, limit = null, depth = null) {
  // 获取配置
  const crawlConfig = getConfigSection('CRAWL');
  const cacheConfig = getConfigSection('CACHE');
  
  // 使用配置或默认值
  const finalLimit = limit || crawlConfig.MAX_COMMENTS;
  const finalDepth = depth || crawlConfig.COMMENT_DEPTH;
  
  try {
    // 生成缓存键
    const cacheKey = generateCacheKey('comments', permalink, finalLimit, finalDepth);
    
    // 检查缓存
    if (cacheConfig.ENABLED) {
      try {
        const cachedComments = getCache(cacheKey);
        if (cachedComments) {
          return cachedComments;
        }
      } catch (cacheError) {
        handleCacheError(cacheError, { cacheKey, operation: 'get' });
        // 缓存错误不影响主流程
      }
    }
    
    // 使用API模块发送请求
    const response = await getComments(permalink, {
      limit: finalLimit
    });
    
    if (response.status === 429) {
      // API速率限制
      handleRateLimitError(response, { permalink, limit: finalLimit, depth: finalDepth });
      return [];
    }
    
    if (!response.ok) {
      handleNetworkError(new Error(`HTTP error! status: ${response.status}`), { permalink, limit: finalLimit, depth: finalDepth, status: response.status });
      // 网络请求失败，返回空数组
      return [];
    }
    
    const data = await response.json();
    const comments = [];
    
    // 递归获取评论，支持深度控制
    function extractComments(commentData, currentDepth = 0) {
      if (!commentData || !Array.isArray(commentData)) return [];
      
      const result = [];
      
      for (const item of commentData) {
        if (item.kind === 't1') {
          const comment = item.data;
          const commentObj = {
            id: comment.id,
            author: comment.author,
            body: comment.body,
            score: comment.score,
            created: comment.created_utc,
            replies: [],
            hasMoreReplies: false,
            parentId: comment.parent_id
          };
          
          // 检查是否有更多回复
          if (comment.replies && comment.replies.data && comment.replies.data.children) {
            const replyChildren = comment.replies.data.children;
            if (currentDepth < finalDepth - 1) {
              // 继续递归获取回复
              commentObj.replies = extractComments(replyChildren, currentDepth + 1);
            } else {
              // 达到深度限制，标记有更多回复
              commentObj.hasMoreReplies = replyChildren.some(child => child.kind === 't1');
            }
          }
          
          result.push(commentObj);
        }
      }
      
      return result;
    }
    
    if (data[1] && data[1].data && data[1].data.children) {
      const extractedComments = extractComments(data[1].data.children);
      // 按分数排序评论
      comments.push(...extractedComments.sort((a, b) => b.score - a.score));
    } else {
      handleInvalidResponseError('Invalid comment structure from Reddit API', { permalink, limit: finalLimit, depth: finalDepth });
    }
    
    // 缓存结果
    if (cacheConfig.ENABLED) {
      try {
        setCache(cacheKey, comments, cacheConfig.DURATION.COMMENTS, cacheConfig.PRIORITY.COMMENTS);
      } catch (cacheError) {
        handleCacheError(cacheError, { cacheKey, operation: 'set' });
        // 缓存错误不影响主流程
      }
    }
    
    return comments;
  } catch (error) {
    handleNetworkError(error, { permalink, limit: finalLimit });
    // 捕获所有错误，返回空数组
    return [];
  }
}

// 加载更多评论回复
async function loadMoreReplies(permalink, commentId, limit = 5) {
  try {
    // 使用API模块发送请求
    const response = await getComments(permalink, {
      comment: commentId,
      limit: limit
    });
    
    if (!response.ok) {
      handleNetworkError(new Error(`HTTP error! status: ${response.status}`), { permalink, commentId, limit, status: response.status });
      return [];
    }
    
    const data = await response.json();
    const replies = [];
    
    // 提取回复
    function extractReplies(commentData) {
      if (!commentData || !Array.isArray(commentData)) return;
      
      for (const item of commentData) {
        if (item.kind === 't1') {
          const comment = item.data;
          replies.push({
            id: comment.id,
            author: comment.author,
            body: comment.body,
            score: comment.score,
            created: comment.created_utc,
            replies: [],
            hasMoreReplies: false,
            parentId: comment.parent_id
          });
          
          if (comment.replies && comment.replies.data && comment.replies.data.children) {
            extractReplies(comment.replies.data.children);
          }
        }
      }
    }
    
    if (data[1] && data[1].data && data[1].data.children) {
      extractReplies(data[1].data.children);
    }
    
    return replies;
  } catch (error) {
    handleNetworkError(error, { permalink, commentId, limit });
    return [];
  }
}

// 分析单个帖子
async function analyzePost(postId, options = {}) {
  // 获取配置
  const cacheConfig = getConfigSection('CACHE');
  
  try {
    // 生成缓存键
    const cacheKey = generateCacheKey('post', postId);
    
    // 检查缓存
    if (cacheConfig.ENABLED) {
      try {
        const cachedResult = getCache(cacheKey);
        if (cachedResult) {
          return cachedResult;
        }
      } catch (cacheError) {
        handleCacheError(cacheError, { cacheKey, operation: 'get' });
        // 缓存错误不影响主流程
      }
    }
    
    // 使用API模块发送请求
    const response = await getPost(postId, options);
    
    if (response.status === 403) {
      // 可能是未登录或被限制
      const authError = handleAuthError(response, { postId });
      const result = { success: false, error: authError.message, errorType: authError.type, needsLogin: true, postId };
      // 不缓存错误结果
      return result;
    }
    
    if (response.status === 429) {
      // API速率限制
      const rateLimitError = handleRateLimitError(response, { postId });
      const result = { success: false, error: rateLimitError.message, errorType: rateLimitError.type, postId };
      // 不缓存错误结果
      return result;
    }
    
    if (!response.ok) {
      const networkError = handleNetworkError(new Error(`HTTP error! status: ${response.status}`), { postId, status: response.status });
      return { success: false, error: networkError.message, errorType: networkError.type, postId };
    }
    
    const data = await response.json();
    
    // 检查响应数据结构
    if (!data[0] || !data[0].data || !data[0].data.children || !data[0].data.children[0]) {
      const invalidResponseError = handleInvalidResponseError('Invalid response structure from Reddit API', { postId });
      return { success: false, error: invalidResponseError.message, errorType: invalidResponseError.type, postId };
    }
    
    const post = data[0].data.children[0].data;
    
    const result = {
      success: true,
      post: {
        id: post.id,
        title: post.title,
        selftext: post.selftext,
        permalink: post.permalink // 使用API返回的相对路径
      }
    };
    
    // 缓存结果
    if (cacheConfig.ENABLED) {
      try {
        setCache(cacheKey, result, cacheConfig.DURATION.POST, cacheConfig.PRIORITY.POST);
      } catch (cacheError) {
        handleCacheError(cacheError, { cacheKey, operation: 'set' });
        // 缓存错误不影响主流程
      }
    }
    
    return result;
  } catch (error) {
    const handledError = handleNetworkError(error, { postId });
    return { success: false, error: handledError.message, errorType: handledError.type, postId };
  }
}

// 将函数挂载到全局作用域
if (typeof self !== 'undefined') {
  self.crawlSubreddit = crawlSubreddit;
  self.crawlComments = crawlComments;
  self.analyzePost = analyzePost;
  self.loadMoreReplies = loadMoreReplies;
}

// 如果支持ES6模块导出，也提供导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    crawlSubreddit,
    crawlComments,
    analyzePost,
    loadMoreReplies
  };
}
