// 内容脚本，用于在Reddit页面上显示分析结果和翻译功能

// 语言文本映射
const langText = {
  zh: {
    title: '灵感 分析结果',
    qualityScore: '质量评分:',
    summary: '摘要:',
    translation: '翻译:',
    translateButton: '翻译',
    translating: '翻译中...',
    autoTranslate: '自动翻译'
  },
  en: {
    title: 'Inspiration Analysis Result',
    qualityScore: 'Quality Score:',
    summary: 'Summary:',
    translation: 'Translation:',
    translateButton: 'Translate',
    translating: 'Translating...',
    autoTranslate: 'Auto Translate'
  },
  ja: {
    title: 'インスピレーション 分析結果',
    qualityScore: '品質スコア:',
    summary: '要約:',
    translation: '翻訳:',
    translateButton: '翻訳',
    translating: '翻訳中...',
    autoTranslate: '自動翻訳'
  },
  ko: {
    title: '영감 분석 결과',
    qualityScore: '품질 점수:',
    summary: '요약:',
    translation: '번역:',
    translateButton: '번역',
    translating: '번역 중...',
    autoTranslate: '자동 번역'
  },
  fr: {
    title: 'Résultat d\'analyse Inspiration',
    qualityScore: 'Score de qualité:',
    summary: 'Résumé:',
    translation: 'Traduction:',
    translateButton: 'Traduire',
    translating: 'Traduction en cours...',
    autoTranslate: 'Traduction automatique'
  },
  de: {
    title: 'Inspiration Analyseergebnis',
    qualityScore: 'Qualitätsbewertung:',
    summary: 'Zusammenfassung:',
    translation: 'Übersetzung:',
    translateButton: 'Übersetzen',
    translating: 'Übersetzung läuft...',
    autoTranslate: 'Automatische Übersetzung'
  },
  es: {
    title: 'Resultado de análisis Inspiración',
    qualityScore: 'Puntuación de calidad:',
    summary: 'Resumen:',
    translation: 'Traducción:',
    translateButton: 'Traducir',
    translating: 'Traduciendo...',
    autoTranslate: 'Traducción automática'
  },
  ru: {
    title: 'Результат анализа Вдохновение',
    qualityScore: 'Оценка качества:',
    summary: 'Резюме:',
    translation: 'Перевод:',
    translateButton: 'Перевести',
    translating: 'Переводится...',
    autoTranslate: 'Автоматический перевод'
  }
};

// 当前语言
let currentLanguage = null;
// AI系统设置
let aiSystem = null;
// 自动翻译开关
let autoTranslateEnabled = false;

// 获取设置
function getSettings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      if (response && response.settings) {
        const settings = response.settings;
        currentLanguage = settings.interfaceLanguage || 'en';
        autoTranslateEnabled = settings.autoTranslate || false;
        
        // 获取AI系统设置
        if (settings.aiSystems && settings.aiSystems.length > 0) {
          aiSystem = settings.aiSystems[0];
        }
      } else {
        // 如果没有保存的设置，使用浏览器语言检测
        const browserLang = navigator.language || navigator.userLanguage || 'en';
        const langCode = browserLang.split('-')[0].toLowerCase();
        const supportedLangs = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru'];
        currentLanguage = supportedLangs.includes(langCode) ? langCode : 'en';
      }
      resolve();
    });
  });
}

// 监听来自后台的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'showAnalysis') {
    showAnalysis(message.analysis);
  }
});

// 在页面上显示分析结果
function showAnalysis(analysis) {
  // 查找帖子容器
  const postContainer = document.querySelector('.Post');
  if (!postContainer) return;
  
  // 检查是否已经显示了分析结果
  if (document.getElementById('reddit-plus-analysis')) {
    return;
  }
  
  // 获取当前语言的文本
  const text = langText[currentLanguage] || langText.en;
  
  // 创建分析结果容器
  const analysisDiv = document.createElement('div');
  analysisDiv.id = 'reddit-plus-analysis';
  analysisDiv.style.cssText = `
    background-color: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 15px;
    margin: 15px 0;
    font-family: Arial, sans-serif;
  `;
  
  // 构建分析结果HTML
  analysisDiv.innerHTML = `
    <h3 style="margin-top: 0; color: #0066cc;">${text.title}</h3>
    <div style="margin-bottom: 10px;">
      <strong>${text.qualityScore}</strong> <span style="color: #ffc107;">${analysis.qualityScore}</span>
    </div>
    <div style="margin-bottom: 10px;">
      <strong>${text.summary}</strong> ${analysis.summary}
    </div>
    <div>
      <strong>${text.translation}</strong> ${analysis.translation}
    </div>
  `;
  
  // 将分析结果添加到帖子容器顶部
  postContainer.insertBefore(analysisDiv, postContainer.firstChild);
}

// 添加翻译按钮到帖子
function addTranslateButtons() {
  // 查找所有帖子
  const posts = document.querySelectorAll('.Post');
  
  posts.forEach(post => {
    // 检查是否已经添加了翻译按钮
    if (post.querySelector('.reddit-plus-translate-btn')) {
      return;
    }
    
    // 查找帖子标题
    const titleElement = post.querySelector('h1');
    if (!titleElement) return;
    
    // 获取当前语言的文本
    const text = langText[currentLanguage] || langText.en;
    
    // 创建翻译按钮
    const translateButton = document.createElement('button');
    translateButton.className = 'reddit-plus-translate-btn';
    translateButton.textContent = text.translateButton;
    translateButton.style.cssText = `
      background-color: #0079d3;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 12px;
      cursor: pointer;
      margin-left: 10px;
      vertical-align: middle;
    `;
    
    // 添加点击事件
    translateButton.addEventListener('click', async () => {
      await translatePost(post, translateButton);
    });
    
    // 将按钮添加到标题旁边
    titleElement.parentNode.insertBefore(translateButton, titleElement.nextSibling);
  });
}

// 翻译帖子内容
async function translatePost(post, button) {
  // 获取当前语言的文本
  const text = langText[currentLanguage] || langText.en;
  
  // 显示翻译中状态
  button.textContent = text.translating;
  button.disabled = true;
  
  try {
    // 提取帖子内容
    const titleElement = post.querySelector('h1');
    const bodyElement = post.querySelector('.Post-body');
    
    if (!titleElement) return;
    
    // 翻译标题
    const titleText = titleElement.textContent;
    const translatedTitle = await translateText(titleText);
    
    // 保存原文标题
    if (!titleElement.dataset.originalText) {
      titleElement.dataset.originalText = titleText;
    }
    
    // 更新标题
    titleElement.textContent = translatedTitle;
    
    // 翻译正文
    if (bodyElement) {
      const bodyText = bodyElement.textContent;
      const translatedBody = await translateText(bodyText);
      
      // 保存原文正文
      if (!bodyElement.dataset.originalText) {
        bodyElement.dataset.originalText = bodyText;
      }
      
      // 更新正文
      bodyElement.textContent = translatedBody;
    }
    
    // 切换按钮文本为"还原"
    button.textContent = '还原';
    button.style.backgroundColor = '#6c757d';
    
    // 更改点击事件为还原原文
    button.onclick = () => {
      restoreOriginal(post, button);
    };
  } catch (error) {
    console.error('翻译失败:', error);
    button.textContent = text.translateButton;
    button.disabled = false;
  }
}

// 还原原文
function restoreOriginal(post, button) {
  // 获取当前语言的文本
  const text = langText[currentLanguage] || langText.en;
  
  // 还原标题
  const titleElement = post.querySelector('h1');
  if (titleElement && titleElement.dataset.originalText) {
    titleElement.textContent = titleElement.dataset.originalText;
  }
  
  // 还原正文
  const bodyElement = post.querySelector('.Post-body');
  if (bodyElement && bodyElement.dataset.originalText) {
    bodyElement.textContent = bodyElement.dataset.originalText;
  }
  
  // 恢复按钮状态
  button.textContent = text.translateButton;
  button.style.backgroundColor = '#0079d3';
  button.disabled = false;
  
  // 恢复点击事件
  button.onclick = async () => {
    await translatePost(post, button);
  };
}

// 翻译文本
async function translateText(text) {
  try {
    // 调用后台的翻译功能
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ 
        action: 'translate', 
        text: text, 
        targetLanguage: currentLanguage 
      }, (response) => {
        resolve(response && response.translation ? response.translation : text);
      });
    });
  } catch (error) {
    console.error('翻译文本失败:', error);
    return text;
  }
}

// 自动翻译帖子
async function autoTranslatePosts() {
  if (!autoTranslateEnabled) return;
  
  // 查找所有未翻译的帖子
  const posts = document.querySelectorAll('.Post');
  
  for (const post of posts) {
    const titleElement = post.querySelector('h1');
    if (titleElement && !titleElement.dataset.originalText) {
      // 自动翻译帖子
      await translatePost(post, { 
        textContent: '', 
        disabled: false, 
        style: {},
        onclick: () => {}
      });
    }
  }
}

// 当页面加载完成时执行
window.addEventListener('load', async () => {
  // 获取设置
  await getSettings();
  
  // 添加翻译按钮
  addTranslateButtons();
  
  // 自动翻译帖子
  if (autoTranslateEnabled) {
    await autoTranslatePosts();
  }
  
  // 监听页面变化，动态添加翻译按钮
  const observer = new MutationObserver(() => {
    addTranslateButtons();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
});