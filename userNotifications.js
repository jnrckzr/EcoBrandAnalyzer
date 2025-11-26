// userNotifications.js - Final Version (Verified: NO Mock Data)
document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const notificationButton = document.getElementById('notification-button');
    const notificationsPanel = document.getElementById('notifications-panel');
    const updatesNewsList = document.getElementById('updates-news-list');
    const noNotificationsMessage = document.getElementById('no-notifications-message');
    const ecoScoreAlertDiv = document.getElementById("eco-score-alert");
    
    if (!notificationButton) return; 

    // **CRITICAL FIX:** Tiyakin na naka-hide ang panel sa simula (in case walang CSS)
    if (notificationsPanel) notificationsPanel.style.display = 'none';

    // --- Helper: Update Notification Badge (Red Dot Only) ---
    const updateBadge = (hasNew) => {
        let badge = notificationButton.querySelector('.notification-count');
        
        if (hasNew) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'notification-count';
                notificationButton.appendChild(badge);
            }
            badge.textContent = ''; 
            badge.style.display = 'flex'; 
        } else {
            if (badge) badge.style.display = 'none';
        }
    };
    
    // --- Core Notification Fetch & Render Logic (API Only) ---
    const fetchAndRenderNotifications = async () => {
        if (!notificationsPanel) {
            console.error("Notification panel element not found. Cannot render content.");
            return;
        }
        
        // Clear previous state
        if (updatesNewsList) updatesNewsList.innerHTML = '';
        if (ecoScoreAlertDiv) ecoScoreAlertDiv.innerHTML = '';
        if (noNotificationsMessage) noNotificationsMessage.style.display = 'none';

        let totalCount = 0;

        try {
            // Iisang API call para kumuha ng lahat ng data
            const response = await fetch('/api/notifications'); 
            
            if (!response.ok) throw new Error(`API returned status ${response.status}`);
            
            const data = await response.json();
            // Data ay direktang kinuha mula sa API response (walang local mock data)
            const notifications = data.success && Array.isArray(data.notifications) ? data.notifications : [];
            const ecoAlert = data.success && data.ecoAlert ? data.ecoAlert : null;

            // 1. Render Eco Alert
            if (ecoAlert && ecoScoreAlertDiv) {
                const d = document.createElement("div");
                // Gumagamit ng alertClass mula sa API
                d.className = `eco-alert ${ecoAlert.alertClass || 'major-alert'}`; 
                d.textContent = ecoAlert.message || 'Eco-Score update available.';
                ecoScoreAlertDiv.appendChild(d);
                totalCount += 1;
            }

            // 2. Render listahan ng notifications
            if (notifications.length > 0) {
                notifications.forEach(notification => {
                    const notificationItem = document.createElement('div');
                    notificationItem.className = 'notification-item'; 
                    // Gumagamit ng title, message, at timestamp mula sa API
                    notificationItem.innerHTML = `
                        <div style="font-weight:700">${notification.title || 'Update'}</div>
                        <div style="font-size:13px; color:#ccc">${notification.message || 'No message.'}</div>
                        <div style="font-size:12px; color:#888">${notification.timestamp || new Date().toLocaleTimeString()}</div>
                    `;
                    if (updatesNewsList) updatesNewsList.appendChild(notificationItem);
                });
                totalCount += notifications.length;
            }
            
            // 3. Ipakita ang "No notifications" message
            if (totalCount === 0 && noNotificationsMessage) {
                noNotificationsMessage.style.display = 'block';
            }
            
            updateBadge(totalCount > 0);

        } catch (error) {
            console.error('Error fetching notifications:', error.message);
            updateBadge(false);
            if (noNotificationsMessage) {
                noNotificationsMessage.textContent = 'Failed to load notifications.';
                noNotificationsMessage.style.display = 'block';
            }
        }
    };
    
    // --- Initial Check & Polling Logic (API Only) ---
    const initialBadgeCheck = async () => {
        try {
            const response = await fetch('/api/notifications');
            if (!response.ok) return updateBadge(false);

            const data = await response.json();
            const notifications = data.success && Array.isArray(data.notifications) ? data.notifications : [];
            const ecoAlert = data.success && data.ecoAlert ? data.ecoAlert : null;
            
            const hasNew = notifications.length > 0 || ecoAlert;
            updateBadge(hasNew);
        } catch (e) {
            console.warn("Initial badge check failed.");
            updateBadge(false);
        }
    }
    
    // --- Event Handlers & Initialization ---

    if (notificationsPanel) {
        // Toggle Panel gamit ang class at style.display
        notificationButton.addEventListener('click', (event) => {
            event.stopPropagation();
            
            const isOpen = notificationsPanel.classList.contains('is-open');
            
            if (!isOpen) {
                notificationsPanel.style.display = 'block'; // Ensure it's visible before fetching
                notificationsPanel.classList.add('is-open'); 
                fetchAndRenderNotifications(); 
            } else {
                notificationsPanel.style.display = 'none'; 
                notificationsPanel.classList.remove('is-open');
            }
        });

        // Close Panel sa labas na click
        document.addEventListener('click', (event) => {
            if (notificationsPanel.classList.contains('is-open') && 
                !notificationsPanel.contains(event.target) && 
                !notificationButton.contains(event.target)) {
                
                notificationsPanel.style.display = 'none'; 
                notificationsPanel.classList.remove('is-open');
            }
        });
    }

    initialBadgeCheck();
    setInterval(initialBadgeCheck, 30000); 
});