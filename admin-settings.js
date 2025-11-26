document.addEventListener('DOMContentLoaded', () => {
    // Kunin ang mga element mula sa HTML
    const saveChangesBtn = document.getElementById('saveChanges');
    const deleteAccountBtn = document.getElementById('Delete');
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');

    // ------------------------------------------
    //  Event Listener para sa 'Save Changes' Button
    // ------------------------------------------
    saveChangesBtn.addEventListener('click', async () => {
        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // Validation ng mga password
        if (!currentPassword || !newPassword || !confirmPassword) {
            alert('Please fill out all password fields.');
            return;
        }

        if (newPassword !== confirmPassword) {
            alert('New password and confirm password do not match.');
            return;
        }

        if (newPassword.length < 8) {
            alert('New password must be at least 8 characters long.');
            return;
        }

        try {
            // Ipadala ang request sa server gamit ang Fetch API
            const response = await fetch('/api/admin/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    currentPassword: currentPassword,
                    newPassword: newPassword
                }),
            });

            const result = await response.json();

            if (response.ok) {
                alert(result.message);
                // I-clear ang form fields pagkatapos ng successful update
                currentPasswordInput.value = '';
                newPasswordInput.value = '';
                confirmPasswordInput.value = '';
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An unexpected error occurred. Please try again.');
        }
    });

    // ------------------------------------------
    //  Event Listener para sa 'Delete Account' Button
    // ------------------------------------------
    deleteAccountBtn.addEventListener('click', async () => {
        // Mag-confirm muna bago mag-delete
        const isConfirmed = confirm('Are you sure you want to delete your account? This action cannot be undone.');
        if (!isConfirmed) {
            return;
        }

        try {
            // Ipadala ang DELETE request sa server
            const response = await fetch('/api/admin/delete-account', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const result = await response.json();

            if (response.ok) {
                alert(result.message);
                // I-redirect sa login page pagkatapos mag-delete
                window.location.href = result.redirectUrl;
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An unexpected error occurred. Please try again.');
        }
    });
});