document.addEventListener('DOMContentLoaded', async () => {
    const newsContainer = document.getElementById('news-container');

    const fetchNews = async () => {
        try {
            const response = await fetch('/api/news');
            const result = await response.json();

            if (response.ok && result.success) {
                // Clear any existing news articles
                newsContainer.innerHTML = ''; 

                result.articles.forEach(article => {
                    const newsCard = document.createElement('div');
                    newsCard.className = 'news-card';
                    
                    newsCard.innerHTML = `
                        <img src="${article.image_url}" alt="${article.title}">
                        <h3>${article.title}</h3>
                        <p>${article.summary}</p>
                        <a href="${article.article_link}" target="_blank">Read More</a>
                    `;
                    newsContainer.appendChild(newsCard);
                });
            } else {
                console.error('Failed to fetch news:', result.message);
                newsContainer.innerHTML = '<p>Error loading news. Please try again later.</p>';
            }
        } catch (error) {
            console.error('Error fetching news:', error);
            newsContainer.innerHTML = '<p>Network error. Unable to load news.</p>';
        }
    };

    fetchNews();
});