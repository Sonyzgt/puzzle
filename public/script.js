document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('game-board');
    const modal = document.getElementById('win-modal');
    const finalMoves = document.getElementById('final-moves');
    const countdownEl = document.getElementById('countdown');
    const claimBtn = document.getElementById('claim-btn');
    const playerNameInput = document.getElementById('player-name');
    const winnerNotif = document.getElementById('winner-notif');
    const startBtn = document.getElementById('start-btn');
    const welcomeScreen = document.getElementById('welcome-screen');
    const gameBoardContainer = document.querySelector('.game-board-container');
    const gameInfo = document.querySelector('.game-info');
    const hintBtn = document.getElementById('hint-btn');
    const hintModal = document.getElementById('hint-modal');
    const closeHintBtn = document.getElementById('close-hint-btn');
    const gameClosedOverlay = document.getElementById('game-closed-overlay');
    const movesLabel = document.getElementById('moves-label');
    const SIZE = 4; // Change to 4x4 <!-- id: size_update -->
    let lastSeenWinnerAt = null;
    let initialWinnerLoaded = false;
    let notifTimeout = null;
    let tiles = [];
    let moves = 0;
    let timer = null;
    let seconds = 0;
    let isPlaying = false;

    // Link target reward
    const REWARD_LINK = '/reward';

    // Parallax & 3D Tilt Effect
    const boardContainer = document.querySelector('.game-board-container');
    document.addEventListener('mousemove', (e) => {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;

        // Move background
        document.body.style.backgroundPosition = `${x * 100}% ${y * 100}%`;

        // Tilt the game board slightly
        if (boardContainer) {
            const tiltX = (0.5 - y) * 15; // Max tilt 15 degrees
            const tiltY = (x - 0.5) * 15;
            boardContainer.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
        }
    });

    let audioCtx;
    function playClickSound() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        // A satisfying "thock" / click sound
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.04);

        gain.gain.setValueAtTime(0.8, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.04);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.04);
    }

    function playWinSound() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const now = audioCtx.currentTime;
        // Triumphant 8-bit major chord: A4, C#5, E5, A5
        const notes = [440, 554.37, 659.25, 880];

        notes.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, now + i * 0.1);

            gain.gain.setValueAtTime(0, now + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.3, now + i * 0.1 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.4);

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.4);
        });
    }

    function initGame() {
        tiles = Array.from({ length: SIZE * SIZE }, (_, i) => i === SIZE * SIZE - 1 ? 0 : i + 1);
        shuffle(tiles);

        // Ensure it's solvable
        while (!isSolvable(tiles)) {
            shuffle(tiles);
        }

        moves = 0;
        seconds = 0;
        isPlaying = false;
        clearInterval(timer);
        updateStats();
        renderBoard();
        modal.classList.add('hidden');
    }

    function renderBoard() {
        board.innerHTML = '';
        tiles.forEach((val, index) => {
            const tile = document.createElement('div');
            if (val === 0) {
                tile.className = 'tile empty';
            } else {
                tile.className = 'tile';
                tile.textContent = val;
                tile.dataset.value = val;
                
                // Adjust background for 4x4
                tile.style.backgroundSize = `${SIZE * 100}% ${SIZE * 100}%`;
                const targetPos = val - 1;
                const row = Math.floor(targetPos / SIZE);
                const col = targetPos % SIZE;
                
                // More precise calculation for background position
                const posX = (col / (SIZE - 1)) * 100;
                const posY = (row / (SIZE - 1)) * 100;
                tile.style.backgroundPosition = `${posX}% ${posY}%`;

                tile.addEventListener('click', () => moveTile(index));
            }
            board.appendChild(tile);
        });
    }

    function moveTile(index) {
        if (!isPlaying) {
            isPlaying = true;
            timer = setInterval(() => {
                seconds++;
                updateStats();
            }, 1000);
        }

        const emptyIndex = tiles.indexOf(0);

        // Check if clicked tile is adjacent to empty tile
        const isAdjacent =
            (index === emptyIndex - 1 && emptyIndex % SIZE !== 0) || // Left
            (index === emptyIndex + 1 && index % SIZE !== 0) || // Right
            (index === emptyIndex - SIZE) || // Top
            (index === emptyIndex + SIZE);   // Bottom

        if (isAdjacent) {
            playClickSound(); // Trigger sound effect

            // Swap
            [tiles[index], tiles[emptyIndex]] = [tiles[emptyIndex], tiles[index]];
            moves++;
            updateStats();
            
            renderBoard();
            checkWin();
        }
    }

    function checkWin() {
        const isWin = tiles.every((val, index) => {
            if (index === SIZE * SIZE - 1) return val === 0;
            return val === index + 1;
        });

        if (isWin) {
            clearInterval(timer);
            isPlaying = false;
            showWinModal();
        }
    }

    function showWinModal() {
        playWinSound();
        finalMoves.textContent = moves;
        modal.classList.remove('hidden');

        sendWinner();

        let timeLeft = 3;
        countdownEl.textContent = timeLeft;

        const countdownTimer = setInterval(() => {
            timeLeft--;
            countdownEl.textContent = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(countdownTimer);
                openReward();
            }
        }, 1000);

        claimBtn.onclick = () => {
            clearInterval(countdownTimer);
            openReward();
        };
    }

    function openReward() {
        window.location.href = REWARD_LINK;
    }

    function showWinnerNotification(message) {
        if (!winnerNotif) return;

        winnerNotif.textContent = message;
        winnerNotif.classList.remove('hidden');

        if (notifTimeout) {
            clearTimeout(notifTimeout);
        }

        notifTimeout = setTimeout(() => {
            if (winnerNotif) winnerNotif.classList.add('hidden');
        }, 4000);
    }

    async function loadWinners() {
        try {
            const res = await fetch('/api/winners');
            const data = await res.json();
            if (!data.success || !Array.isArray(data.winners)) return;

            if (data.winners.length === 0) {
                if (!initialWinnerLoaded) {
                    initialWinnerLoaded = true;
                    lastSeenWinnerAt = null;
                }
                return;
            }

            const latest = data.winners[0];

            if (!initialWinnerLoaded) {
                initialWinnerLoaded = true;
                lastSeenWinnerAt = latest.finishedAt;
                return;
            }

            if (!lastSeenWinnerAt || new Date(latest.finishedAt) > new Date(lastSeenWinnerAt)) {
                lastSeenWinnerAt = latest.finishedAt;
                showWinnerNotification(`${latest.name} memenangkan puzzle nya`);
            }
        } catch (err) {
            console.error('Gagal memuat pemenang terbaru:', err);
        }
    }

    async function sendWinner() {
        const name = playerNameInput.value.trim() || 'Pemain Tanpa Nama';
        const payload = { name, moves, time: seconds };

        // Tampilkan notif lokal segera
        showWinnerNotification(`${name} memenangkan puzzle nya`);

        try {
            const res = await fetch('/api/winners', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                await loadWinners();
            }
        } catch (err) {
            console.error('Gagal kirim data pemenang:', err);
        }
    }

    function updateStats() {
        if (movesLabel) {
            movesLabel.textContent = `Langkah: ${moves}`;
        }
        sendStatus(); // CCTV: Report status on every move
    }

    // CCTV: Periodically report status
    async function sendStatus() {
        if (!isPlaying) return;
        const name = playerNameInput.value.trim() || 'Pemain Tanpa Nama';
        const payload = { name, tiles, moves };

        try {
            await fetch('/api/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (err) {
            // Silently ignore status update errors
        }
    }

    setInterval(sendStatus, 1000); // CCTV: Report status every 1 second now!


    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function isSolvable(puzzle) {
        let inversions = 0;
        const flatPuzzle = puzzle.filter(val => val !== 0);

        for (let i = 0; i < flatPuzzle.length; i++) {
            for (let j = i + 1; j < flatPuzzle.length; j++) {
                if (flatPuzzle[i] > flatPuzzle[j]) {
                    inversions++;
                }
            }
        }

        const emptyIndex = puzzle.indexOf(0);
        const emptyRowFromBottom = SIZE - Math.floor(emptyIndex / SIZE);

        return (inversions % 2 === 0)
            ? emptyRowFromBottom % 2 !== 0
            : emptyRowFromBottom % 2 === 0;
    }

    async function checkGameStatus() {
        try {
            const res = await fetch('/api/config');
            const data = await res.json();
            if (!data.gameEnabled) {
                if (gameClosedOverlay) gameClosedOverlay.classList.remove('hidden');
                return false;
            } else {
                if (gameClosedOverlay) gameClosedOverlay.classList.add('hidden');
                return true;
            }
        } catch (err) {
            return true; // Assume ON if error
        }
    }

    startBtn.addEventListener('click', async () => {
        const isEnabled = await checkGameStatus();
        if (!isEnabled) return;

        const name = playerNameInput.value.trim();
        if (!name) {
            alert('Silakan masukkan nama Anda terlebih dahulu!');
            return;
        }
        welcomeScreen.style.display = 'none';
        gameBoardContainer.style.display = '';
        if (gameInfo) gameInfo.style.display = 'flex';
        initGame();
    });

    // Hint Logic
    if (hintBtn) {
        hintBtn.addEventListener('click', () => {
            if (hintModal) hintModal.classList.remove('hidden');
        });
    }

    if (closeHintBtn) {
        closeHintBtn.addEventListener('click', () => {
            if (hintModal) hintModal.classList.add('hidden');
        });
    }

    // resetBtn removed

    checkGameStatus();
    setInterval(checkGameStatus, 10000); // Check every 10s

    setInterval(loadWinners, 15000);
    loadWinners();
});
