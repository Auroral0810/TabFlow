import { auth, db } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  deleteDoc,
  doc 
} from 'firebase/firestore';
import { 
  GoogleAuthProvider,
  signInWithCredential,
  signInWithRedirect,
  getRedirectResult,
  signInWithPopup,
  browserPopupRedirectResolver
} from 'firebase/auth';
import { openDB } from 'idb';

export class SessionService {
  constructor() {
    this.storageKey = 'tabSessions';
    this.currentToken = null;
  }

  async signIn() {
    try {
      console.log('=== 登录流程开始 ===');
      
      if (this.currentToken) {
        console.log('1. 移除现有 token...');
        await new Promise((resolve) => {
          chrome.identity.removeCachedAuthToken({ 
            token: this.currentToken 
          }, resolve);
        });
      }
      
      console.log('2. 请求新的 token...');
      const token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ 
          interactive: true
        }, (token) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            this.currentToken = token;
            resolve(token);
          }
        });
      });

      console.log('3. 创建凭证...');
      const credential = GoogleAuthProvider.credential(null, token);
      
      console.log('4. 登录 Firebase...');
      const result = await signInWithCredential(auth, credential);
      console.log('登录成功:', result.user.email);
      
      // 登录后立即从云端同步数据到本地
      await this.syncFromCloud();
      
      return result.user;
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    }
  }

  async signOut() {
    try {
      if (this.currentToken) {
        await new Promise((resolve) => {
          chrome.identity.removeCachedAuthToken({ 
            token: this.currentToken 
          }, resolve);
        });
        this.currentToken = null;
      }
      await auth.signOut();
    } catch (error) {
      console.error('登出失败:', error);
      throw error;
    }
  }

  isLoggedIn() {
    return auth.currentUser !== null;
  }

  getCurrentUser() {
    return auth.currentUser;
  }

  // 从云端同步数据到本地
  async syncFromCloud() {
    if (!this.isLoggedIn()) {
      throw new Error('请先登录');
    }

    try {
      const userId = auth.currentUser.uid;
      // 获取云端数据
      const sessionsRef = collection(db, `users/${userId}/sessions`);
      const querySnapshot = await getDocs(query(sessionsRef));
      
      // 将云端数据转换为本地格式
      const cloudSessions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 替换本地存储的数据
      await chrome.storage.local.set({ [this.storageKey]: cloudSessions });
      
      return cloudSessions;
    } catch (error) {
      console.error('从云端同步失败:', error);
      throw error;
    }
  }

  // 同步到云端
  async syncToCloud() {
    if (!this.isLoggedIn()) {
      throw new Error('请先登录');
    }

    try {
      const userId = auth.currentUser.uid;
      // 获取本地数据
      const { [this.storageKey]: sessions } = await chrome.storage.local.get(this.storageKey);
      
      // 清除现有云端数据
      const sessionsRef = collection(db, `users/${userId}/sessions`);
      const existingDocs = await getDocs(query(sessionsRef));
      for (const doc of existingDocs.docs) {
        await deleteDoc(doc.ref);
      }

      // 上传本地数据到云端
      for (const session of sessions || []) {
        const { id, ...sessionData } = session;
        await addDoc(sessionsRef, sessionData);
      }
    } catch (error) {
      console.error('同步到云端失败:', error);
      throw error;
    }
  }

  // 获取所有会话
  async getSessions() {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      return result[this.storageKey] || [];
    } catch (error) {
      console.error('获取会话失败:', error);
      throw error;
    }
  }

  // 保存会话
  async saveSession(name, tabs) {
    try {
      const sessions = await this.getSessions();
      const newSession = {
        id: Date.now().toString(),
        name: name,
        timestamp: Date.now(),
        tabs: tabs.map(tab => ({
          url: tab.url,
          title: tab.title || tab.url,
          pinned: tab.pinned || false
        }))
      };

      sessions.push(newSession);
      await chrome.storage.local.set({
        [this.storageKey]: sessions
      });

      return newSession;
    } catch (error) {
      console.error('保存会话失败:', error);
      throw error;
    }
  }

  // 删除会话
  async deleteSession(sessionId) {
    try {
      let sessions = await this.getSessions();
      sessions = sessions.filter(session => session.id !== sessionId);
      await chrome.storage.local.set({
        [this.storageKey]: sessions
      });
    } catch (error) {
      console.error('删除会话失败:', error);
      throw error;
    }
  }

  // 更新会话
  async updateSession(sessionId, updates) {
    try {
      const sessions = await this.getSessions();
      const index = sessions.findIndex(s => s.id === sessionId);
      
      if (index === -1) {
        throw new Error('会话不存在');
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