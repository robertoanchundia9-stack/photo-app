const socket = io();

// DOM Elements
const profileModal = document.getElementById('profile-modal');
const profileImageInput = document.getElementById('profile-pic-input');
const profilePicPreview = document.getElementById('profile-pic-preview');
const firstNameInput = document.getElementById('firstname-input');
const lastNameInput = document.getElementById('lastname-input');
const saveProfileBtn = document.getElementById('save-profile-btn');

const galleryGrid = document.getElementById('gallery-grid');
const uploadInput = document.getElementById('upload-input');

const chatSidebar = document.getElementById('chat-sidebar');
const closeChatBtn = document.getElementById('close-chat-btn');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendMsgBtn = document.getElementById('send-msg-btn');

const viewerModal = document.getElementById('viewer-modal');
const closeViewerBtn = document.getElementById('close-viewer-btn');
const viewerMediaContainer = document.getElementById('viewer-media-container');
const downloadBtn = document.getElementById('download-btn');

const blogPostModal = document.getElementById('blog-post-modal');
const closeBlogModalBtn = document.getElementById('close-blog-modal-btn');
const blogPostFullContent = document.getElementById('blog-post-full-content');

const themeToggle = document.getElementById('theme-toggle');
const currentUserHeader = document.getElementById('current-user-header');
const headerAvatar = document.getElementById('header-avatar');
const headerFullName = document.getElementById('header-fullname');

// Private Chat Elements
const privateChatModal = document.getElementById('private-chat-modal');
const closePrivateChatBtn = document.getElementById('close-private-chat-btn');
const privateChatHeader = document.getElementById('private-chat-header');
const privateChatMessages = document.getElementById('private-chat-messages');
const privateChatInput = document.getElementById('private-chat-input');
const sendPrivateMsgBtn = document.getElementById('send-private-msg-btn');
let currentRecipientId = null;

// --- REELS ELEMENTS ---
const btnOpenRecorder = document.getElementById('btn-open-recorder');
const recorderModal = document.getElementById('recorder-modal');
const closeRecorderBtn = document.getElementById('close-recorder-btn');
const viewfinder = document.getElementById('viewfinder');
const startRecordBtn = document.getElementById('start-record-btn');
const recordingProgress = document.getElementById('recording-progress');
const recordingTimer = document.getElementById('recording-timer');
const uploadingReelStatus = document.getElementById('uploading-reel-status');
const reelsList = document.getElementById('reels-list');

const reelViewer = document.getElementById('reel-viewer');
const closeReelViewer = document.getElementById('close-reel-viewer');
const reelVideoPlayer = document.getElementById('reel-video-player');
const reelAuthorImg = document.getElementById('reel-author-img');
const reelAuthorName = document.getElementById('reel-author-name');
const activeUsersBar = document.getElementById('active-users-bar');

let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordingInterval = null;
let startTime = 0;
const REEL_DURATION = 8000; // 8 seconds

// --- THEME ---
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        themeToggle.textContent = document.body.classList.contains('light-mode') ? '🌙' : '☀️';
    });
}

// Sections
const gallerySection = document.getElementById('gallery-section');
const blogSection = document.getElementById('blog-section');
const usersSection = document.getElementById('users-section');
const historySection = document.getElementById('history-section');

// Blog/Feed Elements
const backToGalleryBtn = document.getElementById('back-to-gallery-btn');
const blogTextInput = document.getElementById('blog-text-input');
const blogMediaInput = document.getElementById('blog-media-input');
const blogMediaName = document.getElementById('blog-media-name');
const submitPostBtn = document.getElementById('submit-post-btn');
const blogFeed = document.getElementById('blog-feed');

// Users Elements
const usersGrid = document.getElementById('users-grid');
let allUsersData = [];

// Bottom Nav Elements
const navGallery = document.getElementById('nav-gallery');
const navBlog = document.getElementById('nav-blog');
const navUsers = document.getElementById('nav-users');
const navHistory = document.getElementById('nav-history');
const navChat = document.getElementById('nav-chat');
const navItems = [navGallery, navBlog, navUsers, navHistory, navChat];

let userProfile = null;

// --- INITIALIZATION ---
function init() {
    const savedProfile = localStorage.getItem('photoApp_userProfile');
    if (savedProfile) {
        userProfile = JSON.parse(savedProfile);
        profileModal.classList.remove('active');
        updateHeaderProfile();
        socket.emit('user_join', { userId: userProfile.userId, name: userProfile.fullName, photo: userProfile.photo });
        registerUserOnServer(userProfile);
        loadMedia();
        loadBlogPosts();
        loadUsers(); 
    } else {
        profileModal.classList.add('active');
    }
}

// --- PROFILE ---
if (profileImageInput) {
    profileImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                profilePicPreview.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        }
    });
}

async function registerUserOnServer(profile) {
    try {
        await fetch('/api/register-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile)
        });
    } catch(e) {}
}

if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
        const firstName = firstNameInput.value.trim();
        const lastName = lastNameInput.value.trim();
        const file = profileImageInput.files[0];
        if (!firstName || !lastName) return alert('Nombre y apellido obligatorios.');

        let photoUrl = 'https://www.gravatar.com/avatar/0?d=mp';
        if (file) {
            const formData = new FormData();
            formData.append('mediaFile', file);
            saveProfileBtn.innerText = 'Subiendo...';
            try {
                const res = await fetch('/api/profile-photo', { method: 'POST', body: formData });
                const data = await res.json();
                photoUrl = data.url;
            } catch (e) {}
        }

        const userId = 'u_' + Math.random().toString(36).substr(2, 9);
        userProfile = { userId, firstName, lastName, fullName: `${firstName} ${lastName}`, photo: photoUrl };
        localStorage.setItem('photoApp_userProfile', JSON.stringify(userProfile));
        
        registerUserOnServer(userProfile);
        profileModal.classList.remove('active');
        updateHeaderProfile();
        socket.emit('user_join', { userId: userProfile.userId, name: userProfile.fullName, photo: userProfile.photo });
        loadMedia();
        loadBlogPosts();
        loadUsers();
    });
}

function updateHeaderProfile() {
    if (userProfile && currentUserHeader) {
        headerAvatar.src = userProfile.photo;
        headerFullName.innerText = userProfile.fullName;
        currentUserHeader.classList.remove('hidden');
    }
}

// --- USERS DIRECTORY ---
async function loadUsers() {
    try {
        const res = await fetch('/api/users');
        allUsersData = await res.json();
        renderUsers(allUsersData);
        renderActiveUsers(allUsersData);
    } catch(e) {}
}

function renderActiveUsers(users) {
    if (!activeUsersBar) return;
    const onlineOthers = users.filter(u => u.isOnline && (!userProfile || u.userId !== userProfile.userId));
    activeUsersBar.innerHTML = '';
    
    if (onlineOthers.length === 0) {
        activeUsersBar.style.display = 'none';
        return;
    }
    
    activeUsersBar.style.display = 'flex';
    onlineOthers.forEach(u => {
        const div = document.createElement('div');
        div.className = 'active-user-container';
        div.onclick = () => openPrivateChat(u.userId, u.fullName);
        div.innerHTML = `
            <div class="active-user-circle">
                <img src="${u.photo}" alt="${u.fullName}">
                <div class="user-online-dot"></div>
            </div>
        `;
        activeUsersBar.appendChild(div);
    });
}

function renderUsers(users) {
    if(!usersGrid) return;
    usersGrid.innerHTML = '';
    users.forEach(u => {
        if (userProfile && u.userId === userProfile.userId) return;
        const div = document.createElement('div');
        div.className = 'user-card';
        const statusClass = u.isOnline ? 'online' : 'offline';
        div.innerHTML = `
            <div class="user-avatar-container">
                <img src="${u.photo}" class="user-card-avatar" alt="${u.fullName}">
                <span class="status-dot ${statusClass}"></span>
            </div>
            <div class="user-card-name">${u.fullName}</div>
            <button class="btn primary" style="width:100%; margin-top:0.5rem; font-size:0.7rem;" onclick="openPrivateChat('${u.userId}', '${u.fullName}')">💬 Chat</button>
        `;
        usersGrid.appendChild(div);
    });
}

async function openPrivateChat(recipientId, recipientName) {
    currentRecipientId = recipientId;
    if(!privateChatHeader) return;
    privateChatHeader.innerText = `Chat con ${recipientName}`;
    privateChatMessages.innerHTML = '<div style="text-align:center; opacity:0.5;">Cargando...</div>';
    privateChatModal.classList.add('active');
    
    try {
        const res = await fetch(`/api/private-messages?user1=${userProfile.userId}&user2=${recipientId}`);
        const history = await res.json();
        privateChatMessages.innerHTML = '';
        history.forEach(msg => appendPrivateMessage(msg));
    } catch(e) {
        privateChatMessages.innerHTML = '';
    }
}

function sendPrivateMessage() {
    const text = privateChatInput.value.trim();
    if (text && userProfile && currentRecipientId) {
        const msg = {
            fromUserId: userProfile.userId,
            fromUserName: userProfile.fullName,
            toUserId: currentRecipientId,
            text: text
        };
        socket.emit('private_message', msg);
        appendPrivateMessage({ sender_id: userProfile.userId, sender_name: userProfile.fullName, text });
        privateChatInput.value = '';
    }
}

function appendPrivateMessage(msg) {
    if(!privateChatMessages) return;
    const isSelf = msg.sender_id === userProfile.userId;
    const div = document.createElement('div');
    div.className = `message ${isSelf ? 'self' : ''}`;
    div.innerHTML = `${!isSelf ? `<div class="message-sender">${msg.sender_name}</div>` : ''}<div class="message-text">${msg.text}</div>`;
    privateChatMessages.appendChild(div);
    privateChatMessages.scrollTop = privateChatMessages.scrollHeight;
}

if(sendPrivateMsgBtn) sendPrivateMsgBtn.onclick = sendPrivateMessage;
if(privateChatInput) privateChatInput.onkeypress = (e) => { if(e.key==='Enter') sendPrivateMessage(); };
if(closePrivateChatBtn) closePrivateChatBtn.onclick = () => privateChatModal.classList.remove('active');

// --- REELS LOGIC ---
async function startCamera() {
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'user', width: 720, height: 1280 }, 
            audio: true 
        });
        viewfinder.srcObject = mediaStream;
        recorderModal.classList.add('active');
    } catch (err) {
        alert('No se pudo acceder a la cámara o micrófono. Asegúrate de dar permisos.');
    }
}

function stopCamera() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    recorderModal.classList.remove('active');
}

if (btnOpenRecorder) btnOpenRecorder.onclick = startCamera;
if (closeRecorderBtn) closeRecorderBtn.onclick = stopCamera;

if (startRecordBtn) {
    startRecordBtn.onclick = () => {
        recordedChunks = [];
        let mimeType = 'video/webm';
        if (MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
            mimeType = 'video/webm;codecs=vp9';
        }
        
        mediaRecorder = new MediaRecorder(mediaStream, { mimeType });
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };
        mediaRecorder.onstop = uploadReel;
        
        mediaRecorder.start();
        startRecordBtn.classList.add('recording');
        startRecordBtn.disabled = true;
        
        startTime = Date.now();
        recordingInterval = setInterval(updateProgress, 100);
    };
}

function updateProgress() {
    const elapsed = Date.now() - startTime;
    const progress = (elapsed / REEL_DURATION) * 100;
    
    if (recordingProgress) recordingProgress.style.width = Math.min(progress, 100) + '%';
    const seconds = (elapsed / 1000).toFixed(1);
    if (recordingTimer) recordingTimer.innerText = `0:0${seconds}`;
    
    if (elapsed >= REEL_DURATION) {
        stopRecording();
    }
}

function stopRecording() {
    clearInterval(recordingInterval);
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
    startRecordBtn.classList.remove('recording');
    startRecordBtn.disabled = false;
    if (recordingProgress) recordingProgress.style.width = '0%';
    if (recordingTimer) recordingTimer.innerText = '0:00';
}

async function uploadReel() {
    if (uploadingReelStatus) uploadingReelStatus.classList.remove('hidden');
    const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
    const extension = mediaRecorder.mimeType.split('/')[1].split(';')[0];
    const formData = new FormData();
    formData.append('mediaFile', blob, `reel_${Date.now()}.${extension}`);
    formData.append('author', userProfile.fullName);
    formData.append('authorPhoto', userProfile.photo);
    formData.append('userId', userProfile.userId);
    formData.append('text', '🎬 Nuevo Reel');
    formData.append('isReel', 'true');

    try {
        const res = await fetch('/api/blog', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            if (uploadingReelStatus) uploadingReelStatus.classList.add('hidden');
            stopCamera();
            loadBlogPosts();
        }
    } catch (err) {
        alert('Error al subir el reel.');
        if (uploadingReelStatus) uploadingReelStatus.classList.add('hidden');
    }
}

function renderReels(posts) {
    if (!reelsList) return;
    const reels = posts.filter(p => p.media && p.media.isReel).slice(0, 4);
    reelsList.innerHTML = '';
    reels.forEach(reel => {
        const div = document.createElement('div');
        div.className = 'reel-item';
        div.onclick = () => openReelViewer(reel);
        div.innerHTML = `
            <div class="reel-bubble">
                <img src="${reel.authorPhoto || 'https://www.gravatar.com/avatar/0?d=mp'}" alt="${reel.author}">
            </div>
            <span>${reel.author.split(' ')[0]}</span>
        `;
        reelsList.appendChild(div);
    });
}

function openReelViewer(reel) {
    if (!reelViewer) return;
    reelVideoPlayer.src = reel.media.url;
    reelAuthorImg.src = reel.authorPhoto || 'https://www.gravatar.com/avatar/0?d=mp';
    reelAuthorName.innerText = reel.author;
    reelViewer.classList.add('active');
}

if (closeReelViewer) {
    closeReelViewer.onclick = () => {
        reelVideoPlayer.pause();
        reelVideoPlayer.src = '';
        reelViewer.classList.remove('active');
    };
}

// --- GALLERY ---
let currentMediaItems = [];
async function loadMedia() {
    try {
        const res = await fetch('/api/media');
        currentMediaItems = await res.json();
        renderGallery(currentMediaItems);
    } catch (err) {}
}

function renderGallery(mediaItems) {
    if(!galleryGrid) return;
    galleryGrid.innerHTML = '';
    mediaItems.forEach(item => {
        const isOwner = userProfile && (item.userId === userProfile.userId);
        const div = document.createElement('div');
        div.className = 'media-card';
        div.innerHTML = `
            <div class="media-content" onclick="openViewerByName('${item.name}')">
                ${item.type === 'video' ? `<video src="${item.url}#t=0.1"></video><div class="play-icon">▶️</div>` : `<img src="${item.url}" loading="lazy">`}
            </div>
            <div class="card-overlay">
                <button class="like-btn" onclick="event.stopPropagation(); socket.emit('toggle_like', { id: '${item.name}' })">❤️ <span>${item.likes || 0}</span></button>
            </div>
        `;
        galleryGrid.appendChild(div);
    });
}

window.openViewerByName = (name) => {
    const item = currentMediaItems.find(i => i.name === name);
    if (!item) return;
    viewerMediaContainer.innerHTML = item.type === 'video' ? `<video src="${item.url}" controls autoplay></video>` : `<img src="${item.url}">`;
    downloadBtn.href = item.url;
    downloadBtn.download = item.name;
    viewerModal.classList.add('active');
};

if (closeViewerBtn) closeViewerBtn.onclick = () => { viewerModal.classList.remove('active'); viewerMediaContainer.innerHTML = ''; };

if (uploadInput) {
    uploadInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file || !userProfile) return;
        const formData = new FormData();
        formData.append('mediaFile', file);
        formData.append('userId', userProfile.userId);
        try { await fetch('/api/upload', { method: 'POST', body: formData }); } catch(err) {}
        uploadInput.value = '';
    };
}

// --- BLOG / FEED ---
let currentBlogPosts = [];
async function loadBlogPosts() {
    try {
        const res = await fetch('/api/blog');
        currentBlogPosts = await res.json();
        renderBlogPosts();
        renderReels(currentBlogPosts);
    } catch(err) {}
}

function renderBlogPosts() {
    if(!blogFeed) return;
    blogFeed.innerHTML = '';
    const postsOnly = currentBlogPosts.filter(p => !p.media || !p.media.isReel);
    
    postsOnly.forEach(post => {
        const div = document.createElement('div');
        div.className = 'blog-post summary';
        div.onclick = () => openFullPost(post.id);
        div.innerHTML = `
            <div class="blog-post-header">
                <div class="blog-post-author-info">
                    <img src="${post.authorPhoto || 'https://www.gravatar.com/avatar/0?d=mp'}" class="blog-post-avatar">
                    <div>
                        <div class="blog-post-author">${post.author}</div>
                        <div class="blog-post-time">${new Date(post.createdAt).toLocaleDateString()}</div>
                    </div>
                </div>
            </div>
            <div class="blog-post-content">${post.text}</div>
            ${post.media ? `<div class="blog-post-media">${post.media.type === 'video' ? `<video src="${post.media.url}#t=0.5"></video>` : `<img src="${post.media.url}" loading="lazy">`}</div>` : ''}
            <div class="blog-actions">
                <button class="blog-action-btn" onclick="event.stopPropagation(); socket.emit('blog_toggle_like', { postId: '${post.id}' })">❤️ <span>${post.likes || 0}</span></button>
            </div>
        `;
        blogFeed.appendChild(div);
    });
}

function openFullPost(postId) {
    const post = currentBlogPosts.find(p => p.id === postId);
    if (!post) return;
    const isOwner = userProfile && (post.userId === userProfile.userId);
    blogPostFullContent.innerHTML = `
        <div class="blog-post full-view">
            <div class="blog-post-header">
                <strong>${post.author}</strong>
            </div>
            <div class="blog-post-content">${post.text}</div>
            ${post.media ? `<div class="blog-post-media">${post.media.type === 'video' ? `<video src="${post.media.url}" controls autoplay></video>` : `<img src="${post.media.url}">`}</div>` : ''}
        </div>
    `;
    blogPostModal.classList.add('active');
}

if (closeBlogModalBtn) closeBlogModalBtn.onclick = () => blogPostModal.classList.remove('active');

if (submitPostBtn) {
    submitPostBtn.onclick = async () => {
        const text = blogTextInput.value.trim();
        const file = blogMediaInput.files[0];
        if (!text && !file) return;
        const formData = new FormData();
        formData.append('text', text);
        formData.append('author', userProfile.fullName);
        formData.append('authorPhoto', userProfile.photo);
        formData.append('userId', userProfile.userId);
        if (file) formData.append('mediaFile', file);
        try { await fetch('/api/blog', { method: 'POST', body: formData }); } catch(e) {}
        blogTextInput.value = ''; blogMediaInput.value = ''; blogMediaName.innerText = '';
    };
}

// --- CHAT & NAVIGATION ---
function sendMessage() {
    const text = chatInput.value.trim();
    if (text && userProfile) {
        socket.emit('chat_message', { sender: userProfile.fullName, text });
        appendMessage({ sender: userProfile.fullName, text }, true);
        chatInput.value = '';
    }
}
if(sendMsgBtn) sendMsgBtn.onclick = sendMessage;
if(chatInput) chatInput.onkeypress = (e) => { if(e.key==='Enter') sendMessage(); };

function appendMessage(msg, isSelf) {
    if(!chatMessages) return;
    const div = document.createElement('div');
    div.className = `message ${isSelf ? 'self' : ''}`;
    div.innerHTML = `${!isSelf ? `<div class="message-sender">${msg.sender}</div>` : ''}<div class="message-text">${msg.text}</div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateActiveNav(activeItem) {
    navItems.forEach(item => item && item.classList.remove('active'));
    if(activeItem) activeItem.classList.add('active');
}

if(navGallery) navGallery.onclick = () => { 
    gallerySection.classList.remove('hidden'); blogSection.classList.add('hidden'); usersSection.classList.add('hidden'); historySection.classList.add('hidden');
    updateActiveNav(navGallery); 
};
if(navBlog) navBlog.onclick = () => { 
    gallerySection.classList.add('hidden'); blogSection.classList.remove('hidden'); usersSection.classList.add('hidden'); historySection.classList.add('hidden');
    loadBlogPosts(); updateActiveNav(navBlog); 
};
if(navUsers) navUsers.onclick = () => {
    gallerySection.classList.add('hidden'); blogSection.classList.add('hidden'); usersSection.classList.remove('hidden'); historySection.classList.add('hidden');
    loadUsers(); updateActiveNav(navUsers);
};
if(navHistory) navHistory.onclick = () => {
    gallerySection.classList.add('hidden'); blogSection.classList.add('hidden'); usersSection.classList.add('hidden'); historySection.classList.remove('hidden');
    updateActiveNav(navHistory);
};
if(navChat) navChat.onclick = () => {
    chatSidebar.classList.toggle('hidden');
    if (!chatSidebar.classList.contains('hidden')) {
        updateActiveNav(navChat);
    } else {
        const activeSection = !gallerySection.classList.contains('hidden') ? navGallery : 
                             (!blogSection.classList.contains('hidden') ? navBlog : 
                             (!usersSection.classList.contains('hidden') ? navUsers : navHistory));
        updateActiveNav(activeSection);
    }
};

if(closeChatBtn) closeChatBtn.onclick = () => navChat.click();

// --- SOCKET EVENTS ---
socket.on('update_like', data => { 
    const item = currentMediaItems.find(i => i.name === data.id); 
    if(item){ item.likes = data.likes; renderGallery(currentMediaItems); }
});
socket.on('chat_message', msg => appendMessage(msg, false));

socket.on('private_message', msg => {
    if (privateChatModal.classList.contains('active') && currentRecipientId === msg.sender_id) {
        appendPrivateMessage(msg);
    } else {
        alert(`Nuevo mensaje de ${msg.sender_name}: ${msg.text}`);
    }
});
socket.on('user_joined', data => { 
    if(!chatMessages) return;
    const div = document.createElement('div'); div.style.fontSize='0.7rem'; div.style.opacity='0.5'; div.style.textAlign='center';
    div.innerText=`${data.name} se unió`; chatMessages.appendChild(div); 
});
socket.on('blog_update_likes', data => {
    const post = currentBlogPosts.find(p => p.id === data.postId);
    if(post){ post.likes = data.likes; renderBlogPosts(); }
});
socket.on('blog_new_comment', data => {
    const post = currentBlogPosts.find(p => p.id === data.postId);
    if(post){ (post.comments = post.comments || []).push(data.comment); renderBlogPosts(); }
});
socket.on('blog_post_deleted', data => {
    currentBlogPosts = currentBlogPosts.filter(p => p.id !== data.postId); renderBlogPosts();
});
socket.on('user_status_change', data => {
    const user = allUsersData.find(u => u.userId === data.userId);
    if (user) { 
        user.isOnline = (data.status === 'online'); 
        renderUsers(allUsersData); 
        renderActiveUsers(allUsersData);
    }
});
socket.on('new_media', () => loadMedia());
socket.on('media_deleted', () => loadMedia());
socket.on('new_blog_post', post => { currentBlogPosts.unshift(post); renderBlogPosts(); renderReels(currentBlogPosts); });

init();
