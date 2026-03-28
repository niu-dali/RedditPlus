/**
 * 消息处理模块
 * 处理来自弹出页面和内容脚本的消息
 */

/**
 * 初始化存储
 * 加载用户配置、设置和爬取结果
 * @returns {Promise<Object>} 包含用户配置、设置和爬取结果的对象
 */
async function initializeStorage() {
  try {
    const [userConfig, userSettings] = await Promise.all([
      getUserConfig(),
      getUserSettings()
    ]);
    
    return { userConfig, userSettings };
  } catch (error) {
    console.error('初始化存储失败:', error);
    const defaultSettings = getDefaultUserSettings();
    return {
      userConfig: { selectedSubreddits: DEFAULT_SUBREDDITS.map(sub => sub.name) },
      userSettings: defaultSettings
    };
  }
}

/**
 * 处理消息
 * 根据消息类型执行相应的操作
 * @param {Object} message - 消息对象
 * @param {Object} sender - 消息发送者
 * @param {Function} sendResponse - 响应函数
 * @returns {boolean|undefined} 是否为异步响应
 */
function handleMessage(message, sender, sendResponse) {
  // 检查消息是否包含action字段
  if (!message || !message.action) {
    sendResponse({ error: 'Invalid message format' });
    return false;
  }
  
  // 处理不同类型的消息
  switch (message.action) {
    case 'getSubreddits':
      // 只返回订阅者数量大于5000的板块
      const filteredSubreddits = DEFAULT_SUBREDDITS.filter(sub => sub.subscribers >= MIN_SUBSCRIBERS);
      sendResponse({ subreddits: filteredSubreddits });
      break;
    
    case 'getConfig':
      getUserConfig().then(config => {
        sendResponse({ config });
      }).catch(error => {
        sendResponse({ error: error.message });
      });
      return true; // 异步响应
    
    case 'updateConfig':
      getUserConfig().then(currentConfig => {
        return saveUserConfig({ ...currentConfig, ...message.config });
      }).then(updateConfigResult => {
        sendResponse({ success: updateConfigResult.success });
      }).catch(error => {
        sendResponse({ error: error.message });
      });
      return true; // 异步响应
    
    case 'getSettings':
      getUserSettings().then(settings => {
        sendResponse({ settings });
      }).catch(error => {
        sendResponse({ error: error.message });
      });
      return true; // 异步响应
    
    case 'updateSettings':
      getUserSettings().then(currentSettings => {
        return saveUserSettings({ ...currentSettings, ...message.settings });
      }).then(updateSettingsResult => {
        sendResponse({ success: updateSettingsResult.success });
      }).catch(error => {
        sendResponse({ error: error.message });
      });
      return true; // 异步响应
    
    case 'getAiSystems':
      getUserSettings().then(currentSettings => {
        sendResponse({ aiSystems: currentSettings.aiSystems });
      }).catch(error => {
        sendResponse({ error: error.message });
      });
      return true; // 异步响应
    
    case 'addAiSystem':
      getUserSettings().then(addAiSystemSettings => {
        addAiSystemSettings.aiSystems.push({
          name: `AI系统 ${addAiSystemSettings.aiSystems.length + 1}`,
          url: '',
          key: '',
          model: 'gpt-3.5-turbo',
          customModel: ''
        });
        return saveUserSettings(addAiSystemSettings);
      }).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ error: error.message });
      });
      return true; // 异步响应
    
    case 'deleteAiSystem':
      getUserSettings().then(deleteAiSystemSettings => {
        if (deleteAiSystemSettings.aiSystems.length > 1) {
          deleteAiSystemSettings.aiSystems.splice(message.index, 1);
          return saveUserSettings(deleteAiSystemSettings);
        }
        return { success: true };
      }).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ error: error.message });
      });
      return true; // 异步响应
    
    case 'crawlSubreddit':
      crawlSubreddit(message.subreddit, message.limit).then(crawlResult => {
        sendResponse(crawlResult);
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // 异步响应
    
    case 'analyzeContent':
      getUserSettings().then(settings => {
        return analyzeContent(message.content, settings.targetLanguage, settings.interfaceLanguage, settings.aiSystems);
      }).then(analyzeResult => {
        sendResponse(analyzeResult);
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // 异步响应
    
    case 'analyzePost':
      analyzePost(message.postId).then(postResult => {
        if (postResult.success) {
          return getUserSettings().then(settings => {
            return analyzeContent({
              title: postResult.post.title,
              selftext: postResult.post.selftext,
              comments: []
            }, settings.targetLanguage, settings.interfaceLanguage, settings.aiSystems);
          }).then(analysisResult => {
            if (analysisResult.success) {
              // 向内容脚本发送分析结果
              try {
                chrome.tabs.sendMessage(sender.tab.id, {
                  action: 'showAnalysis',
                  analysis: analysisResult.analysis
                });
              } catch (error) {
                console.log('Tab not available for analysis result:', error);
              }
            }
            return postResult;
          });
        }
        return postResult;
      }).then(result => {
        sendResponse({ success: result.success, error: result.error });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // 异步响应
    
    case 'saveCrawlResults':
      saveCrawlResults(message.results).then(saveResult => {
        sendResponse({ success: saveResult.success });
      }).catch(error => {
        sendResponse({ error: error.message });
      });
      return true; // 异步响应
    
    case 'getCrawlResults':
      getCrawlResults().then(results => {
        // 过滤掉没有帖子的板块
        const filteredResults = Object.entries(results).filter(([name, posts]) => 
          Array.isArray(posts) && posts.length > 0
        );
        const resultsArray = filteredResults.map(([name, posts]) => ({
          name,
          posts
        }));
        sendResponse({ results: resultsArray });
      }).catch(error => {
        sendResponse({ error: error.message });
      });
      return true; // 异步响应
    
    case 'getDeletedPosts':
      getDeletedPosts().then(deletedPosts => {
        sendResponse({ deletedPosts: deletedPosts });
      }).catch(error => {
        sendResponse({ deletedPosts: [], error: error.message });
      });
      return true; // 异步响应
    
    case 'translateContent':
      getUserSettings().then(settings => {
        return analyzeContent(message.content, settings.targetLanguage, settings.interfaceLanguage, settings.aiSystems);
      }).then(translateResult => {
        sendResponse({ success: translateResult.success, analysis: translateResult.analysis });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // 异步响应
    
    case 'savePostTranslation':
      savePostTranslation(message.subreddit, message.post).then(saveTranslationResult => {
        sendResponse({ success: saveTranslationResult.success });
      }).catch(error => {
        sendResponse({ error: error.message });
      });
      return true; // 异步响应
    
    case 'deletePost':
      deletePost(message.postId, message.permalink, message.subreddit).then(deleteResult => {
        sendResponse({ success: deleteResult.success });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // 异步响应
    
    case 'startCrawl':
      startCrawl(message.type, message.senderTab || sender.tab, message.subreddit).then(sendResponse).catch(error => {
        sendResponse({ error: error.message });
      });
      return true; // 异步响应
    
    case 'openSettings':
      chrome.tabs.query({
        url: chrome.runtime.getURL('popup.html*')
      }).then(existingPopupTabs => {
        if (existingPopupTabs.length > 0) {
          // 如果已经有打开的popup.html页面，跳转到该页面并切换到设置标签
          const tab = existingPopupTabs[0];
          return chrome.tabs.update(tab.id, {
            url: chrome.runtime.getURL('popup.html?tab=settings'),
            active: true
          }).then(() => {
            return chrome.windows.update(tab.windowId, { focused: true });
          });
        } else {
          // 否则创建新标签页
          return chrome.tabs.create({
            url: chrome.runtime.getURL('popup.html?tab=settings'),
            active: true
          });
        }
      }).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ error: error.message });
      });
      return true; // 异步响应
    
    case 'openCrawlResults':
      chrome.tabs.query({
        url: chrome.runtime.getURL('crawl-results.html*')
      }).then(existingResultsTabs => {
        if (existingResultsTabs.length > 0) {
          // 如果已经有打开的crawl-results.html页面，跳转到该页面
          const tab = existingResultsTabs[0];
          return chrome.tabs.update(tab.id, { active: true }).then(() => {
            return chrome.windows.update(tab.windowId, { focused: true });
          });
        } else {
          // 否则创建新标签页
          return chrome.tabs.create({
            url: chrome.runtime.getURL('crawl-results.html'),
            active: true
          });
        }
      }).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ error: error.message });
      });
      return true; // 异步响应
    
    case 'pingAiSystem':
      // 测试AI系统是否可用
      pingAiSystem(message.aiConfig).then(sendResponse).catch(error => {
        sendResponse({ error: error.message });
      });
      return true; // 异步响应
    
    case 'testAiSystem':
      // 测试AI系统（ping或发送消息）
      console.log('Handling testAiSystem message:', message);
      testAiSystem(message.type, message.aiSystem, message.message).then(sendResponse).catch(error => {
        console.error('Error in testAiSystem:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true; // 异步响应
    
    case 'analyzePosts':
      // 分析所有未分析的帖子
      analyzeAllPosts().then(analyzeResult => {
        sendResponse(analyzeResult);
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // 异步响应
    
    case 'analyzeSubreddit':
      // 分析指定板块的内容
      analyzeSubreddit(message.subreddit).then(analyzeResult => {
        sendResponse(analyzeResult);
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // 异步响应
    
    case 'updateSubreddit':
      // 更新指定板块的内容
      updateSubreddit(message.subreddit).then(updateResult => {
        sendResponse(updateResult);
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // 异步响应
    
    case 'startAiWebAutomation':
      startAiWebAutomation(message.platform, message.content, message.options || {})
        .then(result => {
          sendResponse(result);
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // 异步响应
    
    case 'getAiWebAutomationStatus':
      sendResponse(getAiWebAutomationStatus());
      return false;
    
    case 'cancelAiWebAutomation':
      cancelAiWebAutomation();
      sendResponse({ success: true });
      return false;
    
    case 'aiWebAutomationComplete':
      handleAiWebAutomationComplete(message.result);
      sendResponse({ success: true });
      return false;
    
    case 'getAiWebPlatforms':
      sendResponse({ platforms: AI_WEB_PLATFORMS });
      return false;
    
    default:
      console.log('Unknown action:', message.action);
      sendResponse({ error: 'Unknown action' });
  }
  
  // 对于同步响应，返回false
  return false;
}

/**
 * 全局爬取状态
 */
let crawlState = {
  isRunning: false,
  type: '',
  current: 0,
  total: 0,
  totalPosts: 0,
  subreddits: [],
  startTime: 0
};

/**
 * 开始爬取过程
 * @param {string} type - 爬取类型（selected、all 或 update）
 * @param {Object} senderTab - 发送者标签页
 * @param {string} subreddit - 要爬取的单个板块名称（仅当type为'single'时使用）
 * @returns {Promise<Object>} 爬取结果
 */
async function startCrawl(type, senderTab, subreddit) {
  // 检查是否已经在爬取中
  if (crawlState.isRunning) {
    return { success: false, message: '爬取已在进行中' };
  }
  
  // 设置爬取状态
  crawlState = {
    isRunning: true,
    type: type,
    current: 0,
    total: 0,
    totalPosts: 0,
    subreddits: [],
    startTime: Date.now()
  };
  
  // 保存爬取状态到存储
  await chrome.storage.local.set({ 'crawlState': crawlState });
  
  // 立即返回成功响应，避免阻塞UI
  setTimeout(async () => {
    // 确保subreddit参数在回调函数中可用
    let tab;
    
    try {
      // 检查是否有打开的爬取结果标签页
      const existingTabs = await chrome.tabs.query({
        url: chrome.runtime.getURL('crawl-results.html*')
      });
      
      if (existingTabs.length > 0) {
        // 如果已经有打开的标签页，跳转到该页面
        tab = existingTabs[0];
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
      } else {
        // 否则创建新标签页
        tab = await chrome.tabs.create({
          url: chrome.runtime.getURL(`crawl-results.html?type=${type}`),
          active: true
        });
        
        // 等待标签页加载完成
        await new Promise(resolve => {
          const listener = (tabId, changeInfo) => {
            if (tabId === tab.id && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });
      }
      
      // 确保tab对象存在
      if (!tab || !tab.id) {
        console.error('Tab not found or invalid');
        crawlState.isRunning = false;
        await chrome.storage.local.set({ 'crawlState': crawlState });
        return;
      }
      
      // 获取配置
      const userConfig = await getUserConfig();
      const userSettings = await getUserSettings();
      const maxPosts = userConfig.maxPosts || 1000;
      const maxComments = userConfig.maxComments || 200;
      const depth = userConfig.depth || 10;
      const minSubscribers = userConfig.minSubscribers || 5000;
      
      // 确定要爬取的板块
      let subredditsToCrawl = [];
      
      if (type === 'single' && subreddit) {
        // 爬取单个板块
        subredditsToCrawl = [subreddit];
      } else if (type === 'selected') {
        // 使用用户选择的板块
        subredditsToCrawl = userConfig.selectedSubreddits || [];
      } else {
        // 全量更新：使用所有符合条件的板块
        subredditsToCrawl = DEFAULT_SUBREDDITS
          .filter(sub => sub.subscribers >= minSubscribers)
          .map(sub => sub.name);
      }
      
      if (subredditsToCrawl.length === 0) {
        // 确保tab对象存在
        if (tab && tab.id) {
          try {
            chrome.tabs.sendMessage(tab.id, {
              action: 'crawlComplete',
              total: 0,
              totalPosts: 0
            });
          } catch (error) {
            console.log('Tab not available for completion message:', error);
          }
        }
        return;
      }
      
      // 开始爬取
      let totalPosts = 0;
      let current = 0;
      const total = subredditsToCrawl.length;
      
      // 按板块分组的结果，始终先获取现有结果，避免覆盖其他板块数据
      const groupedResults = await getCrawlResults();
      
      // 并行处理所有板块
      await Promise.all(subredditsToCrawl.map(async (subreddit) => {
        try {
          // 检查爬取状态是否被取消
          const currentState = await chrome.storage.local.get('crawlState');
          if (currentState.crawlState && !currentState.crawlState.isRunning) {
            console.log('爬取已被取消');
            return;
          }
          
          // 更新进度
          const currentProgress = ++current;
          
          // 更新爬取状态
          crawlState.current = currentProgress;
          await chrome.storage.local.set({ 'crawlState': crawlState });
          
          // 发送进度更新到所有结果页面
          const resultsTabs = await chrome.tabs.query({
            url: chrome.runtime.getURL('crawl-results.html*')
          });
          
          for (const resultsTab of resultsTabs) {
            try {
              chrome.tabs.sendMessage(resultsTab.id, {
                action: 'updateProgress',
                current: currentProgress,
                total: total,
                message: `正在更新 r/${subreddit}...`
              });
            } catch (error) {
              // 标签页不存在或已关闭，忽略错误
              console.log('Tab not available for progress update:', error);
            }
          }
          
          // 使用浏览器自动化爬取
          const crawlResult = await browserAutomation.startBrowserAutomation(subreddit, {
            maxPosts: maxPosts === -1 ? Infinity : maxPosts,
            maxComments: maxComments === -1 ? Infinity : maxComments,
            depth: depth === -1 ? Infinity : depth,
            sortBy: 'hot' // 默认使用最受欢迎的排序方式
          });
          
          if (crawlResult.success) {
            // 获取已删除的帖子列表
            const deletedPosts = await getDeletedPosts();
            const deletedPostIds = new Set(deletedPosts.map(p => p.id));
            
            // 发送结果到标签页并实时保存
            if (Array.isArray(crawlResult.posts)) {
              for (const post of crawlResult.posts) {
                // 跳过已删除的帖子
                if (deletedPostIds.has(post.id)) {
                  continue;
                }
                
                // 发送结果到所有结果页面
                const resultsTabs = await chrome.tabs.query({
                  url: chrome.runtime.getURL('crawl-results.html*')
                });
                
                for (const resultsTab of resultsTabs) {
                  try {
                    chrome.tabs.sendMessage(resultsTab.id, {
                      action: 'addResult',
                      subreddit: subreddit,
                      post: post
                    });
                  } catch (error) {
                    // 标签页不存在或已关闭，忽略错误
                    console.log('Tab not available for result update:', error);
                  }
                }
                
                // 实时保存帖子
                if (!groupedResults[subreddit]) {
                  groupedResults[subreddit] = [];
                }
                
                // 检查是否已存在该帖子，避免重复
                const existingPostIndex = groupedResults[subreddit].findIndex(p => p.id === post.id);
                if (existingPostIndex === -1) {
                  groupedResults[subreddit].push(post);
                  totalPosts++;
                  
                  // 每10个帖子保存一次，避免频繁存储操作
                  if (groupedResults[subreddit].length % 10 === 0) {
                    try {
                      // 保存当前板块的结果
                      const subredditData = {
                        [subreddit]: groupedResults[subreddit]
                      };
                      await saveCrawlResults(subredditData);
                      console.log(`Saved ${groupedResults[subreddit].length} posts for r/${subreddit}`);
                    } catch (saveError) {
                      console.error(`Error saving intermediate results for r/${subreddit}:`, saveError);
                      // 继续处理，不中断爬取
                    }
                  }
                }
              }
            }
            
            // 去重后保存到数据管理器
            const uniquePosts = crawlResult.posts.filter(post => 
              !groupedResults[subreddit].find(p => p.id === post.id)
            );
            dataManager.addPosts(uniquePosts);
            
            // 板块爬取完成后保存最终结果
            try {
              const subredditData = {
                [subreddit]: groupedResults[subreddit]
              };
              await saveCrawlResults(subredditData);
              console.log(`Completed saving ${groupedResults[subreddit].length} posts for r/${subreddit}`);
            } catch (saveError) {
              console.error(`Error saving final results for r/${subreddit}:`, saveError);
              // 继续处理，不中断爬取
            }
          } else if (crawlResult.needsLogin) {
            // 发送登录提示到所有结果页面
            const resultsTabs = await chrome.tabs.query({
              url: chrome.runtime.getURL('crawl-results.html*')
            });
            
            for (const resultsTab of resultsTabs) {
              try {
                chrome.tabs.sendMessage(resultsTab.id, {
                  action: 'loginRequired'
                });
              } catch (error) {
                // 标签页不存在或已关闭，忽略错误
                console.log('Tab not available for login prompt:', error);
              }
            }
            return;
          }
        } catch (error) {
          console.error(`Error processing subreddit ${subreddit}:`, error);
          // 继续处理其他板块
        }
      }));
      
      // 按质量评分排序，从高到低
      Object.keys(groupedResults).forEach(subreddit => {
        groupedResults[subreddit].sort((a, b) => {
          const scoreA = a.analysis?.qualityScore || 0;
          const scoreB = b.analysis?.qualityScore || 0;
          return scoreB - scoreA;
        });
      });
      
      // 最终保存所有结果
      await saveCrawlResults(groupedResults);
      console.log(`Final save completed: ${totalPosts} posts across ${Object.keys(groupedResults).length} subreddits`);
      
      // 保存到数据管理器
      dataManager.savePosts();
      
      // 发送完成消息到所有结果页面
      const resultsTabs = await chrome.tabs.query({
        url: chrome.runtime.getURL('crawl-results.html*')
      });
      
      for (const resultsTab of resultsTabs) {
        try {
          chrome.tabs.sendMessage(resultsTab.id, {
            action: 'crawlComplete',
            total: total,
            totalPosts: totalPosts
          });
        } catch (error) {
          // 标签页不存在或已关闭，忽略错误
          console.log('Tab not available for completion message:', error);
        }
      }
      
      // 重置爬取状态
      crawlState.isRunning = false;
      await chrome.storage.local.set({ 'crawlState': crawlState });
    } catch (error) {
      console.error('Error in startCrawl:', error);
      // 发送错误消息到所有结果页面
      const resultsTabs = await chrome.tabs.query({
        url: chrome.runtime.getURL('crawl-results.html*')
      });
      
      for (const resultsTab of resultsTabs) {
        try {
          chrome.tabs.sendMessage(resultsTab.id, {
            action: 'crawlError',
            error: error.message
          });
        } catch (error) {
          // 标签页不存在或已关闭，忽略错误
          console.log('Tab not available for error message:', error);
        }
      }
      
      // 重置爬取状态
      crawlState.isRunning = false;
      await chrome.storage.local.set({ 'crawlState': crawlState });
    }
  }, 0);
  
  // 立即返回成功响应
  return { success: true, message: '开始爬取过程...' };
}

/**
 * 测试AI系统是否可用
 * @param {Object} aiConfig - AI系统配置
 * @returns {Promise<Object>} 测试结果
 */
async function pingAiSystem(aiConfig) {
  try {
    // 检查aiConfig是否存在
    if (!aiConfig) {
      return { success: false, message: 'AI系统配置为空' };
    }
    
    // 检查必要的配置项
    const apiKey = aiConfig.key || aiConfig.apiKey;
    if (!aiConfig.url || !apiKey) {
      return { success: false, message: 'AI系统配置不完整' };
    }
    
    // 发送真实的请求到AI API
    const response = await fetch(aiConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: aiConfig.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'ping'
          }
        ],
        max_tokens: 1
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return { success: true, message: 'AI系统可用' };
    } else {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, message: errorData.error?.message || 'AI系统响应错误' };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * 测试AI系统
 * @param {string} type - 测试类型（ping或message）
 * @param {Object} aiSystem - AI系统配置
 * @param {string} message - 测试消息（仅在type为message时使用）
 * @returns {Promise<Object>} 测试结果
 */
async function testAiSystem(type, aiSystem, message) {
  try {
    const startTime = Date.now();
    
    if (type === 'ping') {
      // 测试连接
      if (!aiSystem.key || aiSystem.key.trim() === '') {
        return { success: false, error: 'API密钥未配置' };
      }
      
      if (!aiSystem.url || aiSystem.url.trim() === '') {
        return { success: false, error: 'API URL未配置' };
      }
      
      // 发送真实的ping请求到AI API
      // 对于智谱GLM-5，我们发送一个简单的请求来测试连接
      const testMessage = 'ping';
      const response = await fetch(aiSystem.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiSystem.key}`
        },
        body: JSON.stringify({
          model: aiSystem.model === 'custom' ? aiSystem.customModel : aiSystem.model,
          messages: [
            {
              role: 'user',
              content: testMessage
            }
          ],
          temperature: 0.7,
          max_tokens: 16384
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error?.message || `HTTP错误: ${response.status}` };
      }
      
      const responseTime = Date.now() - startTime;
      return { success: true, responseTime: responseTime };
    } else if (type === 'message') {
      // 测试发送消息
      if (!aiSystem.key || aiSystem.key.trim() === '') {
        return { success: false, error: 'API密钥未配置' };
      }
      
      if (!aiSystem.url || aiSystem.url.trim() === '') {
        return { success: false, error: 'API URL未配置' };
      }
      
      if (!message || message.trim() === '') {
        return { success: false, error: '测试消息不能为空' };
      }
      
      // 发送真实的消息请求到AI API
      const response = await fetch(aiSystem.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiSystem.key}`
        },
        body: JSON.stringify({
          model: aiSystem.model === 'custom' ? aiSystem.customModel : aiSystem.model,
          messages: [
            {
              role: 'user',
              content: message
            }
          ],
          temperature: 0.7,
          max_tokens: 16384
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error?.message || `HTTP错误: ${response.status}` };
      }
      
      const responseData = await response.json();
      console.log('AI API response:', responseData);
      
      // 尝试不同的响应格式
      let aiResponse = '无响应内容';
      
      // OpenAI格式
      if (responseData.choices && responseData.choices[0] && responseData.choices[0].message && responseData.choices[0].message.content) {
        aiResponse = responseData.choices[0].message.content;
      }
      // 智谱GLM格式（可能的格式）
      else if (responseData.data && responseData.data.choices && responseData.data.choices[0] && responseData.data.choices[0].content) {
        aiResponse = responseData.data.choices[0].content;
      }
      // 智谱GLM直接返回格式
      else if (responseData.content) {
        aiResponse = responseData.content;
      }
      // 其他可能的格式
      else if (responseData.text) {
        aiResponse = responseData.text;
      }
      // 百度ERNIE格式
      else if (responseData.result) {
        aiResponse = responseData.result;
      }
      // 字节跳动Doubao格式
      else if (responseData.output) {
        aiResponse = responseData.output;
      }
      // 阿里云Qwen格式
      else if (responseData.response) {
        aiResponse = responseData.response;
      }
      // 尝试提取任何可能的文本内容
      else if (typeof responseData === 'object') {
        // 尝试找到第一个包含文本的字段
        const textFields = ['message', 'result', 'output', 'response', 'text', 'content'];
        for (const field of textFields) {
          if (responseData[field]) {
            if (typeof responseData[field] === 'string') {
              aiResponse = responseData[field];
              break;
            } else if (typeof responseData[field] === 'object' && responseData[field].content) {
              aiResponse = responseData[field].content;
              break;
            }
          }
        }
      }
      
      // 检查响应是否被截断
      if (aiResponse && aiResponse.endsWith('...') || aiResponse && aiResponse.length < 50) {
        console.warn('AI response might be truncated:', aiResponse);
        // 尝试从原始响应中获取更多信息
        if (responseData.reasoning_content) {
          aiResponse += '\n\n思考过程: ' + responseData.reasoning_content;
        }
      }
      
      return { success: true, response: aiResponse };
    } else {
      // 对于未知测试类型，尝试发送消息请求并返回所有内容
      if (!aiSystem.key || aiSystem.key.trim() === '') {
        return { success: false, error: 'API密钥未配置' };
      }
      
      if (!aiSystem.url || aiSystem.url.trim() === '') {
        return { success: false, error: 'API URL未配置' };
      }
      
      if (!message || message.trim() === '') {
        return { success: false, error: '测试消息不能为空' };
      }
      
      // 发送真实的消息请求到AI API
      const response = await fetch(aiSystem.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiSystem.key}`
        },
        body: JSON.stringify({
          model: aiSystem.model === 'custom' ? aiSystem.customModel : aiSystem.model,
          messages: [
            {
              role: 'user',
              content: message
            }
          ],
          temperature: 0.7,
          max_tokens: 16384
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error?.message || `HTTP错误: ${response.status}` };
      }
      
      const responseData = await response.json();
      console.log('AI API response:', responseData);
      
      // 返回完整的响应数据
      return { success: true, response: responseData, rawResponse: responseData };
    }
  } catch (error) {
    console.error('Error testing AI system:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 分析所有未分析的帖子
 * @returns {Promise<Object>} 分析结果
 */
async function analyzeAllPosts() {
  try {
    // 获取所有帖子
    const allPosts = dataManager.getAllPosts();
    
    // 筛选未分析的帖子
    const unanalyzedPosts = allPosts.filter(post => !post.analysis || !post.analysis.qualityScore);
    
    if (unanalyzedPosts.length === 0) {
      return { success: true, analyzedCount: 0, message: '没有需要分析的帖子' };
    }
    
    // 获取用户设置
    const userSettings = await getUserSettings();
    const targetLanguage = userSettings.targetLanguage || 'zh';
    const interfaceLanguage = userSettings.interfaceLanguage || 'zh';
    const aiSystems = userSettings.aiSystems || [];
    
    let analyzedCount = 0;
    
    // 逐个分析帖子
    for (const post of unanalyzedPosts) {
      try {
        // 分析帖子内容
        const analyzeResult = await analyzeContent({
          title: post.title,
          selftext: post.selftext,
          comments: post.comments || []
        }, targetLanguage, interfaceLanguage, aiSystems);
        
        if (analyzeResult.success) {
          // 更新帖子的分析结果
          post.analysis = analyzeResult.analysis;
          post.analyzed = true;
          post.translation = analyzeResult.analysis.titleTranslation || post.title;
          post.selftextTranslation = analyzeResult.analysis.bodyTranslation || post.selftext;
          post.commentsTranslation = analyzeResult.analysis.commentsTranslation || '';
          
          // 保存更新后的帖子
          dataManager.updatePost(post);
          analyzedCount++;
        }
      } catch (error) {
        console.error(`Error analyzing post ${post.id}:`, error);
        // 继续分析下一个帖子
        continue;
      }
    }
    
    // 保存所有帖子
    await dataManager.savePosts();
    
    // 更新爬取结果
    const crawlResults = await getCrawlResults();
    Object.keys(crawlResults).forEach(subreddit => {
      crawlResults[subreddit] = crawlResults[subreddit].map(post => {
        const updatedPost = dataManager.getPost(post.id);
        return updatedPost || post;
      });
    });
    await saveCrawlResults(crawlResults);
    
    return { success: true, analyzedCount: analyzedCount, message: `成功分析 ${analyzedCount} 个帖子` };
  } catch (error) {
    console.error('Error in analyzeAllPosts:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 分析指定板块的内容
 * @param {string} subreddit - 板块名称
 * @returns {Promise<Object>} 分析结果
 */
async function analyzeSubreddit(subreddit) {
  try {
    // 获取指定板块的帖子
    const crawlResults = await getCrawlResults();
    const subredditPosts = crawlResults[subreddit] || [];
    
    if (subredditPosts.length === 0) {
      return { success: true, analyzedCount: 0, message: `板块 ${subreddit} 没有帖子需要分析` };
    }
    
    // 获取用户设置
    const userSettings = await getUserSettings();
    const targetLanguage = userSettings.targetLanguage || 'zh';
    const interfaceLanguage = userSettings.interfaceLanguage || 'zh';
    const aiSystems = userSettings.aiSystems || [];
    
    let analyzedCount = 0;
    
    // 逐个分析帖子
    for (const post of subredditPosts) {
      try {
        // 分析帖子内容
        const analyzeResult = await analyzeContent({
          title: post.title,
          selftext: post.selftext,
          comments: post.comments || []
        }, targetLanguage, interfaceLanguage, aiSystems);
        
        if (analyzeResult.success) {
          // 更新帖子的分析结果
          post.analysis = analyzeResult.analysis;
          post.translation = analyzeResult.analysis.titleTranslation || post.title;
          post.selftextTranslation = analyzeResult.analysis.bodyTranslation || post.selftext;
          post.commentsTranslation = analyzeResult.analysis.commentsTranslation || '';
          
          // 保存更新后的帖子
          dataManager.updatePost(post);
          analyzedCount++;
        }
      } catch (error) {
        console.error(`Error analyzing post ${post.id} in subreddit ${subreddit}:`, error);
        // 继续分析下一个帖子
        continue;
      }
    }
    
    // 保存所有帖子
    await dataManager.savePosts();
    
    // 更新爬取结果
    crawlResults[subreddit] = subredditPosts;
    await saveCrawlResults(crawlResults);
    
    return { success: true, analyzedCount: analyzedCount, message: `成功分析板块 ${subreddit} 的 ${analyzedCount} 个帖子` };
  } catch (error) {
    console.error(`Error in analyzeSubreddit ${subreddit}:`, error);
    return { success: false, error: error.message };
  }
}

async function updateSubreddit(subreddit) {
  try {
    // 获取用户配置
    const userConfig = await getUserConfig();
    const maxPosts = userConfig.maxPosts || 1000;
    const maxComments = userConfig.maxComments || 200;
    const depth = userConfig.depth || 10;
    
    // 使用浏览器自动化爬取指定板块
    const crawlResult = await browserAutomation.startBrowserAutomation(subreddit, {
      maxPosts: maxPosts === -1 ? Infinity : maxPosts,
      maxComments: maxComments === -1 ? Infinity : maxComments,
      depth: depth === -1 ? Infinity : depth,
      sortBy: 'hot'
    });
    
    if (!crawlResult.success) {
      return { success: false, error: crawlResult.error || '爬取失败' };
    }
    
    // 获取已删除的帖子列表
    const deletedPosts = await getDeletedPosts();
    const deletedPostIds = new Set(deletedPosts.map(p => p.id));
    
    // 获取现有结果
    const crawlResults = await getCrawlResults();
    const existingPosts = crawlResults[subreddit] || [];
    const existingPostIds = new Set(existingPosts.map(p => p.id));
    
    // 合并新帖子，避免重复
    let newPostCount = 0;
    for (const post of crawlResult.posts) {
      // 跳过已删除的帖子
      if (deletedPostIds.has(post.id)) {
        continue;
      }
      
      // 只添加新帖子
      if (!existingPostIds.has(post.id)) {
        existingPosts.push(post);
        newPostCount++;
      }
    }
    
    // 保存更新后的结果
    crawlResults[subreddit] = existingPosts;
    await saveCrawlResults(crawlResults);
    
    return { success: true, postCount: newPostCount, message: `成功更新板块 ${subreddit}，新增 ${newPostCount} 个帖子` };
  } catch (error) {
    console.error(`Error in updateSubreddit ${subreddit}:`, error);
    return { success: false, error: error.message };
  }
}

// 将函数挂载到全局作用域
if (typeof self !== 'undefined') {
  self.initializeStorage = initializeStorage;
  self.handleMessage = handleMessage;
  self.startCrawl = startCrawl;
  self.pingAiSystem = pingAiSystem;
  self.testAiSystem = testAiSystem;
  self.analyzeAllPosts = analyzeAllPosts;
  self.analyzeSubreddit = analyzeSubreddit;
  self.updateSubreddit = updateSubreddit;
}

// 如果支持ES6模块导出，也提供导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeStorage,
    handleMessage,
    startCrawl,
    pingAiSystem,
    testAiSystem
  };
}
