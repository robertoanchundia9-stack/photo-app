const QRCode = require('qrcode');
const path = require('path');
const { networkInterfaces } = require('os');

// Use 192.168.0.117 as it was valid from the server log, or fallback
const url = 'http://192.168.0.117:3000';
const parentDir = path.join(__dirname, '..');
const outputPath = path.join(parentDir, 'QR_ZARAMARINA.png');

QRCode.toFile(outputPath, url, {
    color: {
        dark: '#ff00ff',  // Neon Pink QR
        light: '#090a0f'  // Dark background
    },
    width: 800
}, function (err) {
    if (err) throw err;
    console.log('¡QR Code guardado en: ' + outputPath + '!');
});
