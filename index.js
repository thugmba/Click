import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  onSnapshot,
  updateDoc,
  getDocs,
  writeBatch,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD6EWEz8M1XtS9RBZwVamu2fpRrqHMdG0M",
    authDomain: "click-6bcfe.firebaseapp.com",
    projectId: "click-6bcfe",
    storageBucket: "click-6bcfe.firebasestorage.app",
    messagingSenderId: "1017935345719",
    appId: "1:1017935345719:web:f08d5041bc4e4de34aa7b2",
    measurementId: "G-R7MS8WD44W"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let mainLayout;
let livePanel;
let chartPanel;
let startButton;
let qrCanvas;
let studentsList;
let chartCanvas;

let currentSessionId = null;
let studentsUnsubscribe = null;
let latestCounts = { total: 0, clicked: 0 };
let resetHistory = [];

function showSetupView() {
  document.body.classList.remove("live-mode", "chart-mode");
  if (mainLayout) mainLayout.classList.remove("hidden");
  if (livePanel) livePanel.classList.add("hidden");
  if (chartPanel) chartPanel.classList.add("hidden");
}

function showLiveView() {
  document.body.classList.add("live-mode");
  document.body.classList.remove("chart-mode");
  if (mainLayout) mainLayout.classList.add("hidden");
  if (livePanel) livePanel.classList.remove("hidden");
  if (chartPanel) chartPanel.classList.add("hidden");
}

function showChartView() {
  document.body.classList.remove("live-mode");
  document.body.classList.add("chart-mode");
  if (mainLayout) mainLayout.classList.add("hidden");
  if (livePanel) livePanel.classList.add("hidden");
  if (chartPanel) chartPanel.classList.remove("hidden");
}

function resetUi() {
  document.getElementById("status").innerText = "Create a session to begin.";
  document.getElementById("clickedCount").innerText = "0";
  document.getElementById("clickedPercent").innerText = "0%";
  document.getElementById("clickedDetail").innerText = "0 of 0 students";

  if (startButton) startButton.disabled = true;
  if (studentsList) studentsList.innerHTML = "";
  if (qrCanvas) {
    const context = qrCanvas.getContext("2d");
    if (context) context.clearRect(0, 0, qrCanvas.width || 400, qrCanvas.height || 400);
    qrCanvas.width = 0;
    qrCanvas.height = 0;
  }
  resetHistory = [];
}

function updateStudentCounts(total, clicked) {
  latestCounts = { total, clicked };

  document.getElementById("clickedCount").innerText = clicked;

  const percent = total > 0 ? Math.round((clicked / total) * 100) : 0;
  document.getElementById("clickedPercent").innerText = percent + "%";
  document.getElementById("clickedDetail").innerText = clicked + " of " + total + " students";
}

function addResetSnapshot() {
  resetHistory.push({
    index: resetHistory.length + 1,
    clicked: latestCounts.clicked,
    recordedAt: Date.now()
  });
}

async function newSession() {
  showSetupView();
  resetHistory = [];

  if (studentsUnsubscribe) {
    studentsUnsubscribe();
    studentsUnsubscribe = null;
  }

  currentSessionId = Math.random().toString(36).substring(2, 8);
  if (startButton) startButton.disabled = false;

  await setDoc(doc(db, "sessions", currentSessionId), {
    status: "waiting",
    createdAt: Date.now(),
    round: 0
  });

  const basePath = window.location.pathname.replace(/index\.html?$/i, "");
  const studentUrl = `${window.location.origin}${basePath}student.html?session=${currentSessionId}`;

  if (qrCanvas) {
    qrCanvas.width = 0;
    qrCanvas.height = 0;
    QRCode.toCanvas(qrCanvas, studentUrl, { width: 400 });
  }

  document.getElementById("status").innerText = "Share the QR code so students can join.";

  if (studentsList) studentsList.innerHTML = "";
  updateStudentCounts(0, 0);

  const studentsRef = collection(db, "sessions", currentSessionId, "students");
  studentsUnsubscribe = onSnapshot(studentsRef, (snapshot) => {
    if (studentsList) studentsList.innerHTML = "";
    let clicked = 0;

    snapshot.forEach(studentDoc => {
      const data = studentDoc.data();
      if (data.clicked) clicked += 1;

      if (studentsList) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = data.clicked ? "student-item student-item--clicked" : "student-item";
        btn.textContent = data.name || "Unnamed";
        studentsList.appendChild(btn);
      }
    });

    updateStudentCounts(snapshot.size, clicked);
  });
}

async function startSession() {
  if (!currentSessionId) return;
  await updateDoc(doc(db, "sessions", currentSessionId), {
    status: "started",
    startedAt: Date.now(),
    round: increment(1)
  });
  if (startButton) startButton.disabled = true;
  showLiveView();
}

async function resetSession() {
  if (!currentSessionId) return;

  addResetSnapshot();

  const sessionDocRef = doc(db, "sessions", currentSessionId);
  const studentsRef = collection(db, "sessions", currentSessionId, "students");
  const snapshot = await getDocs(studentsRef);

  if (!snapshot.empty) {
    const batch = writeBatch(db);
    snapshot.forEach((studentDoc) => {
      batch.update(studentDoc.ref, { clicked: false });
    });
    await batch.commit();
  }

  await updateDoc(sessionDocRef, {
    status: "started",
    round: increment(1)
  });

  updateStudentCounts(snapshot.size, 0);
  showLiveView();
}

async function finishSession() {
  if (!currentSessionId) return;

  try {
    await updateDoc(doc(db, "sessions", currentSessionId), {
      status: "ended",
      endedAt: Date.now()
    });
  } catch (error) {
    console.warn("Unable to set session to ended", error);
  }

  if (studentsUnsubscribe) {
    studentsUnsubscribe();
    studentsUnsubscribe = null;
  }

  showChartView();
  requestAnimationFrame(drawChart);
  if (startButton) startButton.disabled = true;
}

function closeChart() {
  currentSessionId = null;
  resetUi();
  showSetupView();
}

function drawChart() {
  if (!chartCanvas) return;
  const context = chartCanvas.getContext("2d");
  if (!context) return;

  const dpr = window.devicePixelRatio || 1;
  const width = chartCanvas.clientWidth * dpr;
  const height = chartCanvas.clientHeight * dpr;
  chartCanvas.width = width;
  chartCanvas.height = height;

  context.clearRect(0, 0, width, height);

  const padding = 48 * dpr;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  if (!resetHistory.length) {
    context.fillStyle = "#6b7280";
    context.font = (18 * dpr) + "px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("No reset data recorded yet.", width / 2, height / 2);
    return;
  }

  const maxClicked = Math.max(1, ...resetHistory.map(entry => entry.clicked));
  const lastIndex = resetHistory.length - 1;
  const getX = (index) => {
    if (lastIndex === 0) return padding + chartWidth / 2;
    return padding + chartWidth * (index / lastIndex);
  };

  context.strokeStyle = "#d0d4e4";
  context.lineWidth = 1 * dpr;
  context.beginPath();
  context.moveTo(padding, padding);
  context.lineTo(padding, height - padding);
  context.lineTo(width - padding, height - padding);
  context.stroke();

  context.strokeStyle = "#4c6ef5";
  context.lineWidth = 2 * dpr;
  context.beginPath();
  resetHistory.forEach((entry, index) => {
    const x = getX(index);
    const y = height - padding - (chartHeight * (entry.clicked / maxClicked));
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.stroke();

  resetHistory.forEach((entry, index) => {
    const x = getX(index);
    const y = height - padding - (chartHeight * (entry.clicked / maxClicked));
    context.fillStyle = "#4c6ef5";
    context.beginPath();
    context.arc(x, y, 4 * dpr, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#1f1f1f";
    context.font = (12 * dpr) + "px Arial";
    context.textAlign = "center";
    context.textBaseline = "bottom";
    context.fillText(entry.clicked, x, y - 8 * dpr);
  });

  context.fillStyle = "#6b7280";
  context.font = (12 * dpr) + "px Arial";
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillText("Reset Number", padding + chartWidth / 2, height - padding / 2);
  context.save();
  context.translate(padding / 2, padding + chartHeight / 2);
  context.rotate(-Math.PI / 2);
  context.fillText("Students clicked", 0, 0);
  context.restore();

  context.fillStyle = "#6b7280";
  context.font = (12 * dpr) + "px Arial";
  context.textAlign = "center";
  context.textBaseline = "top";
  resetHistory.forEach((entry, index) => {
    const x = getX(index);
    context.fillText(String(index + 1), x, height - padding + 16 * dpr);
  });
}

function initialiseDom() {
  mainLayout = document.getElementById("mainLayout");
  livePanel = document.getElementById("livePanel");
  chartPanel = document.getElementById("chartPanel");
  startButton = document.getElementById("startButton");
  qrCanvas = document.getElementById("qrcode");
  studentsList = document.getElementById("students");
  chartCanvas = document.getElementById("chartCanvas");

  resetUi();
  showSetupView();
}

window.addEventListener("DOMContentLoaded", initialiseDom);

window.newSession = newSession;
window.startSession = startSession;
window.resetSession = resetSession;
window.finishSession = finishSession;
window.closeChart = closeChart;
