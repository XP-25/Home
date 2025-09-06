const http = require('http');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

// Serve index.html and static assets
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading index.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }

  // Serve static files (images, js, css)
  const filePath = path.join(__dirname, req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(req.url).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.js') contentType = 'application/javascript';
    else if (ext === '.css') contentType = 'text/css';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

// Artist data (must have at least 16 entries)
const ARTISTS = [
  { name: "Kendrick Lamar", verse: "I'm a sinner who's probably gonna sin again, Lord forgive me!", color: "#643200", image: "ChaarDiwari.png" },
  { name: "Drake", verse: "Started from the bottom now we're here!", color: "#c49159", image: "ChaarDiwari.png" },
  { name: "Travis Scott", verse: "It's lit! Straight up!", color: "#8c5829", image: "ChaarDiwari.png" },
  { name: "Pusha T", verse: "If you know you know, it's not a game!", color: "#5a3a1a", image: "ChaarDiwari.png" },
  { name: "21 Savage", verse: "I was born with a knife in my hand!", color: "#a46422", image: "ChaarDiwari.png" },
  { name: "Ritviz", verse: "Udd gaye, hum udd gaye, aasman ke parde!", color: "#f4b41c", image: "ChaarDiwari.png" },
  { name: "Chaar Diwari", verse: "Kya behenchod game hai yeh?", color: "#c2a284", image: "ChaarDiwari.png" },
  { name: "Playboi Carti", verse: "What? What? What? Slatt!", color: "#d2b48c", image: "ChaarDiwari.png" },
  { name: "Future", verse: "Mask off, Molly, Percocet!", color: "#6d4c3d", image: "ChaarDiwari.png" },
  { name: "M.I.A.", verse: "Live fast, die young, bad girls do it well!", color: "#a46422", image: "ChaarDiwari.png" },
  { name: "HanumanKind", verse: "Bajrang Bali ki jai!", color: "#e0ac69", image: "ChaarDiwari.png" },
  { name: "Kanye West", verse: "I am a god, even though I'm a man of God!", color: "#4a2a0a", image: "ChaarDiwari.png" },
  { name: "Dr. Dre", verse: "Been there, done that, but I'm back for more!", color: "#8c6f5a", image: "ChaarDiwari.png" },
  { name: "Metro Boomin", verse: "If young Metro don't trust you, I'm gon' shoot you!", color: "#46250e", image: "ChaarDiwari.png" },
  { name: "SZA", verse: "I'm sorry I'm not more attractive, I'm sorry I'm not more ladylike!", color: "#a46422", image: "ChaarDiwari.png" },
  { name: "Lana Del Rey", verse: "My old man is a bad man, but I love him so!", color: "#f8d8be", image: "ChaarDiwari.png" }
];

let rooms = {};
let roomCounter = 1;
let playerCounter = 0;

// Initialize first room
rooms[roomCounter] = {
  players: [],
  gameState: {
    students: [],
    teacher: { name: "MC Stan" },
    monitor: null,
    gameStarted: false
  }
};

wss.on('connection', function connection(ws) {
  console.log('New player connected');

  let roomId = findAvailableRoom();
  let room = rooms[roomId];

  const playerId = playerCounter++;
  room.players.push({
    id: playerId,
    ws: ws,
    name: null,
    ready: false,
    credits: 15,
    roomId: roomId
  });

  ws.send(JSON.stringify({
    type: 'player_joined',
    playerId: playerId,
    roomId: roomId,
    players: room.players.filter(p => p.name).map(p => ({
      id: p.id,
      name: p.name,
      credits: p.credits,
      ready: p.ready
    }))
  }));

  ws.on('message', function incoming(data) {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'set_name':
          room.players.find(p => p.id === playerId).name = message.name;
          room.players.find(p => p.id === playerId).ready = true;

          ws.send(JSON.stringify({
            type: 'name_set',
            playerId: playerId,
            playerName: message.name,
            players: room.players.filter(p => p.name).map(p => ({
              id: p.id,
              name: p.name,
              credits: p.credits,
              ready: p.ready
            }))
          }));

          broadcastToRoom(roomId, {
            type: 'player_joined',
            playerId: playerId,
            playerName: message.name,
            players: room.players.filter(p => p.name).map(p => ({
              id: p.id,
              name: p.name,
              credits: p.credits,
              ready: p.ready
            }))
          }, ws);

          if (room.players.length >= 16 && room.players.every(p => p.ready)) {
            console.log("All players ready. Starting game...");
            startGame(roomId);
          } else {
            console.log("Players ready check:", room.players.map(p => ({ id: p.id, name: p.name, ready: p.ready })));
          }
          break;

        case 'chat_message':
          const senderName = room.players.find(p => p.id === playerId).name;
          broadcastToRoom(roomId, {
            type: 'chat_message',
            sender: senderName,
            text: message.text,
            studentId: playerId
          });
          broadcastToRoom(roomId, {
            type: 'student_talking',
            studentId: playerId
          });
          break;

        case 'student_caught':
          if (room.gameState.monitor === playerId && room.gameState.gameStarted) {
            const targetStudent = room.gameState.students.find(s => s.id === message.studentId);

            if (targetStudent && !targetStudent.isExpelled) {
              targetStudent.credits--;
              room.players.find(p => p.id === message.studentId).credits = targetStudent.credits;

              broadcastToRoom(roomId, {
                type: 'student_caught',
                studentId: message.studentId,
                credits: targetStudent.credits
              });

              if (targetStudent.credits <= 0) {
                targetStudent.isExpelled = true;
                broadcastToRoom(roomId, {
                  type: 'student_expelled',
                  studentId: message.studentId
                });
              } else {
                room.gameState.monitor = message.studentId;
                broadcastToRoom(roomId, {
                  type: 'new_monitor',
                  studentId: message.studentId
                });
              }
            }
          }
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', function close() {
    console.log('Player disconnected');

    room.players = room.players.filter(p => p.id !== playerId);

    if (room.gameState.monitor === playerId) {
      if (room.players.length > 0) {
        const newMonitor = room.players[Math.floor(Math.random() * room.players.length)].id;
        room.gameState.monitor = newMonitor;
        broadcastToRoom(roomId, { type: 'new_monitor', studentId: newMonitor });
      } else {
        room.gameState.monitor = null;
      }
    }

    broadcastToRoom(roomId, {
      type: 'player_left',
      playerId: playerId,
      players: room.players.filter(p => p.name).map(p => ({
        id: p.id,
        name: p.name,
        credits: p.credits,
        ready: p.ready
      }))
    });
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

function findAvailableRoom() {
  for (const id in rooms) {
    if (rooms[id].players.length < 16) {
      return id;
    }
  }
  roomCounter++;
  rooms[roomCounter] = {
    players: [],
    gameState: {
      students: [],
      teacher: { name: "MC Stan" },
      monitor: null,
      gameStarted: false
    }
  };
  return roomCounter;
}

function broadcastToRoom(roomId, message, excludeWs = null) {
  if (!rooms[roomId]) return;

  rooms[roomId].players.forEach(player => {
    if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(message));
    }
  });
}

function startGame(roomId) {
  const room = rooms[roomId];
  console.log(`Starting game in room ${roomId} with ${room.players.length} players`);

  room.gameState.students = room.players.map((player, index) => {
    const artist = ARTISTS[index % ARTISTS.length];
    return {
      id: player.id,
      name: artist.name,
      credits: player.credits,
      isStanding: false,
      isExpelled: false,
      benchmateId: null,
      color: artist.color,
      verse: artist.verse,
      image: artist.image
    };
  });

  room.gameState.students.forEach((s, i) => {
    s.benchmateId = i % 2 === 0 ? room.gameState.students[i + 1]?.id : room.gameState.students[i - 1]?.id;
  });

  room.gameState.monitor = room.players[Math.floor(Math.random() * room.players.length)].id;
  room.gameState.gameStarted = true;

  broadcastToRoom(roomId, {
    type: 'game_start',
    students: room.gameState.students,
    teacher: room.gameState.teacher,
    firstMonitor: room.gameState.monitor
  });
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`HTTP and WebSocket server running on port ${PORT}`);
});
