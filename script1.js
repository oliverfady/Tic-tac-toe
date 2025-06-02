// --- Firebase Configuration and Initialization ---
const firebaseConfig = {
    apiKey: "AIzaSyBZqR2tQYOGfpq5AeB-YjczQkZtTdJMek8",
    authDomain: "oliver-uno.firebaseapp.com",
    databaseURL: "https://oliver-uno-default-rtdb.firebaseio.com",
    projectId: "oliver-uno",
    storageBucket: "oliver-uno.appspot.com",
    messagingSenderId: "795136591642",
    appId: "1:795136591642:web:3bb2cb4bec6ee0ab228ea3",
    measurementId: "G-N7NVJSBGKV"
  };
  firebase.initializeApp(firebaseConfig);
  const database = firebase.database();
  
  // DOM Elements
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
  const playAgainBtn = document.getElementById('playAgainBtn');
  const leaveGameBtn = document.getElementById('leaveGameBtn');
  
  const playerXNameSpan = document.getElementById('playerXName');
  const playerXWinsSpan = document.getElementById('playerXWins');
  const playerXLossesSpan = document.getElementById('playerXLosses');
  const playerXTiesSpan = document.getElementById('playerXTies');
  
  const playerONameSpan = document.getElementById('playerOName');
  const playerOWinsSpan = document.getElementById('playerOWins');
  const playerOLossesSpan = document.getElementById('playerOLosses');
  const playerOTiesSpan = document.getElementById('playerOTies');
  
  const resultText = document.getElementById('resultText');
  const resCurrentPlayerInfo = document.getElementById('resCurrentPlayerInfo');
  const resOpponentPlayerInfo = document.getElementById('resOpponentPlayerInfo');
  const playAgainBtnFromResult = document.getElementById('playAgainBtnFromResult');
  const leaveBtnFromResult = document.getElementById('leaveBtnFromResult');
  
  // --- Game State ---
  let currentUserName = '';
  let currentGameCode = '';
  let currentPlayerId = '';
  let mySymbol = '';
  let gameRef = null;
  
  const WINNING_COMBINATIONS = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];
  
  // --- Sounds ---
  const soundWin = new Audio('win.mp3');
  const soundLose = new Audio('lose.mp3');
  const soundTie = new Audio('tie.mp3');
  const soundBtn = new Audio('btn.mp3');
  
  function playBtnSound() {
    if (soundBtn) {
      soundBtn.currentTime = 0;
      soundBtn.play().catch(e => console.warn("sound error:", e));
    }
  }
  
  function generateGameCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
  
  async function createGame() {
    playBtnSound();
    const name = playerNameInput.value.trim();
    if (!name) return lobbyMessage.textContent = 'Enter your name.';
  
    const newGameCode = generateGameCode();
    gameRef = database.ref('tictactoe_games/' + newGameCode);
  
    const initialGameState = {
      status: 'waiting',
      board: Array(9).fill(null),
      currentPlayerTurn: 'X',
      players: {},
      winner: null,
      lastActivity: firebase.database.ServerValue.TIMESTAMP
    };
  
    try {
      await gameRef.set(initialGameState);
      await joinGame(newGameCode, name, true);
      lobbyMessage.textContent = `Game created! Share code: ${newGameCode}`;
    } catch (err) {
      console.error(err);
      lobbyMessage.textContent = 'Failed to create game.';
    }
  }
  
  async function joinGame(code, name = playerNameInput.value.trim(), isCreator = false) {
    playBtnSound();
    if (!name) return lobbyMessage.textContent = 'Enter your name.';
    const gameCode = code || gameCodeInput.value.trim().toUpperCase();
    if (!gameCode) return lobbyMessage.textContent = 'Enter a room code.';
  
    gameRef = database.ref('tictactoe_games/' + gameCode);
    try {
      const snap = await gameRef.once('value');
      if (!snap.exists()) {
        lobbyMessage.textContent = 'Room not found.';
        gameRef = null;
        return;
      }
  
      const data = snap.val();
      const existingPlayers = data.players || {};
      const playerIds = Object.keys(existingPlayers);
  
      let assignedSymbol = '';
      let existingPlayerFound = false;
  
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
        assignedSymbol = playerIds.length === 0 ? 'X' : (existingPlayers[playerIds[0]].symbol === 'X' ? 'O' : 'X');
        const playerEntryRef = gameRef.child('players').push();
        currentPlayerId = playerEntryRef.key;
      }
  
      currentUserName = name;
      currentGameCode = gameCode;
      mySymbol = assignedSymbol;
  
      await gameRef.child(`players/${currentPlayerId}`).update({
        name: currentUserName,
        symbol: mySymbol,
        online: true,
        wins: existingPlayers[currentPlayerId]?.wins || 0,
        losses: existingPlayers[currentPlayerId]?.losses || 0,
        ties: existingPlayers[currentPlayerId]?.ties || 0
      });
  
      // 🔧 FIX APPLIED HERE: Fetch updated player list and status
      const updatedSnap = await gameRef.once('value');
      const updatedData = updatedSnap.val();
      const onlinePlayers = Object.values(updatedData.players || {}).filter(p => p.online).length;
  
      if (onlinePlayers >= 2 && updatedData.status === 'waiting') {
        await gameRef.update({ status: 'playing' });
      }
  
      setupGameListeners();
      lobbySection.classList.add('hidden');
      resultScreen.classList.add('hidden');
      gameSection.classList.remove('hidden');
      gameCodeDisplay.textContent = `Room Code: ${currentGameCode}`;
      playerSymbolDisplay.textContent = `You are: ${mySymbol}`;
      lobbyMessage.textContent = '';
  
      gameRef.child(`players/${currentPlayerId}/online`).onDisconnect().set(false);
    } catch (err) {
      console.error(err);
      lobbyMessage.textContent = 'Failed to join game.';
      gameRef = null;
    }
  }
  async function makeMove(index) {
    playBtnSound();
    if (!gameRef) return;
  
    const snap = await gameRef.once('value');
    const gameData = snap.val();
  
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
  
    if (newStatus === 'finished') {
      const players = gameData.players;
      let playerXId = null;
      let playerOId = null;
      for (const pId in players) {
        if (players[pId].symbol === 'X') playerXId = pId;
        if (players[pId].symbol === 'O') playerOId = pId;
      }
  
      if (newWinner === 'X') {
        updates[`players/${playerXId}/wins`] = (players[playerXId].wins || 0) + 1;
        updates[`players/${playerOId}/losses`] = (players[playerOId].losses || 0) + 1;
      } else if (newWinner === 'O') {
        updates[`players/${playerOId}/wins`] = (players[playerOId].wins || 0) + 1;
        updates[`players/${playerXId}/losses`] = (players[playerXId].losses || 0) + 1;
      } else if (newWinner === 'DRAW') {
        updates[`players/${playerXId}/ties`] = (players[playerXId].ties || 0) + 1;
        updates[`players/${playerOId}/ties`] = (players[playerOId].ties || 0) + 1;
      }
    }
  
    await gameRef.update(updates);
  }
  
  function checkWin(board, symbol) {
    return WINNING_COMBINATIONS.some(combo => combo.every(i => board[i] === symbol));
  }
  
  function checkDraw(board) {
    return board.every(cell => cell !== null);
  }
  
  async function playAgain() {
    playBtnSound();
    if (!gameRef) return;
  
    const snap = await gameRef.once('value');
    const data = snap.val();
    const onlineCount = Object.values(data.players || {}).filter(p => p.online).length;
  
    await gameRef.update({
      board: Array(9).fill(null),
      currentPlayerTurn: 'X',
      winner: null,
      status: (onlineCount < 2) ? 'waiting' : 'playing',
      lastActivity: firebase.database.ServerValue.TIMESTAMP
    });
  
    resultScreen.classList.add('hidden');
    gameSection.classList.remove('hidden');
    playAgainBtn.classList.add('hidden');
  }
  
  async function leaveGame() {
    playBtnSound();
    if (!gameRef || !currentPlayerId) return location.reload();
  
    try {
      await gameRef.child(`players/${currentPlayerId}`).update({ online: false });
  
      const snap = await gameRef.once('value');
      const data = snap.val();
      const stillOnline = Object.values(data.players || {}).filter(p => p.online);
  
      if (stillOnline.length === 0) {
        await gameRef.remove();
      } else if (data.status === 'playing' || data.status === 'finished') {
        await gameRef.update({
          status: 'waiting',
          winner: null,
          board: Array(9).fill(null),
          currentPlayerTurn: 'X'
        });
      }
  
      gameRef.off('value');
      currentUserName = '';
      currentGameCode = '';
      currentPlayerId = '';
      mySymbol = '';
      gameRef = null;
      location.reload();
    } catch (err) {
      alert("Error leaving game. Please refresh.");
      location.reload();
    }
  }
  function setupGameListeners() {
    gameRef.on('value', async (snap) => {
      const data = snap.val();
      if (!data) {
        alert("Game room closed.");
        if (gameRef && currentPlayerId) {
          gameRef.child(`players/${currentPlayerId}/online`).onDisconnect().cancel();
        }
        location.reload();
        return;
      }
  
      // ✅ FIX: Ensure game starts when 2 players are online
      const players = data.players || {};
      const onlineCount = Object.values(players).filter(p => p.online).length;
  
      if (onlineCount >= 2 && data.status === 'waiting') {
        await gameRef.update({ status: 'playing' });
        return; // Let the next value event trigger UI update
      }
  
      updateGameUI(data);
    }, (err) => {
      console.error("Firebase listener error:", err);
      alert("Disconnected from game. Please try joining again.");
      leaveGame();
    });
  }
  
  function updateGameUI(data) {
    if (data.status === 'finished' && data.winner !== null) {
      displayResultScreen(data);
      return;
    }
  
    gameSection.classList.remove('hidden');
    resultScreen.classList.add('hidden');
  
    cells.forEach((cell, i) => {
      cell.textContent = data.board[i];
      cell.className = 'cell';
      if (data.board[i] === 'X') cell.classList.add('x', 'taken');
      else if (data.board[i] === 'O') cell.classList.add('o', 'taken');
    });
  
    playersList.innerHTML = '';
    const players = data.players || {};
  
    for (const pId in players) {
      const p = players[pId];
      const li = document.createElement('li');
      li.textContent = `${p.name} (${p.symbol})`;
      if (pId === currentPlayerId) {
        li.classList.add('me');
        li.textContent += ' (You)';
      }
      if (!p.online) {
        li.textContent += ' (Offline)';
        li.style.opacity = '0.6';
      }
      if (p.symbol === data.currentPlayerTurn) li.classList.add('current-turn');
      li.classList.add(`taken-${p.symbol.toLowerCase()}`);
      playersList.appendChild(li);
    }
  
    const xPlayer = Object.values(players).find(p => p.symbol === 'X');
    const oPlayer = Object.values(players).find(p => p.symbol === 'O');
  
    if (xPlayer) {
      playerXNameSpan.textContent = xPlayer.name;
      playerXWinsSpan.textContent = xPlayer.wins || 0;
      playerXLossesSpan.textContent = xPlayer.losses || 0;
      playerXTiesSpan.textContent = xPlayer.ties || 0;
    }
    if (oPlayer) {
      playerONameSpan.textContent = oPlayer.name;
      playerOWinsSpan.textContent = oPlayer.wins || 0;
      playerOLossesSpan.textContent = oPlayer.losses || 0;
      playerOTiesSpan.textContent = oPlayer.ties || 0;
    }
  
    const turnEmoji = data.currentPlayerTurn === 'X' ? '❌' : '⭕';
    if (data.status === 'waiting') {
      gameStatus.textContent = `Waiting for players...`;
      playAgainBtn.classList.add('hidden');
    } else {
      if (data.currentPlayerTurn === mySymbol) {
        gameStatus.textContent = `Your turn! ${turnEmoji}`;
      } else {
        gameStatus.textContent = `Opponent's turn ${turnEmoji}`;
      }
      playAgainBtn.classList.add('hidden');
    }
  }
  
  function displayResultScreen(data) {
    gameSection.classList.add('hidden');
    resultScreen.classList.remove('hidden');
  
    const players = data.players;
    const me = players[currentPlayerId];
    const opponent = Object.values(players).find(p => p !== me);
  
    let msg = '';
    if (data.winner === 'DRAW') {
      msg = "It's a Tie! 🤝";
      resultText.className = 'animate-tie';
      soundTie.play();
    } else if (data.winner === mySymbol) {
      msg = "You Win! 🎉";
      resultText.className = 'animate-win';
      soundWin.play();
    } else {
      msg = "You Lose! 😭";
      resultText.className = 'animate-lose';
      soundLose.play();
    }
  
    resultText.textContent = msg;
  
    resCurrentPlayerInfo.innerHTML =
      `You (${me.symbol}): Wins: ${me.wins || 0} | Losses: ${me.losses || 0} | Ties: ${me.ties || 0}`;
    resOpponentPlayerInfo.innerHTML =
      `${opponent.name} (${opponent.symbol}): Wins: ${opponent.wins || 0} | Losses: ${opponent.losses || 0} | Ties: ${opponent.ties || 0}`;
  }
  
  // Event Listeners
  createGameBtn.addEventListener('click', createGame);
  joinGameBtn.addEventListener('click', () => joinGame());
  cells.forEach(cell => cell.addEventListener('click', e => makeMove(parseInt(e.target.dataset.cellIndex))));
  playAgainBtn.addEventListener('click', playAgain);
  playAgainBtnFromResult.addEventListener('click', playAgain);
  leaveGameBtn.addEventListener('click', leaveGame);
  leaveBtnFromResult.addEventListener('click', leaveGame);
  
  // Initial UI
  lobbySection.classList.remove('hidden');
  gameSection.classList.add('hidden');
  resultScreen.classList.add('hidden');