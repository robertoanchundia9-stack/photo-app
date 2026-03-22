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
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'photo-app',
    resource_type: 'auto', // supports both images and video
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'mp4', 'mov']
  },
});
const upload = multer({ storage: storage });

// API: Get Media
app.get('/api/media', async (req, res) => {
    try {
        if (!process.env.CLOUDINARY_API_KEY) {
            // Fallback for local testing if no Cloudinary keys
            return res.json([]);
        }

        const { resources } = await cloudinary.search
            .expression('folder:photo-app')
            .sort_by('created_at', 'desc')
            .max_results(100)
            .execute();
            
        const mediaFiles = resources.map(item => {
            return {
                name: item.public_id,
                url: item.secure_url,
                type: item.resource_type === 'video' ? 'video' : 'image',
                createdAt: new Date(item.created_at).getTime(),
                likes: likesMap[item.public_id] || 0
            };
        });
        
        res.json(mediaFiles);
    } catch (err) {
        console.error("Cloudinary fetch error:", err);
        res.status(500).json({ error: 'Failed to fetch media from Cloudinary' });
    }
});

// API: Upload Media
app.post('/api/upload', upload.single('mediaFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Cloudinary returns the full URL in `req.file.path`
    const isVideo = req.file.mimetype && req.file.mimetype.startsWith('video');
    const fileObj = {
        name: req.file.filename,
        url: req.file.path,
        type: isVideo ? 'video' : 'image',
        createdAt: Date.now()
    };
    
    // Notify clients to refresh
    io.emit('new_media', fileObj);
    
    res.json({ success: true, file: fileObj });
});

// Socket.io for Chat
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('user_join', (data) => {
        socket.broadcast.emit('user_joined', { name: data.name });
    });

    socket.on('chat_message', (data) => {
        socket.broadcast.emit('chat_message', {
            id: Date.now() + Math.random(),
            sender: data.sender,
            avatar: data.avatar,
            text: data.text,
            timestamp: Date.now()
        });
    });

    socket.on('toggle_like', (data) => {
        if (!data || !data.id) return;
        likesMap[data.id] = (likesMap[data.id] || 0) + 1;
        io.emit('update_like', { id: data.id, likes: likesMap[data.id] });
    });

    socket.on('delete_media', async (data) => {
        if (!data || !data.id) return;
        try {
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
