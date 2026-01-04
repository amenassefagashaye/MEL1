// Configuration for the Bingo Game

// Backend API URLs
const IS_PRODUCTION = window.location.hostname !== 'localhost' && 
                      window.location.hostname !== '127.0.0.1';

export const API_BASE_URL = IS_PRODUCTION
    ? 'https://assefa-bingo-backend.deno.dev'
    : 'http://localhost:8000';

export const WS_URL = IS_PRODUCTION
    ? 'wss://assefa-bingo-backend.deno.dev/ws'
    : 'ws://localhost:8000/ws';

// WebRICE ICE Servers (STUN/TURN)
export const ICE_SERVERS = [
    // Google STUN servers
    {
        urls: [
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
            'stun:stun3.l.google.com:19302',
            'stun:stun4.l.google.com:19302'
        ]
    },
    // Twilio STUN servers (free tier)
    {
        urls: [
            'stun:global.stun.twilio.com:3478'
        ]
    },
    // Add TURN servers if available (requires credentials)
    /*
    {
        urls: 'turn:your-turn-server.com:3478',
        username: 'username',
        credential: 'password'
    }
    */
];

// Game Configuration
export const GAME_CONFIG = {
    // Game types
    GAME_TYPES: ['75ball', '90ball', '30ball', '50ball', 'pattern', 'coverall'],
    
    // Stake options (in ETB)
    STAKE_OPTIONS: [25, 50, 100, 200, 500, 1000, 2000, 5000],
    
    // Payment options
    PAYMENT_OPTIONS: [25, 50, 100, 200, 500, 1000, 2000, 5000],
    
    // Service charge percentage
    SERVICE_CHARGE: 0.03, // 3%
    
    // Win multiplier
    WIN_MULTIPLIER: 0.8,
    
    // Maximum players per room
    MAX_PLAYERS_PER_ROOM: 90,
    
    // Number call interval (ms)
    CALL_INTERVAL: 7000,
    
    // Auto-reconnect attempts
    MAX_RECONNECT_ATTEMPTS: 5,
    
    // Reconnect delay (ms)
    RECONNECT_DELAY: 3000,
    
    // Heartbeat interval (ms)
    HEARTBEAT_INTERVAL: 30000,
    
    // Session timeout (ms)
    SESSION_TIMEOUT: 300000, // 5 minutes
};

// Local Storage Keys
export const STORAGE_KEYS = {
    PLAYER_ID: 'bingo_player_id',
    PLAYER_NAME: 'bingo_player_name',
    PLAYER_PHONE: 'bingo_player_phone',
    ROOM_ID: 'bingo_room_id',
    GAME_STATE: 'bingo_game_state',
    PENDING_MESSAGES: 'bingo_pending_messages',
    SETTINGS: 'bingo_settings'
};

// Default Settings
export const DEFAULT_SETTINGS = {
    soundEnabled: true,
    vibrationEnabled: true,
    autoMarkNumbers: false,
    showAnimations: true,
    language: 'am', // 'am' for Amharic, 'en' for English
    theme: 'default', // 'default', 'dark', 'light'
    fontSize: 'medium', // 'small', 'medium', 'large'
    notificationEnabled: true
};

// Error Messages
export const ERROR_MESSAGES = {
    NETWORK_ERROR: 'የአውታረመረብ ስህተት። እባክዎ እንደገና ይሞክሩ።',
    SERVER_ERROR: 'የሰርቨር ስህተት። እባክዎ ቆይተው እንደገና ይሞክሩ።',
    VALIDATION_ERROR: 'ትክክለኛ መረጃ ያስገቡ።',
    PAYMENT_ERROR: 'የክፍያ ስህተት። እባክዎ እንደገና ይሞክሩ።',
    GAME_ERROR: 'የጨዋታ ስህተት። እባክዎ እንደገና ይጀምሩ።',
    AUTH_ERROR: 'የማረጋገጫ ስህተት። እባክዎ እንደገና ይግቡ።',
    CONNECTION_ERROR: 'የግንኙነት ስህተት። እባክዎ ኢንተርኔትዎን ያረጋግጡ።'
};

// Success Messages
export const SUCCESS_MESSAGES = {
    REGISTRATION_SUCCESS: 'ምዝገባዎ በተሳካ ሁኔታ ተጠናቅቋል!',
    PAYMENT_SUCCESS: 'ክፍያዎ በተሳካ ሁኔታ ተጠናቅቋል!',
    WINNER_SUCCESS: 'እንኳን ደስ ያለህ! አሸናፊ ሆነህ!',
    WITHDRAWAL_SUCCESS: 'ገንዘብዎ በተሳካ ሁኔታ ተወግዷል!'
};

// Admin Configuration
export const ADMIN_CONFIG = {
    PASSWORD: 'asse2123',
    SECRET_KEY: 'assefa_gashaye_bingo_secret_2024',
    SESSION_TIMEOUT: 3600000, // 1 hour
    MAX_LOGIN_ATTEMPTS: 3,
    LOCKOUT_TIME: 300000, // 5 minutes
};

// Audio Configuration
export const AUDIO_CONFIG = {
    CALL_SOUND: 'https://assets.mixkit.co/sfx/preview/mixkit-bell-notification-933.mp3',
    WIN_SOUND: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3',
    ERROR_SOUND: 'https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3',
    SUCCESS_SOUND: 'https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3'
};

// Feature Flags
export const FEATURE_FLAGS = {
    ENABLE_WEBRTC: true,
    ENABLE_PUSH_NOTIFICATIONS: false,
    ENABLE_OFFLINE_MODE: true,
    ENABLE_CHAT: true,
    ENABLE_VOICE_CALLS: false,
    ENABLE_SCREEN_SHARING: false,
    ENABLE_ANALYTICS: true,
    ENABLE_ADS: false
};

// Analytics Configuration
export const ANALYTICS_CONFIG = {
    GOOGLE_ANALYTICS_ID: '', // Add your GA ID here
    AMPLITUDE_API_KEY: '', // Add your Amplitude API key here
    MIXPANEL_TOKEN: '' // Add your Mixpanel token here
};

// Environment Detection
export const ENVIRONMENT = {
    isDevelopment: !IS_PRODUCTION,
    isProduction: IS_PRODUCTION,
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
    isAndroid: /Android/.test(navigator.userAgent),
    isDesktop: !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
};

// Export all configurations
export default {
    API_BASE_URL,
    WS_URL,
    ICE_SERVERS,
    GAME_CONFIG,
    STORAGE_KEYS,
    DEFAULT_SETTINGS,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    ADMIN_CONFIG,
    AUDIO_CONFIG,
    FEATURE_FLAGS,
    ANALYTICS_CONFIG,
    ENVIRONMENT
};