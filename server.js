const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// --- SUPABASE CLIENT ---
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    : null;

if (supabase) {
    console.log('✅ Supabase client initialized');
} else {
    console.warn('⚠️  SUPABASE_URL or SUPABASE_SERVICE_KEY not set. Using LOCAL MODE (some features disabled).');
}

// --- ACTIVE USERS TRACKING ---
const activeSockets = new Map(); // socket.id -> { userId, name }

// In-memory likes cache
let likesMap = {};
async function loadLikes() {
    if (!supabase) return;
    const { data } = await supabase.from('likes').select('media_id, likes');
    if (data) data.forEach(r => { likesMap[r.media_id] = r.likes; });
}
loadLikes();

// --- CLOUDINARY ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'photo-app',
        resource_type: 'auto',
        allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'mp4', 'mov', 'webm']
    }
});
const upload = multer({ storage });

// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API: Media Gallery ---
app.get('/api/media', async (req, res) => {
    try {
        if (!process.env.CLOUDINARY_API_KEY) return res.json([]);
        const { resources } = await cloudinary.search
            .expression('folder:photo-app')
            .sort_by('created_at', 'desc')
            .max_results(100)
            .execute();
        const mediaFiles = resources.map(item => ({
            name:      item.public_id,
            url:       item.secure_url,
            type:      item.resource_type === 'video' ? 'video' : 'image',
            createdAt: new Date(item.created_at).getTime(),
            likes:     likesMap[item.public_id] || 0
        }));
        res.json(mediaFiles);
    } catch (err) {
        console.error('Cloudinary fetch error:', err);
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/api/upload', upload.single('mediaFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const isVideo = req.file.mimetype && req.file.mimetype.startsWith('video');
    const fileObj = {
        name: req.file.filename, url: req.file.path,
        type: isVideo ? 'video' : 'image', createdAt: Date.now()
    };
    io.emit('new_media', fileObj);
    res.json({ success: true, file: fileObj });
});

// --- API: Blog Posts ---
app.get('/api/blog', async (req, res) => {
    if (!supabase) return res.json([]);
    const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json((data || []).map(p => ({
        id: p.post_id, postId: p.post_id, text: p.text, author: p.author,
        authorPhoto: p.author_photo, userId: p.user_id, media: p.media,
        createdAt: p.created_at, likes: p.likes, comments: p.comments || []
    })));
});

app.post('/api/blog', upload.single('mediaFile'), async (req, res) => {
    const { text, author, authorPhoto, userId, isReel } = req.body;
    let fileObj = null;
    if (req.file) {
        const isVideo = req.file.mimetype && req.file.mimetype.startsWith('video');
        fileObj = { 
            name: req.file.filename, 
            url: req.file.path, 
            type: isVideo ? 'video' : 'image',
            isReel: isReel === 'true'
        };
    }
    const postId = Date.now() + '-' + Math.round(Math.random() * 1000);
    const row = {
        post_id: postId, text: text || '', author: author || 'Anónimo',
        author_photo: authorPhoto || null, user_id: userId || 'anonymous',
        media: fileObj, created_at: Date.now(), likes: 0, comments: []
    };
    if (supabase) {
        console.log('📝 Attempting to save blog post to Supabase:', row.post_id);
        const { error } = await supabase.from('blog_posts').insert(row);
        if (error) {
            console.error('❌ Supabase insert error:', error.message);
            return res.status(500).json({ success: false, error: 'Database error' });
        }
        console.log('✅ Blog post saved successfully');
    }
    const post = { id: postId, ...row, postId };
    io.emit('new_blog_post', post);
    res.json({ success: true, post });
});

// --- API: Users & Profile ---
app.get('/api/users', async (req, res) => {
    if (!supabase) return res.json([]);
    const { data, error } = await supabase.from('users').select('*');
    if (error) return res.status(500).json({ error: error.message });
    
    // Combine DB data with real-time online status
    const onlineUserIds = new Set(Array.from(activeSockets.values()).map(u => u.userId));
    const users = data.map(u => ({
        userId: u.user_id,
        fullName: u.full_name,
        photo: u.photo,
        hobbies: u.hobbies || '',
        privacy: u.privacy || 'public',
        privatePhotos: u.private_photos === true,
        photos: u.photos || [],
        isOnline: onlineUserIds.has(u.user_id)
    }));
    res.json(users);
});

app.get('/api/private-messages', async (req, res) => {
    const { user1, user2 } = req.query;
    if (!supabase || !user1 || !user2) return res.json([]);
    const { data, error } = await supabase
        .from('private_messages')
        .select('*')
        .or(`and(sender_id.eq.${user1},recipient_id.eq.${user2}),and(sender_id.eq.${user2},recipient_id.eq.${user1})`)
        .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

app.post('/api/register-user', async (req, res) => {
    const { userId, fullName, photo } = req.body;
    if (!supabase || !userId) return res.json({ success: false });
    const { error } = await supabase.from('users').upsert({
        user_id: userId,
        full_name: fullName,
        photo: photo,
        last_seen: Date.now()
    });
    res.json({ success: !error });
});

app.post('/api/update-profile', upload.array('profilePhotos', 4), async (req, res) => {
    const { userId, hobbies, privacy, privatePhotos } = req.body;
    if (!supabase || !userId) return res.status(400).json({ success: false, error: 'User ID missing or no DB' });

    let photoUrls = [];
    if (req.files && req.files.length > 0) {
        photoUrls = req.files.map(file => file.path);
    }

    try {
        const updateData = {
            user_id: userId,
            hobbies: hobbies || '',
            privacy: privacy || 'public',
            private_photos: privatePhotos === 'true',
            last_seen: Date.now()
        };

        if (photoUrls.length > 0) {
            // Assume the 'photos' column can hold JSON array or similar.
            updateData.photos = photoUrls;
        }

        const { error } = await supabase.from('users').upsert(updateData);
        
        if (error) {
            console.error('Error updating profile:', error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
        res.json({ success: true, photoUrls });
    } catch(err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/profile-photo', upload.single('mediaFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    res.json({ url: req.file.path });
});

// --- SOCKET.IO ---
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('user_join', (data) => {
        activeSockets.set(socket.id, { userId: data.userId, name: data.name });
        socket.join('user_' + data.userId); // Join private room
        socket.broadcast.emit('user_joined', { name: data.name });
        if (data.userId) {
            io.emit('user_status_change', { userId: data.userId, status: 'online' });
        }
    });

    socket.on('chat_message', (data) => {
        socket.broadcast.emit('chat_message', {
            id: Date.now() + Math.random(),
            sender: data.sender,
            text: data.text,
            timestamp: Date.now()
        });
    });

    socket.on('private_message', async (data) => {
        if (!data || !data.toUserId || !data.text || !supabase) return;
        const msg = {
            sender_id: data.fromUserId,
            recipient_id: data.toUserId,
            sender_name: data.fromUserName,
            text: data.text,
            created_at: Date.now()
        };
        // Persist to Supabase
        const { error } = await supabase.from('private_messages').insert(msg);
        
        // Relay to recipient only
        io.to('user_' + data.toUserId).emit('private_message', msg);
    });

    socket.on('toggle_like', async (data) => {
        if (!data || !data.id) return;
        likesMap[data.id] = (likesMap[data.id] || 0) + 1;
        io.emit('update_like', { id: data.id, likes: likesMap[data.id] });
        if (supabase) {
            console.log('❤️ Toggling like for:', data.id);
            const { data: ex, error: fetchError } = await supabase.from('likes').select('likes').eq('media_id', data.id).single();
            if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
                console.error('❌ Error fetching like:', fetchError.message);
                return;
            }

            if (ex) {
                const { error: updErr } = await supabase.from('likes').update({ likes: ex.likes + 1 }).eq('media_id', data.id);
                if (updErr) console.error('❌ Error updating like:', updErr.message);
            } else {
                const { error: insErr } = await supabase.from('likes').insert({ media_id: data.id, likes: 1 });
                if (insErr) console.error('❌ Error inserting like:', insErr.message);
            }
        }
    });

    socket.on('blog_toggle_like', async (data) => {
        if (!data || !data.postId || !supabase) return;
        const { data: post } = await supabase.from('blog_posts').select('likes').eq('post_id', data.postId).single();
        if (post) {
            const newLikes = (post.likes || 0) + 1;
            await supabase.from('blog_posts').update({ likes: newLikes }).eq('post_id', data.postId);
            io.emit('blog_update_likes', { postId: data.postId, likes: newLikes });
        }
    });

    socket.on('blog_add_comment', async (data) => {
        if (!data || !data.postId || !supabase) return;
        const comment = { id: Date.now(), author: data.author, text: data.text, createdAt: Date.now() };
        const { data: post } = await supabase.from('blog_posts').select('comments').eq('post_id', data.postId).single();
        if (post) {
            const updated = [...(post.comments || []), comment];
            await supabase.from('blog_posts').update({ comments: updated }).eq('post_id', data.postId);
            io.emit('blog_new_comment', { postId: data.postId, comment });
        }
    });

    socket.on('delete_blog_post', async (data) => {
        if (!data || !data.postId || !supabase) return;
        const { data: post } = await supabase.from('blog_posts').select('user_id, media').eq('post_id', data.postId).single();
        if (post && post.user_id === data.userId) {
            if (post.media && post.media.name) try { await cloudinary.uploader.destroy(post.media.name); } catch(e) {}
            await supabase.from('blog_posts').delete().eq('post_id', data.postId);
            io.emit('blog_post_deleted', { postId: data.postId });
        }
    });

    socket.on('delete_media', async (data) => {
        if (!data || !data.id || !supabase) return;
        // In this simple version we allow delete if ID matches (frontend checks ownership)
        try {
            await cloudinary.uploader.destroy(data.id);
            io.emit('media_deleted', { id: data.id });
        } catch(err) { console.error(err); }
    });

    socket.on('disconnect', () => {
        const userData = activeSockets.get(socket.id);
        if (userData && userData.userId) {
            io.emit('user_status_change', { userId: userData.userId, status: 'offline' });
        }
        activeSockets.delete(socket.id);
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
