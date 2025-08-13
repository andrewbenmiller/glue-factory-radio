// Upload test page JavaScript - External file to comply with CSP
console.log('External script loaded');

// Simple function test
function simpleTest() {
    alert('Simple function called!');
}

// DOM ready test
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else {
    initPage();
}

function initPage() {
    console.log('Page initialized');
    
    // Update debug info
    document.getElementById('pageLoadTime').textContent = new Date().toLocaleString();
    document.getElementById('jsStatus').textContent = '✅ JavaScript is running';
    
    // Setup test button event listeners
    const testAlertBtn = document.getElementById('testAlertBtn');
    if (testAlertBtn) {
        testAlertBtn.addEventListener('click', function() {
            alert('JavaScript Alert Test!');
        });
    }
    
    const testConsoleBtn = document.getElementById('testConsoleBtn');
    if (testConsoleBtn) {
        testConsoleBtn.addEventListener('click', function() {
            console.log('Console log is working!');
            document.getElementById('buttonTest').textContent = '✅ Console working - ' + new Date().toLocaleTimeString();
        });
    }
    
    const testButtonBtn = document.getElementById('testButtonBtn');
    if (testButtonBtn) {
        testButtonBtn.addEventListener('click', function() {
            const btn = document.getElementById('uploadBtn');
            if (btn) {
                btn.style.background = '#28a745';
                btn.textContent = 'Button Found!';
                document.getElementById('buttonTest').textContent = '✅ Button found and modified';
            } else {
                document.getElementById('buttonTest').textContent = '❌ Button not found';
            }
        });
    }
    
    // Test upload endpoint
    fetch('/api/upload/files')
        .then(response => {
            if (response.ok) {
                document.getElementById('endpointStatus').textContent = '✅ Upload API accessible';
            } else {
                document.getElementById('endpointStatus').textContent = '⚠️ Upload API status: ' + response.status;
            }
        })
        .catch(error => {
            document.getElementById('endpointStatus').textContent = '❌ Upload API error: ' + error.message;
        });
    
    // Setup upload button
    const uploadBtn = document.getElementById('uploadBtn');
    if (uploadBtn) {
        document.getElementById('buttonTest').textContent = '✅ Upload button found';
        uploadBtn.style.border = '3px solid green';
        
        uploadBtn.addEventListener('click', function() {
            alert('Upload button clicked!');
            
            const title = document.getElementById('title').value;
            const description = document.getElementById('description').value;
            const audioFile = document.getElementById('audio').files[0];
            
            if (!title) {
                alert('Please enter a title');
                return;
            }
            
            if (!audioFile) {
                alert('Please select an audio file');
                return;
            }
            
            // Show upload starting
            const resultDiv = document.getElementById('result');
            resultDiv.style.display = 'block';
            resultDiv.className = 'result';
            resultDiv.innerHTML = 'Starting upload...';
            
            // Create form data
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            formData.append('audio', audioFile);
            
            // Upload file
            fetch('/api/upload/audio', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    resultDiv.className = 'result error';
                    resultDiv.innerHTML = `<h3>❌ Upload Failed</h3><p>${data.error}</p>`;
                } else {
                    resultDiv.className = 'result success';
                    resultDiv.innerHTML = `
                        <h3>✅ Upload Successful!</h3>
                        <p><strong>Title:</strong> ${data.show.title}</p>
                        <p><strong>Filename:</strong> ${data.file.filename}</p>
                        <p><strong>Size:</strong> ${(data.file.size / 1024 / 1024).toFixed(2)} MB</p>
                        <p><strong>URL:</strong> <a href="${data.file.url}" target="_blank">${data.file.url}</a></p>
                    `;
                }
            })
            .catch(error => {
                resultDiv.className = 'result error';
                resultDiv.innerHTML = `<h3>❌ Upload Error</h3><p>${error.message}</p>`;
            });
        });
        
    } else {
        document.getElementById('buttonTest').textContent = '❌ Upload button not found';
    }
}

console.log('External script finished loading');
