const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = 8080;

// Static file server
const server = http.createServer((req, res) => {
  let filePath = req.url === "/" ? "index.html" : req.url;
  filePath = path.join(__dirname, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
    } else {
      let ext = path.extname(filePath).toLowerCase();
      let type = "text/html";
      if (ext === ".js") type = "application/javascript";
      if (ext === ".css") type = "text/css";
      if (ext === ".png") type = "image/png";
      if (ext === ".jpg" || ext === ".jpeg") type = "image/jpeg";
      res.writeHead(200, { "Content-Type": type });
      res.end(data);
    }
  });
});

// WebSocket server
const wss = new WebSocket.Server({ server });

let rooms = {};
let roomCounter = 1;
let playerCounter = 0;

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

// Broadcast helper
function broadcast(roomId, msg) {
  if (!rooms[roomId]) return;
  
  rooms[roomId].players.forEach(p => {
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify(msg));
    }
  });
}

// Start game
function startGame(roomId) {
  let room = rooms[roomId];
  room.gameState.started = true;
  
  // Assign artist data to each player
  room.players.forEach((player, index) => {
    player.artist = ARTISTS[index];
    player.isExpelled = false;
    player.isStanding = false;
    player.isTalking = false;
  });
  
  room.gameState.monitor = room.players[Math.floor(Math.random() * room.players.length)].id;
  
  broadcast(roomId, { 
    type: "game_start", 
    students: room.players, 
    teacher: { name: "MC Stan" }, 
    firstMonitor: room.gameState.monitor 
  });
}

wss.on("connection", ws => {
  let roomId;
  let playerId;

  // Assign room
  let room = Object.values(rooms).find(r => r.players.length < 16);
  if (!room) {
    roomId = "room" + roomCounter++;
    rooms[roomId] = { players: [], gameState: { started: false, monitor: null } };
  } else {
    roomId = Object.keys(rooms).find(k => rooms[k] === room);
  }

  playerId = playerCounter++;
  let player = {
    id: playerId,
    name: "Waiting...",
    credits: 15,
    ws,
    ready: false
  };
  rooms[roomId].players.push(player);

  // Send player their ID and room info
  ws.send(JSON.stringify({ 
    type: "player_joined", 
    playerId: playerId,
    roomId: roomId,
    players: rooms[roomId].players
  }));

  // Inform everyone about the new player
  broadcast(roomId, { 
    type: "player_joined", 
    player: player,
    players: rooms[roomId].players
  });

  ws.on("message", msg => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (e) {
      console.error("Error parsing message:", e);
      return;
    }

    if (data.type === "set_name") {
      player.name = data.name;
      player.ready = true;
      
      // Update the player's own view
      ws.send(JSON.stringify({ 
        type: "update_state", 
        player: player 
      }));
      
      // Inform others
      broadcast(roomId, { 
        type: "update_state", 
        player: player 
      });

      // Check if game can start
      let room = rooms[roomId];
      if (room.players.length >= 2 && room.players.every(p => p.ready) && !room.gameState.started) {
        startGame(roomId);
      }
    }

    if (data.type === "chat_message") {
      broadcast(roomId, { 
        type: "chat_message", 
        sender: player.name, 
        text: data.text,
        studentId: playerId 
      });
      
      // Show talking animation
      broadcast(roomId, { 
        type: "student_talking", 
        studentId: playerId 
      });
    }

    if (data.type === "student_caught") {
      if (rooms[roomId].gameState.monitor !== playerId) return;
      
      let target = rooms[roomId].players.find(p => p.id === data.studentId);
      if (!target) return;
      
      target.credits--;
      
      if (target.credits <= 0) {
        target.isExpelled = true;
        broadcast(roomId, { 
          type: "student_expelled", 
          studentId: target.id 
        });
      } else {
        rooms[roomId].gameState.monitor = target.id;
        broadcast(roomId, { 
          type: "student_caught", 
          studentId: target.id,
          credits: target.credits
        });
        
        broadcast(roomId, { 
          type: "new_monitor", 
          studentId: target.id 
        });
      }
    }
  });

  ws.on("close", () => {
    if (rooms[roomId]) {
      rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== playerId);
      broadcast(roomId, { 
        type: "player_left", 
        playerId: playerId,
        players: rooms[roomId].players
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
