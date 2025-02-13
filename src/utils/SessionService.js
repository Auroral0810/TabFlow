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
  signInWithPopup
} from 'firebase/auth';
import { openDB } from 'idb';

export class SessionService {
  constructor() {
    this.storageKey = 'tabSessions';
  }

  // 修改登录方法
  async signIn() {
    try {
      console.log('开始登录流程...');
      if (typeof chrome !== 'undefined' && chrome.identity) {
        console.log('检测到 Chrome 扩展环境');
        return new Promise((resolve, reject) => {
          // 简化 auth_params，移除 client_id
          const auth_params = {
            interactive: true
          };

          chrome.identity.getAuthToken(auth_params, async function(token) {
            if (chrome.runtime.lastError) {
              console.error('Chrome 认证错误:', chrome.runtime.lastError);
              return reject(chrome.runtime.lastError);
            }

            try {
              // 使用获取到的 token 创建 Firebase 凭证
              const credential = GoogleAuthProvider.credential(null, token);
              const result = await signInWithCredential(auth, credential);
              console.log('Firebase 登录成功:', result.user.email);
              resolve(result.user);
            } catch (error) {
              console.error('Firebase 认证错误:', error);
              if (error.code === 'auth/invalid-credential') {
                chrome.identity.removeCachedAuthToken({ token }, () => {
                  console.log('已清除失效的 token');
                });
              }
              reject(error);
            }
          });
        });
      } else {
        throw new Error('此功能仅支持在 Chrome 扩展中使用');
      }
    } catch (error) {
      console.error('登录过程发生错误:', error);
      throw error;
    }
  }

  // 检查登录状态
  isLoggedIn() {
    return auth.currentUser !== null;
  }

  // 获取当前用户
  getCurrentUser() {
    return auth.currentUser;
  }

  // 同步到云端
  async syncToCloud() {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('请先登录');

      const sessions = await this.getSessions();
      const userSessionsRef = collection(db, `users/${user.uid}/sessions`);

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

  // 从云端同步
  async syncFromCloud() {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('请先登录');

      const userSessionsRef = collection(db, `users/${user.uid}/sessions`);
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

      // 如果用户已登录，同步到云端
      if (auth.currentUser) {
        await this.syncToCloud();
      }

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