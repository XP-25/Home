// Show instructions automatically on mobile
if (window.innerWidth < 1024) {
    document.getElementById("instruction-modal").classList.remove("hidden");
}

// Close button
document.getElementById("close-instruction").addEventListener("click", () => {
    document.getElementById("instruction-modal").classList.add("hidden");
});

document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM loaded, initializing game...");

    // --- DOM ELEMENTS ---
    const gameStatus = document.getElementById("game-status");
    const benchesContainer = document.getElementById("benches");
    const teacherContainer = document.getElementById("teacher-container");
    const teacherEl = document.getElementById("teacher");
    const startModal = document.getElementById("start-modal");
    const joinGameBtn = document.getElementById("join-game-btn");
    const playerNameInput = document.getElementById("player-name-input");
    const chatInput = document.getElementById("chat-input");
    const sendBtn = document.getElementById("send-btn");
    const chatMessages = document.getElementById("chat-messages");
    const chatHeader = document.getElementById("chat-header");
    const playerCreditsEl = document.getElementById("player-credits");
    const playerArtistEl = document.getElementById("player-artist");
    const verseDisplayEl = document.getElementById("verse-display");
    const corridor = document.getElementById("corridor");
    const playerCountEl = document.getElementById("player-count");
    const roomInfoEl = document.getElementById("room-info");
    const connectionStatusEl = document.getElementById("connection-status");
    const playerListContainer = document.getElementById("player-list-container");
    const playerListEl = document.getElementById("player-list");
    const adModal = document.getElementById("ad-modal");
    const closeAdBtn = document.getElementById("close-ad");

    // --- GAME STATE ---
    let students = {};
    let teacher = {};
    let gameStarted = false;
    let teacherIsMonitoring = false;
    let monitorId = null;
    let playerId = null;
    let playerName = "";
    let playerArtist = null;
    let socket = null;
    let currentRoom = null;
    let benchmateId = null;
    let allPlayers = [];
    let benchNumbers = {}; // Map student IDs to bench numbers
    let adShownForExpulsion = false; // Track if ad has been shown for this expulsion

    // --- ARTIST DATA WITH IMAGES ---
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

    // --- AD MODAL FUNCTIONS ---
    function showAdModal() {
        if (adModal) {
            adModal.classList.remove("hidden");
            adShownForExpulsion = true;

            // Refresh the ad (if using AdSense)
            if (typeof adsbygoogle !== 'undefined') {
                try {
                    (adsbygoogle = window.adsbygoogle || []).push({});
                } catch (e) {
                    console.log("Ad refresh error:", e);
                }
            }
        }
    }

    function hideAdModal() {
        if (adModal) {
            adModal.classList.add("hidden");
        }
    }

    // Event listeners for ad modal
    if (closeAdBtn) {
        closeAdBtn.addEventListener("click", hideAdModal);
    }

    if (adModal) {
        adModal.addEventListener("click", function (e) {
            if (e.target === adModal) {
                hideAdModal();
            }
        });
    }

    // --- SOCKET.IO CONNECTION ---
    function connectSocketIO() {
        console.log("Connecting to game server via Socket.io...");

        try {
            updateConnectionStatus("connecting");

            // Connect to Socket.io server - using default URL
            socket = io("classchatter-h3gsgyf9hmd6d4cz.centralindia-01.azurewebsites.net", {
                transports: ['websocket', 'polling']
            });

            socket.on("connect", () => {
                console.log("Connected to server with ID:", socket.id);
                updateConnectionStatus("connected");
                setStatusMessage("Connected to server", "green");

                // Send player name to server
                socket.emit("set_name", {
                    name: playerName
                });
            });

            socket.on("disconnect", (reason) => {
                console.log("Disconnected from server:", reason);
                updateConnectionStatus("disconnected");
                setStatusMessage("Disconnected from server", "red");
            });

            socket.on("connect_error", (error) => {
                console.error("Connection error:", error);
                updateConnectionStatus("disconnected");
                setStatusMessage("Connection error. Please refresh.", "red");
            });

            // Handle game events
            socket.on("player_info", (data) => {
                console.log("Received player info:", data);
                handleSocketMessage("player_info", data);
            });

            socket.on("player_joined", (data) => {
                console.log("Player joined:", data);
                handleSocketMessage("player_joined", data);
            });

            socket.on("game_start", (data) => {
                console.log("Game starting:", data);
                handleSocketMessage("game_start", data);
            });

            socket.on("benchmate_message", (data) => {
                console.log("Benchmate message:", data);
                handleSocketMessage("benchmate_message", data);
            });

            socket.on("benchmate_assigned", (data) => {
                console.log("Benchmate assigned:", data);
                handleSocketMessage("benchmate_assigned", data);
            });

            socket.on("student_talking", (data) => {
                console.log("Student talking:", data);
                handleSocketMessage("student_talking", data);
            });

            socket.on("student_caught", (data) => {
                console.log("Student caught:", data);
                handleSocketMessage("student_caught", data);
            });

            socket.on("new_monitor", (data) => {
                console.log("New monitor:", data);
                handleSocketMessage("new_monitor", data);
            });

            socket.on("student_expelled", (data) => {
                console.log("Student expelled:", data);
                handleSocketMessage("student_expelled", data);
            });

            socket.on("teacher_monitoring", (data) => {
                console.log("Teacher monitoring:", data);
                handleSocketMessage("teacher_monitoring", data);
            });

            socket.on("teacher_sleeping", (data) => {
                console.log("Teacher sleeping:", data);
                handleSocketMessage("teacher_sleeping", data);
            });

            socket.on("player_left", (data) => {
                console.log("Player left:", data);
                handleSocketMessage("player_left", data);
            });

            socket.on("game_end", (data) => {
                console.log("Game ended:", data);
                handleSocketMessage("game_end", data);
            });

            socket.on("artist_assigned", (data) => {
                console.log("Artist assigned:", data);
                handleSocketMessage("artist_assigned", data);
            });

            socket.on("players_list", (data) => {
                console.log("Players list:", data);
                handleSocketMessage("players_list", data);
            });

            // Add these event handlers to the client-side code
            socket.on("benchmate_left", (data) => {
                console.log("Benchmate left:", data);
                if (data.playerId === benchmateId) {
                    setStatusMessage(`Your benchmate ${data.artistName} left the game`, "red");

                    // Move benchmate to corridor
                    const benchmateEl = document.getElementById(`student-${benchmateId}`);
                    if (benchmateEl) {
                        const expelledFace = benchmateEl.querySelector(".student-face").cloneNode(true);
                        expelledFace.classList.add("mb-2", "z-20", "relative", "expelled-player");
                        expelledFace.id = `expelled-${benchmateId}`;
                        corridor.appendChild(expelledFace);
                        benchmateEl.style.opacity = "0.3";
                        benchmateEl.style.pointerEvents = "none";
                    }

                    benchmateId = null;
                    chatHeader.textContent = "Private Chat";
                    chatInput.disabled = true;
                    sendBtn.disabled = true;
                }
            });

            socket.on("benchmate_expelled", (data) => {
                console.log("Benchmate expelled:", data);
                if (data.playerId === benchmateId) {
                    setStatusMessage(`Your benchmate ${data.artistName} was expelled!`, "red");

                    // Move benchmate to corridor
                    const benchmateEl = document.getElementById(`student-${benchmateId}`);
                    if (benchmateEl) {
                        const expelledFace = benchmateEl.querySelector(".student-face").cloneNode(true);
                        expelledFace.classList.add("mb-2", "z-20", "relative", "expelled-player");
                        expelledFace.id = `expelled-${benchmateId}`;
                        corridor.appendChild(expelledFace);
                        benchmateEl.style.opacity = "0.3";
                        benchmateEl.style.pointerEvents = "none";
                    }

                    benchmateId = null;
                    chatHeader.textContent = "Private Chat";
                    chatInput.disabled = true;
                    sendBtn.disabled = true;
                }
            });

        } catch (error) {
            console.error("Failed to connect:", error);
            setStatusMessage("Connection failed", "red");
        }
    }

    function handleSocketMessage(type, data) {
        console.log("Handling message type:", type, "with data:", data);

        switch (type) {
            case "player_info":
                playerId = data.playerId;
                playerCreditsEl.textContent = data.credits;
                if (data.artist) {
                    playerArtist = data.artist;
                    playerArtistEl.textContent = data.artist.name;
                    verseDisplayEl.textContent = `"${data.artist.verse}"`;
                }
                break;

            case "player_joined":
                updatePlayerCount(data.players ? data.players.length : 1);
                if (data.roomId) {
                    currentRoom = data.roomId;
                    roomInfoEl.textContent = `Room: ${currentRoom}`;
                }
                break;

            case "players_list":
                allPlayers = data.players || [];
                updatePlayersList(allPlayers);
                break;

            case "game_start":
                initGame(data.students, data.teacher, data.firstMonitor);
                break;

            case "benchmate_message":
                // Only show speech bubble if it's from our benchmate
                if (data.senderId === benchmateId) {
                    startTalking(data.senderId);
                }

                // Add message to chat
                addChatMessage(
                    data.sender || "Benchmate",
                    data.text || data.message,
                    data.senderId !== playerId,
                    true
                );
                break;

            case "benchmate_assigned":
                benchmateId = data.benchmateId;
                setStatusMessage(`Your benchmate is ${data.benchmateName}`, "blue");
                chatHeader.textContent = `Private Chat with ${data.benchmateName}`;
                chatInput.disabled = false;
                sendBtn.disabled = false;
                break;

            case "student_talking":
                if (students[data.studentId]) {
                    startTalking(data.studentId);
                }
                break;

            case "student_caught":
                if (students[data.studentId]) {
                    makeStudentMonitor(data.studentId);
                    if (data.credits !== undefined) {
                        students[data.studentId].credits = data.credits;
                        updateStudentCreditsUI(data.studentId);
                        if (data.studentId === playerId) {
                            updatePlayerCreditsUI();
                        }
                    }
                }
                break;

            case "new_monitor":
                if (students[data.studentId]) {
                    makeStudentMonitor(data.studentId);
                }
                break;

            case "student_expelled":
                // Reset ad flag if this player was previously expelled
                if (data.studentId === playerId) {
                    adShownForExpulsion = false;
                }

                if (students[data.studentId]) {
                    expelStudent(data.studentId);
                    showExpelledVerse(data.studentId);
                }

                if (data.studentId === benchmateId) {
                    setStatusMessage(`Your benchmate ${data.artistName} was expelled!`, "red");
                    benchmateId = null;
                    chatHeader.textContent = "Private Chat";
                    chatInput.disabled = true;
                    sendBtn.disabled = true;
                }
                break;

            case "teacher_monitoring":
                teacherIsMonitoring = data.isMonitoring;
                document.querySelector('.teacher-face').style.backgroundImage = "url('SnoopM.png')";
                if (teacherEl) {
                    if (data.isMonitoring) {
                        teacherEl.classList.add("teacher-nod");
                        teacherEl.classList.remove("teacher-sleeping");
                        setStatusMessage("Teacher is monitoring!", "red");
                    } else {
                        teacherEl.classList.remove("teacher-nod");
                        setStatusMessage("Teacher stopped monitoring", "green");
                    }
                }
                break;

            case "teacher_sleeping":
                if (teacherEl) {
                    teacherEl.classList.add("teacher-sleeping");
                    document.querySelector('.teacher-face').style.backgroundImage = "url('SnoopS.png')";

                    setTimeout(() => {
                        teacherEl.classList.remove("teacher-sleeping");
                        document.querySelector('.teacher-face').style.backgroundImage = "url('SnoopS.png')";
                    }, 3000);
                }
                break;

            case "player_left":
                updatePlayerCount(data.players ? data.players.length : 1);

                // Move player to corridor if they were expelled
                if (data.playerId && data.playerId !== playerId) {
                    const playerEl = document.getElementById(`student-${data.playerId}`);
                    if (playerEl) {
                        const expelledFace = playerEl.querySelector(".student-face").cloneNode(true);
                        expelledFace.classList.add("mb-2", "z-20", "relative", "expelled-player");
                        expelledFace.id = `expelled-${data.playerId}`;
                        corridor.appendChild(expelledFace);
                        playerEl.style.opacity = "0.3";
                        playerEl.style.pointerEvents = "none";

                    }
                }

                if (data.playerId === benchmateId) {
                    setStatusMessage(`Your benchmate ${data.artistName} left the game`, "red");
                    benchmateId = null;
                    chatHeader.textContent = "Private Chat";
                    chatInput.disabled = true;
                    sendBtn.disabled = true;
                }

                // Update players list
                allPlayers = allPlayers.filter(p => p.id !== data.playerId);
                playerListContainer.classList.add('hidden');
                break;

            case "game_end":
                gameStarted = false;
                setStatusMessage(
                    data.winner ? `${data.winner.name} wins!` : "Game ended",
                    "yellow"
                );
                chatInput.disabled = true;
                sendBtn.disabled = true;
                break;

            case "artist_assigned":
                if (data.playerId === playerId) {
                    playerArtist = data.artist;
                    playerArtistEl.textContent = data.artist.name;
                    verseDisplayEl.textContent = `"${data.artist.verse}"`;
                    setStatusMessage(`You've been assigned ${data.artist.name}`, "purple");
                }
                // Update players list
                allPlayers = allPlayers.map(p => {
                    if (p.id === data.playerId) {
                        return { ...p, artist: data.artist };
                    }
                    return p;
                });
                updatePlayersList(allPlayers);
                break;

            default:
                console.log("Unknown message type:", type);
        }
    }

    function updatePlayersList(players) {
        playerListEl.innerHTML = '';

        players.forEach(player => {
            const listItem = document.createElement('div');
            listItem.className = 'player-list-item';

            const colorDot = document.createElement('div');
            colorDot.className = 'player-color-dot';
            colorDot.style.backgroundColor = player.artist?.color || '#ccc';

            const playerName = document.createElement('span');
            playerName.textContent = player.artist?.name || 'Unknown Artist';

            listItem.appendChild(colorDot);
            listItem.appendChild(playerName);

            if (player.benchmateId === playerId) {
                const benchmateBadge = document.createElement('span');
                benchmateBadge.textContent = ' (Your Benchmate)';
                benchmateBadge.className = 'text-blue-400 ml-1';
                playerName.appendChild(benchmateBadge);
            }

            playerListEl.appendChild(listItem);
        });

        // Show the player list if there are players
        if (players.length > 0) {
            playerListContainer.classList.remove('hidden');
        }
    }

    function emitSocketMessage(type, data) {
        if (socket && socket.connected) {
            console.log("Emitting message:", type, data);
            socket.emit(type, data);
        } else {
            console.error("Socket is not connected");
            setStatusMessage("Not connected to server", "red");
        }
    }

    function updateConnectionStatus(status) {
        connectionStatusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        connectionStatusEl.className = `connection-status ${status}`;
    }

    function updatePlayerCount(count) {
        playerCountEl.textContent = `Players: ${count}/16`;
        // Start game when we have 16 players
        if (count === 16 && !gameStarted) {
            setStatusMessage("Game will start soon!", "green");
        }
    }

    // --- GAME SETUP ---
    function initGame(studentData, teacherData, firstMonitorId) {
        console.log("Initializing game with data:", studentData, teacherData, firstMonitorId);

        // Hide player list when game starts
        playerListContainer.classList.add('hidden');

        // Convert array to object with student IDs as keys
        students = {};
        if (Array.isArray(studentData)) {
            studentData.forEach(student => {
                students[student.id] = student;
            });
        } else if (studentData && typeof studentData === 'object') {
            students = studentData;
        }

        teacher = teacherData || {};
        gameStarted = true;
        teacherIsMonitoring = false;

        benchesContainer.innerHTML = "";
        const corridorChildren = Array.from(corridor.children);
        corridorChildren.forEach((child) => {
            if (child.id && child.id.startsWith("expelled"))
                corridor.removeChild(child);
        });

        // Setup teacher
        if (teacherEl) {
            teacherEl.classList.remove("teacher-nod");
            teacherEl.classList.remove("teacher-sleeping");
        }

        // Create benches and students
        const studentIds = Object.keys(students);
        console.log("Student IDs:", studentIds);

        // Reset bench numbers
        benchNumbers = {};

        for (let i = 0; i < 8; i++) {
            const bench = document.createElement("div");
            bench.className =
                "student-bench bg-[var(--wood-light)] pixel-border flex justify-around items-center";
            bench.style.justifySelf = "center";

            // Add bench number
            const benchNumber = document.createElement("div");
            benchNumber.className = "bench-number";
            benchNumber.textContent = i + 1;
            bench.appendChild(benchNumber);

            for (let j = 0; j < 2; j++) {
                const studentIndex = i * 2 + j;
                const studentId = studentIds[studentIndex];
                if (!studentId) {
                    // Create empty seat
                    const emptySeat = document.createElement("div");
                    emptySeat.className = "student relative flex flex-col items-center";
                    emptySeat.innerHTML = `
                            <div class="student-face" style="background-color: #555; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">-</div>
                            <div class="text-xs text-center">Empty</div>
                            <div class="text-xs text-yellow-300 mt-1.5">C: -</div>
                        `;
                    bench.appendChild(emptySeat);
                    continue;
                }

                const student = students[studentId];
                const artist = student.artist || ARTISTS[0];

                // Store bench number for this student
                benchNumbers[studentId] = i + 1;

                const studentEl = document.createElement("div");
                studentEl.id = `student-${studentId}`;
                studentEl.className =
                    "student relative flex flex-col items-center cursor-pointer";

                // Create student face with artist image
                const studentFace = document.createElement("div");
                studentFace.className = "student-face";
                studentFace.style.backgroundImage = `url('${artist.face}')`;

                studentEl.innerHTML = `
                        <div class="speech-bubble">...</div>
                    `;
                studentEl.appendChild(studentFace);

                studentEl.innerHTML += `
                        <div class="text-xs text-center">${artist.name}</div>
                        <div class="text-xs text-yellow-300 mt-1.5">C: ${student.credits}</div>
                    `;

                if (studentId === playerId) {
                    studentEl.classList.add("border-2", "border-blue-400", "rounded-md");
                }

                bench.appendChild(studentEl);
            }
            benchesContainer.appendChild(bench);
        }

        if (students[playerId]) {
            updatePlayerCreditsUI();
        }

        addStudentClickListeners();

        // Add keyboard event listener for bench numbers
        document.addEventListener('keydown', handleBenchKeyPress);

        // Start the game after a brief delay
        setTimeout(() => {
            gameStatus.textContent = "Class has started. Be quiet!";
            teacherIsMonitoring = false;
            chatInput.disabled = false;
            sendBtn.disabled = false;

            // Clear the initial message
            if (chatMessages.querySelector(".text-gray-400")) {
                chatMessages.innerHTML = "";
            }

            // The teacher catches the first monitor
            if (firstMonitorId) {
                setTimeout(() => {
                    const artistName = students[firstMonitorId]?.artist?.name || 'Someone';
                    gameStatus.textContent = `The teacher caught ${artistName} talking!`;
                    makeStudentMonitor(firstMonitorId);
                }, 2000);
            }
        }, 3000);
    }

    function addStudentClickListeners() {
        document.querySelectorAll(".student").forEach((el) => {
            el.addEventListener("click", handleStudentClick);
        });
    }

    function handleBenchKeyPress(event) {
        if (!gameStarted || !students[playerId] || students[playerId].isExpelled || !students[playerId].isStanding)
            return;

        // Check if key pressed is a number between 1-8
        const benchNumber = parseInt(event.key);
        if (isNaN(benchNumber) || benchNumber < 1 || benchNumber > 8) return;

        // Find students on this bench
        const benchStudents = Object.keys(students).filter(id => benchNumbers[id] === benchNumber);

        // Check if any student on this bench is talking
        let caughtTalking = false;
        for (const studentId of benchStudents) {
            if (students[studentId] && students[studentId].isTalking && !students[studentId].isExpelled) {
                const artistName = students[studentId].artist?.name || 'Someone';
                setStatusMessage(`You caught ${artistName} on bench ${benchNumber}!`, "green");

                emitSocketMessage("student_caught", {
                    studentId: studentId,
                });

                caughtTalking = true;
                break;
            }
        }

        if (!caughtTalking) {
            setStatusMessage(`No one was talking on bench ${benchNumber}.`, "red");
        }
    }

    // --- GAME LOGIC ---
    function handleStudentClick(event) {
        if (
            !gameStarted ||
            !students[playerId] ||
            students[playerId].isExpelled ||
            !students[playerId].isStanding
        )
            return;

        const clickedEl = event.currentTarget;
        const clickedId = clickedEl.id.split("-")[1];
        const clickedStudent = students[clickedId];

        if (clickedStudent && clickedStudent.isTalking) {
            const artistName = clickedStudent.artist?.name || 'Someone';
            setStatusMessage(`You caught ${artistName}!`, "green");

            emitSocketMessage("student_caught", {
                studentId: clickedId,
            });
        } else {
            setStatusMessage("False alarm! They were not talking.", "red");
        }
    }

    function makeStudentMonitor(studentId) {
        if (!students[studentId] || students[studentId].isExpelled) return;

        if (monitorId !== null && monitorId !== studentId) {
            students[monitorId].isStanding = false;
            const oldMonitorEl = document.getElementById(`student-${monitorId}`);
            if (oldMonitorEl) oldMonitorEl.classList.remove("standing");
        }

        const student = students[studentId];
        student.isStanding = true;
        monitorId = studentId;

        const studentEl = document.getElementById(`student-${studentId}`);
        if (studentEl) studentEl.classList.add("standing");

        const artistName = student.artist?.name || 'Someone';
        setStatusMessage(`${artistName} is the new monitor!`, "yellow");
    }

    function expelStudent(studentId) {
        const student = students[studentId];
        if (!student || student.isExpelled) return;
        student.isExpelled = true;
        student.isStanding = false;

        const artistName = student.artist?.name || 'Someone';
        setStatusMessage(`${artistName} has been expelled!`, "red");

        const studentEl = document.getElementById(`student-${studentId}`);
        if (studentEl) {
            const expelledFace = studentEl.querySelector(".student-face").cloneNode(true);
            expelledFace.classList.add("mb-2", "z-20", "relative", "expelled-player");
            expelledFace.id = `expelled-${studentId}`;
            corridor.appendChild(expelledFace);
            studentEl.style.opacity = "0.3";
            studentEl.style.pointerEvents = "none";
        }

        if (studentId === playerId) {
            gameStatus.textContent = "GAME OVER. You were expelled.";
            chatInput.disabled = true;
            sendBtn.disabled = true;
            // Remove keyboard listener
            document.removeEventListener('keydown', handleBenchKeyPress);
        }
    }

    function showExpelledVerse(studentId) {
        const student = students[studentId];
        if (!student) return;

        const artist = student.artist || ARTISTS[0];
        if (!artist) return;

        const verseEl = document.createElement("div");
        verseEl.className = "expelled-verse";
        verseEl.textContent = `${artist.name} says: "${artist.verse}"`;

        document.body.appendChild(verseEl);

        // Show ad modal ONLY if this is the current player who was expelled
        if (studentId === playerId && !adShownForExpulsion) {
            setTimeout(() => {
                showAdModal();
            }, 1500); // Show ad after 1.5 seconds
        }

        // Remove after animation completes
        setTimeout(() => {
            if (verseEl.parentNode) {
                document.body.removeChild(verseEl);
            }
        }, 5000);
    }

    function startTalking(studentId) {
        const student = students[studentId];
        if (!student || student.isExpelled || student.isStanding) return;
        const studentEl = document.getElementById(`student-${studentId}`);
        if (!studentEl) return;

        const speechBubble = studentEl.querySelector(".speech-bubble");
        if (speechBubble) speechBubble.textContent = "...";
        student.isTalking = true;
        studentEl.classList.add("talking");
        setTimeout(() => {
            student.isTalking = false;
            const el = document.getElementById(`student-${studentId}`);
            if (el) el.classList.remove("talking");
        }, 3000);
    }

    // --- UI & CHAT ---
    function handlePlayerChat() {
        const text = chatInput.value.trim();
        if (
            text === "" ||
            !students[playerId] ||
            students[playerId].isStanding ||
            students[playerId].isExpelled
        ) {
            if (students[playerId] && students[playerId].isStanding)
                setStatusMessage("You can't talk while standing!", "red");
            return;
        }

        // Only allow private messages to benchmate
        if (!benchmateId) {
            setStatusMessage("You don't have a benchmate to chat with", "red");
            return;
        }

        addChatMessage("You", text, false, true);
        emitSocketMessage("benchmate_message", {
            text: text,
            studentId: playerId
        });

        // Show the talking animation for the player
        startTalking(playerId);

        chatInput.value = "";
    }

    function addChatMessage(sender, message, isOther = false, isBenchmate = false) {
        const msgEl = document.createElement("div");
        msgEl.className = `whatsapp-style ${isOther ? 'benchmate' : ''}`;
        msgEl.innerHTML = `<strong>${sender}:</strong> ${message}`;
        chatMessages.appendChild(msgEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function setStatusMessage(msg, color) {
        gameStatus.textContent = msg;
        const colorMap = {
            red: "text-red-400",
            green: "text-green-400",
            yellow: "text-yellow-300",
            blue: "text-blue-400",
            purple: "text-purple-400"
        };
        gameStatus.className = `text-center text-xl h-12 ${colorMap[color] || "text-yellow-300"
            }`;
    }

    function updatePlayerCreditsUI() {
        if (students[playerId]) {
            playerCreditsEl.textContent = students[playerId].credits;
            if (students[playerId].credits < 5) {
                playerCreditsEl.className = "font-bold text-red-500";
            } else if (students[playerId].credits < 10) {
                playerCreditsEl.className = "font-bold text-yellow-400";
            } else {
                playerCreditsEl.className = "font-bold text-green-400";
            }
        }
    }

    function updateStudentCreditsUI(studentId) {
        const student = students[studentId];
        const el = document.getElementById(`student-${studentId}`);
        if (el && student) {
            const creditEl = el.querySelector(".text-yellow-300");
            if (creditEl) creditEl.textContent = `C: ${student.credits}`;
        }
    }

    // --- EVENT LISTENERS ---
    joinGameBtn.addEventListener("click", () => {
        if (playerNameInput.value.trim() === "") {
            alert("Please enter your name");
            return;
        }

        playerName = playerNameInput.value.trim();
        startModal.style.display = "none";
        connectSocketIO();
    });

    sendBtn.addEventListener("click", handlePlayerChat);
    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handlePlayerChat();
    });

    // Initialize with player name input focused
    playerNameInput.focus();

    console.log("Game initialization complete");
});



