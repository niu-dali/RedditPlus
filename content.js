// 内容脚本，用于在Reddit页面上显示分析结果

// 语言文本映射
const langText = {
  zh: {
    title: '灵感 分析结果',
    qualityScore: '质量评分:',
    summary: '摘要:',
    translation: '翻译:'
  },
  en: {
    title: 'Inspiration Analysis Result',
    qualityScore: 'Quality Score:',
    summary: 'Summary:',
    translation: 'Translation:'
  },
  ja: {
    title: 'インスピレーション 分析結果',
    qualityScore: '品質スコア:',
    summary: '要約:',
    translation: '翻訳:'
  },
  ko: {
    title: '영감 분석 결과',
    qualityScore: '품질 점수:',
    summary: '요약:',
    translation: '번역:'
  },
  fr: {
    title: 'Résultat d\'analyse Inspiration',
    qualityScore: 'Score de qualité:',
    summary: 'Résumé:',
    translation: 'Traduction:'
  },
  de: {
    title: 'Inspiration Analyseergebnis',
    qualityScore: 'Qualitätsbewertung:',
    summary: 'Zusammenfassung:',
    translation: 'Übersetzung:'
  },
  es: {
    title: 'Resultado de análisis Inspiración',
    qualityScore: 'Puntuación de calidad:',
    summary: 'Resumen:',
    translation: 'Traducción:'
  },
  ru: {
    title: 'Результат анализа Вдохновение',
    qualityScore: 'Оценка качества:',
    summary: 'Резюме:',
    translation: 'Перевод:'
  }
};

// 当前语言
let currentLanguage = null;

// 获取语言设置
chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
  if (response && response.settings && response.settings.interfaceLanguage) {
    currentLanguage = response.settings.interfaceLanguage;
  } else {
    // 如果没有保存的设置，使用浏览器语言检测
    const browserLang = navigator.language || navigator.userLanguage || 'en';
    const langCode = browserLang.split('-')[0].toLowerCase();
    const supportedLangs = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru'];
    currentLanguage = supportedLangs.includes(langCode) ? langCode : 'en';
  }
});

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

// 当页面加载完成时执行
window.addEventListener('load', () => {
  // 页面加载完成后的处理逻辑
});