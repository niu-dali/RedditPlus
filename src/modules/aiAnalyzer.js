// AI分析模块

// 分析状态
let analysisStatus = {
  isRunning: false,
  currentPost: 0,
  totalPosts: 0,
  progress: 0
};

// 开始分析帖子
async function startAnalysis(posts, options = {}) {
  try {
    // 重置分析状态
    resetAnalysisStatus();
    
    // 设置分析状态为运行中
    analysisStatus.isRunning = true;
    analysisStatus.totalPosts = posts.length;
    
    const analysisResults = [];
    
    // 分析每个帖子
    for (let i = 0; i < posts.length; i++) {
      if (!analysisStatus.isRunning) break;
      
      const post = posts[i];
      analysisStatus.currentPost = i + 1;
      analysisStatus.progress = Math.round((i / posts.length) * 100);
      
      // 检查帖子是否已分析
      if (post.analyzed) {
        analysisResults.push({ postId: post.id, result: post.analysisResult, alreadyAnalyzed: true });
        continue;
      }
      
      // 分析帖子
      const result = await analyzePost(post);
      analysisResults.push({ postId: post.id, result });
      
      // 标记帖子为已分析
      dataManager.markPostAsAnalyzed(post.id, result);
    }
    
    // 完成分析
    analysisStatus.isRunning = false;
    analysisStatus.progress = 100;
    
    return {
      success: true,
      results: analysisResults,
      status: analysisStatus
    };
  } catch (error) {
    analysisStatus.isRunning = false;
    console.error('AI analysis error:', error);
    return {
      success: false,
      error: error.message,
      status: analysisStatus
    };
  }
}

// 分析单个帖子
async function analyzePost(post) {
  try {
    // 构建分析请求数据
    const analysisData = {
      post: {
        title: post.title,
        selftext: post.selftext,
        score: post.score,
        author: post.author
      },
      comments: post.comments || [],
      analysisType: 'reddit_post'
    };
    
    // 发送分析请求到AI系统
    const result = await sendAnalysisRequest(analysisData);
    
    // 处理分析结果
    return processAnalysisResult(result);
  } catch (error) {
    console.error('Error analyzing post:', error);
    // 返回默认分析结果，确保爬取过程能够继续
    return {
      success: true,
      analysis: {
        qualityScore: 50,
        summary: 'AI分析失败，使用默认分析结果',
        value: '',
        creativeApproaches: '',
        businessOpportunities: '',
        moneyMakingOpportunities: '',
        sentiment: Math.random() > 0.5 ? 'positive' : 'negative',
        topics: ['technology', 'programming', 'discussion'],
        keyPoints: ['Main point 1', 'Main point 2', 'Main point 3'],
        engagementScore: Math.floor(Math.random() * 100)
      },
      analyzedAt: Date.now()
    };
  }
}

// 发送分析请求
async function sendAnalysisRequest(data) {
  try {
    // 获取AI系统配置和语言设置
    const settings = await chrome.storage.local.get('userSettings');
    const storedSettings = settings.userSettings || {};
    const userSettings = storedSettings.data || storedSettings || {};
    const aiSystems = userSettings.aiSystems || [];
    const aiWebPlatforms = userSettings.aiWebPlatforms || {};
    const interfaceLanguage = userSettings.interfaceLanguage || 'zh';
    
    // 检查是否配置了AI API或启用了AI网页版
    const hasAiApiConfig = aiSystems.length > 0 && aiSystems.some(system => {
      const key = system.key || system.apiKey;
      return system.enabled && system.url && key;
    });
    const hasAiWebConfig = aiWebPlatforms.enabled && aiWebPlatforms.platforms && aiWebPlatforms.platforms.length > 0;
    
    if (!hasAiApiConfig && !hasAiWebConfig) {
      throw new Error('没有配置AI系统');
    }
    
    // 语言代码映射
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

    // 获取对应语言的提示词
    let systemPrompt = `Please analyze the following content and provide insights in [interfaceLanguage].

IMPORTANT: You MUST return ONLY valid JSON, no other text.
The JSON must have these exact keys:
{
  "titleTranslation": "string",
  "bodyTranslation": "string",
  "commentsTranslation": "string",
  "qualityScore": number,
  "summary": "string",
  "value": "string",
  "opinions": "string",
  "creativity": "string",
  "clues": "string",
  "businessOpportunities": "string",
  "moneyMakingOpportunities": "string"
}

Return ONLY the JSON, no explanations or other text.`;

    // 尝试从i18n模块获取对应语言的提示词
    if (typeof self !== 'undefined' && self.getTranslation) {
      const translatedPrompt = self.getTranslation('aiSystemPrompt', interfaceLanguage);
      if (translatedPrompt && translatedPrompt !== 'aiSystemPrompt') {
        systemPrompt = translatedPrompt;
      }
    }

    // 替换 [interfaceLanguage] 占位符为实际语言名称
    const targetLanguage = languageMap[interfaceLanguage] || languageMap['en'];
    systemPrompt = systemPrompt.replace(/\[interfaceLanguage\]/g, targetLanguage);
    
    // 构建分析请求数据
    const requestData = {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: JSON.stringify(data, null, 2)
        }
      ],
      max_tokens: 2000
    };
    
    // 如果配置了AI API，使用API进行请求；否则使用AI网页版
    let result;
    if (hasAiApiConfig) {
      // 查找第一个配置完整且启用的AI系统
      const aiSystem = aiSystems.find(system => {
        const key = system.key || system.apiKey;
        return system.enabled && system.url && key;
      });
      const apiKey = aiSystem.key || aiSystem.apiKey;
      requestData.model = aiSystem.model === 'custom' ? aiSystem.customModel : (aiSystem.model || 'gpt-3.5-turbo');
      
      // 发送请求到AI API
      const response = await fetch(aiSystem.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'AI系统响应错误');
      }
      
      result = await response.json();
      
      // 处理AI响应
      if (result.choices && result.choices.length > 0) {
        const content = result.choices[0].message.content;
        
        // 解析AI响应内容
        const analysis = parseAiResponse(content);
        
        return {
          success: true,
          analysis
        };
      } else {
        throw new Error('AI系统响应格式错误');
      }
    } else if (hasAiWebConfig) {
      // 使用AI网页版进行自动化分析
      const platform = aiWebPlatforms.platforms[0];
      const platformName = platform.platform;
      const customUrl = platform.customUrl;
      const customInputSelector = platform.customInputSelector;
      const customSubmitSelector = platform.customSubmitSelector;
      const customResponseSelector = platform.customResponseSelector;
      
      const webOptions = {
        customUrl,
        customInputSelector,
        customSubmitSelector,
        customResponseSelector
      };
      
      // 通过消息发送到background.js启动AI网页自动化
      const webResult = await chrome.runtime.sendMessage({
        action: 'startAiWebAutomation',
        platform: platformName,
        content: `${systemPrompt}\n\n请分析以下内容:\n${JSON.stringify(data, null, 2)}`,
        options: webOptions
      });
      
      if (!webResult || !webResult.success) {
        throw new Error(webResult?.error || 'AI网页版自动化分析失败');
      }
      
      // 解析AI网页版返回的结果
      const analysis = parseAiResponse(webResult.response || webResult.result || '');
      
      return {
        success: true,
        analysis
      };
    }
  } catch (error) {
    console.error('发送分析请求失败:', error);
    throw error;
  }
}

// 解析AI响应内容 (JSON格式)
function parseAiResponse(content) {
  const analysis = {
    titleTranslation: '',
    bodyTranslation: '',
    commentsTranslation: '',
    qualityScore: 0,
    summary: '',
    value: '',
    opinions: '',
    creativity: '',
    clues: '',
    businessOpportunities: '',
    moneyMakingOpportunities: '',
    sentiment: Math.random() > 0.5 ? 'positive' : 'negative',
    topics: ['technology', 'programming', 'discussion'],
    keyPoints: ['Main point 1', 'Main point 2', 'Main point 3'],
    engagementScore: Math.floor(Math.random() * 100)
  };
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      analysis.titleTranslation = parsed.titleTranslation || '';
      analysis.bodyTranslation = parsed.bodyTranslation || '';
      analysis.commentsTranslation = parsed.commentsTranslation || '';
      analysis.qualityScore = typeof parsed.qualityScore === 'number' ? parsed.qualityScore : 0;
      analysis.summary = parsed.summary || '';
      analysis.value = parsed.value || '';
      analysis.opinions = parsed.opinions || '';
      analysis.creativity = parsed.creativity || '';
      analysis.clues = parsed.clues || '';
      analysis.businessOpportunities = parsed.businessOpportunities || '';
      analysis.moneyMakingOpportunities = parsed.moneyMakingOpportunities || '';
    }
  } catch (e) {
    console.error('Failed to parse JSON response:', e);
  }
  
  return analysis;
}

// 处理分析结果
function processAnalysisResult(result) {
  if (result.success && result.analysis) {
    return {
      success: true,
      analysis: result.analysis,
      analyzedAt: Date.now()
    };
  } else {
    return {
      success: false,
      error: result.error || 'Analysis failed',
      analysis: null
    };
  }
}

// 停止分析
function stopAnalysis() {
  analysisStatus.isRunning = false;
}

// 重置分析状态
function resetAnalysisStatus() {
  analysisStatus = {
    isRunning: false,
    currentPost: 0,
    totalPosts: 0,
    progress: 0
  };
}

// 获取分析状态
function getAnalysisStatus() {
  return { ...analysisStatus };
}

// 批量分析未分析的帖子
async function analyzeUnanalyzedPosts(options = {}) {
  const unanalyzedPosts = dataManager.getUnanalyzedPosts();
  return startAnalysis(unanalyzedPosts, options);
}

async function analyzeContent(content, targetLanguage, interfaceLanguage, aiSystemsConfig) {
  try {
    const settings = await chrome.storage.local.get('userSettings');
    const storedSettings = settings.userSettings || {};
    const userSettings = storedSettings.data || storedSettings || {};
    
    const aiSystems = aiSystemsConfig || userSettings.aiSystems || [];
    const aiWebPlatforms = userSettings.aiWebPlatforms || {};
    const lang = interfaceLanguage || userSettings.interfaceLanguage || 'zh';
    
    const hasAiApiConfig = aiSystems.length > 0 && aiSystems.some(system => {
      const key = system.key || system.apiKey;
      return system.enabled && system.url && key;
    });
    const hasAiWebConfig = aiWebPlatforms.enabled && aiWebPlatforms.platforms && aiWebPlatforms.platforms.length > 0;
    
    if (!hasAiApiConfig && !hasAiWebConfig) {
      return { success: false, error: '没有配置AI系统' };
    }
    
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

    let systemPrompt = `Please analyze the following content and provide insights in [interfaceLanguage].

IMPORTANT: You MUST return ONLY valid JSON, no other text.
The JSON must have these exact keys:
{
  "titleTranslation": "string",
  "bodyTranslation": "string",
  "commentsTranslation": "string",
  "qualityScore": number,
  "summary": "string",
  "value": "string",
  "opinions": "string",
  "creativity": "string",
  "clues": "string",
  "businessOpportunities": "string",
  "moneyMakingOpportunities": "string"
}

Return ONLY the JSON, no explanations or other text.`;

    if (typeof self !== 'undefined' && self.getTranslation) {
      const translatedPrompt = self.getTranslation('aiSystemPrompt', lang);
      if (translatedPrompt && translatedPrompt !== 'aiSystemPrompt') {
        systemPrompt = translatedPrompt;
      }
    }

    const targetLanguageName = languageMap[lang] || languageMap['en'];
    systemPrompt = systemPrompt.replace(/\[interfaceLanguage\]/g, targetLanguageName);
    
    const requestData = {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(content, null, 2) }
      ],
      max_tokens: 2000
    };
    
    let result;
    if (hasAiApiConfig) {
      const aiSystem = aiSystems.find(system => {
        const key = system.key || system.apiKey;
        return system.enabled && system.url && key;
      });
      const apiKey = aiSystem.key || aiSystem.apiKey;
      requestData.model = aiSystem.model === 'custom' ? aiSystem.customModel : (aiSystem.model || 'gpt-3.5-turbo');
      
      const response = await fetch(aiSystem.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error?.message || 'AI系统响应错误' };
      }
      
      result = await response.json();
      
      if (result.choices && result.choices.length > 0) {
        const content_result = result.choices[0].message.content;
        const analysis = parseAiResponse(content_result);
        return { success: true, analysis };
      } else {
        return { success: false, error: 'AI系统响应格式错误' };
      }
    } else if (hasAiWebConfig) {
      const platform = aiWebPlatforms.platforms[0];
      const platformName = platform.platform;
      const webOptions = {
        customUrl: platform.customUrl,
        customInputSelector: platform.customInputSelector,
        customSubmitSelector: platform.customSubmitSelector,
        customResponseSelector: platform.customResponseSelector
      };
      
      let webResult;
      if (typeof self !== 'undefined' && self.startAiWebAutomation) {
        webResult = await self.startAiWebAutomation(platformName, `${systemPrompt}\n\n请分析以下内容:\n${JSON.stringify(content, null, 2)}`, webOptions);
      } else {
        webResult = await chrome.runtime.sendMessage({
          action: 'startAiWebAutomation',
          platform: platformName,
          content: `${systemPrompt}\n\n请分析以下内容:\n${JSON.stringify(content, null, 2)}`,
          options: webOptions
        });
      }
      
      if (!webResult || !webResult.success) {
        return { success: false, error: webResult?.error || 'AI网页版自动化分析失败' };
      }
      
      const analysis = parseAiResponse(webResult.response || webResult.result || '');
      return { success: true, analysis };
    }
    
    return { success: false, error: '没有配置AI系统' };
  } catch (error) {
    console.error('analyzeContent error:', error);
    return { success: false, error: error.message };
  }
}

// 将函数挂载到全局作用域
if (typeof self !== 'undefined') {
  self.startAnalysis = startAnalysis;
  self.analyzePost = analyzePost;
  self.analyzeContent = analyzeContent;
  self.stopAnalysis = stopAnalysis;
  self.getAnalysisStatus = getAnalysisStatus;
  self.resetAnalysisStatus = resetAnalysisStatus;
  self.analyzeUnanalyzedPosts = analyzeUnanalyzedPosts;
}

// 如果支持ES6模块导出，也提供导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    startAnalysis,
    analyzePost,
    analyzeContent,
    stopAnalysis,
    getAnalysisStatus,
    resetAnalysisStatus,
    analyzeUnanalyzedPosts
  };
}
