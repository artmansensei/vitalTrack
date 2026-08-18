import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
// NEW: Added collection and getDocs for Dashboard data fetching
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
// ==========================================
// 1. AUTHENTICATION & PROTECTION
// ==========================================
let currentUser = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "auth.html";
  } else {
    currentUser = user;
    console.log("Logged in as:", user.email);
    
    // Load data for the initial views
    const datePicker = document.getElementById('plan-date-picker');
    if (datePicker) {
        loadDailyData(datePicker.value);
    }
    
    // Load Dashboard Data
    loadDashboardData();
    
    // NEW: Load Profile Data on startup to update Challenge Days & Target Weight globally
    loadProfileData();
  }
});

const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => signOut(auth));
}

// ==========================================
// 2. NAVIGATION LOGIC
// ==========================================
document.querySelectorAll(".nav button").forEach(button => {
    button.onclick = () => {
        document.querySelectorAll(".nav button").forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        
        document.querySelectorAll(".view").forEach(view => view.classList.add("hidden"));
        const targetView = document.getElementById(button.dataset.view);
        if (targetView) targetView.classList.remove("hidden");
        
        if (button.dataset.view === "dashboard") {
            loadDashboardData();
        }
        
        // NEW: Load Nutrition data when Nutrition tab is opened
        if (button.dataset.view === "nutrition") {
            loadNutritionData();
        }
        
        // NEW: Load Workout data when Workout tab is opened
        if (button.dataset.view === "workout") {
            loadWorkoutData();
        }
        
        // NEW: Load Lifestyle data when Lifestyle tab is opened
        if (button.dataset.view === "lifestyle") {
            loadLifestyleData();
        }
        // NEW: Load Progress data when Progress tab is opened
        if (button.dataset.view === "progress") {
            loadProgressData();
        }
        // NEW: Load Profile data when Profile tab is opened
        if (button.dataset.view === "profile") {
            loadProfileData();
        } 
        // NEW: Handle AI Coach view if needed
        if (button.dataset.view === "aicoach") {
            // Scroll chat to bottom if opened
            const chatBox = document.getElementById("ai-chat-box");
            if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
        }
        
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
});


// ==========================================
// AI COACH SECTION LOGIC
// ==========================================
const aiChatBox = document.getElementById("ai-chat-box");
const aiUserInput = document.getElementById("ai-user-input");
const aiSendBtn = document.getElementById("ai-send-btn");

if (aiSendBtn && aiUserInput) {
    aiSendBtn.addEventListener("click", handleAIChat);
    aiUserInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleAIChat();
    });
}

async function handleAIChat() {
    const question = aiUserInput.value.trim();
    if (!question) return;

    // Append user message
    appendMessage(question, "user");
    aiUserInput.value = "";

    // Simulate AI typing response
    const typingId = appendMessage("Thinking...", "ai", true);

    setTimeout(() => {
        removeMessage(typingId);
        const aiResponse = generateAIResponse(question);
        appendMessage(aiResponse, "ai");
    }, 1000);
}

function appendMessage(text, sender) {
    if (!aiChatBox) return;
    const msgDiv = document.createElement("div");
    const msgId = "msg-" + Date.now();
    msgDiv.id = msgId;

    if (sender === "user") {
        msgDiv.style.cssText = "background: var(--accent); color: #0b0f19; padding: 12px 16px; border-radius: 8px; max-width: 80%; align-self: flex-end; font-weight: 500;";
    } else {
        msgDiv.style.cssText = "background: rgba(255,255,255,0.05); color: var(--text); padding: 12px 16px; border-radius: 8px; max-width: 80%; align-self: flex-start; border: 1px solid rgba(255,255,255,0.05);";
    }
    msgDiv.textContent = text;
    aiChatBox.appendChild(msgDiv);
    aiChatBox.scrollTop = aiChatBox.scrollHeight;
    return msgId;
}

function removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function generateAIResponse(query) {
    const q = query.toLowerCase();
    if (q.includes("diet") || q.includes("meal") || q.includes("food") || q.includes("khabar")) {
        return "Your 7-day meal plan focuses on a high-protein diet with eggs, rice, chicken, and fish, balanced with healthy fats like peanuts and bananas. Make sure to stay consistent!";
    } else if (q.includes("workout") || q.includes("exercise") || q.includes("gym")) {
        return "Keep your form strict during Workout A (Squats, Push-ups, Rows) and Workout B (Lunges, Shoulder press, Curls). Rest days are crucial for muscle recovery!";
    } else if (q.includes("weight") || q.includes("goal")) {
        return "Your 90-day target weight is set in your profile. Track your weight regularly in the Progress tab to watch your trajectory curve towards your goal.";
    } else if (q.includes("sleep") || q.includes("water") || q.includes("recovery")) {
        return "Hydration and at least 7.5 hours of sleep are the pillars of recovery. Log them daily in the Lifestyle tab to keep your energy high!";
    } else {
        return "That's a great fitness question! Focus on progressive overload in your workouts, hit your protein goals from your nutrition plan, and track your daily consistency diligently.";
    }
}
// ==========================================
// PROGRESS SECTION: WEIGHT LOGGING & CHART
// ==========================================
const progressDatePicker = document.getElementById('progress-date-picker');
const progressWeightInput = document.getElementById('progress-weight');
const saveWeightBtn = document.getElementById('save-weight-btn');
const progressBmiDisplay = document.getElementById('progress-metric-bmi');
const progressBmrDisplay = document.getElementById('progress-metric-bmr');
let progressWeightChartInstance = null;

let currentProfileAge = 20; // Default
let currentProfileHeight = 175; // Default

// Set default date to today for progress tab
if (progressDatePicker) {
    progressDatePicker.value = new Date().toISOString().split('T')[0];
}

// NEW: Real-time calculation when typing weight
if (progressWeightInput) {
    progressWeightInput.addEventListener('input', (e) => {
        const weightVal = parseFloat(e.target.value) || 0;
        calculateProgressMetrics(weightVal);
    });
}

// NEW: Helper function to calculate daily metrics
function calculateProgressMetrics(weightVal) {
    if (weightVal > 0 && currentProfileHeight > 0) {
        const heightInMeters = currentProfileHeight / 100;
        const bmi = (weightVal / (heightInMeters * heightInMeters)).toFixed(1);
        if (progressBmiDisplay) progressBmiDisplay.textContent = bmi;
        
        const bmr = Math.round((10 * weightVal) + (6.25 * currentProfileHeight) - (5 * currentProfileAge) + 5);
        if (progressBmrDisplay) progressBmrDisplay.textContent = `${bmr} kcal`;
    } else {
        if (progressBmiDisplay) progressBmiDisplay.textContent = "-";
        if (progressBmrDisplay) progressBmrDisplay.textContent = "-";
    }
}

// Save Weight Log to Firestore
if (saveWeightBtn) {
    saveWeightBtn.addEventListener("click", async () => {
        if (!currentUser) return await showModal("Authentication", "Please log in first!", "alert");

        const selectedDate = progressDatePicker.value;
        const weightValue = parseFloat(progressWeightInput.value);

        if (!selectedDate || isNaN(weightValue)) {
            return await showModal("Invalid Input", "Please enter a valid date and weight.", "alert");
        }

        try {
            saveWeightBtn.textContent = "Saving...";
            const docRef = doc(db, "users", currentUser.uid, "weightLogs", selectedDate);
            await setDoc(docRef, {
                date: selectedDate,
                weight: weightValue,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            saveWeightBtn.textContent = "Saved!";
            setTimeout(() => { saveWeightBtn.textContent = "Save Weight Log"; }, 2000);
            
            // Refresh dashboard and progress charts
            loadDashboardData();
            loadProgressData();
            
        } catch (error) {
            console.error("Error saving weight log:", error);
            await showModal("Error", "Failed to save weight.", "alert");
            saveWeightBtn.textContent = "Save Weight Log";
        }
    });
}

// Load Weight Data for Progress Tab
async function loadProgressData() {
    if (!currentUser) return;
    const selectedDate = progressDatePicker ? progressDatePicker.value : new Date().toISOString().split('T')[0];

    try {
        // Fetch user's height and age from profile for accurate calculation
        const profileRef = doc(db, "users", currentUser.uid, "settings", "profile");
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
            currentProfileAge = parseInt(profileSnap.data().age) || 20;
            currentProfileHeight = parseFloat(profileSnap.data().height) || 175;
        }

        const docRef = doc(db, "users", currentUser.uid, "weightLogs", selectedDate);
        const docSnap = await getDoc(docRef);

        let weightVal = 0;
        if (docSnap.exists()) {
            weightVal = docSnap.data().weight || 0;
            progressWeightInput.value = weightVal;
        } else {
            progressWeightInput.value = "";
        }

        // Calculate metrics for the loaded weight
        calculateProgressMetrics(weightVal);

        // Fetch all weight logs for rendering the progress chart
        const weightsRef = collection(db, "users", currentUser.uid, "weightLogs");
        const querySnapshot = await getDocs(weightsRef);
        
        const labels = [];
        const weights = [];

        // Sort documents by date sequentially
        const weightDocs = [];
        querySnapshot.forEach(doc => weightDocs.push(doc.data()));
        weightDocs.sort((a, b) => new Date(a.date) - new Date(b.date));

        weightDocs.forEach(item => {
            labels.push(item.date.slice(5)); // MM-DD
            weights.push(item.weight);
        });

        renderProgressWeightChart(labels, weights);

    } catch (error) {
        console.error("Error loading progress data:", error);
    }
}

// Listen for date changes in Progress tab
if (progressDatePicker) {
    flatpickr(progressDatePicker, {
        defaultDate: "today", // স্বয়ংক্রিয়ভাবে আজকের তারিখ নেবে
        dateFormat: "Y-m-d",  // ডাটাবেসে সেভ হওয়ার জন্য আসল ফরম্যাট (যাতে গ্রাফ না ভাঙে)
        altInput: true,       // ইউজারের দেখার জন্য আলাদা ইনপুট
        altFormat: "d-m-Y",   // ইউজারের দেখার জন্য (Day-Month-Year)
        onChange: function(selectedDates, dateStr, instance) {
            loadProgressData(); // তারিখ বদলালেই ডেটা লোড হবে
        }
    });
}

// Render Real Weight Chart in Progress Section
function renderProgressWeightChart(labels, data) {
    const ctx = document.getElementById('progressWeightChart');
    if (!ctx) return;
    
    if (progressWeightChartInstance) progressWeightChartInstance.destroy();
    
    progressWeightChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.length ? labels : ['No Data'],
            datasets: [{
                label: 'Weight (kg)',
                data: data.length ? data : [0],
                borderColor: '#55e6a5',
                backgroundColor: 'rgba(85,230,165,0.1)',
                fill: true,
                tension: 0.35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#8ea4bd' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#8ea4bd' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}
// ==========================================
// NUTRITION SECTION: LOAD MEAL PLAN FROM data.json
// ==========================================
async function loadNutritionData() {
    const tbody = document.getElementById('meal-plan-tbody');
    if (!tbody) return;
    
    // Prevent reloading if already populated
    if (tbody.children.length > 0) return;

    try {
        const response = await fetch('data/data.json');
        const data = await response.json();
        
        if (data.meals) {
            data.meals.forEach((dayMeals, index) => {
                const tr = document.createElement('tr');
                
                // Day Column
                const tdDay = document.createElement('td');
                tdDay.innerHTML = `<strong>Day ${index + 1}</strong>`;
                tr.appendChild(tdDay);
                
                // Meal Columns (Indices 1 to 5 from data.json)[cite: 7]
                for (let i = 1; i < dayMeals.length; i++) {
                    const td = document.createElement('td');
                    td.textContent = dayMeals[i];
                    tr.appendChild(td);
                }
                
                tbody.appendChild(tr);
            });
        }
    } catch (error) {
        console.error("Error loading nutrition data:", error);
    }
}
// ==========================================
// WORKOUT SECTION: LOAD WORKOUTS FROM data.json
// ==========================================
async function loadWorkoutData() {
    const tbody = document.getElementById('workout-plan-tbody');
    if (!tbody) return;
    
    // Prevent reloading if already populated
    if (tbody.children.length > 0) return;

    try {
        const response = await fetch('data/data.json');
        const data = await response.json();
        
        // Using workouts data from data.json[cite: 7]
        if (data.workouts) {
            data.workouts.forEach((workout) => {
                const tr = document.createElement('tr');
                
                // Routine Type (e.g., Workout A, Workout B, Rest)
                const tdType = document.createElement('td');
                tdType.innerHTML = `<strong>${workout[0]}</strong>`;
                tr.appendChild(tdType);
                
                // Exercise details
                const tdDetails = document.createElement('td');
                tdDetails.textContent = workout[1];
                tr.appendChild(tdDetails);
                
                tbody.appendChild(tr);
            });
        }
    } catch (error) {
        console.error("Error loading workout data:", error);
    }
}
// ==========================================
// 3. DASHBOARD LOGIC (Updated with Real Firestore Data & Streaks)
// ==========================================
let habitChartInstance = null;
let weightChartInstance = null;

async function loadDashboardData() {
    if (!currentUser) return;

    let totalDaysTracked = 0;
    let totalWorkoutDays = 0;
    let totalScoreSum = 0;
    const chartLabels = [];
    const habitScores = [];
    const logsMap = {}; // To track logs by date for streak calculation

    // 1. Fetch Daily Logs for Habit & Workout Consistency
    try {
        const logsRef = collection(db, "users", currentUser.uid, "dailyLogs");
        const querySnapshot = await getDocs(logsRef);
        
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            totalDaysTracked++;
            
            if (data.tasks && data.tasks.workout) {
                totalWorkoutDays++;
            }
            
            const scoreValue = data.score ? parseInt(data.score.replace('%', '')) : 0;
            totalScoreSum += scoreValue;
            
            chartLabels.push(data.date.slice(5)); // MM-DD
            habitScores.push(scoreValue);

            // Store completion status (true if score is 100%)
            logsMap[data.date] = scoreValue === 100;
        });

        // Calculate Streak (Consecutive 100% days)
        calculateAndUpdateStreak(logsMap);

    } catch (error) {
        console.error("Error loading dashboard logs:", error);
    }

    // Update Dashboard Metric Cards
    document.getElementById("dash-days").textContent = totalDaysTracked;
    const avgScore = totalDaysTracked > 0 ? Math.round(totalScoreSum / totalDaysTracked) : 0;
    document.getElementById("dash-habit").textContent = `${avgScore}%`;
    const workoutConsistency = totalDaysTracked > 0 ? Math.round((totalWorkoutDays / totalDaysTracked) * 100) : 0;
    document.getElementById("dash-workout").textContent = `${workoutConsistency}%`;

    // Render Charts
    renderHabitChart(chartLabels, habitScores);
    await renderWeightChart(); // Load real weight trajectory
}

// Helper function to calculate streak and unlock badges
function calculateAndUpdateStreak(logsMap) {
    let currentStreak = 0;
    let today = new Date();
    
    // Check backwards from today
    for (let i = 0; i < 90; i++) {
        let dateString = today.toISOString().split('T')[0];
        if (logsMap[dateString] === true) {
            currentStreak++;
            today.setDate(today.getDate() - 1);
        } else if (i === 0) {
            today.setDate(today.getDate() - 1);
            let yesterdayString = today.toISOString().split('T')[0];
            if (logsMap[yesterdayString] === true) {
                currentStreak++;
                today.setDate(today.getDate() - 1);
            } else {
                break;
            }
        } else {
            break;
        }
    }

    // Update UI Status Label
    const streakLabel = document.getElementById("streak-status-label");
    if (streakLabel) {
        streakLabel.textContent = `${currentStreak} Day Streak 🔥`;
    }

    // Unlock Badges based on streak count
    const badge3 = document.getElementById("badge-3day");
    const badge7 = document.getElementById("badge-7day");
    const badge30 = document.getElementById("badge-30day");

    if (badge3) {
        if (currentStreak >= 3) {
            badge3.style.opacity = "1";
            badge3.style.background = "rgba(85,230,165,0.15)";
            badge3.style.borderColor = "var(--accent)";
        } else {
            badge3.style.opacity = "0.3";
        }
    }

    if (badge7) {
        if (currentStreak >= 7) {
            badge7.style.opacity = "1";
            badge7.style.background = "rgba(85,230,165,0.15)";
            badge7.style.borderColor = "var(--accent)";
        } else {
            badge7.style.opacity = "0.3";
        }
    }

    if (badge30) {
        if (currentStreak >= 30) {
            badge30.style.opacity = "1";
            badge30.style.background = "rgba(85,230,165,0.15)";
            badge30.style.borderColor = "var(--accent)";
        } else {
            badge30.style.opacity = "0.3";
        }
    }
}

function renderHabitChart(labels, data) {
    const ctx = document.getElementById('habitChart');
    if (!ctx) return;
    
    if (habitChartInstance) habitChartInstance.destroy(); // Prevent overlapping charts
    
    habitChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['No Data'],
            datasets: [{
                label: 'Consistency Score',
                data: data.length ? data : [0],
                backgroundColor: '#5ba7ff',
                borderRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#8ea4bd' }, grid: { display: false } },
                y: { min: 0, max: 100, ticks: { color: '#8ea4bd' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}

async function renderWeightChart() {
    const ctx = document.getElementById('weightChart');
    if (!ctx) return;
    
    if (weightChartInstance) weightChartInstance.destroy();
    
    let labels = ['No Data'];
    let weights = [0];

    try {
        const weightsRef = collection(db, "users", currentUser.uid, "weightLogs");
        const querySnapshot = await getDocs(weightsRef);
        
        if (!querySnapshot.empty) {
            const weightDocs = [];
            querySnapshot.forEach(doc => weightDocs.push(doc.data()));
            
            // Sort by date sequentially
            weightDocs.sort((a, b) => new Date(a.date) - new Date(b.date));

            labels = [];
            weights = [];
            weightDocs.forEach(item => {
                labels.push(item.date.slice(5)); // MM-DD
                weights.push(item.weight);
            });
        }
    } catch (error) {
        console.error("Error loading dashboard weight chart:", error);
    }
    
    weightChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Weight',
                data: weights,
                borderColor: '#55e6a5',
                backgroundColor: 'rgba(85,230,165,0.1)',
                fill: true,
                tension: 0.35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#8ea4bd' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#8ea4bd' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}

// ==========================================
// HAMBURGER MENU LOGIC (MOBILE SIDEBAR)
// ==========================================
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebarMenu = document.querySelector('.sidebar');

if (mobileMenuBtn && sidebarMenu) {
    // 1. Toggle Sidebar on Hamburger Click
    mobileMenuBtn.addEventListener('click', () => {
        sidebarMenu.classList.toggle('open');
        
        // Change icon from Hamburger (☰) to Close (✖)
        if (sidebarMenu.classList.contains('open')) {
            mobileMenuBtn.innerHTML = '✖';
        } else {
            mobileMenuBtn.innerHTML = '☰';
        }
    });

    // 2. Auto-close sidebar when a navigation button is clicked on mobile
    document.querySelectorAll('.nav button').forEach(button => {
        button.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebarMenu.classList.remove('open');
                mobileMenuBtn.innerHTML = '☰';
            }
        });
    });
}

// ==========================================
// 4. 90-DAY PLAN: DRAG & DROP & PROGRESS
// ==========================================
const datePicker = document.getElementById('plan-date-picker');
if (datePicker) {
    const today = new Date().toISOString().split('T')[0];
    datePicker.value = today;
}

const checklist = document.getElementById('interactive-checklist');
let draggedItem = null;

if (checklist) {
    checklist.addEventListener('dragstart', (e) => {
        draggedItem = e.target.closest('.checklist-item');
        setTimeout(() => { draggedItem.style.opacity = '0.5'; }, 0);
    });

    checklist.addEventListener('dragend', () => {
        setTimeout(() => { draggedItem.style.opacity = '1'; draggedItem = null; }, 0);
    });

    checklist.addEventListener('dragover', (e) => {
        e.preventDefault(); 
        const afterElement = getDragAfterElement(checklist, e.clientY);
        if (draggedItem) {
            if (afterElement == null) {
                checklist.appendChild(draggedItem);
            } else {
                checklist.insertBefore(draggedItem, afterElement);
            }
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.checklist-item:not([style*="opacity: 0.5"])')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

const checkboxes = document.querySelectorAll('.checklist-item input[type="checkbox"]');
const scoreText = document.getElementById('daily-score');
const progressBar = document.getElementById('daily-progress-bar');

function updateDailyScore() {
    const total = checkboxes.length;
    const checked = document.querySelectorAll('.checklist-item input[type="checkbox"]:checked').length;
    const percentage = Math.round((checked / total) * 100);
    
    scoreText.textContent = `${percentage}%`;
    progressBar.style.width = `${percentage}%`;
    
    if (percentage === 100) {
        progressBar.style.background = "linear-gradient(90deg, #32c9a3, #55e6a5)";
    } else {
        progressBar.style.background = "linear-gradient(90deg, var(--accent2), var(--accent))";
    }
}

checkboxes.forEach(box => {
    box.addEventListener('change', updateDailyScore);
});

// ==========================================
// 5. FIRESTORE: SAVE & LOAD DAILY LOGS
// ==========================================
const saveDayBtn = document.getElementById("save-day-btn");
if (saveDayBtn) {
    saveDayBtn.addEventListener("click", async () => {
        if (!currentUser) return await showModal("Authentication", "Please log in first!", "alert");

        const selectedDate = datePicker.value;
        const currentScore = scoreText.textContent;
        
        const taskData = {};
        checkboxes.forEach(box => {
            taskData[box.dataset.task] = box.checked;
        });

        try {
            saveDayBtn.textContent = "Saving...";
            const docRef = doc(db, "users", currentUser.uid, "dailyLogs", selectedDate);
            await setDoc(docRef, {
                date: selectedDate,
                score: currentScore,
                tasks: taskData,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            saveDayBtn.textContent = "Saved!";
            setTimeout(() => { saveDayBtn.textContent = "Save Daily Log"; }, 2000);
            
            // NEW: Automatically refresh dashboard data after saving
            loadDashboardData();
            
        } catch (error) {
            console.error("Error saving document: ", error);
            await showModal("Error", "Failed to save data. Check console for details.", "alert");
            saveDayBtn.textContent = "Save Daily Log";
        }
    });
}

async function loadDailyData(selectedDate) {
    if (!currentUser) return;

    try {
        const docRef = doc(db, "users", currentUser.uid, "dailyLogs", selectedDate);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            checkboxes.forEach(box => {
                const taskName = box.dataset.task;
                box.checked = data.tasks && data.tasks[taskName] ? true : false;
            });
        } else {
            checkboxes.forEach(box => box.checked = false);
        }
        updateDailyScore();
    } catch (error) {
        console.error("Error loading document:", error);
    }
}

if (datePicker) {
    flatpickr(datePicker, {
        defaultDate: "today",
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "d-m-Y", // Day-Month-Year
        onChange: function(selectedDates, dateStr, instance) {
            loadDailyData(dateStr); // তারিখ বদলালেই ওই দিনের চেকলিস্ট লোড হবে
        }
    });
}

// ==========================================
// LIVE CLOCK & CALENDAR (WITH MILLISECONDS)
// ==========================================
const liveTimeEl = document.getElementById("live-time");
const liveDateEl = document.getElementById("live-date");

function updateLiveClock() {
    if (!liveTimeEl || !liveDateEl) return;
    
    const now = new Date();
    
    // Time Formatting with Milliseconds
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12; // Convert to 12-hour format
    
    // Add leading zeros where needed
    const paddedHours = String(hours).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0'); 
    
    // Example: 03:45:12.845 PM
    liveTimeEl.innerHTML = `${paddedHours}:${minutes}:${seconds}.<span style="font-size: 18px; opacity: 0.8;">${milliseconds}</span> ${ampm}`;
    
    // Date Formatting (Example: Tuesday, Aug 18, 2026)
    const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
    liveDateEl.textContent = now.toLocaleDateString('en-US', options);
}

// Update the clock every 25 milliseconds for super smooth millisecond rendering
if (document.getElementById("dashboard")) {
    setInterval(updateLiveClock, 25);
    updateLiveClock(); // Run immediately so there's no delay
}

// ==========================================
// LIFESTYLE SECTION: SAVE & LOAD LOGIC
// ==========================================
const saveLifestyleBtn = document.getElementById("save-lifestyle-btn");
const lifeSleep = document.getElementById("life-sleep");
const lifeWater = document.getElementById("life-water");
const lifeMood = document.getElementById("life-mood");
const lifeEnergy = document.getElementById("life-energy");

// Save Lifestyle Data to Firestore
if (saveLifestyleBtn) {
    saveLifestyleBtn.addEventListener("click", async () => {
        if (!currentUser) return await showModal("Authentication", "Please log in first!", "alert");

        const selectedDate = datePicker ? datePicker.value : new Date().toISOString().split('T')[0];

        const lifestyleData = {
            sleep: lifeSleep.value,
            water: lifeWater.value,
            mood: lifeMood.value,
            energy: lifeEnergy.value,
            updatedAt: new Date().toISOString()
        };

        try {
            saveLifestyleBtn.textContent = "Saving...";
            // We store lifestyle logs inside the user's subcollection using the selected date
            const docRef = doc(db, "users", currentUser.uid, "lifestyleLogs", selectedDate);
            await setDoc(docRef, lifestyleData, { merge: true });

            saveLifestyleBtn.textContent = "Saved!";
            setTimeout(() => { saveLifestyleBtn.textContent = "Save Lifestyle Log"; }, 2000);
            
        } catch (error) {
            console.error("Error saving lifestyle log: ", error);
            await showModal("Error", "Failed to save lifestyle data.", "alert");
            saveLifestyleBtn.textContent = "Save Lifestyle Log";
        }
    });
}

// Load Lifestyle Data from Firestore
async function loadLifestyleData() {
    if (!currentUser) return;
    const selectedDate = datePicker ? datePicker.value : new Date().toISOString().split('T')[0];

    try {
        const docRef = doc(db, "users", currentUser.uid, "lifestyleLogs", selectedDate);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            lifeSleep.value = data.sleep || "";
            lifeWater.value = data.water || "";
            lifeMood.value = data.mood || "Good";
            lifeEnergy.value = data.energy || "Medium";
        } else {
            lifeSleep.value = "";
            lifeWater.value = "";
            lifeMood.value = "Good";
            lifeEnergy.value = "Medium";
        }
    } catch (error) {
        console.error("Error loading lifestyle data:", error);
    }
}


// ==========================================
// PROFILE, SETTINGS & HEALTH METRICS
// ==========================================
const userEmailDisplay = document.getElementById("user-email-display");
const settingsTargetWeight = document.getElementById("settings-target-weight");
const settingsUnit = document.getElementById("settings-unit");
const saveSettingsBtn = document.getElementById("save-settings-btn");
const profileLogoutBtn = document.getElementById("profile-logout-btn");

const profileNickname = document.getElementById("profile-nickname");
const profileAge = document.getElementById("profile-age");
const profileHeight = document.getElementById("profile-height");
const profileWeight = document.getElementById("profile-weight");
const saveProfileBtn = document.getElementById("save-profile-btn");
const metricBmi = document.getElementById("metric-bmi");
const metricBmr = document.getElementById("metric-bmr");

if (profileLogoutBtn) {
    profileLogoutBtn.addEventListener("click", () => {
        signOut(auth);
    });
}

// BMI & BMR Calculation Logic
function calculateHealthMetrics(weightVal, heightVal, ageVal) {
    if (weightVal > 0 && heightVal > 0) {
        const heightInMeters = heightVal / 100;
        const bmi = (weightVal / (heightInMeters * heightInMeters)).toFixed(1);
        if (metricBmi) metricBmi.textContent = bmi;
        
        // Mifflin-St Jeor Equation for BMR (Standard calculation)
        const bmr = Math.round((10 * weightVal) + (6.25 * heightVal) - (5 * (ageVal || 20)) + 5);
        if (metricBmr) metricBmr.textContent = `${bmr} kcal`;
    } else {
        if (metricBmi) metricBmi.textContent = "-";
        if (metricBmr) metricBmr.textContent = "-";
    }
}

// Load Profile and Settings from Firestore
async function loadProfileData() {
    if (!currentUser) return;

    if (userEmailDisplay) {
        userEmailDisplay.value = currentUser.email || "";
    }

    try {
        // Load Preferences & Target Weight
        const prefRef = doc(db, "users", currentUser.uid, "settings", "preferences");
        const prefSnap = await getDoc(prefRef);

        if (prefSnap.exists()) {
            const data = prefSnap.data();
            if (settingsTargetWeight && data.targetWeight) {
                settingsTargetWeight.value = data.targetWeight;
                const dashTarget = document.getElementById("dash-target");
                if (dashTarget) dashTarget.textContent = `${data.targetWeight} kg`;
            }
            if (settingsUnit && data.unit) {
                settingsUnit.value = data.unit;
            }
            
            // NEW: Load Challenge Days and update UI
            const daysInput = document.getElementById("settings-challenge-days");
            if (daysInput && data.challengeDays) {
                daysInput.value = data.challengeDays;
                
                // Update Sidebar and Title text
                const navText = document.getElementById("nav-plan-text");
                const planTitle = document.getElementById("plan-title-text");
                if (navText) navText.textContent = `${data.challengeDays}-Day Plan`;
                if (planTitle) planTitle.textContent = `${data.challengeDays}-Day Plan`;
            }
        }

        // Load Personal Information & Health Metrics
        const profileRef = doc(db, "users", currentUser.uid, "settings", "profile");
        const profileSnap = await getDoc(profileRef);

        if (profileSnap.exists()) {
            const pData = profileSnap.data();
            if (profileNickname) profileNickname.value = pData.nickname || "";
            if (profileAge) profileAge.value = pData.age || "";
            if (profileHeight) profileHeight.value = pData.height || "";
            if (profileWeight) profileWeight.value = pData.weight || "";
            
            calculateHealthMetrics(parseFloat(pData.weight), parseFloat(pData.height), parseInt(pData.age));
        }
    } catch (error) {
        console.error("Error loading profile data:", error);
    }
}

// Save Settings to Firestore
if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener("click", async () => {
        if (!currentUser) return await showModal("Authentication", "Please log in first!", "alert");

        const targetWeightVal = parseFloat(settingsTargetWeight.value) || 58.0;
        const unitVal = settingsUnit.value;
        
        // Grab the challenge days value
        const challengeDaysInput = document.getElementById("settings-challenge-days");
        const challengeDaysVal = challengeDaysInput ? parseInt(challengeDaysInput.value) || 90 : 90;

        try {
            saveSettingsBtn.textContent = "Saving...";
            const docRef = doc(db, "users", currentUser.uid, "settings", "preferences");
            await setDoc(docRef, {
                targetWeight: targetWeightVal,
                unit: unitVal,
                challengeDays: challengeDaysVal, // Save dynamic days
                updatedAt: new Date().toISOString()
            }, { merge: true });

            const dashTarget = document.getElementById("dash-target");
            if (dashTarget) {
                dashTarget.textContent = `${targetWeightVal} kg`;
            }
            
            // Update UI immediately after saving
            const navText = document.getElementById("nav-plan-text");
            const planTitle = document.getElementById("plan-title-text");
            if (navText) navText.textContent = `${challengeDaysVal}-Day Plan`;
            if (planTitle) planTitle.textContent = `${challengeDaysVal}-Day Plan`;

            await showModal("Success", "Settings and Challenge Plan saved successfully!", "alert");
            saveSettingsBtn.textContent = "Save Settings";
            
        } catch (error) {
            console.error("Error saving settings:", error);
            await showModal("Error", "Failed to save settings.", "alert");
            saveSettingsBtn.textContent = "Save Settings";
        }
    });
}

// Save Personal Profile & Calculate BMI/BMR to Firestore
if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", async () => {
        if (!currentUser) return await showModal("Authentication", "Please log in first!", "alert");

        const nicknameVal = profileNickname.value;
        const ageVal = parseInt(profileAge.value) || 0;
        const heightVal = parseFloat(profileHeight.value) || 0;
        const weightVal = parseFloat(profileWeight.value) || 0;

        try {
            saveProfileBtn.textContent = "Saving...";
            const docRef = doc(db, "users", currentUser.uid, "settings", "profile");
            await setDoc(docRef, {
                nickname: nicknameVal,
                age: ageVal,
                height: heightVal,
                weight: weightVal,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            // Calculate live metrics
            calculateHealthMetrics(weightVal, heightVal, ageVal);

            saveProfileBtn.textContent = "Saved!";
            setTimeout(() => { saveProfileBtn.textContent = "Save Profile"; }, 2000);
            
        } catch (error) {
            console.error("Error saving profile:", error);
            await showModal("Error", "Failed to save profile.", "alert");
            saveProfileBtn.textContent = "Save Profile";
        }
    });
}


// ==========================================
// FULL APP RESET LOGIC
// ==========================================
const resetAppBtn = document.getElementById("reset-app-btn");

if (resetAppBtn) {
    resetAppBtn.addEventListener("click", async () => {
        if (!currentUser) return await showModal("Authentication", "Please log in first!", "alert");

        // Custom Premium Confirm Modal
        const confirmReset = await showModal(
            "Danger Zone", 
            "⚠️ This will permanently delete all your logs, weight history, profile data, and settings from the database. Are you sure you want to reset the app?", 
            "confirm"
        );
        
        if (!confirmReset) return;

        try {
            resetAppBtn.textContent = "Resetting...";
            
            const subcollections = ["dailyLogs", "weightLogs", "lifestyleLogs", "settings"];
            
            for (const subcol of subcollections) {
                const colRef = collection(db, "users", currentUser.uid, subcol);
                const querySnapshot = await getDocs(colRef);
                
                const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
                await Promise.all(deletePromises);
            }

            await showModal("Success", "App data has been successfully reset!", "alert");
            window.location.reload();
            
        } catch (error) {
            console.error("Error resetting app data:", error);
            await showModal("Error", "Failed to reset app data. Check console for details.", "alert");
            resetAppBtn.textContent = "Reset App Data";
        }
    });
}

// ==========================================
// PREMIUM CUSTOM MODAL (Alert, Confirm, Prompt)
// ==========================================
function showModal(title, message, type = 'alert', defaultValue = '') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-modal-overlay');
        const titleEl = document.getElementById('custom-modal-title');
        const msgEl = document.getElementById('custom-modal-message');
        const inputContainer = document.getElementById('custom-modal-input-container');
        const inputEl = document.getElementById('custom-modal-input');
        const cancelBtn = document.getElementById('custom-modal-cancel-btn');
        const okBtn = document.getElementById('custom-modal-ok-btn');
        const iconEl = document.getElementById('custom-modal-icon');

        titleEl.textContent = title;
        msgEl.textContent = message;

        if (type === 'confirm') {
            iconEl.textContent = '⚠️';
            cancelBtn.style.display = 'block';
            inputContainer.style.display = 'none';
            okBtn.style.background = '#e65555'; // Danger color for confirm
            okBtn.style.color = '#fff';
        } else if (type === 'prompt') {
            iconEl.textContent = '✏️';
            cancelBtn.style.display = 'block';
            inputContainer.style.display = 'block';
            inputEl.value = defaultValue;
            okBtn.style.background = '#55e6a5';
            okBtn.style.color = '#0b0f19';
        } else {
            iconEl.textContent = '✨';
            cancelBtn.style.display = 'none';
            inputContainer.style.display = 'none';
            okBtn.style.background = '#55e6a5';
            okBtn.style.color = '#0b0f19';
        }

        overlay.style.display = 'flex';
        if (type === 'prompt') inputEl.focus();

        // Fresh event handlers
        const newOkBtn = okBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        document.getElementById('custom-modal-ok-btn').onclick = () => {
            overlay.style.display = 'none';
            if (type === 'prompt') {
                resolve(document.getElementById('custom-modal-input').value);
            } else {
                resolve(true);
            }
        };

        document.getElementById('custom-modal-cancel-btn').onclick = () => {
            overlay.style.display = 'none';
            if (type === 'prompt') resolve(null);
            else resolve(false);
        };
    });
}

// // ==========================================
// // DARK / LIGHT MODE TOGGLE LOGIC (ROUND BUTTON)
// // ==========================================
// const themeToggleBtn = document.getElementById('theme-toggle-btn');
// const appBody = document.body;

// // 1. Check Local Storage on Load
// const currentTheme = localStorage.getItem('app-theme');
// if (currentTheme === 'light') {
//     appBody.classList.add('light-mode');
//     if (themeToggleBtn) {
//         themeToggleBtn.textContent = '🌙'; 
//     }
// } else {
//     if (themeToggleBtn) {
//         themeToggleBtn.textContent = '☀️'; 
//     }
// }

// // 2. Toggle Event Listener
// if (themeToggleBtn) {
//     themeToggleBtn.addEventListener('click', () => {
//         appBody.classList.toggle('light-mode');
        
//         if (appBody.classList.contains('light-mode')) {
//             localStorage.setItem('app-theme', 'light');
//             themeToggleBtn.textContent = '🌙'; 
//         } else {
//             localStorage.setItem('app-theme', 'dark');
//             themeToggleBtn.textContent = '☀️'; 
//         }
//     });
// }
