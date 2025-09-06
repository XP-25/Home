const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Create HTTP server to serve the HTML file
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading index.html');
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store multiple rooms
let rooms = {};
let roomCounter = 1;

// Artist data
const ARTISTS = [
  {
    name: "Kendrick Lamar",
    verse: "I'm a sinner who's probably gonna sin again, Lord forgive me!",
    color: "#643200",
    image: "kendrick.png"
  },
  {
    name: "Drake",
    verse: "Started from the bottom now we're here!",
    color: "#c49159",
    image: "drake.png"
  },
  {
    name: "Travis Scott",
    verse: "It's lit! Straight up!",
    color: "#8c5829",
    image: "travis.png"
  },
  {
    name: "Pusha T",
    verse: "If you know you know, it's not a game!",
    color: "#5a3a1a",
    image: "pusha.png"
  },
  {
    name: "21 Savage",
    verse: "I was born with a knife in my hand!",
    color: "#a46422",
    image: "savage.png"
  },
  {
    name: "Ritviz",
    verse: "Udd gaye, hum udd gaye, aasman ke parde!",
    color: "#f4b41c",
    image: "ritviz.png"
  },
  {
    name: "Chaar Diwari",
    verse: "Kya behenchod game hai yeh?",
    color: "#c2a284",
    image: "chaar.png"
  },
  {
    name: "Playboi Carti",
    verse: "What? What? What? Slatt!",
    color: "#d2b48c",
    image: "carti.png"
  },
  {
    name: "Future",
    verse: "Mask off, Molly, Percocet!",
    color: "#6d4c3d",
    image: "future.png"
  },
  {
    name: "M.I.A.",
    verse: "Live fast, die young, bad girls do it well!",
    color: "#a46422",
    image: "mia.png"
  },
  {
    name: "HanumanKind",
    verse: "Bajrang Bali ki jai!",
    color: "#e0ac69",
    image: "hanuman.png"
  },
  {
    name: "Kanye West",
    verse: "I am a god, even though I'm a man of God!",
    color: "#4a2a0a",
    image: "kanye.png"
  },
  {
    name: "Dr. Dre",
    verse: "Been there, done that, but I'm back for more!",
    color: "#8c6f5a",
    image: "dre.png"
  },
  {
    name: "Metro Boomin",
    verse: "If young Metro don't trust you, I'm gon' shoot you!",
    color: "#46250e",
    image: "metro.png"
  },
  {
    name: "SZA",
    verse: "I'm sorry I'm not more attractive, I'm sorry I'm not more ladylike!",
    color: "#a46422",
    image: "sza.png"
  },
  {
    name: "Lana Del Rey",
    verse: "My old man is a bad man, but I love him so!",
    color: "#f8d8be",
    image: "lana.png"
  }
];

// Initialize the first room
rooms[roomCounter] = {
  players: [],
  gameState: {
    students: [],
    teacher: { name: "MC Stan" },
    monitor: null,
    gameStarted: false
  }
};

wss.on('connection', function connection(ws, req) {
  console.log('New player connected');
  
  // Get client IP for logging
  const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log('Client connected from:', clientIP);
  
  // Find or create a room for the player
  let roomId = findAvailableRoom();
  let room = rooms[roomId];
  
  // Assign a unique ID to the player within the room
  const playerId = room.players.length;
  
  // Add to players list in the room
  room.players.push({
    id: playerId,
    ws: ws,
    name: null,
    ready: false,
    credits: 15,
    roomId: roomId
  });
  
  // Send current game state to the new player
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
  
  // Notify other players in the same room
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
          
          // Notify all players in the room
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
          
          // Start game if all players are ready in this room
          if (room.players.length === 4 && room.players.every(p => p.ready)) {
            startGame(roomId);
          }
          break;
          
        case 'chat_message':
          // Relay chat message to all players in the room
          broadcastToRoom(roomId, {
            type: 'chat_message',
            sender: room.players[playerId].name,
            text: message.text,
            studentId: playerId
          });
          
          // Simulate student talking
          broadcastToRoom(roomId, {
            type: 'student_talking',
            studentId: playerId
          });
          break;
          
        case 'student_caught':
          // Handle catching another student
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
              
              // If credits reach zero, expel the student
              if (targetStudent.credits <= 0) {
                targetStudent.isExpelled = true;
                broadcastToRoom(roomId, {
                  type: 'student_expelled',
                  studentId: message.studentId
                });
              } else {
                // Make the caught student the new monitor
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
    
    // Notify other players in the room
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
  
  ws.on('error', function error(err) {
    console.error('WebSocket error:', err);
  });
});

function findAvailableRoom() {
  // Find a room with available space
  for (const roomId in rooms) {
    if (rooms[roomId].players.length < 4) {
      return roomId;
    }
  }
  
  // If all rooms are full, create a new one
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
  console.log(`Starting game in room ${roomId} with ${rooms[roomId].players.length} players`);
  
  const room = rooms[roomId];
  
  // Initialize game state
  room.gameState.students = ARTISTS.slice(0, 4).map((artist, index) => ({
    id: index,
    name: artist.name,
    credits: room.players[index].credits,
    isStanding: false,
    isExpelled: false,
    benchmateId: index % 2 === 0 ? index + 1 : index - 1,
    color: artist.color,
    verse: artist.verse,
    image: artist.image
  }));
  
  // Randomly select first monitor
  room.gameState.monitor = Math.floor(Math.random() * room.players.length);
  room.gameState.gameStarted = true;
  
  // Notify all players in the room
  broadcastToRoom(roomId, {
    type: 'game_start',
    students: room.gameState.students,
    teacher: room.gameState.teacher,
    firstMonitor: room.gameState.monitor
  });
}
// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}`);
});
