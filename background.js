/**
 * RedditPlus 扩展后台脚本
 * 负责处理扩展的初始化、消息监听和数据管理
 */

// 使用importScripts导入模块（适用于service worker）
// 注意：在Manifest V3中，service worker不支持ES6模块的import语法
// 需要将模块文件改为使用全局变量导出

importScripts('src/modules/config.js');
importScripts('src/modules/storage.js');
importScripts('src/modules/cache.js');
importScripts('src/modules/utils.js');
importScripts('src/modules/i18n.js');
importScripts('src/modules/translator.js');
importScripts('src/modules/redditCrawler.js');
importScripts('src/modules/aiAnalyzer.js');
importScripts('src/modules/browserAutomation.js');
importScripts('src/modules/aiWebAutomation.js');
importScripts('src/modules/dataManager.js');
importScripts('src/modules/messageHandler.js');

/**
 * 全局变量
 */
let userConfig = {}; // 用户配置
let userSettings = {}; // 用户设置

/**
 * 检查并删除重复数据
 */
async function removeDuplicatePosts() {
  try {
    console.log('Checking for duplicate posts...');
    
    // 获取所有爬取结果
    const crawlResults = await getCrawlResults();
    let totalDuplicates = 0;
    
    // 检查每个板块的重复数据
    for (const [subreddit, posts] of Object.entries(crawlResults)) {
      if (Array.isArray(posts)) {
        // 使用Set去重
        const uniquePosts = [];
        const postIds = new Set();
        
        for (const post of posts) {
          if (post && post.id && !postIds.has(post.id)) {
            postIds.add(post.id);
            uniquePosts.push(post);
          } else {
            totalDuplicates++;
          }
        }
        
        // 如果有重复数据，更新存储
        if (uniquePosts.length !== posts.length) {
          console.log(`Removed ${posts.length - uniquePosts.length} duplicate posts from r/${subreddit}`);
          const subredditData = {
            [subreddit]: uniquePosts
          };
          await saveCrawlResults(subredditData);
        }
      }
    }
    
    if (totalDuplicates > 0) {
      console.log(`Total duplicates removed: ${totalDuplicates}`);
    } else {
      console.log('No duplicate posts found');
    }
  } catch (error) {
    console.error('Error removing duplicate posts:', error);
  }
}

/**
 * 初始化扩展
 * 清理过期数据并加载存储的配置和设置
 */
async function init() {
  try {
    // 清理过期数据
    await cleanupExpiredData();
    
    // 检查并删除重复数据
    await removeDuplicatePosts();
    
    const storageData = await initializeStorage();
    userConfig = storageData.userConfig;
    userSettings = storageData.userSettings;
    console.log('Extension initialized successfully');
  } catch (error) {
    console.error('Error initializing extension:', error);
  }
}

/**
 * 监听消息
 * 处理来自弹出页面和内容脚本的消息
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 调用handleMessage函数并返回其返回值
  // handleMessage函数会根据消息类型返回true（异步响应）或false（同步响应）
  return handleMessage(message, sender, sendResponse);
});

/**
 * 检查是否已经打开了指定的页面
 * @param {string} pagePath - 页面路径，如 'popup.html' 或 'crawl-results.html'
 * @returns {Promise<number|null>} - 返回已打开页面的标签页ID，如果没有打开则返回null
 */
async function checkExistingTab(pagePath) {
  const tabs = await chrome.tabs.query({});
  const pageUrl = chrome.runtime.getURL(pagePath);
  
  for (const tab of tabs) {
    if (tab.url === pageUrl) {
      return tab.id;
    }
  }
  
  return null;
}

/**
 * 打开或跳转到指定的页面
 * @param {string} pagePath - 页面路径，如 'popup.html' 或 'crawl-results.html'
 */
async function openOrSwitchToPage(pagePath) {
  const existingTabId = await checkExistingTab(pagePath);
  
  if (existingTabId) {
    // 如果页面已经打开，跳转到该页面
    chrome.tabs.update(existingTabId, { active: true });
  } else {
    // 如果页面没有打开，打开一个新的页面
    chrome.tabs.create({
      url: chrome.runtime.getURL(pagePath),
      active: true
    });
  }
}

/**
 * 监听插件按钮点击事件
 * 当用户点击插件按钮时，在新标签页打开popup.html
 */
chrome.action.onClicked.addListener(() => {
  openOrSwitchToPage('popup.html');
});

// 启动初始化
init();
