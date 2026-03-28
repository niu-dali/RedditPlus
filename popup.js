/**
 * RedditPlus 扩展弹出页面脚本
 * 负责处理用户界面交互、配置管理、内容分析等功能
 */

/**
 * 全局变量
 */
let currentInterfaceLanguage = null; // 当前界面语言，将在初始化时设置

// i18n函数引用（将在DOMContentLoaded时从i18n.js获取）
let i18nGetTranslation = null;
let i18nGetLanguageDisplayName = null;
let i18nGetSupportedLanguages = null;

// 包装函数，使用缓存的引用避免递归
function getTrans(key, lang = null) {
  const useLang = lang || currentInterfaceLanguage || 'en';
  if (i18nGetTranslation) {
    return i18nGetTranslation(key, useLang);
  }
  return key;
}

function getLangDisplayName(langCode) {
  if (i18nGetLanguageDisplayName) {
    return i18nGetLanguageDisplayName(langCode);
  }
  return langCode;
}

function getSupportedLangs() {
  if (i18nGetSupportedLanguages) {
    return i18nGetSupportedLanguages();
  }
  return ['zh', 'en'];
}

// 加载板块列表和配置
document.addEventListener('DOMContentLoaded', async () => {
  // 首先初始化i18n函数引用
  // 初始化i18n函数引用
  if (typeof self !== 'undefined') {
    i18nGetTranslation = self.getTranslation || function(key, lang) { return key; };
    i18nGetLanguageDisplayName = self.getLanguageDisplayName || function(langCode) { return langCode; };
    i18nGetSupportedLanguages = self.getSupportedLanguages || function() { return ['zh', 'en']; };
    // 初始化时先使用浏览器语言检测
    if (self.detectBrowserLanguage) {
      currentInterfaceLanguage = self.detectBrowserLanguage();
    }
  } else {
    // 备用方案，直接定义默认函数
    i18nGetTranslation = function(key, lang) { return key; };
    i18nGetLanguageDisplayName = function(langCode) { return langCode; };
    i18nGetSupportedLanguages = function() { return ['zh', 'en']; };
  }
  
  // 如果浏览器语言检测失败，使用默认值
  if (!currentInterfaceLanguage) {
    currentInterfaceLanguage = 'en';
  }
  
  // 立即设置事件监听器
  setupEventListeners();
  
  // 立即设置标签页导航
  setupTabNavigation();
  
  // 立即更新界面语言，确保按钮显示正确文本
  updateInterfaceLanguage();
  
  // 立即禁用爬取按钮，显示为灰色
  const crawlSelectedButton = document.getElementById('crawlSelected');
  const crawlAllButton = document.getElementById('crawlAll');
  if (crawlSelectedButton) crawlSelectedButton.disabled = true;
  if (crawlAllButton) crawlAllButton.disabled = true;
  
  // 后台异步加载数据
  try {
    await Promise.all([
      loadSubreddits(),
      loadCustomSubreddits(),
      loadConfig(),
      loadSettings(),
      loadCrawlResults(),
      loadPluginDescription() // 加载插件介绍
    ]);
  } catch (error) {
    console.error('Error loading data:', error);
  } finally {
    // 数据加载完成后，启用按钮
    if (crawlSelectedButton) crawlSelectedButton.disabled = false;
    if (crawlAllButton) crawlAllButton.disabled = false;
  }
  
  // 检查URL参数，优先使用URL参数指定的标签页
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  
  if (tabParam) {
    // 触发对应标签页的点击事件
    const tab = document.querySelector(`.tab[data-tab="${tabParam}"]`);
    if (tab) {
      tab.click();
    }
  } else {
    // 加载保存的标签页状态
    chrome.storage.local.get('currentTab', (result) => {
      if (result.currentTab) {
        const tabId = result.currentTab;
        // 触发对应标签页的点击事件
        const tab = document.querySelector(`.tab[data-tab="${tabId}"]`);
        if (tab) {
          tab.click();
        }
      }
    });
  }
  
  // 设置收款码点击放大功能
  setupQrCodeClickEvents();
});

/**
 * 加载插件介绍
 */
function loadPluginDescription() {
  const pluginDescription = document.getElementById('pluginDescription');
  if (pluginDescription) {
    pluginDescription.textContent = getTrans('pluginDescription', currentInterfaceLanguage);
  }
}

/**
 * 设置收款码点击放大事件
 */
let currentZoomLevel = 1;
let currentY = 0;

function setupQrCodeClickEvents() {
  // 微信收款码
  const wechatQrContainer = document.getElementById('wechatQrContainer');
  if (wechatQrContainer) {
    wechatQrContainer.addEventListener('click', function() {
      const modal = document.getElementById('qrModal');
      const modalQrImg = document.getElementById('modalQrImg');
      const wechatQrImg = document.getElementById('wechatQrImg');
      
      if (modal && modalQrImg && wechatQrImg) {
        modalQrImg.src = wechatQrImg.src;
        modal.style.display = 'flex';
        modal.style.display = 'flex';
        currentZoomLevel = 1;
        currentY = 0;
        modalQrImg.style.transform = `scale(${currentZoomLevel}) translate(0, ${currentY}px)`;
      }
    });
  }
  
  // 支付宝收款码
  const alipayQrContainer = document.getElementById('alipayQrContainer');
  if (alipayQrContainer) {
    alipayQrContainer.addEventListener('click', function() {
      const modal = document.getElementById('qrModal');
      const modalQrImg = document.getElementById('modalQrImg');
      const alipayQrImg = document.getElementById('alipayQrImg');
      
      if (modal && modalQrImg && alipayQrImg) {
        modalQrImg.src = alipayQrImg.src;
        modal.style.display = 'flex';
        modal.style.display = 'flex';
        currentZoomLevel = 1;
        currentY = 0;
        modalQrImg.style.transform = `scale(${currentZoomLevel}) translate(0, ${currentY}px)`;
      }
    });
  }
  
  // 模态框点击关闭
  const qrModal = document.getElementById('qrModal');
  if (qrModal) {
    qrModal.addEventListener('click', function() {
      this.style.display = 'none';
      currentZoomLevel = 1;
      currentY = 0;
    });
  }
  
  // 缩放控制
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  const zoomResetBtn = document.getElementById('zoomReset');
  const modalQrImg = document.getElementById('modalQrImg');
  
  if (zoomInBtn && zoomOutBtn && zoomResetBtn && modalQrImg) {
    zoomInBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      currentZoomLevel = Math.min(currentZoomLevel + 0.2, 3);
      modalQrImg.style.transform = `scale(${currentZoomLevel}) translate(0, ${currentY}px)`;
    });
    
    zoomOutBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      currentZoomLevel = Math.max(currentZoomLevel - 0.2, 0.5);
      modalQrImg.style.transform = `scale(${currentZoomLevel}) translate(0, ${currentY}px)`;
    });
    
    zoomResetBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      currentZoomLevel = 1;
      currentY = 0;
      modalQrImg.style.transform = `scale(${currentZoomLevel}) translate(0, ${currentY}px)`;
    });
    
    // 添加鼠标滚轮控制（上/下滚动控制上下移动，按住Ctrl键滚动控制缩放）
    modalQrImg.addEventListener('wheel', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      if (e.ctrlKey) {
        // 按住Ctrl键滚动，控制缩放
        if (e.deltaY < 0) {
          // 向上滚动，放大
          currentZoomLevel = Math.min(currentZoomLevel + 0.1, 3);
        } else {
          // 向下滚动，缩小
          currentZoomLevel = Math.max(currentZoomLevel - 0.1, 0.5);
        }
      } else {
        // 正常滚动，控制上下移动
        if (e.deltaY < 0) {
          // 向上滚动，向上移动
          currentY = Math.min(currentY + 20, 300);
        } else {
          // 向下滚动，向下移动
          currentY = Math.max(currentY - 20, -300);
        }
      }
      
      modalQrImg.style.transform = `scale(${currentZoomLevel}) translate(0, ${currentY}px)`;
    }, { passive: false });
  }
}

/**
 * 设置标签页导航
 * 处理标签页切换逻辑，包括激活状态管理和内容显示/隐藏
 */
function setupTabNavigation() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      
      // 移除所有标签页的active类
      tabs.forEach(t => t.classList.remove('active'));
      // 添加当前标签页的active类
      tab.classList.add('active');
      // 隐藏所有内容
      document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
      });
      // 显示当前标签页的内容
      document.getElementById(`${tabId}-tab`).style.display = 'block';
      // 同步语言设置
      syncLanguageSettings();
      // 保存当前标签页状态
      chrome.storage.local.set({ currentTab: tabId });
    });
  });
}

/**
 * 加载板块列表
 * 从后台获取板块数据，并根据用户配置显示选中状态
 */
async function loadSubreddits() {
  const response = await chrome.runtime.sendMessage({ action: 'getSubreddits' });
  const configResponse = await chrome.runtime.sendMessage({ action: 'getConfig' });
  const config = configResponse.config;
  
  // 如果没有选中的板块，使用默认板块
  let selectedSubreddits = config.selectedSubreddits;
  if (!selectedSubreddits || selectedSubreddits.length === 0) {
    selectedSubreddits = response.subreddits.map(sub => sub.name);
    
    // 更新配置，保存默认选中状态
    const updatedConfig = {
      ...config,
      selectedSubreddits
    };
    await chrome.runtime.sendMessage({ action: 'updateConfig', config: updatedConfig });
  }
  
  const selectedSet = new Set(selectedSubreddits);
  
  const subredditList = document.getElementById('subredditList');
  subredditList.innerHTML = '';
  
  // 优化板块排序：已选择的和默认的板块放到最上边
  const sortedSubreddits = response.subreddits.sort((a, b) => {
    // 检查是否已选择
    const aSelected = selectedSet.has(a.name);
    const bSelected = selectedSet.has(b.name);
    
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    
    // 按名称排序
    return a.name.localeCompare(b.name);
  });
  
  sortedSubreddits.forEach(subreddit => {
    const div = document.createElement('div');
    div.className = 'subreddit-item';
    const isSelected = selectedSet.has(subreddit.name);
    // 根据当前界面语言获取对应的描述
    const desc = typeof subreddit.desc === 'object' ? (subreddit.desc[currentInterfaceLanguage] || subreddit.desc.zh) : subreddit.desc;
    div.innerHTML = `
      <input type="checkbox" id="sub-${subreddit.name}" value="${subreddit.name}" ${isSelected ? 'checked' : ''}>
      <label for="sub-${subreddit.name}">${subreddit.name} (${desc})</label>
    `;
    subredditList.appendChild(div);
  });
  
  // 为新添加的复选框添加自动保存事件
  setupAutoSaveConfig();
}

/**
 * 加载自定义板块
 * 从用户配置中获取自定义板块数据，并显示在界面上
 */
async function loadCustomSubreddits() {
  const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
  const config = response.config;
  const customSubredditsList = document.getElementById('customSubredditsList');
  customSubredditsList.innerHTML = '';
  
  // 获取已选择的板块
  const selectedSubreddits = config.selectedSubreddits || [];
  const selectedSet = new Set(selectedSubreddits);
  
  if (config.customSubreddits && config.customSubreddits.length > 0) {
    config.customSubreddits.forEach((subreddit, index) => {
      const div = document.createElement('div');
      div.className = 'custom-subreddit-item';
      const isSelected = selectedSet.has(subreddit.name);
      // 根据当前界面语言获取对应的描述
      const desc = typeof subreddit.desc === 'object' ? (subreddit.desc[currentInterfaceLanguage] || subreddit.desc.zh) : subreddit.desc;
      div.innerHTML = `
        <div>
          <input type="checkbox" id="custom-sub-${subreddit.name}" value="${subreddit.name}" ${isSelected ? 'checked' : ''}>
          <label for="custom-sub-${subreddit.name}">${subreddit.name} (${desc})</label>
        </div>
        <button class="delete-custom-subreddit secondary" data-index="${index}">${getTrans('buttonDelete')}</button>
      `;
      customSubredditsList.appendChild(div);
    });
    
    // 添加删除按钮事件
    document.querySelectorAll('.delete-custom-subreddit').forEach(button => {
      button.addEventListener('click', function() {
        const index = parseInt(this.dataset.index);
        deleteCustomSubreddit(index);
      });
    });
    
    // 为自定义板块的复选框添加自动保存功能
    setupAutoSaveConfig();
  } else {
    customSubredditsList.innerHTML = `<p style="color: #757575; font-size: 14px;">${getTrans('noCustomSubreddits', currentInterfaceLanguage)}</p>`;
  }
}

/**
 * 删除自定义板块
 * 根据索引从用户配置中删除指定的自定义板块
 * @param {number} index - 要删除的自定义板块的索引
 */
async function deleteCustomSubreddit(index) {
  const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
  const config = response.config;
  
  if (config.customSubreddits && config.customSubreddits.length > index) {
    config.customSubreddits.splice(index, 1);
    await chrome.runtime.sendMessage({ action: 'updateConfig', config });
    await loadCustomSubreddits();
    
    // 显示保存成功提示
    showCustomAlert(getTrans('alertConfigSaved'), 'success');
  }
}

/**
 * 恢复默认板块
 * 将用户选择的板块重置为默认板块列表
 */
async function restoreDefaultSubreddits() {
  const response = await chrome.runtime.sendMessage({ action: 'getSubreddits' });
  const defaultSubreddits = response.subreddits.map(sub => sub.name);
  
  const configResponse = await chrome.runtime.sendMessage({ action: 'getConfig' });
  const config = configResponse.config;
  
  const updatedConfig = {
    ...config,
    selectedSubreddits: defaultSubreddits
  };
  
  await chrome.runtime.sendMessage({ action: 'updateConfig', config: updatedConfig });
  
  // 重新加载板块列表
  await loadSubreddits();
  
  // 显示保存成功提示
  showCustomAlert(getTrans('alertConfigSaved'), 'success');
}

/**
 * 添加自定义板块
 * 从用户输入中获取自定义板块信息，并添加到用户配置中
 */
async function addCustomSubreddit() {
  const name = document.getElementById('customSubredditName').value.trim();
  const desc = document.getElementById('customSubredditDesc').value.trim();
  
  if (!name) {
    showCustomAlert(getTrans('alertEnterSubredditName'), 'error');
    return;
  }
  
  const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
  const config = response.config;
  
  if (!config.customSubreddits) {
    config.customSubreddits = [];
  }
  
  // 检查是否已存在
  const exists = config.customSubreddits.some(sub => sub.name === name);
  if (exists) {
    showCustomAlert(getTrans('alertSubredditExists'), 'error');
    return;
  }
  
  config.customSubreddits.push({ name, desc, url: `https://www.reddit.com/r/${name}` });
  await chrome.runtime.sendMessage({ action: 'updateConfig', config });
  
  // 清空输入框
  document.getElementById('customSubredditName').value = '';
  document.getElementById('customSubredditDesc').value = '';
  
  // 重新加载自定义板块
  await loadCustomSubreddits();
  
  // 显示保存成功提示
  showCustomAlert(getTrans('alertConfigSaved'), 'success');
}

/**
 * 加载配置
 * 从后台获取用户配置，并更新界面上的配置选项
 */
async function loadConfig() {
  const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
  const config = response.config;
  
  // 设置配置值，确保元素存在
  const maxPostsElement = document.getElementById('maxPosts');
  if (maxPostsElement) {
    maxPostsElement.value = config.maxPosts || 1000;
  }
  
  const maxCommentsElement = document.getElementById('maxComments');
  if (maxCommentsElement) {
    maxCommentsElement.value = config.maxComments || 200;
  }
  
  const depthElement = document.getElementById('depth');
  if (depthElement) {
    depthElement.value = config.depth || 10;
  }
  
  const minSubscribersElement = document.getElementById('minSubscribers');
  if (minSubscribersElement) {
    minSubscribersElement.value = config.minSubscribers || 5000;
  }
  
  // 勾选已选择的板块
  if (config.selectedSubreddits) {
    config.selectedSubreddits.forEach(subreddit => {
      const checkbox = document.getElementById(`sub-${subreddit}`) || document.getElementById(`custom-sub-${subreddit}`);
      if (checkbox) {
        checkbox.checked = true;
      }
    });
  }
}

/**
 * 加载设置
 * 从后台获取用户设置，并更新界面上的设置选项
 */
async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
  const settings = response.settings;
  
  // 设置语言
  const languageElements = [
    'interfaceLanguage',
    'main-interfaceLanguage',
    'settings-interfaceLanguage',
    'donate-interfaceLanguage',
    'instructions-interfaceLanguage'
  ];
  
  // 更新全局语言变量
  currentInterfaceLanguage = settings.interfaceLanguage || currentInterfaceLanguage || 'en';
  
  languageElements.forEach(elementId => {
    const element = document.getElementById(elementId);
    if (element) {
      element.value = currentInterfaceLanguage;
    }
  });
  
  // 更新界面语言
  updateInterfaceLanguage();
  
  // 初始化折叠功能
  initCollapsibleSections(settings);
  
  // 加载AI API启用状态
  const aiApiEnabledCheckbox = document.getElementById('aiApiEnabled');
  if (aiApiEnabledCheckbox) {
    aiApiEnabledCheckbox.checked = settings.aiApiEnabled || false;
    aiApiEnabledCheckbox.addEventListener('change', async () => {
      settings.aiApiEnabled = aiApiEnabledCheckbox.checked;
      await chrome.runtime.sendMessage({ action: 'updateSettings', settings });
    });
  }
  
  // 加载AI网页版启用状态
  const aiWebEnabledCheckbox = document.getElementById('aiWebEnabled');
  if (aiWebEnabledCheckbox) {
    aiWebEnabledCheckbox.checked = settings.aiWebPlatforms?.enabled || false;
    aiWebEnabledCheckbox.addEventListener('change', async () => {
      if (!settings.aiWebPlatforms) {
        settings.aiWebPlatforms = { enabled: false, platforms: [] };
      }
      settings.aiWebPlatforms.enabled = aiWebEnabledCheckbox.checked;
      await chrome.runtime.sendMessage({ action: 'updateSettings', settings });
    });
  }
  
  // 加载AI系统设置
  await loadAiSystems(settings.aiSystems);
  
  // 加载AI网页版平台列表
  loadAiWebPlatforms(settings);
}

function initCollapsibleSections(settings) {
  document.querySelectorAll('.collapsible-section').forEach(section => {
    const header = section.querySelector('.section-header');
    const content = section.querySelector('.section-content');
    const icon = section.querySelector('.collapse-icon');
    const sectionName = section.dataset.section;
    
    if (header && content && sectionName) {
      // 加载保存的折叠状态
      const isCollapsed = settings.collapsedSections?.[sectionName] ?? true;
      content.style.display = isCollapsed ? 'none' : 'block';
      if (icon) {
        icon.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
      }
      
      header.addEventListener('click', async (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL') {
          return;
        }
        const currentCollapsed = content.style.display === 'none';
        content.style.display = currentCollapsed ? 'block' : 'none';
        if (icon) {
          icon.style.transform = currentCollapsed ? 'rotate(0deg)' : 'rotate(-90deg)';
        }
        
        // 保存折叠状态
        if (!settings.collapsedSections) {
          settings.collapsedSections = {};
        }
        settings.collapsedSections[sectionName] = !currentCollapsed;
        await chrome.runtime.sendMessage({ action: 'updateSettings', settings });
      });
    }
  });
}

function loadAiWebPlatforms(settings) {
  const container = document.getElementById('aiWebPlatformsList');
  if (!container) return;
  
  container.innerHTML = '';
  
  const aiWebPlatforms = settings.aiWebPlatforms || { enabled: false, platforms: [] };
  const platforms = aiWebPlatforms.platforms || [];
  
  if (platforms.length === 0) {
    platforms.push({
      id: Date.now(),
      name: 'ChatGPT',
      platform: 'chatgpt',
      customUrl: '',
      customInputSelector: '',
      customSubmitSelector: '',
      customResponseSelector: '',
      enabled: true
    });
  }
  
  platforms.forEach((platformConfig, index) => {
    // 获取平台默认配置
    let defaultUrl = '';
    let defaultInputSelector = '';
    let defaultSubmitSelector = '';
    let defaultResponseSelector = '';
    
    // 根据平台类型设置默认值
    if (platformConfig.platform && platformConfig.platform !== 'custom') {
      // 尝试从AI_WEB_PLATFORMS获取默认配置
      if (typeof AI_WEB_PLATFORMS !== 'undefined' && AI_WEB_PLATFORMS[platformConfig.platform]) {
        const defaultConfig = AI_WEB_PLATFORMS[platformConfig.platform];
        defaultUrl = defaultConfig.url || '';
        defaultInputSelector = defaultConfig.inputSelector || '';
        defaultSubmitSelector = defaultConfig.submitSelector || '';
        defaultResponseSelector = defaultConfig.responseSelector || '';
      }
    }
    
    // 确定最终使用的值
    // 1. 如果用户手动设置了值，使用用户设置的值
    // 2. 否则使用最新的默认值
    const urlValue = platformConfig.customUrl && platformConfig.customUrl !== '' ? platformConfig.customUrl : defaultUrl;
    const inputSelectorValue = platformConfig.customInputSelector && platformConfig.customInputSelector !== '' ? platformConfig.customInputSelector : defaultInputSelector;
    const submitSelectorValue = platformConfig.customSubmitSelector && platformConfig.customSubmitSelector !== '' ? platformConfig.customSubmitSelector : defaultSubmitSelector;
    const responseSelectorValue = platformConfig.customResponseSelector && platformConfig.customResponseSelector !== '' ? platformConfig.customResponseSelector : defaultResponseSelector;
    
    // 对值进行HTML转义，防止双引号破坏HTML结构
    const escapeHtml = (str) => {
      return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };
    
    const escapedUrlValue = escapeHtml(urlValue);
    const escapedInputSelectorValue = escapeHtml(inputSelectorValue);
    const escapedSubmitSelectorValue = escapeHtml(submitSelectorValue);
    const escapedResponseSelectorValue = escapeHtml(responseSelectorValue);
    
    const div = document.createElement('div');
    div.className = 'ai-web-platform-item';
    div.style.cssText = 'padding: 16px; border: 1px solid #dee2e6; border-radius: 8px; margin-bottom: 12px; background-color: #ffffff;';
    
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h4 style="margin: 0;">${getTrans('aiWebPlatform', currentInterfaceLanguage)} ${index + 1}</h4>
        <div style="display: flex; align-items: center; gap: 12px;">
          <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
            <input type="checkbox" class="ai-web-platform-enabled" data-index="${index}" ${platformConfig.enabled ? 'checked' : ''} style="width: 16px; height: 16px;">
            <span style="font-size: 14px;" data-i18n="labelEnable">启用</span>
          </label>
          ${platforms.length > 1 ? `<button class="delete-ai-web-platform secondary" data-index="${index}" style="padding: 4px 12px; font-size: 12px;">${getTrans('buttonDelete', currentInterfaceLanguage)}</button>` : ''}
        </div>
      </div>
      
      <div class="form-group">
        <label>${getTrans('labelAiWebPlatform', currentInterfaceLanguage)}</label>
        <select class="ai-web-platform-select" data-index="${index}" style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;">
          <option value="chatgpt" ${platformConfig.platform === 'chatgpt' ? 'selected' : ''}>ChatGPT (chat.openai.com)</option>
          <option value="claude" ${platformConfig.platform === 'claude' ? 'selected' : ''}>Claude (claude.ai)</option>
          <option value="gemini" ${platformConfig.platform === 'gemini' ? 'selected' : ''}>Gemini (gemini.google.com)</option>
          <option value="deepseek" ${platformConfig.platform === 'deepseek' ? 'selected' : ''}>DeepSeek (chat.deepseek.com)</option>
          <option value="custom" ${platformConfig.platform === 'custom' ? 'selected' : ''}>${getTrans('optionCustomPlatform', currentInterfaceLanguage)}</option>
        </select>
      </div>
      
      <div class="custom-ai-web-settings" data-index="${index}">
        <div class="form-group">
          <label>${getTrans('labelCustomUrl', currentInterfaceLanguage)}</label>
          <input type="text" class="ai-web-custom-url" data-index="${index}" value="${escapedUrlValue || ''}" placeholder="https://your-ai-web.com" style="width: calc(100% - 32px);">
        </div>
        <div class="form-group">
          <label>${getTrans('labelInputSelector', currentInterfaceLanguage)}</label>
          <input type="text" class="ai-web-input-selector" data-index="${index}" value="${escapedInputSelectorValue || ''}" placeholder="textarea, div[contenteditable]" style="width: calc(100% - 32px);">
        </div>
        <div class="form-group">
          <label>${getTrans('labelSubmitSelector', currentInterfaceLanguage)}</label>
          <input type="text" class="ai-web-submit-selector" data-index="${index}" value="${escapedSubmitSelectorValue || ''}" placeholder="button[type=submit]" style="width: calc(100% - 32px);">
        </div>
        <div class="form-group">
          <label>${getTrans('labelResponseSelector', currentInterfaceLanguage)}</label>
          <input type="text" class="ai-web-response-selector" data-index="${index}" value="${escapedResponseSelectorValue || ''}" placeholder=".response, .output" style="width: calc(100% - 32px);">
        </div>
      </div>
      
      <div style="margin-top: 12px;">
        <button class="test-ai-web-platform secondary" data-index="${index}" style="padding: 6px 12px; font-size: 13px;">${getTrans('buttonTestAiWeb', currentInterfaceLanguage)}</button>
      </div>
    `;
    
    container.appendChild(div);
  });
  
  // 添加事件监听
  document.querySelectorAll('.ai-web-platform-select').forEach(select => {
    select.addEventListener('change', function() {
      const index = this.dataset.index;
      const selectedPlatform = this.value;
      
      // 获取对应平台的默认配置
      let defaultUrl = '';
      let defaultInputSelector = '';
      let defaultSubmitSelector = '';
      let defaultResponseSelector = '';
      
      if (selectedPlatform !== 'custom' && typeof AI_WEB_PLATFORMS !== 'undefined' && AI_WEB_PLATFORMS[selectedPlatform]) {
        const defaultConfig = AI_WEB_PLATFORMS[selectedPlatform];
        defaultUrl = defaultConfig.url || '';
        defaultInputSelector = defaultConfig.inputSelector || '';
        defaultSubmitSelector = defaultConfig.submitSelector || '';
        defaultResponseSelector = defaultConfig.responseSelector || '';
      }
      
      // 更新输入框的值
      const urlInput = document.querySelector(`.ai-web-custom-url[data-index="${index}"]`);
      const inputSelectorInput = document.querySelector(`.ai-web-input-selector[data-index="${index}"]`);
      const submitSelectorInput = document.querySelector(`.ai-web-submit-selector[data-index="${index}"]`);
      const responseSelectorInput = document.querySelector(`.ai-web-response-selector[data-index="${index}"]`);
      
      if (urlInput) urlInput.value = defaultUrl;
      if (inputSelectorInput) inputSelectorInput.value = defaultInputSelector;
      if (submitSelectorInput) submitSelectorInput.value = defaultSubmitSelector;
      if (responseSelectorInput) responseSelectorInput.value = defaultResponseSelector;
      
      // 自动保存默认值，确保刷新页面后显示一致的配置
      saveAiWebPlatforms();
    });
  });
  
  document.querySelectorAll('.ai-web-platform-enabled, .ai-web-custom-url, .ai-web-input-selector, .ai-web-submit-selector, .ai-web-response-selector').forEach(input => {
    input.addEventListener('change', saveAiWebPlatforms);
    input.addEventListener('input', saveAiWebPlatforms);
  });
  
  document.querySelectorAll('.delete-ai-web-platform').forEach(button => {
    button.addEventListener('click', async function() {
      const index = parseInt(this.dataset.index);
      await deleteAiWebPlatform(index);
    });
  });
  
  document.querySelectorAll('.test-ai-web-platform').forEach(button => {
    button.addEventListener('click', async function() {
      const index = parseInt(this.dataset.index);
      await testAiWebPlatform(index);
    });
  });
}

async function saveAiWebPlatforms() {
  const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
  const settings = response.settings || {};
  
  const platforms = [];
  document.querySelectorAll('.ai-web-platform-item').forEach((item, index) => {
    platforms.push({
      id: Date.now() + index,
      platform: item.querySelector('.ai-web-platform-select')?.value || 'chatgpt',
      customUrl: item.querySelector('.ai-web-custom-url')?.value || '',
      customInputSelector: item.querySelector('.ai-web-input-selector')?.value || '',
      customSubmitSelector: item.querySelector('.ai-web-submit-selector')?.value || '',
      customResponseSelector: item.querySelector('.ai-web-response-selector')?.value || '',
      enabled: item.querySelector('.ai-web-platform-enabled')?.checked ?? true
    });
  });
  
  if (!settings.aiWebPlatforms) {
    settings.aiWebPlatforms = { enabled: false, platforms: [] };
  }
  settings.aiWebPlatforms.platforms = platforms;
  
  await chrome.runtime.sendMessage({ action: 'updateSettings', settings });
}

async function addAiWebPlatform() {
  const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
  const settings = response.settings || {};
  
  if (!settings.aiWebPlatforms) {
    settings.aiWebPlatforms = { enabled: false, platforms: [] };
  }
  
  // 获取默认平台（chatgpt）的默认值
  let defaultUrl = '';
  let defaultInputSelector = '';
  let defaultSubmitSelector = '';
  let defaultResponseSelector = '';
  
  if (typeof AI_WEB_PLATFORMS !== 'undefined' && AI_WEB_PLATFORMS['chatgpt']) {
    const defaultConfig = AI_WEB_PLATFORMS['chatgpt'];
    defaultUrl = defaultConfig.url || '';
    defaultInputSelector = defaultConfig.inputSelector || '';
    defaultSubmitSelector = defaultConfig.submitSelector || '';
    defaultResponseSelector = defaultConfig.responseSelector || '';
  }
  
  settings.aiWebPlatforms.platforms.push({
    id: Date.now(),
    platform: 'chatgpt',
    customUrl: defaultUrl,
    customInputSelector: defaultInputSelector,
    customSubmitSelector: defaultSubmitSelector,
    customResponseSelector: defaultResponseSelector,
    enabled: true
  });
  
  await chrome.runtime.sendMessage({ action: 'updateSettings', settings });
  loadAiWebPlatforms(settings);
  showCustomAlert(getTrans('alertConfigSaved', currentInterfaceLanguage), 'success');
}

async function deleteAiWebPlatform(index) {
  const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
  const settings = response.settings || {};
  
  if (settings.aiWebPlatforms?.platforms) {
    settings.aiWebPlatforms.platforms.splice(index, 1);
    await chrome.runtime.sendMessage({ action: 'updateSettings', settings });
    loadAiWebPlatforms(settings);
  }
}

async function testAiWebPlatform(index) {
  const item = document.querySelectorAll('.ai-web-platform-item')[index];
  if (!item) return;
  
  const platform = item.querySelector('.ai-web-platform-select')?.value || 'chatgpt';
  const customUrl = item.querySelector('.ai-web-custom-url')?.value || '';
  const customInputSelector = item.querySelector('.ai-web-input-selector')?.value || '';
  const customSubmitSelector = item.querySelector('.ai-web-submit-selector')?.value || '';
  const customResponseSelector = item.querySelector('.ai-web-response-selector')?.value || '';
  
  const testContent = getTrans('aiWebTestMessage', currentInterfaceLanguage);
  
  const options = {};
  // 对于所有平台，都使用用户设置的URL和选择器
  if (customUrl) options.customUrl = customUrl;
  if (customInputSelector) options.customInputSelector = customInputSelector;
  if (customSubmitSelector) options.customSubmitSelector = customSubmitSelector;
  if (customResponseSelector) options.customResponseSelector = customResponseSelector;
  
  // 移除旧的测试结果
  const oldResultDiv = item.querySelector('.test-result-div');
  if (oldResultDiv) {
    oldResultDiv.remove();
  }
  
  // 显示测试中提示
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'test-result-div';
  loadingDiv.style.cssText = `
    margin-top: 12px;
    padding: 12px;
    background-color: #f8f9fa;
    border-radius: 8px;
    font-size: 14px;
    color: #0066cc;
  `;
  loadingDiv.textContent = getTrans('aiSystemTesting', currentInterfaceLanguage);
  item.appendChild(loadingDiv);
  
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'startAiWebAutomation',
      platform: platform,
      content: testContent,
      options: options
    });
    
    // 移除加载提示
    if (loadingDiv) {
      loadingDiv.remove();
    }
    
    // 创建测试结果容器
    const testResultDiv = document.createElement('div');
    testResultDiv.className = 'test-result-div';
    testResultDiv.style.cssText = `
      margin-top: 12px;
      padding: 16px;
      background-color: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid ${result.success ? '#28a745' : '#dc3545'};
    `;
    
    if (result.success) {
      // 显示成功结果
      const successHeader = document.createElement('div');
      successHeader.style.cssText = `
        font-weight: bold;
        color: #28a745;
        margin-bottom: 8px;
      `;
      successHeader.textContent = getTrans('aiSystemPingSuccess', currentInterfaceLanguage).replace('{responseTime}', 'OK');
      
      const responseContent = document.createElement('div');
      responseContent.style.cssText = `
        font-family: monospace;
        white-space: pre-wrap;
        word-break: break-all;
        margin-top: 8px;
        line-height: 1.5;
        font-size: 13px;
        max-height: 300px;
        overflow-y: auto;
        padding: 8px;
        background-color: white;
        border-radius: 4px;
        border: 1px solid #dee2e6;
      `;
      responseContent.textContent = getTrans('aiSystemMessageResponse', currentInterfaceLanguage) + '\n' + result.response;
      
      testResultDiv.appendChild(successHeader);
      testResultDiv.appendChild(responseContent);
    } else {
      // 显示错误结果
      const errorHeader = document.createElement('div');
      errorHeader.style.cssText = `
        font-weight: bold;
        color: #dc3545;
        margin-bottom: 8px;
      `;
      errorHeader.textContent = getTrans('aiSystemPingFailed', currentInterfaceLanguage);
      
      const errorContent = document.createElement('div');
      errorContent.style.cssText = `
        font-size: 13px;
        color: #6c757d;
        margin-top: 8px;
      `;
      errorContent.textContent = result.error;
      
      testResultDiv.appendChild(errorHeader);
      testResultDiv.appendChild(errorContent);
    }
    
    item.appendChild(testResultDiv);
  } catch (error) {
    // 移除加载提示
    if (loadingDiv) {
      loadingDiv.remove();
    }
    
    // 显示错误结果
    const testResultDiv = document.createElement('div');
    testResultDiv.className = 'test-result-div';
    testResultDiv.style.cssText = `
      margin-top: 12px;
      padding: 16px;
      background-color: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #dc3545;
    `;
    
    const errorHeader = document.createElement('div');
    errorHeader.style.cssText = `
      font-weight: bold;
      color: #dc3545;
      margin-bottom: 8px;
    `;
    errorHeader.textContent = getTrans('aiSystemPingFailed', currentInterfaceLanguage);
    
    const errorContent = document.createElement('div');
    errorContent.style.cssText = `
      font-size: 13px;
      color: #6c757d;
      margin-top: 8px;
    `;
    errorContent.textContent = error.message;
    
    testResultDiv.appendChild(errorHeader);
    testResultDiv.appendChild(errorContent);
    
    item.appendChild(testResultDiv);
  }
}

/**
 * 加载AI系统设置
 * 从用户设置中获取AI系统数据，并显示在界面上
 * @param {Array} aiSystems - AI系统配置数组
 */
async function loadAiSystems(aiSystems) {
  const container = document.getElementById('aiSystemsList');
  if (!container) return;
  
  container.innerHTML = '';
  
  // 确保aiSystems是数组
  if (!aiSystems) {
    aiSystems = [];
  }
  
  // 如果没有AI系统，添加一个默认的
  if (aiSystems.length === 0) {
    aiSystems.push({
      name: '默认AI系统',
      url: 'https://api.openai.com/v1/chat/completions',
      key: '',
      model: 'gpt-3.5-turbo',
      customModel: ''
    });
  }
  
  aiSystems.forEach((system, index) => {
    const div = document.createElement('div');
    div.className = 'ai-system-item';
    div.innerHTML = `
      <h4>${getTrans('aiSystem', currentInterfaceLanguage)} ${index + 1}</h4>
      <div class="form-group">
        <label>${getTrans('aiSystemName', currentInterfaceLanguage)}</label>
        <input type="text" class="ai-system-name" data-index="${index}" value="${system.name || ''}" placeholder="${getTrans('aiSystemName', currentInterfaceLanguage)}">
      </div>
      <div class="form-group">
        <label>${getTrans('aiSystemUrl', currentInterfaceLanguage)}</label>
        <input type="text" class="ai-system-url" data-index="${index}" value="${system.url || ''}" placeholder="https://api.openai.com/v1/chat/completions">
      </div>
      <div class="form-group">
        <label>${getTrans('aiSystemKey', currentInterfaceLanguage)}</label>
        <input type="password" class="ai-system-key" data-index="${index}" value="${system.key || ''}" placeholder="sk-...">
      </div>
      <div class="form-group">
        <label>${getTrans('aiSystemModel', currentInterfaceLanguage)}</label>
        <select class="ai-system-model" data-index="${index}" style="max-height: 150px; overflow-y: auto;">
          <option value="gpt-3.5-turbo" ${system.model === 'gpt-3.5-turbo' ? 'selected' : ''}>${getTrans('modelGpt35Turbo', currentInterfaceLanguage)}</option>
          <option value="gpt-3.5-turbo-16k" ${system.model === 'gpt-3.5-turbo-16k' ? 'selected' : ''}>${getTrans('modelGpt35Turbo16k', currentInterfaceLanguage)}</option>
          <option value="gpt-4" ${system.model === 'gpt-4' ? 'selected' : ''}>${getTrans('modelGpt4', currentInterfaceLanguage)}</option>
          <option value="gpt-4-turbo" ${system.model === 'gpt-4-turbo' ? 'selected' : ''}>${getTrans('modelGpt4Turbo', currentInterfaceLanguage)}</option>
          <option value="gpt-4o" ${system.model === 'gpt-4o' ? 'selected' : ''}>${getTrans('modelGpt4o', currentInterfaceLanguage)}</option>
          <option value="gpt-4o-mini" ${system.model === 'gpt-4o-mini' ? 'selected' : ''}>${getTrans('modelGpt4oMini', currentInterfaceLanguage)}</option>
          <option value="claude-3-opus-20240229" ${system.model === 'claude-3-opus-20240229' ? 'selected' : ''}>${getTrans('modelClaude3Opus', currentInterfaceLanguage)}</option>
          <option value="claude-3-sonnet-20240229" ${system.model === 'claude-3-sonnet-20240229' ? 'selected' : ''}>${getTrans('modelClaude3Sonnet', currentInterfaceLanguage)}</option>
          <option value="claude-3-haiku-20240307" ${system.model === 'claude-3-haiku-20240307' ? 'selected' : ''}>${getTrans('modelClaude3Haiku', currentInterfaceLanguage)}</option>
          <option value="gemini-1.5-pro" ${system.model === 'gemini-1.5-pro' ? 'selected' : ''}>${getTrans('modelGemini15Pro', currentInterfaceLanguage)}</option>
          <option value="gemini-1.5-flash" ${system.model === 'gemini-1.5-flash' ? 'selected' : ''}>${getTrans('modelGemini15Flash', currentInterfaceLanguage)}</option>
          <option value="deepseek-chat" ${system.model === 'deepseek-chat' ? 'selected' : ''}>${getTrans('modelDeepseekChat', currentInterfaceLanguage)}</option>
          <option value="deepseek-chat-v1.5" ${system.model === 'deepseek-chat-v1.5' ? 'selected' : ''}>${getTrans('modelDeepseekChatV15', currentInterfaceLanguage)}</option>
          <option value="doubao-pro-1.0" ${system.model === 'doubao-pro-1.0' ? 'selected' : ''}>${getTrans('modelDoubaoPro10', currentInterfaceLanguage)}</option>
          <option value="doubao-1.5-pro" ${system.model === 'doubao-1.5-pro' ? 'selected' : ''}>${getTrans('modelDoubao15Pro', currentInterfaceLanguage)}</option>
          <option value="qwen-turbo" ${system.model === 'qwen-turbo' ? 'selected' : ''}>${getTrans('modelQwenTurbo', currentInterfaceLanguage)}</option>
          <option value="qwen-plus" ${system.model === 'qwen-plus' ? 'selected' : ''}>${getTrans('modelQwenPlus', currentInterfaceLanguage)}</option>
          <option value="qwen-max" ${system.model === 'qwen-max' ? 'selected' : ''}>${getTrans('modelQwenMax', currentInterfaceLanguage)}</option>
          <option value="ernie-bot" ${system.model === 'ernie-bot' ? 'selected' : ''}>${getTrans('modelErnieBot', currentInterfaceLanguage)}</option>
          <option value="ernie-bot-turbo" ${system.model === 'ernie-bot-turbo' ? 'selected' : ''}>${getTrans('modelErnieBotTurbo', currentInterfaceLanguage)}</option>
          <option value="glm-3-turbo" ${system.model === 'glm-3-turbo' ? 'selected' : ''}>${getTrans('modelGlm3Turbo', currentInterfaceLanguage)}</option>
          <option value="glm-4" ${system.model === 'glm-4' ? 'selected' : ''}>${getTrans('modelGlm4', currentInterfaceLanguage)}</option>
          <option value="glm-4v" ${system.model === 'glm-4v' ? 'selected' : ''}>${getTrans('modelGlm4v', currentInterfaceLanguage)}</option>
          <option value="glm-4-0520" ${system.model === 'glm-4-0520' ? 'selected' : ''}>${getTrans('modelGlm40520', currentInterfaceLanguage)}</option>
          <option value="custom" ${system.model === 'custom' ? 'selected' : ''}>${getTrans('aiSystemCustomModel', currentInterfaceLanguage)}</option>
        </select>
      </div>
      <div class="form-group custom-model-group" style="${system.model === 'custom' ? '' : 'display: none;'}">
        <label>${getTrans('aiSystemCustomModel', currentInterfaceLanguage)}</label>
        <input type="text" class="ai-system-custom-model" data-index="${index}" value="${system.customModel || ''}" placeholder="${getTrans('aiSystemCustomModel', currentInterfaceLanguage)}">
      </div>
      
      <!-- 测试功能 -->
      <div class="form-group" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #dee2e6;">
        <h5 style="margin-bottom: 12px; color: #0066cc;">${getTrans('aiSystemTest', currentInterfaceLanguage)}</h5>
        <div style="display: flex; gap: 10px; margin-bottom: 12px;">
          <button class="test-ai-ping" data-index="${index}" style="flex: 1;">${getTrans('aiSystemPing', currentInterfaceLanguage)}</button>
        </div>
        <div style="display: flex; gap: 10px; margin-bottom: 12px;">
          <input type="text" class="test-message-input" data-index="${index}" placeholder="${getTrans('aiSystemSendMessage', currentInterfaceLanguage)}" style="flex: 1; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;">
          <button class="test-ai-message" data-index="${index}" style="padding: 0 16px;">${getTrans('buttonSend', currentInterfaceLanguage)}</button>
        </div>
        <div class="test-result" data-index="${index}" style="margin-top: 12px; padding: 12px; background-color: #f8f9fa; border-radius: 8px; min-height: 60px; display: none;">
          <div style="font-size: 14px; color: #6c757d;">${getTrans('aiSystemTestResult', currentInterfaceLanguage)}</div>
          <div class="test-result-content" style="margin-top: 8px; font-family: monospace; white-space: pre-wrap; word-break: break-all;"></div>
        </div>
      </div>
      
      <button class="delete-ai-system secondary" data-index="${index}" style="margin-top: 10px;">${getTrans('buttonDelete', currentInterfaceLanguage)}</button>
    `;
    container.appendChild(div);
  });
  
  // 添加模型选择事件监听
    document.querySelectorAll('.ai-system-model').forEach(select => {
      select.addEventListener('change', function() {
        const index = this.dataset.index;
        const customModelGroup = document.querySelector(`.custom-model-group input[data-index="${index}"]`).parentElement;
        if (this.value === 'custom') {
          customModelGroup.style.display = 'block';
        } else {
          customModelGroup.style.display = 'none';
        }
        // 自动保存设置
        saveSettings().then((success) => {
          // 显示保存成功提示
          if (success) {
            showCustomAlert(getTrans('alertSettingsSaved', currentInterfaceLanguage), 'success');
          }
        });
      });
    });
    
    // 添加输入框和选择框的自动保存事件
    document.querySelectorAll('.ai-system-name, .ai-system-url, .ai-system-key, .ai-system-custom-model').forEach(input => {
      input.addEventListener('input', function() {
        // 自动保存设置
        saveSettings().then((success) => {
          // 显示保存成功提示
          if (success) {
            showCustomAlert(getTrans('alertSettingsSaved', currentInterfaceLanguage), 'success');
          }
        });
      });
    });
    
    // 添加删除按钮事件
    document.querySelectorAll('.delete-ai-system').forEach(button => {
      button.addEventListener('click', async function() {
        const index = parseInt(this.dataset.index);
        await deleteAiSystem(index);
      });
    });
    
    // 添加测试功能事件
    document.querySelectorAll('.test-ai-ping').forEach(button => {
      button.addEventListener('click', async function() {
        const index = parseInt(this.dataset.index);
        await testAiPing(index);
      });
    });
    
    document.querySelectorAll('.test-ai-message').forEach(button => {
      button.addEventListener('click', async function() {
        const index = parseInt(this.dataset.index);
        await testAiMessage(index);
      });
    });
}

/**
 * 测试AI系统连接
 * 向AI系统发送ping请求，测试连接是否正常
 * @param {number} index - AI系统的索引
 */
async function testAiPing(index) {
  const aiSystemItem = document.querySelector(`.ai-system-item:nth-child(${index + 1})`);
  const testResultDiv = aiSystemItem.querySelector('.test-result');
  const testResultContent = testResultDiv.querySelector('.test-result-content');
  
  // 获取当前语言设置
  const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
  const currentInterfaceLanguage = response.settings.interfaceLanguage;
  
  // 显示测试结果区域
  testResultDiv.style.display = 'block';
  testResultContent.textContent = getTrans('aiSystemTesting', currentInterfaceLanguage);
  
  try {
    const settings = response.settings;
    const aiSystem = settings.aiSystems[index];
    
    // 发送ping请求到后台
    const pingResponse = await chrome.runtime.sendMessage({
      action: 'testAiSystem',
      type: 'ping',
      aiSystem: aiSystem
    });
    
    if (pingResponse.success) {
      testResultContent.textContent = getTrans('aiSystemPingSuccess', currentInterfaceLanguage).replace('{responseTime}', pingResponse.responseTime);
      testResultDiv.style.backgroundColor = '#e3f2fd';
    } else {
      testResultContent.textContent = getTrans('aiSystemPingFailed', currentInterfaceLanguage).replace('{error}', pingResponse.error);
      testResultDiv.style.backgroundColor = '#ffebee';
    }
  } catch (error) {
    testResultContent.textContent = getTrans('aiSystemTestFailed', currentInterfaceLanguage).replace('{error}', error.message);
    testResultDiv.style.backgroundColor = '#ffebee';
  }
}

/**
 * 测试AI系统消息
 * 向AI系统发送测试消息，获取回复
 * @param {number} index - AI系统的索引
 */
async function testAiMessage(index) {
  const aiSystemItem = document.querySelector(`.ai-system-item:nth-child(${index + 1})`);
  const testResultDiv = aiSystemItem.querySelector('.test-result');
  const testResultContent = testResultDiv.querySelector('.test-result-content');
  const testMessageInput = aiSystemItem.querySelector('.test-message-input');
  
  // 获取当前语言设置
  const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
  const currentInterfaceLanguage = response.settings.interfaceLanguage;
  
  // 获取用户输入的测试消息
  const testMessage = testMessageInput.value.trim();
  if (!testMessage) {
    testResultDiv.style.display = 'block';
    testResultContent.textContent = getTrans('aiSystemTestMessageEmpty', currentInterfaceLanguage);
    testResultDiv.style.backgroundColor = '#fff3cd';
    return;
  }
  
  // 显示测试结果区域
  testResultDiv.style.display = 'block';
  testResultContent.textContent = getTrans('aiSystemSendingMessage', currentInterfaceLanguage);
  
  try {
    const settings = response.settings;
    const aiSystem = settings.aiSystems[index];
    
    // 发送测试消息到后台
    const messageResponse = await chrome.runtime.sendMessage({
      action: 'testAiSystem',
      type: 'message',
      aiSystem: aiSystem,
      message: testMessage
    });
    
    if (messageResponse.success) {
      // 确保回复内容完整显示
      testResultContent.style.whiteSpace = 'pre-wrap';
      testResultContent.style.wordBreak = 'break-word';
      testResultContent.textContent = getTrans('aiSystemMessageResponse', currentInterfaceLanguage) + '\n' + messageResponse.response;
      testResultDiv.style.backgroundColor = '#e3f2fd';
    } else {
      testResultContent.textContent = getTrans('aiSystemMessageFailed', currentInterfaceLanguage).replace('{error}', messageResponse.error);
      testResultDiv.style.backgroundColor = '#ffebee';
    }
  } catch (error) {
    testResultContent.textContent = getTrans('aiSystemTestFailed', currentInterfaceLanguage).replace('{error}', error.message);
    testResultDiv.style.backgroundColor = '#ffebee';
  }
}

/**
 * 删除AI系统
 * 根据索引从用户设置中删除指定的AI系统
 * @param {number} index - 要删除的AI系统的索引
 */
async function deleteAiSystem(index) {
  const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
  const settings = response.settings;
  
  if (settings.aiSystems && settings.aiSystems.length > 1) {
    settings.aiSystems.splice(index, 1);
    await chrome.runtime.sendMessage({ action: 'updateSettings', settings });
    await loadAiSystems(settings.aiSystems);
    showCustomAlert('AI系统已删除', 'success');
  } else {
    showCustomAlert('至少保留一个AI系统', 'error');
  }
}

/**
 * 添加AI系统
 * 向用户设置中添加一个新的AI系统配置
 */
async function addAiSystem() {
  const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
  const settings = response.settings;
  
  if (!settings.aiSystems) {
    settings.aiSystems = [];
  }
  
  settings.aiSystems.push({
    name: `AI系统 ${settings.aiSystems.length + 1}`,
    url: '',
    key: '',
    model: 'gpt-3.5-turbo',
    customModel: ''
  });
  
  await chrome.runtime.sendMessage({ action: 'updateSettings', settings });
  await loadAiSystems(settings.aiSystems);
  showCustomAlert('AI系统已添加', 'success');
}

/**
 * 保存AI系统设置
 * 从界面收集AI系统配置数据并保存到用户设置
 */
async function saveAiSystems() {
  const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
  const settings = response.settings || {};
  
  const aiSystems = [];
  document.querySelectorAll('.ai-system-item').forEach((item, index) => {
    aiSystems.push({
      name: item.querySelector('.ai-system-name').value,
      url: item.querySelector('.ai-system-url').value,
      key: item.querySelector('.ai-system-key').value,
      model: item.querySelector('.ai-system-model').value,
      customModel: item.querySelector('.ai-system-custom-model')?.value || ''
    });
  });
  
  settings.aiSystems = aiSystems;
  await chrome.runtime.sendMessage({ action: 'updateSettings', settings });
}

/**
 * 加载爬取结果
 * 从后台获取爬取结果数据，并显示在界面上
 */
async function loadCrawlResults() {
  const response = await chrome.runtime.sendMessage({ action: 'getCrawlResults' });
  const results = response.results;
  
  const container = document.getElementById('crawlResultsContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (results && results.length > 0) {
    results.forEach(result => {
      const div = document.createElement('div');
      div.className = 'crawl-result-item';
      div.innerHTML = `
        <h4>r/${result.name}</h4>
        <p>${result.posts.length} 个帖子</p>
      `;
      container.appendChild(div);
    });
  } else {
    container.innerHTML = '<p style="color: #757575;">暂无分析结果</p>';
  }
}

/**
 * 保存设置
 * 保存AI系统设置和语言设置到本地存储
 * @returns {Promise<boolean>} - 保存是否成功
 */
async function saveSettings() {
  // 获取当前设置
  const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
  const settings = response.settings || {};
  
  // 保存AI系统设置
  await saveAiSystems();
  
  // 获取语言设置
  const interfaceLanguage = document.getElementById('interfaceLanguage')?.value || 
                           document.getElementById('settings-interfaceLanguage')?.value || 'zh';
  
  // 更新语言设置
  settings.interfaceLanguage = interfaceLanguage;
  
  // 更新全局语言变量
  currentInterfaceLanguage = interfaceLanguage;
  
  // 发送更新设置请求
  const updateResponse = await chrome.runtime.sendMessage({ action: 'updateSettings', settings });
  if (updateResponse.success) {
    return true;
  }
  return false;
}

/**
 * 更新界面语言
 * 根据当前界面语言设置更新所有文本内容
 */
function updateInterfaceLanguage() {
  // 更新所有带有data-i18n属性的元素
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.dataset.i18n;
    const translation = getTrans(key, currentInterfaceLanguage);
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      element.placeholder = translation;
    } else {
      element.textContent = translation;
    }
  });
  
  // 更新所有带有data-i18n-placeholder属性的输入框的占位符
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.dataset.i18nPlaceholder;
    const translation = getTrans(key, currentInterfaceLanguage);
    element.placeholder = translation;
  });
  
  // 更新自定义板块列表中的"暂无自定义板块"文本
  const customSubredditsList = document.getElementById('customSubredditsList');
  if (customSubredditsList && customSubredditsList.querySelector('p')) {
    customSubredditsList.innerHTML = `<p style="color: #757575; font-size: 14px;">${getTrans('noCustomSubreddits', currentInterfaceLanguage)}</p>`;
  }
  
  // 重新加载板块列表，以更新板块描述的语言
  loadSubreddits();
  loadCustomSubreddits();
  
  // 更新插件介绍
  loadPluginDescription();
}

/**
 * 设置事件监听器
 * 为界面上的按钮和表单元素添加事件处理
 */
function setupEventListeners() {
  // 全选按钮
  const selectAllButton = document.getElementById('selectAllSubreddits');
  if (selectAllButton) {
    selectAllButton.addEventListener('click', async () => {
      // 选中所有板块
      document.querySelectorAll('#subredditList input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = true;
      });
      document.querySelectorAll('#customSubredditsList input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = true;
      });
      
      // 自动保存配置
      await saveConfig();
    });
  }
  
  // 取消全选按钮
  const deselectAllButton = document.getElementById('deselectAllSubreddits');
  if (deselectAllButton) {
    deselectAllButton.addEventListener('click', async () => {
      // 取消选中所有板块
      document.querySelectorAll('#subredditList input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
      });
      document.querySelectorAll('#customSubredditsList input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
      });
      
      // 自动保存配置
      await saveConfig();
    });
  }
  
  // 保存配置按钮
  const saveConfigButton = document.getElementById('saveConfig');
  if (saveConfigButton) {
    saveConfigButton.addEventListener('click', async () => {
      await saveConfig();
    });
  }
  
  // 保存配置函数
  async function saveConfig() {
    const maxPosts = parseInt(document.getElementById('maxPosts').value);
    const maxComments = parseInt(document.getElementById('maxComments').value);
    const depth = parseInt(document.getElementById('depth').value);
    const minSubscribers = parseInt(document.getElementById('minSubscribers').value);
    
    // 获取选中的板块
    const selectedSubreddits = [];
    document.querySelectorAll('#subredditList input[type="checkbox"]:checked').forEach(checkbox => {
      selectedSubreddits.push(checkbox.value);
    });
    document.querySelectorAll('#customSubredditsList input[type="checkbox"]:checked').forEach(checkbox => {
      selectedSubreddits.push(checkbox.value);
    });
    
    const config = {
      maxPosts,
      maxComments,
      depth,
      minSubscribers,
      selectedSubreddits
    };
    
    const response = await chrome.runtime.sendMessage({ action: 'updateConfig', config });
    if (response.success) {
      showCustomAlert(getTrans('alertConfigSaved', currentInterfaceLanguage), 'success');
    }
  }
  
  // 保存设置按钮
  const saveSettingsButton = document.getElementById('saveSettings');
  if (saveSettingsButton) {
    saveSettingsButton.addEventListener('click', async () => {
      const success = await saveSettings();
      if (success) {
        showCustomAlert(getTrans('alertSettingsSaved', currentInterfaceLanguage), 'success');
        updateInterfaceLanguage();
      }
    });
  }
  
  // 添加AI系统按钮
  const addAiSystemButton = document.getElementById('addAiSystem');
  if (addAiSystemButton) {
    addAiSystemButton.addEventListener('click', addAiSystem);
  }
  
  // 添加AI网页版平台按钮
  const addAiWebPlatformButton = document.getElementById('addAiWebPlatform');
  if (addAiWebPlatformButton) {
    addAiWebPlatformButton.addEventListener('click', addAiWebPlatform);
  }
  
  // 分析选中板块按钮
  const crawlSelectedButton = document.getElementById('crawlSelected');
  if (crawlSelectedButton) {
    crawlSelectedButton.addEventListener('click', async () => {
      const selectedSubreddits = [];
      document.querySelectorAll('#subredditList input[type="checkbox"]:checked').forEach(checkbox => {
        selectedSubreddits.push(checkbox.value);
      });
      document.querySelectorAll('#customSubredditsList input[type="checkbox"]:checked').forEach(checkbox => {
        selectedSubreddits.push(checkbox.value);
      });
      
      if (selectedSubreddits.length === 0) {
        showCustomAlert(getTrans('messageNoSubredditsSelected', currentInterfaceLanguage), 'error');
        return;
      }
      
      // 显示加载状态
      const resultSection = document.getElementById('resultSection');
      const resultContent = document.getElementById('resultContent');
      resultSection.style.display = 'block';
      resultContent.innerHTML = '<div style="text-align: center; padding: 20px;"><div class="loading"></div><p style="margin-top: 10px;">正在爬取，请稍候...</p></div>';
      
      // 发送消息给background开始爬取
      chrome.runtime.sendMessage({
        action: 'startCrawl',
        type: 'selected'
      });
    });
  }
  
  // 分析所有板块按钮
  const crawlAllButton = document.getElementById('crawlAll');
  if (crawlAllButton) {
    crawlAllButton.addEventListener('click', () => {
      // 显示加载状态
      const resultSection = document.getElementById('resultSection');
      const resultContent = document.getElementById('resultContent');
      resultSection.style.display = 'block';
      resultContent.innerHTML = '<div style="text-align: center; padding: 20px;"><div class="loading"></div><p style="margin-top: 10px;">正在爬取，请稍候...</p></div>';
      
      // 发送消息给background开始爬取
      chrome.runtime.sendMessage({
        action: 'startCrawl',
        type: 'all'
      });
    });
  }
  
  // 监听后台发送的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateProgress') {
      const resultSection = document.getElementById('resultSection');
      const resultContent = document.getElementById('resultContent');
      resultSection.style.display = 'block';
      resultContent.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <div class="loading"></div>
          <p style="margin-top: 10px;">${message.message}</p>
          <div class="progress-bar" style="width: 100%; height: 10px; background-color: #ddd; border-radius: 5px; margin-top: 10px;">
            <div style="width: ${Math.round((message.current / message.total) * 100)}%; height: 100%; background-color: #4caf50; border-radius: 5px;"></div>
          </div>
          <p style="margin-top: 5px;">进度: ${message.current}/${message.total}</p>
        </div>
      `;
    } else if (message.action === 'crawlComplete') {
      const resultSection = document.getElementById('resultSection');
      const resultContent = document.getElementById('resultContent');
      resultSection.style.display = 'block';
      resultContent.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 6L9 17L4 12" stroke="#4caf50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p style="margin-top: 10px; font-size: 18px; font-weight: 600;">爬取完成</p>
          <p style="margin-top: 5px;">共爬取 ${message.totalPosts} 个帖子</p>
          <button id="viewResults" style="margin-top: 20px; padding: 10px 20px; background-color: #0066cc; color: white; border: none; border-radius: 5px; cursor: pointer;">查看结果</button>
        </div>
      `;
      
      // 绑定查看结果按钮事件
      document.getElementById('viewResults').addEventListener('click', () => {
        chrome.runtime.sendMessage({
          action: 'openCrawlResults'
        });
      });
    } else if (message.action === 'crawlError') {
      const resultSection = document.getElementById('resultSection');
      const resultContent = document.getElementById('resultContent');
      resultSection.style.display = 'block';
      resultContent.innerHTML = `
        <div style="text-align: center; padding: 20px; color: red;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#f44336" stroke-width="2"/>
            <path d="M15 9L9 15M9 9L15 15" stroke="#f44336" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <p style="margin-top: 10px; font-size: 18px; font-weight: 600;">爬取失败</p>
          <p style="margin-top: 5px;">${message.error}</p>
        </div>
      `;
    }
  });
  
  // 查看分析结果按钮
  const openResultsButton = document.getElementById('openResults');
  if (openResultsButton) {
    openResultsButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        action: 'openCrawlResults'
      });
    });
  }
  
  // 添加自定义板块按钮
  const addCustomSubredditButton = document.getElementById('addCustomSubreddit');
  if (addCustomSubredditButton) {
    addCustomSubredditButton.addEventListener('click', addCustomSubreddit);
  }
  
  // 恢复默认板块按钮 - 已移除
  /*
  const restoreDefaultButton = document.getElementById('restoreDefaultSubreddits');
  if (restoreDefaultButton) {
    restoreDefaultButton.addEventListener('click', restoreDefaultSubreddits);
  }
  */
  
  // 语言选择同步
  const targetLanguageSelects = document.querySelectorAll('select[id$="targetLanguage"]');
  targetLanguageSelects.forEach(select => {
    select.addEventListener('change', (e) => {
      targetLanguageSelects.forEach(s => s.value = e.target.value);
    });
  });
  
  const interfaceLanguageSelects = document.querySelectorAll('select[id$="interfaceLanguage"]');
  interfaceLanguageSelects.forEach(select => {
    select.addEventListener('change', async (e) => {
      const newLanguage = e.target.value;
      // 同步所有语言选择器的值
      interfaceLanguageSelects.forEach(s => s.value = newLanguage);
      // 同步翻译语言选择器的值
      const targetLanguageSelects = document.querySelectorAll('select[id$="targetLanguage"]');
      targetLanguageSelects.forEach(s => s.value = newLanguage);
      // 更新界面语言
      currentInterfaceLanguage = newLanguage;
      updateInterfaceLanguage();
      
      // 保存语言设置到本地存储
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      const settings = response.settings;
      settings.interfaceLanguage = newLanguage;
      settings.targetLanguage = newLanguage;
      await chrome.runtime.sendMessage({ action: 'updateSettings', settings });
      
      // 重新加载AI系统设置，确保动态生成的元素使用新的语言
      await loadAiSystems(settings.aiSystems);
      // 重新加载AI网页版平台设置，确保动态生成的元素使用新的语言
      loadAiWebPlatforms(settings);
      
      // 向所有打开的标签页发送语言变化消息
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.url && tab.url.includes('chrome-extension://')) {
            chrome.tabs.sendMessage(tab.id, { action: 'languageChanged' }).catch(() => {
              // 忽略发送失败的情况（可能是非扩展页面）
            });
          }
        });
      });
    });
  });
}

/**
 * 同步语言设置
 * 确保所有标签页中的语言选择器保持同步
 */
async function syncLanguageSettings() {
  // 从本地存储获取最新的设置
  const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
  const settings = response.settings;
  const targetLanguage = settings.targetLanguage || 'zh';
  const interfaceLanguage = settings.interfaceLanguage || 'zh';
  
  // 同步所有语言选择器
  document.querySelectorAll('select[id$="targetLanguage"]').forEach(select => {
    select.value = targetLanguage;
  });
  document.querySelectorAll('select[id$="interfaceLanguage"]').forEach(select => {
    select.value = interfaceLanguage;
  });
}

/**
 * 设置自动保存配置
 * 为板块选择复选框添加自动保存功能
 */
function setupAutoSaveConfig() {
  // 为默认板块的复选框添加自动保存功能
  document.querySelectorAll('#subredditList input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', async () => {
      const selectedSubreddits = [];
      document.querySelectorAll('#subredditList input[type="checkbox"]:checked').forEach(cb => {
        selectedSubreddits.push(cb.value);
      });
      document.querySelectorAll('#customSubredditsList input[type="checkbox"]:checked').forEach(cb => {
        selectedSubreddits.push(cb.value);
      });
      
      const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
      const config = response.config;
      config.selectedSubreddits = selectedSubreddits;
      await chrome.runtime.sendMessage({ action: 'updateConfig', config });
      
      // 显示保存成功提示
      showCustomAlert(getTrans('alertConfigSaved', currentInterfaceLanguage), 'success');
    });
  });
  
  // 为自定义板块的复选框添加自动保存功能
  document.querySelectorAll('#customSubredditsList input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', async () => {
      const selectedSubreddits = [];
      document.querySelectorAll('#subredditList input[type="checkbox"]:checked').forEach(cb => {
        selectedSubreddits.push(cb.value);
      });
      document.querySelectorAll('#customSubredditsList input[type="checkbox"]:checked').forEach(cb => {
        selectedSubreddits.push(cb.value);
      });
      
      const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
      const config = response.config;
      config.selectedSubreddits = selectedSubreddits;
      await chrome.runtime.sendMessage({ action: 'updateConfig', config });
      
      // 显示保存成功提示
      showCustomAlert(getTrans('alertConfigSaved', currentInterfaceLanguage), 'success');
    });
  });
  
  // 为配置字段添加自动保存功能
  const configFields = ['maxPosts', 'maxComments', 'depth', 'minSubscribers', 'includeComments', 'commentLimit'];
  configFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('change', async () => {
        const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
        const config = response.config;
        
        if (fieldId === 'includeComments') {
          config[fieldId] = field.checked;
        } else {
          config[fieldId] = parseInt(field.value);
        }
        
        await chrome.runtime.sendMessage({ action: 'updateConfig', config });
        
        // 显示保存成功提示
        showCustomAlert(getTrans('alertConfigSaved', currentInterfaceLanguage), 'success');
      });
    }
  });
}

/**
 * 显示自定义提示
 * 在界面上显示一个自定义的提示信息
 * @param {string} message - 提示信息内容
 * @param {string} type - 提示类型（'success' 或 'error'）
 */
function showCustomAlert(message, type = 'success') {
  // 移除已存在的提示
  const existingAlert = document.querySelector('.custom-alert');
  if (existingAlert) {
    existingAlert.remove();
  }
  
  const alert = document.createElement('div');
  alert.className = `custom-alert ${type}`;
  alert.textContent = message;
  alert.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    border-radius: 4px;
    font-size: 14px;
    z-index: 10000;
    animation: slideDown 0.3s ease;
    background-color: ${type === 'success' ? '#4caf50' : '#f44336'};
    color: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;
  
  document.body.appendChild(alert);
  
  setTimeout(() => {
    alert.style.animation = 'slideUp 0.3s ease';
    setTimeout(() => alert.remove(), 300);
  }, 3000);
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translate(-50%, -20px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }
  @keyframes slideUp {
    from {
      opacity: 1;
      transform: translate(-50%, 0);
    }
    to {
      opacity: 0;
      transform: translate(-50%, -20px);
    }
  }
`;
document.head.appendChild(style);
