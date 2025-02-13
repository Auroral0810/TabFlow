import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { openDB } from 'idb';
import { firebaseConfig } from './firebase-config';

export class SessionService {
  constructor() {
    this.db = null;
    this.firebase = null;
    this.storageKey = 'tabSessions';
    this.initializeDB();
    this.initializeFirebase();
  }

  async initializeDB() {
    this.db = await openDB('tabflow', 1, {
      upgrade(db) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }
    });
  }

  initializeFirebase() {
    try {
      this.app = initializeApp(firebaseConfig);
      this.db = getFirestore(this.app);
      this.auth = getAuth(this.app);
      console.log('Firebase 初始化成功');
    } catch (error) {
      console.error('Firebase 初始化失败:', error);
    }
  }

  async signIn() {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this.auth, provider);
      console.log('登录成功:', result.user.email);
      return result.user;
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    }
  }

  async syncToCloud() {
    try {
      if (!this.auth.currentUser) {
        throw new Error('请先登录');
      }

      const sessions = await this.getSessions();
      const userSessionsRef = collection(this.db, `users/${this.auth.currentUser.uid}/sessions`);

      // 清除旧数据
      const oldDocs = await getDocs(userSessionsRef);
      for (const doc of oldDocs.docs) {
        await deleteDoc(doc.ref);
      }

      // 上传新数据
      for (const session of sessions) {
        await addDoc(userSessionsRef, {
          ...session,
          timestamp: Date.now()
        });
      }

      console.log('同步到云端成功');
    } catch (error) {
      console.error('同步到云端失败:', error);
      throw error;
    }
  }

  async syncFromCloud() {
    try {
      if (!this.auth.currentUser) {
        throw new Error('请先登录');
      }

      const userSessionsRef = collection(this.db, `users/${this.auth.currentUser.uid}/sessions`);
      const snapshot = await getDocs(userSessionsRef);
      
      const sessions = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));

      await chrome.storage.local.set({
        [this.storageKey]: sessions
      });

      console.log('从云端同步成功');
      return sessions;
    } catch (error) {
      console.error('从云端同步失败:', error);
      throw error;
    }
  }

  // 处理 URL，确保是完整的 URL
  processUrl(url) {
    try {
      // 如果已经是完整的 URL，直接返回
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('chrome://')) {
        return url;
      }
      // 如果是相对路径，添加 https:// 前缀
      if (!url.includes('://')) {
        return `https://${url}`;
      }
      return url;
    } catch (error) {
      console.error('处理 URL 失败:', error);
      return url;
    }
  }

  async saveSession(name, tabs) {
    try {
      const sessions = await this.getSessions();
      
      console.log('准备保存的会话信息：');
      console.log('会话名称:', name);
      console.log('标签页数量:', tabs.length);
      
      const processedTabs = tabs.map((tab, index) => {
        const processedUrl = this.processUrl(tab.url);
        console.log(`标签页 ${index + 1}:`, {
          url: processedUrl,
          title: tab.title,
          pinned: tab.pinned
        });
        
        return {
          url: processedUrl,
          title: tab.title || processedUrl,
          pinned: tab.pinned || false
        };
      });

      const newSession = {
        id: Date.now().toString(),
        name: name,
        timestamp: Date.now(),
        tabs: processedTabs
      };

      sessions.push(newSession);
      await chrome.storage.local.set({
        [this.storageKey]: sessions
      });

      console.log('会话保存成功：', newSession);
      return newSession;
    } catch (error) {
      console.error('保存会话失败:', error);
      throw error;
    }
  }

  async getSessions() {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      return result[this.storageKey] || [];
    } catch (error) {
      console.error('获取会话失败:', error);
      return [];
    }
  }

  async restoreSession(sessionId) {
    try {
      const sessions = await this.getSessions();
      const session = sessions.find(s => s.id === sessionId);
      
      if (!session) {
        throw new Error('会话不存在');
      }

      console.log('准备恢复的会话信息：');
      console.log('会话名称:', session.name);
      console.log('标签页数量:', session.tabs.length);
      session.tabs.forEach((tab, index) => {
        console.log(`标签页 ${index + 1}:`, {
          url: tab.url,
          title: tab.title
        });
      });

      // 创建新窗口并打开第一个标签页
      const window = await chrome.windows.create({
        url: session.tabs[0].url,
        focused: true,
        state: 'maximized'
      });

      // 在同一个窗口中打开其余的标签页
      for (let i = 1; i < session.tabs.length; i++) {
        await chrome.tabs.create({
          windowId: window.id,
          url: session.tabs[i].url,
          active: false
        });
      }

      console.log('会话恢复完成');
      return true;
    } catch (error) {
      console.error('恢复会话失败:', error);
      throw error;
    }
  }

  async deleteSession(sessionId) {
    try {
      let sessions = await this.getSessions();
      sessions = sessions.filter(s => s.id !== sessionId);
      await chrome.storage.local.set({
        [this.storageKey]: sessions
      });
    } catch (error) {
      console.error('删除会话失败:', error);
      throw error;
    }
  }

  async updateSession(sessionId, updates) {
    try {
      let sessions = await this.getSessions();
      const index = sessions.findIndex(s => s.id === sessionId);
      
      if (index === -1) {
        throw new Error('会话不存在');
      }

      // 如果更新包含标签页，处理每个标签页的 URL
      if (updates.tabs) {
        updates.tabs = updates.tabs.map(tab => ({
          ...tab,
          url: this.processUrl(tab.url),
          title: tab.title || tab.url
        }));
      }

      sessions[index] = {
        ...sessions[index],
        ...updates,
        timestamp: Date.now()
      };

      await chrome.storage.local.set({
        [this.storageKey]: sessions
      });

      return sessions[index];
    } catch (error) {
      console.error('更新会话失败:', error);
      throw error;
    }
  }

  async addTab(sessionId, newTab) {
    try {
      let sessions = await this.getSessions();
      const index = sessions.findIndex(s => s.id === sessionId);
      
      if (index === -1) {
        throw new Error('会话不存在');
      }

      const processedUrl = this.processUrl(newTab.url);
      const processedTab = {
        url: processedUrl,
        title: newTab.title || processedUrl,
        pinned: newTab.pinned || false
      };

      sessions[index].tabs.push(processedTab);
      sessions[index].timestamp = Date.now();

      await chrome.storage.local.set({
        [this.storageKey]: sessions
      });

      return sessions[index];
    } catch (error) {
      console.error('添加标签页失败:', error);
      throw error;
    }
  }
} 