import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, child } from 'firebase/database';
import { openDB } from 'idb';

export class SessionService {
  constructor() {
    this.db = null;
    this.firebase = null;
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
    const firebaseConfig = {
      // 你的 Firebase 配置
    };
    
    this.firebase = initializeApp(firebaseConfig);
  }

  async saveSession(name, tabs) {
    const session = {
      id: Date.now().toString(),
      name,
      tabs: tabs.map(tab => ({
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        pinned: tab.pinned,
        muted: tab.mutedInfo?.muted
      })),
      timestamp: Date.now()
    };

    // 保存到 IndexedDB
    await this.db.put('sessions', session);

    // 同步到 Firebase
    if (this.firebase) {
      const userId = await this.getCurrentUser();
      if (userId) {
        const db = getDatabase();
        await set(ref(db, `users/${userId}/sessions/${session.id}`), session);
      }
    }

    return session;
  }

  async getSessions() {
    return await this.db.getAll('sessions');
  }

  async restoreSession(sessionId) {
    const session = await this.db.get('sessions', sessionId);
    if (session) {
      for (const tab of session.tabs) {
        await chrome.tabs.create({
          url: tab.url,
          pinned: tab.pinned,
          active: false
        });
      }
    }
  }

  async syncWithFirebase() {
    const userId = await this.getCurrentUser();
    if (userId) {
      const db = getDatabase();
      const snapshot = await get(child(ref(db), `users/${userId}/sessions`));
      
      if (snapshot.exists()) {
        const sessions = snapshot.val();
        // 更新本地数据
        for (const session of Object.values(sessions)) {
          await this.db.put('sessions', session);
        }
      }
    }
  }
} 