document.addEventListener('DOMContentLoaded', function() {
    // Kinuha ang mga elements gamit ang orihinal na IDs mula sa settings.html
    const newPasswordInput = document.getElementById('password');
    const confirmNewPasswordInput = document.getElementById('confirmPassword');
    const saveChangesBtn = document.getElementById('saveChanges');
    const deleteAccountBtn = document.getElementById('Delete');
    
    // Walang message element sa original HTML, kaya gagamitin ko ang alert()

    // --- Change Password Functionality ---
    if (saveChangesBtn) {
        saveChangesBtn.addEventListener('click', async function(e) {
            e.preventDefault(); // Pipigilan ang default na action ng button

            const newPassword = newPasswordInput.value;
            const confirmNewPassword = confirmNewPasswordInput.value;

            if (newPassword.length < 8) {
                alert('Password must be at least 8 characters long.');
                return;
            }

            if (newPassword !== confirmNewPassword) {
                alert('New password and confirmation do not match.');
                return;
            }

            try {
                const response = await fetch('/api/change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newPassword, confirmNewPassword })
                });

                const result = await response.json();

                if (response.ok) {
                    alert(result.message);
                    // Clear the input fields after successful change
                    newPasswordInput.value = '';
                    confirmNewPasswordInput.value = '';
                } else {
                    alert(`Error: ${result.message}`);
                }
            } catch (error) {
                console.error('Error changing password:', error);
                alert('An unexpected error occurred. Please try again.');
            }
        });
    }

    // --- Delete Account Functionality ---
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async function() {
            const isConfirmed = confirm('Are you sure you want to delete your account? This action cannot be undone.');
            
            if (isConfirmed) {
                try {
                    const response = await fetch('/api/delete-account', {
                        method: 'DELETE'
                    });

                    const result = await response.json();

                    if (response.ok) {
                        alert(result.message);
                        window.location.href = result.redirectUrl;
                    } else {
                        alert(`Error: ${result.message}`);
                    }
                } catch (error) {
                    console.error('Error deleting account:', error);
                    alert('An error occurred while deleting your account.');
                }
            }
        });
    }
});