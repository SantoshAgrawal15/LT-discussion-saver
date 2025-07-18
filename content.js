// Content script for LeetCode Discussion Saver
console.log('LeetCode Discussion Saver loaded');

// Function to extract discussion post data with robust selectors
function extractPostData() {
  const url = window.location.href;
  
  // Check if we're on a discussion page
  if (!url.includes('leetcode.com') || (!url.includes('/discuss/') && !url.includes('/problems/'))) {
    return null;
  }

  let postData = {};
  
  try {
    // Extract problem title with multiple fallbacks
    const problemTitleSelectors = [
      '[data-cy="question-title"]',
      'h1[data-cy*="title"]',
      'a[href*="/problems/"] h1',
      '.question-title',
      '.css-v3d350',
      'h1:first-of-type'
    ];
    
    const problemTitleElement = findElementBySelectors(problemTitleSelectors);
    if (problemTitleElement) {
      postData.problemTitle = problemTitleElement.textContent.trim();
    }

    // Extract discussion title with multiple fallbacks
    const discussionTitleSelectors = [
      '[data-cy="post-title"]',
      '.discuss-topic-title',
      'h1[class*="title"]',
      '.css-1et7jxh',
      '[class*="discuss"] h1',
      '[class*="topic"] h1',
      'h2',
      'h3'
    ];

    const discussionTitleElement = findElementBySelectors(discussionTitleSelectors);
    if (discussionTitleElement) {
      postData.discussionTitle = discussionTitleElement.textContent.trim();
    }

    // Extract author info with multiple fallbacks
    const authorSelectors = [
      '[data-cy="username"]',
      '.username',
      '.css-1ewh0ns',
      '[class*="username"]',
      '[class*="author"]',
      'a[href*="/u/"]',
      'span[class*="user"]'
    ];
    
    const authorElement = findElementBySelectors(authorSelectors);
    if (authorElement) {
      postData.author = authorElement.textContent.trim();
    }

    // Extract post content with multiple fallbacks
    const contentSelectors = [
      '[data-cy="post-content"]',
      '.discuss-markdown-container',
      '.css-1h8taa7',
      '[class*="content"]',
      '[class*="markdown"]',
      '.discuss-content',
      'article',
      '.post-content'
    ];
    
    const contentElement = findElementBySelectors(contentSelectors);
    if (contentElement) {
      const textContent = contentElement.textContent.trim();
      postData.contentPreview = textContent.substring(0, 200) + (textContent.length > 200 ? '...' : '');
    }

    // Extract tags with multiple fallbacks
    const tagSelectors = [
      '.topic-tag',
      '.tag',
      '[class*="tag"]',
      '[class*="badge"]',
      '.label'
    ];
    
    const tagElements = document.querySelectorAll(tagSelectors.join(', '));
    postData.tags = Array.from(tagElements).map(tag => tag.textContent.trim()).filter(Boolean);

    // Extract votes with multiple fallbacks
    const voteSelectors = [
      '[data-cy="vote-count"]',
      '.vote-count',
      '[class*="vote"]',
      '[class*="score"]',
      '.upvote',
      '.likes'
    ];
    
    const voteElement = findElementBySelectors(voteSelectors);
    if (voteElement) {
      postData.votes = voteElement.textContent.trim();
    }

    // Add metadata
    postData.url = url;
    postData.savedAt = new Date().toISOString();
    postData.domain = 'leetcode.com';
    postData.pageTitle = document.title;

    // Generate a unique ID for this post (better method)
    const timestamp = Date.now();
    const titleHash = postData.discussionTitle ? 
      postData.discussionTitle.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10) : 
      'post';
    
    postData.id = `${titleHash}_${timestamp}_${Math.random().toString(36).substring(2, 8)}`;

    console.log('Generated unique ID:', postData.id);
    console.log('Extracted post data:', postData);
    return postData;
    
  } catch (error) {
    console.error('Error extracting post data:', error);
    // Fallback with basic data
    return {
      url: url,
      title: document.title,
      savedAt: new Date().toISOString(),
      domain: 'leetcode.com',
      id: `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      error: 'Could not extract full post data'
    };
  }
}

// Helper function to find element by multiple selectors
function findElementBySelectors(selectors) {
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element;
      }
    } catch (e) {
      // Skip invalid selectors
      continue;
    }
  }
  return null;
}

// Add save button with better positioning and error handling
function addSaveButton() {
  // Remove existing button if present
  const existingBtn = document.getElementById('leetcode-saver-btn');
  if (existingBtn) {
    existingBtn.remove();
  }

  // Create save button with better styling
  const saveBtn = document.createElement('button');
  saveBtn.id = 'leetcode-saver-btn';
  saveBtn.innerHTML = '💾 Save Post';
  saveBtn.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    z-index: 999999 !important;
    background: linear-gradient(135deg, #ff6b35, #f7931e) !important;
    color: white !important;
    border: none !important;
    padding: 12px 18px !important;
    border-radius: 8px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3) !important;
    transition: all 0.2s ease !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 14px !important;
    text-decoration: none !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    backdrop-filter: blur(10px) !important;
    border: 2px solid rgba(255, 255, 255, 0.1) !important;
  `;

  // Hover effects
  saveBtn.addEventListener('mouseenter', () => {
    saveBtn.style.transform = 'translateY(-2px) scale(1.02)';
    saveBtn.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.4)';
  });

  saveBtn.addEventListener('mouseleave', () => {
    saveBtn.style.transform = 'translateY(0) scale(1)';
    saveBtn.style.boxShadow = '0 4px 12px rgba(255, 107, 53, 0.3)';
  });

  // Click handler with better error handling
  saveBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Disable button during save
    saveBtn.style.pointerEvents = 'none';
    saveBtn.innerHTML = '⏳ Saving...';
    
    try {
      const postData = extractPostData();
      
      if (!postData) {
        throw new Error('Could not extract post data from this page');
      }

      // Get existing saved posts
      const result = await chrome.storage.local.get(['savedPosts']);
      const savedPosts = result.savedPosts || [];

      // Check if already saved
      const existingPost = savedPosts.find(post => post.id === postData.id || post.url === postData.url);
      if (existingPost) {
        showNotification('Post already saved!', 'info');
        return;
      }

      // Add new post
      savedPosts.unshift(postData);
      
      // Keep only last 200 posts to avoid storage issues
      if (savedPosts.length > 200) {
        savedPosts.splice(200);
      }

      // Save to storage with error handling
      await chrome.storage.local.set({ savedPosts: savedPosts });
      
      showNotification(`Post saved! (${savedPosts.length} total)`, 'success');
      
      // Success animation
      saveBtn.innerHTML = '✅ Saved!';
      saveBtn.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
      
      setTimeout(() => {
        saveBtn.innerHTML = '💾 Save Post';
        saveBtn.style.background = 'linear-gradient(135deg, #ff6b35, #f7931e)';
      }, 3000);

    } catch (error) {
      console.error('Error saving post:', error);
      showNotification(`Error: ${error.message}`, 'error');
      
      // Error animation
      saveBtn.innerHTML = '❌ Error';
      saveBtn.style.background = 'linear-gradient(135deg, #dc3545, #c82333)';
      
      setTimeout(() => {
        saveBtn.innerHTML = '💾 Save Post';
        saveBtn.style.background = 'linear-gradient(135deg, #ff6b35, #f7931e)';
      }, 3000);
      
    } finally {
      // Re-enable button
      setTimeout(() => {
        saveBtn.style.pointerEvents = 'auto';
      }, 1000);
    }
  });

  // Add button to page
  document.body.appendChild(saveBtn);
  
  // Ensure button stays on top
  setTimeout(() => {
    saveBtn.style.zIndex = '999999';
  }, 100);
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed !important;
    top: 80px !important;
    right: 20px !important;
    z-index: 10001 !important;
    padding: 12px 20px !important;
    border-radius: 6px !important;
    color: white !important;
    font-weight: 600 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 13px !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
    transition: all 0.3s ease !important;
    transform: translateX(400px) !important;
  `;

  // Set background based on type
  const backgrounds = {
    success: '#28a745',
    error: '#dc3545',
    info: '#17a2b8'
  };
  notification.style.background = backgrounds[type] || backgrounds.info;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 100);

  // Animate out and remove
  setTimeout(() => {
    notification.style.transform = 'translateX(400px)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Initialize with better page detection and retry logic
function init() {
  console.log('LeetCode Saver: Initializing...');
  
  // Wait for page to be ready
  const initWithRetry = () => {
    if (isValidDiscussionPage()) {
      console.log('LeetCode Saver: Valid page detected');
      // Add save button with delay to ensure page elements are loaded
      setTimeout(() => {
        addSaveButton();
        console.log('LeetCode Saver: Save button added');
      }, 2000);
      
      // Set up navigation watcher for SPA behavior
      setupNavigationWatcher();
    } else {
      console.log('LeetCode Saver: Not a discussion page');
    }
  };

  // Try multiple times in case page is still loading
  initWithRetry();
  setTimeout(initWithRetry, 3000);
  setTimeout(initWithRetry, 6000);
}

// Better navigation watcher for SPA
function setupNavigationWatcher() {
  let lastUrl = location.href;
  let observer = null;
  
  // Clean up existing observer
  if (observer) {
    observer.disconnect();
  }
  
  observer = new MutationObserver((mutations) => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('LeetCode Saver: Navigation detected to', url);
      
      if (isValidDiscussionPage()) {
        // Delay to let new page content load
        setTimeout(() => {
          addSaveButton();
          console.log('LeetCode Saver: Save button re-added after navigation');
        }, 2000);
      }
    }
  });
  
  observer.observe(document, { 
    subtree: true, 
    childList: true,
    attributes: false // Reduce noise
  });
  
  console.log('LeetCode Saver: Navigation watcher setup complete');
}

// More comprehensive page validation
function isValidDiscussionPage() {
  const url = window.location.href;
  const isLeetCode = url.includes('leetcode.com');
  const isDiscussion = url.includes('/discuss/') || 
                      url.includes('/problems/') ||
                      url.includes('/explore/');
  
  // Also check for discussion-specific elements in DOM
  const hasDiscussionElements = !!(
    document.querySelector('[data-cy="post-content"]') ||
    document.querySelector('.discuss-markdown-container') ||
    document.querySelector('[class*="discuss"]') ||
    document.querySelector('[class*="topic"]') ||
    document.querySelector('[data-cy="post-title"]')
  );
  
  const isValid = isLeetCode && (isDiscussion || hasDiscussionElements);
  console.log('LeetCode Saver: Page validation -', { url, isLeetCode, isDiscussion, hasDiscussionElements, isValid });
  
  return isValid;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentPageData') {
    const postData = extractPostData();
    sendResponse({ 
      isValidPage: isValidDiscussionPage(),
      postData: postData 
    });
  }
  return true;
});

// Start the extension
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


// // Content script for LeetCode Discussion Saver
// console.log('LeetCode Discussion Saver loaded');

// // Function to extract discussion post data with robust selectors
// function extractPostData() {
//   const url = window.location.href;
  
//   // Check if we're on a discussion page
//   if (!url.includes('leetcode.com') || (!url.includes('/discuss/') && !url.includes('/problems/'))) {
//     return null;
//   }

//   let postData = {};
  
//   try {
//     // Extract problem title with multiple fallbacks
//     const problemTitleSelectors = [
//       '[data-cy="question-title"]',
//       'h1[data-cy*="title"]',
//       'a[href*="/problems/"] h1',
//       '.question-title',
//       '.css-v3d350',
//       'h1:first-of-type',
//       'title'
//     ];
    
//     const problemTitleElement = findElementBySelectors(problemTitleSelectors);
//     if (problemTitleElement) {
//       postData.problemTitle = problemTitleElement.textContent.trim();
//     }

//     // Extract discussion title with multiple fallbacks
//     const discussionTitleSelectors = [
//       '[data-cy="post-title"]',
//       '.discuss-topic-title',
//       'h1[class*="title"]',
//       '.css-1et7jxh',
//       '[class*="discuss"] h1',
//       '[class*="topic"] h1',
//       'h2',
//       'h3'
//     ];

//     const discussionTitleElement = findElementBySelectors(discussionTitleSelectors);
//     if (discussionTitleElement) {
//       postData.discussionTitle = discussionTitleElement.textContent.trim();
//     }

//     // Extract author info with multiple fallbacks
//     const authorSelectors = [
//       '[data-cy="username"]',
//       '.username',
//       '.css-1ewh0ns',
//       '[class*="username"]',
//       '[class*="author"]',
//       'a[href*="/u/"]',
//       'span[class*="user"]'
//     ];
    
//     const authorElement = findElementBySelectors(authorSelectors);
//     if (authorElement) {
//       postData.author = authorElement.textContent.trim();
//     }

//     // Extract post content with multiple fallbacks
//     const contentSelectors = [
//       '[data-cy="post-content"]',
//       '.discuss-markdown-container',
//       '.css-1h8taa7',
//       '[class*="content"]',
//       '[class*="markdown"]',
//       '.discuss-content',
//       'article',
//       '.post-content'
//     ];
    
//     const contentElement = findElementBySelectors(contentSelectors);
//     if (contentElement) {
//       const textContent = contentElement.textContent.trim();
//       postData.contentPreview = textContent.substring(0, 200) + (textContent.length > 200 ? '...' : '');
//     }

//     // Extract tags with multiple fallbacks
//     const tagSelectors = [
//       '.topic-tag',
//       '.tag',
//       '[class*="tag"]',
//       '[class*="badge"]',
//       '.label'
//     ];
    
//     const tagElements = document.querySelectorAll(tagSelectors.join(', '));
//     postData.tags = Array.from(tagElements).map(tag => tag.textContent.trim()).filter(Boolean);

//     // Extract votes with multiple fallbacks
//     const voteSelectors = [
//       '[data-cy="vote-count"]',
//       '.vote-count',
//       '[class*="vote"]',
//       '[class*="score"]',
//       '.upvote',
//       '.likes'
//     ];
    
//     const voteElement = findElementBySelectors(voteSelectors);
//     if (voteElement) {
//       postData.votes = voteElement.textContent.trim();
//     }

//     // Add metadata
//     postData.url = url;
//     postData.savedAt = new Date().toISOString();
//     postData.domain = 'leetcode.com';
//     postData.pageTitle = document.title;

//     // Generate a unique ID for this post (better method)
//     const urlParts = url.split('/');
//     const timestamp = Date.now();
//     const titleHash = postData.discussionTitle ? 
//       postData.discussionTitle.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10) : 
//       'post';
    
//     postData.id = `${titleHash}_${timestamp}_${Math.random().toString(36).substring(2, 8)}`;

//     console.log('Generated unique ID:', postData.id);
//     console.log('Extracted post data:', postData);
//     return postData;
    
//   } catch (error) {
//     console.error('Error extracting post data:', error);
//     // Fallback with basic data
//     return {
//       url: url,
//       title: document.title,
//       savedAt: new Date().toISOString(),
//       domain: 'leetcode.com',
//       id: `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
//       error: 'Could not extract full post data'
//     };
//   }
// }

// // Helper function to find element by multiple selectors
// function findElementBySelectors(selectors) {
//   for (const selector of selectors) {
//     try {
//       const element = document.querySelector(selector);
//       if (element && element.textContent.trim()) {
//         return element;
//       }
//     } catch (e) {
//       // Skip invalid selectors
//       continue;
//     }
//   }
//   return null;
// }

// // Add save button with better positioning and error handling
// function addSaveButton() {
//   // Remove existing button if present
//   const existingBtn = document.getElementById('leetcode-saver-btn');
//   if (existingBtn) {
//     existingBtn.remove();
//   }

//   // Create save button with better styling
//   const saveBtn = document.createElement('button');
//   saveBtn.id = 'leetcode-saver-btn';
//   saveBtn.innerHTML = '💾 Save Post';
//   saveBtn.style.cssText = `
//     position: fixed !important;
//     top: 20px !important;
//     right: 20px !important;
//     z-index: 999999 !important;
//     background: linear-gradient(135deg, #ff6b35, #f7931e) !important;
//     color: white !important;
//     border: none !important;
//     padding: 12px 18px !important;
//     border-radius: 8px !important;
//     font-weight: 600 !important;
//     cursor: pointer !important;
//     box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3) !important;
//     transition: all 0.2s ease !important;
//     font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
//     font-size: 14px !important;
//     text-decoration: none !important;
//     display: flex !important;
//     align-items: center !important;
//     gap: 8px !important;
//     backdrop-filter: blur(10px) !important;
//     border: 2px solid rgba(255, 255, 255, 0.1) !important;
//   `;

//   // Hover effects
//   saveBtn.addEventListener('mouseenter', () => {
//     saveBtn.style.transform = 'translateY(-2px) scale(1.02)';
//     saveBtn.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.4)';
//   });

//   saveBtn.addEventListener('mouseleave', () => {
//     saveBtn.style.transform = 'translateY(0) scale(1)';
//     saveBtn.style.boxShadow = '0 4px 12px rgba(255, 107, 53, 0.3)';
//   });

//   // Click handler with better error handling
//   saveBtn.addEventListener('click', async (e) => {
//     e.preventDefault();
//     e.stopPropagation();
    
//     // Disable button during save
//     saveBtn.style.pointerEvents = 'none';
//     saveBtn.innerHTML = '⏳ Saving...';
    
//     try {
//       const postData = extractPostData();
      
//       if (!postData) {
//         throw new Error('Could not extract post data from this page');
//       }

//       // Get existing saved posts
//       const result = await chrome.storage.local.get(['savedPosts']);
//       const savedPosts = result.savedPosts || [];

//       // Check if already saved
//       const existingPost = savedPosts.find(post => post.id === postData.id || post.url === postData.url);
//       if (existingPost) {
//         showNotification('Post already saved!', 'info');
//         return;
//       }

//       // Add new post
//       savedPosts.unshift(postData);
      
//       // Keep only last 200 posts to avoid storage issues
//       if (savedPosts.length > 200) {
//         savedPosts.splice(200);
//       }

//       // Save to storage with error handling
//       await chrome.storage.local.set({ savedPosts: savedPosts });
      
//       showNotification(`Post saved! (${savedPosts.length} total)`, 'success');
      
//       // Success animation
//       saveBtn.innerHTML = '✅ Saved!';
//       saveBtn.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
      
//       setTimeout(() => {
//         saveBtn.innerHTML = '💾 Save Post';
//         saveBtn.style.background = 'linear-gradient(135deg, #ff6b35, #f7931e)';
//       }, 3000);

//     } catch (error) {
//       console.error('Error saving post:', error);
//       showNotification(`Error: ${error.message}`, 'error');
      
//       // Error animation
//       saveBtn.innerHTML = '❌ Error';
//       saveBtn.style.background = 'linear-gradient(135deg, #dc3545, #c82333)';
      
//       setTimeout(() => {
//         saveBtn.innerHTML = '💾 Save Post';
//         saveBtn.style.background = 'linear-gradient(135deg, #ff6b35, #f7931e)';
//       }, 3000);
      
//     } finally {
//       // Re-enable button
//       setTimeout(() => {
//         saveBtn.style.pointerEvents = 'auto';
//       }, 1000);
//     }
//   });

//   // Add button to page
//   document.body.appendChild(saveBtn);
  
//   // Ensure button stays on top
//   setTimeout(() => {
//     saveBtn.style.zIndex = '999999';
//   }, 100);
// }

// // Show notification
// function showNotification(message, type = 'info') {
//   const notification = document.createElement('div');
//   notification.style.cssText = `
//     position: fixed;
//     top: 80px;
//     right: 20px;
//     z-index: 10001;
//     padding: 12px 20px;
//     border-radius: 6px;
//     color: white;
//     font-weight: 600;
//     font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
//     font-size: 13px;
//     box-shadow: 0 4px 12px rgba(0,0,0,0.15);
//     transition: all 0.3s ease;
//     transform: translateX(400px);
//   `;

//   // Set background based on type
//   const backgrounds = {
//     success: '#28a745',
//     error: '#dc3545',
//     info: '#17a2b8'
//   };
//   notification.style.background = backgrounds[type] || backgrounds.info;
//   notification.textContent = message;

//   document.body.appendChild(notification);

//   // Animate in
//   setTimeout(() => {
//     notification.style.transform = 'translateX(0)';
//   }, 100);

//   // Animate out and remove
//   setTimeout(() => {
//     notification.style.transform = 'translateX(400px)';
//     setTimeout(() => {
//       if (notification.parentNode) {
//         notification.parentNode.removeChild(notification);
//       }
//     }, 300);
//   }, 3000);
// }

// // Initialize with better page detection and retry logic
// function init() {
//   console.log('LeetCode Saver: Initializing...');
  
//   // Wait for page to be ready
//   const initWithRetry = () => {
//     if (isValidDiscussionPage()) {
//       console.log('LeetCode Saver: Valid page detected');
//       // Add save button with delay to ensure page elements are loaded
//       setTimeout(() => {
//         addSaveButton();
//         console.log('LeetCode Saver: Save button added');
//       }, 2000);
      
//       // Set up navigation watcher for SPA behavior
//       setupNavigationWatcher();
//     } else {
//       console.log('LeetCode Saver: Not a discussion page');
//     }
//   };

//   // Try multiple times in case page is still loading
//   initWithRetry();
//   setTimeout(initWithRetry, 3000);
//   setTimeout(initWithRetry, 6000);
// }

// // Better navigation watcher for SPA
// function setupNavigationWatcher() {
//   let lastUrl = location.href;
//   let observer = null;
  
//   // Clean up existing observer
//   if (observer) {
//     observer.disconnect();
//   }
  
//   observer = new MutationObserver((mutations) => {
//     const url = location.href;
//     if (url !== lastUrl) {
//       lastUrl = url;
//       console.log('LeetCode Saver: Navigation detected to', url);
      
//       if (isValidDiscussionPage()) {
//         // Delay to let new page content load
//         setTimeout(() => {
//           addSaveButton();
//           console.log('LeetCode Saver: Save button re-added after navigation');
//         }, 2000);
//       }
//     }
//   });
  
//   observer.observe(document, { 
//     subtree: true, 
//     childList: true,
//     attributes: false // Reduce noise
//   });
  
//   console.log('LeetCode Saver: Navigation watcher setup complete');
// }

// // More comprehensive page validation
// function isValidDiscussionPage() {
//   const url = window.location.href;
//   const isLeetCode = url.includes('leetcode.com');
//   const isDiscussion = url.includes('/discuss/') || 
//                       url.includes('/problems/') ||
//                       url.includes('/explore/');
  
//   // Also check for discussion-specific elements in DOM
//   const hasDiscussionElements = !!(
//     document.querySelector('[data-cy="post-content"]') ||
//     document.querySelector('.discuss-markdown-container') ||
//     document.querySelector('[class*="discuss"]') ||
//     document.querySelector('[class*="topic"]') ||
//     document.querySelector('[data-cy="post-title"]')
//   );
  
//   const isValid = isLeetCode && (isDiscussion || hasDiscussionElements);
//   console.log('LeetCode Saver: Page validation -', { url, isLeetCode, isDiscussion, hasDiscussionElements, isValid });
  
//   return isValid;
// }

// // Listen for messages from popup
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === 'getCurrentPageData') {
//     const postData = extractPostData();
//     sendResponse({ 
//       isValidPage: isValidDiscussionPage(),
//       postData: postData 
//     });
//   }
//   return true;
// });

// // Start the extension
// if (document.readyState === 'loading') {
//   document.addEventListener('DOMContentLoaded', init);
// } else {
//   init();
// }


// // Content script for LeetCode Discussion Saver
// console.log('LeetCode Discussion Saver loaded');

// // Function to extract discussion post data with robust selectors
// function extractPostData() {
//   const url = window.location.href;
  
//   // Check if we're on a discussion page
//   if (!url.includes('leetcode.com') || (!url.includes('/discuss/') && !url.includes('/problems/'))) {
//     return null;
//   }

//   let postData = {};
  
//   try {
//     // Extract problem title with multiple fallbacks
//     const problemTitleSelectors = [
//       '[data-cy="question-title"]',
//       'h1[data-cy*="title"]',
//       'a[href*="/problems/"] h1',
//       '.question-title',
//       '.css-v3d350',
//       'h1:first-of-type',
//       'title'
//     ];
    
//     const problemTitleElement = findElementBySelectors(problemTitleSelectors);
//     if (problemTitleElement) {
//       postData.problemTitle = problemTitleElement.textContent.trim();
//     }

//     // Extract discussion title with multiple fallbacks
//     const discussionTitleSelectors = [
//       '[data-cy="post-title"]',
//       '.discuss-topic-title',
//       'h1[class*="title"]',
//       '.css-1et7jxh',
//       '[class*="discuss"] h1',
//       '[class*="topic"] h1',
//       'h2',
//       'h3'
//     ];

//     const discussionTitleElement = findElementBySelectors(discussionTitleSelectors);
//     if (discussionTitleElement) {
//       postData.discussionTitle = discussionTitleElement.textContent.trim();
//     }

//     // Extract author info with multiple fallbacks
//     const authorSelectors = [
//       '[data-cy="username"]',
//       '.username',
//       '.css-1ewh0ns',
//       '[class*="username"]',
//       '[class*="author"]',
//       'a[href*="/u/"]',
//       'span[class*="user"]'
//     ];
    
//     const authorElement = findElementBySelectors(authorSelectors);
//     if (authorElement) {
//       postData.author = authorElement.textContent.trim();
//     }

//     // Extract post content with multiple fallbacks
//     const contentSelectors = [
//       '[data-cy="post-content"]',
//       '.discuss-markdown-container',
//       '.css-1h8taa7',
//       '[class*="content"]',
//       '[class*="markdown"]',
//       '.discuss-content',
//       'article',
//       '.post-content'
//     ];
    
//     const contentElement = findElementBySelectors(contentSelectors);
//     if (contentElement) {
//       const textContent = contentElement.textContent.trim();
//       postData.contentPreview = textContent.substring(0, 200) + (textContent.length > 200 ? '...' : '');
//     }

//     // Extract tags with multiple fallbacks
//     const tagSelectors = [
//       '.topic-tag',
//       '.tag',
//       '[class*="tag"]',
//       '[class*="badge"]',
//       '.label'
//     ];
    
//     const tagElements = document.querySelectorAll(tagSelectors.join(', '));
//     postData.tags = Array.from(tagElements).map(tag => tag.textContent.trim()).filter(Boolean);

//     // Extract votes with multiple fallbacks
//     const voteSelectors = [
//       '[data-cy="vote-count"]',
//       '.vote-count',
//       '[class*="vote"]',
//       '[class*="score"]',
//       '.upvote',
//       '.likes'
//     ];
    
//     const voteElement = findElementBySelectors(voteSelectors);
//     if (voteElement) {
//       postData.votes = voteElement.textContent.trim();
//     }

//     // Add metadata
//     postData.url = url;
//     postData.savedAt = new Date().toISOString();
//     postData.domain = 'leetcode.com';
//     postData.pageTitle = document.title;

//     // Generate a unique ID for this post
//     postData.id = btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);

//     console.log('Extracted post data:', postData);
//     return postData;
    
//   } catch (error) {
//     console.error('Error extracting post data:', error);
//     // Fallback with basic data
//     return {
//       url: url,
//       title: document.title,
//       savedAt: new Date().toISOString(),
//       domain: 'leetcode.com',
//       id: btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16),
//       error: 'Could not extract full post data'
//     };
//   }
// }

// // Helper function to find element by multiple selectors
// function findElementBySelectors(selectors) {
//   for (const selector of selectors) {
//     try {
//       const element = document.querySelector(selector);
//       if (element && element.textContent.trim()) {
//         return element;
//       }
//     } catch (e) {
//       // Skip invalid selectors
//       continue;
//     }
//   }
//   return null;
// }

// // Add save button with better positioning and error handling
// function addSaveButton() {
//   // Remove existing button if present
//   const existingBtn = document.getElementById('leetcode-saver-btn');
//   if (existingBtn) {
//     existingBtn.remove();
//   }

//   // Create save button with better styling
//   const saveBtn = document.createElement('button');
//   saveBtn.id = 'leetcode-saver-btn';
//   saveBtn.innerHTML = '💾 Save Post';
//   saveBtn.style.cssText = `
//     position: fixed !important;
//     top: 20px !important;
//     right: 20px !important;
//     z-index: 999999 !important;
//     background: linear-gradient(135deg, #ff6b35, #f7931e) !important;
//     color: white !important;
//     border: none !important;
//     padding: 12px 18px !important;
//     border-radius: 8px !important;
//     font-weight: 600 !important;
//     cursor: pointer !important;
//     box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3) !important;
//     transition: all 0.2s ease !important;
//     font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
//     font-size: 14px !important;
//     text-decoration: none !important;
//     display: flex !important;
//     align-items: center !important;
//     gap: 8px !important;
//     backdrop-filter: blur(10px) !important;
//     border: 2px solid rgba(255, 255, 255, 0.1) !important;
//   `;

//   // Hover effects
//   saveBtn.addEventListener('mouseenter', () => {
//     saveBtn.style.transform = 'translateY(-2px) scale(1.02)';
//     saveBtn.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.4)';
//   });

//   saveBtn.addEventListener('mouseleave', () => {
//     saveBtn.style.transform = 'translateY(0) scale(1)';
//     saveBtn.style.boxShadow = '0 4px 12px rgba(255, 107, 53, 0.3)';
//   });

//   // Click handler with better error handling
//   saveBtn.addEventListener('click', async (e) => {
//     e.preventDefault();
//     e.stopPropagation();
    
//     // Disable button during save
//     saveBtn.style.pointerEvents = 'none';
//     saveBtn.innerHTML = '⏳ Saving...';
    
//     try {
//       const postData = extractPostData();
      
//       if (!postData) {
//         throw new Error('Could not extract post data from this page');
//       }

//       // Get existing saved posts
//       const result = await chrome.storage.local.get(['savedPosts']);
//       const savedPosts = result.savedPosts || [];

//       // Check if already saved
//       const existingPost = savedPosts.find(post => post.id === postData.id || post.url === postData.url);
//       if (existingPost) {
//         showNotification('Post already saved!', 'info');
//         return;
//       }

//       // Add new post
//       savedPosts.unshift(postData);
      
//       // Keep only last 200 posts to avoid storage issues
//       if (savedPosts.length > 200) {
//         savedPosts.splice(200);
//       }

//       // Save to storage with error handling
//       await chrome.storage.local.set({ savedPosts: savedPosts });
      
//       showNotification(`Post saved! (${savedPosts.length} total)`, 'success');
      
//       // Success animation
//       saveBtn.innerHTML = '✅ Saved!';
//       saveBtn.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
      
//       setTimeout(() => {
//         saveBtn.innerHTML = '💾 Save Post';
//         saveBtn.style.background = 'linear-gradient(135deg, #ff6b35, #f7931e)';
//       }, 3000);

//     } catch (error) {
//       console.error('Error saving post:', error);
//       showNotification(`Error: ${error.message}`, 'error');
      
//       // Error animation
//       saveBtn.innerHTML = '❌ Error';
//       saveBtn.style.background = 'linear-gradient(135deg, #dc3545, #c82333)';
      
//       setTimeout(() => {
//         saveBtn.innerHTML = '💾 Save Post';
//         saveBtn.style.background = 'linear-gradient(135deg, #ff6b35, #f7931e)';
//       }, 3000);
      
//     } finally {
//       // Re-enable button
//       setTimeout(() => {
//         saveBtn.style.pointerEvents = 'auto';
//       }, 1000);
//     }
//   });

//   // Add button to page
//   document.body.appendChild(saveBtn);
  
//   // Ensure button stays on top
//   setTimeout(() => {
//     saveBtn.style.zIndex = '999999';
//   }, 100);
// }

// // Show notification
// function showNotification(message, type = 'info') {
//   const notification = document.createElement('div');
//   notification.style.cssText = `
//     position: fixed;
//     top: 80px;
//     right: 20px;
//     z-index: 10001;
//     padding: 12px 20px;
//     border-radius: 6px;
//     color: white;
//     font-weight: 600;
//     font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
//     font-size: 13px;
//     box-shadow: 0 4px 12px rgba(0,0,0,0.15);
//     transition: all 0.3s ease;
//     transform: translateX(400px);
//   `;

//   // Set background based on type
//   const backgrounds = {
//     success: '#28a745',
//     error: '#dc3545',
//     info: '#17a2b8'
//   };
//   notification.style.background = backgrounds[type] || backgrounds.info;
//   notification.textContent = message;

//   document.body.appendChild(notification);

//   // Animate in
//   setTimeout(() => {
//     notification.style.transform = 'translateX(0)';
//   }, 100);

//   // Animate out and remove
//   setTimeout(() => {
//     notification.style.transform = 'translateX(400px)';
//     setTimeout(() => {
//       if (notification.parentNode) {
//         notification.parentNode.removeChild(notification);
//       }
//     }, 300);
//   }, 3000);
// }

// // Initialize with better page detection and retry logic
// function init() {
//   console.log('LeetCode Saver: Initializing...');
  
//   // Wait for page to be ready
//   const initWithRetry = () => {
//     if (isValidDiscussionPage()) {
//       console.log('LeetCode Saver: Valid page detected');
//       // Add save button with delay to ensure page elements are loaded
//       setTimeout(() => {
//         addSaveButton();
//         console.log('LeetCode Saver: Save button added');
//       }, 2000);
      
//       // Set up navigation watcher for SPA behavior
//       setupNavigationWatcher();
//     } else {
//       console.log('LeetCode Saver: Not a discussion page');
//     }
//   };

//   // Try multiple times in case page is still loading
//   initWithRetry();
//   setTimeout(initWithRetry, 3000);
//   setTimeout(initWithRetry, 6000);
// }

// // Better navigation watcher for SPA
// function setupNavigationWatcher() {
//   let lastUrl = location.href;
//   let observer = null;
  
//   // Clean up existing observer
//   if (observer) {
//     observer.disconnect();
//   }
  
//   observer = new MutationObserver((mutations) => {
//     const url = location.href;
//     if (url !== lastUrl) {
//       lastUrl = url;
//       console.log('LeetCode Saver: Navigation detected to', url);
      
//       if (isValidDiscussionPage()) {
//         // Delay to let new page content load
//         setTimeout(() => {
//           addSaveButton();
//           console.log('LeetCode Saver: Save button re-added after navigation');
//         }, 2000);
//       }
//     }
//   });
  
//   observer.observe(document, { 
//     subtree: true, 
//     childList: true,
//     attributes: false // Reduce noise
//   });
  
//   console.log('LeetCode Saver: Navigation watcher setup complete');
// }

// // More comprehensive page validation
// function isValidDiscussionPage() {
//   const url = window.location.href;
//   const isLeetCode = url.includes('leetcode.com');
//   const isDiscussion = url.includes('/discuss/') || 
//                       url.includes('/problems/') ||
//                       url.includes('/explore/');
  
//   // Also check for discussion-specific elements in DOM
//   const hasDiscussionElements = !!(
//     document.querySelector('[data-cy="post-content"]') ||
//     document.querySelector('.discuss-markdown-container') ||
//     document.querySelector('[class*="discuss"]') ||
//     document.querySelector('[class*="topic"]') ||
//     document.querySelector('[data-cy="post-title"]')
//   );
  
//   const isValid = isLeetCode && (isDiscussion || hasDiscussionElements);
//   console.log('LeetCode Saver: Page validation -', { url, isLeetCode, isDiscussion, hasDiscussionElements, isValid });
  
//   return isValid;
// }

// // Listen for messages from popup
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === 'getCurrentPageData') {
//     const postData = extractPostData();
//     sendResponse({ 
//       isValidPage: isValidDiscussionPage(),
//       postData: postData 
//     });
//   }
//   return true;
// });

// // Start the extension
// if (document.readyState === 'loading') {
//   document.addEventListener('DOMContentLoaded', init);
// } else {
//   init();
// }

// // Content script for LeetCode Discussion Saver
// console.log('LeetCode Discussion Saver loaded');

// // Function to extract discussion post data
// function extractPostData() {
//   const url = window.location.href;
  
//   // Check if we're on a discussion page
//   if (!url.includes('leetcode.com') || (!url.includes('/discuss/') && !url.includes('/problems/'))) {
//     return null;
//   }

//   let postData = {};
  
//   try {
//     // Extract problem title if on problem discussion
//     const problemTitleElement = document.querySelector('[data-cy="question-title"]') || 
//                                document.querySelector('.css-v3d350') ||
//                                document.querySelector('h1');
    
//     if (problemTitleElement) {
//       postData.problemTitle = problemTitleElement.textContent.trim();
//     }

//     // Extract discussion title
//     const discussionTitleElement = document.querySelector('[data-cy="post-title"]') ||
//                                   document.querySelector('.discuss-topic-title') ||
//                                   document.querySelector('h1[class*="title"]') ||
//                                   document.querySelector('.css-1et7jxh') ||
//                                   document.querySelector('h3');

//     if (discussionTitleElement) {
//       postData.discussionTitle = discussionTitleElement.textContent.trim();
//     }

//     // Extract author info
//     const authorElement = document.querySelector('[data-cy="username"]') ||
//                          document.querySelector('.username') ||
//                          document.querySelector('.css-1ewh0ns') ||
//                          document.querySelector('[class*="username"]');
    
//     if (authorElement) {
//       postData.author = authorElement.textContent.trim();
//     }

//     // Extract post content preview (first 200 chars)
//     const contentElement = document.querySelector('[data-cy="post-content"]') ||
//                           document.querySelector('.discuss-markdown-container') ||
//                           document.querySelector('.css-1h8taa7') ||
//                           document.querySelector('[class*="content"]');
    
//     if (contentElement) {
//       const textContent = contentElement.textContent.trim();
//       postData.contentPreview = textContent.substring(0, 200) + (textContent.length > 200 ? '...' : '');
//     }

//     // Extract tags/topics
//     const tagElements = document.querySelectorAll('.topic-tag, .tag, [class*="tag"]');
//     postData.tags = Array.from(tagElements).map(tag => tag.textContent.trim()).filter(Boolean);

//     // Extract upvotes/likes if available
//     const voteElement = document.querySelector('[data-cy="vote-count"]') ||
//                        document.querySelector('.vote-count') ||
//                        document.querySelector('[class*="vote"]');
    
//     if (voteElement) {
//       postData.votes = voteElement.textContent.trim();
//     }

//     // Add metadata
//     postData.url = url;
//     postData.savedAt = new Date().toISOString();
//     postData.domain = 'leetcode.com';

//     // Generate a unique ID for this post
//     postData.id = btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);

//     return postData;
//   } catch (error) {
//     console.error('Error extracting post data:', error);
//     return {
//       url: url,
//       title: document.title,
//       savedAt: new Date().toISOString(),
//       error: 'Could not extract full post data'
//     };
//   }
// }

// // Add save button to the page
// function addSaveButton() {
//   // Remove existing button if present
//   const existingBtn = document.getElementById('leetcode-saver-btn');
//   if (existingBtn) {
//     existingBtn.remove();
//   }

//   // Find a good place to insert the button
//   const targetSelectors = [
//     '[data-cy="post-actions"]',
//     '.discuss-actions',
//     '.css-1h8taa7',
//     '.discuss-topic-header',
//     'h1'
//   ];

//   let targetElement = null;
//   for (const selector of targetSelectors) {
//     targetElement = document.querySelector(selector);
//     if (targetElement) break;
//   }

//   if (!targetElement) {
//     // Fallback: add to top of page
//     targetElement = document.body;
//   }

//   // Create save button
//   const saveBtn = document.createElement('button');
//   saveBtn.id = 'leetcode-saver-btn';
//   saveBtn.textContent = '💾 Save Post';
//   saveBtn.style.cssText = `
//     position: fixed;
//     top: 20px;
//     right: 20px;
//     z-index: 10000;
//     background: linear-gradient(135deg, #ff6b35, #f7931e);
//     color: white;
//     border: none;
//     padding: 10px 15px;
//     border-radius: 6px;
//     font-weight: 600;
//     cursor: pointer;
//     box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
//     transition: all 0.2s ease;
//     font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
//     font-size: 13px;
//   `;

//   saveBtn.addEventListener('mouseenter', () => {
//     saveBtn.style.transform = 'translateY(-1px)';
//     saveBtn.style.boxShadow = '0 4px 12px rgba(255, 107, 53, 0.4)';
//   });

//   saveBtn.addEventListener('mouseleave', () => {
//     saveBtn.style.transform = 'translateY(0)';
//     saveBtn.style.boxShadow = '0 2px 8px rgba(255, 107, 53, 0.3)';
//   });

//   saveBtn.addEventListener('click', async () => {
//     const postData = extractPostData();
//     if (postData) {
//       try {
//         // Get existing saved posts
//         const result = await chrome.storage.local.get(['savedPosts']);
//         const savedPosts = result.savedPosts || [];

//         // Check if already saved
//         const existingPost = savedPosts.find(post => post.id === postData.id);
//         if (existingPost) {
//           showNotification('Post already saved!', 'info');
//           return;
//         }

//         // Add new post
//         savedPosts.unshift(postData);
        
//         // Keep only last 100 posts to avoid storage issues
//         if (savedPosts.length > 100) {
//           savedPosts.splice(100);
//         }

//         // Save to storage
//         await chrome.storage.local.set({ savedPosts: savedPosts });
        
//         showNotification('Post saved successfully!', 'success');
        
//         // Update button temporarily
//         const originalText = saveBtn.textContent;
//         saveBtn.textContent = '✅ Saved!';
//         saveBtn.style.background = '#28a745';
//         setTimeout(() => {
//           saveBtn.textContent = originalText;
//           saveBtn.style.background = 'linear-gradient(135deg, #ff6b35, #f7931e)';
//         }, 2000);

//       } catch (error) {
//         console.error('Error saving post:', error);
//         showNotification('Error saving post', 'error');
//       }
//     } else {
//       showNotification('Could not extract post data', 'error');
//     }
//   });

//   // Add button to page
//   document.body.appendChild(saveBtn);
// }

// // Show notification
// function showNotification(message, type = 'info') {
//   const notification = document.createElement('div');
//   notification.style.cssText = `
//     position: fixed;
//     top: 80px;
//     right: 20px;
//     z-index: 10001;
//     padding: 12px 20px;
//     border-radius: 6px;
//     color: white;
//     font-weight: 600;
//     font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
//     font-size: 13px;
//     box-shadow: 0 4px 12px rgba(0,0,0,0.15);
//     transition: all 0.3s ease;
//     transform: translateX(400px);
//   `;

//   // Set background based on type
//   const backgrounds = {
//     success: '#28a745',
//     error: '#dc3545',
//     info: '#17a2b8'
//   };
//   notification.style.background = backgrounds[type] || backgrounds.info;
//   notification.textContent = message;

//   document.body.appendChild(notification);

//   // Animate in
//   setTimeout(() => {
//     notification.style.transform = 'translateX(0)';
//   }, 100);

//   // Animate out and remove
//   setTimeout(() => {
//     notification.style.transform = 'translateX(400px)';
//     setTimeout(() => {
//       if (notification.parentNode) {
//         notification.parentNode.removeChild(notification);
//       }
//     }, 300);
//   }, 3000);
// }

// // Check if we're on a valid LeetCode discussion page
// function isValidDiscussionPage() {
//   const url = window.location.href;
//   return url.includes('leetcode.com') && 
//          (url.includes('/discuss/') || url.includes('/problems/'));
// }

// // Initialize when page loads
// function init() {
//   if (isValidDiscussionPage()) {
//     // Add save button after a short delay to ensure page elements are loaded
//     setTimeout(addSaveButton, 1000);
    
//     // Also add button when navigating (for SPA behavior)
//     let lastUrl = location.href;
//     new MutationObserver(() => {
//       const url = location.href;
//       if (url !== lastUrl) {
//         lastUrl = url;
//         if (isValidDiscussionPage()) {
//           setTimeout(addSaveButton, 1000);
//         }
//       }
//     }).observe(document, { subtree: true, childList: true });
//   }
// }

// // Listen for messages from popup
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === 'getCurrentPageData') {
//     const postData = extractPostData();
//     sendResponse({ 
//       isValidPage: isValidDiscussionPage(),
//       postData: postData 
//     });
//   }
//   return true;
// });

// // Start the extension
// if (document.readyState === 'loading') {
//   document.addEventListener('DOMContentLoaded', init);
// } else {
//   init();
// }