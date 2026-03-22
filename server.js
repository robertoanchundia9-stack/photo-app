const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Local uploads directory
const mediaDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir);
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/media', express.static(mediaDir)); // Serve media

// Multer Setup
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, mediaDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

// Supported Extensions
const VALID_EXTS = ['.png', '.jpg', '.jpeg', '.mp4', '.gif'];

// API: Get Media
app.get('/api/media', (req, res) => {
    fs.readdir(mediaDir, (err, files) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to read directory' });
        }
        
        const mediaFiles = files.filter(f => {
            const ext = path.extname(f).toLowerCase();
            return VALID_EXTS.includes(ext);
        }).map(f => {
            const filePath = path.join(mediaDir, f);
            const stats = fs.statSync(filePath);
            return {
                name: f,
                url: `/media/${encodeURIComponent(f)}`,
                type: (path.extname(f).toLowerCase() === '.mp4') ? 'video' : 'image',
                createdAt: stats.mtimeMs // use modified time
            };
        });
        
        // Sort descending by date
        mediaFiles.sort((a, b) => b.createdAt - a.createdAt);
        
        res.json(mediaFiles);
    });
});

// API: Upload Media
app.post('/api/upload', upload.single('mediaFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileObj = {
        name: req.file.filename,
        url: `/media/${encodeURIComponent(req.file.filename)}`,
        type: (path.extname(req.file.filename).toLowerCase() === '.mp4') ? 'video' : 'image',
        createdAt: Date.now()
    };
    
    // Notify clients to refresh
    io.emit('new_media', fileObj);
    
    res.json({ success: true, file: fileObj });
});

// Socket.io for Chat
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Send history or just handle realtime
    socket.on('user_join', (data) => {
        socket.broadcast.emit('user_joined', { name: data.name });
    });

    socket.on('chat_message', (data) => {
        // Broadcast message to everyone including sender, or just broadcast
        // Let's broadcast to everyone except sender, sender updates locally
        socket.broadcast.emit('chat_message', {
            id: Date.now() + Math.random(),
            sender: data.sender,
            avatar: data.avatar,
            text: data.text,
            timestamp: Date.now()
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Access the app locally at http://localhost:${PORT}`);
    // Optional: try to print local IP
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
