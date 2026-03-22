let username = localStorage.getItem('photoApp_username');
const socket = io();

// DOM Elements
const profileModal = document.getElementById('profile-modal');
const usernameInput = document.getElementById('username-input');
const saveProfileBtn = document.getElementById('save-profile-btn');

const galleryGrid = document.getElementById('gallery-grid');
const uploadInput = document.getElementById('upload-input');

const chatSidebar = document.getElementById('chat-sidebar');
const toggleChatBtn = document.getElementById('toggle-chat-btn');
const closeChatBtn = document.getElementById('close-chat-btn');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendMsgBtn = document.getElementById('send-msg-btn');

const viewerModal = document.getElementById('viewer-modal');
const closeViewerBtn = document.getElementById('close-viewer-btn');
const viewerMediaContainer = document.getElementById('viewer-media-container');
const downloadBtn = document.getElementById('download-btn');

const installAppBtn = document.getElementById('install-app-btn');
let deferredPrompt;

// PWA Install Logic
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI to notify the user they can add to home screen
    installAppBtn.style.display = 'inline-block';
});

installAppBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }
        // We've used the prompt, and can't use it again, throw it away
        deferredPrompt = null;
        installAppBtn.style.display = 'none';
    }
});

// Initialization
function init() {
    if (!username) {
        profileModal.classList.add('active');
    } else {
        profileModal.classList.remove('active');
        socket.emit('user_join', { name: username });
        loadMedia();
    }
}

// Profile Handling
saveProfileBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (name) {
        username = name;
        localStorage.setItem('photoApp_username', username);
        profileModal.classList.remove('active');
        socket.emit('user_join', { name: username });
        loadMedia();
    }
});

// Load Media
let currentMediaItems = [];

async function loadMedia() {
    try {
        const res = await fetch('/api/media');
        currentMediaItems = await res.json();
        renderGallery(currentMediaItems);
    } catch (err) {
        console.error('Error fetching media:', err);
    }
}

function renderGallery(mediaItems) {
    galleryGrid.innerHTML = '';
    mediaItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'media-card';
        div.onclick = () => openViewer(item);

        if (item.type === 'video') {
            div.innerHTML = `
                <video src="${item.url}#t=0.1" preload="metadata"></video>
                <div class="play-icon">▶️</div>
            `;
        } else {
            div.innerHTML = `<img src="${item.url}" loading="lazy" alt="${item.name}">`;
        }
        galleryGrid.appendChild(div);
    });
}

// Viewer Modals
function openViewer(item) {
    viewerMediaContainer.innerHTML = '';
    
    if (item.type === 'video') {
        const video = document.createElement('video');
        video.src = item.url;
        video.controls = true;
        video.autoplay = true;
        viewerMediaContainer.appendChild(video);
    } else {
        const img = document.createElement('img');
        img.src = item.url;
        viewerMediaContainer.appendChild(img);
    }
    
    downloadBtn.href = item.url;
    downloadBtn.download = item.name;
    viewerModal.classList.add('active');
}

closeViewerBtn.addEventListener('click', () => {
    viewerModal.classList.remove('active');
    viewerMediaContainer.innerHTML = ''; // stop videos
});

// Upload
uploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('mediaFile', file);

    const prevText = document.querySelector('.upload-btn').innerText;
    document.querySelector('.upload-btn').innerText = 'Subiendo...';

    try {
        await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        // new_media event updates UI via socket
    } catch (err) {
        console.error('Upload failed', err);
        alert('Error al subir el archivo');
    } finally {
        document.querySelector('.upload-btn').innerText = 'Subir Archivo';
        uploadInput.value = ''; // reset
    }
});

// Chat Toggles
toggleChatBtn.addEventListener('click', () => {
    chatSidebar.classList.remove('hidden');
    chatSidebar.style.visibility = 'visible';
    chatSidebar.style.width = '350px';
    chatSidebar.style.position = 'relative'; 
});
closeChatBtn.addEventListener('click', () => {
    chatSidebar.classList.add('hidden');
    chatSidebar.style.position = 'absolute';
});

// Socket Events
socket.on('new_media', (fileObj) => {
    if (fileObj && fileObj.url) {
        currentMediaItems.unshift(fileObj);
        renderGallery(currentMediaItems);
    } else {
        loadMedia(); // fallback
    }
});

socket.on('chat_message', (msg) => {
    appendMessage(msg, false);
});

socket.on('user_joined', (data) => {
    const div = document.createElement('div');
    div.style.textAlign = 'center';
    div.style.fontSize = '0.8rem';
    div.style.opacity = '0.5';
    div.style.marginTop = '0.5rem';
    div.innerText = `${data.name} se unió al chat`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Send Chat Message
function sendMessage() {
    const text = chatInput.value.trim();
    if (text && username) {
        const msg = { sender: username, text: text };
        socket.emit('chat_message', msg);
        appendMessage(msg, true);
        chatInput.value = '';
    }
}

sendMsgBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function appendMessage(msg, isSelf) {
    const div = document.createElement('div');
    div.className = `message ${isSelf ? 'self' : ''}`;
    div.innerHTML = `
        ${!isSelf ? `<div class="message-sender">${msg.sender}</div>` : ''}
        <div class="message-text">${msg.text}</div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Start
init();

// Mobile sidebar default
if (window.innerWidth < 768) {
    chatSidebar.classList.add('hidden');
}
