document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.sidebar .nav-item');
    const newProductButton = document.querySelector('.bottom .new');
    const signOutButton = document.querySelector('.bottom .signout');

    // Function para i-set ang 'active' class base sa current page
    function setActiveNavItem() {
        // Kunin ang filename lang (e.g., 'homepage.html')
        const currentPagePath = window.location.pathname.split('/').pop();
        
        navItems.forEach(item => {
            const button = item.querySelector('button');
            if (button && button.dataset.page) {
                item.classList.remove('active');
                
                // CRITICAL: Tiyakin na ang currentPagePath ay tumutugma sa data-page
                if (currentPagePath === button.dataset.page) {
                    item.classList.add('active');
                }
            }
        });
    }

    setActiveNavItem();

    // Idagdag ang click event listeners sa lahat ng navigation buttons
    navItems.forEach(item => {
        const button = item.querySelector('button');
        if (button && button.dataset.page) {
            button.addEventListener('click', (event) => { // Idagdag ang event parameter
                event.preventDefault(); // Pigilan ang default action (kung nasa loob ng form)
                const targetPage = button.dataset.page;
                
                // BAGUHIN DITO: Gumamit ng relative path (walang leading slash /)
                window.location.href = targetPage; 
            });
        }
    });

    // Inayos na logic para sa "New Product" button
    if (newProductButton) {
        newProductButton.addEventListener('click', (event) => {
            event.preventDefault();
            // Diretso sa homepage.html
            window.location.href = 'homepage.html';
        });
    }

    // Inayos na logic para sa "Sign out" button
    if (signOutButton) { 
        signOutButton.addEventListener('click', (event) => {
            event.preventDefault();
            // Gamitin ang tamang logout endpoint
            window.location.href = '/logout';
        });
    }
});