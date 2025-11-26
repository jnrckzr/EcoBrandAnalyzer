// public/signup.js
document.addEventListener('DOMContentLoaded', function() {
    const termsCheckbox = document.getElementById('termsCheckbox');

    const url = new URL(window.location.href);
    const urlParams = url.searchParams;

    const termsAccepted = urlParams.get('termsAccepted');

    if (termsAccepted === 'true') {
        termsCheckbox.checked = true;
    } else if (termsAccepted === 'false') {
        termsCheckbox.checked = false;
    }

    const signupForm = document.getElementById('signupForm');
    const formMessage = document.getElementById('formMessage');

    signupForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            formMessage.style.color = 'red';
            formMessage.textContent = 'Password and Confirm Password do not match.';
            return;
        }

        if (!termsCheckbox.checked) {
            formMessage.style.color = 'red';
            formMessage.textContent = 'You must agree to the Terms and Conditions.';
            return;
        }

        const formData = new FormData(signupForm);
        const data = {};
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }

        // Corrected: We do not delete the password field.
        delete data.confirmPassword;
        delete data.terms;

        try {
            const response = await fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                if (result.success && result.redirectUrl) {
                    formMessage.style.color = 'green';
                    formMessage.textContent = result.message || 'Registration successful! Redirecting...';
                    setTimeout(() => {
                        window.location.href = result.redirectUrl;
                    }, 1500);
                } else {
                    formMessage.style.color = 'green';
                    formMessage.textContent = result.message || 'Registration successful!';
                    signupForm.reset();
                }
            } else {
                formMessage.style.color = 'red';
                formMessage.textContent = result.message || 'Registration failed. Please try again.';
            }

        } catch (error) {
            console.error('Network or server error:', error);
            formMessage.style.color = 'red';
            formMessage.textContent = 'An unexpected error occurred. Please try again later.';
        }
    });
});