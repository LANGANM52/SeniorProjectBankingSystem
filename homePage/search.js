const API_KEY = "bc7c4e7c62d9e223e196bbd15978fc51";
const searchInput = document.getElementById("searchInput");
const suggestionsDiv = document.getElementById("suggestions");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {getFirestore, collection, query, getDocs, where} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

searchInput.addEventListener("input", async () => {
    const queryText = searchInput.value.trim();
    if (queryText.length < 2) {
        suggestionsDiv.style.display = "none";
        return;
    }

    const [movies, actors, users] = await Promise.all([
        fetchMovies(queryText),
        fetchActors(queryText),
        fetchUsers(queryText)
    ]);

    displaySuggestions(movies, actors, users);
});

async function fetchMovies(query) {
    const response = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}`
    );
    const data = await response.json();
    return data.results;
}

async function fetchActors(query) {
    const response = await fetch(
        `https://api.themoviedb.org/3/search/person?api_key=${API_KEY}&query=${encodeURIComponent(query)}`
    );
    const data = await response.json();
    return data.results.filter(person => person.known_for_department === "Acting");
}

async function fetchUsers(queryText) {
    const usersRef = collection(db, "users");
    const q = query(usersRef,
        where("username", ">=", queryText),
        where("username", "<=", queryText + "\uf8ff")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function displaySuggestions(movies, actors, users) {
    suggestionsDiv.innerHTML = "";

    if (movies.length === 0 && actors.length === 0 && users.length === 0) {
        suggestionsDiv.style.display = "none";
        return;
    }

    movies.forEach(movie => {
        const suggestion = document.createElement("div");
        suggestion.classList.add("suggestion");
        suggestion.textContent = `${movie.title} (${movie.release_date ? movie.release_date.split("-")[0] : "Unknown"})`;
        suggestion.addEventListener("click", () => selectMovie(movie));
        suggestionsDiv.appendChild(suggestion);
    });

    actors.forEach(actor => {
        const suggestion = document.createElement("div");
        suggestion.classList.add("suggestion");
        suggestion.textContent = `${actor.name}`;
        suggestion.addEventListener("click", () => selectActor(actor));
        suggestionsDiv.appendChild(suggestion);
    });

    users.forEach(user => {
        const suggestion = document.createElement("div");
        suggestion.classList.add("suggestion");
        suggestion.innerHTML = `<i class='bx bxs-user'></i> ${user.username}`;
        suggestion.addEventListener("click", () => selectUser(user));
        suggestionsDiv.appendChild(suggestion);
    });

    suggestionsDiv.style.display = "block";
}

function selectMovie(movie) {
    localStorage.setItem("selectedMovie", JSON.stringify(movie));
    clearSearch();
    window.location.href = "moviePage.html";
}

function selectActor(actor) {
    localStorage.setItem("selectedActor", JSON.stringify(actor));
    clearSearch();
    window.location.href = "actorPage.html";
}

function selectUser(user) {
    clearSearch();
    window.location.href = `OtherProfilePage.html?user=${encodeURIComponent(user.id)}`;
}

function clearSearch() {
    searchInput.value = "";
    suggestionsDiv.style.display = "none";
}
