import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// REPLACE THESE WITH YOUR ACTUAL FIREBASE PROJECT KEYS
const firebaseConfig = {
  apiKey: "AIzaSyDIpwB8zco1QHOhN6RuwAEj4ATAN9x25ac",
  authDomain: "vitaltrack-1960c.firebaseapp.com",
  projectId: "vitaltrack-1960c",
  storageBucket: "vitaltrack-1960c.firebasestorage.app",
  messagingSenderId: "950326442066",
  appId: "1:950326442066:web:31737fb071cfdfb556478b",
  measurementId: "G-MW0PTHZQDV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);