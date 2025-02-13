export class MemoryService {
  constructor() {
    this.memoryThreshold = 100 * 1024 * 1024; // 100MB
    this.hibernatedTabs = new Set();
    this.memoryStats = new Map();
    this.lastAccessTimes = new Map();
    this.debuggerConnections = new Map();
    this.autoHibernateEnabled = true;
    
    // 初始化时从存储中加载休眠状态
    this.loadHibernatedState();
    console.log('MemoryService initialized');
    this.initializeListeners();
    this.initializeDebugger();
  }

  async initializeListeners() {
    // 监听标签页更新
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        this.updateTabMemoryInfo(tabId);
        this.lastAccessTimes.set(tabId, Date.now());
      }
    });

    // 监听标签页激活
    chrome.tabs.onActivated.addListener(({ tabId }) => {
      this.lastAccessTimes.set(tabId, Date.now());
    });

    // 定期检查内存使用情况
    setInterval(() => {
      if (this.autoHibernateEnabled) {
        this.checkAndHibernateTabs();
      }
    }, 60000); // 每分钟检查一次
  }

  async initializeDebugger() {
    // 检查是否有 debugger API
    if (!chrome.debugger) {
      console.log('Debugger API not available');
      return;
    }

    try {
      // 改用 chrome.tabs.query 来获取所有标签页
      const tabs = await chrome.tabs.query({});
      console.log('Available tabs:', tabs);
      
      // 为每个标签页附加调试器
      for (const tab of tabs) {
        if (!this.debuggerConnections.has(tab.id)) {
          await this.attachDebugger(tab.id);
        }
      }
    } catch (error) {
      console.error('Failed to initialize debugger:', error);
    }
  }

  async attachDebugger(tabId) {
    if (!chrome.debugger) return;
    
    try {
      // 先检查调试器是否已经附加
      const targets = await new Promise((resolve) => {
        chrome.debugger.getTargets((targets) => resolve(targets || []));
      });
      
      const isAttached = targets.some(t => t.tabId === tabId && t.attached);
      if (isAttached) {
        console.log(`Debugger already attached to tab ${tabId}`);
        this.debuggerConnections.set(tabId, true);
        return;
      }

      await new Promise((resolve, reject) => {
        chrome.debugger.attach({ tabId }, '1.3', () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });

      console.log(`Debugger attached to tab ${tabId}`);
      
      // 启用内存相关的域
      await new Promise((resolve, reject) => {
        chrome.debugger.sendCommand({ tabId }, 'Memory.enable', {}, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });

      this.debuggerConnections.set(tabId, true);
    } catch (error) {
      console.error(`Failed to attach debugger to tab ${tabId}:`, error);
    }
  }

  getInactiveTime(tabId) {
    const lastAccess = this.lastAccessTimes.get(tabId) || Date.now();
    return Date.now() - lastAccess;
  }

  async updateTabMemoryInfo(tabId) {
    try {
      await this.cleanupStaleData();
      console.log(`Updating memory info for tab ${tabId}`);
      
      let tab;
      try {
        tab = await chrome.tabs.get(tabId);
      } catch (error) {
        console.log(`Tab ${tabId} not found:`, error);
        this.memoryStats.delete(tabId);
        return null;
      }

      // 检查是否有权限访问该页面
      const hasPermission = await this.checkTabPermission(tab.url);
      if (!hasPermission) {
        console.log(`No permission to access tab ${tabId}: ${tab.url}`);
        const memoryInfo = this.createMemoryInfo(tabId, tab, 0);
        this.memoryStats.set(tabId, memoryInfo);
        return memoryInfo;
      }

      // 检查是否是 chrome:// URL
      if (tab.url.startsWith('chrome://')) {
        console.log(`Skipping chrome:// URL for tab ${tabId}`);
        return {
          memory: '0MB',
          totalJS: 0,
          timestamp: Date.now()
        };
      }

      // 使用 chrome.scripting.executeScript 获取 performance.memory
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          if (performance && performance.memory) {
            return {
              usedJSHeapSize: performance.memory.usedJSHeapSize,
              totalJSHeapSize: performance.memory.totalJSHeapSize,
              jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
            };
          }
          return null;
        }
      });

      if (results && results[0] && results[0].result) {
        const memoryData = results[0].result;
        const totalJS = Math.round(memoryData.totalJSHeapSize / (1024 * 1024));
        
        console.log(`Tab ${tabId} memory info:`, {
          usedJS: `${Math.round(memoryData.usedJSHeapSize / (1024 * 1024))}MB`,
          totalJS: `${totalJS}MB`,
          limitJS: `${Math.round(memoryData.jsHeapSizeLimit / (1024 * 1024))}MB`
        });

        const memoryInfo = {
          memory: `${totalJS}MB`,  // 直接存储格式化的字符串
          totalJS: totalJS,        // 存储数值用于计算
          timestamp: Date.now()
        };

        this.memoryStats.set(tabId, memoryInfo);
        return memoryInfo;
      }

      // 如果无法获取 performance.memory 数据
      return {
        memory: '0MB',
        totalJS: 0,
        timestamp: Date.now()
      };

    } catch (error) {
      console.log('Error in updateTabMemoryInfo:', error);
      const errorInfo = this.createMemoryInfo(tabId, null, 0);
      this.memoryStats.set(tabId, errorInfo);
      return errorInfo;
    }
  }

  async getMemoryInfo(tabId) {
    try {
      // 获取堆内存统计
      const heapStats = await chrome.debugger.sendCommand(
        { tabId },
        'Memory.getDOMCounters'
      );

      // 获取详细的内存使用情况
      const memoryInfo = await chrome.debugger.sendCommand(
        { tabId },
        'Memory.getPressureLevel'
      );

      return {
        ...heapStats,
        pressureLevel: memoryInfo.level,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`Failed to get memory info for tab ${tabId}:`, error);
      return null;
    }
  }

  async getTabLastAccess(tabId) {
    try {
      // 尝试从存储中获取上次访问时间
      const data = await chrome.storage.local.get(`lastAccess_${tabId}`);
      const storedTime = data[`lastAccess_${tabId}`];
      
      if (storedTime) {
        return storedTime;
      }
      
      // 如果没有存储的时间，使用当前时间
      const currentTime = Date.now();
      await chrome.storage.local.set({ [`lastAccess_${tabId}`]: currentTime });
      return currentTime;
    } catch (error) {
      console.error('Error getting last access time:', error);
      return Date.now();
    }
  }

  async checkAndHibernateTabs() {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (this.shouldHibernate(tab)) {
        await this.hibernateTab(tab);
      }
    }
  }

  shouldHibernate(tab) {
    if (tab.active || tab.pinned || this.hibernatedTabs.has(tab.id)) {
      return false;
    }

    const memoryInfo = this.memoryStats.get(tab.id);
    const inactiveTime = this.getInactiveTime(tab.id);

    return memoryInfo &&
           memoryInfo.usedJSHeapSize > this.memoryThreshold &&
           inactiveTime > 30 * 60 * 1000; // 30分钟未使用
  }

  async hibernateTab(tab) {
    try {
      // 保存标签页信息
      await chrome.storage.local.set({
        [`hibernated_${tab.id}`]: {
          url: tab.url,
          title: tab.title,
          timestamp: Date.now()
        }
      });

      // 将标签页替换为休眠页面
      const hibernateUrl = chrome.runtime.getURL('/hibernate.html');
      await chrome.tabs.update(tab.id, { url: hibernateUrl });

      this.hibernatedTabs.add(tab.id);
      await this.saveHibernatedState(); // 保存状态
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
        await this.saveHibernatedState(); // 保存状态
        this.memoryStats.delete(tabId);
      }
    } catch (error) {
      console.error('恢复标签页失败:', error);
    }
  }

  setAutoHibernate(enabled) {
    this.autoHibernateEnabled = enabled;
  }

  setMemoryThreshold(threshold) {
    this.memoryThreshold = threshold * 1024 * 1024; // 转换为字节
  }

  getTabMemoryStats(tabId) {
    const stats = this.memoryStats.get(tabId);
    if (!stats) {
      return {
        memory: '0MB',
        totalJS: 0,
        timestamp: Date.now()
      };
    }
    return stats;  // 直接返回存储的数据
  }

  isTabHibernated(tabId) {
    return this.hibernatedTabs.has(tabId);
  }

  async updateLastAccess(tabId) {
    const currentTime = Date.now();
    this.lastAccessTimes.set(tabId, currentTime);
    await chrome.storage.local.set({ [`lastAccess_${tabId}`]: currentTime });
  }

  async detachDebugger(tabId) {
    if (this.debuggerConnections.has(tabId)) {
      try {
        await chrome.debugger.detach({ tabId });
        this.debuggerConnections.delete(tabId);
        console.log(`Debugger detached from tab ${tabId}`);
      } catch (error) {
        console.error(`Failed to detach debugger from tab ${tabId}:`, error);
      }
    }
  }

  getSystemMemoryUsage() {
    let totalMemory = 0;
    for (const stats of this.memoryStats.values()) {
      totalMemory += stats.totalJS || 0;  // 使用 totalJS 数值
    }
    return totalMemory;
  }

  // 添加权限检查方法
  async checkTabPermission(url) {
    try {
      // 检查是否是受限URL
      if (url.startsWith('chrome://') || 
          url.startsWith('chrome-extension://') ||
          url.startsWith('edge://') ||
          url.startsWith('about:') ||
          url.startsWith('file://')) {
        return false;
      }

      // 检查是否有权限
      const result = await chrome.permissions.contains({
        origins: [new URL(url).origin + '/*']
      });

      if (!result) {
        // 如果没有权限，尝试请求权限
        try {
          const granted = await chrome.permissions.request({
            origins: [new URL(url).origin + '/*']
          });
          return granted;
        } catch (error) {
          console.log('Permission request failed:', error);
          return false;
        }
      }

      return result;
    } catch (error) {
      console.log('Error checking permission:', error);
      return false;
    }
  }

  async cleanupStaleData() {
    try {
      // 清理已关闭标签页的数据
      const existingTabs = await chrome.tabs.query({});
      const existingTabIds = new Set(existingTabs.map(tab => tab.id));
      
      // 清理内存统计数据
      for (const tabId of this.memoryStats.keys()) {
        if (!existingTabIds.has(tabId)) {
          this.memoryStats.delete(tabId);
        }
      }
      
      // 清理最后访问时间数据
      for (const tabId of this.lastAccessTimes.keys()) {
        if (!existingTabIds.has(tabId)) {
          this.lastAccessTimes.delete(tabId);
        }
      }
      
      // 清理休眠标签页数据
      for (const tabId of this.hibernatedTabs) {
        if (!existingTabIds.has(tabId)) {
          this.hibernatedTabs.delete(tabId);
        }
      }
    } catch (error) {
      console.error('清理过期数据失败:', error);
    }
  }

  createMemoryInfo(tabId, tab, memoryValue) {
    return {
      memory: `${memoryValue}MB`,
      totalJS: memoryValue,
      timestamp: Date.now()
    };
  }

  async getFavicon(tab) {
    try {
      // 使用 chrome.tabs API 获取标签页信息
      const tabInfo = await chrome.tabs.get(tab.id);
      if (tabInfo.favIconUrl) {
        return tabInfo.favIconUrl;
      }
      
      // 如果没有直接的 favicon，尝试从页面中获取
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // 尝试获取页面中的 favicon
          const link = document.querySelector('link[rel*="icon"]');
          return link ? link.href : null;
        }
      });
      
      if (results && results[0] && results[0].result) {
        return results[0].result;
      }
      
      // 如果都没有找到，返回空字符串
      return '';
    } catch (error) {
      console.log('获取 favicon 失败:', error);
      return '';
    }
  }

  // 加载休眠状态
  async loadHibernatedState() {
    try {
      const result = await chrome.storage.local.get('hibernatedTabs');
      if (result.hibernatedTabs) {
        this.hibernatedTabs = new Set(result.hibernatedTabs);
      }
    } catch (error) {
      console.error('加载休眠状态失败:', error);
    }
  }

  // 保存休眠状态
  async saveHibernatedState() {
    try {
      await chrome.storage.local.set({
        hibernatedTabs: Array.from(this.hibernatedTabs)
      });
    } catch (error) {
      console.error('保存休眠状态失败:', error);
    }
  }
} 