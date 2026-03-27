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

// Theme toggle logic
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

// Blog Elements
const backToGalleryBtn = document.getElementById('back-to-gallery-btn');
const blogTextInput = document.getElementById('blog-text-input');
const blogMediaInput = document.getElementById('blog-media-input');
const blogMediaName = document.getElementById('blog-media-name');
const submitPostBtn = document.getElementById('submit-post-btn');
const blogFeed = document.getElementById('blog-feed');

// Users Elements
const usersGrid = document.getElementById('users-grid');

// Bottom Nav Elements
const navGallery = document.getElementById('nav-gallery');
const navBlog = document.getElementById('nav-blog');
const navUsers = document.getElementById('nav-users');
const navChat = document.getElementById('nav-chat');
const navItems = [navGallery, navBlog, navUsers, navChat];

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
    } else {
        profileModal.classList.add('active');
    }
}

// --- PROFILE ---
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

async function registerUserOnServer(profile) {
    try {
        await fetch('/api/register-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile)
        });
    } catch(e) {}
}

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
});

function updateHeaderProfile() {
    if (userProfile && currentUserHeader) {
        headerAvatar.src = userProfile.photo;
        headerFullName.innerText = userProfile.fullName;
        currentUserHeader.classList.remove('hidden');
    }
}

// --- USERS DIRECTORY ---
let allUsersData = [];
async function loadUsers() {
    try {
        const res = await fetch('/api/users');
        allUsersData = await res.json();
        renderUsers(allUsersData);
    } catch(e) {}
}

function renderUsers(users) {
    usersGrid.innerHTML = '';
    users.forEach(u => {
        if (userProfile && u.userId === userProfile.userId) return; // Don't show self
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
    const isSelf = msg.sender_id === userProfile.userId;
    const div = document.createElement('div');
    div.className = `message ${isSelf ? 'self' : ''}`;
    div.innerHTML = `${!isSelf ? `<div class="message-sender">${msg.sender_name}</div>` : ''}<div class="message-text">${msg.text}</div>`;
    privateChatMessages.appendChild(div);
    privateChatMessages.scrollTop = privateChatMessages.scrollHeight;
}

sendPrivateMsgBtn.onclick = sendPrivateMessage;
privateChatInput.onkeypress = (e) => { if(e.key==='Enter') sendPrivateMessage(); };
closePrivateChatBtn.onclick = () => privateChatModal.classList.remove('active');

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
                ${isOwner ? `<button class="delete-btn" onclick="event.stopPropagation(); if(confirm('¿Borrar?')) socket.emit('delete_media', { id: '${item.name}' })">🗑️</button>` : ''}
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

closeViewerBtn.onclick = () => { viewerModal.classList.remove('active'); viewerMediaContainer.innerHTML = ''; };

uploadInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file || !userProfile) return;
    const formData = new FormData();
    formData.append('mediaFile', file);
    formData.append('userId', userProfile.userId);
    try { await fetch('/api/upload', { method: 'POST', body: formData }); } catch(err) {}
    uploadInput.value = '';
};

// --- BLOG ---
let currentBlogPosts = [];
async function loadBlogPosts() {
    try {
        const res = await fetch('/api/blog');
        currentBlogPosts = await res.json();
        renderBlogPosts();
    } catch(err) {}
}

function renderBlogPosts() {
    blogFeed.innerHTML = '';
    currentBlogPosts.forEach(post => {
        const isOwner = userProfile && (post.userId === userProfile.userId);
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
                <button class="blog-action-btn">💬 <span>${post.comments?.length || 0}</span></button>
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
                ${isOwner ? `<button class="btn secondary" style="font-size:0.7rem;" onclick="socket.emit('delete_blog_post', { postId: '${post.id}', userId: '${userProfile.userId}' }); blogPostModal.classList.remove('active');">🗑️ Borrar</button>` : ''}
            </div>
            <div class="blog-post-content">${post.text}</div>
            ${post.media ? `<div class="blog-post-media">${post.media.type === 'video' ? `<video src="${post.media.url}" controls autoplay></video>` : `<img src="${post.media.url}">`}</div>` : ''}
            <div class="comments-section" style="margin-top:1rem; border-top:1px solid #333; padding-top:1rem;">
                <div id="modal-comment-list">
                    ${(post.comments || []).map(c => `<div><strong>${c.author}:</strong> ${c.text}</div>`).join('')}
                </div>
                <div style="display:flex; gap:0.5rem; margin-top:1rem;">
                    <input type="text" placeholder="Comentar..." id="modal-comment-input">
                    <button class="btn primary" onclick="const i=document.getElementById('modal-comment-input'); socket.emit('blog_add_comment', { postId: '${post.id}', author: userProfile.fullName, text: i.value }); i.value='';">Post</button>
                </div>
            </div>
        </div>
    `;
    blogPostModal.classList.add('active');
}

closeBlogModalBtn.onclick = () => blogPostModal.classList.remove('active');

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

// --- CHAT & NAVIGATION ---
function sendMessage() {
    const text = chatInput.value.trim();
    if (text && userProfile) {
        socket.emit('chat_message', { sender: userProfile.fullName, text });
        appendMessage({ sender: userProfile.fullName, text }, true);
        chatInput.value = '';
    }
}
sendMsgBtn.onclick = sendMessage;
chatInput.onkeypress = (e) => { if(e.key==='Enter') sendMessage(); };

function appendMessage(msg, isSelf) {
    const div = document.createElement('div');
    div.className = `message ${isSelf ? 'self' : ''}`;
    div.innerHTML = `${!isSelf ? `<div class="message-sender">${msg.sender}</div>` : ''}<div class="message-text">${msg.text}</div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateActiveNav(activeItem) {
    navItems.forEach(item => item.classList.remove('active'));
    activeItem.classList.add('active');
}

navGallery.onclick = () => { 
    gallerySection.classList.remove('hidden'); blogSection.classList.add('hidden'); usersSection.classList.add('hidden');
    updateActiveNav(navGallery); 
};
navBlog.onclick = () => { 
    gallerySection.classList.add('hidden'); blogSection.classList.remove('hidden'); usersSection.classList.add('hidden');
    loadBlogPosts(); updateActiveNav(navBlog); 
};
navUsers.onclick = () => {
    gallerySection.classList.add('hidden'); blogSection.classList.add('hidden'); usersSection.classList.remove('hidden');
    loadUsers(); updateActiveNav(navUsers);
};
navChat.onclick = () => {
    chatSidebar.classList.toggle('hidden');
    if (!chatSidebar.classList.contains('hidden')) {
        updateActiveNav(navChat);
    } else {
        // Return active state to the visible section
        const activeSection = !gallerySection.classList.contains('hidden') ? navGallery : 
                             (!blogSection.classList.contains('hidden') ? navBlog : navUsers);
        updateActiveNav(activeSection);
    }
};

closeChatBtn.onclick = () => navChat.click();

// --- SOCKET EVENTS ---
socket.on('update_like', data => { 
    const item = currentMediaItems.find(i => i.name === data.id); 
    if(item){ item.likes = data.likes; renderGallery(currentMediaItems); }
});
socket.on('chat_message', msg => appendMessage(msg, false));

socket.on('private_message', msg => {
    // If the modal for this sender is open, append the message
    if (privateChatModal.classList.contains('active') && currentRecipientId === msg.sender_id) {
        appendPrivateMessage(msg);
    } else {
        // Simple notification
        alert(`Nuevo mensaje de ${msg.sender_name}: ${msg.text}`);
    }
});
socket.on('user_joined', data => { 
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
    if (user) { user.isOnline = (data.status === 'online'); renderUsers(allUsersData); }
});
socket.on('new_media', () => loadMedia());
socket.on('media_deleted', () => loadMedia());
socket.on('new_blog_post', post => { currentBlogPosts.unshift(post); renderBlogPosts(); });

init();
