// 监听安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('TabFlow 扩展已安装');
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    console.log('标签页更新:', tab.title);
  }
});
