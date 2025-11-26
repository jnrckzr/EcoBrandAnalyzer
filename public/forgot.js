// forgot.js

document.addEventListener('DOMContentLoaded', () => {
    // Hanapin ang form gamit ang querySelector (Dahil iisa lang naman ang form sa page)
    const form = document.querySelector('form');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault(); // Pigilan ang default browser form submission

            const formData = new FormData(form);
            // Kunin ang email value galing sa input na may name="email"
            const email = formData.get('email'); 

            try {
                // I-send ang data sa iyong Node.js endpoint
                const response = await fetch('/api/auth/forgot-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({ email: email }) // I-convert ang data sa JSON
                });
                
                // Tanggapin at i-parse ang JSON response
                const result = await response.json();

                if (result.success && result.redirectUrl) {
                    // Opsyonal: Magpakita ng message bago mag-redirect
                    alert(result.message || 'Processing complete. Check your email for the OTP.'); 
                    
                    // I-redirect ang user sa next step (otp.html)
                    window.location.href = result.redirectUrl; 
                } else {
                    // Hahawakan ang anumang error message
                    alert(result.message || 'An unexpected error occurred. Please try again.');
                }

            } catch (error) {
                console.error('Submission error:', error);
                // Error kung hindi naka-connect sa server
                alert('Could not connect to the server. Please check your network or try again.');
            }
        });
    }
});