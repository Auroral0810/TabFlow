import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// 你的 Firebase 配置
const firebaseConfig = {
  apiKey: "AIzaSyD_R49P4CshfnicYPJXcn6hlRUdDH6mnLc",
  authDomain: "tabflow-yyf.firebaseapp.com",
  projectId: "tabflow-yyf",
  storageBucket: "tabflow-yyf.firebasestorage.app",
  messagingSenderId: "758427076258",
  appId: "1:758427076258:web:d65730757d2b815be5f9fb"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 导出 Auth 和 Firestore 实例
export const auth = getAuth(app);
export const db = getFirestore(app); 