// 辅助函数应该定义在类的外部
const isToday = (timestamp) => {
  const date = new Date(timestamp);
  const today = new Date();
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
};

const isYesterday = (timestamp) => {
  const date = new Date(timestamp);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.getDate() === yesterday.getDate() &&
         date.getMonth() === yesterday.getMonth() &&
         date.getFullYear() === yesterday.getFullYear();
};

export class TabGroupService {
  constructor() {
    this.lastAccessTimes = new Map();
    this.defaultIcon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHJ4PSIyIiBmaWxsPSIjRTJFOEYwIi8+PHBhdGggZD0iTTQgNEgxMlY2SDRWNFoiIGZpbGw9IiM5NEEzQjgiLz48L3N2Zz4=';
  }

  // 更新标签页访问时间
  updateAccessTime(tabId) {
    this.lastAccessTimes.set(tabId, Date.now());
  }

  getInactiveTime(tabId) {
    const lastAccess = this.lastAccessTimes.get(tabId) || Date.now();
    return Date.now() - lastAccess;
  }

  filterTabs(tabs, searchQuery, groupMode) {
    // 首先过滤搜索结果
    let filteredTabs = tabs;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredTabs = tabs.filter(tab => 
        tab.title.toLowerCase().includes(query) || 
        tab.url.toLowerCase().includes(query)
      );
    }

    // 根据分组模式返回不同的分组结果
    switch (groupMode) {
      case 'domain':
        return this.groupByDomain(filteredTabs);
      case 'time':
        return this.groupByLastAccess(filteredTabs);
      case 'ai':
        return this.groupByAI(filteredTabs);
      case 'custom':
        return this.groupByCustom(filteredTabs);
      default:
        return [{
          title: '所有标签页',
          tabs: filteredTabs
        }];
    }
  }

  // 按最近使用时间分组
  groupByLastAccess(tabs) {
    const now = Date.now();
    const groups = [
      { title: '最近访问', tabs: [] },
      { title: '今天访问', tabs: [] },
      { title: '最近7天', tabs: [] },
      { title: '更早', tabs: [] }
    ];

    tabs.forEach(tab => {
      const lastAccessed = tab.lastAccessed || now;
      const diffMinutes = (now - lastAccessed) / (1000 * 60);
      const diffDays = (now - lastAccessed) / (1000 * 60 * 60 * 24);

      if (diffMinutes < 30) {
        groups[0].tabs.push(tab);
      } else if (diffDays < 1) {
        groups[1].tabs.push(tab);
      } else if (diffDays < 7) {
        groups[2].tabs.push(tab);
      } else {
        groups[3].tabs.push(tab);
      }
    });

    // 在每个组内按最后访问时间排序
    groups.forEach(group => {
      group.tabs.sort((a, b) => {
        const aTime = a.lastAccessed || 0;
        const bTime = b.lastAccessed || 0;
        return bTime - aTime; // 降序排列
      });
    });

    // 移除空组
    return groups.filter(group => group.tabs.length > 0);
  }

  // 按域名分组
  groupByDomain(tabs) {
    const groups = new Map();
    
    tabs.forEach(tab => {
      try {
        const url = new URL(tab.url);
        const domain = url.hostname;
        if (!groups.has(domain)) {
          groups.set(domain, {
            title: domain,
            domain: domain,
            tabs: []
          });
        }
        groups.get(domain).tabs.push(tab);
      } catch (e) {
        if (!groups.has('其他')) {
          groups.set('其他', {
            title: '其他',
            domain: '其他',
            tabs: []
          });
        }
        groups.get('其他').tabs.push(tab);
      }
    });

    return Array.from(groups.values());
  }

  // 按标签分组（基于标题关键词）
  groupByTags(tabs) {
    const tags = new Map([
      ['开发', ['github', 'stackoverflow', 'vscode', 'gitlab']],
      ['社交', ['twitter', 'facebook', 'instagram', 'linkedin']],
      ['视频', ['youtube', 'bilibili', 'netflix']],
      ['购物', ['amazon', 'taobao', 'jd']],
      ['文档', ['docs', 'notion', 'confluence']]
    ]);

    const groups = new Map();
    tags.forEach((keywords, tag) => {
      groups.set(tag, { tag, tabs: [] });
    });
    groups.set('其他', { tag: '其他', tabs: [] });

    tabs.forEach(tab => {
      let matched = false;
      for (const [tag, keywords] of tags) {
        if (keywords.some(keyword => 
          tab.url.toLowerCase().includes(keyword) || 
          tab.title.toLowerCase().includes(keyword)
        )) {
          groups.get(tag).tabs.push(tab);
          matched = true;
          break;
        }
      }
      if (!matched) {
        groups.get('其他').tabs.push(tab);
      }
    });

    return Array.from(groups.values()).filter(group => group.tabs.length > 0);
  }

  filterTabsBySearch(tabs, searchParams) {
    const { query, filters } = searchParams;
    if (!query && !filters) return tabs;

    return tabs.filter(tab => {
      // 基础文本搜索
      let matchesSearch = true;
      if (query) {
        const searchText = query.toLowerCase();
        switch (filters.searchType) {
          case 'title':
            matchesSearch = tab.title.toLowerCase().includes(searchText);
            break;
          case 'url':
            matchesSearch = tab.url.toLowerCase().includes(searchText);
            break;
          case 'domain':
            try {
              const domain = new URL(tab.url).hostname;
              matchesSearch = domain.includes(searchText);
            } catch (e) {
              matchesSearch = false;
            }
            break;
          default:
            matchesSearch = tab.title.toLowerCase().includes(searchText) ||
                          tab.url.toLowerCase().includes(searchText);
        }
      }

      // 时间范围过滤
      let matchesTime = true;
      if (filters.timeRange !== 'any') {
        const lastAccess = this.lastAccessTimes.get(tab.id) || Date.now();
        const now = Date.now();
        switch (filters.timeRange) {
          case 'today':
            matchesTime = isToday(lastAccess);
            break;
          case 'yesterday':
            matchesTime = isYesterday(lastAccess);
            break;
          case 'week':
            matchesTime = (now - lastAccess) <= 7 * 24 * 60 * 60 * 1000;
            break;
          case 'month':
            matchesTime = (now - lastAccess) <= 30 * 24 * 60 * 60 * 1000;
            break;
        }
      }

      // 域名过滤
      let matchesDomain = true;
      if (filters.domain) {
        try {
          const tabDomain = new URL(tab.url).hostname;
          matchesDomain = tabDomain.includes(filters.domain.toLowerCase());
        } catch (e) {
          matchesDomain = false;
        }
      }

      return matchesSearch && matchesTime && matchesDomain;
    });
  }

  groupByAI(tabs) {
    // AI分组功能占位，后续实现
    return [{
      title: 'AI分组开发中',
      tabs: tabs
    }];
  }

  groupByCustom(tabs) {
    // 自定义分组功能占位，后续实现
    return [{
      title: '自定义分组开发中',
      tabs: tabs
    }];
  }
} 