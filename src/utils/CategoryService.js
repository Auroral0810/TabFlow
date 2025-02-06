import * as tf from '@tensorflow/tfjs';
import { StorageService } from './StorageService';

export class CategoryService {
  constructor() {
    this.categories = [
      '工作',
      '学习',
      '开发',
      '文档',
      '社交',
      '娱乐',
      '购物',
      '新闻',
      '金融',
      '工具',
      '设计',
      '阅读',
      '视频',
      '音乐',
      '邮件',
      '其他'
    ];
    
    this.keywordMap = {
      '工作': ['docs.google.com', 'sheets', 'notion.so', 'trello.com', 'asana', 'slack', 'zoom', 'meeting', 'calendar', 'outlook'],
      '学习': ['coursera', 'udemy', 'edx', 'mooc', 'tutorial', 'learn', 'course', 'study', 'education', 'academy', 'training'],
      '开发': ['github.com', 'gitlab', 'stackoverflow.com', 'dev.to', 'npmjs', 'docker', 'kubernetes', 'aws', 'azure', 'vercel'],
      '文档': ['docs', 'documentation', 'api', 'reference', 'manual', 'guide', 'handbook', 'wiki', 'confluence', 'notion'],
      '社交': ['facebook', 'twitter', 'instagram', 'linkedin', 'weibo', 'wechat', 'telegram', 'whatsapp', 'discord', 'slack'],
      '娱乐': ['youtube', 'netflix', 'bilibili', 'twitch', 'game', 'movie', 'anime', 'manga', 'comic', 'play'],
      '购物': ['amazon', 'taobao', 'jd.com', 'shop', 'store', 'mall', 'tmall', 'ebay', 'aliexpress', 'walmart'],
      '新闻': ['news', 'bbc', 'cnn', 'nytimes', 'medium', 'blog', 'reuters', 'bloomberg', 'techcrunch', 'theverge'],
      '金融': ['banking', 'finance', 'stock', 'crypto', 'blockchain', 'coinbase', 'binance', 'trading', 'investment', 'wallet'],
      '工具': ['tools', 'utility', 'converter', 'calculator', 'translator', 'generator', 'analyzer', 'checker', 'validator'],
      '设计': ['figma', 'sketch', 'adobe', 'dribbble', 'behance', 'design', 'ui', 'ux', 'prototype', 'wireframe'],
      '阅读': ['medium', 'book', 'read', 'article', 'blog', 'paper', 'journal', 'publication', 'magazine', 'kindle'],
      '视频': ['youtube', 'vimeo', 'bilibili', 'netflix', 'movie', 'video', 'stream', 'film', 'tv', 'show'],
      '音乐': ['spotify', 'music', 'soundcloud', 'apple.music', 'podcast', 'radio', 'song', 'playlist', 'album', 'artist'],
      '邮件': ['gmail', 'outlook', 'mail', 'email', 'inbox', 'message', 'newsletter', 'subscription']
    };
    
    this.model = null;
    this.wordIndex = null;
    this.maxSequenceLength = 50;
  }

  async initialize() {
    try {
      // 加载保存的分类和规则
      this.categories = await StorageService.getCategories();
      this.keywordMap = await StorageService.getCategoryRules();
      
      if (this.categories.length === 0) {
        // 使用默认分类
        this.categories = [
          '工作',
          '学习',
          '开发',
          '文档',
          '社交',
          '娱乐',
          '购物',
          '新闻',
          '金融',
          '工具',
          '设计',
          '阅读',
          '视频',
          '音乐',
          '邮件',
          '其他'
        ];
        await StorageService.saveCategories(this.categories);
      }
      
      if (Object.keys(this.keywordMap).length === 0) {
        // 使用默认规则
        this.keywordMap = {
          '工作': ['docs.google.com', 'sheets', 'notion.so', 'trello.com', 'asana', 'slack', 'zoom', 'meeting', 'calendar', 'outlook'],
          '学习': ['coursera', 'udemy', 'edx', 'mooc', 'tutorial', 'learn', 'course', 'study', 'education', 'academy', 'training'],
          '开发': ['github.com', 'gitlab', 'stackoverflow.com', 'dev.to', 'npmjs', 'docker', 'kubernetes', 'aws', 'azure', 'vercel'],
          '文档': ['docs', 'documentation', 'api', 'reference', 'manual', 'guide', 'handbook', 'wiki', 'confluence', 'notion'],
          '社交': ['facebook', 'twitter', 'instagram', 'linkedin', 'weibo', 'wechat', 'telegram', 'whatsapp', 'discord', 'slack'],
          '娱乐': ['youtube', 'netflix', 'bilibili', 'twitch', 'game', 'movie', 'anime', 'manga', 'comic', 'play'],
          '购物': ['amazon', 'taobao', 'jd.com', 'shop', 'store', 'mall', 'tmall', 'ebay', 'aliexpress', 'walmart'],
          '新闻': ['news', 'bbc', 'cnn', 'nytimes', 'medium', 'blog', 'reuters', 'bloomberg', 'techcrunch', 'theverge'],
          '金融': ['banking', 'finance', 'stock', 'crypto', 'blockchain', 'coinbase', 'binance', 'trading', 'investment', 'wallet'],
          '工具': ['tools', 'utility', 'converter', 'calculator', 'translator', 'generator', 'analyzer', 'checker', 'validator'],
          '设计': ['figma', 'sketch', 'adobe', 'dribbble', 'behance', 'design', 'ui', 'ux', 'prototype', 'wireframe'],
          '阅读': ['medium', 'book', 'read', 'article', 'blog', 'paper', 'journal', 'publication', 'magazine', 'kindle'],
          '视频': ['youtube', 'vimeo', 'bilibili', 'netflix', 'movie', 'video', 'stream', 'film', 'tv', 'show'],
          '音乐': ['spotify', 'music', 'soundcloud', 'apple.music', 'podcast', 'radio', 'song', 'playlist', 'album', 'artist'],
          '邮件': ['gmail', 'outlook', 'mail', 'email', 'inbox', 'message', 'newsletter', 'subscription']
        };
        await StorageService.saveCategoryRules(this.keywordMap);
      }

      // 创建或加载模型
      this.model = await this.createModel();
      this.createWordIndex();
      return true;
    } catch (error) {
      console.error('初始化分类服务失败:', error);
      return false;
    }
  }

  createWordIndex() {
    // 创建词汇表
    const words = new Set();
    Object.values(this.keywordMap).flat().forEach(keyword => {
      keyword.toLowerCase().split(/[\s.-]+/).forEach(word => {
        if (word.length > 1) words.add(word);
      });
    });
    
    // 创建词索引映射
    this.wordIndex = Array.from(words).reduce((acc, word, i) => {
      acc[word] = i + 1; // 0 保留给 padding
      return acc;
    }, {});
  }

  async createModel() {
    const model = tf.sequential();
    
    model.add(tf.layers.embedding({
      inputDim: Object.keys(this.wordIndex || {}).length + 1,
      outputDim: 16,
      inputLength: this.maxSequenceLength
    }));
    
    model.add(tf.layers.globalAveragePooling1d());
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: this.categories.length, activation: 'softmax' }));
    
    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    return model;
  }

  preprocessText(text) {
    const words = text.toLowerCase().split(/[\s.-]+/);
    const sequence = new Array(this.maxSequenceLength).fill(0);
    
    words.slice(0, this.maxSequenceLength).forEach((word, i) => {
      if (this.wordIndex[word]) {
        sequence[i] = this.wordIndex[word];
      }
    });
    
    return sequence;
  }

  async predictCategory(tab) {
    // 首先使用关键词匹配
    for (const [category, keywords] of Object.entries(this.keywordMap)) {
      if (keywords.some(keyword => 
        tab.url.toLowerCase().includes(keyword) || 
        tab.title.toLowerCase().includes(keyword)
      )) {
        return category;
      }
    }

    // 如果没有关键词匹配，使用模型预测
    try {
      const text = `${tab.title} ${new URL(tab.url).hostname}`;
      const sequence = this.preprocessText(text);
      
      const prediction = await tf.tidy(() => {
        const input = tf.tensor2d([sequence], [1, this.maxSequenceLength]);
        return this.model.predict(input);
      });
      
      const categoryIndex = await prediction.argMax(1).dataSync()[0];
      return this.categories[categoryIndex];
    } catch (error) {
      console.error('预测分类失败:', error);
      return '其他';
    }
  }

  // 用于训练模型的方法
  async trainOnUserFeedback(tabData, category) {
    try {
      const text = `${tabData.title} ${new URL(tabData.url).hostname}`;
      const sequence = this.preprocessText(text);
      const categoryIndex = this.categories.indexOf(category);
      
      const xs = tf.tensor2d([sequence], [1, this.maxSequenceLength]);
      const ys = tf.oneHot(tf.tensor1d([categoryIndex], 'int32'), this.categories.length);
      
      await this.model.fit(xs, ys, {
        epochs: 1,
        verbose: 0
      });
      
      xs.dispose();
      ys.dispose();
      
      return true;
    } catch (error) {
      console.error('训练失败:', error);
      return false;
    }
  }

  async addCategory(category) {
    if (!this.categories.includes(category)) {
      this.categories.push(category);
      await StorageService.saveCategories(this.categories);
      return true;
    }
    return false;
  }

  async removeCategory(category) {
    const index = this.categories.indexOf(category);
    if (index > -1) {
      this.categories.splice(index, 1);
      delete this.keywordMap[category];
      await StorageService.saveCategories(this.categories);
      await StorageService.saveCategoryRules(this.keywordMap);
      return true;
    }
    return false;
  }

  async addCategoryRule(category, keyword) {
    if (!this.keywordMap[category]) {
      this.keywordMap[category] = [];
    }
    if (!this.keywordMap[category].includes(keyword)) {
      this.keywordMap[category].push(keyword);
      await StorageService.saveCategoryRules(this.keywordMap);
      return true;
    }
    return false;
  }

  async removeCategoryRule(category, keyword) {
    if (this.keywordMap[category]) {
      const index = this.keywordMap[category].indexOf(keyword);
      if (index > -1) {
        this.keywordMap[category].splice(index, 1);
        await StorageService.saveCategoryRules(this.keywordMap);
        return true;
      }
    }
    return false;
  }
} 