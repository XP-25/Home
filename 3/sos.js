const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] } // TODO: Restrict to your frontend domain in production, e.g., 'https://raisexp.games'
});

// ---- In-memory state ----
const rooms = {};
const waitingPlayers = []; // single queue for all devices now

// ---- Helpers ----
function makeRoomCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function determineGridSize(type1, type2) {
  if (type1 === 'desktop' && type2 === 'desktop') return 8;
  return 6; // any mobile involvement → 6x6
}

function emitStartGameToBoth(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.players.length !== 2) return;
  const [p1, p2] = room.players;
  const playerNames = { player1: p1.name, player2: p2.name };
  io.to(p1.id).emit('startGame', {
    roomCode,
    nboard: room.nboard,
    playerNames,
    myPlayer: 'player1'
  });
  io.to(p2.id).emit('startGame', {
    roomCode,
    nboard: room.nboard,
    playerNames,
    myPlayer: 'player2'
  });
}

// Sanitize names: allow alphanumeric, spaces, and basic punctuation; trim and limit length
function sanitizeName(name) {
  if (typeof name !== 'string') return '';
  return name.trim().replace(/[^a-zA-Z0-9\\s\\.\\-]/g, '').substring(0, 50); // Max 50 chars
}

// Sanitize room codes: uppercase alphanumeric only
function sanitizeRoomCode(roomCode) {
  if (typeof roomCode !== 'string') return '';
  return roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Sanitize deviceType: only allow 'mobile' or 'desktop'
function sanitizeDeviceType(deviceType) {
  if (deviceType === 'mobile' || deviceType === 'desktop') return deviceType;
  return 'desktop'; // Default fallback
}

// Sanitize move data: validate piece, row, col against grid size
function sanitizeMove(piece, row, col, nboard) {
  const validPiece = (piece === 'S' || piece === 'O') ? piece : null;
  const validRow = Number.isInteger(row) && row >= 0 && row < nboard ? row : null;
  const validCol = Number.isInteger(col) && col >= 0 && col < nboard ? col : null;
  return { validPiece, validRow, validCol };
}

// ---- Socket.IO ----
io.on('connection', (socket) => {

  // Create a private room
  socket.on('createRoom', ({ name, deviceType }) => {
    const safeName = sanitizeName(name);
    const safeDeviceType = sanitizeDeviceType(deviceType);
    if (!safeName) {
      socket.emit('roomCreated', { success: false, message: 'Invalid name.' });
      return;
    }
    const roomCode = makeRoomCode();
    rooms[roomCode] = {
      players: [{ id: socket.id, name: safeName, deviceType: safeDeviceType }],
      started: false,
      nboard: null
    };
    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode });
  });

  // Join a private room
  socket.on('joinRoom', ({ name, roomCode, deviceType }) => {
    const safeName = sanitizeName(name);
    const safeRoomCode = sanitizeRoomCode(roomCode);
    const safeDeviceType = sanitizeDeviceType(deviceType);
    if (!safeName || !safeRoomCode) {
      socket.emit('joinedRoom', { success: false, message: 'Invalid name or room code.' });
      return;
    }
    const room = rooms[safeRoomCode];
    if (!room) {
      socket.emit('joinedRoom', { success: false, message: 'Room not found.' });
      return;
    }
    if (room.started) {
      socket.emit('joinedRoom', { success: false, message: 'Game already started.' });
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('joinedRoom', { success: false, message: 'Room is full.' });
      return;
    }
    if (room.players.some(p => p.name === safeName)) {
      socket.emit('joinedRoom', { success: false, message: 'Name already taken in this room.' });
      return;
    }
    room.players.push({ id: socket.id, name: safeName, deviceType: safeDeviceType });
    socket.join(safeRoomCode);
    socket.emit('joinedRoom', { success: true, roomCode: safeRoomCode });
    io.to(room.players[0].id).emit('playerJoined', { name: safeName });
  });

  // Start game (by creator)
  socket.on('startGame', ({ roomCode }) => {
    const safeRoomCode = sanitizeRoomCode(roomCode);
    const room = rooms[safeRoomCode];
    if (!room || room.players.length !== 2) return;
    if (room.players[0].id !== socket.id) return;
    if (room.started) return;
    room.nboard = determineGridSize(room.players[0].deviceType, room.players[1].deviceType);
    room.started = true;
    emitStartGameToBoth(safeRoomCode);
  });

  // Matchmaking (desktop ↔ mobile supported)
  socket.on('findOpponent', ({ name, deviceType }) => {
    const safeName = sanitizeName(name);
    const safeDeviceType = sanitizeDeviceType(deviceType);
    if (!safeName) {
      socket.emit('findOpponentResult', { success: false, message: 'Invalid name.' });
      return;
    }
    if (waitingPlayers.some(p => p.name === safeName)) {
      socket.emit('findOpponentResult', { success: false, message: 'Name already taken by waiting player.' });
      return;
    }
    if (waitingPlayers.length > 0) {
      // Opponent found - proceed with match
      const opponentIndex = 0; // Assuming FIFO, but you can adjust if needed
      const opponent = waitingPlayers[opponentIndex];
      // Clear the opponent's timeout if it exists
      if (opponent.timeout) {
        clearTimeout(opponent.timeout);
      }
      // Remove opponent from queue
      waitingPlayers.splice(opponentIndex, 1);
      const roomCode = makeRoomCode();
      const p1 = { id: opponent.id, name: opponent.name, deviceType: opponent.deviceType };
      const p2 = { id: socket.id, name: safeName, deviceType: safeDeviceType };
      rooms[roomCode] = {
        players: [p1, p2],
        started: true,
        nboard: determineGridSize(p1.deviceType, p2.deviceType)
      };
      io.sockets.sockets.get(p1.id)?.join(roomCode);
      socket.join(roomCode);
      emitStartGameToBoth(roomCode);
      // Since match found, emit success to both (optional, but client starts game via 'startGame')
    } else {
      // No opponent - add to queue and start 10s timer
      const timeout = setTimeout(() => {
        // Check if this player is still in the queue
        const playerIndex = waitingPlayers.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          // Remove from queue
          waitingPlayers.splice(playerIndex, 1);
          // Emit no opponent message
          socket.emit('findOpponentResult', { success: false, message: 'NO OPPONENT FOUND, PLAY WITH YOUR FRIEND IN A PRIVATE ROOM' });
        }
      }, 10000); // 10 seconds

      waitingPlayers.push({ id: socket.id, name: safeName, deviceType: safeDeviceType, timeout });
    }
  });

  // Moves
  socket.on('makeMove', ({ roomCode, piece, row, col }) => {
    const safeRoomCode = sanitizeRoomCode(roomCode);
    if (!safeRoomCode || !rooms[safeRoomCode]) return; // Invalid or non-existent room
    const nboard = rooms[safeRoomCode].nboard || 6; // Fallback to default
    const { validPiece, validRow, validCol } = sanitizeMove(piece, row, col, nboard);
    if (!validPiece || validRow === null || validCol === null) {
      // Optionally emit an error back to the sender
      socket.emit('invalidMove', { message: 'Invalid move data.' });
      return;
    }
    // Proceed with broadcasting the validated move
    socket.to(safeRoomCode).emit('move', { piece: validPiece, row: validRow, col: validCol });
  });

  // Reset
  socket.on('resetGame', ({ roomCode }) => {
    const safeRoomCode = sanitizeRoomCode(roomCode);
    if (!rooms[safeRoomCode]) return;
    socket.to(safeRoomCode).emit('gameReset');
  });

  // Disconnect
  socket.on('disconnect', () => {
    // Remove from waiting queue and clear timeout if exists
    const playerIndex = waitingPlayers.findIndex(p => p.id === socket.id);
    if (playerIndex !== -1) {
      if (waitingPlayers[playerIndex].timeout) {
        clearTimeout(waitingPlayers[playerIndex].timeout);
      }
      waitingPlayers.splice(playerIndex, 1);
    }
    // Remove from rooms
    for (const code of Object.keys(rooms)) {
      const r = rooms[code];
      const before = r.players.length;
      r.players = r.players.filter(p => p.id !== socket.id);
      if (before === 2 && r.players.length === 1) {
        io.to(r.players[0].id).emit('opponentLeft');
        r.started = false;
      }
      if (r.players.length === 0) delete rooms[code];
    }
  });
});

// ---- Start server ----
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
