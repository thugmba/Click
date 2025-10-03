﻿import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  onSnapshot,
  updateDoc
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
const endedNotice = document.getElementById("ended");

const aliasOptions = [
  "Aurora","Blaze","Comet","Echo","Flare","Jade","Nova","Orion","Quill","Rune",
  "Sable","Tundra","Vesper","Willow","Zephyr","Atlas","Cinder","Harbor","Lumen","Sonic"
];

function generateRandomName() {
  return aliasOptions[Math.floor(Math.random() * aliasOptions.length)];
}

const aliasStorageKey = sessionId ? `click-alias-${sessionId}` : null;
let assignedName = aliasStorageKey ? localStorage.getItem(aliasStorageKey) : null;
if (!assignedName) {
  assignedName = generateRandomName();
  if (aliasStorageKey) {
    try {
      localStorage.setItem(aliasStorageKey, assignedName);
    } catch (error) {
      console.warn("Unable to persist alias", error);
    }
  }
}

let myDocRef = null;
let sessionUnsubscribe = null;
let myDocUnsubscribe = null;
let sessionStatus = "connecting";

if (actionButton) {
  actionButton.disabled = true;
  actionButton.textContent = "Connecting...";
}

function resetActionButton() {
  if (!actionButton) return;
  delete actionButton.dataset.clicked;
  if (sessionStatus === "started") {
    actionButton.disabled = false;
    actionButton.textContent = "OK";
  } else if (sessionStatus === "waiting") {
    actionButton.disabled = true;
    actionButton.textContent = "Waiting...";
  }
}

function showWaitingState() {
  sessionStatus = "waiting";
  if (endedNotice) endedNotice.classList.add("hidden");
  resetActionButton();
}

function showLiveState() {
  sessionStatus = "started";
  if (endedNotice) endedNotice.classList.add("hidden");
  if (actionButton && !actionButton.dataset.clicked) {
    actionButton.disabled = false;
    actionButton.textContent = "OK";
  }
}

function showEndedState() {
  sessionStatus = "ended";
  if (actionButton) {
    actionButton.disabled = true;
    actionButton.textContent = "Done";
  }
  if (endedNotice) endedNotice.classList.remove("hidden");
  if (myDocUnsubscribe) {
    myDocUnsubscribe();
    myDocUnsubscribe = null;
  }
}

function subscribeToSession() {
  if (sessionUnsubscribe || !sessionId) return;

  const sessionDocRef = doc(db, "sessions", sessionId);
  sessionUnsubscribe = onSnapshot(sessionDocRef, (snap) => {
    if (!snap.exists()) {
      showEndedState();
      return;
    }

    const status = snap.data().status;
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
      showEndedState();
      return;
    }

    const data = snap.data();
    if (data.clicked) {
      if (actionButton) {
        actionButton.dataset.clicked = "true";
        actionButton.disabled = true;
        actionButton.textContent = "Sent!";
      }
    } else {
      if (sessionStatus === "started") {
        resetActionButton();
      } else if (sessionStatus === "waiting") {
        showWaitingState();
      }
    }
  });
}

async function joinSession() {
  if (!sessionId) {
    if (actionButton) {
      actionButton.disabled = true;
      actionButton.textContent = "No session";
    }
    return;
  }

  if (!myDocRef) {
    myDocRef = await addDoc(collection(db, "sessions", sessionId, "students"), {
      name: assignedName,
      clicked: false,
      joinedAt: Date.now()
    });
    subscribeToMyDoc(myDocRef);
  }

  showWaitingState();
  subscribeToSession();
}

async function clickButton() {
  if (!myDocRef || !actionButton) return;
  actionButton.disabled = true;
  actionButton.textContent = "Sending...";

  try {
    await updateDoc(myDocRef, { clicked: true, clickedAt: Date.now() });
  } catch (error) {
    console.error("Failed to send click", error);
    resetActionButton();
  }
}

joinSession().catch((error) => {
  console.error("Unable to join session", error);
  if (actionButton) {
    actionButton.disabled = true;
    actionButton.textContent = "Retry";
  }
});

window.clickButton = clickButton;
