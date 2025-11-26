// changepass.js

// Function para kunin ang URL parameter
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('change-pass-form');
    const hiddenTokenInput = document.getElementById('reset_token_input');
    const token = getQueryParam('token'); // Kinuha ang token na galing sa otp.html redirect

    // 1. Token Validation
    if (!token) {
        alert('Authorization expired or missing. Please restart the password reset process.');
        window.location.href = '/forgot.html'; 
        return;
    }

    // 2. Ilagay ang token sa hidden field
    hiddenTokenInput.value = token;

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault(); 

            const formData = new FormData(form);
            const data = Object.fromEntries(formData); // Kukunin ang { new_password, confirm_password, reset_token }

            try {
                // 3. I-send ang data sa server endpoint
                const response = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();

                if (response.ok && result.success && result.redirectUrl) {
                    alert(result.message || 'Password successfully changed!');
                    // 4. Final Redirect to Login
                    window.location.href = result.redirectUrl; 
                } else {
                    alert(result.message || 'Failed to change password. Please check your inputs.');
                }

            } catch (error) {
                console.error('Password change error:', error);
                alert('Could not complete the request. Please try again.');
            }
        });
    }
});