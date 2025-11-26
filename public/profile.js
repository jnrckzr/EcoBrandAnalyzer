/**
 * profile.js
 * Fixed version with correct endpoints and full name display
 */

document.addEventListener("DOMContentLoaded", function() {
    // DOM Elements for User Profile
    const overallEcoScoreValue = document.getElementById('overallEcoScoreValue');
    const searchCountDisplay = document.getElementById('searchCountValue'); 
    const ecoScoreCircle = document.getElementById('ecoScoreCircle');
    const updatedStatus = document.getElementById('updated');
    const saveBtn = document.querySelector('.btn-submit');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const fileUpload = document.getElementById('file-upload');
    const profilePicPreview = document.getElementById('profile-pic-preview');

    // --- FUNCTION 1: User Profile Data ---
    async function fetchAndDisplayUserData() {
        try {
            console.log('📡 Fetching user data...');
            const response = await fetch('/api/user-data'); 
            
            if (response.status === 401) {
                console.warn('⚠️ Unauthorized. Redirecting to login.');
                window.location.href = '/login.html';
                return;
            }
            
            if (!response.ok) {
                throw new Error(`Failed to fetch user data with status: ${response.status}`);
            }
            
            const userData = await response.json();
            console.log('✅ User data received:', userData);
            console.log('🔍 Checking Fullname field:', userData.Fullname);
            console.log('🔍 All user data keys:', Object.keys(userData));
            
            // DOM Elements
            const displayfullName = document.getElementById('displayfullName');
            const displayFullNameInfo = document.getElementById('displayFullNameInfo');
            const displayEmail = document.getElementById('displayemail');
            const bioInput = document.getElementById('bio');
            const inputMobile = document.getElementById('inputMobile');
            const inputLoc = document.getElementById('inputLoc');
            const topBarUserName = document.getElementById('topBarUserName');

            // KRITIKAL: I-update ang lahat ng fields
            // Check both uppercase and lowercase fullname, fallback to username
            const fullName = userData.Fullname || userData.fullname || userData.fullName || userData.username || 'Guest User';
            
            // Log what we're actually getting
            console.log('🔍 userData.Fullname:', userData.Fullname);
            console.log('🔍 userData.username:', userData.username);
            console.log('🔍 Final fullName used:', fullName);
            
            if (topBarUserName) {
                topBarUserName.textContent = userData.username || 'Guest';
                console.log('✅ Top bar username updated:', userData.username);
            }
            
            if (displayfullName) {
                displayfullName.textContent = fullName;
                console.log('✅ Profile full name updated:', fullName);
            }
            
            if (displayFullNameInfo) {
                displayFullNameInfo.textContent = fullName;
                console.log('✅ Info full name updated:', fullName);
            }
            
            if (displayEmail) {
                displayEmail.textContent = userData.email || 'N/A';
                console.log('✅ Email updated:', userData.email);
            }
            
            if (bioInput) bioInput.value = userData.bio || '';
            if (inputMobile) inputMobile.value = userData.mobile || '';
            if (inputLoc) inputLoc.value = userData.location || '';
            
            if (profilePicPreview) {
                profilePicPreview.src = userData.profilePictureUrl || 'defprof.jpg';
            }
            
            if (updatedStatus) updatedStatus.style.display = 'none';

        } catch (error) {
            console.error('❌ Error fetching user data:', error);
            alert('Failed to load profile data. Please refresh the page.');
        }
    }

    // --- FUNCTION 2: Search Count and Average Eco Score ---
    async function fetchAndDisplaySearchStats() {
        try {
            console.log('📡 Fetching search stats...');
            
            // 1. Fetch Search Count and Recent Searches
            const historyResp = await fetch('/api/search-history'); 
            const historyData = await historyResp.json();
            const history = historyData.history || [];
            const totalSearches = history.length;
            
            if (searchCountDisplay) {
                searchCountDisplay.textContent = totalSearches;
                console.log('✅ Search count updated:', totalSearches);
            }
            
            // 2. Fetch Average Eco Score
            const avgResp = await fetch('/api/user-average-score');
            const avgData = await avgResp.json();
            
            console.log('✅ API Response for Average Score:', avgData); 
            
            const rawAverageScore = avgData.average_score || 0; 
            const score = Math.max(0, Math.min(100, Math.round(rawAverageScore))); 
            
            // 3. Update Eco Score Display
            if (overallEcoScoreValue) {
                overallEcoScoreValue.textContent = `${score}%`;
                console.log('✅ Eco score updated:', score);
            }
            
            if (ecoScoreCircle) {
                const degreeValue = score * 3.6; 
                requestAnimationFrame(() => { 
                    ecoScoreCircle.style.setProperty('--degree', `${degreeValue}deg`);
                });
            }

            // 4. Update Recent Searches in the Sidebar
            const productListUl = document.getElementById('productList');
            const noProductsMessage = document.getElementById('noProductsMessage');
            if (productListUl) productListUl.innerHTML = '';
            
            const recentSearches = history.slice(0, 5); 

            if (recentSearches.length > 0 && productListUl) {
                recentSearches.forEach(item => {
                    const li = document.createElement('li');
                    li.textContent = item.query; 
                    productListUl.appendChild(li);
                });
                if (noProductsMessage) noProductsMessage.style.display = 'none';
            } else if (noProductsMessage) {
                noProductsMessage.style.display = 'block';
            }

        } catch (error) {
            console.error('❌ Error fetching stats:', error);
            if (searchCountDisplay) searchCountDisplay.textContent = 'N/A';
            if (overallEcoScoreValue) overallEcoScoreValue.textContent = '0%'; 
            if (ecoScoreCircle) ecoScoreCircle.style.setProperty('--degree', `0deg`);
        }
    }

    // --- FUNCTION 3: Profile Picture Preview ---
    function setupProfilePictureUpload() {
        if (fileUpload) {
            fileUpload.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        if (profilePicPreview) profilePicPreview.src = e.target.result;
                    };
                    reader.readAsDataURL(file);
                    
                    // Auto-upload the profile picture
                    uploadProfilePicture(file);
                }
            });
        }
    }

    // --- FUNCTION 4: Upload Profile Picture ---
    async function uploadProfilePicture(file) {
        const formData = new FormData();
        formData.append('profile_picture', file);
        
        try {
            console.log('📤 Uploading profile picture...');
            const response = await fetch('/api/upload-profile-pic', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Failed to upload profile picture');
            }
            
            const result = await response.json();
            console.log('✅ Profile picture uploaded:', result);
            
            if (result.success && updatedStatus) {
                updatedStatus.textContent = 'Profile picture updated!';
                updatedStatus.style.display = 'block';
                setTimeout(() => {
                    updatedStatus.style.display = 'none';
                }, 3000);
            }
            
        } catch (error) {
            console.error('❌ Error uploading profile picture:', error);
            alert('Failed to upload profile picture. Please try again.');
        }
    }

    // --- FUNCTION 5: Save Profile Changes ---
    async function handleSaveProfile(e) {
        e.preventDefault();

        const updatedData = {
            bio: document.getElementById('bio').value,
            mobile: document.getElementById('inputMobile').value,
            location: document.getElementById('inputLoc').value,
        };
        
        try {
            console.log('💾 Saving profile changes...');
            
            // ✅ FIX: Correct endpoint is /api/update-profile (POST)
            const response = await fetch('/api/update-profile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedData)
            });

            if (!response.ok) {
                throw new Error('Failed to save profile changes.');
            }
            
            const result = await response.json();
            console.log('✅ Profile saved:', result);
            
            // Success: I-update ang display
            if (updatedStatus) {
                updatedStatus.textContent = 'Profile updated successfully!';
                updatedStatus.style.display = 'block'; 
                setTimeout(() => {
                    updatedStatus.style.display = 'none';
                }, 3000);
            }

            // Reload data to confirm changes
            await fetchAndDisplayUserData();
            
        } catch (error) {
            console.error('❌ Error saving profile:', error);
            alert('Failed to save changes. Please try again.');
        }
    }

    // --- FUNCTION 6: Cancel Button Handler ---
    function setupEditListeners() {
        if (saveBtn) {
            saveBtn.addEventListener('click', handleSaveProfile);
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                console.log('🔄 Reloading profile data...');
                fetchAndDisplayUserData();
            });
        }
    }

    // --- Initialization ---
    console.log('🚀 Profile page initialized');
    fetchAndDisplayUserData();
    fetchAndDisplaySearchStats(); 
    setupProfilePictureUpload();
    setupEditListeners();
});