const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let dealers = {};
for (let i = 1; i <= 10; i++) {
    let id = `Dealer_${i < 10 ? '0' + i : i}`;
    dealers[id] = { id: id, password: `pass${i}23`, points: 50000, commission: 0, isBlocked: false };
}

let gameState = { timer: 60, currentResult: null, adminOverrideMode: 'random', bets: { black: 0, white: 0 } };

setInterval(() => {
    if (gameState.timer > 0) {
        gameState.timer--;
    } else {
        let winColor = gameState.adminOverrideMode === 'force_black' ? 'black' : 
                       gameState.adminOverrideMode === 'force_white' ? 'white' : 
                       Math.random() < 0.5 ? 'black' : 'white';
        gameState.currentResult = winColor;
        io.emit('wheelSpin', { result: winColor });
        setTimeout(() => { gameState.timer = 60; gameState.bets = { black: 0, white: 0 }; io.emit('gameReset', gameState); }, 5000);
    }
    io.emit('timerUpdate', { timer: gameState.timer, bets: gameState.bets });
}, 1000);

app.post('/api/admin/control', (req, res) => {
    const { action, dealerId, value } = req.body;
    if (action === 'set_mode') { gameState.adminOverrideMode = value; return res.json({ success: true, adminOverrideMode: gameState.adminOverrideMode }); }
    if (dealers[dealerId]) {
        if (action === 'change_password') dealers[dealerId].password = value;
        else if (action === 'transfer_points') dealers[dealerId].points += parseInt(value);
        else if (action === 'clear_points') dealers[dealerId].points = 0;
        else if (action === 'toggle_block') dealers[dealerId].isBlocked = !dealers[dealerId].isBlocked;
    }
    io.emit('dealerUpdate', dealers);
    res.json({ success: true, dealers, adminOverrideMode: gameState.adminOverrideMode });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
