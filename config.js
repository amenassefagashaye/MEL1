// Configuration for the Bingo Game

// Backend API URLs
const IS_PRODUCTION = window.location.hostname !== 'localhost' && 
                      window.location.hostname !== '127.0.0.1';

// Primary WebSocket URL for gameplay
export const WS_URL = IS_PRODUCTION
    ? 'wss://ameng-gogs-mel3-94.deno.dev/ws'
    : 'ws://localhost:8000/ws';

// Fallback/alternative WebSocket URLs (for redundancy)
export const WS_BACKUP_URLS = [
    'wss://assefa-bingo-backend.deno.dev/ws',
    WS_URL // Include primary as part of backup list
];

// Backend API base URL
export const API_BASE_URL = IS_PRODUCTION
    ? 'https://ameng-gogs-mel3-94.deno.dev'
    : 'http://localhost:8000';

// Alternative API endpoints (for redundancy)
export const API_BACKUP_URLS = [
    'https://assefa-bingo-backend.deno.dev',
    API_BASE_URL // Include primary as part of backup list
];

// WebRTC ICE Servers (STUN/TURN)
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
    STAKE_OPTIONS: {
        '75ball': [10, 25, 50, 100, 250, 500],
        '90ball': [10, 25, 50, 100, 250],
        '30ball': [5, 10, 25, 50],
        '50ball': [10, 25, 50, 100],
        'pattern': [25, 50, 100, 250],
        'coverall': [50, 100, 250, 500]
    },
    
    // Room capacity
    MAX_PLAYERS_PER_ROOM: 90,
    
    // Game duration settings (in minutes)
    GAME_DURATION: {
        '75ball': 15,
        '90ball': 20,
        '30ball': 5,
        '50ball': 10,
        'pattern': 15,
        'coverall': 25
    },
    
    // Win patterns
    WIN_PATTERNS: {
        '75ball': ['line', 'two-lines', 'full-house'],
        '90ball': ['line', 'two-lines', 'full-house'],
        '30ball': ['full-house'],
        '50ball': ['pattern1', 'pattern2', 'full-house'],
        'pattern': ['custom-pattern'],
        'coverall': ['coverall']
    },
    
    // Payout multipliers
    PAYOUT_MULTIPLIERS: {
        'line': 3,
        'two-lines': 5,
        'full-house': 10,
        'coverall': 20
    }
};
