/**
 * AI网页版Content Script
 * 用于在ChatGPT、Claude、Gemini等AI网页版中自动输入内容和提取结果
 */

(function() {
  'use strict';

  const platformSelectors = {
    'chat.openai.com': {
      inputSelector: '#prompt-textarea, div[contenteditable="true"][data-placeholder], textarea[placeholder*="Message"]',
      submitSelector: 'button[data-testid="send-button"], button[aria-label="Send"], button[type="submit"]',
      responseSelector: '.markdown, div[data-message-author-role="assistant"], .prose',
      newChatSelector: 'button[data-testid="create-new-chat"], a[href="/c/new"]'
    },
    'chatgpt.com': {
      inputSelector: '#prompt-textarea, div[contenteditable="true"][data-placeholder], textarea[placeholder*="Message"]',
      submitSelector: 'button[data-testid="send-button"], button[aria-label="Send"], button[type="submit"]',
      responseSelector: '.markdown, div[data-message-author-role="assistant"], .prose',
      newChatSelector: 'button[data-testid="create-new-chat"], a[href="/c/new"]'
    },
    'claude.ai': {
      inputSelector: 'div[contenteditable="true"], textarea[placeholder*="Message"], div.ProseMirror, p.is-empty',
      submitSelector: 'button[aria-label="Send Message"], button[type="submit"], button:has(svg)',
      responseSelector: '.font-claude-message, div[data-testid="assistant-message"], .prose',
      newChatSelector: 'button[aria-label="New chat"], a[href="/"]'
    },
    'gemini.google.com': {
      inputSelector: 'div.ql-editor, textarea[aria-label*="Enter a prompt"], rich-textarea, div[contenteditable="true"]',
      submitSelector: 'button[aria-label="Send message"], button[data-test-id="send-button"], button:has(mat-icon)',
      responseSelector: '.model-response-text, message-content, .response-text',
      newChatSelector: 'button[aria-label="New chat"], button[data-test-id="new-chat"]'
    },
    'chat.deepseek.com': {
      inputSelector: 'textarea[placeholder*="输入"], textarea[placeholder*="Enter"], div[contenteditable="true"], .input-area textarea',
      submitSelector: 'button[type="submit"], button:has(svg), button[aria-label*="发送"], button[aria-label*="Send"], .send-button',
      responseSelector: '.message-content, .response-text, .markdown, .assistant-message',
      newChatSelector: 'button[aria-label*="新建"], button[aria-label*="New"], .new-chat-button'
    }
  };

  let currentPlatform = null;
  let currentSelectors = null;

  function detectPlatform() {
    const hostname = window.location.hostname;
    for (const [platform, selectors] of Object.entries(platformSelectors)) {
      if (hostname.includes(platform)) {
        currentPlatform = platform;
        currentSelectors = selectors;
        return platform;
      }
    }
    return null;
  }

  function findElement(selectorStr, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const selectors = selectorStr.split(',').map(s => s.trim());
      let element = null;
      
      for (const sel of selectors) {
        element = document.querySelector(sel);
        if (element) {
          resolve(element);
          return;
        }
      }

      const startTime = Date.now();
      const interval = setInterval(() => {
        for (const sel of selectors) {
          element = document.querySelector(sel);
          if (element) {
            clearInterval(interval);
            resolve(element);
            return;
          }
        }

        if (Date.now() - startTime > timeout) {
          clearInterval(interval);
          reject(new Error(`Element not found: ${selectorStr}`));
        }
      }, 200);
    });
  }

  async function simulateTyping(element, text) {
    element.focus();
    
    if (element.isContentEditable || element.contentEditable === 'true') {
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      
      await new Promise(r => setTimeout(r, 100));
      
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        document.execCommand('insertText', false, lines[i]);
        if (i < lines.length - 1) {
          const shiftEnter = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            shiftKey: true,
            bubbles: true
          });
          element.dispatchEvent(shiftEnter);
          await new Promise(r => setTimeout(r, 50));
        }
      }
    } else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    await new Promise(r => setTimeout(r, 200));
  }

  async function clickSubmit(button) {
    button.click();
    await new Promise(r => setTimeout(r, 500));
  }

  function waitForResponse(responseSelector, maxWait = 120000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let lastResponseText = '';
      let stableCount = 0;
      let responseStarted = false;
      
      const checkResponse = () => {
        findElement(responseSelector, 1000)
          .then(responseElement => {
            const currentText = responseElement.innerText || responseElement.textContent;
            
            if (currentText && currentText.length > 10) {
              responseStarted = true;
              
              if (currentText === lastResponseText) {
                stableCount++;
                if (stableCount >= 3) {
                  resolve(currentText);
                  return;
                }
              } else {
                stableCount = 0;
                lastResponseText = currentText;
              }
            }
            
            if (Date.now() - startTime > maxWait) {
              if (lastResponseText && lastResponseText.length > 10) {
                resolve(lastResponseText);
              } else {
                reject(new Error('Response timeout'));
              }
              return;
            }
            
            setTimeout(checkResponse, 1000);
          })
          .catch(() => {
            if (Date.now() - startTime > maxWait) {
              if (lastResponseText && lastResponseText.length > 10) {
                resolve(lastResponseText);
              } else {
                reject(new Error('Response element not found'));
              }
              return;
            }
            setTimeout(checkResponse, 1000);
          });
      };
      
      setTimeout(checkResponse, 3000);
    });
  }

  async function startNewChat() {
    if (!currentSelectors || !currentSelectors.newChatSelector) return;
    
    try {
      const newChatButton = await findElement(currentSelectors.newChatSelector, 2000);
      if (newChatButton) {
        newChatButton.click();
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (e) {
      console.log('Could not start new chat:', e);
    }
  }

  async function performAutomation(content, options = {}) {
    if (!currentSelectors) {
      return { success: false, error: 'Platform not detected' };
    }

    try {
      const inputSelector = options.inputSelector || currentSelectors.inputSelector;
      const submitSelector = options.submitSelector || currentSelectors.submitSelector;
      const responseSelector = options.responseSelector || currentSelectors.responseSelector;

      await startNewChat();

      const inputElement = await findElement(inputSelector, 15000);
      await simulateTyping(inputElement, content);
      
      const submitButton = await findElement(submitSelector, 5000);
      await clickSubmit(submitButton);
      
      const responseText = await waitForResponse(responseSelector, options.maxWait || 120000);
      
      return {
        success: true,
        response: responseText
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  detectPlatform();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'ping') {
      sendResponse({ 
        success: true, 
        platform: currentPlatform,
        url: window.location.href 
      });
      return true;
    }

    if (message.action === 'performAiWebAutomation') {
      performAutomation(message.content, message.options || {})
        .then(result => {
          sendResponse(result);
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }

    if (message.action === 'getPlatformInfo') {
      sendResponse({
        platform: currentPlatform,
        selectors: currentSelectors
      });
      return true;
    }
  });

  console.log('AI Web Content Script loaded for:', currentPlatform);
})();
