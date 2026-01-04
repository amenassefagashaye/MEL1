import { WS_URL } from '../config/config.js';
import { showNotification } from './utils.js';

// WebSocket connection
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

// Connection status
export const connectionStatus = {
    connected: false,
    lastMessage: null,
    roomId: null
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
    ping: handlePing
};

// Initialize WebSocket connection
export function initWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        return;
    }
    
    try {
        ws = new WebSocket(WS_URL);
        
        ws.onopen = handleOpen;
        ws.onmessage = handleMessage;
        ws.onclose = handleClose;
        ws.onerror = handleError;
        
    } catch (error) {
        console.error('WebSocket connection error:', error);
        scheduleReconnect();
    }
}

// Handle connection open
function handleOpen() {
    console.log('WebSocket connected');
    connectionStatus.connected = true;
    reconnectAttempts = 0;
    
    // Update UI
    updateConnectionUI(true);
    
    // Send welcome message
    sendMessage({
        type: 'hello',
        playerId: window.gameState.playerId,
        isAdmin: window.gameState.isAdmin,
        deviceInfo: getDeviceInfo()
    });
}

// Handle incoming messages
function handleMessage(event) {
    try {
        const data = JSON.parse(event.data);
        connectionStatus.lastMessage = Date.now();
        
        // Call appropriate handler
        const handler = messageHandlers[data.type];
        if (handler) {
            handler(data);
        } else {
            console.warn('Unknown message type:', data.type);
        }
        
    } catch (error) {
        console.error('Error parsing message:', error, event.data);
    }
}

// Handle connection close
function handleClose(event) {
    console.log('WebSocket disconnected:', event.code, event.reason);
    connectionStatus.connected = false;
    
    // Update UI
    updateConnectionUI(false);
    
    // Schedule reconnect if not normal closure
    if (event.code !== 1000) {
        scheduleReconnect();
    }
}

// Handle WebSocket error
function handleError(error) {
    console.error('WebSocket error:', error);
    connectionStatus.connected = false;
    updateConnectionUI(false);
}

// Schedule reconnection
function scheduleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('Max reconnection attempts reached');
        showNotification('የማገናኛ ሙከራዎች አልተሳካላቸውም። እባክዎ እንደገና ይሞክሩ', true);
        return;
    }
    
    reconnectAttempts++;
    const delay = RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts - 1);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
    
    setTimeout(() => {
        initWebSocket();
    }, delay);
}

// Send message to server
export function sendMessage(data) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn('WebSocket not connected, storing message for later:', data);
        storeMessageForLater(data);
        return;
    }
    
    try {
        const message = JSON.stringify(data);
        ws.send(message);
        
        // Log for debugging (except ping messages)
        if (data.type !== 'ping') {
            console.log('Sent:', data);
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Store message for later sending
function storeMessageForLater(data) {
    // Store in localStorage for offline support
    const pendingMessages = JSON.parse(localStorage.getItem('pendingMessages') || '[]');
    pendingMessages.push({
        ...data,
        timestamp: Date.now()
    });
    
    // Keep only last 50 messages
    if (pendingMessages.length > 50) {
        pendingMessages.splice(0, pendingMessages.length - 50);
    }
    
    localStorage.setItem('pendingMessages', JSON.stringify(pendingMessages));
}

// Send pending messages when reconnected
function sendPendingMessages() {
    const pendingMessages = JSON.parse(localStorage.getItem('pendingMessages') || '[]');
    
    pendingMessages.forEach(message => {
        sendMessage(message);
    });
    
    // Clear sent messages
    localStorage.removeItem('pendingMessages');
}

// Update connection UI
function updateConnectionUI(connected) {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        if (connected) {
            statusElement.innerHTML = '🟢 ተገናኝቷል';
            statusElement.className = 'connection-status connected';
        } else {
            statusElement.innerHTML = '🔴 የተቋረጠ';
            statusElement.className = 'connection-status disconnected';
        }
    }
}

// Get device info
function getDeviceInfo() {
    return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    };
}

// Message Handlers

function handleWelcome(data) {
    console.log('Welcome message received:', data);
    
    if (data.roomId) {
        connectionStatus.roomId = data.roomId;
        
        // Store room ID for reconnection
        localStorage.setItem('roomId', data.roomId);
    }
    
    if (data.message) {
        showNotification(data.message, false);
    }
    
    // Send pending messages if any
    sendPendingMessages();
}

function handlePlayerJoined(data) {
    console.log('Player joined:', data.playerId);
    
    // Update members list
    if (window.gameState.members) {
        window.gameState.members.push({
            id: data.playerId,
            name: data.name,
            phone: data.phone,
            stake: data.stake
        });
    }
    
    // Update UI if on admin page
    updatePlayersCount();
}

function handlePlayerLeft(data) {
    console.log('Player left:', data.playerId);
    
    // Remove from members list
    if (window.gameState.members) {
        window.gameState.members = window.gameState.members.filter(
            member => member.id !== data.playerId
        );
    }
    
    // Update UI if on admin page
    updatePlayersCount();
}

function handleNumberCalled(data) {
    console.log('Number called:', data.number);
    
    // Update game state
    window.gameState.calledNumbers.push(data.number);
    
    // Update UI
    updateCalledNumbersUI(data.number);
    
    // Check if player has this number
    checkPlayerNumber(data.number);
}

function handleGameStarted(data) {
    console.log('Game started:', data);
    
    window.gameState.gameActive = true;
    window.gameState.calledNumbers = [];
    window.gameState.markedNumbers.clear();
    
    // Reset board
    const cells = document.querySelectorAll('.board-cell');
    cells.forEach(cell => {
        cell.classList.remove('marked');
    });
    
    // Update UI
    showNotification('ጨዋታ ተጀምሯል!', false);
}

function handleGameEnded(data) {
    console.log('Game ended:', data);
    
    window.gameState.gameActive = false;
    
    // Update UI
    showNotification('ጨዋታ አልቋል!', false);
}

function handleWinAnnounced(data) {
    console.log('Win announced:', data);
    
    // Show winner notification
    const notification = document.createElement('div');
    notification.className = 'global-winner-notification';
    notification.innerHTML = `
        <div class="winner-content">
            <div style="font-size: 24px; margin-bottom: 10px;">🏆</div>
            <div class="amharic-text">${data.winnerName}</div>
            <div class="amharic-text">${data.pattern} አሸነፈ!</div>
            <div class="amharic-text">${formatCurrency(data.amount)} ተሸነፈ!</div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function handleAdminMessage(data) {
    console.log('Admin message:', data);
    
    // Show admin notification
    showNotification(`አስተዳዳሪ: ${data.message}`, false);
}

function handleError(data) {
    console.error('Server error:', data);
    showNotification(data.message || 'ስርዓት ስህተት', true);
}

function handlePing(data) {
    // Respond to ping
    sendMessage({
        type: 'pong',
        timestamp: Date.now()
    });
}

// Helper functions

function updateCalledNumbersUI(number) {
    const bar = document.getElementById('calledNumbersBar');
    if (!bar) return;
    
    // Add number to display
    const numberElement = document.createElement('span');
    numberElement.className = 'called-number amharic-text';
    numberElement.textContent = number;
    
    // Add to beginning
    bar.insertBefore(numberElement, bar.firstChild);
    
    // Limit display to 8 numbers
    const numbers = bar.querySelectorAll('.called-number');
    if (numbers.length > 8) {
        numbers[numbers.length - 1].remove();
    }
    
    // Update current number display
    const currentDisplay = document.getElementById('currentNumberDisplay');
    if (currentDisplay) {
        currentDisplay.textContent = number;
    }
}

function checkPlayerNumber(number) {
    const cell = document.querySelector(`.board-cell[data-number="${number}"]`);
    if (cell && !cell.classList.contains('marked')) {
        // Highlight the cell
        cell.style.animation = 'pulse 0.5s 3';
        
        setTimeout(() => {
            cell.style.animation = '';
        }, 1500);
    }
}

function updatePlayersCount() {
    const countElement = document.getElementById('totalPlayers');
    if (countElement) {
        countElement.textContent = window.gameState.members.length;
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-ET', {
        style: 'currency',
        currency: 'ETB',
        minimumFractionDigits: 0
    }).format(amount);
}

// Heartbeat to keep connection alive
setInterval(() => {
    if (connectionStatus.connected) {
        sendMessage({
            type: 'ping',
            timestamp: Date.now()
        });
    }
}, 30000);

// Check for stale connection
setInterval(() => {
    if (connectionStatus.connected && connectionStatus.lastMessage) {
        const timeSinceLastMessage = Date.now() - connectionStatus.lastMessage;
        if (timeSinceLastMessage > 60000) {
            console.warn('Stale connection, reconnecting...');
            ws.close();
            initWebSocket();
        }
    }
}, 10000);

// Export for use in other modules
export { ws };