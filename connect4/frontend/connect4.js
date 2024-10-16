let currentBoard = [];
let currentPlayer = 0; // 0 for Player 1, 1 for Player 2
let gameOver = false; // Track game state

// Function to toggle Player 1 options based on selected agent type
function togglePlayer1Options() {
  const player1Type = document.getElementById('player1-type').value;
  const negamaxOptions = document.getElementById('player1-negamax-options');
  if (player1Type === 'negamax') {
    negamaxOptions.classList.remove('hidden');
  } else {
    negamaxOptions.classList.add('hidden');
  }
}

// Function to toggle Player 2 options based on selected agent type
function togglePlayer2Options() {
  const player2Type = document.getElementById('player2-type').value;
  const negamaxOptions = document.getElementById('player2-negamax-options');
  if (player2Type === 'negamax') {
    negamaxOptions.classList.remove('hidden');
  } else {
    negamaxOptions.classList.add('hidden');
  }
}

async function startGame() {
  // Gather Player 1 Configuration
  const player1Type = document.getElementById('player1-type').value;
  let player1Config = { type: player1Type };
  if (player1Type === 'negamax') {
    const depth = parseInt(document.getElementById('player1-depth').value, 10);
    player1Config.depth = depth;
  }

  // Gather Player 2 Configuration
  const player2Type = document.getElementById('player2-type').value;
  let player2Config = { type: player2Type };
  if (player2Type === 'negamax') {
    const depth = parseInt(document.getElementById('player2-depth').value, 10);
    player2Config.depth = depth;
  }

  // Optional: Disable agent selections and Start button during game
  document.getElementById('player1-type').disabled = true;
  document.getElementById('player2-type').disabled = true;
  if (player1Type === 'negamax') {
    document.getElementById('player1-depth').disabled = true;
  }
  if (player2Type === 'negamax') {
    document.getElementById('player2-depth').disabled = true;
  }
  document.querySelector('button[onclick="startGame()"]').disabled = true;

  try {
    const response = await axios.post('http://127.0.0.1:5001/start_game', {
      player1: player1Config,
      player2: player2Config
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    currentBoard = response.data.board;
    currentPlayer = response.data.currentPlayer; // Capture currentPlayer
    gameOver = false;
    document.getElementById('message').innerText = '';
    document.getElementById('restart-button').style.display = 'none';
    updateBoard(currentBoard);

    // **New Logic Starts Here**
    // Handle initial bot move if Player 1 is a bot
    await handleBotTurns();
    // **New Logic Ends Here**
  } catch (error) {
    console.error(error);
    alert('Error starting the game: ' + (error.response?.data?.error || 'Unknown error.'));
    // Re-enable agent selections and Start button in case of error
    document.getElementById('player1-type').disabled = false;
    document.getElementById('player2-type').disabled = false;
    if (player1Type === 'negamax') {
      document.getElementById('player1-depth').disabled = false;
    }
    if (player2Type === 'negamax') {
      document.getElementById('player2-depth').disabled = false;
    }
    document.querySelector('button[onclick="startGame()"]').disabled = false;
  }
}

function updateBoard(board) {
  const gameBoard = document.getElementById('game-board');
  gameBoard.innerHTML = ''; // Clear existing board

  board.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const cellElement = document.createElement('div');
      cellElement.className = 'cell';
      
      // Disable cell clicks if game is over
      if (gameOver) {
        cellElement.classList.add('disabled');
      }

      const circleElement = document.createElement('div');
      circleElement.className = 'circle';
      if (cell === 'X') {
        circleElement.classList.add('x');
      } else if (cell === 'O') {
        circleElement.classList.add('o');
      } else {
        circleElement.classList.add('empty');
      }
      cellElement.appendChild(circleElement);
      
      // Assign click handler if game is not over and it's a human's turn
      if (!gameOver && isHumanPlayer(currentPlayer)) {
        cellElement.onclick = () => makeMove(colIndex);
      }

      gameBoard.appendChild(cellElement);
    });
  });
}

// Function to determine if the current player is human
function isHumanPlayer(player) {
  const playerConfig = getPlayerConfig(player);
  return playerConfig.type === 'human';
}

// Function to retrieve player configuration based on player number
function getPlayerConfig(player) {
  // Assuming player 0 is Player 1 and player 1 is Player 2
  const playerType = player === 0 ? document.getElementById('player1-type').value : document.getElementById('player2-type').value;
  let config = { type: playerType };
  if (playerType === 'negamax') {
    const depth = player === 0 ? parseInt(document.getElementById('player1-depth').value, 10) : parseInt(document.getElementById('player2-depth').value, 10);
    config.depth = depth;
  }
  return config;
}

async function makeMove(column) {
  if (gameOver) return; // Prevent moves if game is over

  try {
    const response = await axios.post('http://127.0.0.1:5001/make_move', { column }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    currentBoard = response.data.board;
    currentPlayer = response.data.currentPlayer; // Update currentPlayer
    updateBoard(currentBoard);

    if (response.data.winner) {
      gameOver = true;
      let message = '';
      if (response.data.winner.includes('Player')) {
        message = `${response.data.winner} wins!`;
      } else if (response.data.winner === 'Draw') {
        message = "It's a draw!";
      }

      // // Highlight winning sequence if available
      // if (response.data.winningSequence) {
      //   highlightWinningSequence(response.data.winningSequence);
      // }

      // Delay the alert to allow DOM to update
      setTimeout(() => {
        alert('Game Over: ' + message);
        document.getElementById('message').innerText = message;
        document.getElementById('restart-button').style.display = 'inline-block';
        // Re-enable agent selections and Start button
        enableAgentSelections();
      }, 100); // 100 milliseconds delay
      return;
    }

    // If it's AI's turn after player's move
    const currentPlayerAfterMove = response.data.currentPlayer;
    const checkWinner = response.data.checkWinner;
    if (!isHumanPlayer(currentPlayerAfterMove) && checkWinner === -1) {
      showLoading(); // Show loading before AI makes a move
      await botMove(currentPlayerAfterMove);
      hideLoading(); // Hide loading after AI move
    }
  } catch (error) {
    console.error(error);
    alert('Error making move: ' + (error.response?.data?.error || 'Invalid move.'));
  }
}

async function botMove(player) {
  try {
    // Send an empty JSON object to ensure Content-Type is 'application/json'
    const response = await axios.post('http://127.0.0.1:5001/make_move', {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    currentBoard = response.data.board;
    currentPlayer = response.data.currentPlayer; // Update currentPlayer
    updateBoard(currentBoard);

    if (response.data.winner) {
      gameOver = true;
      let message = '';
      if (response.data.winner.includes('Player')) {
        message = `${response.data.winner} wins!`;
      } else if (response.data.winner === 'Draw') {
        message = "It's a draw!";
      }

      // // Highlight winning sequence if available
      // if (response.data.winningSequence) {
      //   highlightWinningSequence(response.data.winningSequence);
      // }

      // Delay the alert to allow DOM to update
      setTimeout(() => {
        alert('Game Over: ' + message);
        document.getElementById('message').innerText = message;
        document.getElementById('restart-button').style.display = 'inline-block';
        // Re-enable agent selections and Start button
        enableAgentSelections();
      }, 100); // 100 milliseconds delay
      return;
    }

    // After bot move, check if next player is also a bot
    if (!isHumanPlayer(currentPlayer) && !gameOver) {
      showLoading();
      await botMove(currentPlayer);
      hideLoading();
    }
  } catch (error) {
    console.error(error);
    // Provide a more descriptive error message to the user
    alert('Error during AI move: ' + (error.response?.data?.error || 'Unknown error.'));
  }
}

// Recursive function to handle multiple bot moves
async function handleBotTurns() {
  while (!gameOver && !isHumanPlayer(currentPlayer)) {
    showLoading(); // Show loading indicator
    await botMove(currentPlayer);
    hideLoading(); // Hide loading indicator after move
  }
}

function restartGame() {
  startGame();
  document.getElementById('restart-button').style.display = 'none';
}

function enableAgentSelections() {
  document.getElementById('player1-type').disabled = false;
  document.getElementById('player2-type').disabled = false;
  const player1Type = document.getElementById('player1-type').value;
  const player2Type = document.getElementById('player2-type').value;
  if (player1Type === 'negamax') {
    document.getElementById('player1-depth').disabled = false;
  }
  if (player2Type === 'negamax') {
    document.getElementById('player2-depth').disabled = false;
  }
  document.querySelector('button[onclick="startGame()"]').disabled = false;
}

// Loading Indicator Functions
function showLoading() {
  document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

// Function to highlight the winning sequence
function highlightWinningSequence(sequence) {
  sequence.forEach(([row, col]) => {
    const cellIndex = row * 7 + col; // Assuming 7 columns
    const cellElement = document.getElementsByClassName('cell')[cellIndex];
    if (cellElement) {
      const circle = cellElement.querySelector('.circle');
      if (circle) {
        circle.style.boxShadow = '0 0 10px 5px green';
      }
    }
  });
}

// Initialize agent options based on default selections
togglePlayer1Options();
togglePlayer2Options();

// Optionally, start the game automatically on page load
// window.onload = startGame;