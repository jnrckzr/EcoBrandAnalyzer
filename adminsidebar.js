document.addEventListener('DOMContentLoaded', () => {
  const navButtons = document.querySelectorAll('.sidebar button');

  // get current filename (example: adminpage.html)
  const url = new URL(window.location.href);
  const currentFileName = url.pathname.split('/').pop();

  navButtons.forEach(button => {
    // Primary: data-page attribute
    let dataPage = button.getAttribute('data-page');

    // Fallback: if button is wrapped in an <a href="...">, read that
    if (!dataPage) {
      const parentAnchor = button.closest('a');
      if (parentAnchor && parentAnchor.getAttribute('href')) {
        dataPage = parentAnchor.getAttribute('href');
      }
    }

    // Apply 'active' to the parent <li> if current page matches
    if (dataPage) {
      // Normalize: remove any leading path segments
      const normalized = dataPage.split('/').pop();
      if (currentFileName === normalized) {
        const parentLi = button.closest('li');
        if (parentLi) parentLi.classList.add('active');
      } else {
        const parentLi = button.closest('li');
        if (parentLi) parentLi.classList.remove('active');
      }
    }

    // Navigation & Logout logic
    button.addEventListener('click', (event) => {
      // Determine page again (fresh)
      let page = button.getAttribute('data-page');
      if (!page) {
        const parentAnchor = button.closest('a');
        if (parentAnchor) page = parentAnchor.getAttribute('href');
      }

      // If logout
      if (page === 'logout') {
        event.preventDefault();
        localStorage.clear();
        window.location.href = 'login.html';
        return;
      }

      // If we have a page string, navigate programmatically.
      // Prevent default so anchor doesn't do its own navigation (keeps behavior predictable).
      if (page) {
        event.preventDefault();
        window.location.href = page;
      } else {
        // No page defined: do nothing (or keep default)
        // we won't call preventDefault() so an <a> (if clicked) will still work.
      }

      // optional user dropdown attachment (existing)
      const userDropdown = document.querySelector('.user-profile-dropdown');
      if (userDropdown) {
        userDropdown.addEventListener('click', () => {
          // optional toggle logic
          alert('User dropdown clicked!');
        });
      }
    });
  });
});
