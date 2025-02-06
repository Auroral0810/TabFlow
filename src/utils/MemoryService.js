export class MemoryService {
  constructor() {
    this.memoryThreshold = 100 * 1024 * 1024; // 100MB
    this.hibernatedTabs = new Set();
  }

  async getTabMemoryInfo(tabId) {
    try {
      const processInfo = await chrome.processes.getProcessIdForTab(tabId);
      const memoryInfo = await chrome.processes.getProcessInfo([processInfo], {
        memory: true
      });
      return memoryInfo[processInfo].privateMemory;
    } catch (error) {
      console.error('获取内存信息失败:', error);
      return 0;
    }
  }

  async checkAndHibernateTabs() {
    const tabs = await chrome.tabs.query({});
    
    for (const tab of tabs) {
      const memoryUsage = await this.getTabMemoryInfo(tab.id);
      
      if (memoryUsage > this.memoryThreshold && !this.hibernatedTabs.has(tab.id)) {
        await this.hibernateTab(tab);
      }
    }
  }

  async hibernateTab(tab) {
    try {
      // 保存标签页状态
      await chrome.storage.local.set({
        [`hibernated_${tab.id}`]: {
          url: tab.url,
          title: tab.title,
          favicon: tab.favIconUrl,
          timestamp: Date.now()
        }
      });

      // 将标签页替换为占位页面
      await chrome.tabs.update(tab.id, {
        url: chrome.runtime.getURL('hibernate.html')
      });

      this.hibernatedTabs.add(tab.id);
    } catch (error) {
      console.error('休眠标签页失败:', error);
    }
  }

  async restoreTab(tabId) {
    try {
      const data = await chrome.storage.local.get(`hibernated_${tabId}`);
      const tabInfo = data[`hibernated_${tabId}`];
      
      if (tabInfo) {
        await chrome.tabs.update(tabId, { url: tabInfo.url });
        await chrome.storage.local.remove(`hibernated_${tabId}`);
        this.hibernatedTabs.delete(tabId);
      }
    } catch (error) {
      console.error('恢复标签页失败:', error);
    }
  }
} 