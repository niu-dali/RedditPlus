/**
 * AI网页版自动化模块
 * 支持ChatGPT、Claude、Gemini等AI网页版的自动输入和结果提取
 */

let aiWebAutomation = {
  isRunning: false,
  currentPlatform: null,
  currentTabId: null,
  pendingTask: null,
  responseCallback: null
};

function getAiWebAutomationStatus() {
  return { ...aiWebAutomation };
}

async function startAiWebAutomation(platform, content, options = {}) {
  if (aiWebAutomation.isRunning) {
    return { success: false, error: 'Another AI web automation is already running' };
  }

  aiWebAutomation.isRunning = true;
  aiWebAutomation.currentPlatform = platform;
  aiWebAutomation.pendingTask = { content, options };

  try {
    const platformConfig = AI_WEB_PLATFORMS[platform];
    if (!platformConfig) {
      throw new Error(`Unknown platform: ${platform}`);
    }

    const url = options.customUrl || platformConfig.url;
    if (!url) {
      throw new Error('No URL specified for AI web platform');
    }

    const tab = await chrome.tabs.create({ url, active: true });
    aiWebAutomation.currentTabId = tab.id;

    // 监听标签页加载完成
    const tabUpdateListener = async (tabId, changeInfo) => {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(tabUpdateListener);
        
        try {
          // 等待页面完全加载
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // 检查标签页是否仍然存在
          try {
            const currentTab = await chrome.tabs.get(tab.id);
            if (!currentTab) {
              throw new Error('Tab no longer exists');
            }
          } catch (tabError) {
            handleAiWebAutomationComplete({ success: false, error: 'Tab was closed or navigation failed' });
            return;
          }
          
          // 执行注入和自动化
          const result = await injectAndExecuteAiWebAutomation(tab.id, content, options);
          
          // 处理结果
          if (result.success) {
            handleAiWebAutomationComplete(result);
          } else {
            handleAiWebAutomationComplete({ success: false, error: result.error });
          }
        } catch (error) {
          handleAiWebAutomationComplete({ success: false, error: error.message });
        }
      }
    };
    
    chrome.tabs.onUpdated.addListener(tabUpdateListener);

    return new Promise((resolve, reject) => {
      aiWebAutomation.responseCallback = { resolve, reject };
      
      setTimeout(() => {
        if (aiWebAutomation.isRunning) {
          chrome.tabs.onUpdated.removeListener(tabUpdateListener);
          // 关闭标签页
          if (aiWebAutomation.currentTabId) {
            chrome.tabs.remove(aiWebAutomation.currentTabId).catch(() => {});
          }
          aiWebAutomation.isRunning = false;
          reject(new Error('AI web automation timeout'));
        }
      }, platformConfig.maxWaitTime || 120000);
    });
  } catch (error) {
    // 关闭标签页
    if (aiWebAutomation.currentTabId) {
      chrome.tabs.remove(aiWebAutomation.currentTabId).catch(() => {});
    }
    aiWebAutomation.isRunning = false;
    return { success: false, error: error.message };
  }
}

async function injectAndExecuteAiWebAutomation(tabId, content, options) {
  try {
    const platform = aiWebAutomation.currentPlatform;
    const platformConfig = AI_WEB_PLATFORMS[platform];
    
    if (!platformConfig) {
      throw new Error(`Platform configuration not found: ${platform}`);
    }
    
    const customSelectors = {
      inputSelector: options.customInputSelector || platformConfig.inputSelector,
      submitSelector: options.customSubmitSelector || platformConfig.submitSelector,
      responseSelector: options.customResponseSelector || platformConfig.responseSelector
    };

    // 检查标签页是否存在
    try {
      await chrome.tabs.get(tabId);
    } catch (tabError) {
      throw new Error('Tab no longer exists or was closed');
    }

    let results;
    try {
      results = await chrome.scripting.executeScript({
        target: { tabId },
        function: performAiWebAutomation,
        args: [content, customSelectors, platformConfig.waitForResponse]
      });
    } catch (scriptError) {
      if (scriptError.message && scriptError.message.includes('Frame with ID')) {
        throw new Error('Tab was closed during script execution');
      }
      throw scriptError;
    }

    // 检查结果是否存在
    if (!results || !results[0]) {
      throw new Error('Script execution failed: no result returned');
    }
    
    // chrome.scripting.executeScript 返回的结果在 result 属性中
    const executionResult = results[0].result;
    
    // 检查结果格式
    if (executionResult && typeof executionResult === 'object' && 'success' in executionResult) {
      return executionResult;
    }
    
    // 如果结果格式不对，返回错误
    return { 
      success: false, 
      error: 'Script execution returned invalid result format: ' + JSON.stringify(executionResult)
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function performAiWebAutomation(content, selectors, waitForResponse) {
  return new Promise((resolve, reject) => {
    const findElement = (selectorStr, timeout = 30000) => {
      return new Promise((findResolve, findReject) => {
        const selectorList = selectorStr.split(',').map(s => s.trim());
        let element = null;
        
        // 尝试查找元素的函数
        const tryFind = (sel) => {
          try {
            if (sel.startsWith('/')) {
              // 处理XPath选择器
              const result = document.evaluate(sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
              return result.singleNodeValue;
            } else {
              // 处理CSS选择器
              return document.querySelector(sel);
            }
          } catch (e) {
            // 忽略无效选择器错误
            console.log('Error with selector', sel, e.message);
            return null;
          }
        };
        
        // 首先尝试查找元素
        for (const sel of selectorList) {
          element = tryFind(sel);
          if (element) break;
        }
        
        if (element) {
          findResolve(element);
          return;
        }

        const startTime = Date.now();
        const interval = setInterval(() => {
          for (const sel of selectorList) {
            element = tryFind(sel);
            if (element) {
              clearInterval(interval);
              findResolve(element);
              return;
            }
          }

          if (Date.now() - startTime > timeout) {
            clearInterval(interval);
            // 输出调试信息
            console.log('Available elements on page:');
            console.log('All textareas:', document.querySelectorAll('textarea').length);
            console.log('All contenteditable:', document.querySelectorAll('[contenteditable="true"]').length);
            console.log('All inputs:', document.querySelectorAll('input').length);
            console.log('Page URL:', window.location.href);
            findReject(new Error(`Element not found: ${selectorStr}`));
          }
        }, 500);
      });
    };

    const simulateTyping = async (element, text) => {
      element.focus();
      
      if (element.isContentEditable || element.contentEditable === 'true') {
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          document.execCommand('insertText', false, lines[i]);
          if (i < lines.length - 1) {
            document.execCommand('insertLineBreak', false, null);
          }
        }
      } else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        element.value = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      await new Promise(r => setTimeout(r, 100));
    };

    const clickSubmit = async (button) => {
      try {
        // 确保按钮可见
        if (button.offsetParent === null) {
          console.log('Button is not visible:', button);
        }
        
        // 聚焦按钮
        button.focus();
        await new Promise(r => setTimeout(r, 100));
        
        // 模拟鼠标移动到按钮
        const rect = button.getBoundingClientRect();
        const mouseMoveEvent = new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2
        });
        button.dispatchEvent(mouseMoveEvent);
        await new Promise(r => setTimeout(r, 100));
        
        // 模拟鼠标按下
        const mouseDownEvent = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2
        });
        button.dispatchEvent(mouseDownEvent);
        await new Promise(r => setTimeout(r, 100));
        
        // 模拟鼠标释放
        const mouseUpEvent = new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2
        });
        button.dispatchEvent(mouseUpEvent);
        await new Promise(r => setTimeout(r, 100));
        
        // 模拟点击
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2
        });
        button.dispatchEvent(clickEvent);
        
        console.log('Button clicked successfully:', button);
        await new Promise(r => setTimeout(r, 1000)); // 给更多时间处理点击
      } catch (error) {
        console.log('Error clicking button:', error);
        // 作为备用，使用简单的点击
        button.click();
        await new Promise(r => setTimeout(r, 1000));
      }
    };

    // 检查登录状态
    async function checkLoginStatus() {
      try {
        // 检查常见的登录元素
        const loginSelectors = [
          'button:contains("登录"), button:contains("Sign in"), button:contains("Log in")',
          'a:contains("登录"), a:contains("Sign in"), a:contains("Log in")',
          'input[type="email"], input[type="password"]',
          '.login-form, .signin-form, .login-page',
          '[data-testid="login-button"], [data-testid="signin-button"]'
        ];
        
        // 检查是否存在登录元素
        for (const selector of loginSelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              console.log('Found login elements:', selector);
              return false;
            }
          } catch (e) {
            // 忽略无效选择器错误
          }
        }
        
        // 检查是否存在用户头像或登录状态指示器
        const userSelectors = [
          '.user-avatar, .avatar, .user-profile',
          '[data-testid="user-avatar"], [data-testid="profile-button"]',
          '.logged-in, .user-logged-in'
        ];
        
        for (const selector of userSelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              console.log('Found user elements, logged in:', selector);
              return true;
            }
          } catch (e) {
            // 忽略无效选择器错误
          }
        }
        
        // 对于DeepSeek特定检查
        if (window.location.hostname.includes('deepseek')) {
          // 检查是否存在聊天界面元素
          const chatElements = document.querySelectorAll('.chat-container, .message-list, .chat-input');
          if (chatElements.length > 0) {
            console.log('DeepSeek: Found chat elements, likely logged in');
            return true;
          }
          // 检查是否存在登录页面元素
          const loginElements = document.querySelectorAll('.login-page, .signin-form');
          if (loginElements.length > 0) {
            console.log('DeepSeek: Found login elements, not logged in');
            return false;
          }
        }
        
        // 默认假设已登录
        console.log('No login elements found, assuming logged in');
        return true;
      } catch (error) {
        console.log('Error checking login status:', error);
        // 出错时默认假设已登录
        return true;
      }
    }

    const waitForResponse_complete = (responseSelector, maxWait = 120000) => {
      return new Promise((waitResolve, waitReject) => {
        const startTime = Date.now();
        let lastResponseText = '';
        let stableCount = 0;
        let messageElements = [];
        
        const checkResponse = () => {
          try {
            // 尝试获取所有匹配的消息元素
            const selectorList = responseSelector.split(',').map(s => s.trim());
            let allElements = [];
            
            for (const sel of selectorList) {
              try {
                if (sel.startsWith('/')) {
                  // 处理XPath选择器
                  const result = document.evaluate(sel, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                  for (let i = 0; i < result.snapshotLength; i++) {
                    allElements.push(result.snapshotItem(i));
                  }
                } else {
                  // 处理CSS选择器
                  const elements = document.querySelectorAll(sel);
                  elements.forEach(el => allElements.push(el));
                }
              } catch (e) {
                // 忽略无效选择器错误
                console.log('Error with selector', sel, e.message);
              }
            }
            
            // 去重
            allElements = [...new Set(allElements)];
            
            console.log('Found', allElements.length, 'message elements');
            
            if (allElements.length > 0) {
              // 按出现顺序排序，通常最后一个是最新的
              allElements.sort((a, b) => {
                const rectA = a.getBoundingClientRect();
                const rectB = b.getBoundingClientRect();
                return rectB.top - rectA.top; // 位置靠下的元素在前面
              });
              
              // 尝试找到AI回复（通常是最后一个或非用户输入的消息）
              let responseElement = null;
              let currentText = '';
              
              for (const element of allElements) {
                // 对于Claude.ai，优先使用带有font-claude-response类的元素
                if (element.classList && element.classList.contains('font-claude-response')) {
                  const text = element.innerText || element.textContent || element.innerHTML;
                  if (text && text.length > 5) {
                    responseElement = element;
                    currentText = text;
                    break;
                  }
                }
                
                const text = element.innerText || element.textContent || element.innerHTML;
                if (text && text.length > 5) {
                  // 检查是否包含用户输入的内容
                  if (!text.includes(content)) {
                    responseElement = element;
                    currentText = text;
                    break;
                  }
                }
              }
              
              // 如果没有找到不包含用户输入的元素，就使用最后一个元素
              if (!responseElement && allElements.length > 0) {
                responseElement = allElements[0];
                currentText = responseElement.innerText || responseElement.textContent || responseElement.innerHTML;
              }
              
              // 对于Claude.ai，尝试从font-claude-response-body元素中提取文本
              if (!responseElement && allElements.length > 0) {
                const bodyElements = document.querySelectorAll('.font-claude-response-body');
                if (bodyElements.length > 0) {
                  let bodyText = '';
                  bodyElements.forEach(el => {
                    bodyText += (el.innerText || el.textContent || '') + '\n';
                  });
                  if (bodyText && bodyText.length > 5) {
                    currentText = bodyText;
                    responseElement = bodyElements[0];
                  }
                }
              }
              
              if (responseElement && currentText) {
                console.log('Found response element:', responseElement);
                console.log('Current response text length:', currentText.length);
                console.log('Current response text preview:', currentText.substring(0, 100) + '...');
                
                if (currentText.length > 5) {
                  if (currentText === lastResponseText) {
                    stableCount++;
                    if (stableCount >= 3) {
                      console.log('Response stabilized, returning:', currentText.substring(0, 100) + '...');
                      waitResolve(currentText);
                      return;
                    }
                  } else {
                    stableCount = 0;
                    lastResponseText = currentText;
                    console.log('Response updated, waiting for stabilization');
                  }
                }
              }
            }
            
            if (Date.now() - startTime > maxWait) {
              if (lastResponseText && lastResponseText.length > 5) {
                console.log('Timeout but got partial response:', lastResponseText.substring(0, 100) + '...');
                waitResolve(lastResponseText);
              } else {
                console.log('Response timeout with no content');
                waitReject(new Error('Response timeout'));
              }
              return;
            }
            
            setTimeout(checkResponse, 1000);
          } catch (error) {
            console.log('Error in checkResponse:', error.message);
            if (Date.now() - startTime > maxWait) {
              waitReject(new Error('Response check failed'));
              return;
            }
            setTimeout(checkResponse, 1000);
          }
        };
        
        console.log('Starting to wait for response with selector:', responseSelector);
        setTimeout(checkResponse, waitForResponse || 3000);
      });
    };

    (async () => {
      try {
        // 检查是否需要登录
        const isLoggedIn = await checkLoginStatus();
        if (!isLoggedIn) {
          resolve({
            success: false,
            error: '请先登录AI系统'
          });
          return;
        }
        
        const inputElement = await findElement(selectors.inputSelector);
        await simulateTyping(inputElement, content);
        
        const submitButton = await findElement(selectors.submitSelector);
        await clickSubmit(submitButton);
        
        const responseText = await waitForResponse_complete(selectors.responseSelector);
        
        resolve({
          success: true,
          response: responseText
        });
      } catch (error) {
        resolve({
          success: false,
          error: error.message || error
        });
      }
    })();
  });
}

function handleAiWebAutomationComplete(result) {
  try {
    if (aiWebAutomation.responseCallback) {
      if (result.success) {
        aiWebAutomation.responseCallback.resolve(result);
      } else {
        aiWebAutomation.responseCallback.reject(new Error(result.error));
      }
    }
  } catch (callbackError) {
    console.error('Error in response callback:', callbackError);
  }
  
  // 关闭标签页
  if (aiWebAutomation.currentTabId) {
    chrome.tabs.remove(aiWebAutomation.currentTabId).catch(() => {});
  }
  
  aiWebAutomation.isRunning = false;
  aiWebAutomation.currentPlatform = null;
  aiWebAutomation.currentTabId = null;
  aiWebAutomation.pendingTask = null;
  aiWebAutomation.responseCallback = null;
}

function cancelAiWebAutomation() {
  if (aiWebAutomation.currentTabId) {
    chrome.tabs.remove(aiWebAutomation.currentTabId).catch(() => {});
  }
  
  if (aiWebAutomation.responseCallback) {
    aiWebAutomation.responseCallback.reject(new Error('AI web automation cancelled'));
  }
  
  aiWebAutomation.isRunning = false;
  aiWebAutomation.currentPlatform = null;
  aiWebAutomation.currentTabId = null;
  aiWebAutomation.pendingTask = null;
  aiWebAutomation.responseCallback = null;
}

if (typeof self !== 'undefined') {
  self.aiWebAutomation = aiWebAutomation;
  self.getAiWebAutomationStatus = getAiWebAutomationStatus;
  self.startAiWebAutomation = startAiWebAutomation;
  self.injectAndExecuteAiWebAutomation = injectAndExecuteAiWebAutomation;
  self.handleAiWebAutomationComplete = handleAiWebAutomationComplete;
  self.cancelAiWebAutomation = cancelAiWebAutomation;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    aiWebAutomation,
    getAiWebAutomationStatus,
    startAiWebAutomation,
    injectAndExecuteAiWebAutomation,
    handleAiWebAutomationComplete,
    cancelAiWebAutomation
  };
}
