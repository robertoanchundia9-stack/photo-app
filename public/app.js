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
const blogCommentsList = document.getElementById('blog-comments-list');
const blogCommentInput = document.getElementById('blog-comment-input');
const sendBlogCommentBtn = document.getElementById('send-blog-comment');
let currentBlogPostId = null;

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
let currentReelId = null;
const reelLikeBtn = document.getElementById('reel-like-btn');
const reelLikeCount = document.getElementById('reel-like-count');
const reelCommentBtn = document.getElementById('reel-comment-btn');
const reelCommentCount = document.getElementById('reel-comment-count');
const reelCommentsSection = document.getElementById('reel-comments-section');
const reelCommentsList = document.getElementById('reel-comments-list');
const reelCommentInput = document.getElementById('reel-comment-input');
const sendReelCommentBtn = document.getElementById('send-reel-comment');
const closeReelCommentsBtn = document.getElementById('close-reel-comments');
const msgSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');

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
const historySection = document.getElementById('history-section');
const profileSection = document.getElementById('profile-section');


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
const navHistory = document.getElementById('nav-history');
const navChat = document.getElementById('nav-chat');
const navProfile = document.getElementById('nav-profile');
const navItems = [navGallery, navBlog, navHistory, navChat, navProfile];
const appLayout = document.querySelector('.app-layout');


let userProfile = null;

// --- INITIALIZATION ---
function init() {
    const savedProfile = localStorage.getItem('photoApp_userProfile');
    if (savedProfile) {
        userProfile = JSON.parse(savedProfile);
        profileModal.classList.remove('active');
        if(appLayout) appLayout.style.display = 'flex';
        updateHeaderProfile();
        socket.emit('user_join', { userId: userProfile.userId, name: userProfile.fullName, photo: userProfile.photo });
        registerUserOnServer(userProfile);
        loadMedia();
        loadBlogPosts();
        loadUsers(); 
    } else {
        profileModal.classList.add('active');
        if(appLayout) appLayout.style.display = 'none';
    }
}


// Unified Navigation Logic
const pages = {
    'nav-gallery': gallerySection,
    'nav-blog': blogSection,
    'nav-history': historySection,
    'nav-profile': profileSection
};

navItems.forEach(btn => {
    if(!btn || btn.id === 'nav-chat') return;
    btn.onclick = () => {
        // Toggle Active Class
        navItems.forEach(b => { if(b) b.classList.remove('active'); });
        btn.classList.add('active');
        
        // Hide all main sections
        Object.values(pages).forEach(page => {
            if(page) page.classList.add('hidden');
        });
        
        // Show selected section
        if (pages[btn.id]) {
            pages[btn.id].classList.remove('hidden');
            if(btn.id === 'nav-gallery') loadMedia();
            if(btn.id === 'nav-blog') loadBlogPosts();
        }
    };
});


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
        if(appLayout) appLayout.style.display = 'flex';
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
    // Sort reels chronologically (newest first) and do NOT slice (infinite line)
    const reels = posts.filter(p => p.media && p.media.isReel).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
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

// ... skip to loadBlog ...

async function loadBlog() {
    reelsBar.innerHTML = `
        <div class="reel-item create-reel" id="btn-open-recorder">
            <div class="reel-bubble"><span>🎬</span></div>
            <span>Graba</span>
        </div>
        <div class="reel-item skeleton" style="width: 90px; height: 140px; border-radius: 18px;"></div>
        <div class="reel-item skeleton" style="width: 90px; height: 140px; border-radius: 18px;"></div>
    `;
    try {
        const res = await fetch('/api/blog');
        const posts = await res.json();
        const reels = posts.filter(p => p.isReel); // No .slice(0, 4) anymore
        renderReels(reels);
        renderBlogPosts(posts.filter(p => !p.isReel));
    } catch(e) {}
}

function openReelViewer(reel) {
    currentReelId = reel.id;
    reelVideoPlayer.src = reel.media.url;
    reelAuthorImg.src = reel.authorPhoto || 'https://www.gravatar.com/avatar/0?d=mp';
    reelAuthorName.innerText = reel.author;
    reelLikeCount.innerText = reel.likes || 0;
    reelCommentCount.innerText = (reel.comments && reel.comments.length) ? reel.comments.length : 0;
    reelCommentsSection.classList.add('hidden'); // Ensure comments are hidden when opening a new reel
    renderReelComments(reel.comments || []);
    reelViewer.classList.add('active');
}

function renderReelComments(comments) {
    if(!reelCommentsList) return;
    reelCommentsList.innerHTML = '';
    if(comments.length === 0){
        reelCommentsList.innerHTML = '<div style="text-align:center; opacity:0.5; margin-top:2rem;">Sé el primero en comentar 💬</div>';
        return;
    }
    comments.forEach(c => {
        const div = document.createElement('div');
        div.className = 'reel-comment-item';
        div.innerHTML = `
            <span class="reel-comment-author">${c.author}:</span>
            <span class="reel-comment-text">${c.text}</span>
        `;
        reelCommentsList.appendChild(div);
    });
    reelCommentsList.scrollTop = reelCommentsList.scrollHeight;
}

if (reelLikeBtn) {
    reelLikeBtn.onclick = (e) => {
        e.stopPropagation();
        if (currentReelId) {
            socket.emit('blog_toggle_like', { postId: currentReelId });
            const count = parseInt(reelLikeCount.innerText) || 0;
            reelLikeCount.innerText = count + 1;
        }
    };
}

if (reelCommentBtn) {
    reelCommentBtn.onclick = (e) => {
        e.stopPropagation();
        reelCommentsSection.classList.toggle('hidden');
    };
}

if (closeReelCommentsBtn) {
    closeReelCommentsBtn.onclick = (e) => {
        e.stopPropagation();
        reelCommentsSection.classList.add('hidden');
    };
}

if (sendReelCommentBtn && reelCommentInput) {
    const sendComment = () => {
        const text = reelCommentInput.value.trim();
        if (text && userProfile && currentReelId) {
            const comment = { author: userProfile.fullName, text, createdAt: new Date() };
            socket.emit('blog_add_comment', { postId: currentReelId, author: userProfile.fullName, text });
            
            // Optimistic UI update
            const post = currentBlogPosts.find(p => p.id === currentReelId);
            if(post) {
                post.comments = post.comments || [];
                post.comments.push(comment);
                renderReelComments(post.comments);
                reelCommentCount.innerText = post.comments.length;
            } else {
                // If it's pure reel data (not in blogposts)
                const commentsList = Array.from(reelCommentsList.children);
                if(commentsList.length === 1 && commentsList[0].innerText.includes('primero')) reelCommentsList.innerHTML = '';
                const div = document.createElement('div');
                div.className = 'reel-comment-item';
                div.innerHTML = `<span class="reel-comment-author">${userProfile.fullName}:</span> <span class="reel-comment-text">${text}</span>`;
                reelCommentsList.appendChild(div);
                reelCommentCount.innerText = parseInt(reelCommentCount.innerText) + 1;
            }
            reelCommentInput.value = '';
        }
    };
    sendReelCommentBtn.onclick = sendComment;
    reelCommentInput.onkeypress = (e) => { if(e.key === 'Enter') sendComment(); };
}

if (closeReelViewer) {
    closeReelViewer.onclick = () => {
        reelVideoPlayer.pause();
        reelVideoPlayer.src = '';
        reelViewer.classList.remove('active');
        reelCommentsSection.classList.add('hidden');
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
    currentBlogPostId = post.id;
    const isOwner = userProfile && (post.userId === userProfile.userId);
    blogPostFullContent.innerHTML = `
        <div class="blog-post full-view">
            <div class="blog-post-header">
                <div class="blog-post-author-info">
                    <img src="${post.authorPhoto || 'https://www.gravatar.com/avatar/0?d=mp'}" class="blog-post-avatar">
                    <div class="blog-post-author">${post.author}</div>
                </div>
            </div>
            <div class="blog-post-content">${post.text}</div>
            ${post.media ? `<div class="blog-post-media">${post.media.type === 'video' ? `<video src="${post.media.url}" controls autoplay></video>` : `<img src="${post.media.url}">`}</div>` : ''}
        </div>
    `;
    renderBlogComments(post.comments || []);
    blogPostModal.classList.add('active');
}

function renderBlogComments(comments) {
    if(!blogCommentsList) return;
    blogCommentsList.innerHTML = '';
    if(comments.length === 0){
        blogCommentsList.innerHTML = '<div style="text-align:center; opacity:0.5; margin-top:1rem;">No hay comentarios todavía 💬</div>';
        return;
    }
    comments.forEach(c => {
        const div = document.createElement('div');
        div.className = 'reel-comment-item'; // Reuse styling
        div.innerHTML = `
            <span class="reel-comment-author">${c.author}:</span>
            <span class="reel-comment-text">${c.text}</span>
        `;
        blogCommentsList.appendChild(div);
    });
    blogCommentsList.scrollTop = blogCommentsList.scrollHeight;
}

if (sendBlogCommentBtn && blogCommentInput) {
    const sendComment = () => {
        const text = blogCommentInput.value.trim();
        if (text && userProfile && currentBlogPostId) {
            socket.emit('blog_add_comment', { postId: currentBlogPostId, author: userProfile.fullName, text });
            blogCommentInput.value = '';
        }
    };
    sendBlogCommentBtn.onclick = sendComment;
    blogCommentInput.onkeypress = (e) => { if(e.key === 'Enter') sendComment(); };
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

if(navChat) navChat.onclick = () => {
    chatSidebar.classList.toggle('hidden');
};

if(closeChatBtn) closeChatBtn.onclick = () => {
    chatSidebar.classList.add('hidden');
};


// --- SOCKET EVENTS ---
socket.on('update_like', data => { 
    const item = currentMediaItems.find(i => i.name === data.id); 
    if(item){ item.likes = data.likes; renderGallery(currentMediaItems); }
});
socket.on('chat_message', msg => {
    appendMessage(msg, false);
    if (userProfile && msg.sender !== userProfile.fullName) {
        msgSound.play().catch(() => {});
    }
});

socket.on('private_message', msg => {
    if (privateChatModal.classList.contains('active') && currentRecipientId === msg.sender_id) {
        appendPrivateMessage(msg);
    } else {
        alert(`Nuevo mensaje de ${msg.sender_name}: ${msg.text}`);
    }
    if (userProfile && msg.sender_id !== userProfile.userId) {
        msgSound.play().catch(() => {});
    }
});
socket.on('user_joined', data => { 
    if(!chatMessages) return;
    const div = document.createElement('div'); div.style.fontSize='0.7rem'; div.style.opacity='0.5'; div.style.textAlign='center';
    div.innerText=`${data.name} se unió`; chatMessages.appendChild(div); 
});
socket.on('blog_update_likes', data => {
    if (currentReelId === data.postId) {
        reelLikeCount.innerText = data.likes;
    }
    const post = currentBlogPosts.find(p => p.id === data.postId);
    if (post) {
        post.likes = data.likes;
        renderBlogPosts();
        renderReels(currentBlogPosts);
    }
});
socket.on('blog_new_comment', data => {
    // If the Reel viewer is currently open on this post, update it live
    if (currentReelId === data.postId) {
        const commentsList = Array.from(reelCommentsList.children);
        if(commentsList.length === 1 && commentsList[0].innerText.includes('primero')) reelCommentsList.innerHTML = '';
        
        const div = document.createElement('div');
        div.className = 'reel-comment-item';
        div.innerHTML = `<span class="reel-comment-author">${data.comment.author}:</span> <span class="reel-comment-text">${data.comment.text}</span>`;
        reelCommentsList.appendChild(div);
        
        const currentCount = parseInt(reelCommentCount.innerText) || 0;
        reelCommentCount.innerText = currentCount + 1;
        reelCommentsList.scrollTop = reelCommentsList.scrollHeight;
    }

    const post = currentBlogPosts.find(p => p.id === data.postId);
    if(post) { 
        (post.comments = post.comments || []).push(data.comment); 
        renderBlogPosts(); 
        if (currentBlogPostId === data.postId) {
            renderBlogComments(post.comments);
        }
    }
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


// End of application logic

// --- NEW PROFILE SETTINGS ---
const profileForm = document.getElementById('profile-form');
const profilePhotosInput = document.getElementById('profile-photos-input');
const profilePhotosPreview = document.getElementById('profile-photos-preview');
const profileEditCard = document.getElementById('profile-edit-card');
const profileDisplayCard = document.getElementById('profile-display-card');
const btnEditProfile = document.getElementById('btn-edit-profile');

if (profilePhotosInput) {
    profilePhotosInput.addEventListener('change', (e) => {
        profilePhotosPreview.innerHTML = '';
        const files = Array.from(e.target.files).slice(0, 4); // Max 4
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = document.createElement('img');
                img.src = event.target.result;
                img.className = 'photo-preview-item';
                profilePhotosPreview.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });
}

function showProfileDisplay(data, hobbies, privacy, privatePhotos) {
    if(profileEditCard) profileEditCard.classList.add('hidden');
    if(profileDisplayCard) profileDisplayCard.classList.remove('hidden');

    document.getElementById('display-avatar').src = userProfile.photo;
    document.getElementById('display-name').innerText = userProfile.fullName;
    
    let privacyText = privacy === 'public' ? '🌍 Público' : '👥 Privado';
    if(privatePhotos) privacyText += ' 🔒 (Fotos Seguras)';
    document.getElementById('display-privacy-badge').innerText = privacyText;
    
    document.getElementById('display-hobbies').innerText = hobbies || "Aún no has añadido aficiones.";

    const grid = document.getElementById('display-photos-grid');
    grid.innerHTML = '';
    if (data.photoUrls && data.photoUrls.length > 0) {
        document.getElementById('display-photos-section').style.display = 'block';
        data.photoUrls.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            grid.appendChild(img);
        });
    } else {
        document.getElementById('display-photos-section').style.display = 'none';
    }
}

if (btnEditProfile) {
    btnEditProfile.addEventListener('click', () => {
        if(profileDisplayCard) profileDisplayCard.classList.add('hidden');
        if(profileEditCard) profileEditCard.classList.remove('hidden');
    });
}

if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!userProfile) return alert('Debes configurar tu perfil inicial primero.');
        
        const hobbies = document.getElementById('profile-hobbies').value.trim();
        const privacy = document.getElementById('profile-privacy').value;
        const privatePhotos = document.getElementById('profile-private-photos').checked;
        const files = Array.from(profilePhotosInput.files).slice(0, 4);

        const submitBtn = profileForm.querySelector('button[type="submit"]');
        submitBtn.innerText = 'Guardando...';
        submitBtn.disabled = true;

        const formData = new FormData();
        formData.append('userId', userProfile.userId);
        formData.append('hobbies', hobbies);
        formData.append('privacy', privacy);
        formData.append('privatePhotos', privatePhotos);
        files.forEach(file => formData.append('profilePhotos', file));

        try {
            const res = await fetch('/api/update-profile', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                showProfileDisplay(data, hobbies, privacy, privatePhotos);
                // Clear inputs
                profilePhotosInput.value = '';
                profilePhotosPreview.innerHTML = '';
            } else {
                alert('Error al actualizar el perfil.');
            }
        } catch (err) {
            alert('Error al conectar con el servidor.');
        } finally {
            submitBtn.innerText = 'Guardar Perfil';
            submitBtn.disabled = false;
        }
    });
}

