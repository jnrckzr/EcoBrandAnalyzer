// --- HELPER FUNCTION: Convert timestamp to "time ago" string ---
const timeAgo = (dateString) => {
    if (!dateString) return "Never Active";

    const now = new Date();
    const past = new Date(dateString); 
    
    // Check for invalid date
    if (isNaN(past)) return "Date Error";

    const seconds = Math.floor((now - past) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval + (interval === 1 ? " year ago" : " years ago");
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + (interval === 1 ? " month ago" : " months ago");
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + (interval === 1 ? " day ago" : " days ago");
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + (interval === 1 ? " hour ago" : " hours ago");
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + (interval === 1 ? " minute ago" : " minutes ago");
    
    // If less than 60 seconds
    return "just now";
};
// --- END HELPER FUNCTION ---

// --- HELPER FUNCTION: Deterministic Avatar Color based on email ---
const getAvatarColor = (email) => {
    const colors = ["avatar-red", "avatar-blue", "avatar-green"];
    let hash = 0;
    if (email.length === 0) return colors[0]; 

    for (let i = 0; i < email.length; i++) {
        hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % colors.length);
    return colors[index];
}
// --- END HELPER FUNCTION ---


// --- CODE: ACTIVITY TRACKING HEARTBEAT ---
const ACTIVITY_API_URL = '/api/update-activity';
const HEARTBEAT_INTERVAL = 180000; // 3 minutes

const updateUserActivity = async (userId) => {
    if (!userId) {
        console.warn("No logged-in user ID found. Cannot send activity heartbeat.");
        return;
    }
    try {
        const response = await fetch(ACTIVITY_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ user_id: userId })
        });
        if (!response.ok) {
            console.error('Failed to update activity on server.');
        } else {
            console.log('Activity updated successfully.');
        }
    } catch (error) {
        console.error('Error sending activity heartbeat:', error);
    }
};
// --- END CODE: ACTIVITY TRACKING HEARTBEAT ---


document.addEventListener('DOMContentLoaded', async () => {
    let currentPage = 1;
    let entriesPerPage = 5;
    let users = [];
    let filteredUsers = [];
    let loggedInUserId = localStorage.getItem('loggedInUserId'); // Get ID from localStorage
    let activityInterval = null;

    const userTableBody = document.getElementById('user-table-body');
    const entriesSelect = document.getElementById('entries-select');
    const searchInput = document.getElementById('user-search');
    const statsText = document.getElementById('stats-text');
    const paginationContainer = document.getElementById('pagination-controls');
    const pageNumbersContainer = document.getElementById('page-numbers');
    
    const API_URL = '/api/users'; 

    const fetchUsers = async () => {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch users');
            }
            const responseData = await response.json();
            
            if (!responseData.success) {
                throw new Error(responseData.message || 'Failed to fetch users.');
            }

            const userData = responseData.users;
            
            users = userData.map(user => {
                const fullName = user.Fullname || "Unknown";
                const initials = fullName.split(' ').map(n => n[0]).join('') || 'UN';
                const email = user.Emailadd || "Not set";
                
                return {
                    id: user.user_id,
                    name: fullName,
                    email: email,
                    mobile: user.Mobile || "Not set",
                    description: user.Bio || "Not set",
                    location: user.Location || "Not set",
                    avatar: initials,
                    avatarColor: getAvatarColor(email), 
                    last_active_at: user.last_active_at,
                    // Assuming 'ProfilePic' is the field name from the API
                    profilePic: user.ProfilePic 
                };
            });
            
            filteredUsers = users;
            currentPage = 1;
            renderUsers(filteredUsers);

        } catch (error) {
            console.error("Error fetching users:", error);
            userTableBody.innerHTML = `<tr><td colspan="7" class="no-data">Error loading users. Please check your server connection.</td></tr>`;
            if(statsText) statsText.textContent = '';
        }
    };
    
    // Start the activity heartbeat for the logged-in user
    const startHeartbeat = () => {
        if (activityInterval) {
            clearInterval(activityInterval); 
        }
        if (loggedInUserId) {
            console.log(`Starting heartbeat for user ID: ${loggedInUserId}`);
            updateUserActivity(loggedInUserId);
            activityInterval = setInterval(() => {
                updateUserActivity(loggedInUserId);
                fetchUsers(); // Refresh the list every 3 minutes
            }, HEARTBEAT_INTERVAL);
        } else {
            console.log("No logged-in user ID found. Heartbeat will not start.");
        }
    };

    const renderPaginationControls = () => {
        const totalPages = Math.ceil(filteredUsers.length / entriesPerPage);
        pageNumbersContainer.innerHTML = '';
        
        let startPage = Math.max(1, currentPage - 1);
        let endPage = Math.min(totalPages, currentPage + 1);

        if (currentPage === 1) {
            endPage = Math.min(totalPages, 3);
        }
        if (currentPage === totalPages) {
            startPage = Math.max(1, totalPages - 2);
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = 'pagination-page-btn';
            if (i === currentPage) {
                pageButton.classList.add('active');
            }
            pageButton.textContent = i;
            pageButton.addEventListener('click', () => {
                currentPage = i;
                renderUsers(filteredUsers);
            });
            pageNumbersContainer.appendChild(pageButton);
        }

        document.getElementById('prev-page').disabled = currentPage === 1;
        document.getElementById('first-page').disabled = currentPage === 1;
        document.getElementById('next-page').disabled = currentPage === totalPages || filteredUsers.length === 0;
        document.getElementById('last-page').disabled = currentPage === totalPages || filteredUsers.length === 0;
    };
    
    const updateStatsText = () => {
        const start = (currentPage - 1) * entriesPerPage + 1;
        const end = Math.min(start + entriesPerPage - 1, filteredUsers.length);
        if(statsText) statsText.textContent = `Showing ${start} to ${end} of ${filteredUsers.length} entries`;
    };

    const renderUsers = (userArray) => {
        userTableBody.innerHTML = ''; 
        const start = (currentPage - 1) * entriesPerPage;
        const end = start + entriesPerPage;
        const paginatedUsers = userArray.slice(start, end);

        if (paginatedUsers.length === 0) {
            userTableBody.innerHTML = `<tr><td colspan="7" class="no-data">No users found.</td></tr>`;
        }

        paginatedUsers.forEach(user => {
            const row = document.createElement('tr');
            
            let displayStatusText;
            let statusClass;
            
            const now = new Date();
            const lastActive = new Date(user.last_active_at);
            // Check if last_active_at is a valid date
            const diffInMinutes = isNaN(lastActive.getTime()) ? Infinity : Math.abs(now - lastActive) / (1000 * 60);

            if (diffInMinutes <= 5) {
                displayStatusText = 'Active now';
                statusClass = 'status-active';
            } else {
                displayStatusText = `${timeAgo(user.last_active_at)}`;
                statusClass = 'status-offline'; 
            }
            
            // Logic to display profile picture or avatar initials
            const hasProfilePic = user.profilePic && user.profilePic !== 'null' && user.profilePic.trim() !== '';

            const avatarHtml = hasProfilePic
                ? `<img src="${user.profilePic}" alt="${user.name[0]}" class="profile-avatar" style="object-fit: cover;">` 
                : `<span class="profile-avatar ${user.avatarColor}">${user.avatar}</span>`; 

            row.innerHTML = `
                <td>${user.id}</td>
                <td>
                    <div class="user-profile">
                        ${avatarHtml}
                        <div class="profile-info">
                            <div class="user-name">${user.name}</div>
                            <div class="user-email">${user.email}</div>
                        </div>
                    </div>
                </td>
                <td>${user.mobile}</td>
                <td>${user.description}</td>
                <td>${user.location}</td>
                <td class="status-cell ${statusClass}">${displayStatusText}</td>
                <td><button class="delete-btn" data-id="${user.id}">Delete</button></td>
            `;
            userTableBody.appendChild(row);
        });

        renderPaginationControls();
        updateStatsText();
    };

    const handleDelete = async (event) => {
        if (event.target.classList.contains('delete-btn')) {
            const userId = event.target.dataset.id;
            
            const confirmation = prompt('Type "DELETE" to confirm deletion of this user.');
            if (confirmation && confirmation.toUpperCase() === 'DELETE') {
                try {
                    const response = await fetch(`${API_URL}/${userId}`, {
                        method: 'DELETE',
                    });

                    if (response.ok) {
                        const responseData = await response.json();
                        if (responseData.success) {
                            console.log(`User ${userId} successfully deleted from the server.`);
                            fetchUsers();
                        } else {
                            throw new Error(responseData.message || 'Failed to delete user on the server.');
                        }
                    } else {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Failed to delete user on the server.');
                    }
                } catch (error) {
                    console.error("Error deleting user: ", error);
                }
            } else if (confirmation !== null) {
                console.log("User deletion cancelled.");
            }
        }
    };
    
    fetchUsers();
    startHeartbeat();

    entriesSelect.addEventListener('change', (event) => {
        entriesPerPage = parseInt(event.target.value, 10);
        currentPage = 1;
        renderUsers(filteredUsers);
    });

    searchInput.addEventListener('input', (event) => {
        const searchTerm = event.target.value.toLowerCase();
        filteredUsers = users.filter(user => 
            (user.name && user.name.toLowerCase().includes(searchTerm)) ||
            (user.email && user.email.toLowerCase().includes(searchTerm)) ||
            (user.mobile && user.mobile.toLowerCase().includes(searchTerm)) ||
            (user.description && user.description.toLowerCase().includes(searchTerm)) ||
            (user.location && user.location.toLowerCase().includes(searchTerm))
        );
        currentPage = 1;
        renderUsers(filteredUsers);
    });

    if (paginationContainer) {
        paginationContainer.addEventListener('click', (event) => {
            if (event.target.id === 'next-page') {
                currentPage = Math.min(currentPage + 1, Math.ceil(filteredUsers.length / entriesPerPage));
                renderUsers(filteredUsers);
            } else if (event.target.id === 'prev-page') {
                currentPage = Math.max(1, currentPage - 1);
                renderUsers(filteredUsers);
            } else if (event.target.id === 'first-page') {
                currentPage = 1;
                renderUsers(filteredUsers);
            } else if (event.target.id === 'last-page') {
                currentPage = Math.ceil(filteredUsers.length / entriesPerPage);
                renderUsers(filteredUsers);
            }
        });
    }
    
    userTableBody.addEventListener('click', handleDelete);
});