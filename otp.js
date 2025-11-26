// otp.js

document.addEventListener('DOMContentLoaded', () => {
    // Hanapin ang form
    const form = document.querySelector('form');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault(); // Pigilan ang default form submission

            const formData = new FormData(form);
            // Kunin ang OTP code mula sa input na may name="otp_code"
            const otp_code = formData.get('otp_code'); 

            try {
                const response = await fetch('/api/auth/verify-otp', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({ otp_code: otp_code }) // I-send ang code
                });
                
                // Dapat i-check ang status bago i-parse ang JSON kung gusto mong mahawakan ang errors
                const result = await response.json();

                if (response.ok && result.success && result.redirectUrl) {
                    alert(result.message || 'Verification successful!');
                    // Success: I-redirect sa changepass.html kasama ang token
                    // Example: /changepass.html?token=SECURE_TOKEN_HERE
                    window.location.href = result.redirectUrl; 
                } else {
                    // Hahawakan ang errors tulad ng Invalid or expired OTP (mula sa authService)
                    alert(result.message || 'Invalid or expired OTP code. Please retry the process.');
                }

            } catch (error) {
                console.error('OTP Verification error:', error);
                alert('Could not connect to the server. Please try again.');
            }
        });
    }
});