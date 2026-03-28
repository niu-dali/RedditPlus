/**
 * 浏览器自动化模块
 * 实现Reddit网站的自动操作和数据爬取
 */

// 全局变量
let crawlStatus = {
  isRunning: false,
  currentPost: 0,
  totalPosts: 0,
  totalComments: 0,
  progress: 0
};

// 连接状态管理
const connectionManager = {
  connections: new Map(), // 存储标签页连接状态
  heartbeats: new Map(), // 存储心跳定时器
  
  /**
   * 初始化标签页连接
   * @param {number} tabId - 标签页ID
   */
  initConnection(tabId) {
    this.connections.set(tabId, {
      isConnected: true,
      lastActivity: Date.now(),
      retryCount: 0
    });
    this.startHeartbeat(tabId);
  },
  
  /**
   * 开始心跳检测
   * @param {number} tabId - 标签页ID
   */
  startHeartbeat(tabId) {
    // 清除之前的心跳
    if (this.heartbeats.has(tabId)) {
      clearInterval(this.heartbeats.get(tabId));
    }
    
    // 每30秒发送一次心跳
    const heartbeatInterval = setInterval(async () => {
      try {
        await this.sendHeartbeat(tabId);
      } catch (error) {
        console.warn(`心跳检测失败: ${error.message}`);
        this.handleConnectionError(tabId);
      }
    }, 30000);
    
    this.heartbeats.set(tabId, heartbeatInterval);
  },
  
  /**
   * 发送心跳
   * @param {number} tabId - 标签页ID
   * @returns {Promise<boolean>} - 连接是否正常
   */
  async sendHeartbeat(tabId) {
    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabId },
          function: function() {
            return { status: 'ok', timestamp: Date.now() };
          }
        },
        (results) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            this.connections.get(tabId).lastActivity = Date.now();
            this.connections.get(tabId).isConnected = true;
            this.connections.get(tabId).retryCount = 0;
            resolve(true);
          }
        }
      );
    });
  },
  
  /**
   * 处理连接错误
   * @param {number} tabId - 标签页ID
   */
  handleConnectionError(tabId) {
    const connection = this.connections.get(tabId);
    if (connection) {
      connection.isConnected = false;
      connection.retryCount++;
      
      console.warn(`标签页 ${tabId} 连接断开，尝试重连... (${connection.retryCount}/3)`);
      
      if (connection.retryCount <= 3) {
        // 尝试重连
        setTimeout(async () => {
          try {
            await this.sendHeartbeat(tabId);
            console.log(`标签页 ${tabId} 重连成功`);
          } catch (error) {
            console.error(`标签页 ${tabId} 重连失败: ${error.message}`);
            if (connection.retryCount >= 3) {
              this.closeConnection(tabId);
            }
          }
        }, 5000);
      } else {
        this.closeConnection(tabId);
      }
    }
  },
  
  /**
   * 关闭连接
   * @param {number} tabId - 标签页ID
   */
  closeConnection(tabId) {
    if (this.heartbeats.has(tabId)) {
      clearInterval(this.heartbeats.get(tabId));
      this.heartbeats.delete(tabId);
    }
    this.connections.delete(tabId);
    console.log(`标签页 ${tabId} 连接已关闭`);
  },
  
  /**
   * 检查连接状态
   * @param {number} tabId - 标签页ID
   * @returns {boolean} - 连接是否正常
   */
  isConnected(tabId) {
    const connection = this.connections.get(tabId);
    return connection && connection.isConnected;
  },
  
  /**
   * 检查标签页是否存在
   * @param {number} tabId - 标签页ID
   * @returns {Promise<boolean>} - 标签页是否存在
   */
  async isTabExists(tabId) {
    return new Promise((resolve) => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }
};

/**
 * 安全执行脚本，包含连接检测
 * @param {number} tabId - 标签页ID
 * @param {Function} scriptFunction - 要执行的脚本函数
 * @param {Array} args - 脚本参数
 * @returns {Promise<any>} - 脚本执行结果
 */
async function safeExecuteScript(tabId, scriptFunction, args = []) {
  // 检查标签页是否存在
  const tabExists = await connectionManager.isTabExists(tabId);
  if (!tabExists) {
    throw new Error(`标签页 ${tabId} 不存在`);
  }
  
  // 检查连接状态
  if (!connectionManager.isConnected(tabId)) {
    throw new Error(`与标签页 ${tabId} 的连接已断开`);
  }
  
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabId },
        function: scriptFunction,
        args: args
      },
      (results) => {
        if (chrome.runtime.lastError) {
          connectionManager.handleConnectionError(tabId);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          connectionManager.connections.get(tabId).lastActivity = Date.now();
          resolve(results[0].result);
        }
      }
    );
  });
}

/**
 * 开始浏览器自动化爬取
 * @param {string} subreddit - 要爬取的板块名称
 * @param {Object} options - 爬取选项
 * @param {number} options.maxPosts - 最大帖子数
 * @param {number} options.maxComments - 最大评论数
 * @param {number} options.depth - 评论深度
 * @param {string} options.sortBy - 排序方式 (new, hot, top)
 * @returns {Promise<Object>} - 爬取结果
 */
async function startBrowserAutomation(subreddit, options) {
  crawlStatus = {
    isRunning: true,
    currentPost: 0,
    totalPosts: 0,
    totalComments: 0,
    progress: 0
  };

  let tabId = null;
  
  try {
    // 打开Reddit板块页面
    const sortBy = options.sortBy || 'hot';
    tabId = await openRedditTab(`https://www.reddit.com/r/${subreddit}/${sortBy}`);
    
    // 初始化连接管理
    connectionManager.initConnection(tabId);

    // 爬取帖子和评论
    const posts = await crawlPostsWithComments(tabId, options.maxPosts, options.maxComments, options.depth, subreddit);

    crawlStatus.isRunning = false;
    crawlStatus.progress = 100;

    return {
      success: true,
      posts: posts,
      subreddit: subreddit
    };
  } catch (error) {
    console.error(`开始浏览器自动化爬取失败: ${error.message}`, error);
    crawlStatus.isRunning = false;
    return {
      success: false,
      error: error.message
    };
  } finally {
    // 清理连接
    if (tabId) {
      connectionManager.closeConnection(tabId);
      
      // 关闭Reddit标签页
      try {
        await closeRedditTab(tabId);
        console.log(`已关闭Reddit标签页: ${tabId}`);
      } catch (closeError) {
        console.warn(`关闭Reddit标签页失败: ${closeError.message}`);
      }
    }
  }
}

/**
 * 打开Reddit标签页
 * @param {string} url - 要打开的URL
 * @returns {Promise<number>} - 标签页ID
 */
async function openRedditTab(url) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url: url, active: true }, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(tab.id);
      }
    });
  });
}

/**
 * 关闭Reddit标签页
 * @param {number} tabId - 要关闭的标签页ID
 * @returns {Promise<void>}
 */
async function closeRedditTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.remove(tabId, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * 爬取帖子和评论
 * @param {number} tabId - 标签页ID
 * @param {number} maxPosts - 最大帖子数
 * @param {number} maxComments - 最大评论数
 * @param {number} depth - 评论深度
 * @param {string} subreddit - 板块名称
 * @returns {Promise<Array>} - 帖子列表（包含评论）
 */
async function crawlPostsWithComments(tabId, maxPosts, maxComments, depth, subreddit) {
  // 处理maxPosts参数，-1表示无限
  if (maxPosts === -1) {
    maxPosts = 999999; // 使用一个非常大的数字来模拟无限
  } else if (maxPosts <= 0 || !isFinite(maxPosts)) {
    maxPosts = 100; // 其他无效值设置为默认值
  }
  
  // 处理maxComments参数，-1表示无限
  if (maxComments === -1) {
    maxComments = 999999; // 使用一个非常大的数字来模拟无限
  } else if (maxComments <= 0 || !isFinite(maxComments)) {
    maxComments = 100; // 其他无效值设置为默认值
  }
  
  // 处理depth参数，-1表示无限
  if (depth === -1) {
    depth = 99; // 使用一个较大的数字来模拟无限
  } else if (depth <= 0 || !isFinite(depth)) {
    depth = 10; // 其他无效值设置为默认值
  }
  
  const posts = [];
  const postUrls = new Set();
  let scrollAttempts = 0;
  const maxScrollAttempts = 10;
  
  // 滑动加载更多帖子
  while (posts.length < maxPosts && scrollAttempts < maxScrollAttempts) {
    const remainingPosts = maxPosts - posts.length;
    
    // 使用安全执行脚本函数获取当前页面的帖子（不使用async）
    const currentPosts = await safeExecuteScript(tabId, function(maxPosts, existingUrlsArray, subreddit) {
      var newPosts = [];
      var existingUrls = new Set(existingUrlsArray);
      var postElements = document.querySelectorAll('shreddit-post');
      
      for (var i = 0; i < postElements.length && newPosts.length < maxPosts; i++) {
        var postElement = postElements[i];

        var titleElement = postElement.querySelector('a[slot="title"], h3[slot="title"], .title');
        var title = titleElement ? titleElement.textContent.trim() : '';
        var authorElement = postElement.querySelector('span[slot="author"], .author, .flex.items-center.gap-2xs span.whitespace-nowrap');
        var author = authorElement ? authorElement.textContent.trim() : '';
        var scoreElement = postElement.querySelector('div[slot="score"], .score');
        var score = scoreElement ? scoreElement.textContent.trim() : '';
        var numCommentsElement = postElement.querySelector('faceplate-number, .num-comments, .flex.items-center span:last-child, [slot="comment-count"], .flex.items-center faceplate-number');
        var numComments = numCommentsElement ? numCommentsElement.textContent.trim() : '';
        var permalinkElement = postElement.querySelector('a[slot="full-post-link"], a[href*="/comments/"]');
        var permalink = permalinkElement ? permalinkElement.href : '';
        var selftextElement = postElement.querySelector('div[slot="text-body"], .selftext, .text-body, shreddit-post-text-body [slot="text-body"]');
        var selftext = selftextElement ? selftextElement.textContent.trim() : '';

        if (title && permalink && !existingUrls.has(permalink)) {
          var post = {
            id: postElement.id,
            title: title,
            author: author || 'Unknown',
            score: score || '0',
            num_comments: numComments || '0',
            permalink: permalink,
            selftext: selftext || '',
            analyzed: false,
            comments: [],
            subreddit: subreddit
          };

          newPosts.push(post);
        }
      }

      return newPosts;
    }, [remainingPosts, Array.from(postUrls), subreddit]);

    // 添加新帖子到结果中
    for (const post of currentPosts) {
      if (!postUrls.has(post.permalink)) {
        postUrls.add(post.permalink);
        posts.push(post);
      }
    }

    // 如果已经收集到足够的帖子，停止滚动
    if (posts.length >= maxPosts) {
      break;
    }

    // 滑动页面加载更多帖子
    await safeExecuteScript(tabId, function() {
      window.scrollTo(0, document.body.scrollHeight);
    }, []);
    scrollAttempts++;

    // 等待页面加载
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // 限制同时处理的帖子数量，避免连接中断
  const batchSize = 3;
  const detailedPosts = [];

  for (let i = 0; i < posts.length; i += batchSize) {
    const batchPosts = posts.slice(i, i + batchSize);

    for (const post of batchPosts) {
      // 导航到帖子详情页
      await safeExecuteScript(tabId, function(permalink) {
        window.location.href = permalink;
      }, [post.permalink]);

      // 等待页面加载
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 爬取详细内容
      const detailedData = await safeExecuteScript(tabId, function(maxComments, depth) {
        // 检查页面是否成功加载
        if (document.readyState !== 'complete') {
          console.warn('页面未完全加载，等待额外时间');
        }

        // 爬取详细内容 - 尝试多种选择器
        var selftextElement = document.querySelector('div[slot="text-body"], .selftext, .text-body, .post-body, .usertext-body, shreddit-post-text-body [slot="text-body"]');
        var detailedSelftext = selftextElement ? selftextElement.textContent.trim() : '';

        // 爬取详细评论 - 使用非递归方法
        var detailedComments = [];
        var commentCount = 0;
        
        // 队列用于广度优先搜索
        var commentQueue = [];
        
        // 获取顶层评论
        var topLevelComments = document.querySelectorAll('shreddit-comment, .comment, .comment-tree');
        
        // 初始化队列，每个元素包含评论元素和当前深度
        for (var j = 0; j < topLevelComments.length; j++) {
          var element = topLevelComments[j];
          commentQueue.push({ element: element, currentDepth: 1, parent: null });
        }
        
        // 处理队列
        while (commentQueue.length > 0 && commentCount < maxComments) {
          var queueItem = commentQueue.shift();
          var element = queueItem.element;
          var currentDepth = queueItem.currentDepth;
          var parent = queueItem.parent;
          
          if (currentDepth > depth) {
            continue;
          }
          
          var commentAuthor = element.getAttribute('author');
          if (!commentAuthor) {
            var authorElement = element.querySelector('span[slot="author"], .comment-author, .author, .flex.items-center.gap-2xs span.whitespace-nowrap');
            commentAuthor = authorElement ? authorElement.textContent.trim() : '';
          }
          var commentScore = element.getAttribute('score');
          if (!commentScore) {
            var scoreElement = element.querySelector('div[slot="score"], .comment-score, .score, .flex.items-center span:first-child');
            commentScore = scoreElement ? scoreElement.textContent.trim() : '';
          }
          var bodyElement = element.querySelector('div[slot="text-body"], div[slot="comment"], .comment-body, .body, .text-body, .usertext-body');
          var commentBody = bodyElement ? bodyElement.textContent.trim() : '';

          if (commentAuthor && commentBody) {
            var comment = {
              id: element.id,
              author: commentAuthor,
              score: commentScore || '0',
              body: commentBody,
              replies: []
            };

            detailedComments.push(comment);
            commentCount++;

            // 获取回复并添加到队列
            var replyElements = element.querySelectorAll('shreddit-comment, .comment, .comment-tree');
            if (replyElements.length > 0 && currentDepth < depth) {
              for (var k = 0; k < replyElements.length; k++) {
                var replyElement = replyElements[k];
                commentQueue.push({ element: replyElement, currentDepth: currentDepth + 1, parent: comment });
              }
            }
          }
        }

        return {
          selftext: detailedSelftext,
          comments: detailedComments
        };
      }, [maxComments, depth]);

      if (detailedData.selftext) {
        post.selftext = detailedData.selftext;
      }
      post.comments = detailedData.comments;
      detailedPosts.push(post);
    }

    // 批次之间添加短暂休息，避免过度请求
    if (i + batchSize < posts.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return detailedPosts;
}

/**
 * 爬取帖子
 * @param {number} tabId - 标签页ID
 * @param {number} maxPosts - 最大帖子数
 * @param {string} subreddit - 板块名称
 * @returns {Promise<Array>} - 帖子列表
 */
async function crawlPosts(tabId, maxPosts, subreddit) {
  try {
    return await safeExecuteScript(tabId, function(maxPosts, subreddit) {
      var posts = [];
      var postElements = document.querySelectorAll('shreddit-post');

      for (var i = 0; i < postElements.length && posts.length < maxPosts; i++) {
        var postElement = postElements[i];

        // 尝试多种选择器获取数据
        var titleElement = postElement.querySelector('a[slot="title"], h3[slot="title"], .title');
        var title = titleElement ? titleElement.textContent.trim() : '';
        var authorElement = postElement.querySelector('span[slot="author"], .author, .flex.items-center.gap-2xs span.whitespace-nowrap');
        var author = authorElement ? authorElement.textContent.trim() : '';
        var scoreElement = postElement.querySelector('div[slot="score"], .score');
        var score = scoreElement ? scoreElement.textContent.trim() : '';
        var numCommentsElement = postElement.querySelector('faceplate-number, .num-comments, .flex.items-center span:last-child, [slot="comment-count"], .flex.items-center faceplate-number');
        var numComments = numCommentsElement ? numCommentsElement.textContent.trim() : '';
        var permalinkElement = postElement.querySelector('a[slot="full-post-link"], a[href*="/comments/"]');
        var permalink = permalinkElement ? permalinkElement.href : '';
        var selftextElement = postElement.querySelector('div[slot="text-body"], .selftext, .text-body, shreddit-post-text-body [slot="text-body"]');
        var selftext = selftextElement ? selftextElement.textContent.trim() : '';

        if (title && permalink) {
          posts.push({
            id: postElement.id,
            title: title,
            author: author || 'Unknown',
            score: score || '0',
            num_comments: numComments || '0',
            permalink: permalink,
            selftext: selftext || '',
            analyzed: false,
            subreddit: subreddit
          });
        }
      }

      return posts;
    }, [maxPosts, subreddit]);
  } catch (error) {
    console.error(`爬取帖子失败: ${error.message}`, error);
    throw error;
  }
}

/**
 * 爬取评论
 * @param {number} tabId - 标签页ID
 * @param {string} permalink - 帖子链接
 * @param {number} maxComments - 最大评论数
 * @param {number} depth - 评论深度
 * @returns {Promise<Array>} - 评论列表
 */
async function crawlComments(tabId, permalink, maxComments, depth) {
  try {
    // 导航到帖子页面
    await safeExecuteScript(tabId, (permalink) => {
      window.location.href = permalink;
    }, [permalink]);

    // 等待页面加载完成
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 爬取评论
    return await safeExecuteScript(tabId, function(maxComments, depth) {
      try {
        // 检查页面是否成功加载
        if (document.readyState !== 'complete') {
          console.warn('页面未完全加载，可能会影响爬取结果');
        }

        var comments = [];
        var commentCount = 0;

        // 队列用于广度优先搜索
        var commentQueue = [];
        
        // 获取顶层评论
        var topLevelComments = document.querySelectorAll('shreddit-comment, .comment, .comment-tree');
        
        // 初始化队列
        for (var i = 0; i < topLevelComments.length; i++) {
          var element = topLevelComments[i];
          commentQueue.push({ element: element, currentDepth: 1 });
        }
        
        // 处理队列
        while (commentQueue.length > 0 && commentCount < maxComments) {
          var queueItem = commentQueue.shift();
          var element = queueItem.element;
          var currentDepth = queueItem.currentDepth;
          
          if (currentDepth > depth) {
            continue;
          }
          
          // 尝试多种选择器获取评论数据
          var author = element.getAttribute('author');
          if (!author) {
            var authorElement = element.querySelector('span[slot="author"], .comment-author, .author, .flex.items-center.gap-2xs span.whitespace-nowrap');
            author = authorElement ? authorElement.textContent.trim() : '';
          }
          var score = element.getAttribute('score');
          if (!score) {
            var scoreElement = element.querySelector('div[slot="score"], .comment-score, .score, .flex.items-center span:first-child');
            score = scoreElement ? scoreElement.textContent.trim() : '';
          }
          var bodyElement = element.querySelector('div[slot="text-body"], div[slot="comment"], .comment-body, .body, .text-body, .usertext-body');
          var body = bodyElement ? bodyElement.textContent.trim() : '';

          if (author && body) {
            var comment = {
              id: element.id,
              author: author,
              score: score || '0',
              body: body,
              replies: []
            };

            comments.push(comment);
            commentCount++;

            // 爬取回复
            var replyElements = element.querySelectorAll('shreddit-comment, .comment, .comment-tree');
            if (replyElements.length > 0 && currentDepth < depth) {
              for (var j = 0; j < replyElements.length; j++) {
                var replyElement = replyElements[j];
                commentQueue.push({ element: replyElement, currentDepth: currentDepth + 1 });
              }
            }
          }
        }

        return comments;
      } catch (error) {
        console.error('爬取评论失败: ' + error.message, error);
        return [];
      }
    }, [maxComments, depth]);
  } catch (error) {
    console.error(`爬取评论失败: ${error.message}`, error);
    throw error;
  }
}

/**
 * 获取爬取状态
 * @returns {Object} - 爬取状态
 */
function getCrawlStatus() {
  return crawlStatus;
}

// 导出模块
globalThis.browserAutomation = {
  startBrowserAutomation,
  getCrawlStatus
};
