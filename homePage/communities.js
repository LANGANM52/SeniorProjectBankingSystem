import {initializeApp} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import {
    arrayRemove,
    arrayUnion,
    collection,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    limit,
    onSnapshot,
    orderBy,
    query,
    startAfter,
    updateDoc,
    where,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBkidFMwM_jHr5i4D55EEr_anJlrwrNvrI",
    authDomain: "plottwistsp.firebaseapp.com",
    projectId: "plottwistsp",
    storageBucket: "plottwistsp.firebasestorage.app",
    messagingSenderId: "605014060151",
    appId: "1:605014060151:web:3e307d34e57d908fa8ea72"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Get logged-in user
const loggedInUser = localStorage.getItem("loggedInUser");

// Global variables for pagination
let lastVisible = null;
let selectedGenres = [];
let currentSort = "popular";
let currentSearch = "";
let isLoading = false;
const communitiesPerPage = 12;

// Function to fetch user's genre preferences
async function getUserGenres(username) {
    if (!username) return [];

    try {
        const userGenresCollection = collection(db, "users", username, "genres");
        const genresSnapshot = await getDocs(userGenresCollection);

        if (genresSnapshot.empty) return [];

        return genresSnapshot.docs.map(doc => doc.data().name);
    } catch (error) {
        console.error("Error fetching user genres:", error);
        return [];
    }
}

// Calculate genre match score between user genres and community genres
function calculateGenreMatchScore(userGenres, communityGenres) {
    if (!userGenres.length || !communityGenres.length) return 0;

    // Count matching genres
    const matchingGenres = userGenres.filter(genre => communityGenres.includes(genre));
    return matchingGenres.length;
}

// Initialize the page
document.addEventListener("DOMContentLoaded", function () {
    // Set up event listeners
    document.getElementById("searchButton").addEventListener("click", handleSearch);
    document.getElementById("communitySearch").addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
            handleSearch();
        }
    });

    document.getElementById("sortBy").addEventListener("change", handleSortChange);

    document.querySelectorAll(".genre-pill").forEach(pill => {
        pill.addEventListener("click", handleGenreFilter);
    });

    document.getElementById("loadMoreButton").addEventListener("click", loadMoreCommunities);

    // Set default sort to "suggested"
    currentSort = "suggested";

    // Initial load of communities
    loadCommunities();

    // Load user's communities if logged in
    if (loggedInUser) {
        loadMyCommunities();
    } else {
        // Show message for not logged in users
        document.getElementById("myCommunities").innerHTML = "";
        document.getElementById("noMyCommunities").innerHTML = `
            <h3>You need to log in to see your communities</h3>
            <p>Log in to join communities and start discussions with other movie fans!</p>
            <a href="../login&create/index.html" class="create-btn" style="background-color: #ffcc00;">Login</a>
        `;
        document.getElementById("noMyCommunities").style.display = "block";
    }
});

// Handle search
function handleSearch() {
    currentSearch = document.getElementById("communitySearch").value.trim();
    lastVisible = null;
    loadCommunities(true);
}

// Handle sort change
function handleSortChange(event) {
    currentSort = event.target.value;
    lastVisible = null;
    loadCommunities(true);
}

// Handle genre filter
function handleGenreFilter(event) {
    const pill = event.target;
    const genre = pill.getAttribute("data-genre");

    // Special case for "All" button
    if (genre === "all") {
        // Clear all selections when "All" is clicked
        document.querySelectorAll(".genre-pill").forEach(p => {
            p.classList.remove("active");
        });
        pill.classList.add("active");
        selectedGenres = []; // Empty array means no specific genre filter (all genres)
        lastVisible = null;
        loadCommunities(true);
        return;
    }

    // Remove "All" selection if any other genre is selected
    const allPill = document.querySelector('.genre-pill[data-genre="all"]');
    allPill.classList.remove("active");

    // Toggle this genre selection
    if (pill.classList.contains("active")) {
        // If already active, remove from selection
        pill.classList.remove("active");
        selectedGenres = selectedGenres.filter(g => g !== genre);

        // If no genres are selected, activate "All" again
        if (selectedGenres.length === 0) {
            allPill.classList.add("active");
        }
    } else {
        // Add to selection
        pill.classList.add("active");
        selectedGenres.push(genre);
    }

    lastVisible = null;
    loadCommunities(true);
}

// Load communities
async function loadCommunities(isNewQuery = false) {
    if (isLoading) return;

    isLoading = true;

    try {
        // Show loading state
        if (isNewQuery) {
            document.getElementById("communitiesGrid").innerHTML = '<div class="loading">Loading communities...</div>';
            document.getElementById("noResults").style.display = "none";
        }

        // Build query
        let communitiesQuery;
        const communitiesRef = collection(db, "communities");

        // Apply sort
        let sortField, sortDirection;
        const isSuggestedSort = currentSort === "suggested";

        // For other sorts, use the standard approach
        switch (currentSort) {
            case "newest":
                sortField = "createdAt";
                sortDirection = "desc";
                break;
            case "alphabetical":
                sortField = "name";
                sortDirection = "asc";
                break;
            case "members":
                sortField = "memberCount";
                sortDirection = "desc";
                break;
            case "suggested":
                sortField = "memberCount";
                sortDirection = "desc";
                break;
            case "popular":
            default:
                sortField = "memberCount";
                sortDirection = "desc";
                break;
        }

        if (selectedGenres.length > 0) {
            // Using array-contains-any for multiple genre filtering
            communitiesQuery = query(
                communitiesRef,
                where("genres", "array-contains-any", selectedGenres),
                orderBy(sortField, sortDirection),
                limit(currentSearch ? 100 : communitiesPerPage) // Fetch more if searching
            );
        } else {
            communitiesQuery = query(
                communitiesRef,
                orderBy(sortField, sortDirection),
                limit(currentSearch ? 100 : communitiesPerPage) // Fetch more if searching
            );
        }

        // Apply pagination for "load more" if not searching
        if (lastVisible && !isNewQuery && !currentSearch) {
            if (selectedGenres.length > 0) {
                communitiesQuery = query(
                    communitiesRef,
                    where("genres", "array-contains-any", selectedGenres),
                    orderBy(sortField, sortDirection),
                    startAfter(lastVisible),
                    limit(communitiesPerPage)
                );
            } else {
                communitiesQuery = query(
                    communitiesRef,
                    orderBy(sortField, sortDirection),
                    startAfter(lastVisible),
                    limit(communitiesPerPage)
                );
            }
        }

        // Execute query
        const communitiesSnapshot = await getDocs(communitiesQuery);

        // Clear previous results if new query
        if (isNewQuery) {
            document.getElementById("communitiesGrid").innerHTML = "";
        }

        // Process and filter results
        const communitiesGrid = document.getElementById("communitiesGrid");
        let communitiesHTML = "";
        let filteredDocs = [];

        // Handle results and filtering
        if (selectedGenres.length > 1) {
            // The Firebase query with array-contains-any returns communities that match ANY of the selected genres
            communitiesSnapshot.docs.forEach(doc => {
                const communityData = doc.data();

                // Skip private communities if user is not a member
                if (communityData.isPrivate && (!loggedInUser || !communityData.members.includes(loggedInUser))) {
                    return;
                }

                // Check if the community has ALL the selected genres
                const hasAllSelectedGenres = selectedGenres.every(genre =>
                    communityData.genres.includes(genre)
                );

                if (hasAllSelectedGenres) {
                    filteredDocs.push(doc);
                }
            });
        } else {
            // Filter out private communities if user is not a member
            filteredDocs = communitiesSnapshot.docs.filter(doc => {
                const communityData = doc.data();
                // We no longer filter out private communities - show all communities
                return true;
            });
        }

        // Additional search term filtering if needed
        if (currentSearch) {
            const searchLower = currentSearch.toLowerCase();
            filteredDocs = filteredDocs.filter(doc => {
                const communityData = doc.data();
                const communityName = communityData.name.toLowerCase();
                return communityName.includes(searchLower);
            });

            // Only take the first 'communitiesPerPage' results for search
            filteredDocs = filteredDocs.slice(0, communitiesPerPage);
        }

        // If no results
        if (filteredDocs.length === 0) {
            if (isNewQuery) {
                document.getElementById("noResults").style.display = "block";
                document.getElementById("loadMoreButton").style.display = "none";
            } else {
                document.getElementById("loadMoreButton").style.display = "none";
            }
            isLoading = false;
            return;
        }

        // Update lastVisible for pagination (only if not searching)
        if (!currentSearch) {
            lastVisible = communitiesSnapshot.docs[communitiesSnapshot.docs.length - 1];
        } else {
            // Disable pagination when searching
            lastVisible = null;
        }

        // If we're using suggested sort and user is logged in, apply genre-based sorting
        if (currentSort === "suggested" && loggedInUser) {
            // Get user's genre preferences
            const userGenres = await getUserGenres(loggedInUser);

            if (userGenres.length > 0) {
                // Add genre match score to each community
                const enhancedDocs = filteredDocs.map(doc => {
                    const data = doc.data();
                    const genreMatchScore = calculateGenreMatchScore(userGenres, data.genres);
                    return {
                        doc: doc,
                        genreMatchScore: genreMatchScore,
                        memberCount: data.memberCount || 0
                    };
                });

                // Sort by genre match score (descending) and then by member count (descending)
                enhancedDocs.sort((a, b) => {
                    if (a.genreMatchScore !== b.genreMatchScore) {
                        return b.genreMatchScore - a.genreMatchScore; // Higher match score first
                    }
                    return b.memberCount - a.memberCount; // Then by member count
                });

                // Replace filtered docs with sorted docs
                filteredDocs = enhancedDocs.map(item => item.doc);
            }
        }

        // Process results for display
        filteredDocs.forEach(doc => {
            const communityData = doc.data();
            const communityId = doc.id;

            // Check if user is a member
            const isMember = loggedInUser && communityData.members && communityData.members.includes(loggedInUser);

            // Format genres with a maximum of 3 displayed
            const displayedGenres = communityData.genres.slice(0, 3).map(genre =>
                `<span class="genre-tag">${genre}</span>`
            ).join("");

            // Create community card
            communitiesHTML += `
            <div class="community-card">
                <div class="community-header">
                    <img src="${communityData.bannerImage || 'https://placehold.co/400x120/333/888?text=Banner'}" alt="Community banner" onerror="this.src='https://placehold.co/400x120/333/888?text=Banner'">
                    <div class="community-profile-pic">
                        <img src="${communityData.profilePicture || 'https://placehold.co/80x80/444/aaa?text=Profile'}" alt="${communityData.name}" onerror="this.src='https://placehold.co/80x80/444/aaa?text=Profile'">
                    </div>
                </div>
                <div class="community-body">
                    <h3 class="community-name">
                        ${communityData.name}
                        ${communityData.isPrivate ? '<span class="private-badge">Private</span>' : ''}
                    </h3>
                    <div class="community-meta">Created ${formatDate(communityData.createdAt)}</div>
                    <div class="community-genres">
                        ${displayedGenres}
                        ${communityData.genres.length > 3 ? `<span class="genre-tag">+${communityData.genres.length - 3}</span>` : ''}
                    </div>
                    <p class="community-description">${communityData.bio || 'No description available.'}</p>
                </div>
                <div class="community-footer">
                    <span class="members-count">${communityData.memberCount || 0} members</span>
                    <div class="actions">
                        ${(!communityData.isPrivate || isMember) ?
                                `<a href="../homePage/communityProfile.html?id=${communityId}" class="view-btn">View</a>` :
                                `<span class="private-community-badge"></span>`
            }
                        ${isMember ?
                                `<button class="join-btn joined" data-id="${communityId}">Leave</button>` :
                                (communityData.isPrivate ?
                                        `<button class="request-join-btn" data-id="${communityId}" data-name="${communityData.name}">Request to Join</button>` :
                                        `<button class="join-btn" data-id="${communityId}">Join</button>`
                                )
                            }
                    </div>
                </div>
            </div>
        `;
        });

        // Append new communities to grid
        communitiesGrid.innerHTML += communitiesHTML;

        // Show or hide "Load More" button
        document.getElementById("loadMoreButton").style.display =
            (currentSearch || communitiesSnapshot.size < communitiesPerPage) ? "none" : "block";

        // Add event listeners to join buttons
        document.querySelectorAll(".join-btn").forEach(button => {
            button.addEventListener("click", handleJoinCommunity);
        });

        document.querySelectorAll(".request-join-btn").forEach(button => {
            button.addEventListener("click", handleJoinRequest);
        });

        // Hide no results message
        document.getElementById("noResults").style.display = "none";

    } catch (error) {
        console.error("Error loading communities:", error);
        // Show error message
        if (isNewQuery) {
            document.getElementById("communitiesGrid").innerHTML = `
                <div class="loading error">
                    Error loading communities. Please try again.
                </div>
            `;
        }
    } finally {
        isLoading = false;
    }
}

// Load more communities
function loadMoreCommunities() {
    loadCommunities(false);
}

// Load user's communities
async function loadMyCommunities() {
    try {
        // Query for communities where user is a member
        const myCommunityQuery = query(
            collection(db, "communities"),
            where("members", "array-contains", loggedInUser),
            orderBy("name"),
            limit(6)
        );

        const communitiesSnapshot = await getDocs(myCommunityQuery);

        const myCommunitiesGrid = document.getElementById("myCommunities");

        // Check if user has no communities
        if (communitiesSnapshot.empty) {
            myCommunitiesGrid.innerHTML = "";
            document.getElementById("noMyCommunities").style.display = "block";
            return;
        }

        // Process and display user's communities
        let communitiesHTML = "";

        communitiesSnapshot.forEach(doc => {
            const communityData = doc.data();
            const communityId = doc.id;

            // Format genres with a maximum of 3 displayed
            const displayedGenres = communityData.genres.slice(0, 3).map(genre =>
                `<span class="genre-tag">${genre}</span>`
            ).join("");

            // Create community card
            communitiesHTML += `
                <div class="community-card">
                    <div class="community-header">
                        <img src="${communityData.bannerImage || 'https://placehold.co/400x120/333/888?text=Banner'}" alt="Community banner" onerror="this.src='https://placehold.co/400x120/333/888?text=Banner'">
                        <div class="community-profile-pic">
                            <img src="${communityData.profilePicture || 'https://placehold.co/80x80/444/aaa?text=Profile'}" alt="${communityData.name}" onerror="this.src='https://placehold.co/80x80/444/aaa?text=Profile'">
                        </div>
                    </div>
                    <div class="community-body">
                        <h3 class="community-name">${communityData.name}</h3>
                        <div class="community-meta">Created ${formatDate(communityData.createdAt)}</div>
                        <div class="community-genres">
                            ${displayedGenres}
                            ${communityData.genres.length > 3 ? `<span class="genre-tag">+${communityData.genres.length - 3}</span>` : ''}
                        </div>
                        <p class="community-description">${communityData.bio || 'No description available.'}</p>
                    </div>
                    <div class="community-footer">
                        <span class="members-count">${communityData.memberCount || 0} members</span>
                        <a href="../homePage/communityProfile.html?id=${communityId}" class="view-btn">View</a>
                    </div>
                </div>
            `;
        });

        // Display user's communities
        myCommunitiesGrid.innerHTML = communitiesHTML;
        document.getElementById("noMyCommunities").style.display = "none";

    } catch (error) {
        console.error("Error loading user communities:", error);
        document.getElementById("myCommunities").innerHTML = `
            <div class="loading error">
                Error loading your communities. Please try again.
            </div>
        `;
    }
}

// Handle joining/leaving a community
async function handleJoinCommunity(event) {
    if (!loggedInUser) {
        alert("You need to be logged in to join communities");
        return;
    }

    const button = event.currentTarget;
    const communityId = button.getAttribute("data-id");
    const isJoined = button.classList.contains("joined");

    try {
        const communityRef = doc(db, "communities", communityId);
        const communitySnap = await getDoc(communityRef);

        if (!communitySnap.exists()) {
            alert("Community not found");
            return;
        }

        const communityData = communitySnap.data();

        if (isJoined) {
            // Don't allow creator to leave
            if (communityData.createdBy === loggedInUser) {
                alert("As the creator, you cannot leave this community");
                return;
            }

            // Leave community
            await updateDoc(communityRef, {
                members: arrayRemove(loggedInUser),
                memberCount: (communityData.memberCount || 1) - 1
            });

            button.textContent = "Join";
            button.classList.remove("joined");

        } else {
            // Join community
            await updateDoc(communityRef, {
                members: arrayUnion(loggedInUser),
                memberCount: (communityData.memberCount || 0) + 1
            });

            button.textContent = "Leave";
            button.classList.add("joined");
        }

        // Refresh my communities section
        loadMyCommunities();

    } catch (error) {
        console.error("Error joining/leaving community:", error);
        alert("Error processing your request");
    }
}

async function handleJoinRequest(event) {
    if (!loggedInUser) {
        alert("You need to be logged in to request to join communities");
        return;
    }

    const button = event.currentTarget;
    const communityId = button.getAttribute("data-id");
    const communityName = button.getAttribute("data-name");

    // Check if user already has a pending request
    try {
        const joinRequestsRef = collection(db, "joinRequests");
        const requestQuery = query(
            joinRequestsRef,
            where("userId", "==", loggedInUser),
            where("communityId", "==", communityId),
            where("status", "==", "pending")
        );
        const requestSnap = await getDocs(requestQuery);

        if (!requestSnap.empty) {
            alert("You already have a pending request to join this community");
            return;
        }

        // Get community creator information
        const communityRef = doc(db, "communities", communityId);
        const communitySnap = await getDoc(communityRef);

        if (!communitySnap.exists()) {
            alert("Community not found");
            return;
        }

        const communityData = communitySnap.data();
        const creatorId = communityData.createdBy;

        // Create join request
        const joinRequestRef = collection(db, "joinRequests");
        await addDoc(joinRequestRef, {
            userId: loggedInUser,
            communityId: communityId,
            communityName: communityName,
            creatorId: creatorId,
            status: "pending",
            timestamp: serverTimestamp()
        });

        // Send notification to community creator
        const notificationRef = collection(db, "users", creatorId, "notifications");
        await addDoc(notificationRef, {
            type: "joinRequest",
            message: `${loggedInUser} has requested to join your community "${communityName}"`,
            requesterId: loggedInUser,
            communityId: communityId,
            createdAt: serverTimestamp(),
            read: false
        });

        // Update button status
        button.textContent = "Request Pending";
        button.classList.add("pending");
        button.disabled = true;

        alert("Join request sent. You'll be notified when the community owner responds.");

    } catch (error) {
        console.error("Error requesting to join community:", error);
        alert("Error sending join request");
    }
}

// Helper function to format date
function formatDate(dateString) {
    if (!dateString) return "recently";

    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (isNaN(diffDays)) return "recently";

    if (diffDays === 0) {
        return "today";
    } else if (diffDays === 1) {
        return "yesterday";
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    } else {
        return date.toLocaleDateString();
    }

}
document.addEventListener("DOMContentLoaded", function () {
    const notificationBell = document.getElementById("notificationBell");
    const currentUser = localStorage.getItem("loggedInUser");
    if (!currentUser) return;

    let latestNotifications = [];
    const notifQ = query(
        collection(db, "users", currentUser, "notifications"),
        orderBy("createdAt", "desc")
    );
    onSnapshot(notifQ, snapshot => {
        latestNotifications = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        updateBellBadge(latestNotifications.filter(n => !n.read).length);
        if (document.getElementById("notificationBox")?.style.display !== "none") {
            renderNotifications();
        }
    });

    if (notificationBell) {
        notificationBell.addEventListener("click", async function (event) {
            event.stopPropagation();

            const bellRect = notificationBell.getBoundingClientRect();
            let notificationBox = document.getElementById("notificationBox");

            if (!notificationBox) {
                notificationBox = document.createElement("div");
                notificationBox.id = "notificationBox";
                notificationBox.className = "notification-box";
                notificationBox.innerHTML = `
                    <div class="notification-box-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #444;">
                        <span style="font-size: 18px; color: white;">Notifications</span>
                        <i class='bx bx-cog' id="notificationSettings" style="font-size: 18px; cursor: pointer; color: white;"></i>
                    </div>
                    <div class="notification-box-content" style="padding: 10px; color: white;">
                        <p>No new notifications.</p>
                    </div>
                `;
                notificationBox.style.position = "fixed";  // ← FIXED instead of absolute
                notificationBox.style.top = bellRect.bottom + "px";
                notificationBox.style.right = (window.innerWidth - bellRect.right) + "px";
                notificationBox.style.backgroundColor = "#000";
                notificationBox.style.width = "300px";
                notificationBox.style.border = "1px solid #444";
                notificationBox.style.borderRadius = "5px";
                notificationBox.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
                notificationBox.style.zIndex = 100;
                document.body.appendChild(notificationBox);

                const notificationSettings = notificationBox.querySelector("#notificationSettings");
                if (notificationSettings) {
                    notificationSettings.addEventListener("click", function (event) {
                        event.stopPropagation();
                        window.location.href = "userNotificationSettings.html";
                    });
                }

                renderNotifications();
                updateBellBadge(0);
                const unread1 = latestNotifications.filter(n => !n.read);
                await Promise.all(unread1.map(n =>
                    updateDoc(doc(db, "users", currentUser, "notifications", n.id), { read: true })
                ));
            } else {
                if (notificationBox.style.display === "none" || notificationBox.style.display === "") {
                    const newBellRect = notificationBell.getBoundingClientRect();
                    notificationBox.style.top = newBellRect.bottom + "px";
                    notificationBox.style.right = (window.innerWidth - newBellRect.right) + "px";
                    notificationBox.style.display = "block";

                    renderNotifications();
                    updateBellBadge(0);
                    const unread2 = latestNotifications.filter(n => !n.read);
                    await Promise.all(unread2.map(n =>
                        updateDoc(doc(db, "users", currentUser, "notifications", n.id), { read: true })
                    ));
                } else {
                    notificationBox.style.display = "none";
                }
            }
        });
    }

    function timeAgo(date) {
        const now = Date.now();
        const diffMs = now - date.getTime();
        const sec = Math.floor(diffMs / 1000);
        if (sec < 60) return `${sec}s ago`;
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min}m ago`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr}h ago`;
        const days = Math.floor(hr / 24);
        return `${days}d ago`;
    }

    function renderNotifications() {
        const content = document.querySelector(".notification-box-content");
        if (!content) return;

        if (latestNotifications.length === 0) {
            content.innerHTML = `<p>No new notifications.</p>`;
        } else {
            content.innerHTML = latestNotifications
                .map(n => {
                    const dateObj = n.createdAt?.toDate?.() || new Date();
                    const ago = timeAgo(dateObj);
                    return `
                      <div class="notification-item" style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1px solid #444;
                        padding: 8px 0;
                        margin: 4px 0;
                      ">
                        <span>${n.message}</span>
                        <span style="
                          font-size: 12px;
                          color: #888;
                          margin-left: 8px;
                          white-space: nowrap;
                        ">${ago}</span>
                      </div>
                    `;
                })
                .join("");
        }
    }

    function updateBellBadge(count) {
        let badge = document.getElementById("notif-badge");

        if (count > 0) {
            notificationBell.style.position = 'relative';

            if (!badge) {
                badge = document.createElement("span");
                badge.id = "notif-badge";
                badge.className = "notification-badge";

                Object.assign(badge.style, {
                    position: 'absolute',
                    top: '0',
                    right: '0',
                    transform: 'translate(50%, -50%)',
                    backgroundColor: 'red',
                    color: 'white',
                    borderRadius: '50%',
                    padding: '2px 6px',
                    fontSize: '16px',
                    lineHeight: '1',
                    textAlign: 'center',
                    minWidth: '6px',
                });

                notificationBell.appendChild(badge);
            }
            badge.textContent = count;
        } else if (badge) {
            badge.remove();
        }
    }
    document.addEventListener("click", function (e) {
        if (e.target.classList.contains("sign-out")) {
            e.preventDefault();
            localStorage.clear();
            window.location.replace("/login&create/index.html");
        }
    });
});
