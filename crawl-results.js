// 获取当前语言
let currentLang = null;

// 加载设置
async function loadSettings() {
  try {
    // 通过消息传递获取设置，与popup.js保持一致
    chrome.runtime.sendMessage({ action: 'getSettings' }, function(response) {
      if (response && response.settings && response.settings.interfaceLanguage) {
        currentLang = response.settings.interfaceLanguage;
      } else {
        // 如果没有保存的设置，使用浏览器语言检测
        const browserLang = navigator.language || navigator.userLanguage || 'en';
        const langCode = browserLang.split('-')[0].toLowerCase();
        const supportedLangs = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru'];
        currentLang = supportedLangs.includes(langCode) ? langCode : 'en';
      }
      updateTranslations();
    });
  } catch (error) {
    // 出错时使用浏览器语言检测
    const browserLang = navigator.language || navigator.userLanguage || 'en';
    const langCode = browserLang.split('-')[0].toLowerCase();
    const supportedLangs = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru'];
    currentLang = supportedLangs.includes(langCode) ? langCode : 'en';
    updateTranslations();
  }
}


// 更新翻译
function updateTranslations() {
  // 使用i18n.js提供的getTranslation函数
  const getTrans = self.getTranslation || function(key, lang) { return key; };
  const useLang = currentLang || 'en';
  
  // 更新页面标题
  document.getElementById('pageTitle').textContent = getTrans('title', useLang);
  
  // 更新应用名称
  document.getElementById('appName').textContent = getTrans('appName', useLang) || '灵感';
  
  // 更新初始状态
  document.getElementById('statusMessage').textContent = getTrans('preparing', useLang);
  document.getElementById('progressDetails').textContent = `0/0 ${getTrans('subreddits', useLang)}`;
}

// 翻译函数
function t(key, params = {}) {
  const getTrans = self.getTranslation || function(key, lang) { return key; };
  const useLang = currentLang || 'en';
  let text = getTrans(key, useLang) || key;
  
  // 替换参数
  for (const [key, value] of Object.entries(params)) {
    text = text.replace(`{{${key}}}`, value);
  }
  
  return text;
}

// 页面加载完成后初始化
window.addEventListener('load', async () => {
  // 加载设置
  await loadSettings();
  
  // 检查爬取状态
  await checkCrawlState();
  
  // 加载已有的爬取结果
  await loadExistingResults();
  
  // 确保翻译按钮显示
  ensureTranslateButton();
});

// 确保翻译按钮显示
function ensureTranslateButton() {
  try {
    // 检查是否已经有翻译图标和切换图标
    const existingTranslateIcon = document.getElementById('translateIcon');
    const existingToggleIcon = document.getElementById('toggleOriginalIcon');
    
    if (!existingTranslateIcon || !existingToggleIcon) {
      // 获取标题元素
      const titleElement = document.querySelector('h1');
      if (titleElement) {
        // 设置标题元素为相对定位
        titleElement.style.position = 'relative';
        
        // 创建切换原文/翻译图标
        if (!existingToggleIcon) {
          const toggleIcon = document.createElement('div');
          toggleIcon.id = 'toggleOriginalIcon';
          toggleIcon.style.cssText = `
            cursor: pointer;
            transition: all 0.3s ease;
            position: absolute;
            right: 140px;
            top: 50%;
            transform: translateY(-50%);
            filter: drop-shadow(0 0 3px rgba(0, 102, 204, 0.8));
          `;
          toggleIcon.innerHTML = `
            <span style="font-size: 24px; line-height: 1;">🔄</span>
          `;
          
          // 添加鼠标悬停提示
          toggleIcon.title = t('showOriginal') || '显示原文';
          
          // 添加点击事件
          toggleIcon.onclick = toggleOriginalView;
          
          // 添加悬停效果
          toggleIcon.style.transition = 'all 0.3s ease';
          toggleIcon.onmouseover = () => {
            toggleIcon.style.transform = 'translateY(-50%) scale(1.1)';
          };
          toggleIcon.onmouseout = () => {
            toggleIcon.style.transform = 'translateY(-50%) scale(1)';
          };
          
          // 添加到标题元素中
          titleElement.appendChild(toggleIcon);
        }
        
        // 创建翻译图标
        if (!existingTranslateIcon) {
          const translateIcon = document.createElement('div');
          translateIcon.id = 'translateIcon';
          translateIcon.style.cssText = `
            cursor: pointer;
            transition: all 0.3s ease;
            position: absolute;
            right: 100px;
            top: 50%;
            transform: translateY(-50%);
            filter: drop-shadow(0 0 3px rgba(0, 102, 204, 0.8));
          `;
          translateIcon.innerHTML = `
            <span style="font-size: 32px; line-height: 1;">🌐</span>
          `;
          
          // 添加鼠标悬停提示
          translateIcon.title = t('translateAll') || '翻译所有';
          
          // 添加点击事件
          translateIcon.onclick = () => {
            translateAllPosts();
          };
          
          // 添加悬停效果
          translateIcon.style.transition = 'all 0.3s ease';
          translateIcon.onmouseover = () => {
            translateIcon.style.transform = 'translateY(-50%) scale(1.1)';
          };
          translateIcon.onmouseout = () => {
            translateIcon.style.transform = 'translateY(-50%) scale(1)';
          };
          
          // 添加到标题元素中
          titleElement.appendChild(translateIcon);
        }
      }
    }
  } catch (error) {
  }
}

// 全局变量：是否显示原文
let showOriginalGlobal = false;

// 切换原文/翻译视图
function toggleOriginalView() {
  try {
    // 切换状态
    showOriginalGlobal = !showOriginalGlobal;
    
    // 更新切换图标的标题
    const toggleIcon = document.getElementById('toggleOriginalIcon');
    if (toggleIcon) {
      toggleIcon.title = showOriginalGlobal ? (t('showTranslation') || '显示翻译') : (t('showOriginal') || '显示原文');
    }
    
    // 遍历所有帖子项
    const postItems = document.querySelectorAll('.post-item');
    postItems.forEach(postItem => {
      // 更新帖子的显示状态
      postItem.dataset.showOriginal = showOriginalGlobal.toString();
      
      // 切换标题
      const titleText = postItem.querySelector('.post-title-text');
      const post = getPostById(postItem.dataset.postId);
      if (titleText && post) {
        const originalTitle = post.title;
        const translatedTitle = post.analysis?.titleTranslation || post.translation || post.title;
        titleText.textContent = showOriginalGlobal ? originalTitle : translatedTitle;
      }
      
      // 切换正文
      const postContent = postItem.querySelector('.post-content');
      if (postContent) {
        const originalContent = postContent.querySelector('.original-content');
        const translatedContent = postContent.querySelector('.translated-content');
        if (originalContent && translatedContent) {
          originalContent.style.display = showOriginalGlobal ? 'block' : 'none';
          translatedContent.style.display = showOriginalGlobal ? 'none' : 'block';
        }
      }
      
      // 切换评论
      const postComments = postItem.querySelector('.post-comments');
      if (postComments) {
        const originalContent = postComments.querySelector('.original-content');
        const translatedContent = postComments.querySelector('.translated-content');
        if (originalContent && translatedContent) {
          originalContent.style.display = showOriginalGlobal ? 'block' : 'none';
          translatedContent.style.display = showOriginalGlobal ? 'none' : 'block';
        }
      }
    });
  } catch (error) {
  }
}

// 检查爬取状态
async function checkCrawlState() {
  try {
    // 从存储中获取爬取状态
    const result = await chrome.storage.local.get('crawlState');
    const crawlState = result.crawlState;
    
    if (crawlState && crawlState.isRunning) {
      // 有爬取正在进行，显示当前状态
      const progressFill = document.getElementById('progressFill');
      const statusMessage = document.getElementById('statusMessage');
      const progressDetails = document.getElementById('progressDetails');
      
      if (progressFill && statusMessage && progressDetails) {
        const progress = Math.round((crawlState.current / crawlState.total) * 100);
        progressFill.style.width = `${progress}%`;
        statusMessage.textContent = `正在更新 r/${crawlState.subreddits[crawlState.current - 1]}...`;
        progressDetails.textContent = `${crawlState.current}/${crawlState.total} ${t('subreddits')}`;
      }
    }
  } catch (error) {
  }
}

// 加载已有的爬取结果
async function loadExistingResults() {
  try {
    // 从存储中获取爬取结果
    const result = await chrome.storage.local.get('crawlResults');
    const crawlResults = result.crawlResults;
    
    if (crawlResults) {
      const resultsContainer = document.getElementById('resultsContainer');
      
      // 遍历所有板块的结果
      for (const [subreddit, posts] of Object.entries(crawlResults)) {
        if (Array.isArray(posts) && posts.length > 0) {
          // 创建板块部分
          let subredditSection = document.getElementById(`subreddit-${subreddit}`);
          if (!subredditSection) {
            subredditSection = document.createElement('div');
            subredditSection.className = 'subreddit-section collapsed';
            subredditSection.id = `subreddit-${subreddit}`;
            subredditSection.dataset.subreddit = subreddit;
            subredditSection.innerHTML = `<div class="subreddit-title" style="display: flex; align-items: center; gap: 10px; cursor: pointer;"><span class="toggle-icon">▶</span>r/${subreddit}<span class="post-count" style="margin-left: auto; font-size: 14px; color: #666; background: #e9ecef; padding: 2px 8px; border-radius: 12px;">${posts.length}</span></div>`;
            resultsContainer.appendChild(subredditSection);
            
            // 为板块标题添加点击折叠/展开功能
            const titleElement = subredditSection.querySelector('.subreddit-title');
            if (titleElement) {
              titleElement.addEventListener('click', function(e) {
                const toggleIcon = titleElement.querySelector('.toggle-icon');
                const isCollapsed = subredditSection.classList.contains('collapsed');
                
                if (isCollapsed) {
                  // 展开
                  subredditSection.classList.remove('collapsed');
                  toggleIcon.textContent = '▼';
                } else {
                  // 折叠
                  subredditSection.classList.add('collapsed');
                  toggleIcon.textContent = '▶';
                }
              });
            }
          }
          
          // 显示每个帖子
          for (const post of posts) {
            displayPost(post, subredditSection);
          }
        }
      }
      
      // 确保翻译图标显示
      ensureTranslateButton();
    }
  } catch (error) {
  }
}

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'updateProgress':
      // 更新进度
      updateProgress(message);
      break;
    case 'crawlComplete':
      // 思考完成
      crawlComplete(message);
      break;
    case 'crawlError':
      // 思考错误
      showError(message.error);
      break;
    case 'loginRequired':
      // 需要登录
      showLoginPrompt();
      break;
    case 'addResult':
      // 添加结果
      addResult(message);
      break;
    case 'languageChanged':
      // 语言设置改变
      loadSettings();
      break;
  }
});

// 更新进度
function updateProgress(data) {
  // 使用setTimeout确保异步更新，避免阻塞主线程
  setTimeout(() => {
    const progressFill = document.getElementById('progressFill');
    const statusMessage = document.getElementById('statusMessage');
    const progressDetails = document.getElementById('progressDetails');
    
    if (progressFill && statusMessage && progressDetails) {
      const progress = Math.round((data.current / data.total) * 100);
      progressFill.style.width = `${progress}%`;
      statusMessage.textContent = data.message;
      progressDetails.textContent = `${data.current}/${data.total} ${t('subreddits')}`;
    }
  }, 0);
}

// 添加结果
function addResult(data) {
  // 使用setTimeout确保异步处理，避免阻塞主线程
  setTimeout(() => {
    // 检查数据是否有效
    if (!data || !data.subreddit || !data.post || !data.post.id) {
      console.warn('无效的帖子数据:', data);
      return;
    }
    
    const resultsContainer = document.getElementById('resultsContainer');
    
    // 检查是否已存在该板块的结果
    let subredditSection = document.getElementById(`subreddit-${data.subreddit}`);
    if (!subredditSection) {
      subredditSection = document.createElement('div');
      subredditSection.className = 'subreddit-section collapsed';
      subredditSection.id = `subreddit-${data.subreddit}`;
      subredditSection.dataset.subreddit = data.subreddit;
      subredditSection.innerHTML = `<div class="subreddit-title" style="display: flex; align-items: center; gap: 10px; cursor: pointer;"><span class="toggle-icon">▶</span>r/${data.subreddit}<span class="post-count" style="margin-left: auto; font-size: 14px; color: #666; background: #e9ecef; padding: 2px 8px; border-radius: 12px;">1</span></div>`;
      resultsContainer.appendChild(subredditSection);
      
      // 为板块标题添加点击折叠/展开功能
      const titleElement = subredditSection.querySelector('.subreddit-title');
      if (titleElement) {
        titleElement.addEventListener('click', function(e) {
          const toggleIcon = titleElement.querySelector('.toggle-icon');
          const isCollapsed = subredditSection.classList.contains('collapsed');
          
          if (isCollapsed) {
            // 展开
            subredditSection.classList.remove('collapsed');
            toggleIcon.textContent = '▼';
          } else {
            // 折叠
            subredditSection.classList.add('collapsed');
            toggleIcon.textContent = '▶';
          }
        });
      }
    } else {
      // 更新帖子数量
      const postCountElement = subredditSection.querySelector('.post-count');
      if (postCountElement) {
        const currentCount = parseInt(postCountElement.textContent) || 0;
        postCountElement.textContent = currentCount + 1;
      }
    }
    
    // 直接显示原始帖子，不进行翻译和分析
    // 翻译和分析会在用户点击分析按钮时进行
    displayPost(data.post, subredditSection);
  }, 0);
}

// 翻译并显示帖子
function translateAndDisplayPost(subreddit, post, subredditSection) {
  try {
    // 检查是否已经有翻译和分析结果
    if (post.translation && post.selftextTranslation && post.analysis) {
      // 已经有翻译和分析结果，直接显示
      displayPost(post, subredditSection);
      return;
    }
    
    // 发送翻译请求到background.js - 传递结构化内容
    chrome.runtime.sendMessage({
      action: 'translateContent',
      content: {
        title: post.title,
        selftext: post.selftext,
        comments: post.comments || []
      }
    }, (response) => {
      if (response && response.success) {
        // 更新帖子的翻译结果
        post.translation = response.analysis.titleTranslation || post.title;
        post.selftextTranslation = response.analysis.bodyTranslation || post.selftext;
        post.commentsTranslation = response.analysis.commentsTranslation || '';
        post.analysis = response.analysis;
        post.analyzed = true;
        
        // 保存更新后的帖子
        savePostTranslation(subreddit, post);
        
        // 显示翻译后的帖子
        displayPost(post, subredditSection);
      } else {
        // 翻译失败，使用原始内容
        post.translation = post.title;
        post.selftextTranslation = post.selftext;
        post.commentsTranslation = '';
        displayPost(post, subredditSection);
      }
    });
  } catch (error) {
  }  // 翻译失败，使用原始内容
    post.translation = post.title;
    post.selftextTranslation = post.selftext;
    post.commentsTranslation = '';
    displayPost(post, subredditSection);
  }


// 保存帖子的翻译结果
function savePostTranslation(subreddit, post) {
  try {
    chrome.runtime.sendMessage({
      action: 'savePostTranslation',
      subreddit: subreddit,
      post: post
    }, (response) => {
      // 无需处理响应
    });
  } catch (error) {
  }
}

// 自定义确认对话框
function showCustomConfirm(message, onConfirm, onCancel) {
  // 创建对话框容器
  const dialogContainer = document.createElement('div');
  dialogContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;
  
  // 创建对话框内容
  const dialogContent = document.createElement('div');
  dialogContent.style.cssText = `
    background-color: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    min-width: 300px;
    text-align: center;
  `;
  
  // 添加消息
  const messageElement = document.createElement('p');
  messageElement.textContent = message;
  messageElement.style.marginBottom = '20px';
  dialogContent.appendChild(messageElement);
  
  // 创建按钮容器
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 10px;
    justify-content: center;
  `;
  
  // 创建取消按钮
  const cancelButton = document.createElement('button');
  cancelButton.textContent = t('cancel') || '取消';
  cancelButton.style.cssText = `
    padding: 8px 16px;
    border: 1px solid #ccc;
    background-color: #f5f5f5;
    border-radius: 4px;
    cursor: pointer;
  `;
  cancelButton.addEventListener('click', () => {
    dialogContainer.remove();
    if (onCancel) onCancel();
  });
  buttonContainer.appendChild(cancelButton);
  
  // 创建确认按钮
  const confirmButton = document.createElement('button');
  confirmButton.textContent = t('delete') || '删除';
  confirmButton.style.cssText = `
    padding: 8px 16px;
    border: 1px solid #dc3545;
    background-color: #dc3545;
    color: white;
    border-radius: 4px;
    cursor: pointer;
  `;
  confirmButton.addEventListener('click', () => {
    dialogContainer.remove();
    if (onConfirm) onConfirm();
  });
  buttonContainer.appendChild(confirmButton);
  
  dialogContent.appendChild(buttonContainer);
  dialogContainer.appendChild(dialogContent);
  
  // 添加到页面
  document.body.appendChild(dialogContainer);
  
  // 添加点击外部关闭功能
  dialogContainer.addEventListener('click', (e) => {
    if (e.target === dialogContainer) {
      dialogContainer.remove();
      if (onCancel) onCancel();
    }
  });
}

// 检查并移除空的板块
function checkAndRemoveEmptySubreddit(subreddit) {
  const subredditSection = document.getElementById(`subreddit-${subreddit}`);
  if (subredditSection) {
    const postItems = subredditSection.querySelectorAll('.post-item');
    if (postItems.length === 0) {
      subredditSection.remove();
    }
  }
}

// 删除帖子
function deletePost(postId, permalink, subreddit) {
  showCustomConfirm(
    t('confirmDelete') || '确定要删除这个帖子吗？',
    () => {
      // 从页面移除帖子
      const postItem = document.querySelector(`.post-item[data-post-id="${postId}"]`);
      if (postItem) {
        postItem.remove();
        // 检查并移除空的板块
        checkAndRemoveEmptySubreddit(subreddit);
      }
      
      // 发送消息保存删除记录并更新存储
      chrome.runtime.sendMessage({
        action: 'deletePost',
        postId: postId,
        permalink: permalink,
        subreddit: subreddit
      }, (response) => {
        if (response && response.success) {
          console.log('Post deleted successfully:', postId);
        } else {
          console.error('Failed to delete post:', response?.error);
        }
      });
    }
  );
}

// 翻译帖子
async function translatePost(postId, subreddit) {
  try {
    // 获取帖子数据
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getPost', postId, subreddit }, resolve);
    });
    
    if (!response) {
      return;
    }
    
    if (response.error) {
      return;
    }
    
    if (!response.post) {
      return;
    }
    
    const post = response.post;
    
    // 显示翻译选项对话框
    showTranslationOptionsDialog(post, subreddit);
  } catch (error) {
  }
}

// 显示翻译选项对话框
function showTranslationOptionsDialog(post, subreddit) {
  // 创建对话框容器
  const dialogContainer = document.createElement('div');
  dialogContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;
  
  // 创建对话框内容
  const dialogContent = document.createElement('div');
  dialogContent.style.cssText = `
    background-color: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    min-width: 400px;
    max-width: 600px;
  `;
  
  // 添加标题
  const titleElement = document.createElement('h3');
  titleElement.textContent = t('translate') || '翻译';
  titleElement.style.marginBottom = '20px';
  dialogContent.appendChild(titleElement);
  
  // 添加翻译平台选择
  const platformSelector = document.createElement('div');
  platformSelector.style.cssText = `
    margin-bottom: 20px;
  `;
  platformSelector.innerHTML = `
    <label style="display: block; margin-bottom: 8px; font-weight: bold;">${t('translationPlatform') || '翻译平台:'}</label>
    <select id="translationPlatform" style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;">
      <option value="google">Google 翻译</option>
      <option value="baidu">百度翻译</option>
      <option value="ai">AI 翻译</option>
    </select>
  `;
  dialogContent.appendChild(platformSelector);
  
  // 添加目标语言选择
  const languageSelector = document.createElement('div');
  languageSelector.style.cssText = `
    margin-bottom: 20px;
  `;
  languageSelector.innerHTML = `
    <label style="display: block; margin-bottom: 8px; font-weight: bold;">${t('targetLanguage') || '目标语言:'}</label>
    <select id="targetLanguage" style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;">
      <option value="zh">中文</option>
      <option value="en">English</option>
      <option value="ja">日本語</option>
      <option value="ko">한국어</option>
      <option value="fr">Français</option>
      <option value="de">Deutsch</option>
      <option value="es">Español</option>
      <option value="ru">Русский</option>
    </select>
  `;
  dialogContent.appendChild(languageSelector);
  
  // 创建按钮容器
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  `;
  
  // 创建取消按钮
  const cancelButton = document.createElement('button');
  cancelButton.textContent = t('cancel') || '取消';
  cancelButton.style.cssText = `
    padding: 8px 16px;
    border: 1px solid #ccc;
    background-color: #f5f5f5;
    border-radius: 4px;
    cursor: pointer;
  `;
  cancelButton.addEventListener('click', () => {
    dialogContainer.remove();
  });
  buttonContainer.appendChild(cancelButton);
  
  // 创建翻译按钮
  const translateButton = document.createElement('button');
  translateButton.textContent = t('translate') || '翻译';
  translateButton.style.cssText = `
    padding: 8px 16px;
    border: 1px solid #0066cc;
    background-color: #0066cc;
    color: white;
    border-radius: 4px;
    cursor: pointer;
  `;
  translateButton.addEventListener('click', async () => {
    const platform = document.getElementById('translationPlatform').value;
    const targetLanguage = document.getElementById('targetLanguage').value;
    
    // 关闭对话框
    dialogContainer.remove();
    
    // 执行翻译
    await performTranslation(post, subreddit, platform, targetLanguage);
  });
  buttonContainer.appendChild(translateButton);
  
  dialogContent.appendChild(buttonContainer);
  dialogContainer.appendChild(dialogContent);
  
  // 添加到页面
  document.body.appendChild(dialogContainer);
  
  // 添加点击外部关闭功能
  dialogContainer.addEventListener('click', (e) => {
    if (e.target === dialogContainer) {
      dialogContainer.remove();
    }
  });
}

// 执行翻译
async function performTranslation(post, subreddit, platform, targetLanguage) {
  try {
    // 显示翻译中状态
    const postElement = document.querySelector(`.post-item[data-post-id="${post.id}"]`);
    if (postElement) {
      const header = postElement.querySelector('.post-header');
      if (header) {
        const statusElement = document.createElement('div');
        statusElement.className = 'translation-status';
        statusElement.style.cssText = `
          position: absolute;
          top: 100%;
          right: 0;
          background-color: #0066cc;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          z-index: 10;
        `;
        statusElement.textContent = t('translating') || '翻译中...';
        header.appendChild(statusElement);
      }
    }
    
    // 准备翻译文本（包括标题、正文和评论）
    let textToTranslate = post.title;
    if (post.selftext) {
      textToTranslate += '\n' + post.selftext;
    }
    if (post.comments && post.comments.length > 0) {
      textToTranslate += '\n\nComments:\n';
      post.comments.forEach((comment, index) => {
        textToTranslate += `${index + 1}. ${comment.author}: ${comment.body}\n`;
      });
    }
    
    // 发送翻译请求
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'translate',
        text: textToTranslate,
        targetLanguage: targetLanguage,
        platform: platform
      }, resolve);
    });
    
    // 移除翻译状态
    if (postElement) {
      const statusElement = postElement.querySelector('.translation-status');
      if (statusElement) {
        statusElement.remove();
      }
    }
    
    if (response && response.translation) {
      // 更新帖子的翻译结果
      const translation = response.translation;
      
      // 解析翻译结果
      const parts = translation.split('\n\n');
      
      // 标题和正文翻译
      if (parts.length > 0) {
        const titleAndBody = parts[0].split('\n');
        post.translation = titleAndBody[0] || post.title;
        if (titleAndBody.length > 1) {
          post.selftextTranslation = titleAndBody.slice(1).join('\n') || post.selftext;
        }
      }
      
      // 评论翻译
      if (parts.length > 1 && parts[1].includes('Comments:')) {
        post.analysis = post.analysis || {};
        post.analysis.commentsTranslation = parts[1].replace('Comments:', '').trim();
      }
      
      // 保存更新后的帖子
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'savePostTranslation',
          subreddit: subreddit,
          post: post
        }, resolve);
      });
      
      // 更新帖子显示
      const subredditSection = document.getElementById(`subreddit-${subreddit}`);
      if (subredditSection) {
        // 移除旧的帖子元素
        const oldPostElement = document.querySelector(`.post-item[data-post-id="${post.id}"]`);
        if (oldPostElement) {
          oldPostElement.remove();
        }
        
        // 重新显示帖子
        displayPost(post, subredditSection);
      }
    } else {
    }
  } catch (error) {
    
    // 移除翻译状态
    const postElement = document.querySelector(`.post-item[data-post-id="${post.id}"]`);
    if (postElement) {
      const statusElement = postElement.querySelector('.translation-status');
      if (statusElement) {
        statusElement.remove();
      }
    }
  }
}

// 翻译所有帖子
async function translateAllPosts() {
  try {
    // 显示翻译选项对话框
    const options = await new Promise((resolve) => {
      // 创建对话框容器
      const dialogContainer = document.createElement('div');
      dialogContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      `;
      
      // 创建对话框内容
      const dialogContent = document.createElement('div');
      dialogContent.style.cssText = `
        background-color: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        min-width: 400px;
        max-width: 600px;
      `;
      
      // 添加标题
      const titleElement = document.createElement('h3');
      titleElement.textContent = t('translate') || '翻译';
      titleElement.style.marginBottom = '20px';
      dialogContent.appendChild(titleElement);
      
      // 添加翻译平台选择
      const platformSelector = document.createElement('div');
      platformSelector.style.cssText = `
        margin-bottom: 20px;
      `;
      platformSelector.innerHTML = `
        <label style="display: block; margin-bottom: 8px; font-weight: bold;">${t('translationPlatform') || '翻译平台:'}</label>
        <select id="translationPlatform" style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;">
          <option value="google">Google 翻译</option>
          <option value="baidu">百度翻译</option>
          <option value="ai">AI 翻译</option>
        </select>
      `;
      dialogContent.appendChild(platformSelector);
      
      // 添加目标语言选择
      const languageSelector = document.createElement('div');
      languageSelector.style.cssText = `
        margin-bottom: 20px;
      `;
      languageSelector.innerHTML = `
        <label style="display: block; margin-bottom: 8px; font-weight: bold;">${t('targetLanguage') || '目标语言:'}</label>
        <select id="targetLanguage" style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;">
          <option value="zh">中文</option>
          <option value="en">English</option>
          <option value="ja">日本語</option>
          <option value="ko">한국어</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
          <option value="es">Español</option>
          <option value="ru">Русский</option>
        </select>
      `;
      dialogContent.appendChild(languageSelector);
      
      // 创建按钮容器
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      `;
      
      // 创建取消按钮
      const cancelButton = document.createElement('button');
      cancelButton.textContent = t('cancel') || '取消';
      cancelButton.style.cssText = `
        padding: 8px 16px;
        border: 1px solid #ccc;
        background-color: #f5f5f5;
        border-radius: 4px;
        cursor: pointer;
      `;
      cancelButton.addEventListener('click', () => {
        dialogContainer.remove();
        resolve(null);
      });
      buttonContainer.appendChild(cancelButton);
      
      // 创建翻译按钮
      const translateButton = document.createElement('button');
      translateButton.textContent = t('translate') || '翻译';
      translateButton.style.cssText = `
        padding: 8px 16px;
        border: 1px solid #0066cc;
        background-color: #0066cc;
        color: white;
        border-radius: 4px;
        cursor: pointer;
      `;
      translateButton.addEventListener('click', () => {
        const platform = document.getElementById('translationPlatform').value;
        const targetLanguage = document.getElementById('targetLanguage').value;
        
        // 关闭对话框
        dialogContainer.remove();
        
        resolve({ platform, targetLanguage });
      });
      buttonContainer.appendChild(translateButton);
      
      dialogContent.appendChild(buttonContainer);
      dialogContainer.appendChild(dialogContent);
      
      // 添加到页面
      document.body.appendChild(dialogContainer);
      
      // 添加点击外部关闭功能
      dialogContainer.addEventListener('click', (e) => {
        if (e.target === dialogContainer) {
          dialogContainer.remove();
          resolve(null);
        }
      });
    });
    
    if (!options) {
      return; // 用户取消了翻译
    }
    
    const { platform, targetLanguage } = options;
    
    // 显示全局翻译状态
    const statusContainer = document.createElement('div');
    statusContainer.className = 'global-translation-status';
    statusContainer.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #0066cc;
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    `;
    statusContainer.textContent = '正在翻译所有帖子...';
    document.body.appendChild(statusContainer);
    
    // 获取所有帖子
    const subredditSections = document.querySelectorAll('.subreddit-section');
    let totalPosts = 0;
    let translatedPosts = 0;
    
    // 计算总帖子数
    subredditSections.forEach(section => {
      const posts = section.querySelectorAll('.post-item');
      totalPosts += posts.length;
    });
    
    // 遍历所有板块的帖子并翻译
    for (const section of subredditSections) {
      const subreddit = section.dataset.subreddit;
      const postElements = section.querySelectorAll('.post-item');
      
      for (const postElement of postElements) {
        const postId = postElement.dataset.postId;
        
        // 获取帖子数据
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'getPost', postId, subreddit }, resolve);
        });
        
        if (response && response.post) {
          const post = response.post;
          await performTranslation(post, subreddit, platform, targetLanguage);
          translatedPosts++;
          
          // 更新状态
          statusContainer.textContent = `正在翻译所有帖子... ${translatedPosts}/${totalPosts}`;
        }
      }
    }
    
    // 移除全局翻译状态
    statusContainer.textContent = `翻译完成！共翻译了 ${translatedPosts} 个帖子。`;
    setTimeout(() => {
      statusContainer.remove();
    }, 2000);
    
  } catch (error) {
  }
}


// 显示帖子
function displayPost(post, subredditSection) {
  // 获取当前板块的帖子数量作为序号
  const postCount = subredditSection.querySelectorAll('.post-item').length;
  const postNumber = postCount + 1;
  
  // 创建帖子项
  const postItem = document.createElement('div');
  postItem.className = 'post-item';
  postItem.dataset.postId = post.id;
  postItem.dataset.showOriginal = 'false'; // 默认显示翻译内容
  
  // 标题和正文
  const originalTitle = post.title;
  const originalSelftext = post.selftext;
  const translatedTitle = post.analysis?.titleTranslation || post.translation || post.title;
  const translatedSelftext = post.analysis?.bodyTranslation || post.selftextTranslation || post.selftext;
  
  // 构建帖子内容
  let content = `<div class="post-header">
    <div class="post-title">
      <span class="post-number" style="font-weight: bold; color: #666; margin-right: 8px;">#${postNumber}</span>
      <a href="${post.permalink}" target="_blank" style="color: #0066cc; text-decoration: none;" class="post-title-text">${translatedTitle}</a>
    </div>
    <button class="delete-post-btn" data-post-id="${post.id}" data-permalink="${post.permalink}" data-subreddit="${subredditSection.dataset.subreddit}" title="${t('delete')}">✕</button>
  </div>`;
  content += `<div class="post-meta">${t('author')}: ${post.author} | ${t('score')}: ${post.score} | ${t('comments')}: ${post.num_comments} | <a href="${post.permalink}" target="_blank" style="color: #0066cc; text-decoration: none;">${t('originalLink')}</a></div>`;
  
  // 正文
  if (post.selftext) {
    content += `<div class="post-content">
      <div class="translated-content" style="display: block;">${translatedSelftext}</div>
      <div class="original-content" style="display: none;">${originalSelftext}</div>
    </div>`;
  }
  
  // 评论
  if (post.analysis?.commentsTranslation) {
    content += `<div class="post-comments">
      <h4 style="display: flex; align-items: center; gap: 8px; cursor: pointer;" class="comments-toggle">
        ${t('comments')} (${post.comments.length}) <span class="toggle-icon">▼</span>
      </h4>
      <div class="comments-content" style="max-height: 100px; overflow: hidden; transition: max-height 0.3s ease;">
        <div class="translated-content" style="display: block;">
          <ul>
            ${post.analysis.commentsTranslation.split('\n').filter(line => line.trim()).map((line, index) => `
              <li class="comment">
                <div class="comment-body">${line.trim()}</div>
              </li>
            `).join('')}
          </ul>
        </div>
        <div class="original-content" style="display: none;">
          <ul>
            ${post.comments ? post.comments.map(comment => `
              <li class="comment">
                <div class="comment-author">${comment.author}</div>
                <div class="comment-body">${comment.body}</div>
                <div class="comment-meta">Score: ${comment.score}</div>
              </li>
            `).join('') : ''}
          </ul>
        </div>
      </div>
      <div class="comments-footer" style="margin-top: 8px; font-size: 12px; color: #666;">
        <span class="expand-link" style="cursor: pointer; color: #0066cc;">${t('expand')}</span>
      </div>
    </div>`;
  } else if (post.comments && post.comments.length > 0) {
    content += `<div class="post-comments">
      <h4 style="display: flex; align-items: center; gap: 8px; cursor: pointer;" class="comments-toggle">
        ${t('comments')} (${post.comments.length}) <span class="toggle-icon">▼</span>
      </h4>
      <div class="comments-content" style="max-height: 100px; overflow: hidden; transition: max-height 0.3s ease;">
        <ul>
          ${post.comments.map(comment => `
            <li class="comment">
              <div class="comment-author">${comment.author}</div>
              <div class="comment-body">${comment.body}</div>
              <div class="comment-meta">Score: ${comment.score}</div>
            </li>
          `).join('')}
        </ul>
      </div>
      <div class="comments-footer" style="margin-top: 8px; font-size: 12px; color: #666;">
        <span class="expand-link" style="cursor: pointer; color: #0066cc;">${t('expand')}</span>
      </div>
    </div>`;
  }
  
  if (post.analysis) {
      content += `<div class="analysis-result">
        <h4>${t('analysis')}</h4>
        <p><strong>${t('qualityScore')}:</strong> ${post.analysis.qualityScore || 0}</p>`;
      
      // 显示总结（如果有内容）
      if (post.analysis.summary && post.analysis.summary !== 'AI分析总结' && post.analysis.summary !== 'AI analysis summary') {
        content += `<p><strong>${t('summary')}:</strong> ${post.analysis.summary}</p>`;
      }
      
      // 显示价值分析（如果有内容）
      if (post.analysis.value && post.analysis.value !== '价值分析' && post.analysis.value !== 'Value analysis') {
        content += `<p><strong>${t('valueAnalysis')}:</strong> ${post.analysis.value}</p>`;
      }
      
      // 显示观点分析（如果有内容）
      if (post.analysis.opinions && post.analysis.opinions !== '观点' && post.analysis.opinions !== 'Opinions') {
        content += `<p><strong>${t('opinions')}:</strong> ${post.analysis.opinions}</p>`;
      }
      
      // 显示创意分析（如果有内容）
      if (post.analysis.creativity && post.analysis.creativity !== '创意' && post.analysis.creativity !== 'Creativity') {
        content += `<p><strong>${t('creativity')}:</strong> ${post.analysis.creativity}</p>`;
      }
      
      // 显示线索分析（如果有内容）
      if (post.analysis.clues && post.analysis.clues !== '线索' && post.analysis.clues !== 'Clues') {
        content += `<p><strong>${t('clues')}:</strong> ${post.analysis.clues}</p>`;
      }
      
      // 显示商业机会（如果有内容）
      if (post.analysis.businessOpportunities && Array.isArray(post.analysis.businessOpportunities) && post.analysis.businessOpportunities.length > 0) {
        content += `<p><strong>${t('opportunities')}:</strong></p><ul>`;
        post.analysis.businessOpportunities.forEach(opportunity => {
          content += `<li>${opportunity}</li>`;
        });
        content += `</ul>`;
      }
      
      // 显示赚钱机会（如果有内容）
      if (post.analysis.moneyMakingOpportunities && Array.isArray(post.analysis.moneyMakingOpportunities) && post.analysis.moneyMakingOpportunities.length > 0) {
        content += `<p><strong>${t('moneyMakingOpportunities')}:</strong></p><ul>`;
        post.analysis.moneyMakingOpportunities.forEach(opportunity => {
          content += `<li>${opportunity}</li>`;
        });
        content += `</ul>`;
      }
      
      content += `</div>`;
    }
  
  postItem.innerHTML = content;
  subredditSection.appendChild(postItem);
  
  // 添加删除按钮事件监听器
  const deleteBtn = postItem.querySelector('.delete-post-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', function() {
      const postId = this.dataset.postId;
      const permalink = this.dataset.permalink;
      const subreddit = this.dataset.subreddit;
      deletePost(postId, permalink, subreddit);
    });
  }
}

// 思考完成

// 生成列选择器的HTML
function getColumnSelectorHTML() {
  return `
    <div class="column-selector" style="display: flex; align-items: center; gap: 8px;">
      <span id="columnCountLabel" style="font-size: 14px; color: #666;">${t('columnCount')}:</span>
      <button class="column-btn" data-columns="1" style="padding: 6px 12px; border: 1px solid #ccc; background: #f5f5f5; cursor: pointer; border-radius: 4px;">1</button>
      <button class="column-btn" data-columns="2" style="padding: 6px 12px; border: 1px solid #007bff; background: #007bff; color: white; cursor: pointer; border-radius: 4px;">2</button>
      <button class="column-btn" data-columns="3" style="padding: 6px 12px; border: 1px solid #ccc; background: #f5f5f5; cursor: pointer; border-radius: 4px;">3</button>
    </div>
  `;
}

// 添加列按钮事件监听器
function addColumnButtonListeners() {
  const buttons = document.querySelectorAll('.column-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', function() {
      const columns = parseInt(this.dataset.columns);
      setColumnLayout(columns);
    });
  });
}

// 设置列布局
function setColumnLayout(columns) {
  const resultsContainer = document.getElementById('resultsContainer');
  if (resultsContainer) {
    // 检查是否包含空内容提示
    const hasEmptyContent = resultsContainer.querySelector('.empty-content');
    if (!hasEmptyContent) {
      resultsContainer.style.display = 'grid';
      resultsContainer.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
      resultsContainer.style.columnGap = '20px';
    } else {
      // 如果包含空内容提示，使用默认布局
      resultsContainer.style.display = 'block';
      resultsContainer.style.gridTemplateColumns = '';
      resultsContainer.style.columnGap = '';
    }
  }
  
  // 更新标签文本
  const labelEl = document.getElementById('columnCountLabel');
  if (labelEl) {
    labelEl.textContent = t('columnCount') + ':';
  }
  
  // 更新按钮状态
  const buttons = document.querySelectorAll('.column-btn');
  buttons.forEach(btn => {
    if (parseInt(btn.dataset.columns) === columns) {
      btn.classList.add('active');
      btn.style.borderColor = '#007bff';
      btn.style.backgroundColor = '#007bff';
      btn.style.color = 'white';
    } else {
      btn.classList.remove('active');
      btn.style.borderColor = '#ccc';
      btn.style.backgroundColor = '#f5f5f5';
      btn.style.color = '#333';
    }
  });
  
  // 保存用户偏好
  try {
    console.log('Saving preferred columns:', columns);
    chrome.storage.local.set({ preferredColumns: columns });
  } catch (e) {
    console.error('保存列偏好失败:', e);
  }
}
function crawlComplete(data) {
  const statusMessage = document.getElementById('statusMessage');
  statusMessage.textContent = t('crawlComplete', { total: data.total, totalPosts: data.totalPosts });
  
  if (data.totalPosts === 0) {
    const resultsContainer = document.getElementById('resultsContainer');
    resultsContainer.innerHTML = `<div class="empty-content">
      <div class="empty-icon">📭</div>
      <p>${t('noContent')}</p>
    </div>`;
  } else {
    // 检查并移除空的板块
    const subredditSections = document.querySelectorAll('.subreddit-section');
    subredditSections.forEach(section => {
      const subreddit = section.dataset.subreddit;
      checkAndRemoveEmptySubreddit(subreddit);
    });
    
    // 显示分析按钮
    const buttonContainer = document.getElementById('buttonContainer');
    buttonContainer.innerHTML = `
      <button id="analyzeButton" style="padding: 10px 20px; font-size: 16px; background: linear-gradient(135deg, #28a745, #218838); color: white; border: none; border-radius: 4px; cursor: pointer; margin: 0 10px; background-size: 100%; display: inline-flex; align-items: center; gap: 8px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        ${t('analyze')}
      </button>
    ` + getColumnSelectorHTML();
    
    // 添加列按钮事件监听器
    addColumnButtonListeners();
    
    // 添加分析按钮点击事件
    document.getElementById('analyzeButton').addEventListener('click', () => {
      analyzeAllPosts();
    });
    
    // 确保翻译图标显示
    ensureTranslateButton();
  }
  
  // 移除旧的更新按钮（如果存在）
  const oldUpdateButton = document.getElementById('updateButton');
  if (oldUpdateButton) {
    oldUpdateButton.remove();
  }
  
  // 为AI图标添加点击事件
  const aiIcon = document.getElementById('aiIcon');
  if (aiIcon) {
    // 添加鼠标悬停提示
    aiIcon.title = t('analyzeAll');
    
    // 添加点击事件
    aiIcon.onclick = () => {
      analyzeAllPosts();
    };
    
    // 添加悬停效果
    aiIcon.style.transition = 'all 0.3s ease';
    aiIcon.onmouseover = () => {
      aiIcon.style.transform = 'scale(1.1)';
    };
    aiIcon.onmouseout = () => {
      aiIcon.style.transform = 'scale(1)';
    };
  }
  
  // 为刷新图标添加点击事件
  const refreshIcon = document.getElementById('refreshIcon');
  if (refreshIcon) {
    // 移除旧的点击事件（如果存在）
    refreshIcon.onclick = null;
    
    // 添加鼠标悬停提示
    refreshIcon.title = t('fullUpdate');
    
    // 添加新的点击事件
    refreshIcon.onclick = () => {
      // 立即显示进度条
      document.getElementById('progressContainer').style.display = 'block';
      // 清空结果
      document.getElementById('resultsContainer').innerHTML = '';
      // 开始刷新数据（使用全量爬取）
      chrome.tabs.getCurrent((tab) => {
        chrome.runtime.sendMessage({ action: 'startCrawl', type: 'all', senderTab: tab });
      });
    };
    
    // 添加悬停效果
    refreshIcon.style.transition = 'all 0.3s ease';
    refreshIcon.onmouseover = () => {
      refreshIcon.style.transform = 'rotate(180deg)';
      // 悬停时改变颜色为黄色
      refreshIcon.querySelector('img').style.filter = 'invert(70%) sepia(90%) saturate(1000%) hue-rotate(45deg) brightness(100%) contrast(100%)';
    };
    refreshIcon.onmouseout = () => {
      refreshIcon.style.transform = 'rotate(0deg)';
      // 离开时恢复蓝色
      refreshIcon.querySelector('img').style.filter = 'invert(40%) sepia(90%) saturate(1000%) hue-rotate(150deg) brightness(100%) contrast(100%)';
    };
  }
}

// 显示登录提示
function showLoginPrompt() {
  const resultsContainer = document.getElementById('resultsContainer');
  resultsContainer.innerHTML = `
    <div class="login-prompt">
      <h3>${t('loginRequired')}</h3>
      <p>${t('loginInstructions')}</p>
      <button id="loginButton">${t('openLogin')}</button>
    </div>
  `;
  
  // 添加点击事件监听器
  document.getElementById('loginButton').addEventListener('click', () => {
    window.open('https://www.reddit.com/login', '_blank');
  });
  
  // 隐藏进度条
  document.getElementById('progressContainer').style.display = 'none';
}

// 显示错误信息
function showError(error) {
  const resultsContainer = document.getElementById('resultsContainer');
  resultsContainer.innerHTML = `<div class="error-message">${t('error', { error: error })}</div>`;
}

// 显示加载动画
function showLoadingAnimation() {
  const resultsContainer = document.getElementById('resultsContainer');
  resultsContainer.innerHTML = `
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <div class="loading-text">${t('loading')}</div>
      <div class="loading-subtext">${t('loadingSubtext')}</div>
    </div>
  `;
}

// 显示占位符
function showPlaceholders() {
  const resultsContainer = document.getElementById('resultsContainer');
  resultsContainer.innerHTML = `
    <div class="subreddit-section">
      <div class="subreddit-title">r/example</div>
      <div class="placeholder-item">
        <div class="placeholder-title"></div>
        <div class="placeholder-meta"></div>
        <div class="placeholder-content"></div>
        <div class="placeholder-content"></div>
        <div class="placeholder-content"></div>
      </div>
      <div class="placeholder-item">
        <div class="placeholder-title"></div>
        <div class="placeholder-meta"></div>
        <div class="placeholder-content"></div>
        <div class="placeholder-content"></div>
      </div>
    </div>
    <div class="subreddit-section">
      <div class="subreddit-title">r/another</div>
      <div class="placeholder-item">
        <div class="placeholder-title"></div>
        <div class="placeholder-meta"></div>
        <div class="placeholder-content"></div>
        <div class="placeholder-content"></div>
        <div class="placeholder-content"></div>
      </div>
    </div>
  `;
}

// 加载保存的爬取结果
function loadSavedResults() {
  try {
    // 设置超时处理
    const resultsTimeout = setTimeout(() => {
      console.warn('获取爬取结果超时，显示空白列表');
      // 显示空白内容
      const resultsContainer = document.getElementById('resultsContainer');
      resultsContainer.innerHTML = `<div class="empty-content">
        <div class="empty-icon">⏱️</div>
        <p>${t('noContent')}</p>
        <div class="empty-subtext">数据加载超时，请点击开始按钮重新获取</div>
      </div>`;
      
      // 隐藏进度条
      document.getElementById('progressContainer').style.display = 'none';
      
      // 显示开始按钮
      showStartButton();
    }, 5000);
    
    // 同时获取爬取结果和已删除的帖子列表
    chrome.runtime.sendMessage({ action: 'getCrawlResults' }, (response) => {
      // 获取已删除的帖子列表
      chrome.runtime.sendMessage({ action: 'getDeletedPosts' }, (deleteResponse) => {
        const deletedPosts = deleteResponse?.deletedPosts || [];
        const deletedPostIds = new Set(deletedPosts.map(p => p.id));
        
        clearTimeout(resultsTimeout);
        
        // 检查响应是否成功
        if (chrome.runtime.lastError) {
          // 显示错误信息
          const resultsContainer = document.getElementById('resultsContainer');
          resultsContainer.innerHTML = `<div class="empty-content">
            <div class="empty-icon">❌</div>
            <p>获取数据失败</p>
            <div class="empty-subtext">请检查扩展权限或网络连接</div>
          </div>`;
          
          // 隐藏进度条
          document.getElementById('progressContainer').style.display = 'none';
          
          // 显示开始按钮
          showStartButton();
          return;
        }
      
        // 检查是否有结果
        if (response && response.results && response.results.length > 0) {
          // 显示占位符
          showPlaceholders();
          
          // 短暂延迟，让占位符显示一下
          setTimeout(() => {
            // 显示保存的结果
            const resultsContainer = document.getElementById('resultsContainer');
            resultsContainer.innerHTML = '';
            
            // 并行处理所有板块，不等待每个板块完成
            response.results.forEach((subreddit, index) => {
              // 使用setTimeout避免阻塞UI，为每个板块添加不同的延迟
              setTimeout(() => {
                // 确保subreddit对象和posts数组存在
                if (!subreddit || !subreddit.name || !Array.isArray(subreddit.posts)) {
                  console.warn('无效的板块数据:', subreddit);
                  return;
                }
                
                // 过滤有效的帖子
                const validPosts = subreddit.posts.filter(post => post && post.id);
                
                // 如果没有有效帖子，跳过该板块
                if (validPosts.length === 0) {
                  console.warn('板块没有有效帖子:', subreddit.name);
                  return;
                }
                
                // 按质量评分排序，从高到低
                const sortedPosts = [...validPosts].sort((a, b) => {
                  const scoreA = a.analysis?.qualityScore || 0;
                  const scoreB = b.analysis?.qualityScore || 0;
                  return scoreB - scoreA;
                });
                
                // 过滤已删除的帖子
                const activePosts = sortedPosts.filter(post => !deletedPostIds.has(post.id));
                
                // 如果没有活跃帖子，跳过该板块
                if (activePosts.length === 0) {
                  console.warn('板块没有活跃帖子:', subreddit.name);
                  return;
                }
                
                const subredditSection = document.createElement('div');
                subredditSection.className = 'subreddit-section collapsed';
                subredditSection.id = `subreddit-${subreddit.name}`;
                subredditSection.dataset.subreddit = subreddit.name;
                
                // 直接使用板块名称，不进行翻译，提高加载速度
                subredditSection.innerHTML = `<div class="subreddit-title" style="display: flex; align-items: center; gap: 10px; cursor: pointer;"><span class="toggle-icon">▶</span>r/${subreddit.name}<span class="post-count" style="margin-left: auto; font-size: 14px; color: #666; background: #e9ecef; padding: 2px 8px; border-radius: 12px;">${activePosts.length}</span><div class="subreddit-ai" data-subreddit="${subreddit.name}" style="cursor: pointer; transition: all 0.3s ease; filter: drop-shadow(0 0 3px rgba(0, 102, 204, 0.8));"><img src="icons/ai.png" alt="AI分析" style="width: 20px; height: 20px;"></div><div class="subreddit-refresh" data-subreddit="${subreddit.name}" style="cursor: pointer; transition: all 0.3s ease; filter: drop-shadow(0 0 3px rgba(255, 193, 7, 0.8));"><img src="icons/refresh.png" alt="刷新" style="width: 20px; height: 20px; filter: invert(40%) sepia(90%) saturate(1000%) hue-rotate(150deg) brightness(100%) contrast(100%);"></div></div>`;
                resultsContainer.appendChild(subredditSection);
                
                // 为板块标题添加点击折叠/展开功能
                const titleElement = subredditSection.querySelector('.subreddit-title');
                if (titleElement) {
                  titleElement.addEventListener('click', function(e) {
                    // 阻止事件冒泡，避免触发其他元素的点击事件
                    if (e.target.closest('.subreddit-ai') || e.target.closest('.subreddit-refresh')) {
                      return;
                    }
                    
                    const toggleIcon = titleElement.querySelector('.toggle-icon');
                    const isCollapsed = subredditSection.classList.contains('collapsed');
                    
                    if (isCollapsed) {
                      // 展开
                      subredditSection.classList.remove('collapsed');
                      toggleIcon.textContent = '▼';
                      toggleIcon.style.transform = 'rotate(0deg)';
                    } else {
                      // 折叠
                      subredditSection.classList.add('collapsed');
                      toggleIcon.textContent = '▶';
                      toggleIcon.style.transform = 'rotate(0deg)';
                    }
                  });
                }
                
                // 为板块AI图标添加点击事件
                const aiButton = subredditSection.querySelector('.subreddit-ai');
                if (aiButton) {
                  aiButton.title = t('analyzeSubreddit');
                  aiButton.onclick = () => {
                    const subredditName = aiButton.dataset.subreddit;
                    console.log(`开始分析板块: ${subredditName}`);
                    // 显示进度条
                    const progressContainer = document.getElementById('progressContainer');
                    progressContainer.style.display = 'block';
                    const statusMessage = document.getElementById('statusMessage');
                    statusMessage.textContent = `正在分析 r/${subredditName}...`;
                    
                    // 发送分析请求
                    chrome.runtime.sendMessage({ action: 'analyzeSubreddit', subreddit: subredditName }, (response) => {
                      if (response && response.success) {
                        // 分析完成，重新加载结果
                        loadSavedResults();
                        
                        // 显示分析完成消息
                        statusMessage.textContent = `分析完成，共分析 ${response.analyzedCount} 个帖子`;
                      } else {
                        // 分析失败
                        statusMessage.textContent = '分析失败：' + (response.error || '未知错误');
                      }
                      
                      // 无论分析结果如何，确保进度条隐藏
                      setTimeout(() => {
                        const progressContainer = document.getElementById('progressContainer');
                        if (progressContainer) {
                          progressContainer.style.display = 'none';
                        }
                      }, 2000);
                    });
                  };
                  
                  // 添加悬停效果
                  aiButton.style.transition = 'all 0.3s ease';
                  aiButton.onmouseover = () => {
                    aiButton.style.transform = 'scale(1.1)';
                  };
                  aiButton.onmouseout = () => {
                    aiButton.style.transform = 'scale(1)';
                  };
                }
                
                // 为板块刷新图标添加点击事件
                const refreshButton = subredditSection.querySelector('.subreddit-refresh');
                if (refreshButton) {
                  refreshButton.title = t('updateSubreddit');
                  refreshButton.onclick = () => {
                    const subredditName = refreshButton.dataset.subreddit;
                    console.log(`开始刷新板块: ${subredditName}`);
                    // 显示进度条
                    const progressContainer = document.getElementById('progressContainer');
                    progressContainer.style.display = 'block';
                    const statusMessage = document.getElementById('statusMessage');
                    statusMessage.textContent = `正在刷新 r/${subredditName}...`;
                    
                    // 发送刷新请求
                    chrome.runtime.sendMessage({ action: 'updateSubreddit', subreddit: subredditName }, (response) => {
                      if (response && response.success) {
                        // 刷新完成，重新加载结果
                        loadSavedResults();
                        
                        // 显示刷新完成消息
                        statusMessage.textContent = `刷新完成，共爬取 ${response.postCount} 个帖子`;
                      } else {
                        // 刷新失败
                        statusMessage.textContent = '刷新失败：' + (response.error || '未知错误');
                      }
                      
                      // 无论刷新结果如何，确保进度条隐藏
                      setTimeout(() => {
                        const progressContainer = document.getElementById('progressContainer');
                        if (progressContainer) {
                          progressContainer.style.display = 'none';
                        }
                      }, 2000);
                    });
                  };
                  
                  // 添加悬停效果
                  refreshButton.style.transition = 'all 0.3s ease';
                  refreshButton.onmouseover = () => {
                    refreshButton.style.transform = 'scale(1.1) rotate(180deg)';
                  };
                  refreshButton.onmouseout = () => {
                    refreshButton.style.transform = 'scale(1) rotate(0deg)';
                  };
                }
                
                // 并行处理每个帖子
                activePosts.forEach((post, postIndex) => {
                  // 为每个帖子添加不同的延迟，避免同时处理太多帖子
                  setTimeout(() => {
                    // 直接显示原始帖子，不进行翻译和分析
                    // 翻译和分析会在用户点击分析按钮时进行
                    displayPost(post, subredditSection);
                  }, postIndex * 100); // 每个帖子延迟100ms
                });
            }, index * 200); // 每个板块延迟200ms
          });
          
          // 延迟显示控制按钮，确保所有内容都已开始加载
          setTimeout(() => {
            // 检查并移除空的板块
            const subredditSections = document.querySelectorAll('.subreddit-section');
            subredditSections.forEach(section => {
              const subreddit = section.dataset.subreddit;
              checkAndRemoveEmptySubreddit(subreddit);
            });
            
            // 显示更新按钮和全量爬取按钮
            showControlButtons();
            
            // 隐藏进度条
            document.getElementById('progressContainer').style.display = 'none';
          }, response.results.length * 200 + 1000);
        }, 300);
      } else {
        // 没有保存的结果，显示空白列表
        const resultsContainer = document.getElementById('resultsContainer');
        resultsContainer.innerHTML = `<div class="empty-content">
          <div class="empty-icon">📭</div>
          <p>${t('noContent')}</p>
          <div class="empty-subtext">${t('clickStartButton')}</div>
        </div>`;
        
        // 隐藏进度条
        document.getElementById('progressContainer').style.display = 'none';
        
        // 显示开始按钮
        showStartButton();
      }
    });
    });  // 修复：添加缺失的关闭括号
  } catch (error) {
   // 出错时显示空白列表
    const resultsContainer = document.getElementById('resultsContainer');
    resultsContainer.innerHTML = `<div class="empty-content">
      <div class="empty-icon">❌</div>
      <p>加载数据时出错</p>
      <div class="empty-subtext">${error.message}</div>
    </div>`;
    
    // 隐藏进度条
    document.getElementById('progressContainer').style.display = 'none';
    
    // 显示开始按钮
    showStartButton();
  }
}

// 翻译板块名称
function translateSubredditName(subredditName, callback) {
  try {
    // 发送翻译请求到background.js
    chrome.runtime.sendMessage({
      action: 'translateContent',
      content: subredditName
    }, (response) => {
      if (response && response.success && response.analysis.translation) {
        callback(response.analysis.translation);
      } else {
        callback(subredditName); // 翻译失败时返回原始名称
      }
    });
  } catch (error) {
  }  callback(subredditName); // 翻译失败时返回原始名称
  }


// 检查AI系统设置
function checkAiSystem() {
  try {
    // 从chrome.storage.local获取AI系统配置
    chrome.storage.local.get(['userSettings'], function(result) {
      try {
        // 处理存储格式，兼容带timestamp的格式
        const storedSettings = result.userSettings || {};
        const settings = storedSettings.data || storedSettings || {};
        
        // 检查新的aiSystems数组格式
        const aiSystems = settings.aiSystems || [];
        let isAiConfigured = false;
        let aiConfig = null;
        
        if (aiSystems.length > 0) {
          // 查找第一个配置完整的AI系统
          for (const system of aiSystems) {
            if (system.key && system.key.trim() !== '' && system.url && system.url.trim() !== '') {
              isAiConfigured = true;
              aiConfig = {
                apiKey: system.key,
                url: system.url,
                model: system.model === 'custom' ? system.customModel : system.model
              };
              break;
            }
          }
        }
        
        // 兼容旧的aiSystem格式
        if (!isAiConfigured && settings.aiSystem) {
          const oldConfig = settings.aiSystem;
          if ((oldConfig.apiKey && oldConfig.apiKey.trim() !== '') || 
              (oldConfig.key && oldConfig.key.trim() !== '')) {
            isAiConfigured = true;
            aiConfig = {
              apiKey: oldConfig.apiKey || oldConfig.key,
              url: oldConfig.url,
              model: oldConfig.model
            };
          }
        }
        
        if (isAiConfigured && aiConfig) {
          // AI系统配置正确，测试AI系统是否可用
          testAiSystem(aiConfig, function(isAvailable) {
            if (isAvailable) {
          // AI系统可用，显示开始按钮和刷新按钮
          showStartButton();
          // 显示刷新按钮
          const refreshIcon = document.createElement('div');
          refreshIcon.id = 'refreshButton';
          refreshIcon.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            padding: 10px;
            cursor: pointer;
            transition: all 0.3s ease;
          `;
          refreshIcon.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3" stroke="#0066cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M16 12H21L16 7V12Z" stroke="#0066cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M8 12H3L8 7V12Z" stroke="#0066cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `;
          refreshIcon.title = t('refresh');
          refreshIcon.addEventListener('click', () => {
            // 立即显示进度条
            document.getElementById('progressContainer').style.display = 'block';
            // 清空结果
            document.getElementById('resultsContainer').innerHTML = '';
            // 开始刷新数据（使用全量爬取）
            chrome.tabs.getCurrent((tab) => {
              chrome.runtime.sendMessage({ action: 'startCrawl', type: 'all', senderTab: tab });
            });
          });
          
          // 移除旧的刷新按钮（如果存在）
          const oldRefreshButton = document.getElementById('refreshButton');
          if (oldRefreshButton) {
            oldRefreshButton.remove();
          }
          
          const container = document.querySelector('.container');
          if (container) {
            container.appendChild(refreshIcon);
          } else {
            document.body.appendChild(refreshIcon);
          }
        } else {
              // AI系统不可用，显示提示信息
              const resultsContainer = document.getElementById('resultsContainer');
              resultsContainer.innerHTML = `<div class="empty-content">
                <div class="empty-icon">❌</div>
                <p>AI系统不可用，请检查配置</p>
              </div>`;
              
              // 隐藏进度条
              document.getElementById('progressContainer').style.display = 'none';
              
              // 显示开始按钮
              showStartButton();
            }
          });
        } else {
          // AI系统配置不正确，显示AI设置提示
          showAiSetupPrompt();
        }
      } catch (error) {
    }    // 出错时显示开始按钮
        showStartButton();
      }
    );
  } catch (error) {
    // 出错时显示开始按钮
    showStartButton();
  }
}

// 测试AI系统是否可用
function testAiSystem(aiConfig, callback) {
  try {
    // 发送ping请求到AI系统
    chrome.runtime.sendMessage({ 
      action: 'pingAiSystem',
      aiConfig: aiConfig
    }, function(response) {
      if (response && response.success) {
        // AI系统可用
        callback(true);
      } else {
        // AI系统不可用
        callback(false);
      }
    });
  } catch (error) {
    callback(false);
  }
}

// 显示控制按钮（只显示刷新图标）
function showControlButtons() {
  // 先隐藏进度条
  document.getElementById('progressContainer').style.display = 'none';
  
  // 清空按钮容器
  const buttonContainer = document.getElementById('buttonContainer');
  if (buttonContainer) {
    buttonContainer.innerHTML = getColumnSelectorHTML();
    // 添加列按钮事件监听器
    addColumnButtonListeners();
    // 重新应用保存的列布局
    loadColumnPreference();
  }
  
  // 为AI图标添加点击事件
  const aiIcon = document.getElementById('aiIcon');
  if (aiIcon) {
    // 添加鼠标悬停提示
    aiIcon.title = t('analyzeAll');
    
    // 添加点击事件
    aiIcon.onclick = () => {
      analyzeAllPosts();
    };
    
    // 添加悬停效果
    aiIcon.style.transition = 'all 0.3s ease';
    aiIcon.onmouseover = () => {
      aiIcon.style.transform = 'scale(1.1)';
    };
    aiIcon.onmouseout = () => {
      aiIcon.style.transform = 'scale(1)';
    };
  }
  
  // 为刷新图标添加点击事件
  const refreshIcon = document.getElementById('refreshIcon');
  if (refreshIcon) {
    // 移除旧的点击事件（如果存在）
    refreshIcon.onclick = null;
    
    // 添加鼠标悬停提示
    refreshIcon.title = t('fullUpdate');
    
    // 添加新的点击事件
    refreshIcon.onclick = () => {
      // 立即显示进度条
      document.getElementById('progressContainer').style.display = 'block';
      // 清空结果
      document.getElementById('resultsContainer').innerHTML = '';
      // 开始刷新数据（使用全量爬取）
      chrome.tabs.getCurrent((tab) => {
        chrome.runtime.sendMessage({ action: 'startCrawl', type: 'all', senderTab: tab });
      });
    };
    
    // 添加悬停效果
    refreshIcon.style.transition = 'all 0.3s ease';
    refreshIcon.onmouseover = () => {
      refreshIcon.style.transform = 'rotate(180deg)';
      // 悬停时改变颜色为黄色
      refreshIcon.querySelector('img').style.filter = 'invert(70%) sepia(90%) saturate(1000%) hue-rotate(45deg) brightness(100%) contrast(100%)';
    };
    refreshIcon.onmouseout = () => {
      refreshIcon.style.transform = 'rotate(0deg)';
      // 离开时恢复蓝色
      refreshIcon.querySelector('img').style.filter = 'invert(40%) sepia(90%) saturate(1000%) hue-rotate(150deg) brightness(100%) contrast(100%)';
    };
  }
  
  // 异步更新翻译，避免阻塞UI
  setTimeout(() => {
    updateTranslations();
  }, 0);
}

// 显示开始按钮（改为显示刷新图标）
function showStartButton() {
  // 先隐藏进度条
  document.getElementById('progressContainer').style.display = 'none';
  
  // 清空按钮容器
  const buttonContainer = document.getElementById('buttonContainer');
  if (buttonContainer) {
    buttonContainer.innerHTML = getColumnSelectorHTML();
    // 添加列按钮事件监听器
    addColumnButtonListeners();
    // 重新应用保存的列布局
    loadColumnPreference();
  }
  
  // 为AI图标添加点击事件
  const aiIcon = document.getElementById('aiIcon');
  if (aiIcon) {
    // 添加鼠标悬停提示
    aiIcon.title = t('analyzeAll');
    
    // 添加点击事件
    aiIcon.onclick = () => {
      analyzeAllPosts();
    };
    
    // 添加悬停效果
    aiIcon.style.transition = 'all 0.3s ease';
    aiIcon.onmouseover = () => {
      aiIcon.style.transform = 'scale(1.1)';
    };
    aiIcon.onmouseout = () => {
      aiIcon.style.transform = 'scale(1)';
    };
  }
  
  // 为刷新图标添加点击事件
  const refreshIcon = document.getElementById('refreshIcon');
  if (refreshIcon) {
    // 移除旧的点击事件（如果存在）
    refreshIcon.onclick = null;
    
    // 添加鼠标悬停提示
    refreshIcon.title = t('fullUpdate');
    
    // 添加新的点击事件
    refreshIcon.onclick = () => {
      // 立即显示进度条
      document.getElementById('progressContainer').style.display = 'block';
      // 清空结果
      document.getElementById('resultsContainer').innerHTML = '';
      // 开始刷新数据（使用全量爬取）
      chrome.tabs.getCurrent((tab) => {
        chrome.runtime.sendMessage({ action: 'startCrawl', type: 'all', senderTab: tab });
      });
    };
    
    // 添加悬停效果
    refreshIcon.style.transition = 'all 0.3s ease';
    refreshIcon.onmouseover = () => {
      refreshIcon.style.transform = 'rotate(180deg)';
      // 悬停时改变颜色为黄色
      refreshIcon.querySelector('img').style.filter = 'invert(70%) sepia(90%) saturate(1000%) hue-rotate(45deg) brightness(100%) contrast(100%)';
    };
    refreshIcon.onmouseout = () => {
      refreshIcon.style.transform = 'rotate(0deg)';
      // 离开时恢复蓝色
      refreshIcon.querySelector('img').style.filter = 'invert(40%) sepia(90%) saturate(1000%) hue-rotate(150deg) brightness(100%) contrast(100%)';
    };
  }
  
  // 异步更新翻译，避免阻塞UI
  setTimeout(() => {
    updateTranslations();
  }, 0);
}

// 显示AI设置提示
function showAiSetupPrompt() {
  const buttonContainer = document.getElementById('buttonContainer');
  buttonContainer.innerHTML = `
    <div style="background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3>${t('setupAi')}</h3>
      <p>${t('setupAiInstructions')}</p>
      <button id="openSettingsButton" style="padding: 8px 16px; background-color: #0066cc; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
        ${t('openSettings')}
      </button>
    </div>
  `;
  
  // 添加点击事件
  document.getElementById('openSettingsButton').addEventListener('click', () => {
    // 打开扩展的设置页面
    chrome.runtime.sendMessage({ action: 'openSettings' });
  });
  
  // 隐藏进度条
  document.getElementById('progressContainer').style.display = 'none';
}

// 分析所有帖子
function analyzeAllPosts() {
  // 检查是否启用了AI网页版
  chrome.runtime.sendMessage({ action: 'getSettings' }, async (settingsResponse) => {
    const settings = settingsResponse?.settings || {};
    const aiWebPlatforms = settings.aiWebPlatforms || { enabled: false, platforms: [] };
    const aiApiEnabled = settings.aiApiEnabled || false;
    
    if (aiApiEnabled) {
      // 使用API进行分析
      analyzeWithApi();
    } else if (aiWebPlatforms.enabled && aiWebPlatforms.platforms?.length > 0) {
      // 使用AI网页版进行分析（支持并行）
      await analyzeWithAiWeb(aiWebPlatforms);
    } else {
      // 默认使用API进行分析
      analyzeWithApi();
    }
  });
}

async function analyzeWithAiWeb(aiWebPlatforms) {
  const statusMessage = document.getElementById('statusMessage');
  statusMessage.textContent = '正在使用AI网页版分析...';
  
  document.getElementById('progressContainer').style.display = 'block';
  
  try {
    const results = await getCrawlResults();
    const posts = [];
    
    for (const [subreddit, subredditPosts] of Object.entries(results)) {
      for (const post of subredditPosts) {
        if (!post.analysis) {
          posts.push({ subreddit, post });
        }
      }
    }
    
    if (posts.length === 0) {
      statusMessage.textContent = '所有帖子已分析完成';
      return;
    }
    
    // 获取启用的平台
    const enabledPlatforms = (aiWebPlatforms.platforms || []).filter(p => p.enabled);
    if (enabledPlatforms.length === 0) {
      statusMessage.textContent = '没有启用的AI网页版平台';
      return;
    }
    
    let analyzedCount = 0;
    const totalPosts = posts.length;
    
    // 并行处理：将帖子分配给不同的平台
    const analyzePostWithPlatform = async (postIndex, platformConfig) => {
      const { subreddit, post } = posts[postIndex];
      const content = buildAnalysisPrompt(post);
      
      const platform = platformConfig.platform || 'chatgpt';
      const options = {};
      
      if (platform === 'custom') {
        options.customUrl = platformConfig.customUrl;
        options.customInputSelector = platformConfig.customInputSelector;
        options.customSubmitSelector = platformConfig.customSubmitSelector;
        options.customResponseSelector = platformConfig.customResponseSelector;
      }
      
      try {
        const result = await chrome.runtime.sendMessage({
          action: 'startAiWebAutomation',
          platform: platform,
          content: content,
          options: options
        });
        
        if (result.success) {
          const analysis = parseAiWebResponse(result.response);
          post.analysis = analysis;
          post.analyzed = true;
          post.analyzedAt = Date.now();
          
          await chrome.runtime.sendMessage({
            action: 'savePostTranslation',
            subreddit: subreddit,
            post: post
          });
          
          return { success: true, postIndex };
        }
        return { success: false, postIndex, error: result.error };
      } catch (error) {
         return { success: false, postIndex, error: error.message };
      }
    };
    
    // 串行处理：一次只处理一个AI网页版任务
    let postIndex = 0;
    
    while (postIndex < totalPosts) {
      for (const platformConfig of enabledPlatforms) {
        if (postIndex >= totalPosts) break;
        
        const currentIndex = postIndex++;
        statusMessage.textContent = `正在分析帖子 ${currentIndex + 1}/${totalPosts} (使用 ${platformConfig.platform})...`;
        
        try {
          const result = await analyzePostWithPlatform(currentIndex, platformConfig);
          if (result.success) {
            analyzedCount++;
          }
        } catch (error) {
          }
        
        // 更新状态
        statusMessage.textContent = `已分析 ${analyzedCount}/${totalPosts} 个帖子...`;
      }
    }
    
    statusMessage.textContent = `分析完成，共分析 ${analyzedCount} 个帖子`;
    loadSavedResults();
    
  } catch (error) {
    statusMessage.textContent = '分析失败：' + error.message;
  }
}

function buildAnalysisPrompt(post) {
  const settings = window.currentSettings || {};
  const interfaceLanguage = settings.interfaceLanguage || 'en';
  
  const languageMap = {
    zh: '中文',
    en: 'English',
    ja: '日本語',
    ko: '한국어',
    fr: 'Français',
    de: 'Deutsch',
    es: 'Español',
    ru: 'Русский'
  };
  
  const targetLang = languageMap[interfaceLanguage] || 'English';
  
  let prompt = `Please analyze the following Reddit post and provide your response in ${targetLang}.

Title: ${post.title}

`;
  
  if (post.selftext) {
    prompt += `Content: ${post.selftext}\n\n`;
  }
  
  if (post.comments && post.comments.length > 0) {
    prompt += `Top Comments:\n`;
    post.comments.slice(0, 5).forEach((comment, i) => {
      prompt += `${i + 1}. ${comment.author}: ${comment.body}\n`;
    });
    prompt += '\n';
  }
  
  prompt += `Please provide:
1. Quality Score (0-100)
2. Summary
3. Value Analysis
4. Creative Approaches
5. Business Opportunities
6. Money-making Opportunities

Format your response as:
Quality Score: [score]
Summary: [summary]
Value: [value analysis]
Creative Approaches: [creative approaches]
Business Opportunities: [opportunities]
Money-making Opportunities: [opportunities]`;
  
  return prompt;
}

function parseAiWebResponse(response) {
  const analysis = {
    qualityScore: 50,
    summary: '',
    value: '',
    creativeApproaches: '',
    businessOpportunities: [],
    moneyMakingOpportunities: []
  };
  
  if (!response) return analysis;
  
  const qualityMatch = response.match(/Quality Score[:\s]*(\d+)/i);
  if (qualityMatch) {
    analysis.qualityScore = parseInt(qualityMatch[1]);
  }
  
  const summaryMatch = response.match(/Summary[:\s]*([^\n]+(?:\n(?![A-Z][a-z]+:)[^\n]+)*)/i);
  if (summaryMatch) {
    analysis.summary = summaryMatch[1].trim();
  }
  
  const valueMatch = response.match(/Value[:\s]*([^\n]+(?:\n(?![A-Z][a-z]+:)[^\n]+)*)/i);
  if (valueMatch) {
    analysis.value = valueMatch[1].trim();
  }
  
  const creativeMatch = response.match(/Creative Approaches[:\s]*([^\n]+(?:\n(?![A-Z][a-z]+:)[^\n]+)*)/i);
  if (creativeMatch) {
    analysis.creativeApproaches = creativeMatch[1].trim();
  }
  
  const businessMatch = response.match(/Business Opportunities[:\s]*([^\n]+(?:\n(?![A-Z][a-z]+:)[^\n]+)*)/i);
  if (businessMatch) {
    const opportunities = businessMatch[1].split(/[\n•\-\d.]+/).filter(s => s.trim());
    analysis.businessOpportunities = opportunities.map(s => s.trim()).filter(s => s);
  }
  
  const moneyMatch = response.match(/Money[- ]?making Opportunities[:\s]*([^\n]+(?:\n(?![A-Z][a-z]+:)[^\n]+)*)/i);
  if (moneyMatch) {
    const opportunities = moneyMatch[1].split(/[\n•\-\d.]+/).filter(s => s.trim());
    analysis.moneyMakingOpportunities = opportunities.map(s => s.trim()).filter(s => s);
  }
  
  return analysis;
}

function analyzeWithApi() {
  const statusMessage = document.getElementById('statusMessage');
  statusMessage.textContent = '正在分析帖子...';
  
  document.getElementById('progressContainer').style.display = 'block';
  
  chrome.runtime.sendMessage({ action: 'analyzePosts' }, (response) => {
    if (response && response.success) {
      loadSavedResults();
      statusMessage.textContent = `分析完成，共分析 ${response.analyzedCount} 个帖子`;
    } else {
      statusMessage.textContent = '分析失败：' + (response.error || '未知错误');
    }
  });
}

// 加载保存的列偏好
function loadColumnPreference() {
  console.log('loadColumnPreference called');
  try {
    chrome.storage.local.get(['preferredColumns'], (result) => {
      console.log('Retrieved preferredColumns:', result.preferredColumns);
      const columns = result.preferredColumns || 2;
      setColumnLayout(columns);
    });
  } catch (e) {
   setColumnLayout(2);
  }
}

// 初始化
function init() {
  // 加载列偏好设置
  loadColumnPreference();
  
  // 添加列按钮事件监听器
  addColumnButtonListeners();
  
  // 加载设置
  const settingsTimeout = setTimeout(() => {
    console.warn('获取设置超时，使用默认语言');
    currentLang = 'zh';
    updateTranslations();
    
    // 显示加载动画
    showLoadingAnimation();
    
    // 加载保存的结果
    loadSavedResults();
  }, 3000);
  
  chrome.runtime.sendMessage({ action: 'getSettings' }, function(response) {
    clearTimeout(settingsTimeout);
    if (response && response.settings) {
      currentLang = response.settings.interfaceLanguage || 'zh';
    }
    updateTranslations();
    
    // 显示加载动画
    showLoadingAnimation();
    
    // 加载保存的结果
    loadSavedResults();
  });
}

// 页面加载完成后初始化
window.onload = init;

// 添加评论折叠功能
function initCommentsToggle() {
  // 为所有评论切换按钮添加事件监听器
  document.addEventListener('click', function(e) {
    // 处理评论标题点击
    if (e.target.closest('.comments-toggle')) {
      const toggle = e.target.closest('.comments-toggle');
      const postComments = toggle.closest('.post-comments');
      const content = postComments.querySelector('.comments-content');
      const icon = toggle.querySelector('.toggle-icon');
      const expandLink = postComments.querySelector('.expand-link');
      
      if (content.style.maxHeight === '100px' || !content.style.maxHeight) {
        // 展开评论
        content.style.maxHeight = content.scrollHeight + 'px';
        icon.textContent = '▲';
        if (expandLink) expandLink.textContent = t('collapse') || '收起';
      } else {
        // 折叠评论
        content.style.maxHeight = '100px';
        icon.textContent = '▼';
        if (expandLink) expandLink.textContent = t('expand') || '展开';
      }
    }
    
    // 处理展开/收起链接点击
    if (e.target.classList.contains('expand-link')) {
      const expandLink = e.target;
      const postComments = expandLink.closest('.post-comments');
      const toggle = postComments.querySelector('.comments-toggle');
      
      // 模拟点击评论标题
      toggle.click();
    }
    
    // 处理原文/翻译切换按钮点击
    if (e.target.closest('.toggle-original-btn')) {
      const toggleBtn = e.target.closest('.toggle-original-btn');
      const postItem = toggleBtn.closest('.post-item');
      const showOriginal = postItem.dataset.showOriginal === 'true';
      
      // 切换显示状态
      postItem.dataset.showOriginal = (!showOriginal).toString();
      
      // 更新按钮标题
      toggleBtn.title = showOriginal ? (t('showOriginal') || '显示原文') : (t('showTranslation') || '显示翻译');
      
      // 切换标题
      const titleText = postItem.querySelector('.post-title-text');
      const post = getPostById(postItem.dataset.postId);
      if (titleText && post) {
        const originalTitle = post.title;
        const translatedTitle = post.analysis?.titleTranslation || post.translation || post.title;
        titleText.textContent = showOriginal ? originalTitle : translatedTitle;
      }
      
      // 切换正文
      const postContent = postItem.querySelector('.post-content');
      if (postContent) {
        const originalContent = postContent.querySelector('.original-content');
        const translatedContent = postContent.querySelector('.translated-content');
        if (originalContent && translatedContent) {
          originalContent.style.display = showOriginal ? 'block' : 'none';
          translatedContent.style.display = showOriginal ? 'none' : 'block';
        }
      }
      
      // 切换评论
      const postComments = postItem.querySelector('.post-comments');
      if (postComments) {
        const originalContent = postComments.querySelector('.original-content');
        const translatedContent = postComments.querySelector('.translated-content');
        if (originalContent && translatedContent) {
          originalContent.style.display = showOriginal ? 'block' : 'none';
          translatedContent.style.display = showOriginal ? 'none' : 'block';
        }
      }
    }
  });
}

// 页面加载完成后初始化评论折叠功能
document.addEventListener('DOMContentLoaded', initCommentsToggle);

// 根据帖子ID获取帖子数据
function getPostById(postId) {
  try {
    const resultsContainer = document.getElementById('resultsContainer');
    if (!resultsContainer) return null;
    
    // 遍历所有帖子项
    const postItems = resultsContainer.querySelectorAll('.post-item');
    for (const postItem of postItems) {
      if (postItem.dataset.postId === postId) {
        // 从页面数据中获取帖子信息
        // 这里简化处理，实际应该从保存的结果中获取
        return {
          id: postId,
          title: postItem.querySelector('.post-title-text')?.textContent || '',
          selftext: postItem.querySelector('.original-content')?.textContent || ''
        };
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

// 初始化滚动百分比功能
function initScrollPercentage() {
  const scrollProgress = document.getElementById('scrollProgress');
  const scrollPercentage = document.getElementById('scrollPercentage');
  
  if (!scrollProgress || !scrollPercentage) {
    console.warn('滚动百分比元素未找到');
    return;
  }
  
  // 更新滚动百分比
  function updateScrollPercentage() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const percentage = scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 0;
    
    // 更新进度条高度
    scrollProgress.style.height = percentage + '%';
    
    // 更新百分比文本
    scrollPercentage.textContent = percentage + '%';
    
    // 滚动时隐藏百分比，停止滚动后显示
    clearTimeout(window.scrollTimeout);
    scrollPercentage.style.opacity = '1';
    window.scrollTimeout = setTimeout(() => {
      scrollPercentage.style.opacity = '0.7';
    }, 1000);
  }
  
  // 监听滚动事件
  window.addEventListener('scroll', updateScrollPercentage);
  
  // 初始化时更新一次
  updateScrollPercentage();
}

// 页面加载完成后初始化滚动百分比功能
document.addEventListener('DOMContentLoaded', initScrollPercentage);