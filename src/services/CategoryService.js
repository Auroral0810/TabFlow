import * as tf from '@tensorflow/tfjs';

export class CategoryService {
  constructor() {
    this.model = null;
    this.tokenizer = null;
    this.categories = ['学习', '购物', '工作', '社交', '娱乐', '新闻', '开发', '其他'];
    this.maxLength = 100;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return true;
    }

    try {
      // 尝试加载模型
      const modelUrl = chrome.runtime.getURL('model/model.json');
      console.log('正在加载模型:', modelUrl);
      
      // 检查模型文件是否存在
      const modelResponse = await fetch(modelUrl);
      if (!modelResponse.ok) {
        throw new Error(`模型文件加载失败: ${modelResponse.statusText}`);
      }

      this.model = await tf.loadLayersModel(modelUrl);
      console.log('模型加载成功');

      // 加载分词器
      const tokenizerUrl = chrome.runtime.getURL('model/tokenizer.json');
      const tokenizerResponse = await fetch(tokenizerUrl);
      if (!tokenizerResponse.ok) {
        throw new Error(`分词器加载失败: ${tokenizerResponse.statusText}`);
      }
      
      this.tokenizer = await tokenizerResponse.json();
      console.log('分词器加载成功');

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('CategoryService 初始化失败:', error);
      // 即使加载失败也标记为已初始化，避免反复重试
      this.initialized = true;
      return false;
    }
  }

  preprocessText(text) {
    // 转换为小写
    text = text.toLowerCase();
    // 移除特殊字符
    text = text.replace(/[^\w\s]/g, ' ');
    // 分词
    const words = text.split(/\s+/);
    // 转换为序列
    const sequence = words.map(word => this.tokenizer[word] || 0);
    // 填充或截断到固定长度
    while (sequence.length < this.maxLength) {
      sequence.push(0);
    }
    return sequence.slice(0, this.maxLength);
  }

  async predictCategory(tab) {
    // 如果模型未加载成功，使用简单的规则匹配
    if (!this.model || !this.tokenizer) {
      return this.fallbackPredict(tab);
    }

    try {
      const text = `${tab.title} ${tab.url}`;
      const sequence = this.preprocessText(text);
      const input = tf.tensor2d([sequence], [1, this.maxLength]);
      const predictions = await this.model.predict(input).array();
      input.dispose();

      const categoryIndex = predictions[0].indexOf(Math.max(...predictions[0]));
      return this.categories[categoryIndex];
    } catch (error) {
      console.error('预测失败，使用降级方案:', error);
      return this.fallbackPredict(tab);
    }
  }

  // 降级预测方法：使用简单的关键词匹配
  fallbackPredict(tab) {
    const text = `${tab.title} ${tab.url}`.toLowerCase();
    
    const rules = [
      { category: '学习', keywords: ['learn', 'course', 'study', 'tutorial', 'documentation', 'github'] },
      { category: '购物', keywords: ['shop', 'store', 'mall', 'taobao', 'jd.com', 'amazon'] },
      { category: '工作', keywords: ['jira', 'confluence', 'work', 'project', 'task'] },
      { category: '社交', keywords: ['twitter', 'facebook', 'instagram', 'weibo', 'social'] },
      { category: '娱乐', keywords: ['youtube', 'bilibili', 'video', 'game', 'play'] },
      { category: '新闻', keywords: ['news', 'sina', 'bbc', 'cnn'] },
      { category: '开发', keywords: ['github', 'stackoverflow', 'dev', 'api', 'code'] }
    ];

    for (const rule of rules) {
      if (rule.keywords.some(keyword => text.includes(keyword))) {
        return rule.category;
      }
    }

    return '其他';
  }

  // 用于用户反馈的训练
  async trainOnUserFeedback(tab, correctCategory) {
    // 存储用户反馈，用于后续模型更新
    const feedback = {
      title: tab.title,
      url: tab.url,
      category: correctCategory,
      timestamp: Date.now()
    };

    try {
      const feedbacks = JSON.parse(localStorage.getItem('category_feedbacks') || '[]');
      feedbacks.push(feedback);
      localStorage.setItem('category_feedbacks', JSON.stringify(feedbacks));
    } catch (error) {
      console.error('保存用户反馈失败:', error);
    }
  }
} 