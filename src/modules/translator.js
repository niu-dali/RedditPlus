// 翻译模块
// 使用全局变量导出，适用于service worker环境

const translator = {
  // 支持的语言列表
  supportedLanguages: [
    { code: 'zh', name: '中文' },
    { code: 'en', name: 'English' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'es', name: 'Español' },
    { code: 'ru', name: 'Русский' }
  ],

  // 检测文本语言
  detectLanguage: async (text) => {
    try {
      if (!text || text.length === 0) return 'en';
      if (/[\u4e00-\u9fa5]/.test(text)) return 'zh';
      if (/[\u3040-\u30ff]/.test(text)) return 'ja';
      if (/[\uac00-\ud7af]/.test(text)) return 'ko';
      if (/[а-яА-Я]/.test(text)) return 'ru';
      if (/[éèêëàâäôöùûüÿç]/.test(text)) return 'fr';
      if (/[äöüß]/.test(text)) return 'de';
      if (/[áéíóúñü]/.test(text)) return 'es';
      return 'en';
    } catch (error) {
      return 'en';
    }
  },

  // 获取目标语言名称
  getTargetLangName: (targetLanguage) => {
    const langNames = {
      zh: '中文',
      en: 'English',
      ja: '日本語',
      ko: '한국어',
      fr: 'Français',
      de: 'Deutsch',
      es: 'Español',
      ru: 'Русский'
    };
    return langNames[targetLanguage] || targetLanguage;
  },

  // 检测API类型
  detectAPIType: (url) => {
    if (!url) return 'unknown';
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('azure') || lowerUrl.includes('.azure.com')) {
      return 'azure';
    } else if (lowerUrl.includes('openai')) {
      return 'openai';
    } else if (lowerUrl.includes('deepseek')) {
      return 'deepseek';
    } else if (lowerUrl.includes('anthropic') || lowerUrl.includes('claude')) {
      return 'anthropic';
    } else if (lowerUrl.includes('google') || lowerUrl.includes('translate.google')) {
      return 'google';
    } else if (lowerUrl.includes('baidu') || lowerUrl.includes('fanyi.baidu')) {
      return 'baidu';
    } else if (lowerUrl.includes('youdao') || lowerUrl.includes('fanyi.youdao')) {
      return 'youdao';
    } else {
      return 'other';
    }
  },

  // 使用AI进行翻译
  translateWithAI: async (text, targetLanguage, aiSystem) => {
    try {
      if (!text || text.trim().length === 0) {
        return text;
      }

      if (!aiSystem || !aiSystem.url) {
        return text;
      }

      const targetLangName = translator.getTargetLangName(targetLanguage);
      const prompt = `请将以下文本翻译成${targetLangName}，只返回翻译结果，不要其他解释：\n\n${text}`;

      const url = aiSystem.url.trim();
      const apiType = translator.detectAPIType(url);

      const headers = {
        'Content-Type': 'application/json'
      };

      // 设置认证头
      if (aiSystem.key) {
        if (apiType === 'azure') {
          headers['api-key'] = aiSystem.key;
        } else if (apiType === 'openai' || apiType === 'deepseek' || apiType === 'anthropic') {
          headers['Authorization'] = `Bearer ${aiSystem.key}`;
        }
      }

      // 构建请求体
      let requestBody = {};

      switch (apiType) {
        case 'azure':
        case 'openai':
          requestBody = {
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3
          };
          if (apiType === 'openai' && aiSystem.model) {
            requestBody.model = aiSystem.model;
          }
          break;
        
        case 'deepseek':
          requestBody = {
            model: aiSystem.model || 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3
          };
          break;
        
        case 'anthropic':
          requestBody = {
            model: aiSystem.model || 'claude-3-sonnet-20240229',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3
          };
          break;
        
        case 'google':
        case 'baidu':
        case 'youdao':
          // 公开翻译API可能需要不同的格式
          requestBody = {
            q: text,
            target: targetLanguage
          };
          break;
        
        default:
          // 默认格式 - 适用于大多数LLM API
          const needsModel = !['google', 'baidu', 'youdao'].includes(apiType);
          requestBody = {
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3
          };
          if (needsModel && aiSystem.model) {
            requestBody.model = aiSystem.model;
          }
          break;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '无法读取错误响应');
        throw new Error(`API请求失败: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // 提取翻译结果
      let translation = null;

      // 处理不同API的响应格式
      switch (apiType) {
        case 'azure':
        case 'openai':
        case 'deepseek':
        case 'anthropic':
          if (data.choices && data.choices[0]) {
            if (data.choices[0].message && data.choices[0].message.content) {
              translation = data.choices[0].message.content;
            } else if (data.choices[0].text) {
              translation = data.choices[0].text;
            }
          }
          break;
        
        case 'google':
          // Google Translate API响应格式
          if (data.data && data.data.translations) {
            translation = data.data.translations[0].translatedText;
          }
          break;
        
        case 'baidu':
          // 百度翻译API响应格式
          if (data.trans_result) {
            translation = data.trans_result[0].dst;
          }
          break;
        
        case 'youdao':
          // 有道翻译API响应格式
          if (data.translation) {
            translation = data.translation[0];
          }
          break;
        
        default:
          // 通用响应格式
          if (data.choices && data.choices[0]) {
            if (data.choices[0].message && data.choices[0].message.content) {
              translation = data.choices[0].message.content;
            } else if (data.choices[0].text) {
              translation = data.choices[0].text;
            }
          } else if (data.content) {
            translation = data.content;
          }
          break;
      }

      if (!translation) {
        throw new Error('API响应格式不正确');
      }

      return translation.trim();
    } catch (error) {
      throw error;
    }
  },

  // 翻译方法
  translate: async (text, targetLanguage, aiSystem = null) => {
    try {
      if (!text || text.trim().length === 0) {
        return text;
      }

      const sourceLanguage = await translator.detectLanguage(text);

      if (sourceLanguage === targetLanguage) {
        return text;
      }

      // 优先使用浏览器内置翻译
      const browserTranslation = await translator.translateWithBrowser(text, targetLanguage);
      if (browserTranslation && browserTranslation !== text) {
        return browserTranslation;
      }

      // 如果浏览器翻译失败，再尝试AI翻译
      if (aiSystem && aiSystem.url) {
        return await translator.translateWithAI(text, targetLanguage, aiSystem);
      }

      return text;
    } catch (error) {
      return text;
    }
  },

  // 浏览器内置翻译
  translateWithBrowser: async (text, targetLanguage) => {
    try {
      if (!text || text.trim().length === 0) {
        return text;
      }

      // 方法1：使用浏览器的内置翻译API
      if (typeof window !== 'undefined' && window.navigator && window.navigator.language) {
        // 检查是否支持内置翻译
        if (typeof window.Intl !== 'undefined' && window.Intl.DisplayNames) {
        }
      }

      // 方法2：使用Google翻译服务（通过iframe）
      const translation = await translator.translateWithGoogle(text, targetLanguage);
      if (translation && translation !== text) {
        return translation;
      }

      // 方法3：使用简单的语言检测和翻译（备用方案）
      return translator.translateWithSimple(text, targetLanguage);
    } catch (error) {
      return text;
    }
  },

  // 使用Google翻译
  translateWithGoogle: async (text, targetLanguage) => {
    try {
      // 构建Google翻译API URL
      const sourceLanguage = await translator.detectLanguage(text);
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLanguage}&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(text)}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Google翻译请求失败: ${response.status}`);
      }

      const data = await response.json();

      // 解析Google翻译响应
      if (data && data[0] && Array.isArray(data[0])) {
        let translation = '';
        for (const item of data[0]) {
          if (item[0]) {
            translation += item[0];
          }
        }
        return translation;
      }

      return text;
    } catch (error) {
      return text;
    }
  },

  // 简单翻译（备用方案）
  translateWithSimple: (text, targetLanguage) => {
    // 简单的翻译映射（仅用于演示）
    const simpleTranslations = {
      en: {
        'Hello': '你好',
        'World': '世界',
        'Thank you': '谢谢',
        'How are you?': '你好吗？'
      },
      zh: {
        '你好': 'Hello',
        '世界': 'World',
        '谢谢': 'Thank you',
        '你好吗？': 'How are you?'
      }
    };

    // 尝试简单翻译
    const sourceLanguage = translator.detectLanguage(text);
    if (simpleTranslations[sourceLanguage] && simpleTranslations[sourceLanguage][text]) {
      return simpleTranslations[sourceLanguage][text];
    }

    return text;
  },

  // 公开翻译接口 - 支持Google、百度、有道等
  translateWithPublicAPI: async (text, targetLanguage, platform) => {
    try {
      if (!text || text.trim().length === 0) {
        return text;
      }

      const sourceLanguage = await translator.detectLanguage(text);
      if (sourceLanguage === targetLanguage) {
        return text;
      }

      // 这里可以实现具体的公开翻译API调用
      // 由于浏览器安全限制，可能需要通过后台脚本调用
      // 暂时返回原文，实际实现需要根据具体API调整
      return text;
    } catch (error) {
      return text;
    }
  }
};

// 导出为全局变量
if (typeof self !== 'undefined') {
  self.translator = translator;
} else if (typeof window !== 'undefined') {
  window.translator = translator;
} else if (typeof global !== 'undefined') {
  global.translator = translator;
}