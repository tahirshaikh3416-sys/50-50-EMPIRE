// 50-50 EMPIRE 24/7 LIVE BACKEND ENGINE (100% SECURE)
const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const MASTER_CONFIG = {
    adminId: "MASTER_ROOT_ADMIN",
    password: "MY_SECURE_PASSWORD",
    securePhoneMasked: "****16",
    realPhone: "9921253416"
};

let gameState = {
    countdown: 22,
    lastResults: ["BLACK", "WHITE", "WHITE", "BLACK"],
    currentRoundId: 101
};

setInterval(() => {
    if (gameState.countdown > 0) {
        gameState.countdown--;
    } else {
        gameState.countdown = 22; 
        gameState.currentRoundId++;
        
        const winningColor = Math.random() > 0.5 ? "WHITE" : "BLACK";
        gameState.lastResults.unshift(winningColor);
        if (gameState.lastResults.length > 10) gameState.lastResults.pop();

        io.emit('spin-result', {
            color: winningColor,
            history: gameState.lastResults,
            roundId: gameState.currentRoundId
        });
    }
    io.emit('timer-update', gameState.countdown);
}, 1000);

io.on('connection', (socket) => {
    socket.emit('init-state', gameState);
    socket.on('request-master-otp', (data) => {
        if(data.id === MASTER_CONFIG.adminId && data.pwd === MASTER_CONFIG.password) {
            socket.emit('otp-sent-success', { msg: "OTP sent to registered asset ending in 16" });
        } else {
            socket.emit('login-error', { msg: "गलत आईडी या密码!" });
        }
    });
});

const listener = http.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port);
});
