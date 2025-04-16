import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, getDocs, setDoc, deleteDoc, collection } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD1LpIBMmZAiQFwberKbx2G29t6fNph3Xg",
  authDomain: "sample-dc6d0.firebaseapp.com",
  projectId: "sample-dc6d0",
  storageBucket: "sample-dc6d0.appspot.com",
  messagingSenderId: "650782048731",
  appId: "1:650782048731:web:d2828c5b87f0a4e62367fe",
  measurementId: "G-WJMEY6J7BR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function copySubcollections(oldUsername, newUsername) {
  const subcollectionNames = ["reviews", "following", "followers", "favorite_movies"];

  for (const sub of subcollectionNames) {
    console.log(`\n➡Copying subcollection: ${sub}`);

    const oldSubRef = collection(db, "users", oldUsername, sub);
    const newSubRef = collection(db, "users", newUsername, sub);

    const snapshot = await getDocs(oldSubRef);
    console.log(`Found ${snapshot.size} docs in "${sub}"`);

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const newDocRef = doc(db, "users", newUsername, sub, docSnap.id);
      console.log(`Copying doc: ${docSnap.id} →`, data);
      await setDoc(newDocRef, data);
    }
  }

  console.log("All subcollections copied.");
}


document.addEventListener("DOMContentLoaded", async function () {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const changeUsernameLink = document.getElementById("changeUsernameLink");
  const usernameEdit = document.querySelector(".username-edit");
  const usernameInput = document.getElementById("usernameInput");
  const confirmUsernameButton = document.getElementById("confirmUsernameButton");
  const firstNameDisplay = document.getElementById("firstNameDisplay");
  const lastNameDisplay = document.getElementById("lastNameDisplay");
  const emailDisplay = document.getElementById("emailDisplay");

  let currentUsername = localStorage.getItem("loggedInUser") || "DefaultUser";
  usernameDisplay.textContent = currentUsername;
  usernameInput.value = currentUsername;

  // Fetch first and last name from Firebase
  try {
    const userRef = doc(db, "users", currentUsername);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      firstNameDisplay.textContent = userData.firstName || "N/A";
      lastNameDisplay.textContent = userData.lastName || "N/A";
      emailDisplay.textContent = userData.email || "N/A";
    } else {
      console.warn("user document not found for:", currentUsername);
    }
  } catch (error) {
    console.error("error fetching user info:", error);
  }

  changeUsernameLink.addEventListener("click", function (e) {
    e.preventDefault();
    usernameDisplay.style.display = "none";
    changeUsernameLink.style.display = "none";
    usernameEdit.style.display = "flex";
    usernameInput.focus();
  });

  confirmUsernameButton.addEventListener("click", async function () {
    const newUsername = usernameInput.value.trim();

    if (newUsername && newUsername !== currentUsername) {
      try {
        const oldUserRef = doc(db, "users", currentUsername);
        const newUserRef = doc(db, "users", newUsername);
        const oldUserSnap = await getDoc(oldUserRef);

        if (oldUserSnap.exists()) {
          const userData = oldUserSnap.data();
          const newSnap = await getDoc(newUserRef);
          if (newSnap.exists()) {
            alert("username is already taken.");
            return;
          }

          await setDoc(newUserRef, {...userData, username: newUsername});
          await copySubcollections(currentUsername, newUsername);
          await deleteDoc(oldUserRef);

          currentUsername = newUsername;
          usernameDisplay.textContent = currentUsername;
          localStorage.setItem("loggedInUser", currentUsername);

          alert("username successfully updated in firebase");
        } else {
          alert("original user not found in firebase");
          console.error("no user doc found for:", currentUsername);
        }
      } catch (error) {
        console.error("error updating username:", error);
        alert("failed to update username in Firebase.");
      }
    } else {
      console.log("username unchanged or invalid.");
    }

    usernameEdit.style.display = "none";
    usernameDisplay.style.display = "inline";
    changeUsernameLink.style.display = "inline";
  });

  // == Password ==
  const changePasswordLink = document.getElementById("changePasswordLink");
  const passwordEdit = document.querySelector(".password-edit");
  const confirmPasswordButton = document.getElementById("confirmPasswordButton");
  const passwordInput = document.getElementById("passwordInput");
  const passwordSuccessMessage = document.getElementById("passwordSuccessMessage");
  const togglePassword = document.getElementById("togglePassword");

  changePasswordLink.addEventListener("click", function (e) {
    e.preventDefault();
    changePasswordLink.style.display = "none";
    passwordEdit.style.display = "flex";
    passwordInput.focus();
  });

  togglePassword.addEventListener("click", function () {
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      togglePassword.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
      passwordInput.type = "password";
      togglePassword.innerHTML = '<i class="fas fa-eye"></i>';
    }
  });

  confirmPasswordButton.addEventListener("click", async function () {
    const newPassword = passwordInput.value.trim();
    if (!newPassword) {
      alert("please enter a new password.");
      return;
    }

    try {
      const userRef = doc(db, "users", currentUsername);
      await setDoc(userRef, { password: newPassword }, { merge: true });

      passwordEdit.style.display = "none";
      passwordInput.value = "";
      passwordInput.type = "password";
      togglePassword.innerHTML = '<i class="fas fa-eye"></i>';
      passwordSuccessMessage.style.display = "block";

      alert("password updated successfully!");
    } catch (error) {
      console.error("error updating password:", error);
      alert("failed to update password: " + error.message);
    }
  });


  // === First Name ===
  const changeFirstNameLink = document.getElementById("changeFirstNameLink");
  const firstNameInput = document.getElementById("firstNameInput");
  const confirmFirstNameButton = document.getElementById("confirmFirstNameButton");
  const firstNameEdit = document.querySelector(".firstName-edit");

  changeFirstNameLink.addEventListener("click", function(e) {
    e.preventDefault();
    firstNameInput.value = firstNameDisplay.textContent;
    firstNameEdit.style.display = "flex";
    changeFirstNameLink.style.display = "none";
  });

  confirmFirstNameButton.addEventListener("click", async function () {
    const newFirstName = firstNameInput.value.trim();
    if (!newFirstName) return;

    try {
      const userRef = doc(db, "users", currentUsername);
      await setDoc(userRef, { firstName: newFirstName }, { merge: true });

      firstNameDisplay.textContent = newFirstName;
      firstNameEdit.style.display = "none";
      changeFirstNameLink.style.display = "inline";
      alert("first name updated!");
    } catch (error) {
      console.error("error updating first name:", error);
    }
  });

// === Last Name ===
  const changeLastNameLink = document.getElementById("changeLastNameLink");
  const lastNameInput = document.getElementById("lastNameInput");
  const confirmLastNameButton = document.getElementById("confirmLastNameButton");
  const lastNameEdit = document.querySelector(".lastName-edit");

  changeLastNameLink.addEventListener("click", function(e) {
    e.preventDefault();
    lastNameInput.value = lastNameDisplay.textContent;
    lastNameEdit.style.display = "flex";
    changeLastNameLink.style.display = "none";
  });

  confirmLastNameButton.addEventListener("click", async function () {
    const newLastName = lastNameInput.value.trim();
    if (!newLastName) return;

    try {
      const userRef = doc(db, "users", currentUsername);
      await setDoc(userRef, { lastName: newLastName }, { merge: true });

      lastNameDisplay.textContent = newLastName;
      lastNameEdit.style.display = "none";
      changeLastNameLink.style.display = "inline";
      alert("last name updated!");
    } catch (error) {
      console.error("Error updating last name:", error);
    }
  });

// === Email ===
  const changeEmailLink = document.getElementById("changeEmailLink");
  const emailInput = document.getElementById("emailInput");
  const confirmEmailButton = document.getElementById("confirmEmailButton");
  const emailEdit = document.querySelector(".email-edit");

  changeEmailLink.addEventListener("click", function(e) {
    e.preventDefault();
    emailInput.value = emailDisplay.textContent;
    emailEdit.style.display = "flex";
    changeEmailLink.style.display = "none";
  });

  confirmEmailButton.addEventListener("click", async function () {
    const newEmail = emailInput.value.trim();
    if (!newEmail || !newEmail.includes("@")) {
      alert("please enter a valid email.");
      return;
    }

    try {
      const userRef = doc(db, "users", currentUsername);
      await setDoc(userRef, { email: newEmail }, { merge: true });

      emailDisplay.textContent = newEmail;
      emailEdit.style.display = "none";
      changeEmailLink.style.display = "inline";
      alert("email updated!");
    } catch (error) {
      console.error("error updating email:", error);
    }
  });

});
