import { sendMessage, connectionStatus } from './websocket.js';
import { sendRTCMessage, sendNumberCall, sendWinnerAnnouncement } from './rtc.js';
import { showNotification, formatCurrency } from './utils.js';

// Admin state
const adminState = {
    roomId: null,
    players: [],
    gameActive: false,
    calledNumbers: [],
    winners: [],
    stats: {
        totalPlayers: 0,
        totalPayments: 0,
        totalWins: 0,
        totalWithdrawals: 0
    }
};

// Initialize admin interface
export function initAdmin() {
    if (!window.gameState.isAdmin) {
        console.error('Not authorized as admin');
        return;
    }
    
    setupAdminEventListeners();
    loadAdminStats();
    setupAdminWebSocket();
}

// Setup admin event listeners
function setupAdminEventListeners() {
    // Start game button
    const startGameBtn = document.getElementById('startGameBtn');
    if (startGameBtn) {
        startGameBtn.addEventListener('click', startGameSession);
    }
    
    // Call number button
    const callNumberBtn = document.getElementById('callNumberBtn');
    if (callNumberBtn) {
        callNumberBtn.addEventListener('click', callNumberManually);
    }
    
    // End game button
    const endGameBtn = document.getElementById('endGameBtn');
    if (endGameBtn) {
        endGameBtn.addEventListener('click', endGameSession);
    }
    
    // Broadcast message button
    const broadcastBtn = document.getElementById('broadcastBtn');
    if (broadcastBtn) {
        broadcastBtn.addEventListener('click', broadcastMessage);
    }
    
    // Refresh players button
    const refreshBtn = document.getElementById('refreshPlayersBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshPlayersList);
    }
    
    // Export data button
    const exportBtn = document.getElementById('exportDataBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportGameData);
    }
    
    // Reset game button
    const resetBtn = document.getElementById('resetGameBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetGame);
    }
}

// Setup admin WebSocket handlers
function setupAdminWebSocket() {
    // Override or extend WebSocket handlers for admin
    window.adminMessageHandlers = {
        player_joined: handleAdminPlayerJoined,
        player_left: handleAdminPlayerLeft,
        player_paid: handleAdminPlayerPaid,
        player_won: handleAdminPlayerWon,
        game_request: handleGameRequest
    };
}

// Load admin statistics
function loadAdminStats() {
    // Load from localStorage or server
    const savedStats = localStorage.getItem('admin_stats');
    if (savedStats) {
        adminState.stats = JSON.parse(savedStats);
        updateAdminStatsUI();
    }
    
    // Request current stats from server
    sendMessage({
        type: 'get_stats',
        isAdmin: true
    });
}

// Update admin statistics UI
function updateAdminStatsUI() {
    document.getElementById('totalPlayers').textContent = adminState.stats.totalPlayers;
    document.getElementById('totalPayments').textContent = formatCurrency(adminState.stats.totalPayments);
    document.getElementById('totalWins').textContent = formatCurrency(adminState.stats.totalWins);
    document.getElementById('totalWithdrawals').textContent = formatCurrency(adminState.stats.totalWithdrawals);
}

// Start game session
export function startGameSession() {
    if (adminState.gameActive) {
        showNotification('ጨዋታ አሁንም በሂደት ላይ ነው', true);
        return;
    }
    
    const gameType = prompt('የጨዋታ አይነት ይምረጡ (75ball, 90ball, 30ball, 50ball, pattern, coverall):', '75ball');
    if (!gameType) return;
    
    const stake = prompt('ውርርድ መጠን (ብር):', '25');
    if (!stake) return;
    
    adminState.gameActive = true;
    adminState.calledNumbers = [];
    adminState.winners = [];
    
    // Create room
    adminState.roomId = generateRoomId();
    
    // Send start game message to all players
    sendMessage({
        type: 'game_start',
        roomId: adminState.roomId,
        gameType: gameType,
        stake: parseInt(stake),
        timestamp: Date.now()
    });
    
    // Start WebRTC call
    if (window.FEATURE_FLAGS?.ENABLE_WEBRTC) {
        window.initRTC({ role: 'admin', roomId: adminState.roomId });
        window.startCall();
    }
    
    showNotification('ጨዋታ ተጀምሯል!', false);
    updateGameStatusUI();
}

// Generate room ID
function generateRoomId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `ROOM_${timestamp}_${random}`.toUpperCase();
}

// Call number manually
export function callNumberManually() {
    if (!adminState.gameActive) {
        showNotification('መጀመሪያ ጨዋታን ይጀምሩ', true);
        return;
    }
    
    let number;
    
    if (window.gameState.gameType === '75ball' || 
        window.gameState.gameType === '50ball' || 
        window.gameState.gameType === 'pattern') {
        
        const letter = prompt('የBINGO ፊደል (B, I, N, G, O):', 'B').toUpperCase();
        if (!'BINGO'.includes(letter)) {
            showNotification('ትክክለኛ ፊደል ያስገቡ', true);
            return;
        }
        
        const num = prompt(`ቁጥር (1-${letter === 'B' ? '15' : letter === 'I' ? '30' : letter === 'N' ? '45' : letter === 'G' ? '60' : '75'}):`, '1');
        number = `${letter}-${num}`;
        
    } else {
        const maxNumber = window.gameState.gameType === '90ball' ? 90 : 
                         window.gameState.gameType === '30ball' ? 30 : 50;
        
        number = prompt(`ቁጥር (1-${maxNumber}):`, '1');
    }
    
    if (!number) return;
    
    // Add to called numbers
    adminState.calledNumbers.push(number);
    
    // Send to all players via WebSocket
    sendMessage({
        type: 'number_called',
        number: number,
        roomId: adminState.roomId,
        timestamp: Date.now()
    });
    
    // Send via WebRTC if enabled
    if (window.isRTCConnected && window.FEATURE_FLAGS?.ENABLE_WEBRTC) {
        window.sendNumberCall(number);
    }
    
    // Update UI
    updateCalledNumbersUI();
    updateCurrentNumberUI(number);
    
    showNotification(`ቁጥር ተጠርቷል: ${number}`, false);
}

// End game session
export function endGameSession() {
    if (!adminState.gameActive) {
        showNotification('ምንም ጨዋታ አልተጀመረም', true);
        return;
    }
    
    if (confirm('ጨዋታን ለማቆም እርግጠኛ ነዎት?')) {
        adminState.gameActive = false;
        
        // Send game end message
        sendMessage({
            type: 'game_end',
            roomId: adminState.roomId,
            timestamp: Date.now()
        });
        
        // Stop WebRTC
        if (window.isRTCConnected) {
            window.stopCall();
        }
        
        // Calculate and distribute winnings
        calculateWinnings();
        
        showNotification('ጨዋታ አልቋል!', false);
        updateGameStatusUI();
    }
}

// Broadcast message to all players
export function broadcastMessage() {
    const message = prompt('ለሁሉም ተጫዋቾች መልእክት ይጻፉ:');
    if (!message) return;
    
    sendMessage({
        type: 'admin_broadcast',
        message: message,
        roomId: adminState.roomId,
        timestamp: Date.now()
    });
    
    showNotification('መልእክት ተልኳል!', false);
}

// Refresh players list
export function refreshPlayersList() {
    sendMessage({
        type: 'get_players',
        roomId: adminState.roomId
    });
}

// Export game data
export function exportGameData() {
    const data = {
        roomId: adminState.roomId,
        gameType: window.gameState.gameType,
        players: adminState.players,
        calledNumbers: adminState.calledNumbers,
        winners: adminState.winners,
        stats: adminState.stats,
        timestamp: Date.now()
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    // Create download link
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(dataBlob);
    downloadLink.download = `bingo_game_${adminState.roomId}_${Date.now()}.json`;
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    showNotification('ውሂብ ተላልፏል!', false);
}

// Reset game
export function resetGame() {
    if (confirm('ሁሉንም የጨዋታ ውሂብ ለማጥፋት እርግጠኛ ነዎት?')) {
        adminState.roomId = null;
        adminState.players = [];
        adminState.gameActive = false;
        adminState.calledNumbers = [];
        adminState.winners = [];
        
        // Clear localStorage
        localStorage.removeItem('admin_stats');
        localStorage.removeItem('admin_room');
        
        updateAdminStatsUI();
        updatePlayersListUI();
        updateCalledNumbersUI();
        
        showNotification('ጨዋታ ተመልሶ ተዘጋጅቷል!', false);
    }
}

// Calculate winnings
function calculateWinnings() {
    // Calculate winnings based on winners and stakes
    const totalStake = adminState.players.reduce((sum, player) => sum + player.stake, 0);
    const serviceCharge = totalStake * 0.03;
    const prizePool = totalStake - serviceCharge;
    
    // Distribute to winners
    adminState.winners.forEach(winner => {
        const winAmount = Math.floor(prizePool * (winner.stake / totalStake));
        winner.amount = winAmount;
        
        // Send win announcement
        sendMessage({
            type: 'player_won',
            playerId: winner.id,
            amount: winAmount,
            pattern: winner.pattern,
            timestamp: Date.now()
        });
        
        // Send via WebRTC
        if (window.isRTCConnected && window.FEATURE_FLAGS?.ENABLE_WEBRTC) {
            window.sendWinnerAnnouncement(winner.name, winAmount, winner.pattern);
        }
    });
    
    // Update stats
    adminState.stats.totalWins += adminState.winners.reduce((sum, winner) => sum + winner.amount, 0);
    adminState.stats.totalPayments += totalStake;
    
    // Save stats
    localStorage.setItem('admin_stats', JSON.stringify(adminState.stats));
    updateAdminStatsUI();
}

// Update game status UI
function updateGameStatusUI() {
    const statusElement = document.getElementById('gameStatus');
    if (statusElement) {
        statusElement.textContent = adminState.gameActive ? 'በሂደት ላይ' : 'የተጠናቀቀ';
        statusElement.className = adminState.gameActive ? 'status-active' : 'status-ended';
    }
}

// Update called numbers UI
function updateCalledNumbersUI() {
    const numbersElement = document.getElementById('calledNumbersList');
    if (numbersElement) {
        numbersElement.innerHTML = adminState.calledNumbers
            .map(num => `<span class="called-number-item">${num}</span>`)
            .join('');
    }
}

// Update current number UI
function updateCurrentNumberUI(number) {
    const currentNumberElement = document.getElementById('currentNumber');
    if (currentNumberElement) {
        currentNumberElement.textContent = number;
    }
}

// Update players list UI
function updatePlayersListUI() {
    const playersList = document.getElementById('playersList');
    if (playersList) {
        playersList.innerHTML = adminState.players
            .map(player => `
                <div class="player-item">
                    <span class="player-name">${player.name}</span>
                    <span class="player-phone">${player.phone}</span>
                    <span class="player-stake">${formatCurrency(player.stake)}</span>
                    <span class="player-status ${player.paid ? 'paid' : 'unpaid'}">
                        ${player.paid ? '✓' : '✗'}
                    </span>
                </div>
            `)
            .join('');
    }
}

// Admin WebSocket handlers

function handleAdminPlayerJoined(data) {
    const player = {
        id: data.playerId,
        name: data.name,
        phone: data.phone,
        stake: data.stake,
        paid: data.paid || false,
        joinedAt: Date.now()
    };
    
    adminState.players.push(player);
    adminState.stats.totalPlayers = adminState.players.length;
    
    updatePlayersListUI();
    updateAdminStatsUI();
}

function handleAdminPlayerLeft(data) {
    adminState.players = adminState.players.filter(player => player.id !== data.playerId);
    adminState.stats.totalPlayers = adminState.players.length;
    
    updatePlayersListUI();
    updateAdminStatsUI();
}

function handleAdminPlayerPaid(data) {
    const player = adminState.players.find(p => p.id === data.playerId);
    if (player) {
        player.paid = true;
        player.paymentAmount = data.amount;
        
        adminState.stats.totalPayments += data.amount;
        
        updatePlayersListUI();
        updateAdminStatsUI();
    }
}

function handleAdminPlayerWon(data) {
    const player = adminState.players.find(p => p.id === data.playerId);
    if (player) {
        player.won = true;
        player.winAmount = data.amount;
        player.winPattern = data.pattern;
        
        adminState.winners.push({
            id: player.id,
            name: player.name,
            amount: data.amount,
            pattern: data.pattern
        });
        
        updateWinnersListUI();
    }
}

function handleGameRequest(data) {
    // Handle game requests from players
    switch (data.request) {
        case 'join_game':
            handleJoinRequest(data);
            break;
        case 'mark_number':
            handleMarkNumber(data);
            break;
        case 'announce_win':
            handleWinAnnouncement(data);
            break;
        case 'withdraw_request':
            handleWithdrawRequest(data);
            break;
    }
}

function handleJoinRequest(data) {
    // Approve or reject join request
    const approve = confirm(`ተጫዋች ${data.name} (${data.phone}) ለመግባት ይፈልጋል። ይፈቀዱ?`);
    
    sendMessage({
        type: 'join_response',
        playerId: data.playerId,
        approved: approve,
        roomId: adminState.roomId
    });
}

function handleMarkNumber(data) {
    // Track player's marked numbers
    const player = adminState.players.find(p => p.id === data.playerId);
    if (player) {
        if (!player.markedNumbers) {
            player.markedNumbers = new Set();
        }
        
        if (data.marked) {
            player.markedNumbers.add(data.number);
        } else {
            player.markedNumbers.delete(data.number);
        }
    }
}

function handleWinAnnouncement(data) {
    // Verify win and approve
    const player = adminState.players.find(p => p.id === data.playerId);
    if (player) {
        const verifyWin = confirm(`ተጫዋች ${player.name} አሸንፏል ይላል። ስርዓቱስ እንደሚገልጸው ${data.pattern} አሸንፏል። ያረጋግጡ እና ይፈቅዱ?`);
        
        sendMessage({
            type: 'win_verification',
            playerId: data.playerId,
            verified: verifyWin,
            pattern: data.pattern,
            amount: data.amount
        });
        
        if (verifyWin) {
            handleAdminPlayerWon({
                playerId: data.playerId,
                amount: data.amount,
                pattern: data.pattern
            });
        }
    }
}

function handleWithdrawRequest(data) {
    // Process withdrawal request
    const player = adminState.players.find(p => p.id === data.playerId);
    if (player) {
        const approve = confirm(`ተጫዋች ${player.name} ${formatCurrency(data.amount)} ማውጣት ይፈልጋል። ሂሳብ: ${data.accountNumber}። ይፈቀዱ?`);
        
        sendMessage({
            type: 'withdraw_response',
            playerId: data.playerId,
            approved: approve,
            amount: data.amount,
            accountNumber: data.accountNumber
        });
        
        if (approve) {
            adminState.stats.totalWithdrawals += data.amount;
            updateAdminStatsUI();
        }
    }
}

// Update winners list UI
function updateWinnersListUI() {
    const winnersList = document.getElementById('winnersList');
    if (winnersList) {
        winnersList.innerHTML = adminState.winners
            .map(winner => `
                <div class="winner-item">
                    <span class="winner-name">${winner.name}</span>
                    <span class="winner-pattern">${winner.pattern}</span>
                    <span class="winner-amount">${formatCurrency(winner.amount)}</span>
                </div>
            `)
            .join('');
    }
}

// Export admin functions to window
window.startGameSession = startGameSession;
window.callNumberManually = callNumberManually;
window.endGameSession = endGameSession;
window.broadcastMessage = broadcastMessage;
window.refreshPlayersList = refreshPlayersList;
window.exportGameData = exportGameData;
window.resetGame = resetGame;