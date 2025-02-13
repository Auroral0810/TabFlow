document.addEventListener('DOMContentLoaded', () => {
  const restoreButton = document.getElementById('restore');
  
  restoreButton.addEventListener('click', async () => {
    try {
      const tab = await chrome.tabs.getCurrent();
      await chrome.runtime.sendMessage({ 
        type: 'restoreTab', 
        tabId: tab.id 
      });
    } catch (error) {
      console.error('恢复标签页失败:', error);
    }
  });
}); 