document.addEventListener('DOMContentLoaded', () => {
    const searchToggle = document.getElementById('searchToggle');
    const searchField = document.getElementById('searchField');
    const searchContainer = document.querySelector('.search-container');

    searchToggle.addEventListener('click', () => {
        // Toggle the 'active' class on the container
        searchContainer.classList.toggle('active');

        // If the search bar is now active, focus on the input field
        if (searchContainer.classList.contains('active')) {
            searchField.focus();
        } else {
            // Optional: Clear the input when closing
            searchField.value = '';
        }
    });

    // Optional: Close search when clicking outside the container
    document.addEventListener('click', (event) => {
        if (!searchContainer.contains(event.target) && searchContainer.classList.contains('active')) {
            searchContainer.classList.remove('active');
            searchField.value = ''; // Clear input on close
        }
    });

    // Optional: Close search when pressing Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && searchContainer.classList.contains('active')) {
            searchContainer.classList.remove('active');
            searchField.value = ''; // Clear input on close
        }
    });

    // Optional: Handle actual search submission (e.g., when pressing Enter)
    searchField.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            const query = searchField.value.trim();
            if (query) {
                // Here you would typically perform the search,
                // e.g., redirect to a search results page:
                // window.location.href = `/search?q=${encodeURIComponent(query)}`;
                alert(`Searching for: ${query}`); // For demonstration
                searchContainer.classList.remove('active'); // Close after search
                searchField.value = '';
            }
        }
    });
});