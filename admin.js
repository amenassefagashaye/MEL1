// websocket.js
import { showNotification, formatCurrency } from './utils.js';

let socket = null;
let connectionStatus = 'disconnected';
const reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

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

// WebSocket connection management
export function connectWebSocket(adminToken = null) {
    const IS_PRODUCTION = window.location.hostname !== 'localhost' && 
                         window.location.hostname !== '127.0.0.1';
    const WS_URL = IS_PRODUCTION 
        ? 'wss://ameng-gogs-mel3-94.deno.dev/ws'
        : 'ws://localhost:8000/ws';
    
    try {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.close();
        }

        console.log('Connecting to WebSocket:', WS_URL);
        socket = new WebSocket(WS_URL);

        socket.onopen = () => {
            console.log('WebSocket connected');
            connectionStatus = 'connected';
            updateConnectionStatus('connected');
            
            // Send admin authentication
            if (adminToken) {
                sendMessage({
                    type: 'hello',
                    playerId: 'admin_' + Date.now(),
                    isAdmin: true,
                    token: adminToken,
                    deviceInfo: {
                        userAgent: navigator.userAgent,
                        platform: navigator.platform
                    }
                });
            }
            
            // Start ping interval
            startPingInterval();
        };

        socket.onmessage = handleWebSocketMessage;
        socket.onclose = handleWebSocketClose;
        socket.onerror = handleWebSocketError;

        return true;
    } catch (error) {
        console.error('WebSocket connection failed:', error);
        showNotification('Failed to connect to server: ' + error.message, true);
        return false;
    }
}

function handleWebSocketMessage(event) {
    try {
        const message = JSON.parse(event.data);
        console.log('Received WebSocket message:', message);
        
        // Handle admin-specific messages
        if (message.type === 'welcome' && message.message && message.message.includes('Admin')) {
            showNotification('Admin connected successfully', false);
            return;
        }
        
        // Route message to appropriate handler
        switch (message.type) {
            case 'player_joined':
                handlePlayerJoined(message);
                break;
            case 'player_left':
                handlePlayerLeft(message);
                break;
            case 'player_disconnected':
                handlePlayerDisconnected(message);
                break;
            case 'player_paid':
                handlePlayerPaid(message);
                break;
            case 'player_won':
                handlePlayerWon(message);
                break;
            case 'withdrawal_request':
                handleWithdrawalRequest(message);
                break;
            case 'player_marked':
                handlePlayerMarked(message);
                break;
            case 'chat_message':
                handleChatMessage(message);
                break;
            case 'error':
                handleErrorMessage(message);
                break;
            case 'game_started':
                handleGameStarted(message);
                break;
            case 'number_called':
                handleNumberCalled(message);
                break;
            case 'win_announced':
                handleWinAnnounced(message);
                break;
            case 'stats':
                handleStatsUpdate(message);
                break;
            case 'players_list':
                handlePlayersList(message);
                break;
            default:
                console.log('Unhandled message type:', message.type);
        }
    } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        showNotification('Error processing server message', true);
    }
}

function handleWebSocketClose(event) {
    console.log('WebSocket disconnected:', event.code, event.reason);
    connectionStatus = 'disconnected';
    updateConnectionStatus('disconnected');
    
    if (event.code !== 1000) { // Not normal closure
        showNotification('Connection lost. Reconnecting...', true);
        attemptReconnect();
    }
}

function handleWebSocketError(error) {
    console.error('WebSocket error:', error);
    connectionStatus = 'error';
    updateConnectionStatus('error');
}

function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        showNotification('Failed to reconnect. Please refresh the page.', true);
        return;
    }
    
    setTimeout(() => {
        connectWebSocket();
    }, 3000);
}

function startPingInterval() {
    setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            sendMessage({
                type: 'ping',
                timestamp: Date.now()
            });
        }
    }, 30000);
}

function updateConnectionStatus(status) {
    connectionStatus = status;
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        let icon = '🔴';
        if (status === 'connected') icon = '🟢';
        else if (status === 'connecting') icon = '🟡';
        statusElement.textContent = `${icon} ${status}`;
    }
}

// Message handlers
function handlePlayerJoined(message) {
    const player = {
        id: message.playerId,
        name: message.name,
        phone: message.phone,
        stake: message.stake,
        gameType: message.gameType,
        joinedAt: new Date()
    };
    
    adminState.players.push(player);
    adminState.stats.totalPlayers = adminState.players.length;
    
    updatePlayerList();
    updateStatsDisplay();
    
    showNotification(`${message.name} joined the game`, false);
}

function handlePlayerLeft(message) {
    adminState.players = adminState.players.filter(p => p.id !== message.playerId);
    adminState.stats.totalPlayers = adminState.players.length;
    
    updatePlayerList();
    updateStatsDisplay();
    
    showNotification(`Player ${message.playerId} left the game`, false);
}

function handlePlayerDisconnected(message) {
    adminState.players = adminState.players.filter(p => p.id !== message.playerId);
    adminState.stats.totalPlayers = adminState.players.length;
    
    updatePlayerList();
    updateStatsDisplay();
    
    showNotification(`${message.name} disconnected`, true);
}

function handlePlayerPaid(message) {
    const player = adminState.players.find(p => p.id === message.playerId);
    if (player) {
        player.payment = player.payment || 0;
        player.payment += message.amount;
        player.balance = player.balance || 0;
        player.balance += message.amount;
        
        adminState.stats.totalPayments += message.amount;
    }
    
    updatePlayerList();
    updateStatsDisplay();
    
    showNotification(`${message.name} paid ${formatCurrency(message.amount)}`, false);
}

function handlePlayerWon(message) {
    const player = adminState.players.find(p => p.id === message.playerId);
    if (player) {
        player.wonAmount = player.wonAmount || 0;
        player.wonAmount += message.amount;
        player.balance = player.balance || 0;
        player.balance += message.amount;
        
        adminState.stats.totalWins += message.amount;
    }
    
    adminState.winners.push({
        playerId: message.playerId,
        name: message.name,
        pattern: message.pattern,
        amount: message.amount,
        timestamp: new Date()
    });
    
    updateWinnersList();
    updateStatsDisplay();
    
    showNotification(`${message.name} won ${formatCurrency(message.amount)} with ${message.pattern}`, false);
}

function handleWithdrawalRequest(message) {
    const player = adminState.players.find(p => p.id === message.playerId);
    if (player) {
        player.balance = player.balance || 0;
        player.balance -= message.amount;
        player.withdrawn = player.withdrawn || 0;
        player.withdrawn += message.amount;
        
        adminState.stats.totalWithdrawals += message.amount;
    }
    
    updatePlayerList();
    updateStatsDisplay();
    
    showNotification(`${message.name} withdrew ${formatCurrency(message.amount)}`, false);
}

function handlePlayerMarked(message) {
    // Could update UI to show player's marked numbers
    console.log('Player marked:', message);
}

function handleChatMessage(message) {
    // Display chat message in admin chat
    const chatContainer = document.getElementById('adminChatMessages');
    if (chatContainer) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.innerHTML = `
            <strong>${message.playerName}:</strong> ${message.text}
            <br><small>${new Date(message.timestamp).toLocaleTimeString()}</small>
        `;
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

function handleErrorMessage(message) {
    showNotification(message.message || 'An error occurred', true);
}

function handleGameStarted(message) {
    adminState.gameActive = true;
    adminState.calledNumbers = [];
    
    showNotification(`Game started in room ${message.roomId}`, false);
    
    // Update UI
    const gameStatusElement = document.getElementById('gameStatus');
    if (gameStatusElement) {
        gameStatusElement.textContent = 'Active';
        gameStatusElement.className = 'status-active';
    }
}

function handleNumberCalled(message) {
    adminState.calledNumbers.push(message.number);
    
    // Update called numbers display
    const calledNumbersElement = document.getElementById('calledNumbers');
    if (calledNumbersElement) {
        const numberSpan = document.createElement('span');
        numberSpan.className = 'called-number';
        numberSpan.textContent = message.number;
        calledNumbersElement.appendChild(numberSpan);
        
        // Keep only last 10 numbers
        if (calledNumbersElement.children.length > 10) {
            calledNumbersElement.removeChild(calledNumbersElement.firstChild);
        }
    }
    
    // Update current number display
    const currentNumberElement = document.getElementById('currentNumber');
    if (currentNumberElement) {
        currentNumberElement.textContent = message.number;
    }
}

function handleWinAnnounced(message) {
    showNotification(`${message.winnerName} won ${formatCurrency(message.amount)}!`, false);
}

function handleStatsUpdate(message) {
    if (message.stats) {
        adminState.stats = {
            ...adminState.stats,
            ...message.stats
        };
        updateStatsDisplay();
    }
}

function handlePlayersList(message) {
    if (message.players) {
        adminState.players = message.players;
        updatePlayerList();
    }
}

// UI Update functions
function updatePlayerList() {
    const playerListElement = document.getElementById('playerList');
    if (!playerListElement) return;
    
    playerListElement.innerHTML = '';
    
    adminState.players.forEach(player => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${player.id}</td>
            <td>${player.name || 'N/A'}</td>
            <td>${player.phone || 'N/A'}</td>
            <td>${formatCurrency(player.stake || 0)}</td>
            <td>${formatCurrency(player.payment || 0)}</td>
            <td>${formatCurrency(player.balance || 0)}</td>
            <td>${player.gameType || 'N/A'}</td>
            <td>
                <button onclick="adminKickPlayer('${player.id}')" class="btn-danger">Kick</button>
            </td>
        `;
        playerListElement.appendChild(row);
    });
}

function updateWinnersList() {
    const winnersListElement = document.getElementById('winnersList');
    if (!winnersListElement) return;
    
    winnersListElement.innerHTML = '';
    
    adminState.winners.slice(-10).reverse().forEach(winner => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${winner.name}</td>
            <td>${winner.pattern}</td>
            <td>${formatCurrency(winner.amount)}</td>
            <td>${new Date(winner.timestamp).toLocaleTimeString()}</td>
        `;
        winnersListElement.appendChild(row);
    });
}

function updateStatsDisplay() {
    const stats = adminState.stats;
    
    const elements = {
        'totalPlayers': stats.totalPlayers,
        'totalPayments': formatCurrency(stats.totalPayments),
        'totalWins': formatCurrency(stats.totalWins),
        'totalWithdrawals': formatCurrency(stats.totalWithdrawals),
        'activePlayers': adminState.players.filter(p => p.balance > 0).length,
        'totalGames': adminState.winners.length
    };
    
    Object.keys(elements).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = elements[id];
        }
    });
}

// Send message function
export function sendMessage(message) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.error('Cannot send message: WebSocket not connected');
        showNotification('Not connected to server', true);
        return false;
    }
    
    try {
        socket.send(JSON.stringify(message));
        console.log('Sent WebSocket message:', message.type);
        return true;
    } catch (error) {
        console.error('Error sending WebSocket message:', error);
        showNotification('Failed to send message', true);
        return false;
    }
}

// Admin functions
export function adminStartGame(roomId, gameType, stake) {
    if (!roomId) {
        roomId = adminState.roomId || `room_${Date.now()}`;
        adminState.roomId = roomId;
    }
    
    const success = sendMessage({
        type: 'start_game',
        roomId: roomId,
        gameType: gameType || '75ball',
        stake: stake || 25
    });
    
    if (success) {
        showNotification('Starting game...', false);
    }
}

export function adminCallNumber(roomId, number = null) {
    if (!roomId) {
        roomId = adminState.roomId;
        if (!roomId) {
            showNotification('No active room', true);
            return;
        }
    }
    
    if (!number) {
        // Generate random number based on game type
        const gameType = adminState.gameType || '75ball';
        let maxNumber = 75;
        if (gameType === '90ball') maxNumber = 90;
        else if (gameType === '30ball') maxNumber = 30;
        else if (gameType === '50ball') maxNumber = 50;
        
        // Generate number not already called
        let newNumber;
        do {
            newNumber = Math.floor(Math.random() * maxNumber) + 1;
        } while (adminState.calledNumbers.includes(newNumber));
        
        number = newNumber;
    }
    
    const success = sendMessage({
        type: 'number_called',
        roomId: roomId,
        number: number
    });
    
    if (success) {
        showNotification(`Called number: ${number}`, false);
    }
}

export function adminAnnounceWin(playerId, pattern, amount) {
    const player = adminState.players.find(p => p.id === playerId);
    if (!player) {
        showNotification('Player not found', true);
        return;
    }
    
    if (!pattern) {
        pattern = 'full-house';
    }
    
    if (!amount) {
        amount = player.stake * 10; // Default win amount
    }
    
    const success = sendMessage({
        type: 'admin_command',
        command: 'announce_win',
        data: {
            playerId: playerId,
            pattern: pattern,
            amount: amount
        }
    });
    
    if (success) {
        showNotification(`Announcing win for ${player.name}`, false);
    }
}

export function adminBroadcast(message, roomId = null) {
    const success = sendMessage({
        type: 'admin_command',
        command: 'broadcast',
        data: {
            message: message,
            roomId: roomId
        }
    });
    
    if (success) {
        showNotification('Broadcast sent', false);
    }
}

export function adminKickPlayer(playerId) {
    const player = adminState.players.find(p => p.id === playerId);
    if (!player) {
        showNotification('Player not found', true);
        return;
    }
    
    const success = sendMessage({
        type: 'admin_command',
        command: 'kick_player',
        data: {
            playerId: playerId
        }
    });
    
    if (success) {
        showNotification(`Kicked player: ${player.name}`, false);
        adminState.players = adminState.players.filter(p => p.id !== playerId);
        updatePlayerList();
    }
}

export function adminGetStats() {
    const success = sendMessage({
        type: 'admin_command',
        command: 'get_stats'
    });
    
    if (success) {
        showNotification('Fetching stats...', false);
    }
}

export function adminGetPlayers(roomId = null) {
    const success = sendMessage({
        type: 'admin_command',
        command: 'get_players',
        data: {
            roomId: roomId
        }
    });
    
    if (success) {
        showNotification('Fetching players...', false);
    }
}

export function adminSendChat(message) {
    const success = sendMessage({
        type: 'chat',
        playerId: 'admin',
        roomId: adminState.roomId,
        text: message
    });
    
    if (success) {
        // Add to local chat
        const chatContainer = document.getElementById('adminChatMessages');
        if (chatContainer) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message admin-message';
            messageDiv.innerHTML = `
                <strong>Admin:</strong> ${message}
                <br><small>${new Date().toLocaleTimeString()}</small>
            `;
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }
}

// Initialize admin interface
export function initAdmin(adminToken = null) {
    // Check if already admin
    if (window.gameState && window.gameState.isAdmin) {
        console.log('Already authenticated as admin');
    }
    
    // Connect WebSocket
    connectWebSocket(adminToken);
    
    // Setup admin event listeners
    setupAdminEventListeners();
    
    // Load initial stats
    adminGetStats();
    
    // Update UI every 5 seconds
    setInterval(() => {
        updateStatsDisplay();
        if (adminState.roomId) {
            adminGetPlayers(adminState.roomId);
        }
    }, 5000);
    
    showNotification('Admin interface initialized', false);
}

// Setup admin event listeners
function setupAdminEventListeners() {
    // Start game button
    const startGameBtn = document.getElementById('startGameBtn');
    if (startGameBtn) {
        startGameBtn.addEventListener('click', () => {
            const gameType = document.getElementById('gameTypeSelect')?.value || '75ball';
            const stake = document.getElementById('stakeSelect')?.value || 25;
            adminStartGame(null, gameType, stake);
        });
    }
    
    // Call number button
    const callNumberBtn = document.getElementById('callNumberBtn');
    if (callNumberBtn) {
        callNumberBtn.addEventListener('click', () => {
            adminCallNumber();
        });
    }
    
    // Broadcast button
    const broadcastBtn = document.getElementById('broadcastBtn');
    if (broadcastBtn) {
        broadcastBtn.addEventListener('click', () => {
            const message = document.getElementById('broadcastMessage')?.value;
            if (message) {
                adminBroadcast(message);
                document.getElementById('broadcastMessage').value = '';
            }
        });
    }
    
    // Refresh stats button
    const refreshStatsBtn = document.getElementById('refreshStatsBtn');
    if (refreshStatsBtn) {
        refreshStatsBtn.addEventListener('click', () => {
            adminGetStats();
        });
    }
    
    // Chat input
    const chatInput = document.getElementById('adminChatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const message = chatInput.value.trim();
                if (message) {
                    adminSendChat(message);
                    chatInput.value = '';
                }
            }
        });
    }
    
    // Send chat button
    const sendChatBtn = document.getElementById('sendChatBtn');
    if (sendChatBtn) {
        sendChatBtn.addEventListener('click', () => {
            const message = chatInput?.value.trim();
            if (message) {
                adminSendChat(message);
                chatInput.value = '';
            }
        });
    }
    
    // Room selection
    const roomSelect = document.getElementById('roomSelect');
    if (roomSelect) {
        roomSelect.addEventListener('change', (e) => {
            adminState.roomId = e.target.value;
            if (adminState.roomId) {
                adminGetPlayers(adminState.roomId);
            }
        });
    }
    
    // Export window functions
    window.adminStartGame = adminStartGame;
    window.adminCallNumber = adminCallNumber;
    window.adminBroadcast = adminBroadcast;
    window.adminKickPlayer = adminKickPlayer;
    window.adminGetStats = adminGetStats;
    window.adminGetPlayers = adminGetPlayers;
    window.adminAnnounceWin = adminAnnounceWin;
    window.resetGame = resetGame;
}

// Reset game function
export function resetGame() {
    adminState.calledNumbers = [];
    adminState.winners = [];
    adminState.gameActive = false;
    
    // Update UI
    const calledNumbersElement = document.getElementById('calledNumbers');
    if (calledNumbersElement) {
        calledNumbersElement.innerHTML = '';
    }
    
    const currentNumberElement = document.getElementById('currentNumber');
    if (currentNumberElement) {
        currentNumberElement.textContent = '--';
    }
    
    const gameStatusElement = document.getElementById('gameStatus');
    if (gameStatusElement) {
        gameStatusElement.textContent = 'Inactive';
        gameStatusElement.className = 'status-inactive';
    }
    
    showNotification('Game reset', false);
}

// Export connection status
export { connectionStatus };
