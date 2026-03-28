/**
 * 存储模块
 * 负责管理扩展的数据存储
 */

// 数据过期时间（毫秒）
const EXPIRATION_TIME = {
  CRAWL_RESULTS: 7 * 24 * 60 * 60 * 1000, // 7天
  USER_CONFIG: 30 * 24 * 60 * 60 * 1000, // 30天
  USER_SETTINGS: 30 * 24 * 60 * 60 * 1000 // 30天
};

// 存储键前缀
const STORAGE_KEYS = {
  USER_CONFIG: 'userConfig',
  USER_SETTINGS: 'userSettings',
  CRAWL_RESULTS_PREFIX: 'crawlResults_',
  CRAWL_RESULTS_SUBREDDITS: 'crawlResults_subreddits',
  DELETED_POSTS: 'deletedPosts'
};

// 存储用户配置
async function saveUserConfig(config) {
  try {
    const dataWithTimestamp = {
      data: config,
      timestamp: Date.now()
    };
    await chrome.storage.local.set({ [STORAGE_KEYS.USER_CONFIG]: dataWithTimestamp });
    return { success: true };
  } catch (error) {
    console.error('保存用户配置失败:', error);
    return { success: false, error: error.message, code: error.code };
  }
}

// 获取用户配置
async function getUserConfig() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.USER_CONFIG);
    const storedConfig = result[STORAGE_KEYS.USER_CONFIG];
    
    if (storedConfig && storedConfig.data) {
      // 检查数据是否过期
      if (Date.now() - storedConfig.timestamp < EXPIRATION_TIME.USER_CONFIG) {
        return storedConfig.data;
      } else {
        // 数据过期，删除并返回默认配置
        await chrome.storage.local.remove(STORAGE_KEYS.USER_CONFIG);
        return defaultUserConfig;
      }
    }
    return defaultUserConfig;
  } catch (error) {
    console.error('获取用户配置失败:', error);
    return defaultUserConfig;
  }
}

// 存储用户设置
async function saveUserSettings(settings) {
  try {
    const dataWithTimestamp = {
      data: settings,
      timestamp: Date.now()
    };
    await chrome.storage.local.set({ [STORAGE_KEYS.USER_SETTINGS]: dataWithTimestamp });
    return { success: true };
  } catch (error) {
    console.error('保存用户设置失败:', error);
    return { success: false, error: error.message, code: error.code };
  }
}

// 获取用户设置
async function getUserSettings() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.USER_SETTINGS);
    const storedSettings = result[STORAGE_KEYS.USER_SETTINGS];
    
    if (storedSettings && storedSettings.data) {
      // 检查数据是否过期
      if (Date.now() - storedSettings.timestamp < EXPIRATION_TIME.USER_SETTINGS) {
        return storedSettings.data;
      } else {
        // 数据过期，删除并返回基于浏览器语言的默认设置
        await chrome.storage.local.remove(STORAGE_KEYS.USER_SETTINGS);
        return getDefaultUserSettings();
      }
    }
    // 首次初始化时，根据浏览器语言自动设置
    return getDefaultUserSettings();
  } catch (error) {
    console.error('获取用户设置失败:', error);
    return getDefaultUserSettings();
  }
}

// 保存爬取结果
async function saveCrawlResults(results) {
  try {
    // 按板块单独存储数据
    const savePromises = Object.entries(results).map(([subreddit, posts]) => {
      const dataWithTimestamp = {
        data: posts,
        timestamp: Date.now()
      };
      return chrome.storage.local.set({ [`${STORAGE_KEYS.CRAWL_RESULTS_PREFIX}${subreddit}`]: dataWithTimestamp });
    });
    
    await Promise.all(savePromises);
    
    // 保存板块列表
    await chrome.storage.local.set({ [STORAGE_KEYS.CRAWL_RESULTS_SUBREDDITS]: Object.keys(results) });
    
    return { success: true };
  } catch (error) {
    console.error('保存爬取结果失败:', error);
    return { success: false, error: error.message, code: error.code };
  }
}

// 获取爬取结果
async function getCrawlResults() {
  try {
    const results = {};
    
    // 从所有存储键中发现crawlResults_*键
    const allStorage = await chrome.storage.local.get(null);
    const crawlResultKeys = Object.keys(allStorage).filter(key => key.startsWith(STORAGE_KEYS.CRAWL_RESULTS_PREFIX) && key !== STORAGE_KEYS.CRAWL_RESULTS_SUBREDDITS);
    const subreddits = crawlResultKeys.map(key => key.replace(STORAGE_KEYS.CRAWL_RESULTS_PREFIX, ''));
    
    if (subreddits.length > 0) {
      const getPromises = subreddits.map(async (subreddit) => {
        try {
          const subredditData = await chrome.storage.local.get(`${STORAGE_KEYS.CRAWL_RESULTS_PREFIX}${subreddit}`);
          const storedData = subredditData[`${STORAGE_KEYS.CRAWL_RESULTS_PREFIX}${subreddit}`];
          
          if (storedData && storedData.data && storedData.data.length > 0) {
            // 直接获取数据，不检查是否过期
            results[subreddit] = storedData.data;
          } else if (storedData) {
            // 如果板块存在但没有帖子，从存储中删除
            await chrome.storage.local.remove(`${STORAGE_KEYS.CRAWL_RESULTS_PREFIX}${subreddit}`);
            
            // 更新板块列表
            const subredditsResult = await chrome.storage.local.get(STORAGE_KEYS.CRAWL_RESULTS_SUBREDDITS);
            let subreddits = subredditsResult[STORAGE_KEYS.CRAWL_RESULTS_SUBREDDITS] || [];
            const updatedSubreddits = subreddits.filter(s => s !== subreddit);
            await chrome.storage.local.set({ [STORAGE_KEYS.CRAWL_RESULTS_SUBREDDITS]: updatedSubreddits });
          }
        } catch (error) {
          console.error(`获取板块 ${subreddit} 的爬取结果失败:`, error);
        }
      });
      
      await Promise.all(getPromises);
    }
    
    return results;
  } catch (error) {
    console.error('获取爬取结果失败:', error);
    return {};
  }
}

// 保存单个帖子的翻译结果
async function savePostTranslation(subreddit, post) {
  try {
    // 获取当前板块的数据
    const subredditData = await chrome.storage.local.get(`${STORAGE_KEYS.CRAWL_RESULTS_PREFIX}${subreddit}`);
    let posts = [];
    
    if (subredditData[`${STORAGE_KEYS.CRAWL_RESULTS_PREFIX}${subreddit}`] && subredditData[`${STORAGE_KEYS.CRAWL_RESULTS_PREFIX}${subreddit}`].data) {
      posts = subredditData[`${STORAGE_KEYS.CRAWL_RESULTS_PREFIX}${subreddit}`].data;
    }
    
    // 找到并更新帖子
    const postIndex = posts.findIndex(p => p.id === post.id);
    if (postIndex !== -1) {
      posts[postIndex] = post;
    } else {
      posts.push(post);
    }
    
    // 保存更新后的数据
    const dataWithTimestamp = {
      data: posts,
      timestamp: Date.now()
    };
    await chrome.storage.local.set({ [`${STORAGE_KEYS.CRAWL_RESULTS_PREFIX}${subreddit}`]: dataWithTimestamp });
    
    // 确保板块列表存在
    const subredditsResult = await chrome.storage.local.get(STORAGE_KEYS.CRAWL_RESULTS_SUBREDDITS);
    let subreddits = subredditsResult[STORAGE_KEYS.CRAWL_RESULTS_SUBREDDITS] || [];
    if (!subreddits.includes(subreddit)) {
      subreddits.push(subreddit);
      await chrome.storage.local.set({ [STORAGE_KEYS.CRAWL_RESULTS_SUBREDDITS]: subreddits });
    }
    
    return { success: true };
  } catch (error) {
    console.error('保存帖子翻译结果失败:', error);
    return { success: false, error: error.message, code: error.code };
  }
}

// 删除帖子并记录
async function deletePost(postId, permalink, subreddit) {
  try {
    // 从爬取结果中删除帖子
    const subredditData = await chrome.storage.local.get(`${STORAGE_KEYS.CRAWL_RESULTS_PREFIX}${subreddit}`);
    let posts = [];
    
    if (subredditData[`${STORAGE_KEYS.CRAWL_RESULTS_PREFIX}${subreddit}`] && subredditData[`${STORAGE_KEYS.CRAWL_RESULTS_PREFIX}${subreddit}`].data) {
      posts = subredditData[`${STORAGE_KEYS.CRAWL_RESULTS_PREFIX}${subreddit}`].data;
    }
    
    // 过滤掉要删除的帖子
    const updatedPosts = posts.filter(p => p.id !== postId);
    
    if (updatedPosts.length === 0) {
      // 如果板块为空，从存储中删除该板块
      await chrome.storage.local.remove(`${STORAGE_KEYS.CRAWL_RESULTS_PREFIX}${subreddit}`);
      
      // 更新板块列表
      const subredditsResult = await chrome.storage.local.get(STORAGE_KEYS.CRAWL_RESULTS_SUBREDDITS);
      let subreddits = subredditsResult[STORAGE_KEYS.CRAWL_RESULTS_SUBREDDITS] || [];
      const updatedSubreddits = subreddits.filter(s => s !== subreddit);
      await chrome.storage.local.set({ [STORAGE_KEYS.CRAWL_RESULTS_SUBREDDITS]: updatedSubreddits });
    } else {
      // 保存更新后的数据
      const dataWithTimestamp = {
        data: updatedPosts,
        timestamp: Date.now()
      };
      await chrome.storage.local.set({ [`${STORAGE_KEYS.CRAWL_RESULTS_PREFIX}${subreddit}`]: dataWithTimestamp });
    }
    
    // 记录已删除的帖子
    const deletedPostsData = await chrome.storage.local.get(STORAGE_KEYS.DELETED_POSTS);
    let deletedPosts = deletedPostsData[STORAGE_KEYS.DELETED_POSTS] || [];
    
    // 检查是否已存在
    const existingIndex = deletedPosts.findIndex(p => p.id === postId);
    if (existingIndex === -1) {
      deletedPosts.push({
        id: postId,
        permalink: permalink,
        subreddit: subreddit,
        deletedAt: Date.now()
      });
      await chrome.storage.local.set({ [STORAGE_KEYS.DELETED_POSTS]: deletedPosts });
    }
    
    return { success: true };
  } catch (error) {
    console.error('删除帖子失败:', error);
    return { success: false, error: error.message, code: error.code };
  }
}

// 获取已删除的帖子列表
async function getDeletedPosts() {
  try {
    const deletedPostsData = await chrome.storage.local.get(STORAGE_KEYS.DELETED_POSTS);
    return deletedPostsData[STORAGE_KEYS.DELETED_POSTS] || [];
  } catch (error) {
    console.error('获取已删除帖子失败:', error);
    return [];
  }
}

// 清理过期数据
async function cleanupExpiredData() {
  try {
    // 获取所有存储键
    const allKeys = await chrome.storage.local.get(null);
    const keysToRemove = [];
    const now = Date.now();
    
    // 检查每个键的数据是否过期
    for (const [key, value] of Object.entries(allKeys)) {
      // 检查用户配置
      if (key === STORAGE_KEYS.USER_CONFIG && value.timestamp) {
        if (now - value.timestamp >= EXPIRATION_TIME.USER_CONFIG) {
          keysToRemove.push(key);
        }
      }
      // 检查用户设置
      else if (key === STORAGE_KEYS.USER_SETTINGS && value.timestamp) {
        if (now - value.timestamp >= EXPIRATION_TIME.USER_SETTINGS) {
          keysToRemove.push(key);
        }
      }
      // 检查爬取结果
      else if (key.startsWith(STORAGE_KEYS.CRAWL_RESULTS_PREFIX) && value.timestamp) {
        if (now - value.timestamp >= EXPIRATION_TIME.CRAWL_RESULTS) {
          keysToRemove.push(key);
        }
      }
    }
    
    // 删除过期数据
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      
      // 如果删除了爬取结果，更新板块列表
      const crawlResultKeys = keysToRemove.filter(key => key.startsWith(STORAGE_KEYS.CRAWL_RESULTS_PREFIX));
      if (crawlResultKeys.length > 0) {
        const subredditsResult = await chrome.storage.local.get(STORAGE_KEYS.CRAWL_RESULTS_SUBREDDITS);
        let subreddits = subredditsResult[STORAGE_KEYS.CRAWL_RESULTS_SUBREDDITS] || [];
        
        // 移除已删除板块
        const remainingSubreddits = subreddits.filter(subreddit => 
          !crawlResultKeys.includes(`${STORAGE_KEYS.CRAWL_RESULTS_PREFIX}${subreddit}`)
        );
        
        if (remainingSubreddits.length !== subreddits.length) {
          await chrome.storage.local.set({ [STORAGE_KEYS.CRAWL_RESULTS_SUBREDDITS]: remainingSubreddits });
        }
      }
      
      console.log(`清理了 ${keysToRemove.length} 个过期数据`);
    }
    
    return { success: true, removed: keysToRemove.length };
  } catch (error) {
    console.error('清理过期数据失败:', error);
    return { success: false, error: error.message, code: error.code };
  }
}

// 将函数挂载到全局作用域
if (typeof self !== 'undefined') {
  self.saveUserConfig = saveUserConfig;
  self.getUserConfig = getUserConfig;
  self.saveUserSettings = saveUserSettings;
  self.getUserSettings = getUserSettings;
  self.saveCrawlResults = saveCrawlResults;
  self.getCrawlResults = getCrawlResults;
  self.savePostTranslation = savePostTranslation;
  self.deletePost = deletePost;
  self.getDeletedPosts = getDeletedPosts;
  self.cleanupExpiredData = cleanupExpiredData;
}

// 如果支持ES6模块导出，也提供导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    saveUserConfig,
    getUserConfig,
    saveUserSettings,
    getUserSettings,
    saveCrawlResults,
    getCrawlResults,
    savePostTranslation,
    deletePost,
    getDeletedPosts,
    cleanupExpiredData
  };
}
