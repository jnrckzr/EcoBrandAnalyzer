document.addEventListener("DOMContentLoaded", () => {
  // 1. Breadcrumb Functionality
  const breadcrumbPathSpan = document.getElementById("breadcrumbPath");
  if (breadcrumbPathSpan) {
    const path = window.location.pathname;
    const fileName = path.substring(path.lastIndexOf("/") + 1);
    const pageName = fileName.split(".")[0];

    let breadcrumbText = "";

    switch (pageName) {
      case "homepage":
        breadcrumbText = " / Home";
        break;
      case "environmental-news":
        breadcrumbText = " / Environmental News";
        break;
      case "profile":
        breadcrumbText = " / Profile";
        break;
      case "categories":
        breadcrumbText = " / Categories";
        break;
      case "settings":
        breadcrumbText = " / Settings";
        break;
      case "new-product":
        breadcrumbText = " / Products / New Product";
        break;
      default:
        breadcrumbText = " / Unknown Page";
        break;
    }

    breadcrumbPathSpan.textContent = breadcrumbText;
  }

  // 2. Navigation Button Functionality
  // This event listener handles clicks on ALL buttons with a `data-page` attribute.
  const allNavButtons = document.querySelectorAll('button[data-page]');
  
  allNavButtons.forEach(button => {
    button.addEventListener('click', (event) => {
      event.preventDefault(); // Prevents default behavior

      const page = button.getAttribute('data-page');

      if (page === 'logout') {
        // Special case for logout
        window.location.href = '/logout';
      } else {
        // Redirects to the page specified in the data-page attribute
        window.location.href = page;
      }
    });
  });

});