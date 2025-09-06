const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

let rooms = {};
let roomCounter = 1;

wss.on('connection', (ws) => {
  let player = { id: null, name: null, roomId: null };

  ws.on('message', (msg) => {
    const data = JSON.parse(msg);

    if (data.type === "set_name") {
      player.name = data.name;

      let room = Object.values(rooms).find(r => r.players.length < 16);
      if (!room) {
        room = { id: roomCounter++, players: [] };
        rooms[room.id] = room;
      }

      player.id = room.players.length;
      player.roomId = room.id;
      room.players.push(player);

      broadcast(room, {
        type: "player_joined",
        players: room.players,
        playerId: player.id,
        playerName: player.name,
        roomId: room.id
      });

      if (room.players.length >= 2) {
        startGame(room);
      }
    }

    if (data.type === "chat_message") {
      const room = rooms[player.roomId];
      if (room) {
        broadcast(room, {
          type: "chat_message",
          sender: player.name,
          text: data.text
        });
      }
    }

    if (data.type === "student_caught") {
      const room = rooms[player.roomId];
      if (room) {
        broadcast(room, {
          type: "student_caught",
          studentId: data.studentId,
          credits: 10
        });
      }
    }
  });

  ws.on('close', () => {
    const room = rooms[player.roomId];
    if (room) {
      room.players = room.players.filter(p => p.id !== player.id);
      broadcast(room, { type: "player_left", players: room.players });
    }
  });

  function broadcast(room, message) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  function startGame(room) {
    const students = room.players.map((p, i) => ({
      id: i,
      name: p.name,
      credits: 15,
      isExpelled: false,
      isStanding: false
    }));

    const teacher = { name: "Teacher" };
    const firstMonitor = 0;

    broadcast(room, {
      type: "game_start",
      students,
      teacher,
      firstMonitor
    });
  }
});
