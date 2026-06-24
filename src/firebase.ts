import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBSLPtLicTohl0Qc2RBUXyrMxi6RtYHDOc",
  authDomain: "strange-tributary-g2t1j.firebaseapp.com",
  projectId: "strange-tributary-g2t1j",
  storageBucket: "strange-tributary-g2t1j.firebasestorage.app",
  messagingSenderId: "1055365371224",
  appId: "1:1055365371224:web:9115a0ee1ed292e17e812d"
};

const app = initializeApp(firebaseConfig);

// Use the custom database ID provided in the configuration
export const db = getFirestore(app, "ai-studio-13299216-5e67-410f-b54e-8e98d39531f8");
