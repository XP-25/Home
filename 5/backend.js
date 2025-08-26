const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const escapeHtml = require('escape-html');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: (origin, callback) => {
            const allowed = ['https://raisexp.games']; // Add local for testing
            if (allowed.includes(origin) || !origin) callback(null, true);
            else callback(new Error('Not allowed by CORS'));
        },
        methods: ['GET', 'POST'],
        credentials: true
    }
});





const rooms = {};
let publicRoomCounter = 0; // For creating multiple public rooms

// Parse the paragraphs
const paras = `
"The sun rises over the quiet hills, painting the sky in shades of pink and gold, welcoming a peaceful morning."
"Small birds hop between branches, chirping happily while the cool breeze carries the scent of blooming flowers through the open fields."
"In the village square, children play games while elders share stories under the shade of an ancient, twisted banyan tree."
"The market bustles with life as vendors display colorful fruits, fragrant spices, and handmade goods to eager, wandering customers."
"Waves crash against the rocky shoreline, spraying salty mist into the air as seagulls circle above, searching for their next meal."
"The narrow path winds through dense forest, where sunlight filters through green leaves, creating shifting patterns on the moss-covered ground."
"A wooden boat drifts slowly along the calm river, its oars dipping rhythmically as a fisherman casts his net into the water."
"Under the star-filled sky, travelers gather around a crackling campfire, sharing warm food, laughter, and tales from distant lands and past adventures."
"Heavy rain pounds on the tin roof, the sound blending with distant thunder while lightning illuminates the dark, stormy countryside."
"In the library, rows of dusty books hide forgotten knowledge, waiting for curious hands to open their pages and uncover lost wisdom."
"A train whistles in the distance, its glowing lights cutting through thick fog as it speeds toward the sleeping town ahead."
"The scent of fresh bread drifts from the bakery, tempting passersby to step inside and warm themselves by the old stone oven."
"At dawn, the mountain peaks glow in golden light, their snowy caps shining against the deep blue of the waking sky."
"The festival begins with music and dancing as lanterns sway above the crowd, filling the streets with light, color, and joy."
"A lone wolf howls in the distance, its voice echoing through the valley as the moon climbs higher in the cold night sky."
"In the desert, shifting dunes glitter in the sun, and the air shimmers above the sand as heat rises from the ground."
"A ship battles rough seas, its sails straining against the wind while waves slam against the hull and spray covers the deck."
"The old clock tower tolls midnight, its chimes resonating through the quiet streets as fog creeps along cobblestones in eerie silence."
"In a quiet study, candlelight flickers across ancient maps while an explorer traces routes to lands no one has visited in centuries."
"Snow falls gently on the rooftops, blanketing the world in white, muting all sound except the crunch of footsteps in the still air."
"The lighthouse stands firm against the storm, its beam sweeping across the black sea, guiding sailors safely to the rocky shore."
"Deep in the jungle, the roar of a waterfall drowns out all other sounds as mist rises into the humid, green air."
"The marketplace glows under paper lanterns, where merchants trade spices, fabrics, and precious stones while music and laughter fill the night."
"Thunder rumbles across the plains, and lightning forks across the sky as herds of wild horses gallop through the tall grass below."
"In the icy north, glaciers creak and shift, their deep blue cracks glowing faintly as the sun sets behind snow-covered peaks."
"An old journal reveals tales of buried treasure, secret maps, and dangerous journeys across oceans filled with storms and unknown creatures."
"The blacksmith hammers glowing metal, sparks flying into the air as the rhythmic clang echoes through the village streets and nearby hills."
"On the open sea, the horizon stretches endlessly, broken only by the distant silhouette of an island hidden behind a veil of mist."
"The jungle floor is alive with movement—colorful insects crawl over damp leaves while unseen animals rustle in the shadows of towering trees."
"Under a crimson sunset, nomads lead their camels across the endless desert, their silhouettes sharp against the fading light of the sky."
"Inside the grand hall, chandeliers sparkle above the crowd as music swells, and dancers twirl in gowns and uniforms from distant lands."
"A storm approaches, turning the air heavy and electric; the wind howls through the trees as the first drops of rain begin to fall."
"In the frozen tundra, a pack of wolves stalks silently, their white fur blending perfectly with the snow as they close in on prey."
"The cave walls are covered in glowing crystals, casting strange, dancing lights on the stone floor as water drips steadily in the darkness."
"The battlefield is silent now, save for the rustling of banners in the wind, as the sun rises over the valley of fallen warriors."
"A grand library towers over the city, its golden doors guarded by statues, and inside, rows of towering shelves hold centuries of knowledge."
"Waves glitter under the moonlight as a ship glides silently through the water, its crew watching the horizon for signs of land or danger."
"The forest burns in the distance, red flames leaping into the night sky while animals flee through the smoke and falling ash."
"In the great bazaar, merchants shout over each other, offering silks, spices, rare gems, and strange artifacts from lands far across the sea."
"The wind carries the scent of rain and earth as travelers make camp, setting up tents before the approaching storm breaks over the hills."
"Inside the laboratory, strange machines hum and whir while scientists work tirelessly, recording data and adjusting experiments with practiced precision."
"The mountain pass is treacherous, with steep cliffs on either side and snow blowing into the eyes of the weary travelers."
"A hidden temple lies deep within the jungle, its stone walls covered in moss and vines, guarding secrets from a forgotten civilization."
"Lightning flashes over the ocean, illuminating a ghostly ship drifting silently through the waves with torn sails and no visible crew."
"In the deep canyon, a river roars between towering cliffs, its spray dampening the mossy rocks where eagles nest high above."
"The kingdom celebrates victory with feasts, music, and parades, as banners wave proudly from the castle towers and fireworks light the night sky."
"Beneath the desert sands, an ancient city lies buried, its streets preserved in silence, waiting to be uncovered by daring explorers."
"The frozen lake glitters under the pale winter sun, its surface smooth as glass while skaters glide in graceful patterns."
"On the eve of battle, the army gathers, their armor clinking in the torchlight as the general speaks words of courage and honor."
"Far from the city, a monastery rests in the mountains, where monks chant in candlelight and bells echo across the valleys below."
"At dawn, the small fishing village awakens to the sounds of gulls and crashing waves. Boats sway gently in the harbor, their wooden hulls creaking as fishermen prepare nets and baskets. Children run along the docks chasing each other, while the smell of salt and seaweed fills the air."
"The rainforest canopy stretches high above, filtering sunlight into golden shafts that dance across the forest floor. Exotic birds flash red, yellow, and blue as they dart between branches, while monkeys swing effortlessly through the trees. Somewhere in the distance, a jaguar growls softly, unseen yet felt."
"Beneath the waves, coral reefs teem with life: schools of shimmering fish move like living clouds, sea turtles glide lazily, and tiny creatures peek out from colorful anemones. The water is so clear that every ripple of sand can be seen, swaying gently in the ocean current."
"In a hidden valley surrounded by snow-capped peaks, a crystal-clear lake reflects the sky like a mirror. Deer drink at the water’s edge, and the air is so pure it carries the scent of pine and wildflowers. The silence here feels ancient, untouched by human hands."
"The city never sleeps: neon lights flicker, cars honk impatiently, and the aroma of street food fills every corner. Crowds weave through narrow alleys lined with vendors selling everything from glowing toys to sizzling skewers. Somewhere, a lone saxophonist plays under a flickering streetlamp."
"A grand opera house rises at the heart of the capital, its marble columns and golden domes glowing in the setting sun. Inside, velvet curtains shimmer under crystal chandeliers as the orchestra tunes their instruments, preparing for a night of music that will echo for centuries."
"A desert storm rolls across the horizon, swallowing the sun in a wall of sand. The wind screams against the dunes, erasing footprints within seconds. Travelers pull scarves over their faces, their camels kneeling low to weather the storm’s fury until the sky clears once more."
"In the Arctic night, the aurora borealis weaves ribbons of green and purple across the sky. The snow reflects the colors, turning the world into a dream. Huskies pull sleds through the glowing landscape, their breath steaming in the frozen air with every step."
"An ancient library sits at the edge of a forgotten city. Inside, towering shelves overflow with scrolls, maps, and manuscripts, their edges brittle with age. Dust motes float in shafts of light, and the faint scent of parchment lingers in the cool, still air."
"The ocean liner glides through calm waters, its decks filled with passengers enjoying the warm breeze. Waiters in white uniforms serve drinks with perfect balance, and somewhere below, the steady hum of the engines reminds everyone of the great journey still ahead."
"A hidden waterfall cascades into a turquoise pool, its mist forming tiny rainbows in the sun. Moss-covered rocks frame the scene, and dragonflies hover like living jewels. It feels like stepping into another world, one untouched by time or human ambition."
"The palace gardens stretch for miles, filled with fountains, rose-covered arches, and marble statues that seem almost alive. Peacocks stroll along cobblestone paths, their feathers glistening in the sun, while the scent of jasmine and orange blossoms drifts through the air."
"A mountain monastery clings to the cliffs, accessible only by a winding path carved into the rock. Bells ring in the morning mist, and monks in saffron robes move silently through stone courtyards, their chants blending with the wind that whispers through the peaks."
"A steam locomotive charges through the countryside, its black smoke curling into the sky. Inside, passengers sip tea and watch fields roll by, while the rhythmic clatter of wheels on rails sets a soothing, unending tempo."
"The ruins of a once-great city stand silent beneath the desert sun. Crumbling towers cast long shadows, and faded carvings hint at stories long forgotten. Only the wind moves here, carrying whispers of a civilization lost to time."
"In a candlelit study, an inventor works through the night. Gears, springs, and brass fittings clutter the desk, while blueprints are pinned to every wall. Each turn of the wrench brings him closer to his dream—a machine that could change the world forever."
"At a bustling port, ships from distant lands unload spices, silks, and rare metals. Merchants haggle loudly, gulls scream overhead, and sailors exchange tales of storms, monsters, and strange lands beyond the horizon."
"A great storm lashes the coast, waves smashing against cliffs as rain whips sideways. Fishermen haul their boats ashore, shouting over the roar of the wind. In the distance, the lighthouse blinks steadily, its beam cutting through the chaos."
"A caravan winds its way across the desert, the air shimmering in the heat. Camels sway with slow, steady steps, and the leader carries an ancient map marked with symbols no one in the group fully understands."
"Deep in a vast underground cavern, stalactites drip water into glowing pools. The walls glitter faintly with mineral deposits, and strange echoes bounce in ways that make the space feel alive."
"A medieval castle looms over the valley, its high walls casting deep shadows. Inside, knights train in the courtyard, their armor clashing loudly, while servants rush to prepare for the king’s return from battle."
"A great glacier groans as it shifts, sending shards of ice tumbling into a river below. The sound is deep and resonant, echoing through valleys untouched by human footsteps."
"The city square erupts in celebration as fireworks burst overhead. Musicians play lively tunes, dancers spin in colorful skirts, and children chase each other through clouds of confetti."
"A volcanic eruption paints the night sky red. Lava flows like molten rivers, lighting the landscape in an otherworldly glow, while ash falls silently over the surrounding villages."
"Deep beneath the ocean, strange creatures drift in the dark. Jellyfish pulse with glowing light, and translucent fish dart through the blackness, their eyes adapted to a world without sunlight."
"A grand cathedral towers above the city, its stained glass casting colorful patterns across the stone floor. Choir voices rise in harmony, filling the space with a sound that seems to touch the heavens."
"A royal procession winds through the streets. Trumpets sound, banners wave, and the people cheer as the golden carriage passes, its polished sides reflecting the bright afternoon sun."
"A winter storm blankets the countryside in snow. Trees bow under the weight, rivers freeze solid, and the only sound is the crunch of boots on the icy path."
"In a glass-domed laboratory, scientists grow plants that glow in the dark. The air smells faintly of chemicals, and each glass container holds a tiny world, lit by an unnatural green light."
"The ruins of an ancient temple sit high in the mountains, its pillars cracked and walls overgrown. Statues of forgotten gods stare silently into the distance, watching the passing centuries."
"A great library ship sails the seas, carrying knowledge to distant lands. Its shelves are filled with books in countless languages, and scholars aboard debate philosophy late into the night."
"A battlefield stretches as far as the eye can see, the ground scorched and broken. Flags lie torn, and the air smells of smoke and steel."
"In a glass-domed observatory, astronomers track the movements of distant stars. Telescopes hum as they rotate, and notes are scribbled quickly to record every change in the heavens."
"A hidden garden blooms in the center of a ruined city. Vines creep over crumbling walls, and flowers burst in colors too vivid to believe."
"A great train station buzzes with life—porters shout destinations, whistles blow, and steam hisses from engines waiting to depart."
"In a deep jungle, a tribe gathers around a fire. Drums beat steadily, and dancers move in patterns passed down for generations."
"The icebreaker ship plows through frozen seas, its steel hull groaning under the pressure. Behind it, a trail of shattered ice stretches to the horizon."
"A massive storm cloud rises over the savanna. Lightning forks downward, striking trees as animals flee toward distant hills."
"In a vast underground canyon, ancient paintings cover the walls. The colors remain vivid, telling stories of people long gone."
"A grand library in the capital stores not only books, but artifacts, paintings, and rare treasures from across the world."
"A lone astronaut floats in the silence of space, tethered to the station. Below, Earth glows with blue oceans and swirling white clouds."
"A great hall is filled with nobles in elaborate dress. Candles flicker, casting golden light across tables laden with food and wine."
"In a storm-lashed harbor, ships strain at their moorings. Waves crash over the docks, and ropes creak under the strain."
"A frozen waterfall hangs like glass, catching the morning light. The air is so cold it bites at every breath."
"Deep in the desert night, stars blaze like diamonds. The sand still radiates heat, and the silence feels infinite."
"In a towering canyon, wind whistles through narrow passages. Shadows move strangely, and the air feels heavy with mystery."
"The polar night lasts for months. Lanterns glow in every window, and the people live by routines marked only by the clock."
"In the deep jungle, ruins lie hidden under roots and vines. Birds cry overhead, and the air is thick with humidity."
"A storm sweeps over the plains, bending the tall grass flat. Lightning splits the sky, and thunder shakes the ground."
"On the edge of the world, cliffs drop straight into the ocean. Waves pound the rock, and seabirds wheel overhead, crying into the wind."
`;

const paragraphs = paras.match(/"([^"]+)"/g).map(p => p.replace(/"/g, '')) || [];

// Define broadcastPlayerList globally
function broadcastPlayerList(room) {
    const playerList = Object.values(rooms[room]?.players || {});
    io.to(room).emit('updatePlayerList', playerList);
}

io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    socket.on('createRoom', (playerName) => {
        playerName = escapeHtml(playerName);
        if (playerName.length > 20 || playerName.length < 1) return socket.emit('error', 'Invalid name');
        const room = uuidv4().slice(0, 6).toUpperCase();
        rooms[room] = { players: {}, started: false, creator: socket.id, sharedPassage: '' };
        socket.join(room);
        rooms[room].players[socket.id] = { id: socket.id, name: playerName, progress: 0, lastActivity: Date.now() };
        socket.emit('roomCreated', room);
        broadcastPlayerList(room);
    });

    socket.on('joinRoom', ({ room, playerName }) => {
        playerName = escapeHtml(playerName);
        if (playerName.length > 20 || playerName.length < 1) return socket.emit('error', 'Invalid name');
        if (room === 'public') {
            // Find or create a public room
            let publicRoom = null;
            for (let i = 1; i <= publicRoomCounter + 1; i++) {
                const pubRoomId = `public-${i}`;
                if (!rooms[pubRoomId]) {
                    publicRoomCounter = i;
                    rooms[pubRoomId] = { players: {}, started: false, creator: null, sharedPassage: '' };
                    publicRoom = pubRoomId;
                    break;
                } else if (!rooms[pubRoomId].started && Object.keys(rooms[pubRoomId].players).length < 100) {
                    publicRoom = pubRoomId;
                    break;
                }
            }
            if (!publicRoom) {
                publicRoomCounter++;
                publicRoom = `public-${publicRoomCounter}`;
                rooms[publicRoom] = { players: {}, started: false, creator: null, sharedPassage: '' };
            }
            room = publicRoom;
        }
        if (rooms[room] && Object.keys(rooms[room].players).length < 100) {
            const nameExists = Object.values(rooms[room].players).some(p => p.name === playerName);
            if (nameExists) {
                socket.emit('nameTaken', 'Name is already taken in this room. Choose another.');
                return;
            }
            socket.join(room);
            rooms[room].players[socket.id] = { id: socket.id, name: playerName, progress: 0, lastActivity: Date.now() };
            socket.emit('joinedRoom', room); // Emit the specific room back
            broadcastPlayerList(room);
        } else {
            socket.emit('error', 'Room full or does not exist');
        }
    });

    socket.on('gameStart', (room) => {
        if (rooms[room] && !rooms[room].started && socket.id === rooms[room].creator) {
            const sharedPassage = paragraphs[Math.floor(Math.random() * paragraphs.length)];
            rooms[room].started = true;
            rooms[room].sharedPassage = sharedPassage;
            const startTime = Date.now();
            io.to(room).emit('startGame', { passage: sharedPassage, startTime });
            broadcastPlayerList(room);
        }
    });

    socket.on('checkStartPublicGame', (room) => {
        if (room.startsWith('public-') && rooms[room] && !rooms[room].started) {
            const playerCount = Object.keys(rooms[room].players).length;
            if (playerCount >= 2 && playerCount <= 100) {
                const sharedPassage = paragraphs[Math.floor(Math.random() * paragraphs.length)];
                rooms[room].started = true;
                rooms[room].sharedPassage = sharedPassage;
                const startTime = Date.now();
                io.to(room).emit('startGame', { passage: sharedPassage, startTime });
                broadcastPlayerList(room);
            } else {
                io.to(room).emit('error', playerCount < 2 ? 'Need at least 2 players to start.' : 'Too many players.');
            }
        }
    });

    socket.on('progress', ({ room, progress }) => {
        if (rooms[room] && rooms[room].players[socket.id]) {
            rooms[room].players[socket.id].progress = Math.min(progress, 1); // Cap at 1
            rooms[room].players[socket.id].lastActivity = Date.now();
            io.to(room).emit('progressUpdate', { id: socket.id, progress: rooms[room].players[socket.id].progress });
            broadcastPlayerList(room);
        }
    });

    socket.on('finish', ({ room, playerName, wpm, accuracy, typedText }) => {
        if (rooms[room] && rooms[room].players[socket.id]) {
            const passage = rooms[room].sharedPassage;
            if (!passage) return socket.emit('error', 'No passage available');
            let correctChars = 0;
            for (let i = 0; i < Math.min(typedText.length, passage.length); i++) {
                if (typedText[i] === passage[i]) correctChars++;
            }
            const serverAccuracy = Math.round((correctChars / passage.length) * 100);
            if (serverAccuracy !== accuracy) return socket.emit('error', 'Invalid finish data');
            rooms[room].players[socket.id].wpm = wpm;
            rooms[room].players[socket.id].accuracy = accuracy;
            rooms[room].players[socket.id].lastActivity = Date.now();
            io.to(room).emit('playerFinished', { id: socket.id, wpm, accuracy });
            broadcastPlayerList(room);
        }
    });

    socket.on('updatePlayerCount', ({ room, count }) => {
        io.to(room).emit('playerCountUpdate', count);
    });

    socket.on('gameReset', (room) => {
        if (rooms[room] && socket.id === rooms[room].creator) {
            rooms[room].started = false;
            rooms[room].sharedPassage = '';
            for (const id in rooms[room].players) {
                rooms[room].players[id].progress = 0;
                rooms[room].players[id].wpm = undefined;
                rooms[room].players[id].accuracy = undefined;
            }
            io.to(room).emit('gameReset');
            broadcastPlayerList(room);
        }
    });

    socket.on('disconnect', () => {
        for (const room in rooms) {
            if (rooms[room].players[socket.id]) {
                delete rooms[room].players[socket.id];
                if (rooms[room].creator === socket.id && Object.keys(rooms[room].players).length > 0) {
                    rooms[room].creator = Object.keys(rooms[room].players)[0];
                }
                io.to(room).emit('playerLeft', socket.id);
                broadcastPlayerList(room);
                if (Object.keys(rooms[room].players).length === 0) {
                    delete rooms[room];
                }
            }
        }
        console.log(`Client disconnected: ${socket.id}`);
    });
});

// Inactivity checker (unchanged as per request)
setInterval(() => {
    for (const room in rooms) {
        if (rooms[room].started) {
            for (const id in rooms[room].players) {
                const player = rooms[room].players[id];
                if (Date.now() - player.lastActivity > 20000 && !(player.finished)) {
                    io.to(id).emit('inactiveRemoval');
                    delete rooms[room].players[id];
                    io.to(room).emit('playerLeft', id);
                    broadcastPlayerList(room);
                    console.log(`Removed inactive player ${id} from room ${room}`);
                }
            }
        }
    }
}, 30000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));





