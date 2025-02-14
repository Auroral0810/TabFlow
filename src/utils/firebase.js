import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD_R49P4CshfnicYPJXcn6hlRUdDH6mnLc",
  authDomain: "tabflow-yyf.firebaseapp.com", 
  projectId: "tabflow-yyf",
  storageBucket: "tabflow-yyf.firebasestorage.app",
  messagingSenderId: "758427076258",
  appId: "1:758427076258:web:d65730757d2b815be5f9fb",
  // 移除 measurementId，因为扩展环境不支持 analytics
};

// 扩展特定配置
if (chrome?.runtime?.id) {
  firebaseConfig.authDomain = `chrome-extension://${chrome.runtime.id}`;
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 移除 analytics 相关代码
export { auth, db };