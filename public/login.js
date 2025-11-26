// public/login.js

document.addEventListener('DOMContentLoaded', function() {
    const loginButton = document.getElementById('loginButton');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const rememberMeCheckbox = document.getElementById('rememberMeCheckbox');
    const formMessage = document.createElement('p');
    formMessage.id = 'loginFormMessage';
    formMessage.style.marginTop = '310px';
    formMessage.style.marginLeft = '270px';
    formMessage.style.textAlign = 'center';

    const messageContainer = document.querySelector('.box');
    if (messageContainer) {
        messageContainer.appendChild(formMessage);
    }

    // Load remembered email/username from localStorage
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
        emailInput.value = rememberedEmail;
        rememberMeCheckbox.checked = true;
    }

    loginButton.addEventListener('click', async function() {
        const email = emailInput.value;
        const password = passwordInput.value;
        const rememberMe = rememberMeCheckbox.checked;

        // Client-side validation (basic)
        if (!email || !password) {
            formMessage.style.color = 'red';
            formMessage.textContent = 'Please enter both email and password.';
            return;
        }

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (response.ok) {
                formMessage.style.color = 'green';
                formMessage.textContent = result.message || 'Login successful! Redirecting...';

                // --- NEW CODE: Save user ID to localStorage on successful login ---
                if (result.user_id) {
                    localStorage.setItem('loggedInUserId', result.user_id);
                }
                // --- END NEW CODE ---

                if (rememberMe) {
                    localStorage.setItem('rememberedEmail', email);
                } else {
                    localStorage.removeItem('rememberedEmail');
                }

                if (result.success && result.redirectUrl) {
                    setTimeout(() => {
                        window.location.href = result.redirectUrl;
                    }, 1500);
                } else {
                    console.warn('Login successful but no redirectUrl provided by server.');
                    formMessage.textContent = result.message || 'Login successful!';
                }
            } else {
                formMessage.style.color = 'red';
                formMessage.textContent = result.message || 'Login failed. Please check your credentials.';
            }

        } catch (error) {
            console.error('Network or server error during login:', error);
            formMessage.style.color = 'red';
            formMessage.textContent = 'An unexpected error occurred. Please try again later.';
        }
    });

    // 🎯 FIXED: Replaced alert() with a console log
    const googleSignInButton = document.getElementById('googleSignInButton');
    googleSignInButton.addEventListener('click', function() {
        console.log('Google Sign-in not implemented yet.');
        formMessage.style.color = 'blue';
        formMessage.textContent = 'Google Sign-in is not yet supported.';
    });
});
