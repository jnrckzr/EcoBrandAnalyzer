document.addEventListener('DOMContentLoaded', () => {
    const emailSelect = document.getElementById('email-select');
    const sendAllUsersCheckbox = document.getElementById('send-all-users-checkbox');
    const sendNotificationBtn = document.getElementById('send-notification-btn');
    const notificationTitle = document.getElementById('notification-title');
    const notificationMessage = document.getElementById('notification-message');
    const clearBtn = document.getElementById('clear-btn');
    const historyList = document.getElementById('history-list');
    const paginationControls = document.getElementById('pagination-controls');
    let currentPage = 1;
    const itemsPerPage = 3; // You can adjust this value

    // Function to fetch and populate user emails
    const fetchUserEmails = async () => {
        try {
            const response = await fetch('/api/admin/get-users');
            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('Forbidden: Admin access required.');
                }
                throw new Error('Failed to fetch user emails.');
            }
            const data = await response.json();

            emailSelect.innerHTML = '';
            
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Select Emails';
            defaultOption.disabled = true;
            defaultOption.selected = true;
            emailSelect.appendChild(defaultOption);

            data.emails.forEach(email => {
                const option = document.createElement('option');
                option.value = email;
                option.textContent = email;
                emailSelect.appendChild(option);
            });

        } catch (error) {
            console.error('Error:', error);
            alert(error.message);
        }
    };

    // Function to render a single notification item
    const createNotificationItem = (notification) => {
        const item = document.createElement('div');
        item.classList.add('history-item');
        item.innerHTML = `
            <div class="history-content">
                <i class="fa fa-bell-o history-icon"></i>
                <div class="history-text">
                    <h4>${notification.title}</h4>
                    <p class="history-message">${notification.message}</p>
                </div>
                <div class="history-meta">
                    <span class="history-date">
                        <i class="fa fa-calendar"></i>
                        ${notification.sent_at}
                    </span>
                    <span class="history-email">
                        <i class="fa fa-user"></i>
                        ${JSON.parse(notification.recipient_emails).join(', ')}
                    </span>
                </div>
            </div>
        `;
        return item;
    };

    // Function to fetch and display paginated notification history
    const fetchNotificationHistory = async (page) => {
        try {
            const response = await fetch(`/api/admin/notification-history?page=${page}&limit=${itemsPerPage}`);
            if (!response.ok) {
                throw new Error('Failed to fetch notification history.');
            }
            const data = await response.json();

            historyList.innerHTML = '';
            
            if (data.notifications.length > 0) {
                data.notifications.forEach(notification => {
                    historyList.appendChild(createNotificationItem(notification));
                });
            } else {
                historyList.innerHTML = '<p class="no-history-message">No notification history found.</p>';
            }

            renderPagination(data.totalPages, data.currentPage);
            
        } catch (error) {
            console.error('Error fetching notification history:', error);
            alert('Failed to load notification history.');
        }
    };

    // Function to render pagination buttons
    const renderPagination = (totalPages, currentPage) => {
        paginationControls.innerHTML = '';

        if (currentPage > 1) {
            const prevLink = document.createElement('a');
            prevLink.href = '#';
            prevLink.classList.add('page-link');
            prevLink.textContent = '<';
            prevLink.addEventListener('click', (e) => {
                e.preventDefault();
                currentPage--;
                fetchNotificationHistory(currentPage);
            });
            paginationControls.appendChild(prevLink);
        }

        for (let i = 1; i <= totalPages; i++) {
            const pageLink = document.createElement('a');
            pageLink.href = '#';
            pageLink.classList.add('page-link');
            if (i === currentPage) {
                pageLink.classList.add('active');
            }
            pageLink.textContent = i;
            pageLink.addEventListener('click', (e) => {
                e.preventDefault();
                currentPage = i;
                fetchNotificationHistory(currentPage);
            });
            paginationControls.appendChild(pageLink);
        }

        if (currentPage < totalPages) {
            const nextLink = document.createElement('a');
            nextLink.href = '#';
            nextLink.classList.add('page-link');
            nextLink.textContent = '>';
            nextLink.addEventListener('click', (e) => {
                e.preventDefault();
                currentPage++;
                fetchNotificationHistory(currentPage);
            });
            paginationControls.appendChild(nextLink);
        }
    };

    // Event listener for the "Send to all users" checkbox
    sendAllUsersCheckbox.addEventListener('change', () => {
        emailSelect.disabled = sendAllUsersCheckbox.checked;
    });

    // Event listener for the "Send Notification" button
    sendNotificationBtn.addEventListener('click', async () => {
        const title = notificationTitle.value.trim();
        const message = notificationMessage.value.trim();
        
        let emails;
        if (sendAllUsersCheckbox.checked) {
            emails = Array.from(emailSelect.options)
                          .filter((option, index) => index > 0)
                          .map(option => option.value);
        } else {
            emails = Array.from(emailSelect.selectedOptions).map(option => option.value);
        }

        if (emails.length === 0 || title === '' || message === '') {
            alert('Please select at least one recipient and fill in the title and message.');
            return;
        }

        try {
            const response = await fetch('/api/admin/send-notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ emails, title, message })
            });

            const data = await response.json();

            if (data.success) {
                alert('Notification sent successfully!');
                notificationTitle.value = '';
                notificationMessage.value = '';
                emailSelect.selectedIndex = 0;
                sendAllUsersCheckbox.checked = false;
                emailSelect.disabled = false;
                
                // Refresh history after a successful send
                fetchNotificationHistory(1);
            } else {
                alert(`Error: ${data.message}`);
            }
        } catch (error) {
            console.error('Error sending notification:', error);
            alert('An unexpected error occurred. Please try again.');
        }
    });

    // Event listener for the "Clear" button
    clearBtn.addEventListener('click', () => {
        notificationTitle.value = '';
        notificationMessage.value = '';
        emailSelect.selectedIndex = 0;
        sendAllUsersCheckbox.checked = false;
        emailSelect.disabled = false;
    });

    // Initial load of the data when the page loads
    fetchUserEmails();
    fetchNotificationHistory(currentPage);
});