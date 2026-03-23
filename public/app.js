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

const installAppBtn = document.getElementById('install-app-btn');
const themeToggle = document.getElementById('theme-toggle');
const fullscreenBtn = document.getElementById('fullscreen-btn');

// Blog Elements
const gallerySection = document.getElementById('gallery-section');
const blogSection = document.getElementById('blog-section');
const backToGalleryBtn = document.getElementById('back-to-gallery-btn');
const blogTextInput = document.getElementById('blog-text-input');
const blogMediaInput = document.getElementById('blog-media-input');
const blogMediaName = document.getElementById('blog-media-name');
const submitPostBtn = document.getElementById('submit-post-btn');
const blogFeed = document.getElementById('blog-feed');

// Bottom Nav Elements
const navGallery = document.getElementById('nav-gallery');
const navBlog = document.getElementById('nav-blog');
const navChat = document.getElementById('nav-chat');
const navItems = [navGallery, navBlog, navChat];

let userProfile = JSON.parse(localStorage.getItem('photoApp_userProfile')) || null;

// --- INITIALIZATION ---
function init() {
    if (!userProfile) {
        profileModal.classList.add('active');
    } else {
        profileModal.classList.remove('active');
        socket.emit('user_join', { name: userProfile.fullName, photo: userProfile.photo });
        loadMedia();
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
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            photoUrl = data.file.url;
        } catch (err) { console.error('Upload failed', err); }
    }

    userProfile = { firstName, lastName, fullName: `${firstName} ${lastName}`, photo: photoUrl };
    localStorage.setItem('photoApp_userProfile', JSON.stringify(userProfile));
    profileModal.classList.remove('active');
    socket.emit('user_join', { name: userProfile.fullName, photo: userProfile.photo });
    loadMedia();
});

// --- CORE UTILITIES ---
fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        fullscreenBtn.innerText = '🔳';
    } else {
        document.exitFullscreen();
        fullscreenBtn.innerText = '📺';
    }
});

let isLight = localStorage.getItem('photoApp_theme') === 'light';
if (isLight) { document.body.classList.add('light-mode'); themeToggle.innerText = '🌙'; }
themeToggle.addEventListener('click', () => {
    isLight = !isLight;
    document.body.classList.toggle('light-mode', isLight);
    themeToggle.innerText = isLight ? '🌙' : '☀️';
    localStorage.setItem('photoApp_theme', isLight ? 'light' : 'dark');
});

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
        const div = document.createElement('div');
        div.className = 'media-card';
        div.innerHTML = `
            <div class="media-content" onclick="openViewerByName('${item.name}')">
                ${item.type === 'video' ? `<video src="${item.url}#t=0.1"></video><div class="play-icon">▶️</div>` : `<img src="${item.url}" loading="lazy">`}
            </div>
            <div class="card-overlay">
                <button class="like-btn" onclick="event.stopPropagation(); socket.emit('toggle_like', { id: '${item.name}' })">❤️ <span>${item.likes || 0}</span></button>
                <button class="delete-btn" onclick="event.stopPropagation(); if(confirm('¿Borrar?')) socket.emit('delete_media', { id: '${item.name}' })">🗑️</button>
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
    if (!file) return;
    const formData = new FormData();
    formData.append('mediaFile', file);
    try { await fetch('/api/upload', { method: 'POST', body: formData }); } catch(err) { alert('Error'); }
    uploadInput.value = '';
};

// --- BLOG ---
let currentBlogPosts = [];
async function loadBlogPosts() {
    try {
        const res = await fetch('/api/blog');
        currentBlogPosts = await res.json();
        renderBlogPosts();
    } catch(err) { console.error(err); }
}

function renderBlogPosts() {
    blogFeed.innerHTML = '';
    currentBlogPosts.forEach(post => {
        const div = document.createElement('div');
        div.className = 'blog-post';
        div.innerHTML = `
            <div class="blog-post-header">
                <div class="blog-post-author-info">
                    <img src="${post.authorPhoto || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'}" class="blog-post-avatar">
                    <div>
                        <div class="blog-post-author">${post.author}</div>
                        <div class="blog-post-time">${new Date(post.createdAt).toLocaleString()}</div>
                    </div>
                </div>
                <button class="blog-post-menu-btn" onclick="socket.emit('delete_blog_post', { postId: '${post.id}' })">🗑️</button>
            </div>
            <div class="blog-post-content">${post.text}</div>
            ${post.media ? `<div class="blog-post-media">${post.media.type === 'video' ? `<video src="${post.media.url}" controls></video>` : `<img src="${post.media.url}">`}</div>` : ''}
            <div class="blog-actions">
                <button class="blog-action-btn" onclick="socket.emit('blog_toggle_like', { postId: '${post.id}' })">❤️ <span>${post.likes || 0}</span></button>
                <button class="blog-action-btn" onclick="document.getElementById('comments-${post.id}').classList.toggle('hidden')">💬 <span>${post.comments?.length || 0}</span></button>
            </div>
            <div class="comments-section hidden" id="comments-${post.id}">
                <div class="comment-list">
                    ${(post.comments || []).map(c => `<div class="comment-item"><span class="comment-author">${c.author}:</span> ${c.text}</div>`).join('')}
                </div>
                <div class="comment-input-area">
                    <input type="text" placeholder="Comentar..." onkeypress="if(event.key==='Enter' && this.value.trim()){ socket.emit('blog_add_comment', { postId: '${post.id}', author: userProfile.fullName, text: this.value }); this.value=''; }">
                </div>
            </div>
        `;
        blogFeed.appendChild(div);
    });
}

blogMediaInput.onchange = (e) => { blogMediaName.innerText = e.target.files[0]?.name || ''; };

submitPostBtn.onclick = async () => {
    const text = blogTextInput.value.trim();
    const file = blogMediaInput.files[0];
    if (!text && !file) return;

    const formData = new FormData();
    formData.append('text', text);
    formData.append('author', userProfile.fullName);
    formData.append('authorPhoto', userProfile.photo);
    if (file) formData.append('mediaFile', file);

    submitPostBtn.disabled = true;
    try { await fetch('/api/blog', { method: 'POST', body: formData }); blogTextInput.value = ''; blogMediaInput.value = ''; blogMediaName.innerText = ''; } 
    catch(err) { alert('Error'); } finally { submitPostBtn.disabled = false; }
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

navGallery.onclick = () => { blogSection.classList.add('hidden'); gallerySection.classList.remove('hidden'); updateActiveNav(navGallery); };
navBlog.onclick = () => { gallerySection.classList.add('hidden'); blogSection.classList.remove('hidden'); loadBlogPosts(); updateActiveNav(navBlog); };
navChat.onclick = () => {
    chatSidebar.classList.toggle('hidden');
    if(!chatSidebar.classList.contains('hidden')) {
        chatSidebar.style.position = 'relative'; chatSidebar.style.width = '350px'; updateActiveNav(navChat);
    } else {
        chatSidebar.style.position = 'absolute'; updateActiveNav(gallerySection.classList.contains('hidden') ? navBlog : navGallery);
    }
};
closeChatBtn.onclick = () => navChat.click();

// --- SOCKET EVENTS ---
socket.on('update_like', data => { const item = currentMediaItems.find(i => i.name === data.id); if(item){ item.likes = data.likes; renderGallery(currentMediaItems); }});
socket.on('chat_message', msg => appendMessage(msg, false));
socket.on('user_joined', data => { const div = document.createElement('div'); div.className='chat-notice'; div.innerText=`${data.name} se unió`; chatMessages.appendChild(div); });
socket.on('blog_update_likes', data => { const post = currentBlogPosts.find(p => p.id === data.postId); if(post){ post.likes = data.likes; renderBlogPosts(); }});
socket.on('blog_new_comment', data => { const post = currentBlogPosts.find(p => p.id === data.postId); if(post){ if(!post.comments) post.comments = []; post.comments.push(data.comment); renderBlogPosts(); }});
socket.on('blog_post_deleted', data => { currentBlogPosts = currentBlogPosts.filter(p => p.id !== data.postId); renderBlogPosts(); });
socket.on('new_media', () => loadMedia());
socket.on('media_deleted', () => loadMedia());
socket.on('new_blog_post', post => { currentBlogPosts.unshift(post); if(!blogSection.classList.contains('hidden')) renderBlogPosts(); });

init();
