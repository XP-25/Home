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
      res.writeHead(200, {'Content-Type': 'text/html'});
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
    res.writeHead(200, {'Content-Type': contentType});
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

// Artist data (must have at least 16 entries)
const ARTISTS = [
  { name: "Kendrick Lamar", verse: "I'm a sinner who's probably gonna sin again, Lord forgive me!", color: "#643200", image: "kendrick.png" },
  { name: "Drake", verse: "Started from the bottom now we're here!", color: "#c49159", image: "drake.png" },
  { name: "Travis Scott", verse: "It's lit! Straight up!", color: "#8c5829", image: "travis.png" },
  { name: "Pusha T", verse: "If you know you know, it's not a game!", color: "#5a3a1a", image: "pusha.png" },
  { name: "21 Savage", verse: "I was born with a knife in my hand!", color: "#a46422", image: "savage.png" },
  { name: "Ritviz", verse: "Udd gaye, hum udd gaye, aasman ke parde!", color: "#f4b41c", image: "ritviz.png" },
  { name: "Chaar Diwari", verse: "Kya behenchod game hai yeh?", color: "#c2a284", image: "chaar.png" },
  { name: "Playboi Carti", verse: "What? What? What? Slatt!", color: "#d2b48c", image: "carti.png" },
  { name: "Future", verse: "Mask off, Molly, Percocet!", color: "#6d4c3d", image: "future.png" },
  { name: "M.I.A.", verse: "Live fast, die young, bad girls do it well!", color: "#a46422", image: "mia.png" },
  { name: "HanumanKind", verse: "Bajrang Bali ki jai!", color: "#e0ac69", image: "hanuman.png" },
  { name: "Kanye West", verse: "I am a god, even though I'm a man of God!", color: "#4a2a0a", image: "kanye.png" },
  { name: "Dr. Dre", verse: "Been there, done that, but I'm back for more!", color: "#8c6f5a", image: "dre.png" },
  { name: "Metro Boomin", verse: "If young Metro don't trust you, I'm gon' shoot you!", color: "#46250e", image: "metro.png" },
  { name: "SZA", verse: "I'm sorry I'm not more attractive, I'm sorry I'm not more ladylike!", color: "#a46422", image: "sza.png" },
  { name: "Lana Del Rey", verse: "My old man is a bad man, but I love him so!", color: "#f8d8be", image: "lana.png" }
];

let rooms = {};
let roomCounter = 1;

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

  // Assign player ID based on current players count
  const playerId = room.players.length;

  // Add player
  room.players.push({
    id: playerId,
    ws: ws,
    name: null,
    ready: false,
    credits: 15,
    roomId: roomId
  });

  // Send initial info to new player
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

  // Notify others
  broadcastToRoom(roomId, {
    type: 'player_joined',
    playerId: playerId,
    playerName: null,
    players: room.players.filter(p => p.name).map(p => ({
      id: p.id,
      name: p.name,
      credits: p.credits,
      ready: p.ready
    }))
  }, ws);

  ws.on('message', function incoming(data) {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'set_name':
          room.players[playerId].name = message.name;
          room.players[playerId].ready = true;

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
          });

          // Start game only when exactly 16 players and all ready
          if (room.players.length === 16 && room.players.every(p => p.ready)) {
            startGame(roomId);
          }
          break;

        case 'chat_message':
          broadcastToRoom(roomId, {
            type: 'chat_message',
            sender: room.players[playerId].name,
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
            const targetStudent = room.gameState.students[message.studentId];

            if (targetStudent && !targetStudent.isExpelled) {
              targetStudent.credits--;
              room.players[message.studentId].credits = targetStudent.credits;

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

    // Remove player from room
    room.players = room.players.filter(p => p.id !== playerId);

    // Reset monitor if needed
    if (room.gameState.monitor === playerId) {
      room.gameState.monitor = null; // Optionally assign a new monitor here
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
    const artist = ARTISTS[index];
    return {
      id: index,
      name: artist.name,
      credits: player.credits,
      isStanding: false,
      isExpelled: false,
      benchmateId: index % 2 === 0 ? index + 1 : index - 1,
      color: artist.color,
      verse: artist.verse,
      image: artist.image
    };
  });

  room.gameState.monitor = Math.floor(Math.random() * room.players.length);
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
