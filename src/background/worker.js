import { MemoryService } from '../utils/MemoryService.js';

// 监听安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('TabFlow 扩展已安装');
  
  // 创建 MemoryService 实例
  const memoryService = new MemoryService();
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    console.log('标签页更新:', tab.title);
  }
});

// 监听来自休眠页面的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'restoreTab') {
    const memoryService = new MemoryService();
    memoryService.restoreTab(message.tabId);
  }
});
