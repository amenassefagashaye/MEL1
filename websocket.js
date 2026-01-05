import { WS_URL } from '../config/config.js';
import { showNotification } from './utils.js';

// WebSocket connection
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;
const PING_INTERVAL = 30000; // 30 seconds
let pingInterval = null;
let lastPong = Date.now();

// Message queue for offline mode
const messageQueue = [];

// Connection status
export const connectionStatus = {
    connected: false,
    lastMessage: null,
    roomId: null,
    playerId: null,
    isAdmin: false,
    gameActive: false,
    pingLatency: 0
};

// Message handlers
const messageHandlers = {
    welcome: handleWelcome,
    player_joined: handlePlayerJoined,
    player_left: handlePlayerLeft,
    number_called: handleNumberCalled,
    game_started: handleGameStarted,
    game_ended: handleGameEnded,
    win_announced: handleWinAnnounced,
    admin_message: handleAdminMessage,
    error: handleError,
    ping: handlePing,
    pong: handlePong,
    registration_success: handleRegistrationSuccess,
    room_joined: handleRoomJoined,
    room_left: handleRoomLeft,
    payment_confirmed: handlePaymentConfirmed,
    win_confirmed: handleWinConfirmed,
    withdrawal_processing: handleWithdrawalProcessing,
    player_won: handlePlayerWon,
    player_paid: handlePlayerPaid,
    player_disconnected: handlePlayerDisconnected,
    player_marked: handlePlayerMarked,
    chat_message: handleChatMessage,
    stats: handleStats,
    players_list: handlePlayersList
};

// Event listeners
const eventListeners = new Map();

// Initialize WebSocket connection
export function initWebSocket(options = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        return true;
    }
    
    if (ws) {
        ws.close();
        ws = null;
    }
    
    const { 
        playerId = null, 
        isAdmin = false, 
        adminToken = null,
        onConnected = null,
        onDisconnected = null,
        onError = null
    } = options;
    
    // Store connection parameters
    connectionStatus.playerId = playerId;
    connectionStatus.isAdmin = isAdmin;
    
    try {
        console.log(`Connecting to WebSocket: ${WS_URL}`);
        ws = new WebSocket(WS_URL);
        
        ws.onopen = (event) => {
            console.log('WebSocket connection established');
            connectionStatus.connected = true;
            reconnectAttempts = 0;
            
            // Start ping interval
            startPingInterval();
            
            // Send hello message
            sendMessage({
                type: 'hello',
                playerId: playerId,
                isAdmin: isAdmin,
                token: adminToken,
                deviceInfo: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language,
                    screen: {
                        width: window.screen.width,
                        height: window.screen.height
                    }
                }
            });
            
            showNotification('Connected to game server', false);
            
            // Trigger connected event
            if (onConnected) onConnected(event);
            triggerEvent('connected', event);
            
            // Process queued messages
            processMessageQueue();
        };
        
        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('Received message:', message.type, message);
                
                connectionStatus.lastMessage = {
                    type: message.type,
                    timestamp: Date.now(),
                    data: message
                };
                
                // Handle message by type
                if (messageHandlers[message.type]) {
                    messageHandlers[message.type](message);
                } else {
                    console.warn(`No handler for message type: ${message.type}`);
                    handleUnknownMessage(message);
                }
                
                // Trigger generic message event
                triggerEvent('message', message);
                
            } catch (error) {
                console.error('Error parsing message:', error, event.data);
                showNotification('Error processing server message', true);
                triggerEvent('message_error', { error, data: event.data });
            }
        };
        
        ws.onclose = (event) => {
            console.log('WebSocket connection closed:', event.code, event.reason);
            connectionStatus.connected = false;
            
            // Stop ping interval
            stopPingInterval();
            
            // Clean up
            ws = null;
            
            // Check if we should reconnect
            if (event.code !== 1000 && event.code !== 1001 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                attemptReconnection();
            }
            
            showNotification('Disconnected from server', true);
            
            // Trigger disconnected event
            if (onDisconnected) onDisconnected(event);
            triggerEvent('disconnected', event);
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            connectionStatus.connected = false;
            
            showNotification('Connection error occurred', true);
            
            // Trigger error event
            if (onError) onError(error);
            triggerEvent('error', error);
        };
        
        return true;
        
    } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        showNotification('Failed to connect to server', true);
        
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            attemptReconnection();
        }
        
        return false;
    }
}

// Reconnection logic
function attemptReconnection() {
    reconnectAttempts++;
    
    if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
        console.log('Max reconnection attempts reached');
        showNotification('Cannot reconnect to server. Please refresh the page.', true);
        return;
    }
    
    const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);
    console.log(`Attempting reconnection in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    
    showNotification(`Reconnecting in ${Math.ceil(delay/1000)} seconds...`, true);
    
    setTimeout(() => {
        console.log('Attempting to reconnect...');
        initWebSocket({
            playerId: connectionStatus.playerId,
            isAdmin: connectionStatus.isAdmin
        });
    }, delay);
}

// Ping/pong for keep-alive
function startPingInterval() {
    stopPingInterval();
    
    pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            lastPong = Date.now();
            sendMessage({
                type: 'ping',
                timestamp: Date.now()
            });
        }
        
        // Check if we haven't received a pong in 2x ping interval
        if (Date.now() - lastPong > PING_INTERVAL * 2) {
            console.warn('No pong received, connection may be dead');
            if (ws) {
                ws.close(1001, 'No pong received');
            }
        }
    }, PING_INTERVAL);
}

function stopPingInterval() {
    if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
    }
}

// Message sending
export function sendMessage(message, queueIfOffline = true) {
    // Validate message
    if (!message || typeof message !== 'object') {
        console.error('Invalid message format:', message);
        return false;
    }
    
    if (!message.type) {
        console.error('Message missing type:', message);
        return false;
    }
    
    // Check connection
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn('WebSocket not connected, queuing message:', message.type);
        
        if (queueIfOffline) {
            // Add to queue with metadata
            messageQueue.push({
                ...message,
                _timestamp: Date.now(),
                _retryCount: 0
            });
        }
        
        // Try to reconnect if not already trying
        if (!connectionStatus.connected && reconnectAttempts === 0) {
            attemptReconnection();
        }
        
        return false;
    }
    
    try {
        const messageStr = JSON.stringify(message);
        ws.send(messageStr);
        console.log('Sent message:', message.type, message);
        return true;
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification('Failed to send message', true);
        
        // Queue for retry
        if (queueIfOffline) {
            messageQueue.push({
                ...message,
                _timestamp: Date.now(),
                _retryCount: 0
            });
        }
        
        return false;
    }
}

// Process queued messages
function processMessageQueue() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    for (let i = messageQueue.length - 1; i >= 0; i--) {
        const queuedMessage = messageQueue[i];
        
        // Remove old messages
        if (now - queuedMessage._timestamp > maxAge) {
            console.log('Removing old queued message:', queuedMessage.type);
            messageQueue.splice(i, 1);
            continue;
        }
        
        // Try to send
        const { _timestamp, _retryCount, ...message } = queuedMessage;
        
        if (sendMessage(message, false)) {
            // Successfully sent, remove from queue
            messageQueue.splice(i, 1);
        } else {
            // Update retry count
            queuedMessage._retryCount = _retryCount + 1;
            
            // Remove if too many retries
            if (queuedMessage._retryCount > 3) {
                console.log('Max retries for queued message:', message.type);
                messageQueue.splice(i, 1);
            }
        }
    }
}

// ===== MESSAGE HANDLERS =====

function handleWelcome(message) {
    console.log('Welcome message:', message.message);
    showNotification(message.message, false);
    
    // Store player ID if provided
    if (message.playerId) {
        connectionStatus.playerId = message.playerId;
    }
    
    triggerEvent('welcome', message);
}

function handlePlayerJoined(message) {
    console.log('Player joined:', message.playerId, message.name);
    showNotification(`${message.name || 'Player'} joined the game`, false);
    
    triggerEvent('player_joined', message);
}

function handlePlayerLeft(message) {
    console.log('Player left:', message.playerId);
    showNotification('Player left the game', false);
    
    triggerEvent('player_left', message);
}

function handleNumberCalled(message) {
    console.log('Number called:', message.number);
    showNotification(`Number called: ${message.number}`, false);
    
    triggerEvent('number_called', message);
}

function handleGameStarted(message) {
    console.log('Game started:', message);
    connectionStatus.gameActive = true;
    showNotification('Game has started!', false);
    
    triggerEvent('game_started', message);
}

function handleGameEnded(message) {
    console.log('Game ended:', message);
    connectionStatus.gameActive = false;
    showNotification('Game has ended', false);
    
    triggerEvent('game_ended', message);
}

function handleWinAnnounced(message) {
    console.log('Win announced:', message);
    showNotification(`${message.winnerName || 'Player'} won ${message.amount || ''}!`, false);
    
    triggerEvent('win_announced', message);
}

function handleAdminMessage(message) {
    console.log('Admin message:', message);
    showNotification(`Admin: ${message.message}`, false);
    
    triggerEvent('admin_message', message);
}

function handleError(message) {
    console.error('Server error:', message.message);
    showNotification(message.message || 'An error occurred', true);
    
    triggerEvent('error', message);
}

function handlePing(message) {
    console.log('Ping received:', message);
    sendMessage({
        type: 'pong',
        timestamp: message.timestamp
    });
}

function handlePong(message) {
    const latency = Date.now() - message.timestamp;
    connectionStatus.pingLatency = latency;
    console.log(`Pong received, latency: ${latency}ms`);
    
    triggerEvent('pong', { ...message, latency });
}

function handleRegistrationSuccess(message) {
    console.log('Registration successful:', message);
    if (message.playerId) {
        connectionStatus.playerId = message.playerId;
    }
    showNotification('Registration successful!', false);
    
    triggerEvent('registration_success', message);
}

function handleRoomJoined(message) {
    console.log('Room joined:', message);
    connectionStatus.roomId = message.roomId;
    showNotification(`Joined room: ${message.roomId}`, false);
    
    triggerEvent('room_joined', message);
}

function handleRoomLeft(message) {
    console.log('Room left:', message);
    connectionStatus.roomId = null;
    showNotification('Left the room', false);
    
    triggerEvent('room_left', message);
}

function handlePaymentConfirmed(message) {
    console.log('Payment confirmed:', message);
    showNotification(`Payment of ${message.amount || 0} confirmed`, false);
    
    triggerEvent('payment_confirmed', message);
}

function handleWinConfirmed(message) {
    console.log('Win confirmed:', message);
    showNotification(`You won ${message.amount || 0}!`, false);
    
    triggerEvent('win_confirmed', message);
}

function handleWithdrawalProcessing(message) {
    console.log('Withdrawal processing:', message);
    showNotification(`Withdrawal of ${message.amount || 0} is processing`, false);
    
    triggerEvent('withdrawal_processing', message);
}

function handlePlayerWon(message) {
    console.log('Player won:', message);
    showNotification(`${message.name || 'Player'} won ${message.amount || 0}!`, false);
    
    triggerEvent('player_won', message);
}

function handlePlayerPaid(message) {
    console.log('Player paid:', message);
    showNotification(`${message.name || 'Player'} paid ${message.amount || 0}`, false);
    
    triggerEvent('player_paid', message);
}

function handlePlayerDisconnected(message) {
    console.log('Player disconnected:', message);
    showNotification(`${message.name || 'Player'} disconnected`, true);
    
    triggerEvent('player_disconnected', message);
}

function handlePlayerMarked(message) {
    console.log('Player marked:', message);
    
    triggerEvent('player_marked', message);
}

function handleChatMessage(message) {
    console.log('Chat message:', message);
    
    triggerEvent('chat_message', message);
}

function handleStats(message) {
    console.log('Stats received:', message);
    
    triggerEvent('stats', message);
}

function handlePlayersList(message) {
    console.log('Players list received:', message.players?.length || 0, 'players');
    
    triggerEvent('players_list', message);
}

function handleUnknownMessage(message) {
    console.warn('Unknown message type:', message.type, message);
    
    triggerEvent('unknown_message', message);
}

// ===== EVENT SYSTEM =====

export function addEventListener(event, callback) {
    if (!eventListeners.has(event)) {
        eventListeners.set(event, []);
    }
    eventListeners.get(event).push(callback);
}

export function removeEventListener(event, callback) {
    if (eventListeners.has(event)) {
        const listeners = eventListeners.get(event);
        const index = listeners.indexOf(callback);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    }
}

function triggerEvent(event, data) {
    if (eventListeners.has(event)) {
        eventListeners.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event handler for ${event}:`, error);
            }
        });
    }
}

// ===== PUBLIC API FUNCTIONS =====

export function registerPlayer(playerData) {
    const message = {
        type: 'register',
        playerId: connectionStatus.playerId || `player_${Date.now()}`,
        name: playerData.name,
        phone: playerData.phone,
        stake: playerData.stake || 25,
        gameType: playerData.gameType || '75ball',
        payment: playerData.payment || 0
    };
    
    // Store player ID for reconnection
    connectionStatus.playerId = message.playerId;
    
    return sendMessage(message);
}

export function joinRoom(roomId) {
    if (!connectionStatus.playerId) {
        showNotification('Please register first', true);
        return false;
    }
    
    const message = {
        type: 'join_room',
        playerId: connectionStatus.playerId,
        roomId: roomId
    };
    
    return sendMessage(message);
}

export function leaveRoom() {
    if (!connectionStatus.playerId || !connectionStatus.roomId) {
        return false;
    }
    
    const message = {
        type: 'leave_room',
        playerId: connectionStatus.playerId,
        roomId: connectionStatus.roomId
    };
    
    return sendMessage(message);
}

export function markNumber(number, marked = true) {
    if (!connectionStatus.playerId) {
        return false;
    }
    
    const message = {
        type: 'mark',
        playerId: connectionStatus.playerId,
        number: number,
        marked: marked
    };
    
    return sendMessage(message);
}

export function announceWin(pattern, amount) {
    if (!connectionStatus.playerId || !connectionStatus.roomId) {
        showNotification('Not in a game', true);
        return false;
    }
    
    const message = {
        type: 'win',
        playerId: connectionStatus.playerId,
        pattern: pattern,
        amount: amount
    };
    
    return sendMessage(message);
}

export function sendPayment(amount) {
    if (!connectionStatus.playerId) {
        return false;
    }
    
    const message = {
        type: 'payment',
        playerId: connectionStatus.playerId,
        amount: amount
    };
    
    return sendMessage(message);
}

export function requestWithdrawal(amount, accountNumber) {
    if (!connectionStatus.playerId) {
        return false;
    }
    
    const message = {
        type: 'withdraw',
        playerId: connectionStatus.playerId,
        amount: amount,
        accountNumber: accountNumber
    };
    
    return sendMessage(message);
}

export function sendChatMessage(text) {
    if (!connectionStatus.playerId || !connectionStatus.roomId) {
        return false;
    }
    
    const message = {
        type: 'chat',
        playerId: connectionStatus.playerId,
        roomId: connectionStatus.roomId,
        text: text
    };
    
    return sendMessage(message);
}

// Admin functions
export function adminStartGame(roomId, gameType, stake) {
    if (!connectionStatus.isAdmin) {
        showNotification('Admin access required', true);
        return false;
    }
    
    const message = {
        type: 'start_game',
        roomId: roomId || connectionStatus.roomId,
        gameType: gameType || '75ball',
        stake: stake || 25
    };
    
    return sendMessage(message);
}

export function adminCallNumber(roomId, number) {
    if (!connectionStatus.isAdmin) {
        showNotification('Admin access required', true);
        return false;
    }
    
    const message = {
        type: 'number_called',
        roomId: roomId || connectionStatus.roomId,
        number: number
    };
    
    return sendMessage(message);
}

export function adminBroadcast(messageText, roomId = null) {
    if (!connectionStatus.isAdmin) {
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
    if (!connectionStatus.isAdmin) {
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
    if (!connectionStatus.isAdmin) {
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
    if (!connectionStatus.isAdmin) {
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

// Connection management
export function disconnect() {
    stopPingInterval();
    
    if (ws) {
        ws.close(1000, 'User initiated disconnect');
        ws = null;
    }
    
    connectionStatus.connected = false;
    reconnectAttempts = 0;
    
    showNotification('Disconnected from server', false);
}

export function reconnect() {
    if (connectionStatus.connected) {
        return true;
    }
    
    reconnectAttempts = 0;
    return initWebSocket({
        playerId: connectionStatus.playerId,
        isAdmin: connectionStatus.isAdmin
    });
}

// Utility functions
export function isConnected() {
    return connectionStatus.connected;
}

export function getConnectionStatus() {
    return { ...connectionStatus };
}

export function getMessageQueueLength() {
    return messageQueue.length;
}

export function clearMessageQueue() {
    messageQueue.length = 0;
}

// Export WebSocket instance
export { ws };
