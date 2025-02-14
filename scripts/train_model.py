import os
import tensorflow as tf
import pandas as pd
import numpy as np
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
from sklearn.model_selection import train_test_split
import json
import requests
from bs4 import BeautifulSoup
import re
import matplotlib.pyplot as plt

# 创建保存模型的目录
model_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'public', 'model')
os.makedirs(model_dir, exist_ok=True)

# 定义文件路径
tokenizer_path = os.path.join(model_dir, 'tokenizer.json')
model_path = os.path.join(model_dir, 'model.keras')
categories_path = os.path.join(model_dir, 'categories.json')
history_path = os.path.join(model_dir, 'training_history.png')

# 定义类别
CATEGORIES = {
    '学习': ['coursera', 'udemy', 'github', 'stackoverflow', 'leetcode', 'edu', 'learn', 'study', 'course', 
            'tutorial', 'documentation', 'docs', 'wiki', 'knowledge', 'research', 'academic'],
    '购物': ['taobao', 'tmall', 'jd.com', 'amazon', 'shop', 'store', 'mall', 'price', 'buy', 'cart', 
            'product', 'item', 'order', 'payment', 'shipping'],
    '工作': ['jira', 'confluence', 'gitlab', 'jenkins', 'work', 'project', 'task', 'meeting', 'team', 
            'company', 'enterprise', 'business', 'office', 'corporate', 'management'],
    '社交': ['weibo', 'twitter', 'facebook', 'instagram', 'social', 'friend', 'message', 'chat', 'community',
            'share', 'connect', 'network', 'group', 'forum', 'discussion'],
    '娱乐': ['bilibili', 'youtube', 'netflix', 'game', 'video', 'music', 'movie', 'play', 'fun', 
            'entertainment', 'stream', 'watch', 'show', 'series', 'anime'],
    '新闻': ['news', 'sina', 'bbc', 'cnn', 'report', 'media', 'press', 'journal', 'article', 
            'headline', 'update', 'breaking', 'current', 'events', 'daily'],
    '开发': ['github', 'stackoverflow', 'npm', 'python', 'javascript', 'code', 'programming', 'developer',
            'api', 'framework', 'library', 'tool', 'debug', 'test', 'deploy'],
    '其他': []
}

def load_common_websites():
    # 加载 Alexa Top 1M 网站列表
    url = "http://s3.amazonaws.com/alexa-static/top-1m.csv.zip"
    df = pd.read_csv(url, compression='zip', header=None, names=['rank', 'domain'])
    return df['domain'].tolist()[:10000]  # 使用前10000个网站

def generate_training_data():
    training_data = []
    
    # 手动定义大量训练数据
    manual_data = [
        # 学习类网站
        {"title": "Coursera - Online Courses & Credentials From Top Educators", "url": "https://www.coursera.org", "category": "学习"},
        {"title": "edX | Free Online Courses by Harvard, MIT, & more", "url": "https://www.edx.org", "category": "学习"},
        {"title": "Stack Overflow - Where Developers Learn & Share", "url": "https://stackoverflow.com", "category": "学习"},
        {"title": "GitHub: Let's build from here", "url": "https://github.com", "category": "学习"},
        {"title": "LeetCode - The World's Leading Online Programming Learning Platform", "url": "https://leetcode.com", "category": "学习"},
        
        # 购物类网站
        {"title": "淘宝网 - 淘！我喜欢", "url": "https://www.taobao.com", "category": "购物"},
        {"title": "京东(JD.COM)-正品低价、品质保障、配送及时、轻松购物！", "url": "https://www.jd.com", "category": "购物"},
        {"title": "Amazon.com. Spend less. Smile more.", "url": "https://www.amazon.com", "category": "购物"},
        {"title": "天猫精选-天猫Tmall.com-理想生活上天猫", "url": "https://www.tmall.com", "category": "购物"},
        
        # 工作类网站
        {"title": "Jira | Issue & Project Tracking Software | Atlassian", "url": "https://www.atlassian.com/software/jira", "category": "工作"},
        {"title": "Confluence | Your Remote-Friendly Team Workspace", "url": "https://www.atlassian.com/software/confluence", "category": "工作"},
        {"title": "GitLab: DevOps Platform", "url": "https://gitlab.com", "category": "工作"},
        {"title": "Jenkins – Open source automation server", "url": "https://www.jenkins.io", "category": "工作"},
        
        # 社交类网站
        {"title": "微博 – 随时随地发现新鲜事", "url": "https://weibo.com", "category": "社交"},
        {"title": "Twitter. It's what's happening", "url": "https://twitter.com", "category": "社交"},
        {"title": "Facebook - Log In or Sign Up", "url": "https://www.facebook.com", "category": "社交"},
        {"title": "Instagram", "url": "https://www.instagram.com", "category": "社交"},
        
        # 娱乐类网站
        {"title": "哔哩哔哩 (゜-゜)つロ 干杯~-bilibili", "url": "https://www.bilibili.com", "category": "娱乐"},
        {"title": "YouTube", "url": "https://www.youtube.com", "category": "娱乐"},
        {"title": "Netflix - Watch TV Shows Online, Watch Movies Online", "url": "https://www.netflix.com", "category": "娱乐"},
        {"title": "Steam Community", "url": "https://steamcommunity.com", "category": "娱乐"},
        
        # 新闻类网站
        {"title": "新浪网 - 新闻中心", "url": "https://news.sina.com.cn", "category": "新闻"},
        {"title": "BBC - Homepage", "url": "https://www.bbc.com", "category": "新闻"},
        {"title": "CNN - Breaking News, Latest News and Videos", "url": "https://www.cnn.com", "category": "新闻"},
        {"title": "Reuters | Breaking International News & Views", "url": "https://www.reuters.com", "category": "新闻"},
        
        # 开发类网站
        {"title": "npm | Home", "url": "https://www.npmjs.com", "category": "开发"},
        {"title": "Python.org", "url": "https://www.python.org", "category": "开发"},
        {"title": "MDN Web Docs", "url": "https://developer.mozilla.org", "category": "开发"},
        {"title": "Docker: Accelerated Container Application Development", "url": "https://www.docker.com", "category": "开发"},
    ]
    
    # 为每个网站生成多个变体
    for site in manual_data:
        base_title = site['title']
        base_url = site['url']
        category = site['category']
        
        # 生成标题变体
        variants = [
            {'title': base_title, 'url': base_url},
            {'title': f"Welcome to {base_url.split('//')[1]}", 'url': base_url},
            {'title': f"{base_url.split('//')[1]} - Home", 'url': base_url},
            {'title': f"Visit {base_url.split('//')[1]}", 'url': base_url},
        ]
        
        for variant in variants:
            training_data.append({
                'title': variant['title'],
                'url': variant['url'],
                'category': category
            })
    
    return training_data

# 生成训练数据
data = generate_training_data()
df = pd.DataFrame(data)

# 文本预处理
def preprocess_text(title, url):
    # 组合标题和URL
    text = f"{title} {url}"
    # 转换为小写
    text = text.lower()
    # 移除特殊字符
    text = re.sub(r'[^\w\s]', ' ', text)
    # 移除多余空格
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# 准备训练数据
X = [preprocess_text(row['title'], row['url']) for _, row in df.iterrows()]
y = df['category']

# 创建分词器
tokenizer = Tokenizer(num_words=10000)
tokenizer.fit_on_texts(X)

# 保存分词器配置
with open(tokenizer_path, 'w') as f:
    json.dump(tokenizer.word_index, f)

# 转换文本为序列
sequences = tokenizer.texts_to_sequences(X)
max_length = 100
padded_sequences = pad_sequences(sequences, maxlen=max_length)

# 准备标签
categories = sorted(list(CATEGORIES.keys()))
label_dict = {cat: i for i, cat in enumerate(categories)}
numeric_labels = [label_dict[label] for label in y]
one_hot_labels = tf.keras.utils.to_categorical(numeric_labels)

# 划分训练集和测试集
X_train, X_test, y_train, y_test = train_test_split(
    padded_sequences, one_hot_labels, test_size=0.2, random_state=42
)

# 创建更复杂的模型
model = tf.keras.Sequential([
    tf.keras.layers.Embedding(len(tokenizer.word_index) + 1, 128, input_length=max_length),
    tf.keras.layers.Bidirectional(tf.keras.layers.LSTM(64, return_sequences=True)),
    tf.keras.layers.Bidirectional(tf.keras.layers.LSTM(32)),
    tf.keras.layers.Dense(64, activation='relu'),
    tf.keras.layers.Dropout(0.3),
    tf.keras.layers.Dense(32, activation='relu'),
    tf.keras.layers.Dropout(0.2),
    tf.keras.layers.Dense(len(categories), activation='softmax')
])

# 编译模型
model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

# 添加早停和学习率调整
early_stopping = tf.keras.callbacks.EarlyStopping(
    monitor='val_loss',
    patience=5,
    restore_best_weights=True
)

lr_scheduler = tf.keras.callbacks.ReduceLROnPlateau(
    monitor='val_loss',
    factor=0.5,
    patience=3,
    min_lr=0.0001
)

# 训练模型
history = model.fit(
    X_train,
    y_train,
    epochs=100,
    batch_size=32,
    validation_data=(X_test, y_test),
    callbacks=[early_stopping, lr_scheduler]
)

# 评估模型
test_loss, test_accuracy = model.evaluate(X_test, y_test)
print(f"测试集准确率: {test_accuracy:.4f}")

# 保存模型
model.save(model_path, save_format='keras')

# 保存类别映射
with open(categories_path, 'w') as f:
    json.dump(categories, f)

# 绘制训练历史
plt.figure(figsize=(12, 4))

plt.subplot(1, 2, 1)
plt.plot(history.history['accuracy'], label='训练准确率')
plt.plot(history.history['val_accuracy'], label='验证准确率')
plt.title('模型准确率')
plt.xlabel('Epoch')
plt.ylabel('准确率')
plt.legend()

plt.subplot(1, 2, 2)
plt.plot(history.history['loss'], label='训练损失')
plt.plot(history.history['val_loss'], label='验证损失')
plt.title('模型损失')
plt.xlabel('Epoch')
plt.ylabel('损失')
plt.legend()

plt.tight_layout()
plt.savefig(history_path) 