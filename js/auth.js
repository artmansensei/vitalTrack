import { auth } from "./firebase-config.js";
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authSubmit = document.getElementById("auth-submit");
const authError = document.getElementById("auth-error");
const authSwitchBtn = document.getElementById("auth-switch-btn");
const authSwitchText = document.getElementById("auth-switch-text");

let isLoginMode = true;

// If user is already logged in, redirect them immediately to the dashboard
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "index.html";
  }
});

authSwitchBtn.addEventListener("click", () => {
    isLoginMode = !isLoginMode;
    authError.textContent = "";
    authEmail.value = "";
    authPassword.value = "";
    
    if (isLoginMode) {
        authTitle.textContent = "Welcome Back";
        authSubtitle.textContent = "Log in to continue your 90-day journey.";
        authSubmit.textContent = "Log In";
        authSwitchText.textContent = "Don't have an account?";
        authSwitchBtn.textContent = "Sign Up";
    } else {
        authTitle.textContent = "Start Your Journey";
        authSubtitle.textContent = "Create an account to track your progress.";
        authSubmit.textContent = "Create Account";
        authSwitchText.textContent = "Already have an account?";
        authSwitchBtn.textContent = "Log In";
    }
});

authSubmit.addEventListener("click", async () => {
    const email = authEmail.value;
    const password = authPassword.value;
    authError.textContent = "";

    if (!email || !password) {
        authError.textContent = "Please enter both email and password.";
        return;
    }

    try {
        authSubmit.textContent = "Please wait...";
        if (isLoginMode) {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            await createUserWithEmailAndPassword(auth, email, password);
        }
        // If successful, onAuthStateChanged will automatically redirect to index.html
    } catch (error) {
        authError.textContent = error.message.replace("Firebase: ", "");
        authSubmit.textContent = isLoginMode ? "Log In" : "Create Account";
    }
});