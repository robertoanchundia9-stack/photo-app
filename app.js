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
const fullscreenBtn = document.getElementById('fullscreen-btn');

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
        socket.emit('user_join', { userId: userProfile.userId, name: userProfile.fullName, photo: userProfile.photo });
        registerUserOnServer(userProfile); // Ensure we are in the list
        loadMedia();
    } else {
        profileModal.classList.add('active');
    }
}

// --- PROFILE & USER DIRECTORY ---
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
            body: JSON.stringify({
                userId: profile.userId,
                fullName: profile.fullName,
                photo: profile.photo
            })
        });
    } catch(e) { console.error('Register failed', e); }
}

saveProfileBtn.addEventListener('click', async () => {
    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    const file = profileImageInput.files[0];

    if (!firstName || !lastName) return alert('Nombre y apellido obligatorios.');

    let photoUrl = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
    if (file) {
        const formData = new FormData();
        formData.append('mediaFile', file);
        saveProfileBtn.innerText = 'Subiendo...';
        try {
            const res = await fetch('/api/profile-photo', { method: 'POST', body: formData });
            const data = await res.json();
            photoUrl = data.url;
        } catch (err) { console.error('Profile photo upload failed', err); }
    }

    const userId = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    userProfile = { userId, firstName, lastName, fullName: `${firstName} ${lastName}`, photo: photoUrl };
    localStorage.setItem('photoApp_userProfile', JSON.stringify(userProfile));
    
    registerUserOnServer(userProfile);
    
    profileModal.classList.remove('active');
    socket.emit('user_join', { userId: userProfile.userId, name: userProfile.fullName, photo: userProfile.photo });
    loadMedia();
    saveProfileBtn.innerText = 'Empezar';
});


function renderUsers(users) {
    usersGrid.innerHTML = '';
    users.forEach(u => {
        const div = document.createElement('div');
        div.className = 'user-card';
        // Add a class for online status if available
        const statusClass = u.isOnline ? 'online' : 'offline';
        div.innerHTML = `
            <div class="user-avatar-container">
                <img src="${u.photo}" class="user-card-avatar" alt="${u.fullName}">
                <span class="status-dot ${statusClass}"></span>
            </div>
            <div class="user-card-name">${u.fullName}</div>
        `;
        usersGrid.appendChild(div);
    });
}

let allUsersData = []; // To store users locally and update status
async function loadUsers() {
    try {
        const res = await fetch('/api/users');
        allUsersData = await res.json();
        renderUsers(allUsersData);
    } catch(e) { console.error(e); }
}

// --- CORE UTILITIES ---
fullscreenBtn.onclick = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
};

document.addEventListener('fullscreenchange', () => {
    fullscreenBtn.innerText = document.fullscreenElement ? '🔳' : '📺';
});

let isLight = localStorage.getItem('photoApp_theme') === 'light';
if (isLight) { document.body.classList.add('light-mode'); themeToggle.innerText = '🌙'; }
themeToggle.onclick = () => {
    isLight = !isLight;
    document.body.classList.toggle('light-mode', isLight);
    themeToggle.innerText = isLight ? '🌙' : '☀️';
    localStorage.setItem('photoApp_theme', isLight ? 'light' : 'dark');
};

// --- GALLERY ---
let currentMediaItems = [];
async function loadMedia() {
    try {
        const res = await fetch('/api/media');
        currentMediaItems = await res.json();
        renderGallery(currentMediaItems);
    } catch (err) { console.error(err); }
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
                ${isOwner ? `<button class="delete-btn" onclick="event.stopPropagation(); if(confirm('¿Borrar?')) socket.emit('delete_media', { id: '${item.name}', userId: '${userProfile.userId}' })">🗑️</button>` : ''}
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
    try { await fetch('/api/upload', { method: 'POST', body: formData }); } catch(err) { alert('Error subiendo'); }
    uploadInput.value = '';
};

// --- BLOG ---
let currentBlogPosts = [];
async function loadBlogPosts() {
    try {
        const res = await fetch('/api/blog');
        currentBlogPosts = await res.json();
        renderBlogPosts();
    } catch(err) { console.error('Error loading blog posts:', err); }
}

function renderBlogPosts() {
    blogFeed.innerHTML = '';
    if (currentBlogPosts.length === 0) {
        blogFeed.innerHTML = '<p style="text-align:center; opacity:0.5;">No hay publicaciones todavía.</p>';
        return;
    }
    currentBlogPosts.forEach(post => {
        const isOwner = userProfile && (post.userId === userProfile.userId);
        const div = document.createElement('div');
        div.className = 'blog-post summary';
        div.onclick = () => openFullPost(post.id);
        div.innerHTML = `
            <div class="blog-post-header">
                <div class="blog-post-author-info">
                    <img src="${post.authorPhoto || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'}" class="blog-post-avatar">
                    <div>
                        <div class="blog-post-author">${post.author}</div>
                        <div class="blog-post-time">${new Date(post.createdAt).toLocaleDateString()}</div>
                    </div>
                </div>
                ${isOwner ? `<button class="blog-post-menu-btn" onclick="event.stopPropagation(); if(confirm('¿Borrar publicacion?')){ socket.emit('delete_blog_post', { postId: '${post.id}', userId: '${userProfile.userId}' }); }">🗑️</button>` : ''}
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
        <div class="blog-post full-view" style="cursor:default;">
            <div class="blog-post-header">
                <div class="blog-post-author-info">
                    <img src="${post.authorPhoto || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'}" class="blog-post-avatar">
                    <div>
                        <div class="blog-post-author">${post.author}</div>
                        <div class="blog-post-time">${new Date(post.createdAt).toLocaleString()}</div>
                    </div>
                </div>
                ${isOwner ? `<button class="btn secondary" style="font-size:0.8rem; padding: 0.4rem 0.8rem;" onclick="if(confirm('¿Borrar?')){ socket.emit('delete_blog_post', { postId: '${post.id}', userId: '${userProfile.userId}' }); blogPostModal.classList.remove('active'); }">🗑️ Borrar</button>` : ''}
            </div>
            <div class="blog-post-content" style="display:block; white-space: pre-wrap; font-size: 1.1rem;">${post.text}</div>
            ${post.media ? `<div class="blog-post-media" style="margin-top: 1rem;">${post.media.type === 'video' ? `<video src="${post.media.url}" controls autoplay></video>` : `<img src="${post.media.url}">`}</div>` : ''}
            <div class="blog-actions">
                <button class="blog-action-btn" onclick="socket.emit('blog_toggle_like', { postId: '${post.id}' })">❤️ <span>${post.likes || 0}</span> Me gusta</button>
            </div>
            <div class="comments-section" style="margin-top:2rem;">
                <h4>Comentarios</h4>
                <div class="comment-list" id="modal-comment-list" style="max-height: 200px; overflow-y: auto; margin: 1rem 0;">
                    ${(post.comments || []).map(c => `<div class="comment-item"><span class="comment-author">${c.author}:</span> ${c.text}</div>`).join('')}
                </div>
                <div class="comment-input-area">
                    <input type="text" placeholder="Comentar..." id="modal-comment-input" onkeypress="if(event.key==='Enter' && this.value.trim()){ socket.emit('blog_add_comment', { postId: '${post.id}', author: userProfile.fullName, text: this.value }); this.value=''; }">
                    <button class="btn primary" onclick="const input = document.getElementById('modal-comment-input'); if(input.value.trim()){ socket.emit('blog_add_comment', { postId: '${post.id}', author: userProfile.fullName, text: input.value }); input.value=''; }">Enviar</button>
                </div>
            </div>
        </div>
    `;
    blogPostModal.classList.add('active');
}

closeBlogModalBtn.onclick = () => {
    blogPostModal.classList.remove('active');
    blogPostFullContent.innerHTML = '';
};

blogMediaInput.onchange = (e) => { blogMediaName.innerText = e.target.files[0]?.name || ''; };

submitPostBtn.onclick = async () => {
    const text = blogTextInput.value.trim();
    const file = blogMediaInput.files[0];
    if ((!text && !file) || !userProfile) return;

    const formData = new FormData();
    formData.append('text', text);
    formData.append('author', userProfile.fullName);
    formData.append('authorPhoto', userProfile.photo);
    formData.append('userId', userProfile.userId);
    if (file) formData.append('mediaFile', file);

    submitPostBtn.disabled = true;
    try { 
        const res = await fetch('/api/blog', { method: 'POST', body: formData }); 
        if (res.ok) {
            blogTextInput.value = ''; 
            blogMediaInput.value = ''; 
            blogMediaName.innerText = ''; 
        }
    } 
    catch(err) { alert('Error al publicar'); } finally { submitPostBtn.disabled = false; }
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

function hideAllSections() {
    gallerySection.classList.add('hidden');
    blogSection.classList.add('hidden');
    usersSection.classList.add('hidden');
}

navGallery.onclick = () => { 
    hideAllSections();
    gallerySection.classList.remove('hidden'); 
    updateActiveNav(navGallery); 
};

navBlog.onclick = () => { 
    hideAllSections();
    blogSection.classList.remove('hidden'); 
    loadBlogPosts(); 
    updateActiveNav(navBlog); 
};

navUsers.onclick = () => {
    hideAllSections();
    usersSection.classList.remove('hidden');
    loadUsers();
    updateActiveNav(navUsers);
};

navChat.onclick = () => {
    chatSidebar.classList.toggle('hidden');
    if(!chatSidebar.classList.contains('hidden')) {
        chatSidebar.style.position = 'relative'; 
        chatSidebar.style.width = '350px'; 
        updateActiveNav(navChat);
    } else {
        chatSidebar.style.position = 'absolute'; 
        let currentActive = navGallery;
        if (!blogSection.classList.contains('hidden')) currentActive = navBlog;
        if (!usersSection.classList.contains('hidden')) currentActive = navUsers;
        updateActiveNav(currentActive);
    }
};

closeChatBtn.onclick = () => navChat.click();

// --- SOCKET EVENTS ---
socket.on('update_like', data => { 
    const item = currentMediaItems.find(i => i.name === data.id); 
    if(item){ item.likes = data.likes; renderGallery(currentMediaItems); }
});

socket.on('chat_message', msg => appendMessage(msg, false));

socket.on('user_joined', data => { 
    const div = document.createElement('div'); 
    div.className='chat-notice'; 
    div.innerText=`${data.name} se unió`; 
    chatMessages.appendChild(div); 
});

socket.on('blog_update_likes', data => {
    const post = currentBlogPosts.find(p => p.id === data.postId);
    if(post){
        post.likes = data.likes;
        renderBlogPosts();
        if(blogPostModal.classList.contains('active')) {
             const likeBtn = blogPostFullContent.querySelector('.blog-action-btn span');
             if(likeBtn) likeBtn.innerText = data.likes;
        }
    }
});

socket.on('blog_new_comment', data => {
    const post = currentBlogPosts.find(p => p.id === data.postId);
    if(post){
        if(!post.comments) post.comments = [];
        post.comments.push(data.comment);
        renderBlogPosts();
        const commentList = document.getElementById('modal-comment-list');
        if(commentList && blogPostModal.classList.contains('active')) {
             const div = document.createElement('div');
             div.className = 'comment-item';
             div.innerHTML = `<span class="comment-author">${data.comment.author}:</span> ${data.comment.text}`;
             commentList.appendChild(div);
             commentList.scrollTop = commentList.scrollHeight;
        }
    }
});

socket.on('blog_post_deleted', data => {
    currentBlogPosts = currentBlogPosts.filter(p => p.id !== data.postId);
    renderBlogPosts();
    if(blogPostModal.classList.contains('active')) blogPostModal.classList.remove('active');
});

socket.on('user_status_change', data => {
    const user = allUsersData.find(u => u.userId === data.userId);
    if (user) {
        user.isOnline = (data.status === 'online');
        renderUsers(allUsersData);
    }
});

socket.on('new_media', () => loadMedia());
socket.on('media_deleted', () => loadMedia());
socket.on('new_blog_post', post => { 
    const exists = currentBlogPosts.find(p => p.id === post.id);
    if (!exists) {
        currentBlogPosts.unshift(post); 
        if(!blogSection.classList.contains('hidden')) renderBlogPosts(); 
    }
});

init();
