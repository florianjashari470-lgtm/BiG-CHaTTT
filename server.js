const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Kjo i thotë serverit ku me i gjet file-at (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
   
});




const PORT = 8000;

http.listen(PORT, () => {
    console.log(`Serveri u ndez në portin ${PORT}`);
});

let waitingUsers = [];

io.on('connection', (socket) => {
    // Trego sa njerëz janë online për të gjithë
    io.emit('onlineCount', io.engine.clientsCount);

    socket.on('join', (country) => {
        socket.country = country;
        
        // Gjej dikë që po pret (mundësisht nga i njëjti shtet, ose cfardo)
        let partnerIndex = waitingUsers.findIndex(u => u.id !== socket.id && (u.country === country || country === 'All' || u.country === 'All'));
        
        if (partnerIndex !== -1) {
            let partner = waitingUsers.splice(partnerIndex, 1)[0];
            let room = socket.id + '#' + partner.id;
            
            socket.join(room);
            io.sockets.sockets.get(partner.id).join(room);
            
            socket.room = room;
            partner.room = room;
            
            // I tregon të dyve që u lidhën. I pari (partner) fillon thirrjen
            io.to(socket.id).emit('matched', { initiator: false });
            io.to(partner.id).emit('matched', { initiator: true });
        } else {
            waitingUsers.push(socket);
            socket.emit('waiting');
        }
    });

    socket.on('signal', (data) => {
        socket.to(socket.room).emit('signal', data);
    });

    socket.on('skip', () => {
        socket.to(socket.room).emit('partnerLeft');
        socket.leave(socket.room);
        socket.room = null;
    });

    socket.on('disconnect', () => {
        waitingUsers = waitingUsers.filter(u => u.id !== socket.id);
        if (socket.room) {
            socket.to(socket.room).emit('partnerLeft');
        }
        io.emit('onlineCount', io.engine.clientsCount);
    });
});

