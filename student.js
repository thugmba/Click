import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  getDocs,
  query,
  where,
  limit
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

const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get("session");

const actionButton = document.getElementById("actionButton");
const nameDisplay = document.getElementById("studentName");
const endedNotice = document.getElementById("ended");
const nameForm = document.getElementById("nameForm");
const nameInput = document.getElementById("nameInput");
const nameError = document.getElementById("nameError");
const responseForm = document.getElementById("responseForm");
const responseInput = document.getElementById("responseInput");
const responseError = document.getElementById("responseError");
const responseSubmitButton = responseForm ? responseForm.querySelector(".student-response-form__submit") : null;
const choiceButtons = document.getElementById("choiceButtons");
const choiceYesButton = document.getElementById("choiceYesButton");
const choiceNoButton = document.getElementById("choiceNoButton");

const aliasOptions = [
  "Aurora","Blaze","Comet","Echo","Flare","Jade","Nova","Orion","Quill","Rune",
  "Sable","Tundra","Vesper","Willow","Zephyr","Atlas","Cinder","Harbor","Lumen","Sonic"
];

function toggleElement(element, shouldShow) {
  if (!element) return;
  element.classList.toggle("hidden", !shouldShow);
}

function generateRandomName() {
  return aliasOptions[Math.floor(Math.random() * aliasOptions.length)];
}

const aliasStorageKey = sessionId ? `click-alias-${sessionId}` : null;
const aliasMetaKey = sessionId ? `click-alias-meta-${sessionId}` : null;
let assignedName = aliasStorageKey ? localStorage.getItem(aliasStorageKey) : null;
let aliasSource = aliasMetaKey ? localStorage.getItem(aliasMetaKey) : null;

function persistAssignedName(name) {
  if (!aliasStorageKey) return;
  try {
    if (name) {
      localStorage.setItem(aliasStorageKey, name);
      if (aliasMetaKey && aliasSource) {
        localStorage.setItem(aliasMetaKey, aliasSource);
      }
    } else {
      localStorage.removeItem(aliasStorageKey);
      if (aliasMetaKey) localStorage.removeItem(aliasMetaKey);
    }
  } catch (error) {
    console.warn("Unable to persist alias", error);
  }
}

let requireStudentName = false;
let currentMode = "standard";
let myDocData = null;
let roundActive = false;

function updateNameDisplay(nameOverride) {
  if (!nameDisplay) return;
  if (nameOverride) {
    nameDisplay.textContent = nameOverride;
  } else {
    nameDisplay.textContent = requireStudentName ? "" : "Connecting...";
  }
}

function setAssignedName(name, { persist = true, source } = {}) {
  const trimmed = name ? name.trim() : "";
  assignedName = trimmed || null;
  if (assignedName) {
    if (source) {
      aliasSource = source;
    } else if (!aliasSource) {
      aliasSource = "manual";
    }
  } else {
    aliasSource = null;
  }
  if (persist) {
    persistAssignedName(assignedName);
  }
  updateNameDisplay(assignedName);
}

if (assignedName) {
  updateNameDisplay(assignedName);
}

const docStorageKey = sessionId ? `click-student-doc-${sessionId}` : null;
const clientIdStorageKey = "click-student-client";

function readCookie(name) {
  if (typeof document === "undefined" || !document.cookie) return null;
  const value = document.cookie
    .split(";")
    .map((piece) => piece.trim())
    .find((piece) => piece.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.split("=")[1]) : null;
}

function writeCookie(name, value, days = 365) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

function getPersistentClientId() {
  const generateId = () => (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    let id = localStorage.getItem(clientIdStorageKey);
    if (id) return id;
    id = generateId();
    localStorage.setItem(clientIdStorageKey, id);
    return id;
  } catch (error) {
    console.warn("Unable to access localStorage for client id", error);
  }

  const cookieId = readCookie(clientIdStorageKey);
  if (cookieId) return cookieId;

  const fallbackId = generateId();
  writeCookie(clientIdStorageKey, fallbackId);
  return fallbackId;
}

const clientId = getPersistentClientId();

function readStoredDocId() {
  if (!docStorageKey) return null;
  try {
    return localStorage.getItem(docStorageKey);
  } catch (error) {
    console.warn("Unable to read stored student doc", error);
    return null;
  }
}

function persistStoredDocId(id) {
  if (!docStorageKey) return;
  try {
    localStorage.setItem(docStorageKey, id);
  } catch (error) {
    console.warn("Unable to persist student doc id", error);
  }
}

function clearStoredDocId() {
  if (!docStorageKey) return;
  try {
    localStorage.removeItem(docStorageKey);
  } catch (error) {
    console.warn("Unable to clear stored student doc", error);
  }
}

function showNameForm() {
  if (!nameForm) return;
  nameForm.classList.remove("hidden");
  if (nameError) {
    nameError.textContent = "Please enter your name.";
    nameError.classList.add("hidden");
  }
  if (nameInput) {
    nameInput.value = assignedName || "";
    try {
      nameInput.focus({ preventScroll: true });
    } catch (error) {
      // focus might fail on some browsers; ignore
    }
  }
  if (actionButton) {
    actionButton.disabled = true;
    actionButton.textContent = "Enter name";
  }
}

function hideNameForm() {
  if (!nameForm) return;
  nameForm.classList.add("hidden");
  if (nameError) nameError.classList.add("hidden");
}

function ensureRandomNameAssigned() {
  if (!assignedName) {
    setAssignedName(generateRandomName(), { source: "auto" });
  }
}

function handleNameSubmit(event) {
  event.preventDefault();
  if (!nameInput) return;
  const value = nameInput.value.trim();
  if (!value) {
    if (nameError) {
      nameError.textContent = "Please enter your name.";
      nameError.classList.remove("hidden");
    }
    return;
  }

  if (nameError) nameError.classList.add("hidden");
  setAssignedName(value, { source: "manual" });
  hideNameForm();
  joinSession().catch((error) => {
    console.error("Unable to join session after name entry", error);
    if (nameError) {
      nameError.textContent = "Unable to join. Please try again.";
      nameError.classList.remove("hidden");
    }
    showNameForm();
  });
}

if (nameForm) {
  nameForm.addEventListener("submit", handleNameSubmit);
}

if (responseForm) {
  responseForm.addEventListener("submit", handleResponseFormSubmit);
}

if (choiceYesButton) choiceYesButton.addEventListener("click", handleChoiceClick);
if (choiceNoButton) choiceNoButton.addEventListener("click", handleChoiceClick);

let myDocRef = null;
let sessionUnsubscribe = null;
let myDocUnsubscribe = null;
let sessionStatus = "connecting";
let isJoining = false;

updateNameDisplay(assignedName);
refreshUiForCurrentState();

function refreshUiForCurrentState() {
  const isStandardMode = currentMode === "standard" || currentMode === "quick";

  toggleElement(actionButton, isStandardMode);
  toggleElement(responseForm, currentMode === "type");
  toggleElement(choiceButtons, currentMode === "choice");

  if (isStandardMode) {
    updateStandardButtonState();
    return;
  }

  if (currentMode === "type") {
    const hasResponse = Boolean(myDocData && typeof myDocData.textResponse === "string" && myDocData.textResponse.trim());
    const canInteract = sessionStatus === "started" && roundActive && !hasResponse;
    if (responseSubmitButton) {
      responseSubmitButton.disabled = !canInteract;
      responseSubmitButton.textContent = hasResponse ? "Sent!" : "Send";
    }
    if (responseInput) {
      const storedValue = myDocData && typeof myDocData.textResponse === "string" ? myDocData.textResponse : "";
      if (document.activeElement !== responseInput) {
        responseInput.value = storedValue;
      }
      responseInput.disabled = !canInteract;
      responseInput.placeholder = hasResponse ? "Response sent" : (roundActive ? "Type your answer" : "Waiting for round to start");
    }
    if (responseError && !roundActive) {
      responseError.classList.add("hidden");
    }
    return;
  }

  if (currentMode === "choice") {
    const hasChoice = Boolean(myDocData && myDocData.choiceResponse);
    const enabled = sessionStatus === "started" && roundActive && !hasChoice;
    [choiceYesButton, choiceNoButton].forEach((button) => {
      if (!button) return;
      button.disabled = !enabled;
      button.classList.remove("student-choice__option--selected");
    });
    if (myDocData) {
      if (myDocData.choiceResponse === "yes" && choiceYesButton) {
        choiceYesButton.classList.add("student-choice__option--selected");
      } else if (myDocData.choiceResponse === "no" && choiceNoButton) {
        choiceNoButton.classList.add("student-choice__option--selected");
      }
    }
  }
}

if (actionButton) {
  actionButton.disabled = true;
  actionButton.textContent = "Connecting...";
}

function updateStandardButtonState() {
  if (!actionButton || (currentMode !== "standard" && currentMode !== "quick")) return;

  if (sessionStatus === "connecting") {
    actionButton.disabled = true;
    actionButton.textContent = "Connecting...";
    delete actionButton.dataset.clicked;
    return;
  }

  if (sessionStatus === "ended") {
    actionButton.disabled = true;
    actionButton.textContent = "Done";
    actionButton.dataset.clicked = "true";
    return;
  }

  if (sessionStatus === "waiting") {
    actionButton.disabled = true;
    actionButton.textContent = currentMode === "quick" ? "Buzz" : "Waiting...";
    delete actionButton.dataset.clicked;
    return;
  }

  // Check if round is active and if student has clicked
  const hasClicked = myDocData && myDocData.clicked;
  const canClick = sessionStatus === "started" && roundActive && !hasClicked;

  if (hasClicked) {
    actionButton.dataset.clicked = "true";
    actionButton.disabled = true;
    actionButton.textContent = "Sent!";
  } else if (!roundActive) {
    delete actionButton.dataset.clicked;
    actionButton.disabled = true;
    actionButton.textContent = "Waiting for round to start";
  } else {
    delete actionButton.dataset.clicked;
    actionButton.disabled = !canClick;
    actionButton.textContent = currentMode === "quick" ? "Buzz" : "OK";
  }
}

function showWaitingState() {
  sessionStatus = "waiting";
  if (endedNotice) endedNotice.classList.add("hidden");
  hideNameForm();
  refreshUiForCurrentState();
}

function showLiveState() {
  sessionStatus = "started";
  if (endedNotice) endedNotice.classList.add("hidden");
  hideNameForm();
  refreshUiForCurrentState();
}

function showEndedState() {
  sessionStatus = "ended";
  hideNameForm();
  if (endedNotice) endedNotice.classList.remove("hidden");
  if (myDocUnsubscribe) {
    myDocUnsubscribe();
    myDocUnsubscribe = null;
  }
  refreshUiForCurrentState();
}

function applyStudentDocData(data) {
  myDocData = data || null;
  refreshUiForCurrentState();
}

async function submitTextResponse(value) {
  if (!value) return;
  if (!myDocRef) await ensureStudentDoc();
  if (!myDocRef) throw new Error("Missing student document");
  await updateDoc(myDocRef, {
    textResponse: value,
    textUpdatedAt: Date.now()
  });
}

async function submitChoiceResponse(choice) {
  if (!choice) return;
  if (!myDocRef) await ensureStudentDoc();
  if (!myDocRef) throw new Error("Missing student document");
  await updateDoc(myDocRef, {
    choiceResponse: choice,
    choiceUpdatedAt: Date.now()
  });
}

function handleResponseFormSubmit(event) {
  event.preventDefault();
  if (!responseInput) return;
  if (sessionStatus !== "started") {
    if (responseError) {
      responseError.textContent = "Wait for the teacher to start.";
      responseError.classList.remove("hidden");
    }
    return;
  }

  const value = responseInput.value.trim();
  if (!value) {
    if (responseError) {
      responseError.textContent = "Please enter a response.";
      responseError.classList.remove("hidden");
    }
    return;
  }

  if (responseError) responseError.classList.add("hidden");
  if (responseError) responseError.textContent = "Please enter a response.";

  submitTextResponse(value)
    .then(() => {
      myDocData = { ...(myDocData || {}), textResponse: value };
      refreshUiForCurrentState();
    })
    .catch((error) => {
      console.error("Unable to submit response", error);
      if (responseError) {
        responseError.textContent = "Unable to send. Please try again.";
        responseError.classList.remove("hidden");
      }
    });
}

function handleChoiceClick(event) {
  const button = event.currentTarget;
  const choice = button?.dataset.choice;
  if (!choice || sessionStatus !== "started") return;

  submitChoiceResponse(choice)
    .then(() => {
      myDocData = { ...(myDocData || {}), choiceResponse: choice };
      refreshUiForCurrentState();
    })
    .catch((error) => {
      console.error("Unable to submit choice", error);
    });
}

function subscribeToSession() {
  if (sessionUnsubscribe || !sessionId) return;

  const sessionDocRef = doc(db, "sessions", sessionId);
  sessionUnsubscribe = onSnapshot(sessionDocRef, (snap) => {
    if (!snap.exists()) {
      showEndedState();
      return;
    }

    const sessionData = snap.data();
    const nextRequireName = !!sessionData.requireStudentName;
    if (nextRequireName !== requireStudentName) {
      requireStudentName = nextRequireName;
      updateNameDisplay(assignedName);
      if (requireStudentName) {
        if (!myDocRef && (!assignedName || aliasSource !== "manual")) {
          if (assignedName && aliasSource !== "manual") {
            setAssignedName(null, { persist: true });
          }
          showNameForm();
        }
        refreshUiForCurrentState();
      } else {
        hideNameForm();
        ensureRandomNameAssigned();
        if (!myDocRef) {
          joinSession().catch((error) => {
            console.error("Unable to join session after mode change", error);
          });
        }
        refreshUiForCurrentState();
      }
    } else if (requireStudentName && !myDocRef && (!assignedName || aliasSource !== "manual")) {
      showNameForm();
    }

    const nextMode = sessionData.mode || "standard";
    const modeChanged = nextMode !== currentMode;
    if (modeChanged) {
      currentMode = nextMode;
    }

    // Track round state
    const nextRoundActive = sessionData.roundActive === true;
    const roundStateChanged = nextRoundActive !== roundActive;
    roundActive = nextRoundActive;

    // When new round starts (roundActive changes to true), reset student UI
    if (roundStateChanged && roundActive && myDocData) {
      // New round started, clear student's response data locally to reset UI
      myDocData = {
        ...myDocData,
        clicked: false,
        textResponse: null,
        choiceResponse: null
      };
    }

    // Refresh UI if mode or round state changed
    if (modeChanged || roundStateChanged) {
      refreshUiForCurrentState();
    }

    const status = sessionData.status;
    if (status === "started") {
      showLiveState();
    } else if (status === "waiting") {
      showWaitingState();
    } else if (status === "ended") {
      showEndedState();
    }
  });
}

function subscribeToMyDoc(docRef) {
  if (!docRef) return;
  if (myDocUnsubscribe) myDocUnsubscribe();

  myDocUnsubscribe = onSnapshot(docRef, (snap) => {
    if (!snap.exists()) {
      clearStoredDocId();
      myDocData = null;
      showEndedState();
      return;
    }

    const data = snap.data();
    applyStudentDocData(data);
    if (!data.clicked && sessionStatus === "waiting") {
      showWaitingState();
    }
  });
}

async function ensureStudentDoc() {
  if (myDocRef || !sessionId) return myDocRef;

  const studentsCollection = collection(db, "sessions", sessionId, "students");

  const storedDocId = readStoredDocId();
  if (storedDocId) {
    const existingDocRef = doc(studentsCollection, storedDocId);
    try {
      const existingDocSnap = await getDoc(existingDocRef);
      if (existingDocSnap.exists()) {
        myDocRef = existingDocRef;
        const existingData = existingDocSnap.data();
        if (assignedName) {
          if (existingData && existingData.name && existingData.name !== assignedName) {
            try {
              await updateDoc(existingDocRef, { name: assignedName });
            } catch (error) {
              console.warn("Unable to sync stored name", error);
            }
          }
        } else if (existingData && existingData.name) {
          setAssignedName(existingData.name, { persist: true, source: aliasSource || "manual" });
        }
        applyStudentDocData(existingData);
        subscribeToMyDoc(myDocRef);
        return myDocRef;
      }
      clearStoredDocId();
    } catch (error) {
      console.warn("Unable to load stored student doc", error);
    }
  }

  if (clientId) {
    try {
      const existingQuery = query(
        studentsCollection,
        where("clientId", "==", clientId),
        limit(1)
      );
      const existingSnapshot = await getDocs(existingQuery);
      if (!existingSnapshot.empty) {
        const docFromQuery = existingSnapshot.docs[0];
        const existingData = docFromQuery.data();
        myDocRef = doc(studentsCollection, docFromQuery.id);
        if (assignedName) {
          if (existingData && existingData.name && existingData.name !== assignedName) {
            try {
              await updateDoc(myDocRef, { name: assignedName });
            } catch (error) {
              console.warn("Unable to refresh stored name", error);
            }
          }
        } else if (existingData && existingData.name) {
          setAssignedName(existingData.name, { persist: true, source: aliasSource || "manual" });
        }
        applyStudentDocData(existingData);
        persistStoredDocId(docFromQuery.id);
        subscribeToMyDoc(myDocRef);
        return myDocRef;
      }
    } catch (error) {
      console.warn("Unable to query existing student doc", error);
    }
  }

  const newDocRef = await addDoc(studentsCollection, {
    name: assignedName,
    clicked: false,
    joinedAt: Date.now(),
    clientId: clientId || null,
    textResponse: null,
    choiceResponse: null
  });

  myDocRef = newDocRef;
  persistStoredDocId(newDocRef.id);
  subscribeToMyDoc(myDocRef);
  return myDocRef;
}

async function joinSession() {
  if (isJoining) return;
  if (!sessionId) {
    if (actionButton) {
      actionButton.disabled = true;
      actionButton.textContent = "No session";
    }
    return;
  }

  if (requireStudentName && !assignedName) {
    showNameForm();
    return;
  }

  ensureRandomNameAssigned();

  isJoining = true;
  try {
    await ensureStudentDoc();
    showWaitingState();
    subscribeToSession();
  } finally {
    isJoining = false;
  }
}

async function clickButton() {
  if (!myDocRef || !actionButton) return;
  actionButton.disabled = true;
  actionButton.textContent = "Sending...";

  try {
    await updateDoc(myDocRef, { clicked: true, clickedAt: Date.now() });
  } catch (error) {
    console.error("Failed to send click", error);
    updateStandardButtonState();
  }
}

async function initialiseStudentPage() {
  subscribeToSession();

  if (!sessionId) {
    if (actionButton) {
      actionButton.disabled = true;
      actionButton.textContent = "No session";
    }
    return;
  }

  try {
    const sessionDocRef = doc(db, "sessions", sessionId);
    const sessionSnap = await getDoc(sessionDocRef);
    if (!sessionSnap.exists()) {
      showEndedState();
      return;
    }

    const data = sessionSnap.data();
    requireStudentName = !!data.requireStudentName;
    currentMode = data.mode || "standard";
    updateNameDisplay(assignedName);
    refreshUiForCurrentState();

    if (data.status === "ended") {
      showEndedState();
      return;
    }

    if (requireStudentName) {
      if (assignedName && aliasSource === "manual") {
        await joinSession();
      } else {
        if (!myDocRef && assignedName && aliasSource !== "manual") {
          setAssignedName(null, { persist: true });
        }
        showNameForm();
      }
    } else {
      await joinSession();
    }
  } catch (error) {
    console.error("Unable to load session", error);
    if (actionButton) {
      actionButton.disabled = true;
      actionButton.textContent = "Retry";
    }
  }
}

initialiseStudentPage().catch((error) => {
  console.error("Initialisation failed", error);
  if (actionButton) {
    actionButton.disabled = true;
    actionButton.textContent = "Retry";
  }
});

window.clickButton = clickButton;
