// --- Firebase Configuration and Initialization ---
// Using the Firebase API keys provided in your RPS code snippet
const firebaseConfig = {
apiKey: "AIzaSyBZqR2tQYOGfpq5AeB-YjczQkZtTdJMek8",
authDomain: "oliver-uno.firebaseapp.com",
databaseURL: "https://oliver-uno-default-rtdb.firebaseio.com",
projectId: "oliver-uno",
storageBucket: "oliver-uno.firebasestorage.app",
messagingSenderId: "795136591642",
appId: "1:795136591642:web:3bb2cb4bec6ee0ab228ea3",
measurementId: "G-N7NVJSBGKV"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// --- DOM Elements ---
const lobbySection = document.getElementById('lobby-section');
const gameSection = document.getElementById('game-section');
const resultScreen = document.getElementById('resultScreen');

const playerNameInput = document.getElementById('playerNameInput');
const createGameBtn = document.getElementById('createGameBtn');
const gameCodeInput = document.getElementById('gameCodeInput');
const joinGameBtn = document.getElementById('joinGameBtn');
const lobbyMessage = document.getElementById('lobbyMessage');

const gameCodeDisplay = document.getElementById('gameCodeDisplay');
const playerSymbolDisplay = document.getElementById('playerSymbolDisplay');
const playersList = document.getElementById('playersList');
const gameStatus = document.getElementById('gameStatus');
const ticTacToeBoard = document.getElementById('ticTacToeBoard');
const cells = document.querySelectorAll('.cell');
const playAgainBtn = document.getElementById('playAgainBtn'); // Button in game section
const leaveGameBtn = document.getElementById('leaveGameBtn');

// Scoreboard elements
const playerXNameSpan = document.getElementById('playerXName');
const playerXWinsSpan = document.getElementById('playerXWins');
const playerXLossesSpan = document.getElementById('playerXLosses');
const playerXTiesSpan = document.getElementById('playerXTies');

const playerONameSpan = document.getElementById('playerOName');
const playerOWinsSpan = document.getElementById('playerOWins');
const playerOLossesSpan = document.getElementById('playerOLosses');
const playerOTiesSpan = document.getElementById('playerOTies');

// Result screen elements
const resultText = document.getElementById('resultText');
const resCurrentPlayerInfo = document.getElementById('resCurrentPlayerInfo');
const resOpponentPlayerInfo = document.getElementById('resOpponentPlayerInfo');
const playAgainBtnFromResult = document.getElementById('playAgainBtnFromResult'); // Button in result screen (renamed for consistency)
const leaveBtnFromResult = document.getElementById('leaveBtnFromResult'); // Button in result screen

// --- Global Game State Variables ---
let currentUserName = '';
let currentGameCode = '';
let currentPlayerId = ''; // Firebase-generated unique ID for this client's player
let mySymbol = ''; // 'X' or 'O' for this player
let gameRef = null; // Firebase reference to the current game

// --- Tic-Tac-Toe Game Logic Variables (Local to client) ---
const WINNING_COMBINATIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

// --- Sound Effects (from RPS) ---
const soundWin = new Audio('win.mp3');
const soundLose = new Audio('lose.mp3');
const soundTie = new Audio('tie.mp3');
const soundBtn = new Audio('btn.mp3'); // No specific countdown sound needed for Tic-Tac-Toe


// --- Utility Functions ---
function generateGameCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Play button click sound (from RPS)
function playBtnSound() {
    if (soundBtn) {
        soundBtn.currentTime = 0; // Rewind to start if already playing
        soundBtn.play().catch(e => console.error("Error playing soundBtn:", e)); // Catch potential errors
    }
}

// --- Firebase Database Inters ---
async function createGame() {
    playBtnSound(); // Play sound on button click

    const name = playerNameInput.value.trim();
    if (!name) {
        lobbyMessage.textContent = 'Please enter your name.';
        return;
    }

    const newGameCode = generateGameCode();
    gameRef = database.ref('tictactoe_games/' + newGameCode);

    const initialGameState = {
        status: 'waiting', // waiting, playing, finished
        board: Array(9).fill(null), // Array of 9 nulls for empty board
        currentPlayerTurn: 'X', // X starts first
        players: {
            // [playerId]: { name: "PlayerName", symbol: "X", wins: 0, losses: 0, ties: 0, online: true }
        },
        winner: null, // 'X', 'O', or 'DRAW'
        lastActivity: firebase.database.ServerValue.TIMESTAMP
    };

    try {
        await gameRef.set(initialGameState);
        await joinGame(newGameCode, name, true); // Host joins automatically
        lobbyMessage.textContent = `Game created! Share code: ${newGameCode}`;
    } catch (error) {
        console.error("Error creating game:", error);
        lobbyMessage.textContent = 'Error creating game. Please try again.';
    }
}

async function joinGame(code, name = playerNameInput.value.trim(), isCreator = false) {
    playBtnSound(); // Play sound on button click

    if (!name) {
        lobbyMessage.textContent = 'Please enter your name.';
        return;
    }
    const gameCode = code || gameCodeInput.value.trim().toUpperCase();
    if (!gameCode) {
        lobbyMessage.textContent = 'Please enter a room code.';
        return;
    }

    gameRef = database.ref('tictactoe_games/' + gameCode);
    try {
        const snapshot = await gameRef.once('value');
        if (!snapshot.exists()) {
            lobbyMessage.textContent = 'Room not found. Check the code.';
            gameRef = null;
            return;
        }

        const gameData = snapshot.val();
        const existingPlayers = gameData.players || {};
        const playerIds = Object.keys(existingPlayers);

        let assignedSymbol = '';
        let existingPlayerFound = false;

        // Check if player is re-joining or already in the room
        for (const pId in existingPlayers) {
            if (existingPlayers[pId].name === name && existingPlayers[pId].online) {
                currentPlayerId = pId;
                assignedSymbol = existingPlayers[pId].symbol;
                existingPlayerFound = true;
                break;
            }
        }
        
        if (!existingPlayerFound) {
            if (playerIds.length >= 2) {
                lobbyMessage.textContent = 'Room is full.';
                gameRef = null;
                return;
            }
            // Determine symbol for the joining player
            assignedSymbol = (playerIds.length === 0) ? 'X' : ((existingPlayers[playerIds[0]].symbol === 'X') ? 'O' : 'X');
            const playerEntryRef = gameRef.child('players').push(); // Firebase generates unique key
            currentPlayerId = playerEntryRef.key;
        }

        currentUserName = name;
        currentGameCode = gameCode;
        mySymbol = assignedSymbol;

        await gameRef.child(`players/${currentPlayerId}`).update({
            name: currentUserName,
            symbol: mySymbol,
            online: true,
            wins: existingPlayers[currentPlayerId]?.wins || 0, // Preserve scores on re-join
            losses: existingPlayers[currentPlayerId]?.losses || 0,
            ties: existingPlayers[currentPlayerId]?.ties || 0
        });

        // Update game status if 2 players are now present (and game isn't already playing/finished)
        const onlinePlayersCount = Object.values(existingPlayers).filter(p => p.online).length + (existingPlayerFound ? 0 : 1);
        if (onlinePlayersCount >= 2 && gameData.status === 'waiting') {
             await gameRef.update({ status: 'playing' }); // Game can now start
        }


        setupGameListeners();

        lobbySection.classList.add('hidden');
        resultScreen.classList.add('hidden'); // Hide result screen if shown
        gameSection.classList.remove('hidden');
        gameCodeDisplay.textContent = `Room Code: ${currentGameCode}`;
        playerSymbolDisplay.textContent = `You are: ${mySymbol === 'X' ? 'X' : 'O'}`; // Add emoji
        lobbyMessage.textContent = ''; // Clear lobby message

        // Mark player as offline if they disconnect
        // Using .set(null) effectively removes the player when they go offline
        gameRef.child(`players/${currentPlayerId}/online`).onDisconnect().set(false);
    } catch (error) {
        console.error("Error joining game:", error);
        lobbyMessage.textContent = 'Error joining game. Please try again.';
        gameRef = null;
    }
}

async function makeMove(index) {
    playBtnSound(); // Play sound on cell click

    if (!gameRef) return;

    const snapshot = await gameRef.once('value');
    const gameData = snapshot.val();

    if (gameData.status !== 'playing' || gameData.winner !== null) {
        gameStatus.textContent = "Game not active or already finished!";
        return;
    }

    if (gameData.currentPlayerTurn !== mySymbol) {
        gameStatus.textContent = "It's not your turn!";
        return;
    }

    if (gameData.board[index] !== null) {
        gameStatus.textContent = "That cell is already taken!";
        return;
    }

    const newBoard = [...gameData.board];
    newBoard[index] = mySymbol;

    let newWinner = null;
    let newStatus = 'playing';

    if (checkWin(newBoard, mySymbol)) {
        newWinner = mySymbol;
        newStatus = 'finished';
    } else if (checkDraw(newBoard)) {
        newWinner = 'DRAW';
        newStatus = 'finished';
    }

    const nextPlayerTurn = (mySymbol === 'X') ? 'O' : 'X';

    const updates = {
        board: newBoard,
        currentPlayerTurn: nextPlayerTurn,
        winner: newWinner,
        status: newStatus,
        lastActivity: firebase.database.ServerValue.TIMESTAMP
    };

    // Update scores if game ended
    if (newStatus === 'finished') {
        const players = gameData.players;
        let playerXId = null;
        let playerOId = null;
        for (const pId in players) {
            if (players[pId].symbol === 'X') playerXId = pId;
            if (players[pId].symbol === 'O') playerOId = pId;
        }

        if (newWinner === 'X') {
            // Update X's wins and O's losses
            updates[`players/${playerXId}/wins`] = (players[playerXId].wins || 0) + 1;
            updates[`players/${playerOId}/losses`] = (players[playerOId].losses || 0) + 1;
        } else if (newWinner === 'O') {
            // Update O's wins and X's losses
            updates[`players/${playerOId}/wins`] = (players[playerOId].wins || 0) + 1;
            updates[`players/${playerXId}/losses`] = (players[playerXId].losses || 0) + 1;
        } else if (newWinner === 'DRAW') {
            // Update both players' ties
            updates[`players/${playerXId}/ties`] = (players[playerXId].ties || 0) + 1;
            updates[`players/${playerOId}/ties`] = (players[playerOId].ties || 0) + 1;
        }
    }

    await gameRef.update(updates);
}

function checkWin(board, symbol) {
    return WINNING_COMBINATIONS.some(combination => {
        return combination.every(index => {
            return board[index] === symbol;
        });
    });
}

function checkDraw(board) {
    return board.every(cell => cell !== null);
}

// Renamed from resetGame to playAgain for consistency with RPS
async function playAgain() {
    playBtnSound(); // Play sound on button click

    if (!gameRef) return;
    const snapshot = await gameRef.once('value');
    const gameData = snapshot.val();

    // Check if there are two players for a game to reset
    const onlinePlayersCount = Object.values(gameData.players || {}).filter(p => p.online).length;

    if (onlinePlayersCount < 2) {
        // If not enough players, just reset state to waiting
        await gameRef.update({
            board: Array(9).fill(null),
            currentPlayerTurn: 'X',
            winner: null,
            status: 'waiting',
            lastActivity: firebase.database.ServerValue.TIMESTAMP
        });
    } else {
        // Reset for a new round
        await gameRef.update({
            board: Array(9).fill(null),
            currentPlayerTurn: 'X', // X always starts new round
            winner: null,
            status: 'playing', // Immediately set to playing for new round
            lastActivity: firebase.database.ServerValue.TIMESTAMP
        });
    }
    
    // Hide result screen and show game section
    resultScreen.classList.add('hidden');
    gameSection.classList.remove('hidden');
    playAgainBtn.classList.add('hidden'); // Hide in-game play again until next finish
}

async function leaveGame() {
    playBtnSound(); // Play sound on button click

    if (!gameRef || !currentPlayerId) {
        console.warn("No active game or player to leave.");
        location.reload(); // Just reload to ensure clean state
        return;
    }

    try {
        // Mark player as offline, which will trigger onDisconnect.set(false)
        await gameRef.child(`players/${currentPlayerId}`).update({ online: false });
        
        // Get the latest state to see if room should be deleted
        const snapshot = await gameRef.once('value');
        const gameData = snapshot.val();
        const remainingOnlinePlayers = Object.values(gameData.players || {}).filter(p => p.online);

        // If no online players left, remove the whole room
        if (remainingOnlinePlayers.length === 0) {
            await gameRef.remove();
        } else {
            // If others remain, and game was playing, put it back to waiting and reset board
            if (gameData.status === 'playing' || gameData.status === 'finished') {
                 await gameRef.update({
                    status: 'waiting',
                    winner: null,
                    board: Array(9).fill(null),
                    currentPlayerTurn: 'X'
                });
            }
        }
        
        // Detach listener
        gameRef.off('value');

        // Clear local state and reload page for a clean start (consistent with RPS)
        currentUserName = '';
        currentGameCode = '';
        currentPlayerId = '';
        mySymbol = '';
        gameRef = null;
        location.reload();
        
    } catch (error) {
        console.error("Error leaving game:", error);
        alert("Could not leave game. Please try refreshing.");
        location.reload(); // Force reload on error
    }
}

// --- Realtime Listeners ---
function setupGameListeners() {
    gameRef.on('value', (snapshot) => {
        const gameData = snapshot.val();
        if (!gameData) {
            // This means the room itself was deleted (e.g., by the last player leaving)
            alert("The room you were in has closed or no longer exists.");
            // Ensure the onDisconnect cleanup is also removed to prevent infinite loop
            if (gameRef && currentPlayerId) {
                gameRef.child(`players/${currentPlayerId}/online`).onDisconnect().cancel();
            }
            location.reload(); // Refresh to clean state, consistent with RPS
            return;
        }
        updateGameUI(gameData);
    }, (error) => {
        console.error("Firebase read failed:", error);
        alert("Disconnected from game. Please try joining again.");
        leaveGame(); // Try to leave gracefully
    });
}

function updateGameUI(gameData) {
    // Check if result screen should be shown
    if (gameData.status === 'finished' && gameData.winner !== null) {
        displayResultScreen(gameData);
        return;
    } else {
        // Ensure game screen is visible if not in result state
        gameSection.classList.remove('hidden');
        resultScreen.classList.add('hidden');
    }


    // Update board
    cells.forEach((cell, index) => {
        cell.textContent = gameData.board[index];
        cell.className = 'cell'; // Reset classes
        if (gameData.board[index] === 'X') {
            cell.classList.add('x', 'taken');
        } else if (gameData.board[index] === 'O') {
            cell.classList.add('o', 'taken');
        } else {
            cell.classList.remove('x', 'o', 'taken');
        }
    });

    // Update players list & scoreboard names
    playersList.innerHTML = '';
    const players = gameData.players || {};
    let playerX = null;
    let playerO = null;

    Object.keys(players).forEach(pId => {
        const player = players[pId];
        if (player.symbol === 'X') playerX = player;
        if (player.symbol === 'O') playerO = player;

        const li = document.createElement('li');
        // Add emoji next to the player's symbol
        const playerEmoji = player.symbol === 'X' ? 'x' : 'x';
        li.textContent = `${player.name} (${playerEmoji})`; // Added emoji
        if (pId === currentPlayerId) {
            li.classList.add('me');
            li.textContent += ' (You)';
        }
        // Add online status indicator
        if (!player.online) {
            li.textContent += ' (Offline)';
            li.style.opacity = '0.6';
            li.style.fontStyle = 'italic';
        }
        if (player.symbol === gameData.currentPlayerTurn) {
            li.classList.add('current-turn');
        }
        li.classList.add(`taken-${player.symbol.toLowerCase()}`); // Add color class for name
        playersList.appendChild(li);
    });

    // Update Scoreboard UI with actual player names
    if (playerX) {
        playerXNameSpan.textContent = playerX.name;
        playerXWinsSpan.textContent = playerX.wins || 0;
        playerXLossesSpan.textContent = playerX.losses || 0;
        playerXTiesSpan.textContent = playerX.ties || 0;
    } else {
        playerXNameSpan.textContent = "Player X"; // Default if X not present
        playerXWinsSpan.textContent = playerXLossesSpan.textContent = playerXTiesSpan.textContent = 0;
    }

    if (playerO) {
        playerONameSpan.textContent = playerO.name;
        playerOWinsSpan.textContent = playerO.wins || 0;
        playerOLossesSpan.textContent = playerO.losses || 0;
        playerOTiesSpan.textContent = playerO.ties || 0;
    } else {
        playerONameSpan.textContent = "Player O"; // Default if O not present
        playerOWinsSpan.textContent = playerOLossesSpan.textContent = playerOTiesSpan.textContent = 0;
    }


    // Update game status message and playAgainBtn visibility
    const onlinePlayersCount = Object.values(players).filter(p => p.online).length;
    const turnEmoji = gameData.currentPlayerTurn === 'X' ? 'x' : 'x';

    if (gameData.status === 'waiting') {
        gameStatus.textContent = `Waiting for players (${onlinePlayersCount}/2)... ⏳`; // Added emoji
        playAgainBtn.classList.add('hidden'); // Hide in-game play again button
    } else if (gameData.status === 'playing') {
        if (gameData.currentPlayerTurn === mySymbol) {
            gameStatus.textContent = `Your turn! Go ${turnEmoji}! 💪`; // Added emojis
        } else {
            gameStatus.textContent = `It's ${gameData.currentPlayerTurn}'s turn! ${turnEmoji}`; // Added emoji
        }
        playAgainBtn.classList.add('hidden'); // Hide in-game play again button
    }
    // If game is finished, displayResultScreen will handle.
}

function displayResultScreen(gameData) {
    gameSection.classList.add('hidden');
    resultScreen.classList.remove('hidden');

    const players = gameData.players;
    let myPlayer = null;
    let opponentPlayer = null;

    for (const pId in players) {
        if (pId === currentPlayerId) {
            myPlayer = players[pId];
        } else {
            opponentPlayer = players[pId];
        }
    }

    let resultString = '';
    if (gameData.winner === 'DRAW') {
        resultString = "It's a Tie! 🤝"; // Added emoji
        resultText.className = 'animate-tie';
        soundTie.play().catch(e => console.error("Error playing soundTie:", e));
    } else if (gameData.winner === mySymbol) {
        resultString = "You Win! 🎉"; // Added emoji
        resultText.className = 'animate-win';
        soundWin.play().catch(e => console.error("Error playing soundWin:", e));
    } else {
        resultString = "You Lose! 😭"; // Added emoji
        resultText.className = 'animate-lose';
        soundLose.play().catch(e => console.error("Error playing soundLose:", e));
    }
    resultText.textContent = resultString;

    resCurrentPlayerInfo.innerHTML = `You (${mySymbol === 'X' ? 'x' : 'x'}): Wins: ${myPlayer.wins || 0} | Losses: ${myPlayer.losses || 0} | Ties: ${myPlayer.ties || 0}`;
    resOpponentPlayerInfo.innerHTML = `${opponentPlayer ? opponentPlayer.name : 'Opponent'} (${opponentPlayer ? (opponentPlayer.symbol === 'X' ? '❌' : '⭕') : ''}): Wins: ${opponentPlayer ? (opponentPlayer.wins || 0) : 0} | Losses: ${opponentPlayer ? (opponentPlayer.losses || 0) : 0} | Ties: ${opponentPlayer ? (opponentPlayer.ties || 0) : 0}`;
}


// --- Event Listeners ---
createGameBtn.addEventListener('click', createGame);
joinGameBtn.addEventListener('click', () => joinGame());

cells.forEach(cell => {
    cell.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.cellIndex);
        makeMove(index);
    });
});

// Event listener for "Play Again" button within the game section (less prominent)
playAgainBtn.addEventListener('click', playAgain);

// Event listener for "Play Again" button on the result screen (main )
playAgainBtnFromResult.addEventListener('click', playAgain);

// Event listener for "Leave Game" button in game section
leaveGameBtn.addEventListener('click', leaveGame);

// Event listener for "Leave Game" button on the result screen
leaveBtnFromResult.addEventListener('click', leaveGame);

// Optional: Ensure clean state on initial load
lobbySection.classList.remove('hidden');
gameSection.classList.add('hidden');
resultScreen.classList.add('hidden');
// Make sure this code runs after your HTML is loaded

// --- OPTION A: Append emoji to your existing chat input field ---
// Adjust 'chatMessageInput' to the actual ID of your message input field.
const messageInputField = document.getElementById('chatMessageInput'); 

const emojiButtons = document.querySelectorAll('#quickEmojiPicker .emoji-btn');

emojiButtons.forEach(button => {
button.addEventListener('click', () => {
const emoji = button.dataset.emoji; // Get emoji from data-emoji attribute

if (messageInputField) {
    // Add the emoji to the current value of the input field
    messageInputField.value += emoji;
    messageInputField.focus(); // Optional: keep focus on the input field
} else {
    console.warn("Chat message input field not found. Adjust the ID if needed.");
}

// --- OR ---

// --- OPTION B: Send emoji directly as a message ---
// If you want to send the emoji as a message immediately when clicked,
// and you have a function like `yourExistingSendMessageFunction(message)`,
// you would uncomment and use this instead of appending to an input:
/*
const emoji = button.dataset.emoji;
if (typeof yourExistingSendMessageFunction === 'function') {
    yourExistingSendMessageFunction(emoji);
} else {
    console.warn("yourExistingSendMessageFunction is not defined. Please adjust.");
}
*/
});
});
