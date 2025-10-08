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
let participationPanel;
let startButton;
let roundButton;
let qrCanvas;
let studentsList;
let studentCountLabel;
let chartCanvas;
let participationTableBody;
let randomNamesToggle;
let modeControl;
let modeButtons = [];
let clickedCountEl;
let clickedPercentEl;
let clickedDetailEl;
let clickedPercentWrap;
let standardStatsEl;
let typeStatsEl;
let typeResponseCountEl;
let typeWordCloudEl;
let choiceStatsEl;
let choiceYesEl;
let choiceNoEl;
let choiceYesPercentEl;
let choiceNoPercentEl;

let currentMode = "standard";
let quizMode = false;
let quizWinner = null;

let currentSessionId = null;
let studentsUnsubscribe = null;
let latestCounts = { total: 0, clicked: 0 };
let latestTypeResponses = [];
let latestChoiceCounts = { yes: 0, no: 0 };
let latestStudentData = [];
let roundHistory = [];
let participationOpportunities = 0;
let studentParticipation = new Map();
let currentOpportunityParticipants = new Set();
let sessionStatus = "connecting";
let isRoundActive = false;
let hasChosenMode = false;
let totalTrackedRounds = 0;
let studentParticipationCount = new Map();
let roundStartTime = null;
let stopwatchInterval = null;
let timerDuration = 10;
let hasAnnouncedTimeUp = false;

function showSetupView() {
  document.body.classList.remove("live-mode", "chart-mode");
  if (mainLayout) mainLayout.classList.remove("hidden");
  if (livePanel) livePanel.classList.add("hidden");
  if (chartPanel) chartPanel.classList.add("hidden");
  if (participationPanel) participationPanel.classList.add("hidden");
}

function showLiveView() {
  document.body.classList.add("live-mode");
  document.body.classList.remove("chart-mode");
  if (mainLayout) mainLayout.classList.add("hidden");
  if (livePanel) livePanel.classList.remove("hidden");
  if (chartPanel) chartPanel.classList.add("hidden");
  if (participationPanel) participationPanel.classList.add("hidden");
}

function showChartView() {
  document.body.classList.remove("live-mode");
  document.body.classList.add("chart-mode");
  if (mainLayout) mainLayout.classList.add("hidden");
  if (livePanel) livePanel.classList.add("hidden");
  if (chartPanel) chartPanel.classList.remove("hidden");
  if (participationPanel) participationPanel.classList.add("hidden");
}

function showParticipationView() {
  document.body.classList.remove("live-mode", "chart-mode");
  if (mainLayout) mainLayout.classList.add("hidden");
  if (livePanel) livePanel.classList.add("hidden");
  if (chartPanel) chartPanel.classList.add("hidden");
  if (participationPanel) participationPanel.classList.remove("hidden");
}

function resetUi() {
  const instructionsEl = document.getElementById("statusInstructions");
  if (instructionsEl) instructionsEl.classList.remove("hidden");
  const statusMessageEl = document.getElementById("statusMessage");
  if (statusMessageEl) {
    statusMessageEl.classList.add("hidden");
    statusMessageEl.innerText = "";
  }

  stopStopwatch();

  currentMode = "standard";
  quizMode = false;
  quizWinner = null;
  latestCounts = { total: 0, clicked: 0 };
  latestTypeResponses = [];
  latestChoiceCounts = { yes: 0, no: 0 };
  participationOpportunities = 0;
  studentParticipation = new Map();
  currentOpportunityParticipants = new Set();
  sessionStatus = "connecting";
  isRoundActive = false;
  hasChosenMode = false;
  totalTrackedRounds = 0;
  studentParticipationCount = new Map();

  activateModeButton("standard");
  if (studentCountLabel) studentCountLabel.innerText = "0";
  renderLiveStats();

  if (startButton) startButton.disabled = true;
  if (studentsList) studentsList.innerHTML = "";
  const qrUrlEl = document.getElementById("qrUrl");
  if (qrUrlEl) {
    qrUrlEl.textContent = "";
    qrUrlEl.href = "";
  }
  if (qrCanvas) {
    const context = qrCanvas.getContext("2d");
    if (context) context.clearRect(0, 0, qrCanvas.width || 400, qrCanvas.height || 400);
    qrCanvas.width = 0;
    qrCanvas.height = 0;
  }
  roundHistory = [];
}

function updateStudentCounts(total, clicked) {
  latestCounts = { total, clicked };
  if (studentCountLabel) studentCountLabel.innerText = total;
  renderLiveStats();
}

function ensureStatElements() {
  if (!standardStatsEl) standardStatsEl = document.getElementById("standardStats");
  if (!typeStatsEl) typeStatsEl = document.getElementById("typeStats");
  if (!choiceStatsEl) choiceStatsEl = document.getElementById("choiceStats");
  if (!clickedCountEl) clickedCountEl = document.getElementById("clickedCount");
  if (!clickedPercentEl) clickedPercentEl = document.getElementById("clickedPercent");
  if (!clickedPercentWrap) clickedPercentWrap = document.getElementById("clickedPercentWrap");
  if (!clickedDetailEl) clickedDetailEl = document.getElementById("clickedDetail");
  if (!typeResponseCountEl) typeResponseCountEl = document.getElementById("typeResponseCount");
  if (!typeWordCloudEl) typeWordCloudEl = document.getElementById("typeWordCloud");
  if (!choiceYesEl) choiceYesEl = document.getElementById("choiceYesCount");
  if (!choiceNoEl) choiceNoEl = document.getElementById("choiceNoCount");
  if (!choiceYesPercentEl) choiceYesPercentEl = document.getElementById("choiceYesPercent");
  if (!choiceNoPercentEl) choiceNoPercentEl = document.getElementById("choiceNoPercent");
}

function startStopwatch() {
  roundStartTime = Date.now();
  hasAnnouncedTimeUp = false;
  updateStopwatch();
  stopwatchInterval = setInterval(updateStopwatch, 1000);
}

function stopStopwatch() {
  if (stopwatchInterval) {
    clearInterval(stopwatchInterval);
    stopwatchInterval = null;
  }
  roundStartTime = null;
  hasAnnouncedTimeUp = false;
}

function playTickSound(remaining) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Alternating tick-tock frequencies
  const isEven = remaining % 2 === 0;
  oscillator.frequency.value = isEven ? 800 : 600;

  // Increase volume as time runs out (from 0.1 to 0.4)
  const volumeMultiplier = 1 + (timerDuration - remaining) / timerDuration * 3;
  gainNode.gain.setValueAtTime(0.1 * volumeMultiplier, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

  oscillator.type = 'sine';
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.1);
}

function updateStopwatch() {
  if (!roundStartTime) return;
  const elapsed = Math.floor((Date.now() - roundStartTime) / 1000);
  const remaining = Math.max(0, timerDuration - elapsed);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isTimeUp = remaining === 0;

  // Play tick sound if there's time remaining
  if (remaining > 0) {
    playTickSound(remaining);
  }

  // Voice announcement when timer reaches 0
  if (isTimeUp && !hasAnnouncedTimeUp) {
    hasAnnouncedTimeUp = true;
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance("Time's up!");
      const voices = window.speechSynthesis.getVoices();
      const maleVoice = voices.find(voice => voice.name.includes('Male') || voice.name.includes('Daniel') || voice.name.includes('David'));
      if (maleVoice) utterance.voice = maleVoice;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    }

    // Auto-stop round for Standard, Type, Choice modes when time is up
    if (isRoundActive && (currentMode === "standard" || currentMode === "type" || currentMode === "choice")) {
      stopRound().catch((error) => {
        console.warn("Unable to auto-stop round after timer", error);
      });
    }
  }

  // Update standard mode timer
  if (currentMode === "standard") {
    if (clickedCountEl) {
      clickedCountEl.innerText = timeString;
      clickedCountEl.classList.toggle('timer-expired', isTimeUp);
    }
    if (clickedDetailEl) clickedDetailEl.innerText = "Round in progress...";
  }

  // Update type mode timer
  if (currentMode === "type") {
    const typeStopwatch = document.getElementById("typeStopwatch");
    if (typeStopwatch) {
      typeStopwatch.textContent = timeString;
      typeStopwatch.classList.toggle('timer-expired', isTimeUp);
    }
  }

  // Update choice mode timer
  if (currentMode === "choice") {
    ensureStatElements();
    if (choiceYesEl) {
      choiceYesEl.innerText = timeString;
      choiceYesEl.classList.toggle('timer-expired', isTimeUp);
    }
  }
}

function renderLiveStats() {
  ensureStatElements();

  const standardVisible = currentMode === "standard" || currentMode === "quick";

  if (standardStatsEl) standardStatsEl.classList.toggle("hidden", !standardVisible);
  if (typeStatsEl) typeStatsEl.classList.toggle("hidden", currentMode !== "type");
  if (choiceStatsEl) choiceStatsEl.classList.toggle("hidden", currentMode !== "choice");

  // Show stopwatch for Standard, Type, Choice modes when round is active
  const shouldShowStopwatch = isRoundActive && (currentMode === "standard" || currentMode === "type" || currentMode === "choice");

  if (standardVisible && clickedCountEl && clickedDetailEl) {
    if (quizMode) {
      if (clickedPercentWrap) clickedPercentWrap.classList.add("hidden");
      if (quizWinner) {
        clickedCountEl.innerText = quizWinner;
        clickedDetailEl.innerText = "First response recorded";
      } else {
        clickedCountEl.innerText = "—";
        clickedDetailEl.innerText = "Waiting for first response...";
      }
      if (clickedPercentEl) clickedPercentEl.innerText = "";
    } else if (shouldShowStopwatch && currentMode === "standard") {
      // Stopwatch is updated by updateStopwatch function
      if (clickedPercentWrap) clickedPercentWrap.classList.add("hidden");
    } else {
      if (clickedPercentWrap) clickedPercentWrap.classList.remove("hidden");
      clickedCountEl.innerText = String(latestCounts.clicked);
      const percent = latestCounts.total > 0 ? Math.round((latestCounts.clicked / latestCounts.total) * 100) : 0;
      if (clickedPercentEl) clickedPercentEl.innerText = percent + "%";
      clickedDetailEl.innerText = `${latestCounts.clicked} of ${latestCounts.total} students`;
    }
  }

  if (currentMode === "type") {
    if (shouldShowStopwatch) {
      // Show timer instead of responses
      if (typeResponseCountEl) {
        typeResponseCountEl.innerText = "Round in progress...";
      }
      if (typeWordCloudEl) {
        typeWordCloudEl.innerHTML = "";
        const stopwatchDiv = document.createElement("div");
        stopwatchDiv.className = "type-stopwatch";
        stopwatchDiv.id = "typeStopwatch";
        const timeString = roundStartTime
          ? (() => {
              const elapsed = Math.floor((Date.now() - roundStartTime) / 1000);
              const remaining = Math.max(0, timerDuration - elapsed);
              const minutes = Math.floor(remaining / 60);
              const seconds = remaining % 60;
              return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            })()
          : "00:10";
        stopwatchDiv.textContent = timeString;
        const isTimeUp = roundStartTime && Math.floor((Date.now() - roundStartTime) / 1000) >= timerDuration;
        if (isTimeUp) stopwatchDiv.classList.add('timer-expired');
        typeWordCloudEl.appendChild(stopwatchDiv);
      }
    } else {
      const responseCount = latestTypeResponses.length;
      if (typeResponseCountEl) {
        typeResponseCountEl.innerText = `${responseCount} response${responseCount === 1 ? "" : "s"}`;
      }
      renderWordCloud(latestTypeResponses);
    }
  }

  if (currentMode === "choice") {
    if (shouldShowStopwatch) {
      // Show timer instead of choice results
      const timeString = roundStartTime
        ? (() => {
            const elapsed = Math.floor((Date.now() - roundStartTime) / 1000);
            const remaining = Math.max(0, timerDuration - elapsed);
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
          })()
        : "00:10";

      const isTimeUp = roundStartTime && Math.floor((Date.now() - roundStartTime) / 1000) >= timerDuration;

      // Show timer in center, hide both columns
      if (choiceStatsEl) choiceStatsEl.classList.add('choice-timer-active');
      if (choiceYesEl) {
        choiceYesEl.innerText = timeString;
        choiceYesEl.classList.toggle('timer-expired', isTimeUp);
      }
      if (choiceNoEl) choiceNoEl.innerText = "";

      // Hide labels and percentages during round
      const yesDetailEl = choiceYesEl?.parentElement?.querySelector('.choice-meter__detail');
      const noDetailEl = choiceNoEl?.parentElement?.querySelector('.choice-meter__detail');
      if (yesDetailEl) yesDetailEl.style.visibility = 'hidden';
      if (noDetailEl) noDetailEl.style.visibility = 'hidden';
    } else {
      // Show choice results
      if (choiceStatsEl) choiceStatsEl.classList.remove('choice-timer-active');
      if (choiceYesEl) {
        choiceYesEl.innerText = latestChoiceCounts.yes;
        choiceYesEl.classList.remove('timer-expired');
      }
      if (choiceNoEl) choiceNoEl.innerText = latestChoiceCounts.no;

      const total = latestCounts.total;
      const yesPercent = total > 0 ? Math.round((latestChoiceCounts.yes / total) * 100) : 0;
      const noPercent = total > 0 ? Math.round((latestChoiceCounts.no / total) * 100) : 0;

      if (choiceYesPercentEl) choiceYesPercentEl.innerText = `${yesPercent}%`;
      if (choiceNoPercentEl) choiceNoPercentEl.innerText = `${noPercent}%`;

      // Show labels and percentages
      const yesDetailEl = choiceYesEl?.parentElement?.querySelector('.choice-meter__detail');
      const noDetailEl = choiceNoEl?.parentElement?.querySelector('.choice-meter__detail');
      if (yesDetailEl) yesDetailEl.style.visibility = 'visible';
      if (noDetailEl) noDetailEl.style.visibility = 'visible';
    }
  }
}

function renderWordCloud(responses) {
  ensureStatElements();
  if (!typeWordCloudEl) return;

  typeWordCloudEl.innerHTML = "";
  if (!responses || !responses.length) {
    const emptyState = document.createElement("p");
    emptyState.textContent = "Waiting for responses...";
    emptyState.style.margin = "0";
    emptyState.style.color = "rgba(31, 31, 31, 0.6)";
    typeWordCloudEl.appendChild(emptyState);
    return;
  }

  const counts = new Map();
  responses.forEach((entry) => {
    if (!entry) return;
    entry
      .split(/\s+/)
      .map((word) => word.replace(/[^\p{L}\p{N}'-]/gu, ""))
      .filter((word) => word && word.length > 1)
      .forEach((word) => {
        const normalized = word.toLowerCase();
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      });
  });

  const entries = Array.from(counts.entries());
  entries.sort((a, b) => b[1] - a[1]);
  const maxCount = entries.length ? entries[0][1] : 1;

  if (!entries.length) {
    const emptyState = document.createElement("p");
    emptyState.textContent = "Waiting for responses...";
    emptyState.style.margin = "0";
    emptyState.style.color = "rgba(31, 31, 31, 0.6)";
    typeWordCloudEl.appendChild(emptyState);
    return;
  }

  const fragment = document.createDocumentFragment();
  entries.forEach(([word, count]) => {
    const span = document.createElement("span");
    span.className = "word-cloud__word";
    const scale = count / maxCount;
    const fontSize = 18 + Math.round(scale * 26);
    span.style.fontSize = `${fontSize}px`;
    span.style.opacity = String(0.6 + scale * 0.4);
    span.textContent = word;
    fragment.appendChild(span);
  });

  typeWordCloudEl.appendChild(fragment);
}

function renderStudentsList(students) {
  if (!studentsList) return;
  studentsList.innerHTML = "";

  // Hide response status during active rounds for Standard, Type, Choice modes
  const shouldHideResponses = isRoundActive && (currentMode === "standard" || currentMode === "type" || currentMode === "choice");

  students.forEach(({ data }) => {
    const name = data.name || "Unnamed";
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = true;
    let className = "student-item";
    let label = name;

    if (shouldHideResponses) {
      // Show only names during active rounds
      label = name;
    } else if (currentMode === "standard") {
      if (data.clicked) className += " student-item--clicked";
    } else if (currentMode === "quick") {
      if (quizWinner && quizWinner === name) {
        className += " student-item--clicked";
      } else if (data.clicked) {
        className += " student-item--clicked";
      }
    } else if (currentMode === "type") {
      const response = data.textResponse && data.textResponse.trim();
      if (response) {
        label = `${name}: "${response}"`;
        className += " student-item--clicked";
      }
    } else if (currentMode === "choice") {
      if (data.choiceResponse === "yes") {
        label = `${name}: Yes`;
        className += " student-item--yes";
      } else if (data.choiceResponse === "no") {
        label = `${name}: No`;
        className += " student-item--no";
      }
    }

    button.className = className;
    button.textContent = label;
    studentsList.appendChild(button);
  });
}

function activateModeButton(mode) {
  if (!modeButtons.length && modeControl) {
    modeButtons = Array.from(modeControl.querySelectorAll(".segment-option"));
  }
  if (!modeButtons.length) return;
  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function setModeButtonsEnabled(enabled) {
  if (!modeButtons.length && modeControl) {
    modeButtons = Array.from(modeControl.querySelectorAll(".segment-option"));
  }
  if (!modeButtons.length) return;
  modeButtons.forEach((button) => {
    button.disabled = !enabled;
  });
}

function setMode(mode, { fromRemote = false } = {}) {
  if (!mode) return;
  const normalized = ["standard", "quick", "type", "choice"].includes(mode) ? mode : "standard";
  const changed = currentMode !== normalized;
  const previousMode = currentMode;
  currentMode = normalized;
  activateModeButton(normalized);

  const wasQuiz = quizMode;
  quizMode = currentMode === "quick";
  if (!quizMode) {
    quizWinner = null;
  } else if (!wasQuiz) {
    quizWinner = null;
  }

  if (currentMode === "standard" || currentMode === "quick") {
    const clicked = latestStudentData.reduce((sum, entry) => sum + (entry.data.clicked ? 1 : 0), 0);
    latestCounts = { total: latestCounts.total, clicked };
  }

  if (changed) {
    ensureStatElements();
    if (standardStatsEl) {
      const statsHeight = standardStatsEl.offsetHeight;
      if (statsHeight > 0) {
        if (currentMode === "type" && typeStatsEl) {
          typeStatsEl.style.height = `${statsHeight}px`;
        }
        if (currentMode === "choice" && choiceStatsEl) {
          choiceStatsEl.style.height = `${statsHeight}px`;
        }
      }
    }

    // Mark that teacher has chosen a mode
    if (sessionStatus === "started" && !fromRemote) {
      hasChosenMode = true;
      // Enable Next Round button if round is not active and mode was chosen
      if (roundButton && !isRoundActive) {
        roundButton.disabled = false;
      }
    }
  }

  renderLiveStats();
  renderStudentsList(latestStudentData);

  // Don't update Firestore mode here - it will be updated when Next Round is clicked
  // This prevents students from seeing mode changes before the round starts
}

function handleModeButtonClick(event) {
  const button = event.currentTarget;
  const mode = button.dataset.mode;
  if (!mode) return;
  setMode(mode);
}

function handleRandomNamesToggle(event) {
  if (!currentSessionId) return;
  updateDoc(doc(db, "sessions", currentSessionId), {
    requireStudentName: !event.target.checked
  }).catch((error) => {
    console.warn("Unable to update name mode", error);
  });
}

function addRoundSnapshot() {
  // Only track Standard, Type, and Choice modes (exclude Quick mode)
  if (currentMode === "quick") {
    return;
  }

  // Increment total tracked rounds
  totalTrackedRounds++;

  // Track participation for each student
  latestStudentData.forEach(({ data }) => {
    const name = data.name || "Unnamed";
    let participated = false;

    if (currentMode === "standard" && data.clicked) {
      participated = true;
    } else if (currentMode === "type" && data.textResponse && data.textResponse.trim()) {
      participated = true;
    } else if (currentMode === "choice" && (data.choiceResponse === "yes" || data.choiceResponse === "no")) {
      participated = true;
    }

    if (participated) {
      studentParticipationCount.set(name, (studentParticipationCount.get(name) || 0) + 1);
    } else {
      // Ensure student exists in map even if they didn't participate
      if (!studentParticipationCount.has(name)) {
        studentParticipationCount.set(name, 0);
      }
    }
  });

  roundHistory.push({
    index: roundHistory.length + 1,
    clicked: latestCounts.clicked,
    recordedAt: Date.now()
  });
}

async function newSession() {
  showSetupView();
  roundHistory = [];

  if (studentsUnsubscribe) {
    studentsUnsubscribe();
    studentsUnsubscribe = null;
  }

  currentSessionId = Math.random().toString(36).substring(2, 8);
  if (startButton) startButton.disabled = false;
  setMode("standard", { fromRemote: true });

  await setDoc(doc(db, "sessions", currentSessionId), {
    status: "waiting",
    createdAt: Date.now(),
    round: 0,
    mode: "standard",
    requireStudentName: randomNamesToggle ? !randomNamesToggle.checked : false
  });

  const basePath = window.location.pathname.replace(/index\.html?$/i, "");
  const studentUrl = `${window.location.origin}${basePath}student.html?session=${currentSessionId}`;

  const qrUrlEl = document.getElementById("qrUrl");
  if (qrUrlEl) {
    qrUrlEl.textContent = studentUrl;
    qrUrlEl.href = studentUrl;
  }

  if (qrCanvas) {
    const bounds = qrCanvas.getBoundingClientRect();
    const maxQrSize = 400;
    const cssSize = Math.min(maxQrSize, Math.round(bounds.width) || maxQrSize);
    const scale = window.devicePixelRatio || 1;
    const renderSize = cssSize * scale;

    QRCode.toCanvas(qrCanvas, studentUrl, { width: renderSize, margin: 0 }, (error) => {
      if (error) {
        console.error("Unable to render QR code", error);
        return;
      }
      qrCanvas.style.width = "100%";
      qrCanvas.style.height = "auto";
      qrCanvas.style.maxWidth = `${maxQrSize}px`;
    });
  }

  const instructionsEl = document.getElementById("statusInstructions");
  if (instructionsEl) instructionsEl.classList.add("hidden");
  const statusMessageEl = document.getElementById("statusMessage");
  if (statusMessageEl) {
    statusMessageEl.classList.remove("hidden");
    statusMessageEl.innerText = "Share the QR code so students can join.";
  }

  if (studentsList) studentsList.innerHTML = "";
  updateStudentCounts(0, 0);

  const studentsRef = collection(db, "sessions", currentSessionId, "students");
  studentsUnsubscribe = onSnapshot(studentsRef, (snapshot) => {
    if (studentsList) studentsList.innerHTML = "";
    let clicked = 0;
    let firstClickedName = quizWinner;
    const typeResponses = [];
    const choiceCounts = { yes: 0, no: 0 };

    const studentsData = [];

    snapshot.forEach((studentDoc) => {
      const data = studentDoc.data();
      const name = data.name || "Unnamed";

      if (data.clicked) {
        clicked += 1;
        if (quizMode && !firstClickedName) {
          firstClickedName = name;
        }
      }

      if (typeof data.textResponse === "string" && data.textResponse.trim()) {
        typeResponses.push(data.textResponse.trim());
      }

      if (data.choiceResponse === "yes") {
        choiceCounts.yes += 1;
      } else if (data.choiceResponse === "no") {
        choiceCounts.no += 1;
      }

      studentsData.push({ id: studentDoc.id, data });
    });

    latestStudentData = studentsData;
    latestTypeResponses = typeResponses;
    latestChoiceCounts = choiceCounts;

    if (quizMode && !quizWinner && firstClickedName) {
      quizWinner = firstClickedName;
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(`${firstClickedName}!`);
        const voices = window.speechSynthesis.getVoices();
        const maleVoice = voices.find(voice => voice.name.includes('Male') || voice.name.includes('Daniel') || voice.name.includes('David'));
        if (maleVoice) utterance.voice = maleVoice;
        utterance.rate = 1.1;
        utterance.pitch = 1.4;
        utterance.volume = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    } else if (!quizMode) {
      quizWinner = null;
    }

    renderStudentsList(latestStudentData);

    const respondedCount = currentMode === "type"
      ? typeResponses.length
      : currentMode === "choice"
        ? choiceCounts.yes + choiceCounts.no
        : clicked;

    updateStudentCounts(snapshot.size, respondedCount);

    // Auto-stop round logic
    if (sessionStatus === "started" && isRoundActive && respondedCount > 0) {
      if (currentMode === "quick") {
        // Quick mode: auto-stop after first response
        stopRound().catch((error) => {
          console.warn("Unable to auto-stop round", error);
        });
      } else if (snapshot.size > 0 && respondedCount >= snapshot.size) {
        // Standard/Type/Choice modes: auto-stop when all students have responded
        stopRound().catch((error) => {
          console.warn("Unable to auto-stop round", error);
        });
      }
    }
  });
}

async function startSession() {
  if (!currentSessionId) return;
  await updateDoc(doc(db, "sessions", currentSessionId), {
    status: "started",
    startedAt: Date.now(),
    roundActive: false,
    mode: "standard"
  });
  if (startButton) startButton.disabled = true;

  sessionStatus = "started";
  isRoundActive = false;
  hasChosenMode = true; // Standard mode is pre-selected
  currentMode = "standard";
  activateModeButton("standard");
  setModeButtonsEnabled(true);

  // Enable Start button - teacher needs to click it to begin first round
  if (roundButton) {
    roundButton.disabled = false;
    roundButton.textContent = "Start";
  }

  showLiveView();
}

async function startRound() {
  if (!currentSessionId) return;

  const sessionDocRef = doc(db, "sessions", currentSessionId);
  const studentsRef = collection(db, "sessions", currentSessionId, "students");
  const snapshot = await getDocs(studentsRef);

  // Clear student responses
  if (!snapshot.empty) {
    const batch = writeBatch(db);
    snapshot.forEach((studentDoc) => {
      batch.update(studentDoc.ref, {
        clicked: false,
        textResponse: null,
        choiceResponse: null
      });
    });
    await batch.commit();
  }

  await updateDoc(sessionDocRef, {
    status: "started",
    round: increment(1),
    roundActive: true,
    mode: currentMode,
    roundStartTime: Date.now()
  });

  // Track participation opportunity when starting new round in Quick/Type/Choice mode
  if (["quick", "type", "choice"].includes(currentMode)) {
    participationOpportunities++;
    currentOpportunityParticipants = new Set();
  }

  // Mark round as active and disable mode buttons
  isRoundActive = true;
  hasChosenMode = false;
  setModeButtonsEnabled(false);

  latestTypeResponses = [];
  latestChoiceCounts = { yes: 0, no: 0 };
  quizWinner = null;
  updateStudentCounts(snapshot.size, 0);

  // Start stopwatch for Standard, Type, Choice modes
  if (currentMode === "standard" || currentMode === "type" || currentMode === "choice") {
    startStopwatch();
  }

  renderLiveStats();

  // Update button to show "Stop"
  if (roundButton) {
    roundButton.textContent = "Stop";
    roundButton.disabled = false;
  }

  showLiveView();
}

async function stopRound() {
  if (!currentSessionId) return;

  // Stop stopwatch
  stopStopwatch();

  // Track round history before ending
  addRoundSnapshot();

  const sessionDocRef = doc(db, "sessions", currentSessionId);
  await updateDoc(sessionDocRef, {
    roundActive: false
  });

  // Mark round as inactive and enable mode buttons
  isRoundActive = false;
  setModeButtonsEnabled(true);

  // Re-render to show results
  renderLiveStats();
  renderStudentsList(latestStudentData);

  // Update button to show "Start"
  if (roundButton) {
    roundButton.textContent = "Start";
    roundButton.disabled = false;
  }
}

async function toggleRound() {
  if (isRoundActive) {
    await stopRound();
  } else {
    await startRound();
  }
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

function showParticipationTable() {
  renderParticipationTable();
  showParticipationView();
}

function renderParticipationTable() {
  if (!participationTableBody) return;

  participationTableBody.innerHTML = "";

  if (totalTrackedRounds === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 2;
    cell.textContent = "No participation data recorded yet.";
    cell.style.textAlign = "center";
    cell.style.padding = "24px";
    cell.style.color = "#6b7280";
    row.appendChild(cell);
    participationTableBody.appendChild(row);
    return;
  }

  // Calculate participation percentages and sort
  const participationData = [];
  studentParticipationCount.forEach((count, name) => {
    const percentage = totalTrackedRounds > 0 ? Math.round((count / totalTrackedRounds) * 100) : 0;
    participationData.push({ name, percentage });
  });

  // Sort by percentage in decreasing order
  participationData.sort((a, b) => b.percentage - a.percentage);

  // Render table rows with leaderboard styling
  participationData.forEach(({ name, percentage }, index) => {
    const row = document.createElement("tr");
    const rank = index + 1;

    // Determine emoji and color tier
    let emoji = "";
    let tierClass = "";
    if (rank === 1) {
      emoji = "🥇";
      tierClass = "rank-gold";
    } else if (rank === 2) {
      emoji = "🥈";
      tierClass = "rank-silver";
    } else if (rank === 3) {
      emoji = "🥉";
      tierClass = "rank-bronze";
    } else if (rank <= 10) {
      emoji = "🏆";
      tierClass = "rank-top10";
    }

    row.className = tierClass;

    const nameCell = document.createElement("td");
    nameCell.className = "leaderboard-name";
    nameCell.textContent = `${emoji} ${name}`.trim();
    row.appendChild(nameCell);

    const percentCell = document.createElement("td");
    percentCell.className = "leaderboard-percent";

    // Create progress bar container
    const progressContainer = document.createElement("div");
    progressContainer.className = "progress-container";

    const progressBar = document.createElement("div");
    progressBar.className = "progress-bar";
    progressBar.style.setProperty('--target-width', `${percentage}%`);

    const progressText = document.createElement("span");
    progressText.className = "progress-text";
    progressText.textContent = `${percentage}%`;

    progressContainer.appendChild(progressBar);
    progressContainer.appendChild(progressText);
    percentCell.appendChild(progressContainer);

    row.appendChild(percentCell);

    participationTableBody.appendChild(row);
  });
}

function closeParticipationTable() {
  currentSessionId = null;
  resetUi();
  showSetupView();
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

  if (!roundHistory.length) {
    context.fillStyle = "#6b7280";
    context.font = (18 * dpr) + "px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("No round data recorded yet.", width / 2, height / 2);
    return;
  }

  const maxClicked = Math.max(1, ...roundHistory.map(entry => entry.clicked));
  const lastIndex = roundHistory.length - 1;
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
  roundHistory.forEach((entry, index) => {
    const x = getX(index);
    const y = height - padding - (chartHeight * (entry.clicked / maxClicked));
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.stroke();

  roundHistory.forEach((entry, index) => {
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
  const axisLabelOffset = 28 * dpr;
  context.fillText("Round Number", padding + chartWidth / 2, height - padding + axisLabelOffset);
  context.save();
  context.translate(padding / 2, padding + chartHeight / 2);
  context.rotate(-Math.PI / 2);
  context.textBaseline = "middle";
  context.fillText("Students clicked", 0, 0);
  context.restore();

  context.fillStyle = "#6b7280";
  context.font = (12 * dpr) + "px Arial";
  context.textAlign = "center";
  context.textBaseline = "top";
  roundHistory.forEach((entry, index) => {
    const x = getX(index);
    context.fillText(String(index + 1), x, height - padding + 16 * dpr);
  });
}

function initialiseDom() {
  mainLayout = document.getElementById("mainLayout");
  livePanel = document.getElementById("livePanel");
  chartPanel = document.getElementById("chartPanel");
  participationPanel = document.getElementById("participationPanel");
  startButton = document.getElementById("startButton");
  roundButton = document.getElementById("roundButton");
  qrCanvas = document.getElementById("qrcode");
  studentsList = document.getElementById("students");
  studentCountLabel = document.getElementById("studentCount");
  chartCanvas = document.getElementById("chartCanvas");
  participationTableBody = document.getElementById("participationTableBody");
  randomNamesToggle = document.getElementById("randomNamesToggle");
  modeControl = document.getElementById("modeControl");
  ensureStatElements();

  if (randomNamesToggle) randomNamesToggle.addEventListener("change", handleRandomNamesToggle);
  if (modeControl) {
    modeButtons = Array.from(modeControl.querySelectorAll(".segment-option"));
    modeButtons.forEach((button) => button.addEventListener("click", handleModeButtonClick));
  }

  activateModeButton(currentMode);
  renderLiveStats();

  resetUi();
  showSetupView();
}

window.addEventListener("DOMContentLoaded", initialiseDom);

function openStudentWindow(event) {
  event.preventDefault();
  const url = event.currentTarget.href;
  if (!url) return;

  const width = 400;
  const height = 800;
  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;

  window.open(
    url,
    '_blank',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
}

function openHelpModal() {
  const helpModal = document.getElementById("helpModal");
  if (helpModal) {
    helpModal.classList.remove("hidden");
  }
}

function closeHelpModal() {
  const helpModal = document.getElementById("helpModal");
  if (helpModal) {
    helpModal.classList.add("hidden");
  }
}

window.newSession = newSession;
window.startSession = startSession;
window.toggleRound = toggleRound;
window.finishSession = finishSession;
window.closeChart = closeChart;
window.showParticipationTable = showParticipationTable;
window.closeParticipationTable = closeParticipationTable;
window.openStudentWindow = openStudentWindow;
window.openHelpModal = openHelpModal;
window.closeHelpModal = closeHelpModal;
