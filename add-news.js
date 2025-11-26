document.addEventListener('DOMContentLoaded', async () => {
    // Change the selector to match the new form ID
    const newsUploadForm = document.getElementById('addNewsForm');

    if (newsUploadForm) {
        newsUploadForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 

            // Retrieve values from the form inputs
            const title = document.getElementById('Title').value;
            const summary = document.getElementById('Summary').value;
            const imageUrl = document.getElementById('ImgUrl').value;
            const articleLink = document.getElementById('ArticleLink').value;
            
            // Create a JSON object with the news data
            const newNewsData = {
                title,
                summary,
                image_url: imageUrl, // Match your database column name
                article_link: articleLink
            };

            // Send the data to the backend server using a POST request
            try {
                const response = await fetch('/api/add-news', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(newNewsData)
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    // Success! Add UI feedback here, like a success message
                    alert('News added successfully!'); // Added a user-friendly alert
                    console.log('News added successfully!');
                    
                    // Clear the form fields after successful submission
                    document.getElementById('Title').value = '';
                    document.getElementById('Summary').value = '';
                    document.getElementById('ImgUrl').value = '';
                    document.getElementById('ArticleLink').value = '';
                    
                } else {
                    console.error('Failed to add news:', result.message);
                    alert('Failed to add news: ' + result.message); // Added a user-friendly error message
                }
            } catch (error) {
                console.error('Error sending news data:', error);
                alert('Error sending news data. Please check your network connection.');
            }
        });
    }
});