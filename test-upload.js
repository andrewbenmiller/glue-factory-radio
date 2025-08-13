const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

const API_BASE = 'https://glue-factory-radio-production.up.railway.app';

async function testUpload() {
    console.log('🧪 Testing Glue Factory Radio Upload API...\n');
    
    // Test 1: Health check
    console.log('1️⃣ Testing health endpoint...');
    try {
        const healthResponse = await fetch(`${API_BASE}/api/health`);
        const healthData = await healthResponse.json();
        console.log('✅ Health:', healthData.message);
    } catch (error) {
        console.log('❌ Health check failed:', error.message);
        return;
    }
    
    // Test 2: Check current files
    console.log('\n2️⃣ Checking current files...');
    try {
        const filesResponse = await fetch(`${API_BASE}/api/upload/files`);
        const filesData = await filesResponse.json();
        console.log('📁 Current files:', filesData.length === 0 ? 'No files' : filesData);
    } catch (error) {
        console.log('❌ Files check failed:', error.message);
    }
    
    // Test 3: Check shows
    console.log('\n3️⃣ Checking current shows...');
    try {
        const showsResponse = await fetch(`${API_BASE}/api/shows`);
        const showsData = await showsResponse.json();
        console.log('🎵 Current shows:', showsData.length === 0 ? 'No shows' : showsData);
    } catch (error) {
        console.log('❌ Shows check failed:', error.message);
    }
    
    // Test 4: Check uploads directory
    console.log('\n4️⃣ Checking uploads directory...');
    try {
        const uploadsResponse = await fetch(`${API_BASE}/test-uploads`);
        const uploadsData = await uploadsResponse.json();
        console.log('📂 Uploads directory:', uploadsData.message);
        console.log('   Path:', uploadsData.path);
        console.log('   Files:', uploadsData.files);
    } catch (error) {
        console.log('❌ Uploads directory check failed:', error.message);
    }
    
    console.log('\n🎯 API testing complete!');
    console.log('\n📝 To test actual file upload, you would need:');
    console.log('   - An MP3 file to upload');
    console.log('   - Use: curl -X POST -F "title=Test" -F "description=Test" -F "audio=@yourfile.mp3" ' + API_BASE + '/api/upload/audio');
}

// Run the test
testUpload().catch(console.error);
