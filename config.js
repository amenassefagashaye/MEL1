// websocket.js - Complete WebSocket communication module
import { GAME_CONFIG, API_BASE_URL, API_BACKUP_URLS } from './config.js';

// WebSocket URL configuration - UPDATED to use provided backend
const WS_URL = "wss://ameng-gogs-mel3-66.deno.dev/";
const WS_BACKUP_URLS = [
    "wss://ameng-gogs-mel3-66.deno.dev/",
    // Add fallback URLs here if needed, but using same URL for primary and backup
    // "wss://backup1.example.com/",
    // "wss://backup2.example.com/"
];

// Connection state
let socket = null;
let connectionStatus = 'disconnected';
let reconnectAttempts = 0;
let currentWSIndex = 0;
let pingInterval = null;
const MAX_RECONNECT_ATTEMPTS = 5;
const PING_INTERVAL = 30000; // 30 seconds

// Message queue for when connection is down
const messageQueue = [];

// Event listeners
const eventListeners = {
    onopen: [],
    onclose: [],
    onerror: [],
    onmessage: []
};

// Game state
const gameState = {
    playerId: null,
    playerName: '',
    playerPhone: '',
    gameType: null,
    stake: 25,
    payment: 0,
    balance: 0,
    roomId: null,
    isAdmin: false,
    gameActive: false,
    markedNumbers: new Set(),
    calledNumbers: [],
    playersInRoom: [],
    currentPattern: null,
    isConnected: false
};

// ===== CONNECTION MANAGEMENT =====

export function connectWebSocket(options = {}) {
    const {
        isAdmin = false,
        adminToken = null,
        playerId = null
    } = options;

    // Close existing connection
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }

    // Select WebSocket URL (try backup if primary fails)
    const wsUrl = getCurrentWebSocketURL();
    
    try {
        console.log('Connecting to WebSocket:', wsUrl);
        updateConnectionStatus('connecting', 'Connecting to server...');
        
        socket = new WebSocket(wsUrl);

        socket.onopen = (event) => {
            console.log('WebSocket connected successfully');
            connectionStatus = 'connected';
            reconnectAttempts = 0;
            gameState.isConnected = true;
            
            updateConnectionStatus('connected', 'Connected');
            triggerEvent('onopen', event);
            
            // Start ping interval
            startPingInterval();
            
            // Send hello/authentication message
            sendHelloMessage(isAdmin, adminToken, playerId);
            
            // Process any queued messages
            processMessageQueue();
        };

        socket.onmessage = (event) => {
            handleWebSocketMessage(event);
            triggerEvent('onmessage', event);
        };

        socket.onclose = (event) => {
            console.log('WebSocket closed:', event.code, event.reason);
            connectionStatus = 'disconnected';
            gameState.isConnected = false;
            
            updateConnectionStatus('disconnected', 'Disconnected');
            triggerEvent('onclose', event);
            
            // Stop ping interval
            stopPingInterval();
            
            // Attempt reconnect if not normal closure
            if (event.code !== 1000 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                attemptReconnect();
            }
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            connectionStatus = 'error';
            
            updateConnectionStatus('error', 'Connection error');
            triggerEvent('onerror', error);
            
            // Try backup URL on error
            if (currentWSIndex < WS_BACKUP_URLS.length - 1) {
                currentWSIndex++;
                setTimeout(() => connectWebSocket(options), 2000);
            }
        };

        return true;
    } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        updateConnectionStatus('error', 'Connection failed');
        
        // Try backup URL on exception
        if (currentWSIndex < WS_BACKUP_URLS.length - 1) {
            currentWSIndex++;
            setTimeout(() => connectWebSocket(options), 2000);
        }
        
        return false;
    }
}

function getCurrentWebSocketURL() {
    return WS_BACKUP_URLS[currentWSIndex] || WS_URL;
}

function sendHelloMessage(isAdmin, adminToken, playerId) {
    const message = {
        type: 'hello',
        playerId: playerId || generatePlayerId(),
        isAdmin: isAdmin,
        deviceInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screen: {
                width: window.screen.width,
                height: window.screen.height
            }
        }
    };

    if (isAdmin && adminToken) {
        message.token = adminToken;
    }

    sendMessage(message);
}

function generatePlayerId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `player_${timestamp}_${random}`;
}

// ===== MESSAGE HANDLING =====

function handleWebSocketMessage(event) {
    try {
        const message = JSON.parse(event.data);
        console.log('Received:', message.type, message);
        
        // Route message to appropriate handler
        switch (message.type) {
            case 'welcome':
                handleWelcome(message);
                break;
            case 'error':
                handleError(message);
                break;
            case 'registration_success':
                handleRegistrationSuccess(message);
                break;
            case 'room_joined':
                handleRoomJoined(message);
                break;
            case 'room_left':
                handleRoomLeft(message);
                break;
            case 'game_started':
                handleGameStarted(message);
                break;
            case 'player_joined':
                handlePlayerJoined(message);
                break;
            case 'player_left':
                handlePlayerLeft(message);
                break;
            case 'number_called':
                handleNumberCalled(message);
                break;
            case 'chat_message':
                handleChatMessage(message);
                break;
            case 'win_announced':
                handleWinAnnounced(message);
                break;
            case 'payment_confirmed':
                handlePaymentConfirmed(message);
                break;
            case 'win_confirmed':
                handleWinConfirmed(message);
                break;
            case 'withdrawal_processing':
                handleWithdrawalProcessing(message);
                break;
            case 'player_won':
                handlePlayerWon(message);
                break;
            case 'player_paid':
                handlePlayerPaid(message);
                break;
            case 'player_disconnected':
                handlePlayerDisconnected(message);
                break;
            case 'player_marked':
                handlePlayerMarked(message);
                break;
            case 'stats':
                handleStats(message);
                break;
            case 'players_list':
                handlePlayersList(message);
                break;
            case 'pong':
                // Handle pong response
                console.log('Pong received, connection healthy');
                break;
            case 'ping':
                // Respond to ping
                sendMessage({ type: 'pong', timestamp: Date.now() });
                break;
            default:
                console.warn('Unknown message type:', message.type);
                handleUnknownMessage(message);
        }
    } catch (error) {
        console.error('Error parsing message:', error);
        showNotification('Error processing server message', true);
    }
}

// Message handlers
function handleWelcome(message) {
    console.log('Welcome message:', message.message);
    showNotification(message.message, false);
    
    // Store player ID if provided
    if (message.playerId) {
        gameState.playerId = message.playerId;
        localStorage.setItem('playerId', message.playerId);
    }
    
    // Update connection status with server info
    if (message.serverInfo) {
        updateConnectionStatus('connected', `Connected to ${message.serverInfo.name || 'server'}`);
    }
}

function handleError(message) {
    console.error('Server error:', message.message);
    showNotification(message.message || 'An error occurred', true);
}

function handleRegistrationSuccess(message) {
    gameState.playerId = message.playerId;
    localStorage.setItem('playerId', message.playerId);
    
    showNotification('Registration successful!', false);
    
    // Trigger registration success event
    triggerEvent('registration_success', message);
}

function handleRoomJoined(message) {
    gameState.roomId = message.roomId;
    gameState.gameType = message.gameType;
    gameState.stake = message.stake || 25;
    
    // Update players in room
    if (message.players) {
        gameState.playersInRoom = message.players;
    }
    
    showNotification(`Joined room: ${message.roomId}`, false);
    
    // Trigger room joined event
    triggerEvent('room_joined', message);
}

function handleRoomLeft(message) {
    gameState.roomId = null;
    gameState.gameActive = false;
    
    showNotification('Left the room', false);
    
    // Trigger room left event
    triggerEvent('room_left', message);
}

function handleGameStarted(message) {
    gameState.gameActive = true;
    gameState.calledNumbers = [];
    gameState.markedNumbers.clear();
    
    showNotification('Game has started! Good luck!', false);
    
    // Trigger game started event
    triggerEvent('game_started', message);
}

function handlePlayerJoined(message) {
    // Add player to room list
    if (!gameState.playersInRoom.find(p => p.id === message.playerId)) {
        gameState.playersInRoom.push({
            id: message.playerId,
            name: message.name,
            stake: message.stake
        });
    }
    
    showNotification(`${message.name} joined the room`, false);
    
    // Trigger player joined event
    triggerEvent('player_joined', message);
}

function handlePlayerLeft(message) {
    // Remove player from room list
    gameState.playersInRoom = gameState.playersInRoom.filter(p => p.id !== message.playerId);
    
    showNotification(`Player ${message.playerId} left the room`, false);
    
    // Trigger player left event
    triggerEvent('player_left', message);
}

function handleNumberCalled(message) {
    gameState.calledNumbers.push(message.number);
    
    // Keep only last 20 numbers
    if (gameState.calledNumbers.length > 20) {
        gameState.calledNumbers.shift();
    }
    
    showNotification(`Number called: ${message.number}`, false);
    
    // Trigger number called event
    triggerEvent('number_called', message);
}

function handleChatMessage(message) {
    // Trigger chat message event
    triggerEvent('chat_message', message);
}

function handleWinAnnounced(message) {
    showNotification(`${message.winnerName} won ${message.amount} ETB!`, false);
    
    // Trigger win announced event
    triggerEvent('win_announced', message);
}

function handlePaymentConfirmed(message) {
    gameState.balance = message.balance || 0;
    localStorage.setItem('balance', gameState.balance);
    
    showNotification(`Payment confirmed: ${message.amount} ETB`, false);
    
    // Trigger payment confirmed event
    triggerEvent('payment_confirmed', message);
}

function handleWinConfirmed(message) {
    gameState.balance = message.balance || 0;
    localStorage.setItem('balance', gameState.balance);
    
    showNotification(`You won ${message.amount} ETB!`, false);
    
    // Trigger win confirmed event
    triggerEvent('win_confirmed', message);
}

function handleWithdrawalProcessing(message) {
    gameState.balance = message.newBalance || 0;
    localStorage.setItem('balance', gameState.balance);
    
    showNotification(`Withdrawal processing: ${message.amount} ETB`, false);
    
    // Trigger withdrawal processing event
    triggerEvent('withdrawal_processing', message);
}

function handlePlayerWon(message) {
    showNotification(`Player ${message.name} won ${message.amount} ETB!`, false);
    
    // Trigger player won event (admin only)
    triggerEvent('player_won', message);
}

function handlePlayerPaid(message) {
    showNotification(`Player ${message.name} paid ${message.amount} ETB`, false);
    
    // Trigger player paid event (admin only)
    triggerEvent('player_paid', message);
}

function handlePlayerDisconnected(message) {
    showNotification(`Player ${message.name} disconnected`, true);
    
    // Trigger player disconnected event
    triggerEvent('player_disconnected', message);
}

function handlePlayerMarked(message) {
    // Trigger player marked event (admin only)
    triggerEvent('player_marked', message);
}

function handleStats(message) {
    // Trigger stats event (admin only)
    triggerEvent('stats', message);
}

function handlePlayersList(message) {
    gameState.playersInRoom = message.players || [];
    
    // Trigger players list event (admin only)
    triggerEvent('players_list', message);
}

function handleUnknownMessage(message) {
    console.warn('Received unknown message type:', message.type);
    // Trigger unknown message event
    triggerEvent('unknown_message', message);
}

// ===== MESSAGE SENDING =====

export function sendMessage(message, queueIfOffline = true) {
    // Validate message
    if (!message || typeof message !== 'object') {
        console.error('Invalid message:', message);
        return false;
    }
    
    if (!message.type) {
        console.error('Message missing type:', message);
        return false;
    }
    
    // Check connection
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn('WebSocket not connected. Message queued:', message.type);
        
        if (queueIfOffline) {
            // Add timestamp and retry count
            message._timestamp = Date.now();
            message._retryCount = 0;
            messageQueue.push(message);
        }
        
        // Try to reconnect
        if (connectionStatus !== 'connecting') {
            attemptReconnect();
        }
        
        return false;
    }
    
    try {
        const messageStr = JSON.stringify(message);
        socket.send(messageStr);
        console.log('Sent:', message.type, message);
        return true;
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification('Failed to send message', true);
        
        // Queue for retry
        if (queueIfOffline) {
            message._timestamp = Date.now();
            message._retryCount = 0;
            messageQueue.push(message);
        }
        
        return false;
    }
}

function processMessageQueue() {
    while (messageQueue.length > 0) {
        const message = messageQueue.shift();
        
        // Check retry count
        if (message._retryCount > 3) {
            console.warn('Max retries exceeded for message:', message.type);
            continue;
        }
        
        // Check if message is too old (older than 5 minutes)
        if (Date.now() - message._timestamp > 300000) {
            console.warn('Message too old, discarding:', message.type);
            continue;
        }
        
        // Try to send
        const sent = sendMessage(message, false);
        
        if (!sent) {
            // Re-queue with incremented retry count
            message._retryCount = (message._retryCount || 0) + 1;
            messageQueue.unshift(message);
            break;
        }
    }
}

// ===== GAME MESSAGES =====

export function registerPlayer(playerData) {
    const message = {
        type: 'register',
        playerId: gameState.playerId || generatePlayerId(),
        name: playerData.name,
        phone: playerData.phone,
        stake: playerData.stake || 25,
        gameType: playerData.gameType || '75ball',
        payment: playerData.payment || 0
    };
    
    // Update local state
    gameState.playerName = playerData.name;
    gameState.playerPhone = playerData.phone;
    gameState.stake = playerData.stake || 25;
    gameState.gameType = playerData.gameType || '75ball';
    gameState.payment = playerData.payment || 0;
    
    localStorage.setItem('playerName', playerData.name);
    localStorage.setItem('playerPhone', playerData.phone);
    localStorage.setItem('stake', gameState.stake);
    localStorage.setItem('gameType', gameState.gameType);
    
    return sendMessage(message);
}

export function joinRoom(roomId) {
    if (!gameState.playerId) {
        showNotification('Please register first', true);
        return false;
    }
    
    const message = {
        type: 'join_room',
        playerId: gameState.playerId,
        roomId: roomId
    };
    
    return sendMessage(message);
}

export function leaveRoom() {
    if (!gameState.roomId || !gameState.playerId) {
        return false;
    }
    
    const message = {
        type: 'leave_room',
        playerId: gameState.playerId,
        roomId: gameState.roomId
    };
    
    return sendMessage(message);
}

export function markNumber(number, marked = true) {
    if (!gameState.playerId) {
        return false;
    }
    
    const message = {
        type: 'mark',
        playerId: gameState.playerId,
        number: number,
        marked: marked
    };
    
    // Update local state
    if (marked) {
        gameState.markedNumbers.add(number);
    } else {
        gameState.markedNumbers.delete(number);
    }
    
    return sendMessage(message);
}

export function announceWin(pattern, amount) {
    if (!gameState.playerId || !gameState.roomId) {
        showNotification('Not in a game', true);
        return false;
    }
    
    const message = {
        type: 'win',
        playerId: gameState.playerId,
        pattern: pattern,
        amount: amount
    };
    
    return sendMessage(message);
}

export function sendPayment(amount) {
    if (!gameState.playerId) {
        return false;
    }
    
    const message = {
        type: 'payment',
        playerId: gameState.playerId,
        amount: amount
    };
    
    return sendMessage(message);
}

export function requestWithdrawal(amount, accountNumber) {
    if (!gameState.playerId) {
        return false;
    }
    
    const message = {
        type: 'withdraw',
        playerId: gameState.playerId,
        amount: amount,
        accountNumber: accountNumber
    };
    
    return sendMessage(message);
}

export function sendChatMessage(text) {
    if (!gameState.playerId || !gameState.roomId) {
        return false;
    }
    
    const message = {
        type: 'chat',
        playerId: gameState.playerId,
        roomId: gameState.roomId,
        text: text
    };
    
    return sendMessage(message);
}

// ===== ADMIN FUNCTIONS =====

export function adminStartGame(roomId, gameType, stake) {
    if (!gameState.isAdmin) {
        showNotification('Admin access required', true);
        return false;
    }
    
    const message = {
        type: 'start_game',
        roomId: roomId,
        gameType: gameType || '75ball',
        stake: stake || 25
    };
    
    return sendMessage(message);
}

export function adminCallNumber(roomId, number) {
    if (!gameState.isAdmin) {
        showNotification('Admin access required', true);
        return false;
    }
    
    const message = {
        type: 'number_called',
        roomId: roomId,
        number: number
    };
    
    return sendMessage(message);
}

export function adminBroadcast(messageText, roomId = null) {
    if (!gameState.isAdmin) {
        showNotification('Admin access required', true);
        return false;
    }
    
    const message = {
        type: 'admin_command',
        command: 'broadcast',
        data: {
            message: messageText,
            roomId: roomId
        }
    };
    
    return sendMessage(message);
}

export function adminKickPlayer(playerId) {
    if (!gameState.isAdmin) {
        showNotification('Admin access required', true);
        return false;
    }
    
    const message = {
        type: 'admin_command',
        command: 'kick_player',
        data: {
            playerId: playerId
        }
    };
    
    return sendMessage(message);
}

export function adminGetStats() {
    if (!gameState.isAdmin) {
        showNotification('Admin access required', true);
        return false;
    }
    
    const message = {
        type: 'admin_command',
        command: 'get_stats'
    };
    
    return sendMessage(message);
}

export function adminGetPlayers(roomId = null) {
    if (!gameState.isAdmin) {
        showNotification('Admin access required', true);
        return false;
    }
    
    const message = {
        type: 'admin_command',
        command: 'get_players',
        data: {
            roomId: roomId
        }
    };
    
    return sendMessage(message);
}

// ===== UTILITY FUNCTIONS =====

function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.log('Max reconnection attempts reached');
        showNotification('Cannot connect to server. Please refresh the page.', true);
        return;
    }
    
    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
    updateConnectionStatus('connecting', `Reconnecting in ${delay/1000}s...`);
    
    setTimeout(() => {
        // Try to reconnect with current options
        connectWebSocket({
            isAdmin: gameState.isAdmin,
            playerId: gameState.playerId
        });
    }, delay);
}

function startPingInterval() {
    stopPingInterval();
    
    pingInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            sendMessage({
                type: 'ping',
                timestamp: Date.now()
            }, false);
        }
    }, PING_INTERVAL);
}

function stopPingInterval() {
    if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
    }
}

function updateConnectionStatus(status, message = '') {
    connectionStatus = status;
    
    // Update UI if status element exists
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        let icon = '🔴';
        if (status === 'connected') icon = '🟢';
        else if (status === 'connecting') icon = '🟡';
        
        statusElement.textContent = `${icon} ${message || status}`;
        statusElement.className = `connection-status ${status}`;
    }
    
    // Trigger connection status event
    triggerEvent('connection_status', { status, message });
}

function showNotification(message, isError = false) {
    // Use existing notification system or create simple one
    console.log(`${isError ? 'Error:' : 'Info:'} ${message}`);
    
    // Dispatch custom event for notifications
    const event = new CustomEvent('notification', {
        detail: { message, isError }
    });
    window.dispatchEvent(event);
}

// ===== EVENT SYSTEM =====

export function addEventListener(event, callback) {
    if (!eventListeners[event]) {
        eventListeners[event] = [];
    }
    eventListeners[event].push(callback);
}

export function removeEventListener(event, callback) {
    if (eventListeners[event]) {
        eventListeners[event] = eventListeners[event].filter(cb => cb !== callback);
    }
}

function triggerEvent(event, data) {
    if (eventListeners[event]) {
        eventListeners[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in ${event} event handler:`, error);
            }
        });
    }
}

// ===== PUBLIC API =====

export function getConnectionStatus() {
    return connectionStatus;
}

export function getGameState() {
    return { ...gameState }; // Return copy to prevent direct mutation
}

export function updateGameState(updates) {
    Object.assign(gameState, updates);
}

export function disconnect() {
    stopPingInterval();
    
    if (socket) {
        socket.close(1000, 'User initiated disconnect');
        socket = null;
    }
    
    connectionStatus = 'disconnected';
    gameState.isConnected = false;
    updateConnectionStatus('disconnected', 'Disconnected');
}

export function reconnect() {
    if (connectionStatus === 'connected') {
        return true;
    }
    
    reconnectAttempts = 0;
    currentWSIndex = 0; // Reset to primary URL
    
    return connectWebSocket({
        isAdmin: gameState.isAdmin,
        playerId: gameState.playerId
    });
}

// Initialize on load
export function initWebSocket(options = {}) {
    // Load saved state
    const savedPlayerId = localStorage.getItem('playerId');
    const savedPlayerName = localStorage.getItem('playerName');
    const savedBalance = localStorage.getItem('balance');
    
    if (savedPlayerId) {
        gameState.playerId = savedPlayerId;
        gameState.playerName = savedPlayerName || '';
        gameState.balance = parseInt(savedBalance) || 0;
    }
    
    // Connect to WebSocket
    return connectWebSocket({
        isAdmin: options.isAdmin || false,
        adminToken: options.adminToken,
        playerId: gameState.playerId
    });
}

// Export event constants
export const EVENTS = {
    CONNECTION_STATUS: 'connection_status',
    WELCOME: 'welcome',
    ERROR: 'error',
    REGISTRATION_SUCCESS: 'registration_success',
    ROOM_JOINED: 'room_joined',
    ROOM_LEFT: 'room_left',
    GAME_STARTED: 'game_started',
    PLAYER_JOINED: 'player_joined',
    PLAYER_LEFT: 'player_left',
    NUMBER_CALLED: 'number_called',
    CHAT_MESSAGE: 'chat_message',
    WIN_ANNOUNCED: 'win_announced',
    PAYMENT_CONFIRMED: 'payment_confirmed',
    WIN_CONFIRMED: 'win_confirmed',
    WITHDRAWAL_PROCESSING: 'withdrawal_processing',
    PLAYER_WON: 'player_won',
    PLAYER_PAID: 'player_paid',
    PLAYER_DISCONNECTED: 'player_disconnected',
    PLAYER_MARKED: 'player_marked',
    STATS: 'stats',
    PLAYERS_LIST: 'players_list',
    UNKNOWN_MESSAGE: 'unknown_message'
};

// Make functions available globally (optional)
if (typeof window !== 'undefined') {
    window.WebSocketModule = {
        connectWebSocket,
        sendMessage,
        registerPlayer,
        joinRoom,
        leaveRoom,
        markNumber,
        announceWin,
        sendPayment,
        requestWithdrawal,
        sendChatMessage,
        adminStartGame,
        adminCallNumber,
        adminBroadcast,
        adminKickPlayer,
        adminGetStats,
        adminGetPlayers,
        addEventListener,
        removeEventListener,
        getConnectionStatus,
        getGameState,
        updateGameState,
        disconnect,
        reconnect,
        initWebSocket,
        EVENTS
    };
}

// Export WS_URL for other modules to use
export { WS_URL, WS_BACKUP_URLS };
