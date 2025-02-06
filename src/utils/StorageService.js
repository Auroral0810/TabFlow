export class StorageService {
  static async get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key]);
      });
    });
  }

  static async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }

  static async getCategories() {
    const categories = await this.get('categories');
    return categories || [];
  }

  static async getCategoryRules() {
    const rules = await this.get('categoryRules');
    return rules || {};
  }

  static async getCategoryHistory() {
    const history = await this.get('categoryHistory');
    return history || [];
  }

  static async saveCategories(categories) {
    await this.set('categories', categories);
  }

  static async saveCategoryRules(rules) {
    await this.set('categoryRules', rules);
  }

  static async saveCategoryHistory(history) {
    await this.set('categoryHistory', history);
  }

  static async addToCategoryHistory(tabData, category) {
    const history = await this.getCategoryHistory();
    const newEntry = {
      url: tabData.url,
      title: tabData.title,
      category,
      timestamp: Date.now()
    };
    
    history.unshift(newEntry);
    // 只保留最近1000条记录
    if (history.length > 1000) {
      history.pop();
    }
    
    await this.saveCategoryHistory(history);
  }
} 