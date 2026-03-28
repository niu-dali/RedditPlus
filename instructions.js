/**
 * 操作说明页面脚本
 * 负责加载设置和更新翻译
 */

// 全局变量
let currentLang = null;

/**
 * 加载设置
 * 从扩展中获取用户设置，确定当前语言
 */
async function loadSettings() {
    try {
        // 通过消息传递获取设置
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
        console.error('Error loading settings:', error);
        // 出错时使用浏览器语言检测
        const browserLang = navigator.language || navigator.userLanguage || 'en';
        const langCode = browserLang.split('-')[0].toLowerCase();
        const supportedLangs = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru'];
        currentLang = supportedLangs.includes(langCode) ? langCode : 'en';
        updateTranslations();
    }
}

/**
 * 更新翻译
 * 根据当前语言更新页面上的所有文本内容
 */
function updateTranslations() {
    const getTrans = self.getTranslation || function(key, lang) { return key; };
    const useLang = currentLang || 'en';
    
    // 更新页面标题
    document.title = getTrans('instructionsTitle', useLang) + ' - RedditPlus';
    
    // 更新导航栏
    document.getElementById('appName').textContent = getTrans('appName', useLang) || '灵感';
    document.getElementById('navMain').textContent = getTrans('tabMain', useLang);
    document.getElementById('navInstructions').textContent = getTrans('tabInstructions', useLang);
    document.getElementById('navSettings').textContent = getTrans('tabSettings', useLang);
    document.getElementById('navDonate').textContent = getTrans('tabDonate', useLang);
    
    // 更新操作说明内容
    document.getElementById('instructionsTitle').textContent = getTrans('instructionsTitle', useLang);
    document.getElementById('instructionsOverview').textContent = getTrans('instructionsOverview', useLang);
    document.getElementById('instructionsSection1').textContent = getTrans('instructionsSection1', useLang);
    document.getElementById('instructionsStep1').textContent = getTrans('instructionsStep1', useLang);
    document.getElementById('instructionsStep2').textContent = getTrans('instructionsStep2', useLang);
    document.getElementById('instructionsStep3').textContent = getTrans('instructionsStep3', useLang);
    document.getElementById('instructionsStep4').textContent = getTrans('instructionsStep4', useLang);
    document.getElementById('instructionsSection2').textContent = getTrans('instructionsSection2', useLang);
    document.getElementById('instructionsFeature1').textContent = getTrans('instructionsFeature1', useLang);
    document.getElementById('instructionsFeature2').textContent = getTrans('instructionsFeature2', useLang);
    document.getElementById('instructionsFeature3').textContent = getTrans('instructionsFeature3', useLang);
    document.getElementById('instructionsFeature4').textContent = getTrans('instructionsFeature4', useLang);
    document.getElementById('instructionsSection3').textContent = getTrans('instructionsSection3', useLang);
    document.getElementById('instructionsFAQ1').textContent = getTrans('instructionsFAQ1', useLang);
    document.getElementById('instructionsFAQ1Answer').textContent = getTrans('instructionsFAQ1Answer', useLang);
    document.getElementById('instructionsFAQ2').textContent = getTrans('instructionsFAQ2', useLang);
    document.getElementById('instructionsFAQ2Answer').textContent = getTrans('instructionsFAQ2Answer', useLang);
    document.getElementById('instructionsFAQ3').textContent = getTrans('instructionsFAQ3', useLang);
    document.getElementById('instructionsFAQ3Answer').textContent = getTrans('instructionsFAQ3Answer', useLang);
    document.getElementById('instructionsSection4').textContent = getTrans('instructionsSection4', useLang);
    document.getElementById('instructionsContact').querySelector('p').textContent = getTrans('instructionsContact', useLang);
}

// 初始化
loadSettings();
