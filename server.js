const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// In-memory likes storage
const likesMap = {};
// In-memory blog posts storage
const blogPosts = [];

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cloudinary Storage Setup
// Cloudinary Storage Setup - Allowing dynamic params for userId
// Gallery Storage
const galleryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => ({
    folder: 'photo-app',
    resource_type: 'auto',
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'mp4', 'mov'],
    context: { userId: req.body.userId || 'anonymous' }
  }),
});

// Profile Storage (No Socket Emit)
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => ({
    folder: 'photo-app-profiles',
    resource_type: 'image',
    allowed_formats: ['jpg', 'png', 'jpeg'],
  }),
});

const upload = multer({ storage: galleryStorage });
const profileUpload = multer({ storage: profileStorage });

// API: Get Media
app.get('/api/media', async (req, res) => {
    try {
        if (!process.env.CLOUDINARY_API_KEY) {
            // Fallback for local testing if no Cloudinary keys
            return res.json([]);
        }

        const { resources } = await cloudinary.search
            .expression('folder:photo-app')
            .with_field('context')
            .sort_by('created_at', 'desc')
            .max_results(100)
            .execute();
            
        const mediaFiles = resources.map(item => {
            return {
                name: item.public_id,
                url: item.secure_url,
                type: item.resource_type === 'video' ? 'video' : 'image',
                createdAt: new Date(item.created_at).getTime(),
                likes: likesMap[item.public_id] || 0,
                userId: item.context?.userId || 'anonymous'
            };
        });
        
        res.json(mediaFiles);
    } catch (err) {
        console.error("Cloudinary fetch error:", err);
        res.status(500).json({ error: 'Failed to fetch media from Cloudinary' });
    }
});

// API: Upload Media (GALLERY)
app.post('/api/upload', upload.single('mediaFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const isVideo = req.file.mimetype && req.file.mimetype.startsWith('video');
    const fileObj = {
        name: req.file.filename,
        url: req.file.path,
        type: isVideo ? 'video' : 'image',
        createdAt: Date.now(),
        userId: req.body.userId || 'anonymous'
    };
    
    io.emit('new_media', fileObj);
    res.json({ success: true, file: fileObj });
});

// API: Upload Profile Photo (PRIVATE)
app.post('/api/profile-photo', profileUpload.single('mediaFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: req.file.path });
});

// API: Get Blog Posts
app.get('/api/blog', (req, res) => {
    res.json(blogPosts);
});

// API: Create Blog Post
app.post('/api/blog', upload.single('mediaFile'), (req, res) => {
    const { text, author } = req.body;
    let fileObj = null;

    if (req.file) {
        const isVideo = req.file.mimetype && req.file.mimetype.startsWith('video');
        fileObj = {
            name: req.file.filename,
            url: req.file.path,
            type: isVideo ? 'video' : 'image'
        };
    }

    const post = {
        id: Date.now() + '-' + Math.round(Math.random() * 1000),
        text: text || '',
        author: author || 'Anónimo',
        authorPhoto: req.body.authorPhoto,
        userId: req.body.userId || 'anonymous',
        media: fileObj,
        createdAt: Date.now(),
        likes: 0,
        comments: []
    };

    blogPosts.unshift(post); // newest first
    io.emit('new_blog_post', post);
    
    res.json({ success: true, post });
});

// Socket.io
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('user_join', (data) => {
        socket.broadcast.emit('user_joined', { name: data.name });
    });

    socket.on('chat_message', (data) => {
        socket.broadcast.emit('chat_message', {
            id: Date.now() + Math.random(),
            sender: data.sender,
            text: data.text,
            timestamp: Date.now()
        });
    });

    socket.on('toggle_like', (data) => {
        if (!data || !data.id) return;
        likesMap[data.id] = (likesMap[data.id] || 0) + 1;
        io.emit('update_like', { id: data.id, likes: likesMap[data.id] });
    });

    // Blog interactions
    socket.on('blog_toggle_like', (data) => {
        const post = blogPosts.find(p => p.id === data.postId);
        if (post) {
            post.likes = (post.likes || 0) + 1;
            io.emit('blog_update_likes', { postId: post.id, likes: post.likes });
        }
    });

    socket.on('blog_add_comment', (data) => {
        const post = blogPosts.find(p => p.id === data.postId);
        if (post) {
            if (!post.comments) post.comments = [];
            const comment = {
                id: Date.now(),
                author: data.author,
                text: data.text,
                createdAt: Date.now()
            };
            post.comments.push(comment);
            io.emit('blog_new_comment', { postId: post.id, comment });
        }
    });

    socket.on('delete_blog_post', async (data) => {
        const index = blogPosts.findIndex(p => p.id === data.postId);
        if (index !== -1) {
            const post = blogPosts[index];
            // Validate Ownership
            if (post.userId !== data.userId) {
                console.log('Unauthorized delete attempt');
                return;
            }

            if (post.media && post.media.name) {
                try {
                    await cloudinary.uploader.destroy(post.media.name);
                } catch(err) {
                    console.error('Failed to delete media:', err);
                }
            }
            blogPosts.splice(index, 1);
            io.emit('blog_post_deleted', { postId: data.postId });
        }
    });

    socket.on('delete_media', async (data) => {
        if (!data || !data.id || !data.userId) return;
        try {
            // Verify ownership in Cloudinary metadata
            const res = await cloudinary.api.resource(data.id);
            const ownerId = res.context && res.context.custom ? res.context.custom.userId : 'anonymous';
            
            if (ownerId !== data.userId) {
                console.log('Unauthorized media delete attempt');
                return;
            }

            await cloudinary.uploader.destroy(data.id);
            io.emit('media_deleted', { id: data.id });
        } catch(err) {
            console.error('Failed to delete media:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Access the app locally at http://localhost:${PORT}`);
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`Access from mobile via http://${net.address}:${PORT}`);
            }
        }
    }
});
