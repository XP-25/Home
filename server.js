const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "https://raisexp.games",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'originals_class_chatters')));

// Game state
const rooms = new Map();
const ARTISTS = [
           {
            name: "Kendrick",
            verse: "Quantum physics could never show you the world I was in",
            color: "#643200",
            face: "kendrick.png"
        },
        {
            name: "Drake",
            verse: "Checked the weather and it's getting real oppy outside",
            color: "#c49159",
            face: "drake.png"
        },
        {
            name: "Travis Scott",
            verse: "It's lit! Straight up!",
            color: "#8c5829",
            face: "jack.png"
        },
        {
            name: "Pusha T",
            verse: "If you know you know, it's not a game!",
            color: "#5a3a1a",
            face: "pusha.png"
        },
        {
            name: "21 Savage",
            verse: "How many credits you got? A lot!",
            color: "#a46422",
            face: "21.png"
        },
        {
            name: "Ritviz",
            verse: "Hum toh udd gaye ,Udd gaye, Udd gaye",
            color: "#f4b41c",
            face: "ritviz.png"
        },
        {
            name: "Chaar Diwari",
            verse: "Kya behenchod game hai yeh?",
            color: "#c2a284",
            face: "ChaarDiwari.png"
        },
        {
            name: "Playboi Carti",
            verse: "i et e mone an i kee'in it, i et e cah an i kee'in it",
            color: "#d2b48c",
            face: "playboi.png"
        },
        {
            name: "Future",
            verse: " I luv bad bitches",
            color: "#6d4c3d",
            face: "future.png"
        },
        {
            name: "M.I.A.",
            verse: "All I wanna do is 🔫🔫🔫🔫, and take your 💰\n {Admin: Props to M.I.A. for standing with refugees}",
            color: "#a46422",
            face: "mia.png"
        },
        {
            name: "HanumanKind",
            verse: "Beer and biryani too legit\nWhat you know about that\nCombination make ya flip",
            color: "#e0ac69",
            face: "hk.png"
        },
        {
            name: "Kanye West",
            verse: "I love your t**ties ‘cause they prove I can focus on two things at once",
            color: "#4a2a0a",
            face: "kw.png"
        },
        {
            name: "KR$NA",
            verse: "Farak Nahi PadtaNo time, i got no patience. Tujhe chahiye jung, bhej apni location",
            color: "#8c6f5a",
            face: "krsna.png"
        },
        {
            name: "Metro Boomin",
            verse: "Metro Boomin' want some more credits nigga",
            color: "#46250e",
            face: "metro.png"
        },
        {
            name: "Fredo Again",
            verse: "Breaking news—your DJ just got the ultimate drop: kicked out of school!",
            color: "#a46422",
            face: "fredo.png"
        },
        {
            name: "The Weeknd",
            verse: "Beggin’ on her knees to be popular",
            color: "#f8d8be",
            face: "TheWeeknd.png"
        },
];

class Player {
    constructor(id, name, socket, roomId) {
        this.id = id;
        this.name = name; // Real name (not shown to others)
        this.socket = socket;
        this.roomId = roomId;
        this.credits = 15;
        this.isStanding = false;
        this.isTalking = false;
        this.isExpelled = false;
        this.artist = null;
        this.benchmateId = null;
        console.log(`Player ${id} created with name ${name}`);
    }
}

class Room {
    constructor(id) {
        this.id = id;
        this.players = new Map();
        this.gameStarted = false;
        this.teacherIsMonitoring = false;
        this.monitorId = null;
        this.talkingInterval = null;
        this.teacherInterval = null;
        this.sleepInterval = null;
        console.log(`Room ${id} created`);
    }

    addPlayer(player) {
        this.players.set(player.id, player);

        // Assign an artist to the player
        const availableArtists = ARTISTS.filter(artist =>
            !Array.from(this.players.values()).some(p => p.artist && p.artist.name === artist.name)
        );

        if (availableArtists.length > 0) {
            player.artist = availableArtists[Math.floor(Math.random() * availableArtists.length)];
            console.log(`Assigned artist ${player.artist.name} to player ${player.id}`);

            // Notify player of their artist assignment
            player.socket.emit("artist_assigned", {
                playerId: player.id,
                artist: player.artist
            });
        }

        // Send updated players list to all clients
        this.broadcastPlayersList();

        // Assign benchmates when we have an even number of players
        if (this.players.size % 2 === 0) {
            this.assignBenchmates();
        }

        this.broadcast("player_joined", {
            players: this.getPlayerList(),
            roomId: this.id
        });

        console.log(`Player ${player.id} joined room ${this.id}. Total players: ${this.players.size}`);

        // Start game if we have 16 players
        if (this.players.size === 16 && !this.gameStarted) {
            console.log(`Room ${this.id} has 16 players, starting game...`);
            setTimeout(() => this.startGame(), 2000);
        }
    }

    removePlayer(playerId) {
        const player = this.players.get(playerId);
        if (!player) return;

        console.log(`Player ${playerId} left room ${this.id}`);

        // Remove benchmate connection and reassign if needed
        if (player.benchmateId) {
            const benchmate = this.players.get(player.benchmateId);
            if (benchmate) {
                benchmate.benchmateId = null;
                benchmate.socket.emit("benchmate_left", { playerId: playerId });

                // Try to find a new benchmate for the remaining player
                this.tryReassignBenchmate(benchmate.id);
            }
        }

        this.players.delete(playerId);

        // Send updated players list to all clients
        this.broadcastPlayersList();

        // If the monitor leaves, select a new monitor
        if (this.monitorId === playerId && this.players.size > 0) {
            const activePlayers = Array.from(this.players.values()).filter(p => !p.isExpelled);
            if (activePlayers.length > 0) {
                const newMonitorId = activePlayers[0].id;
                this.makePlayerMonitor(newMonitorId);
            } else {
                this.monitorId = null;
            }
        }

        this.broadcast("player_left", {
            players: this.getPlayerList()
        });

        // End game if too many players leave
        if (this.players.size < 2 && this.gameStarted) {
            this.endGame();
        }
    }

    tryReassignBenchmate(playerId) {
        const player = this.players.get(playerId);
        if (!player || player.benchmateId) return;

        // Find another player without a benchmate
        const availablePlayers = Array.from(this.players.values()).filter(
            p => p.id !== playerId && !p.benchmateId && !p.isExpelled
        );

        if (availablePlayers.length > 0) {
            const newBenchmate = availablePlayers[0];
            player.benchmateId = newBenchmate.id;
            newBenchmate.benchmateId = player.id;

            console.log(`Reassigned ${player.artist.name} with ${newBenchmate.artist.name} as benchmates`);

            // Notify players about their new benchmate
            this.sendToPlayer(player.id, "benchmate_assigned", {
                benchmateId: newBenchmate.id,
                benchmateName: newBenchmate.artist.name
            });

            this.sendToPlayer(newBenchmate.id, "benchmate_assigned", {
                benchmateId: player.id,
                benchmateName: player.artist.name
            });
        }
    }

    getPlayerList() {
        return Array.from(this.players.values()).map(player => ({
            id: player.id,
            artist: player.artist,
            credits: player.credits,
            isStanding: player.isStanding,
            isTalking: player.isTalking,
            isExpelled: player.isExpelled,
            benchmateId: player.benchmateId
        }));
    }

    broadcastPlayersList() {
        this.broadcast("players_list", {
            players: this.getPlayerList()
        });
    }

    broadcast(event, data) {
        console.log(`Broadcasting ${event} to room ${this.id}`);
        this.players.forEach(player => {
            player.socket.emit(event, data);
        });
    }

    sendToPlayer(playerId, event, data) {
        const player = this.players.get(playerId);
        if (player) {
            console.log(`Sending ${event} to player ${playerId}`);
            player.socket.emit(event, data);
        }
    }

    assignBenchmates() {
        const playerIds = Array.from(this.players.keys());

        // Only assign benchmates to players who don't have one
        const unpairedPlayers = playerIds.filter(id => !this.players.get(id).benchmateId);
        console.log(`Assigning benchmates in room ${this.id}. Unpaired players: ${unpairedPlayers.length}`);

        // Pair players randomly
        while (unpairedPlayers.length >= 2) {
            const player1Id = unpairedPlayers.shift();
            const player2Id = unpairedPlayers.shift();

            const player1 = this.players.get(player1Id);
            const player2 = this.players.get(player2Id);

            player1.benchmateId = player2Id;
            player2.benchmateId = player1Id;

            console.log(`Paired ${player1.artist.name} with ${player2.artist.name} as benchmates`);

            // Notify players about their benchmate
            this.sendToPlayer(player1Id, "benchmate_assigned", {
                benchmateId: player2Id,
                benchmateName: player2.artist.name
            });

            this.sendToPlayer(player2Id, "benchmate_assigned", {
                benchmateId: player1Id,
                benchmateName: player1.artist.name
            });
        }

        // Send updated players list to all clients
        this.broadcastPlayersList();
    }

    startGame() {
        if (this.gameStarted) return;

        console.log(`Starting game in room ${this.id}`);
        this.gameStarted = true;

        // Initialize all players
        this.players.forEach(player => {
            player.credits = 15;
            player.isStanding = false;
            player.isTalking = false;
            player.isExpelled = false;
        });

        this.broadcast("game_start", {
            students: this.getPlayerList(),
            teacher: { name: "Teacher" }
        });

        // Start teacher behavior simulation
        this.startTeacherBehavior();

        // Start the talking simulation after a delay
        setTimeout(() => {
            // this.startTalkingSimulation();

            // After a short delay, select the first monitor
            const playerIds = Array.from(this.players.keys());
            const firstMonitorId = playerIds[Math.floor(Math.random() * playerIds.length)];
            this.makePlayerMonitor(firstMonitorId);

            this.broadcast("student_caught", {
                studentId: firstMonitorId,
                credits: this.players.get(firstMonitorId).credits
            });
        }, 5000);
    }

    makePlayerMonitor(playerId) {
        const player = this.players.get(playerId);
        if (!player || player.isExpelled) return;

        console.log(`Making ${player.artist.name} the monitor in room ${this.id}`);

        // Reset previous monitor
        if (this.monitorId) {
            const prevMonitor = this.players.get(this.monitorId);
            if (prevMonitor) prevMonitor.isStanding = false;
        }

        player.isStanding = true;
        this.monitorId = playerId;

        this.broadcast("new_monitor", {
            studentId: playerId
        });
    }

    handleChatMessage(playerId, text) {
        const player = this.players.get(playerId);
        if (!player || player.isExpelled || player.isStanding || !this.gameStarted) return;

        console.log(`Private chat message from ${player.artist.name} to benchmate`);

        // Only send private message to benchmate
        if (player.benchmateId) {
            const benchmate = this.players.get(player.benchmateId);
            if (benchmate && !benchmate.isExpelled) {
                this.sendToPlayer(player.benchmateId, "benchmate_message", {
                    sender: player.artist.name,
                    text: text,
                    studentId: playerId
                });

                // Show the talking animation only for the sender
                player.isTalking = true;
                this.broadcast("student_talking", {
                    studentId: playerId
                });

                // Reset talking state after a delay
                setTimeout(() => {
                    player.isTalking = false;
                }, 1000);

                // If the teacher is monitoring, there's a chance to get caught
                if (this.teacherIsMonitoring && Math.random() < 0.3) {
                    this.catchStudent(playerId);
                }
            } else {
                // Benchmate is expelled or doesn't exist
                player.benchmateId = null;
                this.sendToPlayer(playerId, "benchmate_left", { playerId: player.benchmateId });
            }
        }
    }

    catchStudent(studentId) {
        const student = this.players.get(studentId);
        if (!student || student.isExpelled) return;

        // Decrease credits by 1 only
        student.credits -= 1;
        console.log(`Caught ${student.artist.name} talking. Credits reduced to ${student.credits}`);

        if (student.credits <= 0) {
            this.expelStudent(studentId);
        } else {
            this.makePlayerMonitor(studentId);
            this.broadcast("student_caught", {
                studentId: studentId,
                credits: student.credits
            });
        }
    }

    expelStudent(studentId) {
        const student = this.players.get(studentId);
        if (!student || student.isExpelled) return;

        console.log(`Expelling ${student.artist.name} from room ${this.id}`);
        student.isExpelled = true;
        student.isStanding = false;

        if (this.monitorId === studentId) {
            this.monitorId = null;
        }

        // Notify benchmate about expulsion and try to reassign
        if (student.benchmateId) {
            const benchmate = this.players.get(student.benchmateId);
            if (benchmate) {
                benchmate.benchmateId = null;
                this.sendToPlayer(benchmate.id, "benchmate_expelled", {
                    playerId: studentId
                });

                // Try to find a new benchmate for the remaining player
                this.tryReassignBenchmate(benchmate.id);
            }
        }

        this.broadcast("student_expelled", {
            studentId: studentId
        });

        // If this was the last non-expelled player, end the game
        const activePlayers = Array.from(this.players.values()).filter(p => !p.isExpelled);
        if (activePlayers.length <= 1 && this.gameStarted) {
            this.endGame();
        }
    }

    // startTalkingSimulation() {
    //     console.log(`Starting talking simulation in room ${this.id}`);
    //     this.talkingInterval = setInterval(() => {
    //         if (!this.gameStarted || this.teacherIsMonitoring) return;

    //         // Select a random non-standing, non-expelled player to talk
    //         const possibleTalkers = Array.from(this.players.values()).filter(
    //             p => !p.isStanding && !p.isExpelled && p.id !== this.monitorId
    //         );

    //         if (possibleTalkers.length > 0 && Math.random() < 0.4) {
    //             const talker = possibleTalkers[Math.floor(Math.random() * possibleTalkers.length)];

    //             console.log(`${talker.artist.name} is talking in room ${this.id}`);
    //             talker.isTalking = true;
    //             this.broadcast("student_talking", {
    //                 studentId: talker.id
    //             });

    //             setTimeout(() => {
    //                 talker.isTalking = false;
    //             }, 1000);

    //             // If there's a monitor, they might catch the talker
    //             if (this.monitorId && Math.random() < 0.6) {
    //                 const monitor = this.players.get(this.monitorId);
    //                 if (monitor && !monitor.isExpelled) {
    //                     this.catchStudent(talker.id);
    //                 }
    //             }
    //         }
    //     }, 3000);
    // }

    startTeacherBehavior() {
        console.log(`Starting teacher behavior simulation in room ${this.id}`);

        // Start with teacher sleeping
        this.broadcast("teacher_sleeping", {});

        this.teacherInterval = setInterval(() => {
            if (!this.gameStarted) return;

            // Teacher randomly wakes up and monitors
            if (Math.random() < 0.3) {
                this.teacherIsMonitoring = true;
                console.log(`Teacher is monitoring in room ${this.id}`);
                this.broadcast("teacher_monitoring", {
                    isMonitoring: true
                });

                // While monitoring, teacher might catch someone
                const monitoringDuration = 5000 + Math.random() * 5000;
                const monitoringInterval = setInterval(() => {
                    if (!this.teacherIsMonitoring) {
                        clearInterval(monitoringInterval);
                        return;
                    }

                    // Find talking students
                    const talkingStudents = Array.from(this.players.values()).filter(
                        p => p.isTalking && !p.isExpelled && !p.isStanding
                    );

                    if (talkingStudents.length > 0 && Math.random() < 0.4) {
                        const caughtStudent = talkingStudents[Math.floor(Math.random() * talkingStudents.length)];
                        console.log(`Teacher caught ${caughtStudent.artist.name} talking!`);
                        this.catchStudent(caughtStudent.id);
                    }
                }, 1000);

                // Teacher stops monitoring after a while
                setTimeout(() => {
                    this.teacherIsMonitoring = false;
                    console.log(`Teacher stopped monitoring in room ${this.id}`);
                    this.broadcast("teacher_monitoring", {
                        isMonitoring: false
                    });

                    clearInterval(monitoringInterval);

                    // Teacher goes back to sleep
                    setTimeout(() => {
                        this.broadcast("teacher_sleeping", {});
                    }, 1000);
                }, monitoringDuration);
            }
        }, 15000);
    }

    endGame() {
        console.log(`Ending game in room ${this.id}`);
        this.gameStarted = false;
        clearInterval(this.talkingInterval);
        clearInterval(this.teacherInterval);

        // Find the winner (player with most credits)
        let winner = null;
        this.players.forEach(player => {
            if (!player.isExpelled && (!winner || player.credits > winner.credits)) {
                winner = player;
            }
        });

        this.broadcast("game_end", {
            winner: winner ? { id: winner.id, name: winner.artist.name } : null
        });
    }
}

// Find or create a room with available space
function findAvailableRoom() {
    for (const [roomId, room] of rooms) {
        if (room.players.size < 16 && !room.gameStarted) {
            console.log(`Found available room: ${roomId}`);
            return room;
        }
    }

    // Create a new room if all are full
    const newRoomId = crypto.randomBytes(4).toString('hex');
    const newRoom = new Room(newRoomId);
    rooms.set(newRoomId, newRoom);
    console.log(`Created new room: ${newRoomId}`);
    return newRoom;
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    let player = null;
    let room = null;

    socket.on('set_name', (data) => {
        console.log('set_name event received from', socket.id, ':', data);

        if (player) return; // Player already set

        // Find or create a room with available space
        room = findAvailableRoom();

        // Create player
        const playerId = crypto.randomBytes(8).toString('hex');
        player = new Player(playerId, data.name, socket, room.id);
        room.addPlayer(player);

        // Send player their ID
        socket.emit('player_info', {
            playerId: playerId,
            credits: player.credits,
            artist: player.artist
        });
    });

    socket.on('benchmate_message', (data) => {
        console.log('benchmate_message event received from', socket.id, ':', data);
        if (player && room) {
            room.handleChatMessage(player.id, data.text);
        }
    });

    socket.on('student_caught', (data) => {
        console.log('student_caught event received from', socket.id, ':', data);
        if (player && room && player.isStanding && !player.isExpelled) {
            room.catchStudent(data.studentId);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        if (player && room) {
            room.removePlayer(player.id);

            // Clean up empty rooms
            if (room.players.size === 0) {
                rooms.delete(room.id);
                console.log(`Room ${room.id} deleted due to being empty`);
            }
        }
    });
});

// API endpoint to get room list
app.get('/api/rooms', (req, res) => {
    const roomList = Array.from(rooms.entries()).map(([id, room]) => ({
        id,
        playerCount: room.players.size,
        gameStarted: room.gameStarted
    }));
    console.log('API request for room list:', roomList);
    res.json(roomList);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

});
