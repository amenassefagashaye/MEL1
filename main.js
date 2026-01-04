import { API_BASE_URL, WS_URL, ICE_SERVERS } from '../config/config.js';
import { showPage, showNotification, formatCurrency } from './utils.js';
import { initGame, generateGameBoard, startNewGame } from './game.js';
import { initWebSocket, sendMessage, connectionStatus } from './websocket.js';
import { initRTC, startCall, stopCall, isRTCConnected } from './rtc.js';

// Game State
window.gameState = {
    gameType: null,
    payment: 0,
    stake: 25,
    totalWon: 0,
    playerId: null,
    roomId: null,
    playerName: '',
    playerPhone: '',
    isAdmin: false,
    gameActive: false,
    calledNumbers: [],
    markedNumbers: new Set(),
    members: [],
    totalMembers: 90
};

// Initialize application
async function initApp() {
    try {
        // Hide loading screen
        document.getElementById('loadingScreen').style.display = 'none';
        
        // Initialize WebSocket connection
        initWebSocket();
        
        // Initialize game
        initGame();
        
        // Set up event listeners
        setupEventListeners();
        
        // Check for admin mode
        checkAdminMode();
        
        // Update connection status
        updateConnectionStatus();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showNotification('ስርዓት ስህተት! እባክዎ እንደገና ይሞክሩ', false);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Navigation buttons
    document.addEventListener('click', (e) => {
        if (e.target.matches('[data-page]')) {
            const pageNum = parseInt(e.target.dataset.page);
            showPage(pageNum);
        }
    });
    
    // Handle back button
    document.addEventListener('backbutton', handleBackButton, false);
    
    // Handle online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Handle visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

// Handle back button (for mobile)
function handleBackButton() {
    const activePage = document.querySelector('.page-container.active');
    const pageId = activePage.id;
    
    switch(pageId) {
        case 'page1':
            showPage(0);
            break;
        case 'page2':
            showPage(1);
            break;
        case 'page3':
            showPage(2);
            break;
        case 'page4':
            showPage(3);
            break;
        case 'page5':
            showPage(0);
            break;
        default:
            if (confirm('ከመደብደቢያ ይውጡ?')) {
                navigator.app.exitApp();
            }
    }
}

// Handle online status
function handleOnline() {
    showNotification('ኢንተርኔት አገናኝተዋል', false);
    updateConnectionStatus();
}

// Handle offline status
function handleOffline() {
    showNotification('ኢንተርኔት አልተገናኘም', false);
    updateConnectionStatus();
}

// Handle visibility change
function handleVisibilityChange() {
    if (!document.hidden && connectionStatus.connected) {
        // Reconnect if needed
        initWebSocket();
    }
}

// Check for admin mode
function checkAdminMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const adminParam = urlParams.get('admin');
    
    if (adminParam === 'true' || adminParam === 'asse2123') {
        // Request admin authentication
        const password = prompt('የአስተዳዳሪ የይለፍ ቃል ያስገቡ:');
        
        if (password === 'asse2123') {
            window.gameState.isAdmin = true;
            showNotification('እንኳን ደህና መጡ አስተዳዳሪ!', false);
            showAdminControls();
        } else {
            showNotification('የይለፍ ቃል ትክክል አይደለም', false);
        }
    }
}

// Show admin controls
function showAdminControls() {
    // Add admin button to welcome page
    const welcomeContent = document.querySelector('.welcome-content');
    if (welcomeContent && !document.getElementById('adminBtn')) {
        const adminBtn = document.createElement('button');
        adminBtn.id = 'adminBtn';
        adminBtn.className = 'start-btn-circle';
        adminBtn.innerHTML = '<div style="font-size: 24px;">👑</div>';
        adminBtn.onclick = () => showAdminPage();
        welcomeContent.insertBefore(adminBtn, welcomeContent.querySelector('.developer-text'));
    }
}

// Show admin page
function showAdminPage() {
    // Create admin page content
    const adminPage = document.createElement('div');
    adminPage.className = 'page-container active';
    adminPage.id = 'adminPage';
    adminPage.innerHTML = `
        <div class="page-content">
            <div class="page-header amharic-text">አስተዳዳሪ ፓነል</div>
            
            <div class="admin-controls">
                <button class="admin-btn" onclick="startGameSession()">
                    <i class="fas fa-play"></i>
                    <span class="amharic-text">ጨዋታ ጀምር</span>
                </button>
                
                <button class="admin-btn" onclick="callNumberManually()">
                    <i class="fas fa-bullhorn"></i>
                    <span class="amharic-text">ቁጥር ጥራ</span>
                </button>
                
                <button class="admin-btn" onclick="showAllPlayers()">
                    <i class="fas fa-users"></i>
                    <span class="amharic-text">ተጫዋቾች</span>
                </button>
                
                <button class="admin-btn" onclick="showStatistics()">
                    <i class="fas fa-chart-bar"></i>
                    <span class="amharic-text">ስታቲስቲክስ</span>
                </button>
                
                <button class="admin-btn" onclick="managePayments()">
                    <i class="fas fa-money-bill-wave"></i>
                    <span class="amharic-text">ክፍያዎች</span>
                </button>
                
                <button class="admin-btn" onclick="broadcastMessage()">
                    <i class="fas fa-broadcast-tower"></i>
                    <span class="amharic-text">ማስታወቂያ</span>
                </button>
            </div>
            
            <div class="admin-stats">
                <div class="stat-card">
                    <div class="stat-label amharic-text">አጠቃላይ ተጫዋቾች</div>
                    <div class="stat-value" id="totalPlayers">0</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label amharic-text">አጠቃላይ ክፍያ</div>
                    <div class="stat-value" id="totalPayments">0 ብር</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label amharic-text">አሁን የተጠራ</div>
                    <div class="stat-value" id="currentNumber">-</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label amharic-text">የተጠራቁጥር</div>
                    <div class="stat-value" id="calledCount">0</div>
                </div>
            </div>
        </div>
        
        <div class="fixed-controls">
            <button class="control-btn btn-secondary" onclick="showPage(0)">
                <i class="fas fa-home"></i>
                <span class="amharic-text">ቤት</span>
            </button>
        </div>
    `;
    
    document.querySelector('.main-container').appendChild(adminPage);
}

// Update connection status display
function updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) return;
    
    if (navigator.onLine) {
        if (connectionStatus.connected) {
            statusElement.innerHTML = '🟢 ተገናኝቷል';
            statusElement.className = 'connected';
        } else {
            statusElement.innerHTML = '🟡 እየገናኘ ነው...';
            statusElement.className = 'connecting';
        }
    } else {
        statusElement.innerHTML = '🔴 ኢንተርኔት የለም';
        statusElement.className = 'disconnected';
    }
}

// Export functions to window for HTML onclick handlers
window.showPage = showPage;
window.showNotification = showNotification;
window.startNewGame = startNewGame;
window.generateGameBoard = generateGameBoard;
window.initRTC = initRTC;
window.startCall = startCall;
window.stopCall = stopCall;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Service Worker for offline support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}