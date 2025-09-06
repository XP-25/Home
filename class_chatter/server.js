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
  { name: "Kendrick Lamar", verse: "I'm a sinner...", color: "#643200", image: "kendrick.png" },
  { name: "Drake", verse: "Started from the bottom...", color: "#002244", image: "drake.png" },
  { name: "J. Cole", verse: "No role models...", color: "#2f4f2f", image: "cole.png" },
  { name: "Travis Scott", verse: "It's lit!", color: "#ff6600", image: "travis.png" },
  { name: "Kanye West", verse: "Can't tell me nothing...", color: "#990000", image: "kanye.png" },
  { name: "Future", verse: "Mask on...", color: "#003366", image: "future.png" },
  { name: "Lil Wayne", verse: "A milli...", color: "#006600", image: "wayne.png" },
  { name: "Eminem", verse: "Lose yourself...", color: "#000000", image: "eminem.png" },
  { name: "50 Cent", verse: "Go shawty...", color: "#333333", image: "50cent.png" },
  { name: "Nas", verse: "The world is yours...", color: "#663300", image: "nas.png" },
  { name: "Jay-Z", verse: "Empire state...", color: "#000099", image: "jayz.png" },
  { name: "Snoop Dogg", verse: "Drop it like it's hot...", color: "#3366cc", image: "snoop.png" },
  { name: "Ice Cube", verse: "Today was a good day...", color: "#444444", image: "icecube.png" },
  { name: "Nicki Minaj", verse: "Super bass...", color: "#ff00ff", image: "nicki.png" },
  { name: "Cardi B", verse: "I like it like that...", color: "#cc0066", image: "cardi.png" },
  { name: "A$AP Rocky", verse: "Praise the Lord...", color: "#6600cc", image: "asap.png" }
];

// Broadcast helper
function broadcast(roomId, msg) {
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
  room.gameState.monitor = room.players[Math.floor(Math.random() * room.players.length)].id;
  broadcast(roomId, { type: "game_start", students: room.players, monitor: room.gameState.monitor });
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

  // Inform everyone
  broadcast(roomId, { type: "player_joined", player });

  ws.on("message", msg => {
    let data = JSON.parse(msg);

    if (data.type === "set_name") {
      player.name = data.name;
      player.ready = true;
      broadcast(roomId, { type: "update_state", player });

      // Check if game can start
      let room = rooms[roomId];
      if (room.players.length >= 16 && room.players.every(p => p.ready) && !room.gameState.started) {
        startGame(roomId);
      }
    }

    if (data.type === "chat_message") {
      broadcast(roomId, { type: "chat_message", playerId, message: data.message });
    }

    if (data.type === "student_caught") {
      if (rooms[roomId].gameState.monitor !== playerId) return;
      let target = rooms[roomId].players.find(p => p.id === data.targetId);
      if (!target) return;
      target.credits--;
      if (target.credits <= 0) {
        broadcast(roomId, { type: "student_expelled", studentId: target.id });
      } else {
        rooms[roomId].gameState.monitor = target.id;
        broadcast(roomId, { type: "student_caught", studentId: target.id });
      }
    }
  });

  ws.on("close", () => {
    rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== playerId);
    broadcast(roomId, { type: "player_left", playerId });
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
