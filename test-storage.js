// 测试脚本：检查Chrome存储中的用户设置
chrome.storage.local.get(['userSettings'], function(result) {
  console.log('User settings:', result.userSettings);
  if (result.userSettings && result.userSettings.aiSystems) {
    console.log('AI systems:', result.userSettings.aiSystems);
  } else {
    console.log('No AI systems found');
  }
});
