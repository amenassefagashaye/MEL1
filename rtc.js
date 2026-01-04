import { ICE_SERVERS } from '../config/config.js';
import { showNotification } from './utils.js';
import { sendMessage } from './websocket.js';

// WebRTC configuration
let peerConnection = null;
let dataChannel = null;
let localStream = null;
let remoteStream = null;

// RTC state
export const rtcState = {
    connected: false,
    connecting: false,
    role: null, // 'admin' or 'player'
    roomId: null
};

// Initialize WebRTC
export function initRTC(config = {}) {
    const { role = 'player', roomId = null } = config;
    
    rtcState.role = role;
    rtcState.roomId = roomId;
    
    // Create peer connection
    peerConnection = new RTCPeerConnection({
        iceServers: ICE_SERVERS
    });
    
    // Set up event handlers
    peerConnection.onicecandidate = handleICECandidate;
    peerConnection.onconnectionstatechange = handleConnectionStateChange;
    peerConnection.onsignalingstatechange = handleSignalingStateChange;
    peerConnection.oniceconnectionstatechange = handleICEConnectionStateChange;
    
    // For admin: create data channel
    if (role === 'admin') {
        createDataChannel();
    }
    
    // For players: wait for data channel from admin
    if (role === 'player') {
        peerConnection.ondatachannel = handleDataChannel;
    }
}

// Create data channel (admin only)
function createDataChannel() {
    try {
        dataChannel = peerConnection.createDataChannel('bingoData', {
            ordered: true,
            maxRetransmits: 3
        });
        
        setupDataChannel(dataChannel);
        
    } catch (error) {
        console.error('Error creating data channel:', error);
        showNotification('የውሂብ ሰርጥ ስህተት', true);
    }
}

// Setup data channel event handlers
function setupDataChannel(channel) {
    channel.onopen = () => {
        console.log('Data channel opened');
        rtcState.connected = true;
        showNotification('የውሂብ ሰርጥ ተገናኝቷል', false);
    };
    
    channel.onclose = () => {
        console.log('Data channel closed');
        rtcState.connected = false;
        showNotification('የውሂብ ሰርጥ ዘግቷል', true);
    };
    
    channel.onerror = (error) => {
        console.error('Data channel error:', error);
        showNotification('የውሂብ ሰርጥ ስህተት', true);
    };
    
    channel.onmessage = handleDataChannelMessage;
}

// Handle incoming data channel (players only)
function handleDataChannel(event) {
    dataChannel = event.channel;
    setupDataChannel(dataChannel);
}

// Handle ICE candidate
function handleICECandidate(event) {
    if (event.candidate) {
        // Send candidate to signaling server
        sendMessage({
            type: 'ice_candidate',
            candidate: event.candidate,
            role: rtcState.role,
            roomId: rtcState.roomId
        });
    }
}

// Handle connection state change
function handleConnectionStateChange() {
    console.log('Connection state:', peerConnection.connectionState);
    
    switch (peerConnection.connectionState) {
        case 'connected':
            rtcState.connected = true;
            showNotification('WebRTC ተገናኝቷል', false);
            break;
        case 'disconnected':
        case 'failed':
            rtcState.connected = false;
            showNotification('WebRTC ዘግቷል', true);
            break;
        case 'closed':
            rtcState.connected = false;
            cleanupRTC();
            break;
    }
}

// Handle signaling state change
function handleSignalingStateChange() {
    console.log('Signaling state:', peerConnection.signalingState);
}

// Handle ICE connection state change
function handleICEConnectionStateChange() {
    console.log('ICE connection state:', peerConnection.iceConnectionState);
}

// Handle data channel messages
function handleDataChannelMessage(event) {
    try {
        const data = JSON.parse(event.data);
        console.log('Data channel message:', data);
        
        // Handle different message types
        switch (data.type) {
            case 'game_state':
                handleGameState(data);
                break;
            case 'number_called':
                handleRTCNumberCalled(data);
                break;
            case 'winner':
                handleRTCWinner(data);
                break;
            case 'chat':
                handleRTCChat(data);
                break;
            case 'file':
                handleRTCFile(data);
                break;
            default:
                console.warn('Unknown RTC message type:', data.type);
        }
        
    } catch (error) {
        console.error('Error parsing data channel message:', error);
    }
}

// Handle game state updates
function handleGameState(data) {
    if (data.numbers) {
        // Update called numbers
        window.gameState.calledNumbers = data.numbers;
        updateCalledNumbersUI();
    }
    
    if (data.winners) {
        // Update winners list
        showWinnersList(data.winners);
    }
}

// Handle number called via RTC
function handleRTCNumberCalled(data) {
    const number = data.number;
    
    // Add to called numbers
    window.gameState.calledNumbers.push(number);
    
    // Update UI
    updateCalledNumbersUI();
    
    // Check if player has this number
    checkPlayerNumber(number);
}

// Handle winner announcement via RTC
function handleRTCWinner(data) {
    const winner = data.winner;
    const amount = data.amount;
    const pattern = data.pattern;
    
    // Show winner notification
    showWinnerNotification(winner, amount, pattern);
}

// Handle chat messages via RTC
function handleRTCChat(data) {
    const message = data.message;
    const sender = data.sender;
    
    // Display chat message
    showChatMessage(sender, message);
}

// Handle file transfer via RTC
function handleRTCFile(data) {
    // Handle file data (e.g., image, document)
    console.log('File received:', data.filename, data.size);
    
    // For now, just show notification
    showNotification(`ፋይል ተቀብሏል: ${data.filename}`, false);
}

// Start call (admin initiates)
export async function startCall() {
    if (rtcState.role !== 'admin') {
        console.error('Only admin can start call');
        return;
    }
    
    try {
        // Get local media (optional)
        if (window.gameState.enableVideo) {
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            // Add tracks to connection
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
            
            // Show local video
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = localStream;
            }
        }
        
        // Create offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Send offer to signaling server
        sendMessage({
            type: 'offer',
            offer: offer,
            role: 'admin',
            roomId: rtcState.roomId
        });
        
        rtcState.connecting = true;
        
    } catch (error) {
        console.error('Error starting call:', error);
        showNotification('የጥሪ ስህተት', true);
    }
}

// Handle incoming offer (player receives)
export async function handleOffer(offer) {
    if (rtcState.role !== 'player') {
        console.error('Only players handle offers');
        return;
    }
    
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Create answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // Send answer to signaling server
        sendMessage({
            type: 'answer',
            answer: answer,
            role: 'player',
            roomId: rtcState.roomId
        });
        
    } catch (error) {
        console.error('Error handling offer:', error);
    }
}

// Handle incoming answer (admin receives)
export async function handleAnswer(answer) {
    if (rtcState.role !== 'admin') {
        console.error('Only admin handles answers');
        return;
    }
    
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        
    } catch (error) {
        console.error('Error handling answer:', error);
    }
}

// Handle ICE candidate from remote
export async function handleRemoteCandidate(candidate) {
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        
    } catch (error) {
        console.error('Error adding ICE candidate:', error);
    }
}

// Send data via RTC
export function sendRTCMessage(data) {
    if (!dataChannel || dataChannel.readyState !== 'open') {
        console.error('Data channel not ready');
        return;
    }
    
    try {
        dataChannel.send(JSON.stringify(data));
        
    } catch (error) {
        console.error('Error sending RTC message:', error);
    }
}

// Send number call via RTC (admin only)
export function sendNumberCall(number) {
    if (rtcState.role !== 'admin') {
        console.error('Only admin can call numbers');
        return;
    }
    
    sendRTCMessage({
        type: 'number_called',
        number: number,
        timestamp: Date.now()
    });
}

// Send winner announcement via RTC (admin only)
export function sendWinnerAnnouncement(winner, amount, pattern) {
    if (rtcState.role !== 'admin') {
        console.error('Only admin can announce winners');
        return;
    }
    
    sendRTCMessage({
        type: 'winner',
        winner: winner,
        amount: amount,
        pattern: pattern,
        timestamp: Date.now()
    });
}

// Send chat message via RTC
export function sendRTCChat(message) {
    sendRTCMessage({
        type: 'chat',
        message: message,
        sender: window.gameState.playerName,
        timestamp: Date.now()
    });
}

// Stop call
export function stopCall() {
    if (peerConnection) {
        peerConnection.close();
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    cleanupRTC();
    
    showNotification('ጥሪ ተዘግቷል', false);
}

// Cleanup RTC resources
function cleanupRTC() {
    peerConnection = null;
    dataChannel = null;
    localStream = null;
    remoteStream = null;
    
    rtcState.connected = false;
    rtcState.connecting = false;
}

// Helper functions

function updateCalledNumbersUI() {
    // This function updates the called numbers display
    const bar = document.getElementById('calledNumbersBar');
    if (!bar) return;
    
    bar.innerHTML = '';
    
    window.gameState.calledNumbers.slice(-8).forEach(number => {
        const span = document.createElement('span');
        span.className = 'called-number amharic-text';
        span.textContent = number;
        bar.appendChild(span);
    });
}

function checkPlayerNumber(number) {
    const cell = document.querySelector(`.board-cell[data-number="${number}"]`);
    if (cell && !cell.classList.contains('marked')) {
        // Highlight the cell
        cell.style.backgroundColor = '#ffd700';
        cell.style.color = '#0d47a1';
        cell.style.transform = 'scale(1.1)';
        
        setTimeout(() => {
            cell.style.backgroundColor = '';
            cell.style.color = '';
            cell.style.transform = '';
        }, 2000);
    }
}

function showWinnerNotification(winner, amount, pattern) {
    const notification = document.createElement('div');
    notification.className = 'rtc-winner-notification';
    notification.innerHTML = `
        <div class="winner-content">
            <div style="font-size: 24px; margin-bottom: 10px;">🏆</div>
            <div class="amharic-text">${winner}</div>
            <div class="amharic-text">${pattern} አሸነፈ!</div>
            <div class="amharic-text">${formatCurrency(amount)} ተሸነፈ!</div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function showChatMessage(sender, message) {
    const chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    messageElement.innerHTML = `
        <div class="chat-sender">${sender}</div>
        <div class="chat-text">${message}</div>
    `;
    
    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showWinnersList(winners) {
    const winnersList = document.getElementById('winnersList');
    if (!winnersList) return;
    
    winnersList.innerHTML = winners.map(winner => `
        <div class="winner-item">
            <span class="winner-name">${winner.name}</span>
            <span class="winner-amount">${formatCurrency(winner.amount)}</span>
        </div>
    `).join('');
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-ET', {
        style: 'currency',
        currency: 'ETB',
        minimumFractionDigits: 0
    }).format(amount);
}

// Export state check
export function isRTCConnected() {
    return rtcState.connected;
}