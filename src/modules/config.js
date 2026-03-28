/**
 * 配置模块
 * 定义默认配置和常量
 */

/**
 * 预定义的Reddit板块列表（作为初始数据）
 */
const DEFAULT_SUBREDDITS = [
  { name: 'SideProject', url: 'https://www.reddit.com/r/SideProject', desc: { zh: '副业项目', en: 'Side Project', ja: 'サイドプロジェクト', ko: '사이드 프로젝트', fr: 'Projet secondaire', de: 'Nebenprojekt', es: 'Proyecto secundario', ru: 'Второй проект' }, subscribers: 10000 },
  { name: 'Entrepreneur', url: 'https://www.reddit.com/r/Entrepreneur', desc: { zh: '创业者', en: 'Entrepreneur', ja: '起業家', ko: '기업가', fr: 'Entrepreneur', de: 'Unternehmer', es: 'Empresario', ru: 'Предприниматель' }, subscribers: 1000000 },
  { name: 'SaaS', url: 'https://www.reddit.com/r/SaaS', desc: { zh: 'SaaS 产品', en: 'SaaS Products', ja: 'SaaS製品', ko: 'SaaS 제품', fr: 'Produits SaaS', de: 'SaaS-Produkte', es: 'Productos SaaS', ru: 'Продукты SaaS' }, subscribers: 50000 },
  { name: 'microsaas', url: 'https://www.reddit.com/r/microsaas', desc: { zh: '微型 SaaS', en: 'Micro SaaS', ja: 'マイクロSaaS', ko: '마이크로 SaaS', fr: 'Micro SaaS', de: 'Mikro-SaaS', es: 'Micro SaaS', ru: 'Микро-SaaS' }, subscribers: 10000 },
  { name: 'indiehackers', url: 'https://www.reddit.com/r/indiehackers', desc: { zh: '独立开发者', en: 'Indie Hackers', ja: 'インディーハッカー', ko: '인디 해커', fr: 'Hackers indépendants', de: 'Indie-Hacker', es: 'Hackers independientes', ru: 'Инди-хаки' }, subscribers: 200000 },
  { name: 'ecommerce', url: 'https://www.reddit.com/r/ecommerce', desc: { zh: '电商', en: 'E-commerce', ja: 'EC', ko: '전자상거래', fr: 'E-commerce', de: 'E-Commerce', es: 'Comercio electrónico', ru: 'Электронная коммерция' }, subscribers: 300000 },
  { name: 'shopify', url: 'https://www.reddit.com/r/shopify', desc: { zh: 'Shopify', en: 'Shopify', ja: 'Shopify', ko: 'Shopify', fr: 'Shopify', de: 'Shopify', es: 'Shopify', ru: 'Shopify' }, subscribers: 100000 },
  { name: 'webdev', url: 'https://www.reddit.com/r/webdev', desc: { zh: 'Web 开发', en: 'Web Development', ja: 'Web開発', ko: '웹 개발', fr: 'Développement web', de: 'Web-Entwicklung', es: 'Desarrollo web', ru: 'Веб-разработка' }, subscribers: 2000000 },
  { name: 'programming', url: 'https://www.reddit.com/r/programming', desc: { zh: '编程', en: 'Programming', ja: 'プログラミング', ko: '프로그래밍', fr: 'Programmation', de: 'Programmierung', es: 'Programación', ru: 'Программирование' }, subscribers: 3000000 },
  { name: 'EntrepreneurRideAlong', url: 'https://www.reddit.com/r/EntrepreneurRideAlong', desc: { zh: '创业历程', en: 'Entrepreneur Ride Along', ja: '起業の旅', ko: '기업가의 여정', fr: 'Parcours d\'entrepreneur', de: 'Unternehmensreise', es: 'Viaje de emprendedor', ru: 'Путешествие предпринимателя' }, subscribers: 50000 },
  { name: 'startups', url: 'https://www.reddit.com/r/startups', desc: { zh: '创业讨论', en: 'Startups', ja: 'スタートアップ', ko: '스타트업', fr: 'Startups', de: 'Startups', es: 'Startups', ru: 'Стартапы' }, subscribers: 500000 }
];

/**
 * 最小订阅者数量
 */
const MIN_SUBSCRIBERS = 5000;

/**
 * 默认用户配置
 */
const defaultUserConfig = {
  selectedSubreddits: DEFAULT_SUBREDDITS.map(sub => sub.name),
  customSubreddits: [],
  maxPosts: 1000,
  maxComments: 200,
  depth: 10,
  minSubscribers: 5000
};

/**
 * 支持的语言列表
 */
const SUPPORTED_LANGUAGES = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru'];

/**
 * 支持的AI网页版平台配置
 */
const AI_WEB_PLATFORMS = {
  chatgpt: {
    name: 'ChatGPT',
    url: 'https://chat.openai.com',
    patterns: ['*://chat.openai.com/*', '*://chatgpt.com/*'],
    inputSelector: '#prompt-textarea, div[contenteditable="true"][data-placeholder]',
    submitSelector: 'button[data-testid="send-button"], button[aria-label="Send"]',
    responseSelector: '.markdown, div[data-message-author-role="assistant"]',
    waitForResponse: 3000,
    maxWaitTime: 120000
  },
  claude: {
    name: 'Claude',
    url: 'https://claude.ai',
    patterns: ['*://claude.ai/*'],
    inputSelector: 'div[contenteditable="true"], textarea[placeholder*="Message"], div.ProseMirror',
    submitSelector: '/html/body/div[1]/div[1]/div/div[2]/div[3]/main/div[2]/div[2]/div/div/div/fieldset/div[1]/div[2]/div[1]/div[2]/div[3]/div/div/button, button[aria-label="Send Message"], button[type="submit"]',
    responseSelector: '.font-claude-response, div[data-testid="assistant-message"], .ProseMirror, div[class*="response"], div[class*="message"], article[class*="message"], section[class*="message"]',
    waitForResponse: 3000,
    maxWaitTime: 120000
  },
  gemini: {
    name: 'Gemini',
    url: 'https://gemini.google.com',
    patterns: ['*://gemini.google.com/*'],
    inputSelector: 'div.ql-editor, textarea[aria-label*="Enter a prompt"], rich-textarea',
    submitSelector: '/html/body/chat-app/main/side-navigation-v2/bard-sidenav-container/bard-sidenav-content/div[2]/div/div[2]/chat-window/div/input-container/fieldset/input-area-v2/div/div/div[3]/div[2]/div[2]/button, button[aria-label="发送"], button.send-button, button[class*="submit"], button[aria-label="Send message"], button[data-test-id="send-button"]',
    responseSelector: '.model-response-text, message-content',
    waitForResponse: 3000,
    maxWaitTime: 120000
  },
  deepseek: {
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    patterns: ['*://chat.deepseek.com/*'],
    inputSelector: '/html/body/div[1]/div/div/div[2]/div[3]/div/div/div[2]/div[2]/div/div/div[1]/textarea, textarea, [contenteditable="true"], #chat-input, [data-testid="chat-input"], .chat-input, input[type="text"]',
    submitSelector: '/html/body/div[1]/div/div/div[2]/div[3]/div/div/div[2]/div[2]/div/div/div[2]/div[3]/div[2]/div/div[2], button[type="submit"], [data-testid="send-button"], button svg, button[class*="send"], button[class*="submit"], button',
    responseSelector: '.message-content, .response-text, .markdown, [data-testid="assistant-message"], .chat-message, .message, [class*="message"], div[class*="response"], div[class*="output"], div[class*="assistant"], div[class*="reply"], section[class*="message"], article[class*="message"]',
    waitForResponse: 5000,
    maxWaitTime: 120000
  },
  custom: {
    name: '自定义',
    url: '',
    patterns: [],
    inputSelector: '',
    submitSelector: '',
    responseSelector: '',
    waitForResponse: 3000,
    maxWaitTime: 120000
  }
};

/**
 * 检测浏览器语言并返回支持的语言代码
 * @returns {string} 支持的语言代码
 */
function detectBrowserLanguage() {
  const browserLang = navigator.language || navigator.userLanguage || 'en';
  const langCode = browserLang.split('-')[0].toLowerCase();
  return SUPPORTED_LANGUAGES.includes(langCode) ? langCode : 'en';
}

/**
 * 根据浏览器语言获取默认用户设置
 * @returns {Object} 默认用户设置
 */
function getDefaultUserSettings() {
  const detectedLang = detectBrowserLanguage();
  return {
    targetLanguage: detectedLang,
    interfaceLanguage: detectedLang,
    aiApiEnabled: false,
    collapsedSections: {
      aiSystems: true,
      aiWebPlatforms: true
    },
    aiSystems: [
      {
        name: '默认AI系统',
        url: '',
        key: '',
        model: 'gpt-3.5-turbo',
        customModel: ''
      }
    ],
    aiWebPlatforms: {
      enabled: false,
      platforms: [
        {
          id: Date.now(),
            platform: 'chatgpt',
            customUrl: '',
            customInputSelector: '',
            customSubmitSelector: '',
            customResponseSelector: '',
            enabled: true
        }
      ]
    }
  };
}

/**
 * 默认用户设置（保持向后兼容）
 */
const defaultUserSettings = {
  targetLanguage: 'zh',
  interfaceLanguage: 'zh',
  aiSystems: [
    {
      name: '默认AI系统',
      url: '',
      key: '',
      model: 'gpt-3.5-turbo',
      customModel: ''
    }
  ]
};

// 为了兼容性，同时提供全局变量和导出（如果支持）
if (typeof self !== 'undefined') {
  self.DEFAULT_SUBREDDITS = DEFAULT_SUBREDDITS;
  self.MIN_SUBSCRIBERS = MIN_SUBSCRIBERS;
  self.defaultUserConfig = defaultUserConfig;
  self.defaultUserSettings = defaultUserSettings;
  self.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
  self.AI_WEB_PLATFORMS = AI_WEB_PLATFORMS;
  self.detectBrowserLanguage = detectBrowserLanguage;
  self.getDefaultUserSettings = getDefaultUserSettings;
}

// 如果支持ES6模块导出，也提供导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    DEFAULT_SUBREDDITS, 
    MIN_SUBSCRIBERS, 
    defaultUserConfig, 
    defaultUserSettings,
    SUPPORTED_LANGUAGES,
    AI_WEB_PLATFORMS,
    detectBrowserLanguage,
    getDefaultUserSettings
  };
}
