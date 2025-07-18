// Popup script for LeetCode Discussion Saver

document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  await checkCurrentPage();
  await loadSavedPosts();
  setupEventListeners();
});

// Load and display statistics
async function loadStats() {
  try {
    const result = await chrome.storage.local.get(['savedPosts']);
    const savedPosts = result.savedPosts || [];
    
    // Total saved posts
    document.getElementById('totalSaved').textContent = savedPosts.length;
    
    // Posts saved this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const thisWeekCount = savedPosts.filter(post => 
      new Date(post.savedAt) > oneWeekAgo
    ).length;
    
    document.getElementById('thisWeek').textContent = thisWeekCount;
    
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Check if current page is a LeetCode discussion
async function checkCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes('leetcode.com')) {
      updateCurrentPageUI(false, null);
      return;
    }

    // Send message to content script to get page data
    chrome.tabs.sendMessage(tab.id, { action: 'getCurrentPageData' }, (response) => {
      if (chrome.runtime.lastError) {
        updateCurrentPageUI(false, null);
        return;
      }
      
      if (response && response.isValidPage) {
        updateCurrentPageUI(true, response.postData);
      } else {
        updateCurrentPageUI(false, null);
      }
    });
    
  } catch (error) {
    console.error('Error checking current page:', error);
    updateCurrentPageUI(false, null);
  }
}

// Update current page UI
function updateCurrentPageUI(isValid, postData) {
  const pageInfo = document.getElementById('pageInfo');
  const saveBtn = document.getElementById('saveBtn');
  
  if (isValid && postData) {
    let info = '';
    if (postData.problemTitle) {
      info += `Problem: ${postData.problemTitle}\n`;
    }
    if (postData.discussionTitle) {
      info += `Discussion: ${postData.discussionTitle}\n`;
    }
    if (postData.author) {
      info += `By: ${postData.author}`;
    }
    
    pageInfo.textContent = info || 'LeetCode discussion page detected';
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save This Post';
  } else {
    pageInfo.textContent = 'Not on a LeetCode discussion page';
    saveBtn.disabled = true;
    saveBtn.textContent = 'Navigate to a discussion post';
  }
}

// Load and display saved posts
async function loadSavedPosts() {
  try {
    const result = await chrome.storage.local.get(['savedPosts']);
    const savedPosts = result.savedPosts || [];
    
    const container = document.getElementById('savedPosts');
    
    if (savedPosts.length === 0) {
      container.innerHTML = '<div class="empty-state">No saved posts yet</div>';
      return;
    }
    
    container.innerHTML = '';
    
    // Show only recent 5 posts in popup
    const recentPosts = savedPosts.slice(0, 5);
    
    recentPosts.forEach(post => {
      const postElement = createPostElement(post);
      container.appendChild(postElement);
    });
    
  } catch (error) {
    console.error('Error loading saved posts:', error);
  }
}

// Create a post element
function createPostElement(post) {
  const div = document.createElement('div');
  div.className = 'saved-post';
  
  const title = post.discussionTitle || post.problemTitle || 'Untitled Post';
  const timeAgo = getTimeAgo(new Date(post.savedAt));
  
  div.innerHTML = `
    <div class="post-title">${truncateText(title, 60)}</div>
    <div class="post-meta">
      <span>${post.author || 'Unknown'}</span>
      <span>${timeAgo}</span>
    </div>
    <div class="post-actions">
      <button class="post-action-btn view-btn" title="Open Post">🔗 View</button>
      <button class="post-action-btn pdf-btn" title="Download as PDF">📄 PDF</button>
    </div>
  `;
  
  // View button - opens the post
  div.querySelector('.view-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.tabs.create({ url: post.url });
  });
  
  // PDF button - downloads the page as PDF
  div.querySelector('.pdf-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    downloadPostAsPDF(post);
  });
  
  return div;
}

// Utility function to get time ago
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return 'Just now';
}

// Utility function to truncate text
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Setup event listeners
function setupEventListeners() {
  // Save button
  document.getElementById('saveBtn').addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      chrome.tabs.sendMessage(tab.id, { action: 'getCurrentPageData' }, async (response) => {
        if (response && response.postData) {
          await savePost(response.postData);
        }
      });
      
    } catch (error) {
      console.error('Error saving post:', error);
    }
  });
  
  // Export JSON button
  document.getElementById('exportBtn').addEventListener('click', exportPosts);
  
  // Export PDF button
  document.getElementById('exportPdfBtn').addEventListener('click', exportPostsAsPDF);
  
  // Clear all button
  document.getElementById('clearBtn').addEventListener('click', clearAllPosts);
}

// Save a post
async function savePost(postData) {
  try {
    // Validate post data
    if (!postData || !postData.url) {
      throw new Error('Invalid post data');
    }

    const result = await chrome.storage.local.get(['savedPosts']);
    const savedPosts = result.savedPosts || [];
    
    // Check if already saved (check both ID and URL)
    const existingPost = savedPosts.find(post => 
      post.id === postData.id || 
      post.url === postData.url
    );
    
    if (existingPost) {
      showPopupNotification('Post already saved!', 'info');
      return;
    }
    
    // Add timestamp if missing
    if (!postData.savedAt) {
      postData.savedAt = new Date().toISOString();
    }
    
    // Add new post
    savedPosts.unshift(postData);
    
    // Keep only last 200 posts to avoid storage issues
    if (savedPosts.length > 200) {
      savedPosts.splice(200);
    }
    
    await chrome.storage.local.set({ savedPosts: savedPosts });
    
    // Refresh UI
    await loadStats();
    await loadSavedPosts();
    
    // Show success feedback
    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '✅ Saved!';
    saveBtn.style.background = '#28a745';
    
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.background = '#ff6b35';
    }, 2000);
    
    showPopupNotification(`Post saved! (${savedPosts.length} total)`, 'success');
    
  } catch (error) {
    console.error('Error saving post:', error);
    showPopupNotification(`Error: ${error.message}`, 'error');
  }
}

// Export posts to JSON
async function exportPosts() {
  try {
    const result = await chrome.storage.local.get(['savedPosts']);
    const savedPosts = result.savedPosts || [];
    
    if (savedPosts.length === 0) {
      showPopupNotification('No posts to export', 'info');
      return;
    }
    
    const dataStr = JSON.stringify(savedPosts, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `leetcode-saved-posts-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    
    showPopupNotification(`Exported ${savedPosts.length} posts as JSON`, 'success');
    
  } catch (error) {
    console.error('Error exporting posts:', error);
    showPopupNotification('Error exporting posts', 'error');
  }
}

// Export posts as PDF
async function exportPostsAsPDF() {
  try {
    const result = await chrome.storage.local.get(['savedPosts']);
    const savedPosts = result.savedPosts || [];
    
    if (savedPosts.length === 0) {
      showPopupNotification('No posts to export', 'info');
      return;
    }
    
    // Create HTML content for PDF
    const htmlContent = generatePDFHTML(savedPosts);
    
    // Create a blob and download as HTML file
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `leetcode-saved-posts-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    
    showPopupNotification(`Downloaded HTML with ${savedPosts.length} posts. Open and print to PDF!`, 'success');
    
  } catch (error) {
    console.error('Error exporting PDF:', error);
    showPopupNotification('Error generating PDF export', 'error');
  }
}

// Generate HTML content for PDF export
function generatePDFHTML(posts) {
  const currentDate = new Date().toLocaleDateString();
  
  let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>LeetCode Saved Posts - ${currentDate}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: white;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #ff6b35;
        }
        
        .header h1 {
            color: #ff6b35;
            margin: 0 0 10px 0;
            font-size: 28px;
        }
        
        .header p {
            color: #666;
            margin: 0;
            font-size: 14px;
        }
        
        .stats {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
            text-align: center;
        }
        
        .post {
            background: white;
            border: 1px solid #e1e5e9;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            page-break-inside: avoid;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .post-header {
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #f0f0f0;
        }
        
        .post-title {
            font-size: 18px;
            font-weight: 600;
            color: #1a1a1a;
            margin: 0 0 8px 0;
            line-height: 1.3;
        }
        
        .post-meta {
            font-size: 12px;
            color: #666;
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .post-content {
            margin: 15px 0;
            font-size: 14px;
            line-height: 1.6;
            color: #444;
        }
        
        .post-url {
            margin-top: 15px;
            font-size: 11px;
            color: #007acc;
            word-break: break-all;
            font-family: monospace;
            background: #f8f9fa;
            padding: 8px;
            border-radius: 4px;
        }
        
        .footer {
            margin-top: 40px;
            text-align: center;
            color: #666;
            font-size: 12px;
            border-top: 1px solid #e1e5e9;
            padding-top: 20px;
        }
        
        @media print {
            body { margin: 0; }
            .post { 
                page-break-inside: avoid;
                margin-bottom: 15px;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📚 LeetCode Saved Posts</h1>
        <p>Exported on ${currentDate}</p>
    </div>
    
    <div class="stats">
        <strong>${posts.length} Total Posts Saved</strong>
    </div>
`;

  posts.forEach((post) => {
    const savedDate = new Date(post.savedAt).toLocaleDateString();
    const savedTime = new Date(post.savedAt).toLocaleTimeString();
    
    html += `
    <div class="post">
        <div class="post-header">
            <h2 class="post-title">
                ${post.discussionTitle || post.problemTitle || 'Untitled Post'}
            </h2>
            <div class="post-meta">
                <span>👤 ${post.author || 'Unknown Author'}</span>
                <span>📅 ${savedDate}</span>
                <span>🕒 ${savedTime}</span>
                ${post.votes ? `<span>👍 ${post.votes}</span>` : ''}
            </div>
        </div>
        
        ${post.problemTitle && post.discussionTitle ? 
          `<div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 13px;">
             <strong>Problem:</strong> ${post.problemTitle}
           </div>` : ''
        }
        
        ${post.contentPreview ? 
          `<div class="post-content">
             <strong>Content Preview:</strong><br>
             ${post.contentPreview}
           </div>` : ''
        }
        
        <div class="post-url">
            🔗 <strong>URL:</strong> ${post.url}
        </div>
    </div>
    `;
  });

  html += `
    <div class="footer">
        Generated by LeetCode Discussion Saver Extension<br>
        <em>Keep learning and saving great discussions! 🚀</em>
    </div>
    
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
                alert('To save as PDF: Press Ctrl+P (or Cmd+P), then choose "Save as PDF"');
            }, 500);
        });
    </script>
</body>
</html>
  `;

  return html;
}

// Download individual post as PDF (actual PDF conversion)
async function downloadPostAsPDF(post) {
  try {
    showPopupNotification('Converting to PDF...', 'info');
    
    // Create a hidden tab to capture the content
    chrome.tabs.create({ url: post.url, active: false }, (tab) => {
      // Wait for page to load, then convert to PDF
      setTimeout(() => {
        // Use Chrome DevTools Protocol to print to PDF
        chrome.debugger.attach({ tabId: tab.id }, "1.0", () => {
          if (chrome.runtime.lastError) {
            console.error('Debugger attach failed:', chrome.runtime.lastError);
            fallbackPrintMethod(tab.id, post);
            return;
          }
          
          // Send print to PDF command
          chrome.debugger.sendCommand({ tabId: tab.id }, "Page.printToPDF", {
            format: "A4",
            printBackground: true,
            marginTop: 0.4,
            marginBottom: 0.4,
            marginLeft: 0.4,
            marginRight: 0.4,
            landscape: false,
            displayHeaderFooter: false,
            preferCSSPageSize: false
          }, (result) => {
            chrome.debugger.detach({ tabId: tab.id });
            
            if (chrome.runtime.lastError || !result) {
              console.error('PDF generation failed:', chrome.runtime.lastError);
              fallbackPrintMethod(tab.id, post);
              return;
            }
            
            // Convert base64 to blob and download
            const pdfData = result.data;
            const byteCharacters = atob(pdfData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            
            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            const title = post.discussionTitle || post.problemTitle || 'leetcode-discussion';
            const cleanTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-').substring(0, 50);
            a.download = `${cleanTitle}-${Date.now()}.pdf`;
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Close the tab
            chrome.tabs.remove(tab.id);
            
            showPopupNotification('PDF downloaded successfully!', 'success');
          });
        });
      }, 4000); // Wait 4 seconds for page load
    });
    
  } catch (error) {
    console.error('Error converting to PDF:', error);
    showPopupNotification('Error converting to PDF', 'error');
  }
}

// Fallback method if debugger fails
function fallbackPrintMethod(tabId, post) {
  chrome.tabs.update(tabId, { active: true }, () => {
    chrome.tabs.executeScript(tabId, {
      code: `
        // Clean up page for better PDF
        const unwantedSelectors = [
          'nav:not([class*="discuss"])', 
          'header:not([class*="discuss"])', 
          '.navbar', '.header', '.sidebar', '.ad', '.advertisement',
          '[class*="nav"]:not([class*="discuss"])',
          '[class*="header"]:not([class*="discuss"])',
          '.sticky:not([class*="discuss"])'
        ];
        
        unwantedSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            if (!el.closest('[class*="discuss"]') && !el.closest('main')) {
              el.style.display = 'none';
            }
          });
        });
        
        // Add print styles
        const style = document.createElement('style');
        style.textContent = \`
          @media print {
            * { -webkit-print-color-adjust: exact !important; }
            body { margin: 0 !important; background: white !important; }
          }
        \`;
        document.head.appendChild(style);
        
        // Auto print
        setTimeout(() => {
          window.print();
          alert('In the print dialog:\\n1. Choose "Save as PDF"\\n2. Pick location and save\\n3. Close this tab');
        }, 1000);
      `
    }, () => {
      if (chrome.runtime.lastError) {
        showPopupNotification('Error: Please manually save as PDF', 'error');
      } else {
        showPopupNotification('Print dialog opened - choose "Save as PDF"', 'info');
      }
    });
  });
}
async function clearAllPosts() {
  if (!confirm('Are you sure you want to delete all saved posts? This cannot be undone.')) {
    return;
  }
  
  try {
    await chrome.storage.local.remove(['savedPosts']);
    
    // Refresh UI
    await loadStats();
    await loadSavedPosts();
    
    showPopupNotification('All posts cleared', 'success');
    
  } catch (error) {
    console.error('Error clearing posts:', error);
    showPopupNotification('Error clearing posts', 'error');
  }
}

// Show popup notification
function showPopupNotification(message, type = 'info') {
  // Remove existing notification
  const existing = document.querySelector('.popup-notification');
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement('div');
  notification.className = 'popup-notification';
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    left: 20px;
    right: 20px;
    padding: 10px 15px;
    border-radius: 6px;
    color: white;
    font-weight: 600;
    font-size: 12px;
    z-index: 10000;
    text-align: center;
    transition: all 0.3s ease;
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

  // Remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }, 3000);
}// // Popup script for LeetCode Discussion Saver

// document.addEventListener('DOMContentLoaded', async () => {
//   await loadStats();
//   await checkCurrentPage();
//   await loadSavedPosts();
//   setupEventListeners();
// });

// // Load and display statistics
// async function loadStats() {
//   try {
//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     // Total saved posts
//     document.getElementById('totalSaved').textContent = savedPosts.length;
    
//     // Posts saved this week
//     const oneWeekAgo = new Date();
//     oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
//     const thisWeekCount = savedPosts.filter(post => 
//       new Date(post.savedAt) > oneWeekAgo
//     ).length;
    
//     document.getElementById('thisWeek').textContent = thisWeekCount;
    
//   } catch (error) {
//     console.error('Error loading stats:', error);
//   }
// }

// // Check if current page is a LeetCode discussion
// async function checkCurrentPage() {
//   try {
//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
//     if (!tab.url.includes('leetcode.com')) {
//       updateCurrentPageUI(false, null);
//       return;
//     }

//     // Send message to content script to get page data
//     chrome.tabs.sendMessage(tab.id, { action: 'getCurrentPageData' }, (response) => {
//       if (chrome.runtime.lastError) {
//         updateCurrentPageUI(false, null);
//         return;
//       }
      
//       if (response && response.isValidPage) {
//         updateCurrentPageUI(true, response.postData);
//       } else {
//         updateCurrentPageUI(false, null);
//       }
//     });
    
//   } catch (error) {
//     console.error('Error checking current page:', error);
//     updateCurrentPageUI(false, null);
//   }
// }

// // Update current page UI
// function updateCurrentPageUI(isValid, postData) {
//   const pageInfo = document.getElementById('pageInfo');
//   const saveBtn = document.getElementById('saveBtn');
  
//   if (isValid && postData) {
//     let info = '';
//     if (postData.problemTitle) {
//       info += `Problem: ${postData.problemTitle}\n`;
//     }
//     if (postData.discussionTitle) {
//       info += `Discussion: ${postData.discussionTitle}\n`;
//     }
//     if (postData.author) {
//       info += `By: ${postData.author}`;
//     }
    
//     pageInfo.textContent = info || 'LeetCode discussion page detected';
//     saveBtn.disabled = false;
//     saveBtn.textContent = 'Save This Post';
//   } else {
//     pageInfo.textContent = 'Not on a LeetCode discussion page';
//     saveBtn.disabled = true;
//     saveBtn.textContent = 'Navigate to a discussion post';
//   }
// }

// // Load and display saved posts
// async function loadSavedPosts() {
//   try {
//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     const container = document.getElementById('savedPosts');
    
//     if (savedPosts.length === 0) {
//       container.innerHTML = '<div class="empty-state">No saved posts yet</div>';
//       return;
//     }
    
//     container.innerHTML = '';
    
//     // Show only recent 5 posts in popup
//     const recentPosts = savedPosts.slice(0, 5);
    
//     recentPosts.forEach(post => {
//       const postElement = createPostElement(post);
//       container.appendChild(postElement);
//     });
    
//   } catch (error) {
//     console.error('Error loading saved posts:', error);
//   }
// }

// // Create a post element
// function createPostElement(post) {
//   const div = document.createElement('div');
//   div.className = 'saved-post';
  
//   const title = post.discussionTitle || post.problemTitle || 'Untitled Post';
//   const timeAgo = getTimeAgo(new Date(post.savedAt));
  
//   div.innerHTML = `
//     <div class="post-title">${truncateText(title, 60)}</div>
//     <div class="post-meta">
//       <span>${post.author || 'Unknown'}</span>
//       <span>${timeAgo}</span>
//     </div>
//     <div class="post-actions">
//       <button class="post-action-btn view-btn" title="Open Post">🔗 View</button>
//       <button class="post-action-btn pdf-btn" title="Download as PDF">📄 PDF</button>
//     </div>
//   `;
  
//   // View button - opens the post
//   div.querySelector('.view-btn').addEventListener('click', (e) => {
//     e.stopPropagation();
//     chrome.tabs.create({ url: post.url });
//   });
  
//   // PDF button - downloads the page as PDF
//   div.querySelector('.pdf-btn').addEventListener('click', (e) => {
//     e.stopPropagation();
//     downloadPostAsPDF(post);
//   });
  
//   return div;
// }

// // Utility function to get time ago
// function getTimeAgo(date) {
//   const now = new Date();
//   const diffMs = now - date;
//   const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
//   const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
//   const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
//   if (diffDays > 0) return `${diffDays}d ago`;
//   if (diffHours > 0) return `${diffHours}h ago`;
//   if (diffMinutes > 0) return `${diffMinutes}m ago`;
//   return 'Just now';
// }

// // Utility function to truncate text
// function truncateText(text, maxLength) {
//   if (text.length <= maxLength) return text;
//   return text.substring(0, maxLength) + '...';
// }

// // Setup event listeners
// function setupEventListeners() {
//   // Save button
//   document.getElementById('saveBtn').addEventListener('click', async () => {
//     try {
//       const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
//       chrome.tabs.sendMessage(tab.id, { action: 'getCurrentPageData' }, async (response) => {
//         if (response && response.postData) {
//           await savePost(response.postData);
//         }
//       });
      
//     } catch (error) {
//       console.error('Error saving post:', error);
//     }
//   });
  
//   // Export JSON button
//   document.getElementById('exportBtn').addEventListener('click', exportPosts);
  
//   // Export PDF button
//   document.getElementById('exportPdfBtn').addEventListener('click', exportPostsAsPDF);
  
//   // Clear all button
//   document.getElementById('clearBtn').addEventListener('click', clearAllPosts);
// }

// // Save a post
// async function savePost(postData) {
//   try {
//     // Validate post data
//     if (!postData || !postData.url) {
//       throw new Error('Invalid post data');
//     }

//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     // Check if already saved (check both ID and URL)
//     const existingPost = savedPosts.find(post => 
//       post.id === postData.id || 
//       post.url === postData.url
//     );
    
//     if (existingPost) {
//       showPopupNotification('Post already saved!', 'info');
//       return;
//     }
    
//     // Add timestamp if missing
//     if (!postData.savedAt) {
//       postData.savedAt = new Date().toISOString();
//     }
    
//     // Add new post
//     savedPosts.unshift(postData);
    
//     // Keep only last 200 posts to avoid storage issues
//     if (savedPosts.length > 200) {
//       savedPosts.splice(200);
//     }
    
//     await chrome.storage.local.set({ savedPosts: savedPosts });
    
//     // Refresh UI
//     await loadStats();
//     await loadSavedPosts();
    
//     // Show success feedback
//     const saveBtn = document.getElementById('saveBtn');
//     const originalText = saveBtn.textContent;
//     saveBtn.textContent = '✅ Saved!';
//     saveBtn.style.background = '#28a745';
    
//     setTimeout(() => {
//       saveBtn.textContent = originalText;
//       saveBtn.style.background = '#ff6b35';
//     }, 2000);
    
//     showPopupNotification(`Post saved! (${savedPosts.length} total)`, 'success');
    
//   } catch (error) {
//     console.error('Error saving post:', error);
//     showPopupNotification(`Error: ${error.message}`, 'error');
//   }
// }

// // Export posts to JSON
// async function exportPosts() {
//   try {
//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     if (savedPosts.length === 0) {
//       showPopupNotification('No posts to export', 'info');
//       return;
//     }
    
//     const dataStr = JSON.stringify(savedPosts, null, 2);
//     const dataBlob = new Blob([dataStr], { type: 'application/json' });
//     const url = URL.createObjectURL(dataBlob);
    
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `leetcode-saved-posts-${new Date().toISOString().split('T')[0]}.json`;
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
    
//     URL.revokeObjectURL(url);
    
//     showPopupNotification(`Exported ${savedPosts.length} posts as JSON`, 'success');
    
//   } catch (error) {
//     console.error('Error exporting posts:', error);
//     showPopupNotification('Error exporting posts', 'error');
//   }
// }

// // Export posts as PDF
// async function exportPostsAsPDF() {
//   try {
//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     if (savedPosts.length === 0) {
//       showPopupNotification('No posts to export', 'info');
//       return;
//     }
    
//     // Create HTML content for PDF
//     const htmlContent = generatePDFHTML(savedPosts);
    
//     // Create a blob and download as HTML file
//     const blob = new Blob([htmlContent], { type: 'text/html' });
//     const url = URL.createObjectURL(blob);
    
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `leetcode-saved-posts-${new Date().toISOString().split('T')[0]}.html`;
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
    
//     URL.revokeObjectURL(url);
    
//     showPopupNotification(`Downloaded HTML with ${savedPosts.length} posts. Open and print to PDF!`, 'success');
    
//   } catch (error) {
//     console.error('Error exporting PDF:', error);
//     showPopupNotification('Error generating PDF export', 'error');
//   }
// }

// // Generate HTML content for PDF export
// function generatePDFHTML(posts) {
//   const currentDate = new Date().toLocaleDateString();
  
//   let html = `
// <!DOCTYPE html>
// <html>
// <head>
//     <meta charset="UTF-8">
//     <title>LeetCode Saved Posts - ${currentDate}</title>
//     <style>
//         body {
//             font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
//             line-height: 1.6;
//             color: #333;
//             max-width: 800px;
//             margin: 0 auto;
//             padding: 20px;
//             background: white;
//         }
        
//         .header {
//             text-align: center;
//             margin-bottom: 40px;
//             padding-bottom: 20px;
//             border-bottom: 3px solid #ff6b35;
//         }
        
//         .header h1 {
//             color: #ff6b35;
//             margin: 0 0 10px 0;
//             font-size: 28px;
//         }
        
//         .header p {
//             color: #666;
//             margin: 0;
//             font-size: 14px;
//         }
        
//         .stats {
//             background: #f8f9fa;
//             padding: 15px;
//             border-radius: 8px;
//             margin-bottom: 30px;
//             text-align: center;
//         }
        
//         .post {
//             background: white;
//             border: 1px solid #e1e5e9;
//             border-radius: 8px;
//             padding: 20px;
//             margin-bottom: 20px;
//             page-break-inside: avoid;
//             box-shadow: 0 1px 3px rgba(0,0,0,0.1);
//         }
        
//         .post-header {
//             margin-bottom: 15px;
//             padding-bottom: 10px;
//             border-bottom: 1px solid #f0f0f0;
//         }
        
//         .post-title {
//             font-size: 18px;
//             font-weight: 600;
//             color: #1a1a1a;
//             margin: 0 0 8px 0;
//             line-height: 1.3;
//         }
        
//         .post-meta {
//             font-size: 12px;
//             color: #666;
//             display: flex;
//             flex-wrap: wrap;
//             gap: 15px;
//         }
        
//         .post-content {
//             margin: 15px 0;
//             font-size: 14px;
//             line-height: 1.6;
//             color: #444;
//         }
        
//         .post-url {
//             margin-top: 15px;
//             font-size: 11px;
//             color: #007acc;
//             word-break: break-all;
//             font-family: monospace;
//             background: #f8f9fa;
//             padding: 8px;
//             border-radius: 4px;
//         }
        
//         .footer {
//             margin-top: 40px;
//             text-align: center;
//             color: #666;
//             font-size: 12px;
//             border-top: 1px solid #e1e5e9;
//             padding-top: 20px;
//         }
        
//         @media print {
//             body { margin: 0; }
//             .post { 
//                 page-break-inside: avoid;
//                 margin-bottom: 15px;
//             }
//         }
//     </style>
// </head>
// <body>
//     <div class="header">
//         <h1>📚 LeetCode Saved Posts</h1>
//         <p>Exported on ${currentDate}</p>
//     </div>
    
//     <div class="stats">
//         <strong>${posts.length} Total Posts Saved</strong>
//     </div>
// `;

//   posts.forEach((post) => {
//     const savedDate = new Date(post.savedAt).toLocaleDateString();
//     const savedTime = new Date(post.savedAt).toLocaleTimeString();
    
//     html += `
//     <div class="post">
//         <div class="post-header">
//             <h2 class="post-title">
//                 ${post.discussionTitle || post.problemTitle || 'Untitled Post'}
//             </h2>
//             <div class="post-meta">
//                 <span>👤 ${post.author || 'Unknown Author'}</span>
//                 <span>📅 ${savedDate}</span>
//                 <span>🕒 ${savedTime}</span>
//                 ${post.votes ? `<span>👍 ${post.votes}</span>` : ''}
//             </div>
//         </div>
        
//         ${post.problemTitle && post.discussionTitle ? 
//           `<div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 13px;">
//              <strong>Problem:</strong> ${post.problemTitle}
//            </div>` : ''
//         }
        
//         ${post.contentPreview ? 
//           `<div class="post-content">
//              <strong>Content Preview:</strong><br>
//              ${post.contentPreview}
//            </div>` : ''
//         }
        
//         <div class="post-url">
//             🔗 <strong>URL:</strong> ${post.url}
//         </div>
//     </div>
//     `;
//   });

//   html += `
//     <div class="footer">
//         Generated by LeetCode Discussion Saver Extension<br>
//         <em>Keep learning and saving great discussions! 🚀</em>
//     </div>
    
//     <script>
//         document.addEventListener('DOMContentLoaded', function() {
//             setTimeout(() => {
//                 alert('To save as PDF: Press Ctrl+P (or Cmd+P), then choose "Save as PDF"');
//             }, 500);
//         });
//     </script>
// </body>
// </html>
//   `;

//   return html;
// }

// // Download individual post as PDF (automatic PDF generation)
// async function downloadPostAsPDF(post) {
//   try {
//     showPopupNotification('Opening page for PDF capture...', 'info');
    
//     // Create a new tab to capture the content
//     chrome.tabs.create({ url: post.url }, (tab) => {
//       // Wait for page to load, then inject script for automatic PDF generation
//       setTimeout(() => {
//         chrome.tabs.executeScript(tab.id, {
//           code: `
//             // Wait for all content to load including images
//             setTimeout(() => {
//               // Remove distracting elements for better PDF
//               const elementsToHide = [
//                 'nav', 'header', '.navbar', '.header', 
//                 '[class*="nav"]', '[class*="header"]', 
//                 '.sticky', '[class*="sticky"]',
//                 '.advertisement', '[class*="ad"]',
//                 '.sidebar', '[class*="sidebar"]',
//                 '.footer', 'footer'
//               ];
              
//               elementsToHide.forEach(selector => {
//                 const elements = document.querySelectorAll(selector);
//                 elements.forEach(el => {
//                   if (el && !el.textContent.includes('LeetCode') && !el.closest('[class*="discuss"]')) {
//                     el.style.display = 'none';
//                   }
//                 });
//               });
              
//               // Improve styling for PDF
//               const style = document.createElement('style');
//               style.textContent = \`
//                 @media print {
//                   * { 
//                     -webkit-print-color-adjust: exact !important;
//                     color-adjust: exact !important;
//                   }
//                   body {
//                     margin: 0 !important;
//                     background: white !important;
//                   }
//                   .discuss-topic-title, h1, h2 {
//                     color: #ff6b35 !important;
//                   }
//                   pre, code {
//                     background: #f8f9fa !important;
//                     border: 1px solid #e9ecef !important;
//                   }
//                 }
//               \`;
//               document.head.appendChild(style);
              
//               // Auto-trigger print after everything is ready
//               setTimeout(() => {
//                 window.print();
                
//                 // Show instructions
//                 alert('PDF Generation Instructions:\\n\\n1. In the print dialog, choose "Save as PDF"\\n2. Choose your desired location\\n3. Click Save\\n4. Close this tab when done\\n\\nThe PDF will contain the complete discussion with all formatting and images!');
//               }, 2000);
              
//             }, 3000);
//           `
//         }, () => {
//           if (chrome.runtime.lastError) {
//             console.error('Error injecting PDF script:', chrome.runtime.lastError);
//             showPopupNotification('Error preparing page for PDF', 'error');
//           } else {
//             showPopupNotification('Print dialog will open shortly - choose "Save as PDF"', 'success');
//           }
//         });
//       }, 3000);
//     });
    
//   } catch (error) {
//     console.error('Error generating PDF:', error);
//     showPopupNotification('Error opening page for PDF', 'error');
//   }
// }
// async function clearAllPosts() {
//   if (!confirm('Are you sure you want to delete all saved posts? This cannot be undone.')) {
//     return;
//   }
  
//   try {
//     await chrome.storage.local.remove(['savedPosts']);
    
//     // Refresh UI
//     await loadStats();
//     await loadSavedPosts();
    
//     showPopupNotification('All posts cleared', 'success');
    
//   } catch (error) {
//     console.error('Error clearing posts:', error);
//     showPopupNotification('Error clearing posts', 'error');
//   }
// }

// // Show popup notification
// function showPopupNotification(message, type = 'info') {
//   // Remove existing notification
//   const existing = document.querySelector('.popup-notification');
//   if (existing) {
//     existing.remove();
//   }

//   const notification = document.createElement('div');
//   notification.className = 'popup-notification';
//   notification.style.cssText = `
//     position: fixed;
//     top: 10px;
//     left: 20px;
//     right: 20px;
//     padding: 10px 15px;
//     border-radius: 6px;
//     color: white;
//     font-weight: 600;
//     font-size: 12px;
//     z-index: 10000;
//     text-align: center;
//     transition: all 0.3s ease;
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

//   // Remove after 3 seconds
//   setTimeout(() => {
//     if (notification.parentNode) {
//       notification.style.opacity = '0';
//       setTimeout(() => {
//         if (notification.parentNode) {
//           notification.parentNode.removeChild(notification);
//         }
//       }, 300);
//     }
//   }, 3000);
// }

// // Popup script for LeetCode Discussion Saver

// document.addEventListener('DOMContentLoaded', async () => {
//   await loadStats();
//   await checkCurrentPage();
//   await loadSavedPosts();
//   setupEventListeners();
// });

// // Load and display statistics
// async function loadStats() {
//   try {
//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     // Total saved posts
//     document.getElementById('totalSaved').textContent = savedPosts.length;
    
//     // Posts saved this week
//     const oneWeekAgo = new Date();
//     oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
//     const thisWeekCount = savedPosts.filter(post => 
//       new Date(post.savedAt) > oneWeekAgo
//     ).length;
    
//     document.getElementById('thisWeek').textContent = thisWeekCount;
    
//   } catch (error) {
//     console.error('Error loading stats:', error);
//   }
// }

// // Check if current page is a LeetCode discussion
// async function checkCurrentPage() {
//   try {
//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
//     if (!tab.url.includes('leetcode.com')) {
//       updateCurrentPageUI(false, null);
//       return;
//     }

//     // Send message to content script to get page data
//     chrome.tabs.sendMessage(tab.id, { action: 'getCurrentPageData' }, (response) => {
//       if (chrome.runtime.lastError) {
//         updateCurrentPageUI(false, null);
//         return;
//       }
      
//       if (response && response.isValidPage) {
//         updateCurrentPageUI(true, response.postData);
//       } else {
//         updateCurrentPageUI(false, null);
//       }
//     });
    
//   } catch (error) {
//     console.error('Error checking current page:', error);
//     updateCurrentPageUI(false, null);
//   }
// }

// // Update current page UI
// function updateCurrentPageUI(isValid, postData) {
//   const pageInfo = document.getElementById('pageInfo');
//   const saveBtn = document.getElementById('saveBtn');
  
//   if (isValid && postData) {
//     let info = '';
//     if (postData.problemTitle) {
//       info += `Problem: ${postData.problemTitle}\n`;
//     }
//     if (postData.discussionTitle) {
//       info += `Discussion: ${postData.discussionTitle}\n`;
//     }
//     if (postData.author) {
//       info += `By: ${postData.author}`;
//     }
    
//     pageInfo.textContent = info || 'LeetCode discussion page detected';
//     saveBtn.disabled = false;
//     saveBtn.textContent = 'Save This Post';
//   } else {
//     pageInfo.textContent = 'Not on a LeetCode discussion page';
//     saveBtn.disabled = true;
//     saveBtn.textContent = 'Navigate to a discussion post';
//   }
// }

// // Load and display saved posts
// async function loadSavedPosts() {
//   try {
//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     const container = document.getElementById('savedPosts');
    
//     if (savedPosts.length === 0) {
//       container.innerHTML = '<div class="empty-state">No saved posts yet</div>';
//       return;
//     }
    
//     container.innerHTML = '';
    
//     // Show only recent 5 posts in popup
//     const recentPosts = savedPosts.slice(0, 5);
    
//     recentPosts.forEach(post => {
//       const postElement = createPostElement(post);
//       container.appendChild(postElement);
//     });
    
//   } catch (error) {
//     console.error('Error loading saved posts:', error);
//   }
// }

// // Create a post element
// function createPostElement(post) {
//   const div = document.createElement('div');
//   div.className = 'saved-post';
  
//   const title = post.discussionTitle || post.problemTitle || 'Untitled Post';
//   const timeAgo = getTimeAgo(new Date(post.savedAt));
  
//   div.innerHTML = `
//     <div class="post-title">${truncateText(title, 60)}</div>
//     <div class="post-meta">
//       <span>${post.author || 'Unknown'}</span>
//       <span>${timeAgo}</span>
//     </div>
//     <div class="post-actions">
//       <button class="post-action-btn view-btn" title="Open Post">🔗 View</button>
//       <button class="post-action-btn pdf-btn" title="Download as PDF">📄 PDF</button>
//     </div>
//   `;
  
//   // View button - opens the post
//   div.querySelector('.view-btn').addEventListener('click', (e) => {
//     e.stopPropagation();
//     chrome.tabs.create({ url: post.url });
//   });
  
//   // PDF button - downloads the page as PDF
//   div.querySelector('.pdf-btn').addEventListener('click', (e) => {
//     e.stopPropagation();
//     downloadPostAsPDF(post);
//   });
  
//   return div;
// }

// // Utility function to get time ago
// function getTimeAgo(date) {
//   const now = new Date();
//   const diffMs = now - date;
//   const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
//   const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
//   const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
//   if (diffDays > 0) return `${diffDays}d ago`;
//   if (diffHours > 0) return `${diffHours}h ago`;
//   if (diffMinutes > 0) return `${diffMinutes}m ago`;
//   return 'Just now';
// }

// // Utility function to truncate text
// function truncateText(text, maxLength) {
//   if (text.length <= maxLength) return text;
//   return text.substring(0, maxLength) + '...';
// }

// // Setup event listeners
// function setupEventListeners() {
//   // Save button
//   document.getElementById('saveBtn').addEventListener('click', async () => {
//     try {
//       const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
//       chrome.tabs.sendMessage(tab.id, { action: 'getCurrentPageData' }, async (response) => {
//         if (response && response.postData) {
//           await savePost(response.postData);
//         }
//       });
      
//     } catch (error) {
//       console.error('Error saving post:', error);
//     }
//   });
  
//   // Export JSON button
//   document.getElementById('exportBtn').addEventListener('click', exportPosts);
  
//   // Export PDF button
//   document.getElementById('exportPdfBtn').addEventListener('click', exportPostsAsPDF);
  
//   // Clear all button
//   document.getElementById('clearBtn').addEventListener('click', clearAllPosts);
// }

// // Save a post
// async function savePost(postData) {
//   try {
//     // Validate post data
//     if (!postData || !postData.url) {
//       throw new Error('Invalid post data');
//     }

//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     // Check if already saved (check both ID and URL)
//     const existingPost = savedPosts.find(post => 
//       post.id === postData.id || 
//       post.url === postData.url
//     );
    
//     if (existingPost) {
//       showPopupNotification('Post already saved!', 'info');
//       return;
//     }
    
//     // Add timestamp if missing
//     if (!postData.savedAt) {
//       postData.savedAt = new Date().toISOString();
//     }
    
//     // Add new post
//     savedPosts.unshift(postData);
    
//     // Keep only last 200 posts to avoid storage issues
//     if (savedPosts.length > 200) {
//       savedPosts.splice(200);
//     }
    
//     await chrome.storage.local.set({ savedPosts: savedPosts });
    
//     // Refresh UI
//     await loadStats();
//     await loadSavedPosts();
    
//     // Show success feedback
//     const saveBtn = document.getElementById('saveBtn');
//     const originalText = saveBtn.textContent;
//     saveBtn.textContent = '✅ Saved!';
//     saveBtn.style.background = '#28a745';
    
//     setTimeout(() => {
//       saveBtn.textContent = originalText;
//       saveBtn.style.background = '#ff6b35';
//     }, 2000);
    
//     showPopupNotification(`Post saved! (${savedPosts.length} total)`, 'success');
    
//   } catch (error) {
//     console.error('Error saving post:', error);
//     showPopupNotification(`Error: ${error.message}`, 'error');
//   }
// }

// // Export posts to JSON
// async function exportPosts() {
//   try {
//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     if (savedPosts.length === 0) {
//       showPopupNotification('No posts to export', 'info');
//       return;
//     }
    
//     const dataStr = JSON.stringify(savedPosts, null, 2);
//     const dataBlob = new Blob([dataStr], { type: 'application/json' });
//     const url = URL.createObjectURL(dataBlob);
    
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `leetcode-saved-posts-${new Date().toISOString().split('T')[0]}.json`;
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
    
//     URL.revokeObjectURL(url);
    
//     showPopupNotification(`Exported ${savedPosts.length} posts as JSON`, 'success');
    
//   } catch (error) {
//     console.error('Error exporting posts:', error);
//     showPopupNotification('Error exporting posts', 'error');
//   }
// }

// // Export posts as PDF
// async function exportPostsAsPDF() {
//   try {
//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     if (savedPosts.length === 0) {
//       showPopupNotification('No posts to export', 'info');
//       return;
//     }
    
//     // Create HTML content for PDF
//     const htmlContent = generatePDFHTML(savedPosts);
    
//     // Create a blob and download as HTML file
//     const blob = new Blob([htmlContent], { type: 'text/html' });
//     const url = URL.createObjectURL(blob);
    
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `leetcode-saved-posts-${new Date().toISOString().split('T')[0]}.html`;
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
    
//     URL.revokeObjectURL(url);
    
//     showPopupNotification(`Downloaded HTML with ${savedPosts.length} posts. Open and print to PDF!`, 'success');
    
//   } catch (error) {
//     console.error('Error exporting PDF:', error);
//     showPopupNotification('Error generating PDF export', 'error');
//   }
// }

// // Generate HTML content for PDF export
// function generatePDFHTML(posts) {
//   const currentDate = new Date().toLocaleDateString();
  
//   let html = `
// <!DOCTYPE html>
// <html>
// <head>
//     <meta charset="UTF-8">
//     <title>LeetCode Saved Posts - ${currentDate}</title>
//     <style>
//         body {
//             font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
//             line-height: 1.6;
//             color: #333;
//             max-width: 800px;
//             margin: 0 auto;
//             padding: 20px;
//             background: white;
//         }
        
//         .header {
//             text-align: center;
//             margin-bottom: 40px;
//             padding-bottom: 20px;
//             border-bottom: 3px solid #ff6b35;
//         }
        
//         .header h1 {
//             color: #ff6b35;
//             margin: 0 0 10px 0;
//             font-size: 28px;
//         }
        
//         .header p {
//             color: #666;
//             margin: 0;
//             font-size: 14px;
//         }
        
//         .stats {
//             background: #f8f9fa;
//             padding: 15px;
//             border-radius: 8px;
//             margin-bottom: 30px;
//             text-align: center;
//         }
        
//         .post {
//             background: white;
//             border: 1px solid #e1e5e9;
//             border-radius: 8px;
//             padding: 20px;
//             margin-bottom: 20px;
//             page-break-inside: avoid;
//             box-shadow: 0 1px 3px rgba(0,0,0,0.1);
//         }
        
//         .post-header {
//             margin-bottom: 15px;
//             padding-bottom: 10px;
//             border-bottom: 1px solid #f0f0f0;
//         }
        
//         .post-title {
//             font-size: 18px;
//             font-weight: 600;
//             color: #1a1a1a;
//             margin: 0 0 8px 0;
//             line-height: 1.3;
//         }
        
//         .post-meta {
//             font-size: 12px;
//             color: #666;
//             display: flex;
//             flex-wrap: wrap;
//             gap: 15px;
//         }
        
//         .post-content {
//             margin: 15px 0;
//             font-size: 14px;
//             line-height: 1.6;
//             color: #444;
//         }
        
//         .post-url {
//             margin-top: 15px;
//             font-size: 11px;
//             color: #007acc;
//             word-break: break-all;
//             font-family: monospace;
//             background: #f8f9fa;
//             padding: 8px;
//             border-radius: 4px;
//         }
        
//         .footer {
//             margin-top: 40px;
//             text-align: center;
//             color: #666;
//             font-size: 12px;
//             border-top: 1px solid #e1e5e9;
//             padding-top: 20px;
//         }
        
//         @media print {
//             body { margin: 0; }
//             .post { 
//                 page-break-inside: avoid;
//                 margin-bottom: 15px;
//             }
//         }
//     </style>
// </head>
// <body>
//     <div class="header">
//         <h1>📚 LeetCode Saved Posts</h1>
//         <p>Exported on ${currentDate}</p>
//     </div>
    
//     <div class="stats">
//         <strong>${posts.length} Total Posts Saved</strong>
//     </div>
// `;

//   posts.forEach((post) => {
//     const savedDate = new Date(post.savedAt).toLocaleDateString();
//     const savedTime = new Date(post.savedAt).toLocaleTimeString();
    
//     html += `
//     <div class="post">
//         <div class="post-header">
//             <h2 class="post-title">
//                 ${post.discussionTitle || post.problemTitle || 'Untitled Post'}
//             </h2>
//             <div class="post-meta">
//                 <span>👤 ${post.author || 'Unknown Author'}</span>
//                 <span>📅 ${savedDate}</span>
//                 <span>🕒 ${savedTime}</span>
//                 ${post.votes ? `<span>👍 ${post.votes}</span>` : ''}
//             </div>
//         </div>
        
//         ${post.problemTitle && post.discussionTitle ? 
//           `<div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 13px;">
//              <strong>Problem:</strong> ${post.problemTitle}
//            </div>` : ''
//         }
        
//         ${post.contentPreview ? 
//           `<div class="post-content">
//              <strong>Content Preview:</strong><br>
//              ${post.contentPreview}
//            </div>` : ''
//         }
        
//         <div class="post-url">
//             🔗 <strong>URL:</strong> ${post.url}
//         </div>
//     </div>
//     `;
//   });

//   html += `
//     <div class="footer">
//         Generated by LeetCode Discussion Saver Extension<br>
//         <em>Keep learning and saving great discussions! 🚀</em>
//     </div>
    
//     <script>
//         document.addEventListener('DOMContentLoaded', function() {
//             setTimeout(() => {
//                 alert('To save as PDF: Press Ctrl+P (or Cmd+P), then choose "Save as PDF"');
//             }, 500);
//         });
//     </script>
// </body>
// </html>
//   `;

//   return html;
// }

// // Download individual post as PDF
// async function downloadPostAsPDF(post) {
//   try {
//     showPopupNotification('Opening post for PDF download...', 'info');
    
//     // Open the post in a new tab
//     chrome.tabs.create({ url: post.url }, (tab) => {
//       // Wait for page to load, then trigger print
//       setTimeout(() => {
//         chrome.tabs.executeScript(tab.id, {
//           code: `
//             // Auto-trigger print dialog for PDF
//             setTimeout(() => {
//               window.print();
//             }, 2000);
            
//             // Show instructions
//             setTimeout(() => {
//               alert('To save as PDF:\\n\\n1. In print dialog, choose "Save as PDF"\\n2. Choose location and save\\n3. Close this tab when done');
//             }, 1000);
//           `
//         }, () => {
//           if (chrome.runtime.lastError) {
//             console.error('Error injecting script:', chrome.runtime.lastError);
//             showPopupNotification('Error opening page for PDF', 'error');
//           }
//         });
//       }, 3000);
//     });
    
//   } catch (error) {
//     console.error('Error downloading post as PDF:', error);
//     showPopupNotification('Error downloading PDF', 'error');
//   }
// }
// async function clearAllPosts() {
//   if (!confirm('Are you sure you want to delete all saved posts? This cannot be undone.')) {
//     return;
//   }
  
//   try {
//     await chrome.storage.local.remove(['savedPosts']);
    
//     // Refresh UI
//     await loadStats();
//     await loadSavedPosts();
    
//     showPopupNotification('All posts cleared', 'success');
    
//   } catch (error) {
//     console.error('Error clearing posts:', error);
//     showPopupNotification('Error clearing posts', 'error');
//   }
// }

// // Show popup notification
// function showPopupNotification(message, type = 'info') {
//   // Remove existing notification
//   const existing = document.querySelector('.popup-notification');
//   if (existing) {
//     existing.remove();
//   }

//   const notification = document.createElement('div');
//   notification.className = 'popup-notification';
//   notification.style.cssText = `
//     position: fixed;
//     top: 10px;
//     left: 20px;
//     right: 20px;
//     padding: 10px 15px;
//     border-radius: 6px;
//     color: white;
//     font-weight: 600;
//     font-size: 12px;
//     z-index: 10000;
//     text-align: center;
//     transition: all 0.3s ease;
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

//   // Remove after 3 seconds
//   setTimeout(() => {
//     if (notification.parentNode) {
//       notification.style.opacity = '0';
//       setTimeout(() => {
//         if (notification.parentNode) {
//           notification.parentNode.removeChild(notification);
//         }
//       }, 300);
//     }
//   }, 3000);
// }// // Popup script for LeetCode Discussion Saver

// document.addEventListener('DOMContentLoaded', async () => {
//   await loadStats();
//   await checkCurrentPage();
//   await loadSavedPosts();
//   setupEventListeners();
// });

// // Load and display statistics
// async function loadStats() {
//   try {
//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     // Total saved posts
//     document.getElementById('totalSaved').textContent = savedPosts.length;
    
//     // Posts saved this week
//     const oneWeekAgo = new Date();
//     oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
//     const thisWeekCount = savedPosts.filter(post => 
//       new Date(post.savedAt) > oneWeekAgo
//     ).length;
    
//     document.getElementById('thisWeek').textContent = thisWeekCount;
    
//   } catch (error) {
//     console.error('Error loading stats:', error);
//   }
// }

// // Check if current page is a LeetCode discussion
// async function checkCurrentPage() {
//   try {
//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
//     if (!tab.url.includes('leetcode.com')) {
//       updateCurrentPageUI(false, null);
//       return;
//     }

//     // Send message to content script to get page data
//     chrome.tabs.sendMessage(tab.id, { action: 'getCurrentPageData' }, (response) => {
//       if (chrome.runtime.lastError) {
//         updateCurrentPageUI(false, null);
//         return;
//       }
      
//       if (response && response.isValidPage) {
//         updateCurrentPageUI(true, response.postData);
//       } else {
//         updateCurrentPageUI(false, null);
//       }
//     });
    
//   } catch (error) {
//     console.error('Error checking current page:', error);
//     updateCurrentPageUI(false, null);
//   }
// }

// // Update current page UI
// function updateCurrentPageUI(isValid, postData) {
//   const pageInfo = document.getElementById('pageInfo');
//   const saveBtn = document.getElementById('saveBtn');
  
//   if (isValid && postData) {
//     let info = '';
//     if (postData.problemTitle) {
//       info += `Problem: ${postData.problemTitle}\n`;
//     }
//     if (postData.discussionTitle) {
//       info += `Discussion: ${postData.discussionTitle}\n`;
//     }
//     if (postData.author) {
//       info += `By: ${postData.author}`;
//     }
    
//     pageInfo.textContent = info || 'LeetCode discussion page detected';
//     saveBtn.disabled = false;
//     saveBtn.textContent = 'Save This Post';
//   } else {
//     pageInfo.textContent = 'Not on a LeetCode discussion page';
//     saveBtn.disabled = true;
//     saveBtn.textContent = 'Navigate to a discussion post';
//   }
// }

// // Load and display saved posts
// async function loadSavedPosts() {
//   try {
//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     const container = document.getElementById('savedPosts');
    
//     if (savedPosts.length === 0) {
//       container.innerHTML = '<div class="empty-state">No saved posts yet</div>';
//       return;
//     }
    
//     container.innerHTML = '';
    
//     // Show only recent 5 posts in popup
//     const recentPosts = savedPosts.slice(0, 5);
    
//     recentPosts.forEach(post => {
//       const postElement = createPostElement(post);
//       container.appendChild(postElement);
//     });
    
//   } catch (error) {
//     console.error('Error loading saved posts:', error);
//   }
// }

// // Create a post element
// function createPostElement(post) {
//   const div = document.createElement('div');
//   div.className = 'saved-post';
  
//   const title = post.discussionTitle || post.problemTitle || 'Untitled Post';
//   const timeAgo = getTimeAgo(new Date(post.savedAt));
  
//   div.innerHTML = `
//     <div class="post-title">${truncateText(title, 60)}</div>
//     <div class="post-meta">
//       <span>${post.author || 'Unknown'}</span>
//       <span>${timeAgo}</span>
//     </div>
//   `;
  
//   div.addEventListener('click', () => {
//     chrome.tabs.create({ url: post.url });
//   });
  
//   return div;
// }

// // Utility function to get time ago
// function getTimeAgo(date) {
//   const now = new Date();
//   const diffMs = now - date;
//   const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
//   const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
//   const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
//   if (diffDays > 0) return `${diffDays}d ago`;
//   if (diffHours > 0) return `${diffHours}h ago`;
//   if (diffMinutes > 0) return `${diffMinutes}m ago`;
//   return 'Just now';
// }

// // Utility function to truncate text
// function truncateText(text, maxLength) {
//   if (text.length <= maxLength) return text;
//   return text.substring(0, maxLength) + '...';
// }

// // Setup event listeners
// function setupEventListeners() {
//   // Save button
//   document.getElementById('saveBtn').addEventListener('click', async () => {
//     try {
//       const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
//       chrome.tabs.sendMessage(tab.id, { action: 'getCurrentPageData' }, async (response) => {
//         if (response && response.postData) {
//           await savePost(response.postData);
//         }
//       });
      
//     } catch (error) {
//       console.error('Error saving post:', error);
//     }
//   });
  
//   // Export JSON button
//   document.getElementById('exportBtn').addEventListener('click', exportPosts);
  
//   // Export PDF button
//   document.getElementById('exportPdfBtn').addEventListener('click', exportPostsAsPDF);
  
//   // Clear all button
//   document.getElementById('clearBtn').addEventListener('click', clearAllPosts);
// }

// // Save a post
// async function savePost(postData) {
//   try {
//     // Validate post data
//     if (!postData || !postData.url) {
//       throw new Error('Invalid post data');
//     }

//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     // Check if already saved (check both ID and URL)
//     const existingPost = savedPosts.find(post => 
//       post.id === postData.id || 
//       post.url === postData.url
//     );
    
//     if (existingPost) {
//       showPopupNotification('Post already saved!', 'info');
//       return;
//     }
    
//     // Add timestamp if missing
//     if (!postData.savedAt) {
//       postData.savedAt = new Date().toISOString();
//     }
    
//     // Add new post
//     savedPosts.unshift(postData);
    
//     // Keep only last 200 posts to avoid storage issues
//     if (savedPosts.length > 200) {
//       savedPosts.splice(200);
//     }
    
//     await chrome.storage.local.set({ savedPosts: savedPosts });
    
//     // Refresh UI
//     await loadStats();
//     await loadSavedPosts();
    
//     // Show success feedback
//     const saveBtn = document.getElementById('saveBtn');
//     const originalText = saveBtn.textContent;
//     saveBtn.textContent = '✅ Saved!';
//     saveBtn.style.background = '#28a745';
    
//     setTimeout(() => {
//       saveBtn.textContent = originalText;
//       saveBtn.style.background = '#ff6b35';
//     }, 2000);
    
//     showPopupNotification(`Post saved! (${savedPosts.length} total)`, 'success');
    
//   } catch (error) {
//     console.error('Error saving post:', error);
//     showPopupNotification(`Error: ${error.message}`, 'error');
//   }
// }

// // Export posts to JSON
// async function exportPosts() {
//   try {
//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     if (savedPosts.length === 0) {
//       showPopupNotification('No posts to export', 'info');
//       return;
//     }
    
//     const dataStr = JSON.stringify(savedPosts, null, 2);
//     const dataBlob = new Blob([dataStr], { type: 'application/json' });
//     const url = URL.createObjectURL(dataBlob);
    
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `leetcode-saved-posts-${new Date().toISOString().split('T')[0]}.json`;
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
    
//     URL.revokeObjectURL(url);
    
//     showPopupNotification(`Exported ${savedPosts.length} posts as JSON`, 'success');
    
//   } catch (error) {
//     console.error('Error exporting posts:', error);
//     showPopupNotification('Error exporting posts', 'error');
//   }
// }

// // Export posts as PDF
// async function exportPostsAsPDF() {
//   try {
//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     if (savedPosts.length === 0) {
//       showPopupNotification('No posts to export', 'info');
//       return;
//     }
    
//     // Create HTML content for PDF
//     const htmlContent = generatePDFHTML(savedPosts);
    
//     // Create a blob and download as HTML file
//     const blob = new Blob([htmlContent], { type: 'text/html' });
//     const url = URL.createObjectURL(blob);
    
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `leetcode-saved-posts-${new Date().toISOString().split('T')[0]}.html`;
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
    
//     URL.revokeObjectURL(url);
    
//     showPopupNotification(`Downloaded HTML with ${savedPosts.length} posts. Open and print to PDF!`, 'success');
    
//   } catch (error) {
//     console.error('Error exporting PDF:', error);
//     showPopupNotification('Error generating PDF export', 'error');
//   }
// }

// // Generate HTML content for PDF export
// function generatePDFHTML(posts) {
//   const currentDate = new Date().toLocaleDateString();
  
//   let html = `
// <!DOCTYPE html>
// <html>
// <head>
//     <meta charset="UTF-8">
//     <title>LeetCode Saved Posts - ${currentDate}</title>
//     <style>
//         body {
//             font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
//             line-height: 1.6;
//             color: #333;
//             max-width: 800px;
//             margin: 0 auto;
//             padding: 20px;
//             background: white;
//         }
        
//         .header {
//             text-align: center;
//             margin-bottom: 40px;
//             padding-bottom: 20px;
//             border-bottom: 3px solid #ff6b35;
//         }
        
//         .header h1 {
//             color: #ff6b35;
//             margin: 0 0 10px 0;
//             font-size: 28px;
//         }
        
//         .header p {
//             color: #666;
//             margin: 0;
//             font-size: 14px;
//         }
        
//         .stats {
//             background: #f8f9fa;
//             padding: 15px;
//             border-radius: 8px;
//             margin-bottom: 30px;
//             text-align: center;
//         }
        
//         .post {
//             background: white;
//             border: 1px solid #e1e5e9;
//             border-radius: 8px;
//             padding: 20px;
//             margin-bottom: 20px;
//             page-break-inside: avoid;
//             box-shadow: 0 1px 3px rgba(0,0,0,0.1);
//         }
        
//         .post-header {
//             margin-bottom: 15px;
//             padding-bottom: 10px;
//             border-bottom: 1px solid #f0f0f0;
//         }
        
//         .post-title {
//             font-size: 18px;
//             font-weight: 600;
//             color: #1a1a1a;
//             margin: 0 0 8px 0;
//             line-height: 1.3;
//         }
        
//         .post-meta {
//             font-size: 12px;
//             color: #666;
//             display: flex;
//             flex-wrap: wrap;
//             gap: 15px;
//         }
        
//         .post-content {
//             margin: 15px 0;
//             font-size: 14px;
//             line-height: 1.6;
//             color: #444;
//         }
        
//         .post-url {
//             margin-top: 15px;
//             font-size: 11px;
//             color: #007acc;
//             word-break: break-all;
//             font-family: monospace;
//             background: #f8f9fa;
//             padding: 8px;
//             border-radius: 4px;
//         }
        
//         .footer {
//             margin-top: 40px;
//             text-align: center;
//             color: #666;
//             font-size: 12px;
//             border-top: 1px solid #e1e5e9;
//             padding-top: 20px;
//         }
        
//         @media print {
//             body { margin: 0; }
//             .post { 
//                 page-break-inside: avoid;
//                 margin-bottom: 15px;
//             }
//         }
//     </style>
// </head>
// <body>
//     <div class="header">
//         <h1>📚 LeetCode Saved Posts</h1>
//         <p>Exported on ${currentDate}</p>
//     </div>
    
//     <div class="stats">
//         <strong>${posts.length} Total Posts Saved</strong>
//     </div>
// `;

//   posts.forEach((post) => {
//     const savedDate = new Date(post.savedAt).toLocaleDateString();
//     const savedTime = new Date(post.savedAt).toLocaleTimeString();
    
//     html += `
//     <div class="post">
//         <div class="post-header">
//             <h2 class="post-title">
//                 ${post.discussionTitle || post.problemTitle || 'Untitled Post'}
//             </h2>
//             <div class="post-meta">
//                 <span>👤 ${post.author || 'Unknown Author'}</span>
//                 <span>📅 ${savedDate}</span>
//                 <span>🕒 ${savedTime}</span>
//                 ${post.votes ? `<span>👍 ${post.votes}</span>` : ''}
//             </div>
//         </div>
        
//         ${post.problemTitle && post.discussionTitle ? 
//           `<div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 13px;">
//              <strong>Problem:</strong> ${post.problemTitle}
//            </div>` : ''
//         }
        
//         ${post.contentPreview ? 
//           `<div class="post-content">
//              <strong>Content Preview:</strong><br>
//              ${post.contentPreview}
//            </div>` : ''
//         }
        
//         <div class="post-url">
//             🔗 <strong>URL:</strong> ${post.url}
//         </div>
//     </div>
//     `;
//   });

//   html += `
//     <div class="footer">
//         Generated by LeetCode Discussion Saver Extension<br>
//         <em>Keep learning and saving great discussions! 🚀</em>
//     </div>
    
//     <script>
//         document.addEventListener('DOMContentLoaded', function() {
//             setTimeout(() => {
//                 alert('To save as PDF: Press Ctrl+P (or Cmd+P), then choose "Save as PDF"');
//             }, 500);
//         });
//     </script>
// </body>
// </html>
//   `;

//   return html;
// }

// // Clear all saved posts
// async function clearAllPosts() {
//   if (!confirm('Are you sure you want to delete all saved posts? This cannot be undone.')) {
//     return;
//   }
  
//   try {
//     await chrome.storage.local.remove(['savedPosts']);
    
//     // Refresh UI
//     await loadStats();
//     await loadSavedPosts();
    
//     showPopupNotification('All posts cleared', 'success');
    
//   } catch (error) {
//     console.error('Error clearing posts:', error);
//     showPopupNotification('Error clearing posts', 'error');
//   }
// }

// // Show popup notification
// function showPopupNotification(message, type = 'info') {
//   // Remove existing notification
//   const existing = document.querySelector('.popup-notification');
//   if (existing) {
//     existing.remove();
//   }

//   const notification = document.createElement('div');
//   notification.className = 'popup-notification';
//   notification.style.cssText = `
//     position: fixed;
//     top: 10px;
//     left: 20px;
//     right: 20px;
//     padding: 10px 15px;
//     border-radius: 6px;
//     color: white;
//     font-weight: 600;
//     font-size: 12px;
//     z-index: 10000;
//     text-align: center;
//     transition: all 0.3s ease;
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

//   // Remove after 3 seconds
//   setTimeout(() => {
//     if (notification.parentNode) {
//       notification.style.opacity = '0';
//       setTimeout(() => {
//         if (notification.parentNode) {
//           notification.parentNode.removeChild(notification);
//         }
//       }, 300);
//     }
//   }, 3000);
// }

// // Popup script for LeetCode Discussion Saver

// document.addEventListener('DOMContentLoaded', async () => {
//   await loadStats();
//   await checkCurrentPage();
//   await loadSavedPosts();
//   setupEventListeners();
// });

// // Load and display statistics
// async function loadStats() {
//   try {
//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     // Total saved posts
//     document.getElementById('totalSaved').textContent = savedPosts.length;
    
//     // Posts saved this week
//     const oneWeekAgo = new Date();
//     oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
//     const thisWeekCount = savedPosts.filter(post => 
//       new Date(post.savedAt) > oneWeekAgo
//     ).length;
    
//     document.getElementById('thisWeek').textContent = thisWeekCount;
    
//   } catch (error) {
//     console.error('Error loading stats:', error);
//   }
// }

// // Check if current page is a LeetCode discussion
// async function checkCurrentPage() {
//   try {
//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
//     if (!tab.url.includes('leetcode.com')) {
//       updateCurrentPageUI(false, null);
//       return;
//     }

//     // Send message to content script to get page data
//     chrome.tabs.sendMessage(tab.id, { action: 'getCurrentPageData' }, (response) => {
//       if (chrome.runtime.lastError) {
//         updateCurrentPageUI(false, null);
//         return;
//       }
      
//       if (response && response.isValidPage) {
//         updateCurrentPageUI(true, response.postData);
//       } else {
//         updateCurrentPageUI(false, null);
//       }
//     });
    
//   } catch (error) {
//     console.error('Error checking current page:', error);
//     updateCurrentPageUI(false, null);
//   }
// }

// // Update current page UI
// function updateCurrentPageUI(isValid, postData) {
//   const pageInfo = document.getElementById('pageInfo');
//   const saveBtn = document.getElementById('saveBtn');
  
//   if (isValid && postData) {
//     let info = '';
//     if (postData.problemTitle) {
//       info += `Problem: ${postData.problemTitle}\n`;
//     }
//     if (postData.discussionTitle) {
//       info += `Discussion: ${postData.discussionTitle}\n`;
//     }
//     if (postData.author) {
//       info += `By: ${postData.author}`;
//     }
    
//     pageInfo.textContent = info || 'LeetCode discussion page detected';
//     saveBtn.disabled = false;
//     saveBtn.textContent = 'Save This Post';
//   } else {
//     pageInfo.textContent = 'Not on a LeetCode discussion page';
//     saveBtn.disabled = true;
//     saveBtn.textContent = 'Navigate to a discussion post';
//   }
// }

// // Load and display saved posts
// async function loadSavedPosts() {
//   try {
//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     const container = document.getElementById('savedPosts');
    
//     if (savedPosts.length === 0) {
//       container.innerHTML = '<div class="empty-state">No saved posts yet</div>';
//       return;
//     }
    
//     container.innerHTML = '';
    
//     // Show only recent 5 posts in popup
//     const recentPosts = savedPosts.slice(0, 5);
    
//     recentPosts.forEach(post => {
//       const postElement = createPostElement(post);
//       container.appendChild(postElement);
//     });
    
//   } catch (error) {
//     console.error('Error loading saved posts:', error);
//   }
// }

// // Create a post element
// function createPostElement(post) {
//   const div = document.createElement('div');
//   div.className = 'saved-post';
  
//   const title = post.discussionTitle || post.problemTitle || 'Untitled Post';
//   const timeAgo = getTimeAgo(new Date(post.savedAt));
  
//   div.innerHTML = `
//     <div class="post-title">${truncateText(title, 60)}</div>
//     <div class="post-meta">
//       <span>${post.author || 'Unknown'}</span>
//       <span>${timeAgo}</span>
//     </div>
//   `;
  
//   div.addEventListener('click', () => {
//     chrome.tabs.create({ url: post.url });
//   });
  
//   return div;
// }

// // Utility function to get time ago
// function getTimeAgo(date) {
//   const now = new Date();
//   const diffMs = now - date;
//   const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
//   const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
//   const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
//   if (diffDays > 0) return `${diffDays}d ago`;
//   if (diffHours > 0) return `${diffHours}h ago`;
//   if (diffMinutes > 0) return `${diffMinutes}m ago`;
//   return 'Just now';
// }

// // Utility function to truncate text
// function truncateText(text, maxLength) {
//   if (text.length <= maxLength) return text;
//   return text.substring(0, maxLength) + '...';
// }

// // Setup event listeners
// function setupEventListeners() {
//   // Save button
//   document.getElementById('saveBtn').addEventListener('click', async () => {
//     try {
//       const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
//       chrome.tabs.sendMessage(tab.id, { action: 'getCurrentPageData' }, async (response) => {
//         if (response && response.postData) {
//           await savePost(response.postData);
//         }
//       });
      
//     } catch (error) {
//       console.error('Error saving post:', error);
//     }
//   });
  
//   // Export button
//   document.getElementById('exportBtn').addEventListener('click', exportPosts);
  
//   // Clear all button
//   document.getElementById('clearBtn').addEventListener('click', clearAllPosts);
// }

// // Save a post with better error handling
// async function savePost(postData) {
//   try {
//     // Validate post data
//     if (!postData || !postData.url) {
//       throw new Error('Invalid post data');
//     }

//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     // Check if already saved (check both ID and URL)
//     const existingPost = savedPosts.find(post => 
//       post.id === postData.id || 
//       post.url === postData.url
//     );
    
//     if (existingPost) {
//       showPopupNotification('Post already saved!', 'info');
//       return;
//     }
    
//     // Add timestamp if missing
//     if (!postData.savedAt) {
//       postData.savedAt = new Date().toISOString();
//     }
    
//     // Add new post
//     savedPosts.unshift(postData);
    
//     // Keep only last 200 posts to avoid storage issues
//     if (savedPosts.length > 200) {
//       savedPosts.splice(200);
//     }

//     // Calculate storage size (rough estimate)
//     const dataSize = JSON.stringify(savedPosts).length;
//     console.log(`Storage size: ${(dataSize / 1024).toFixed(2)}KB`);
    
//     // Warn if approaching 5MB limit
//     if (dataSize > 4 * 1024 * 1024) { // 4MB warning
//       if (confirm('Storage is getting full. Delete older posts to make room?')) {
//         savedPosts.splice(100); // Keep only 100 most recent
//       }
//     }
    
//     await chrome.storage.local.set({ savedPosts: savedPosts });
    
//     // Refresh UI
//     await loadStats();
//     await loadSavedPosts();
    
//     // Show success feedback
//     const saveBtn = document.getElementById('saveBtn');
//     const originalText = saveBtn.textContent;
//     saveBtn.textContent = '✅ Saved!';
//     saveBtn.style.background = '#28a745';
    
//     setTimeout(() => {
//       saveBtn.textContent = originalText;
//       saveBtn.style.background = '#ff6b35';
//     }, 2000);
    
//     showPopupNotification(`Post saved! (${savedPosts.length} total)`, 'success');
    
//   } catch (error) {
//     console.error('Error saving post:', error);
    
//     // Handle quota exceeded error
//     if (error.message && error.message.includes('QUOTA_EXCEEDED')) {
//       if (confirm('Storage limit reached! Clear some old posts?')) {
//         await clearOldPosts();
//         // Retry saving
//         await savePost(postData);
//       }
//     } else {
//       showPopupNotification(`Error: ${error.message}`, 'error');
//     }
//   }
// }

// // Clear old posts when storage is full
// async function clearOldPosts() {
//   try {
//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     // Keep only most recent 50 posts
//     const recentPosts = savedPosts.slice(0, 50);
//     await chrome.storage.local.set({ savedPosts: recentPosts });
    
//     showPopupNotification(`Cleared ${savedPosts.length - 50} old posts`, 'info');
    
//     // Refresh UI
//     await loadStats();
//     await loadSavedPosts();
    
//   } catch (error) {
//     console.error('Error clearing old posts:', error);
//   }
// }

// // Show popup notification
// function showPopupNotification(message, type = 'info') {
//   // Remove existing notification
//   const existing = document.querySelector('.popup-notification');
//   if (existing) {
//     existing.remove();
//   }

//   const notification = document.createElement('div');
//   notification.className = 'popup-notification';
//   notification.style.cssText = `
//     position: fixed;
//     top: 10px;
//     left: 20px;
//     right: 20px;
//     padding: 10px 15px;
//     border-radius: 6px;
//     color: white;
//     font-weight: 600;
//     font-size: 12px;
//     z-index: 10000;
//     text-align: center;
//     transition: all 0.3s ease;
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

//   // Remove after 3 seconds
//   setTimeout(() => {
//     if (notification.parentNode) {
//       notification.style.opacity = '0';
//       setTimeout(() => {
//         if (notification.parentNode) {
//           notification.parentNode.removeChild(notification);
//         }
//       }, 300);
//     }
//   }, 3000);
// }

// // Export posts to JSON
// async function exportPosts() {
//   try {
//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     if (savedPosts.length === 0) {
//       alert('No posts to export');
//       return;
//     }
    
//     const dataStr = JSON.stringify(savedPosts, null, 2);
//     const dataBlob = new Blob([dataStr], { type: 'application/json' });
//     const url = URL.createObjectURL(dataBlob);
    
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `leetcode-saved-posts-${new Date().toISOString().split('T')[0]}.json`;
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
    
//     URL.revokeObjectURL(url);
    
//   } catch (error) {
//     console.error('Error exporting posts:', error);
//     alert('Error exporting posts');
//   }
// }

// // Clear all saved posts
// async function clearAllPosts() {
//   if (!confirm('Are you sure you want to delete all saved posts? This cannot be undone.')) {
//     return;
//   }
  
//   try {
//     await chrome.storage.local.remove(['savedPosts']);
    
//     // Refresh UI
//     await loadStats();
//     await loadSavedPosts();
    
//   } catch (error) {
//     console.error('Error clearing posts:', error);
//     alert('Error clearing posts');
//   }
// }

// // Popup script for LeetCode Discussion Saver

// document.addEventListener('DOMContentLoaded', async () => {
//   await loadStats();
//   await checkCurrentPage();
//   await loadSavedPosts();
//   setupEventListeners();
// });

// // Load and display statistics
// async function loadStats() {
//   try {
//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     // Total saved posts
//     document.getElementById('totalSaved').textContent = savedPosts.length;
    
//     // Posts saved this week
//     const oneWeekAgo = new Date();
//     oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
//     const thisWeekCount = savedPosts.filter(post => 
//       new Date(post.savedAt) > oneWeekAgo
//     ).length;
    
//     document.getElementById('thisWeek').textContent = thisWeekCount;
    
//   } catch (error) {
//     console.error('Error loading stats:', error);
//   }
// }

// // Check if current page is a LeetCode discussion
// async function checkCurrentPage() {
//   try {
//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
//     if (!tab.url.includes('leetcode.com')) {
//       updateCurrentPageUI(false, null);
//       return;
//     }

//     // Send message to content script to get page data
//     chrome.tabs.sendMessage(tab.id, { action: 'getCurrentPageData' }, (response) => {
//       if (chrome.runtime.lastError) {
//         updateCurrentPageUI(false, null);
//         return;
//       }
      
//       if (response && response.isValidPage) {
//         updateCurrentPageUI(true, response.postData);
//       } else {
//         updateCurrentPageUI(false, null);
//       }
//     });
    
//   } catch (error) {
//     console.error('Error checking current page:', error);
//     updateCurrentPageUI(false, null);
//   }
// }

// // Update current page UI
// function updateCurrentPageUI(isValid, postData) {
//   const pageInfo = document.getElementById('pageInfo');
//   const saveBtn = document.getElementById('saveBtn');
  
//   if (isValid && postData) {
//     let info = '';
//     if (postData.problemTitle) {
//       info += `Problem: ${postData.problemTitle}\n`;
//     }
//     if (postData.discussionTitle) {
//       info += `Discussion: ${postData.discussionTitle}\n`;
//     }
//     if (postData.author) {
//       info += `By: ${postData.author}`;
//     }
    
//     pageInfo.textContent = info || 'LeetCode discussion page detected';
//     saveBtn.disabled = false;
//     saveBtn.textContent = 'Save This Post';
//   } else {
//     pageInfo.textContent = 'Not on a LeetCode discussion page';
//     saveBtn.disabled = true;
//     saveBtn.textContent = 'Navigate to a discussion post';
//   }
// }

// // Load and display saved posts
// async function loadSavedPosts() {
//   try {
//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     const container = document.getElementById('savedPosts');
    
//     if (savedPosts.length === 0) {
//       container.innerHTML = '<div class="empty-state">No saved posts yet</div>';
//       return;
//     }
    
//     container.innerHTML = '';
    
//     // Show only recent 5 posts in popup
//     const recentPosts = savedPosts.slice(0, 5);
    
//     recentPosts.forEach(post => {
//       const postElement = createPostElement(post);
//       container.appendChild(postElement);
//     });
    
//   } catch (error) {
//     console.error('Error loading saved posts:', error);
//   }
// }

// // Create a post element
// function createPostElement(post) {
//   const div = document.createElement('div');
//   div.className = 'saved-post';
  
//   const title = post.discussionTitle || post.problemTitle || 'Untitled Post';
//   const timeAgo = getTimeAgo(new Date(post.savedAt));
  
//   div.innerHTML = `
//     <div class="post-title">${truncateText(title, 60)}</div>
//     <div class="post-meta">
//       <span>${post.author || 'Unknown'}</span>
//       <span>${timeAgo}</span>
//     </div>
//   `;
  
//   div.addEventListener('click', () => {
//     chrome.tabs.create({ url: post.url });
//   });
  
//   return div;
// }

// // Utility function to get time ago
// function getTimeAgo(date) {
//   const now = new Date();
//   const diffMs = now - date;
//   const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
//   const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
//   const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
//   if (diffDays > 0) return `${diffDays}d ago`;
//   if (diffHours > 0) return `${diffHours}h ago`;
//   if (diffMinutes > 0) return `${diffMinutes}m ago`;
//   return 'Just now';
// }

// // Utility function to truncate text
// function truncateText(text, maxLength) {
//   if (text.length <= maxLength) return text;
//   return text.substring(0, maxLength) + '...';
// }

// // Setup event listeners
// function setupEventListeners() {
//   // Save button
//   document.getElementById('saveBtn').addEventListener('click', async () => {
//     try {
//       const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
//       chrome.tabs.sendMessage(tab.id, { action: 'getCurrentPageData' }, async (response) => {
//         if (response && response.postData) {
//           await savePost(response.postData);
//         }
//       });
      
//     } catch (error) {
//       console.error('Error saving post:', error);
//     }
//   });
  
//   // Export button
//   document.getElementById('exportBtn').addEventListener('click', exportPosts);
  
//   // Clear all button
//   document.getElementById('clearBtn').addEventListener('click', clearAllPosts);
// }

// // Save a post
// async function savePost(postData) {
//   try {
//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     // Check if already saved
//     const existingPost = savedPosts.find(post => post.id === postData.id);
//     if (existingPost) {
//       alert('Post already saved!');
//       return;
//     }
    
//     // Add new post
//     savedPosts.unshift(postData);
    
//     // Keep only last 100 posts
//     if (savedPosts.length > 100) {
//       savedPosts.splice(100);
//     }
    
//     await chrome.storage.local.set({ savedPosts: savedPosts });
    
//     // Refresh UI
//     await loadStats();
//     await loadSavedPosts();
    
//     // Show success feedback
//     const saveBtn = document.getElementById('saveBtn');
//     const originalText = saveBtn.textContent;
//     saveBtn.textContent = '✅ Saved!';
//     saveBtn.style.background = '#28a745';
    
//     setTimeout(() => {
//       saveBtn.textContent = originalText;
//       saveBtn.style.background = '#ff6b35';
//     }, 2000);
    
//   } catch (error) {
//     console.error('Error saving post:', error);
//     alert('Error saving post');
//   }
// }

// // Export posts to JSON
// async function exportPosts() {
//   try {
//     const result = await chrome.storage.local.get(['savedPosts']);
//     const savedPosts = result.savedPosts || [];
    
//     if (savedPosts.length === 0) {
//       alert('No posts to export');
//       return;
//     }
    
//     const dataStr = JSON.stringify(savedPosts, null, 2);
//     const dataBlob = new Blob([dataStr], { type: 'application/json' });
//     const url = URL.createObjectURL(dataBlob);
    
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `leetcode-saved-posts-${new Date().toISOString().split('T')[0]}.json`;
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
    
//     URL.revokeObjectURL(url);
    
//   } catch (error) {
//     console.error('Error exporting posts:', error);
//     alert('Error exporting posts');
//   }
// }

// // Clear all saved posts
// async function clearAllPosts() {
//   if (!confirm('Are you sure you want to delete all saved posts? This cannot be undone.')) {
//     return;
//   }
  
//   try {
//     await chrome.storage.local.remove(['savedPosts']);
    
//     // Refresh UI
//     await loadStats();
//     await loadSavedPosts();
    
//   } catch (error) {
//     console.error('Error clearing posts:', error);
//     alert('Error clearing posts');
//   }
// }