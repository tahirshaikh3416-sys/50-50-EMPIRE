const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let users = {
    "admin": { id: 1, username: "admin", password: "", points: 100000, role: "admin" },
    "dealer1": { id: 2, username: "dealer1", password: "", points: 5000, role: "dealer", commission: 0 },
    "player1": { id: 3, username: "player1", password: "", points: 1000, role: "player", dealer: "dealer1" }
};

(async () => {
    users.admin.password = await bcrypt.hash("admin123", 10);
    users.dealer1.password = await bcrypt.hash("dealer123", 10);
    users.player1.password = await bcrypt.hash("player123", 10);
})();

let currentMode = 'LAUNCH'; 
let timeLeft = 60; 
let lastResults = [];
let currentBets = []; 

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = users[username];
    if (!user) return res.json({ success: false, message: "यूजर नहीं मिला!" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.json({ success: false, message: "गलत पासवर्ड!" });
    res.json({ success: true, message: "लॉगिन सफल!", user: { id: user.id, username: user.username, points: user.points, role: user.role } });
});

app.post('/api/admin/update-mode', (req, res) => {
    const { newMode, username } = req.body;
    if (users[username] && users[username].role === 'admin') {
        currentMode = newMode;
        return res.json({ success: true, message: `गेम अब ${newMode} मोड पर काम कर रहा है!` });
    }
    res.json({ success: false, message: "अनुमति नहीं है!" });
});

setInterval(() => {
    if (timeLeft > 0) {
        timeLeft--;
        io.emit('timer_update', { timeLeft, currentMode });
    } else {
        let whiteTotal = 0, blackTotal = 0;
        currentBets.forEach(b => {
            if (b.color === 'White') whiteTotal += b.amount;
            if (b.color === 'Black') blackTotal += b.amount;
        });

        let winningColor;
        if (currentMode === 'LAUNCH') {
            if (crypto.randomInt(0, 100) < 70) {
                winningColor = (crypto.randomInt(0, 2) === 0) ? 'White' : 'Black';
            } else {
                winningColor = (whiteTotal < blackTotal) ? 'White' : 'Black';
            }
        } else {
            winningColor = (whiteTotal < blackTotal) ? 'White' : 'Black';
        }

        currentBets.forEach(b => {
            let playerObj = users[b.username];
            if (playerObj && playerObj.dealer) {
                let dealerObj = users[playerObj.dealer];
                if (dealerObj) {
                    let commissionEarned = (b.amount * 2) / 100; 
                    dealerObj.points += commissionEarned;
                    dealerObj.commission += commissionEarned;
                }
            }
        });

        currentBets.forEach(b => {
            if (b.color === winningColor) {
                if (users[b.username]) {
                    users[b.username].points += b.amount * 2;
                }
            }
        });

        lastResults.unshift(winningColor);
        if (lastResults.length > 10) lastResults.pop();

        io.emit('draw_result', { winningColor, history: lastResults });
        currentBets = [];
        timeLeft = 60;
    }
}, 1000);

io.on('connection', (socket) => {
    socket.on('place_bet', (data) => {
        const { username, color, amount } = data;
        if (users[username] && users[username].points >= amount) {
            users[username].points -= amount; 
            currentBets.push({ username, color, amount });
            socket.emit('bet_confirmed', { newBalance: users[username].points });
        } else {
            socket.emit('bet_failed', { message: "अपर्याप्त बैलेंस!" });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));