import { showNotification, formatCurrency } from './utils.js';
import { sendMessage } from './websocket.js';

// Game configuration
const GAME_CONFIG = {
    boardTypes: [
        { id: '75ball', name: '75-ቢንጎ', range: 75, columns: 5, rows: 5 },
        { id: '90ball', name: '90-ቢንጎ', range: 90, columns: 9, rows: 3 },
        { id: '30ball', name: '30-ቢንጎ', range: 30, columns: 3, rows: 3 },
        { id: '50ball', name: '50-ቢንጎ', range: 50, columns: 5, rows: 5 },
        { id: 'pattern', name: 'ንድፍ ቢንጎ', range: 75, columns: 5, rows: 5 },
        { id: 'coverall', name: 'ሙሉ ቤት', range: 90, columns: 9, rows: 5 }
    ],
    
    stakes: [25, 50, 100, 200, 500, 1000, 2000, 5000],
    
    winMultipliers: {
        '75ball': {
            'row': 1.5,
            'column': 1.5,
            'diagonal': 2,
            'four-corners': 1.2,
            'full-house': 3
        },
        '90ball': {
            'one-line': 1.2,
            'two-lines': 1.5,
            'full-house': 2
        },
        '30ball': {
            'full-house': 1.5
        },
        '50ball': {
            'row': 1.5,
            'column': 1.5,
            'diagonal': 2,
            'four-corners': 1.2,
            'full-house': 2.5
        },
        'pattern': {
            'x-pattern': 2,
            'frame': 1.8,
            'postage-stamp': 1.5,
            'small-diamond': 1.3
        },
        'coverall': {
            'full-board': 4
        }
    },
    
    patterns: {
        'x-pattern': ['0-0', '0-4', '1-1', '1-3', '2-2', '3-1', '3-3', '4-0', '4-4'],
        'frame': ['0-0', '0-1', '0-2', '0-3', '0-4', '4-0', '4-1', '4-2', '4-3', '4-4', 
                  '1-0', '2-0', '3-0', '1-4', '2-4', '3-4'],
        'postage-stamp': ['0-0', '0-1', '1-0', '1-1', '3-3', '3-4', '4-3', '4-4'],
        'small-diamond': ['1-2', '2-1', '2-2', '2-3', '3-2']
    }
};

// Initialize game
export function initGame() {
    setupBoardSelection();
    setupStakeOptions();
    setupBoardNumbers();
    setupEventListeners();
}

// Setup board selection grid
function setupBoardSelection() {
    const grid = document.getElementById('boardTypeGrid');
    if (!grid) return;
    
    grid.innerHTML = GAME_CONFIG.boardTypes.map(type => `
        <div class="board-type-card" data-type="${type.id}">
            <div class="board-type-icon">${getBoardIcon(type.id)}</div>
            <div class="board-type-title amharic-text">${type.name}</div>
            <div class="board-type-desc amharic-text">${getBoardDescription(type.id)}</div>
        </div>
    `).join('');
    
    // Add click event listeners
    grid.querySelectorAll('.board-type-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.board-type-card').forEach(c => 
                c.classList.remove('selected'));
            card.classList.add('selected');
            window.gameState.gameType = card.dataset.type;
        });
    });
}

// Get board icon
function getBoardIcon(type) {
    const icons = {
        '75ball': '🎯',
        '90ball': '🇬🇧',
        '30ball': '⚡',
        '50ball': '🎲',
        'pattern': '✨',
        'coverall': '🏆'
    };
    return icons[type] || '🎮';
}

// Get board description
function getBoardDescription(type) {
    const desc = {
        '75ball': '5×5 ከBINGO',
        '90ball': '9×3 ፈጣን',
        '30ball': '3×3 ፍጥነት',
        '50ball': '5×5 ከBINGO',
        'pattern': 'ተጠቀም ንድፍ',
        'coverall': 'ሁሉንም ምልክት ያድርጉ'
    };
    return desc[type] || '';
}

// Setup stake options
function setupStakeOptions() {
    const select = document.getElementById('playerStake');
    if (!select) return;
    
    select.innerHTML = '<option value="">ይምረጡ</option>' +
        GAME_CONFIG.stakes.map(stake => 
            `<option value="${stake}">${formatCurrency(stake)}</option>`
        ).join('');
    
    select.value = 25;
    window.gameState.stake = 25;
}

// Setup board numbers
function setupBoardNumbers() {
    const select = document.getElementById('boardSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">ይምረጡ</option>' +
        Array.from({length: 100}, (_, i) => i + 1)
            .map(num => `<option value="${num}">ቦርድ ${num}</option>`)
            .join('');
}

// Setup event listeners
function setupEventListeners() {
    // Next button
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (!window.gameState.gameType) {
                showNotification('እባክዎ የቦርድ ዓይነት ይምረጡ', true);
                return;
            }
            showPage(2);
        });
    }
    
    // Confirm registration button
    const confirmBtn = document.getElementById('confirmBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmRegistration);
    }
    
    // Payment amount change
    const paymentSelect = document.getElementById('paymentAmount');
    if (paymentSelect) {
        paymentSelect.addEventListener('change', processPayment);
    }
    
    // Stake change
    const stakeSelect = document.getElementById('playerStake');
    if (stakeSelect) {
        stakeSelect.addEventListener('change', updatePotentialWin);
    }
}

// Process payment
export function processPayment() {
    const select = document.getElementById('paymentAmount');
    const amount = parseInt(select.value) || 0;
    
    if (amount < 25) {
        showNotification('ዝቅተኛው ክፍያ 25 ብር ነው', true);
        return;
    }
    
    window.gameState.payment = amount;
    window.gameState.paymentAmount = amount;
    
    // Visual feedback
    select.style.background = '#28a745';
    select.style.color = 'white';
    
    // Send payment info to server
    sendMessage({
        type: 'payment',
        amount: amount,
        playerId: window.gameState.playerId
    });
}

// Update potential win display
export function updatePotentialWin() {
    const stakeSelect = document.getElementById('playerStake');
    const stake = parseInt(stakeSelect.value) || 25;
    
    const potentialWin = calculatePotentialWin(stake);
    const displayElement = document.getElementById('currentWinDisplay');
    
    if (displayElement) {
        displayElement.textContent = formatCurrency(potentialWin);
    }
    
    window.gameState.stake = stake;
}

// Calculate potential win
function calculatePotentialWin(stake) {
    const validMembers = 90;
    const potential = (0.8 * validMembers * stake * 0.97);
    return Math.floor(potential);
}

// Confirm registration
function confirmRegistration() {
    const nameInput = document.getElementById('playerName');
    const phoneInput = document.getElementById('playerPhone');
    const stakeSelect = document.getElementById('playerStake');
    const boardSelect = document.getElementById('boardSelect');
    
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const stake = parseInt(stakeSelect.value) || 25;
    const boardId = boardSelect.value || '1';
    
    // Validate inputs
    if (!name || name.length < 2) {
        showNotification('እባክዎ ትክክለኛ ስም ያስገቡ', true);
        nameInput.focus();
        return;
    }
    
    if (!phone || !/^(09|\\+2519|2519)[0-9]{8}$/.test(phone.replace(/\s+/g, ''))) {
        showNotification('እባክዎ ትክክለኛ ስልክ ቁጥር ያስገቡ', true);
        phoneInput.focus();
        return;
    }
    
    if (window.gameState.payment === 0) {
        showNotification('እባክዎ ክፍያ ይምረጡ', true);
        return;
    }
    
    // Update game state
    window.gameState.playerName = name;
    window.gameState.playerPhone = phone;
    window.gameState.stake = stake;
    window.gameState.boardId = boardId;
    
    // Generate player ID
    window.gameState.playerId = generatePlayerId(name, phone);
    
    // Send registration to server
    sendMessage({
        type: 'register',
        playerId: window.gameState.playerId,
        name: name,
        phone: phone,
        stake: stake,
        boardId: boardId,
        gameType: window.gameState.gameType,
        payment: window.gameState.payment
    });
    
    // Show game page
    showPage(3);
}

// Generate player ID
function generatePlayerId(name, phone) {
    const timestamp = Date.now().toString(36);
    const namePart = name.substring(0, 3).toUpperCase();
    const phonePart = phone.substring(phone.length - 4);
    return `PLAYER_${namePart}_${phonePart}_${timestamp}`;
}

// Generate game board
export function generateGameBoard() {
    const board = document.getElementById('gameBoard');
    const header = document.getElementById('gameHeader');
    
    if (!board || !header) return;
    
    const gameType = window.gameState.gameType;
    const type = GAME_CONFIG.boardTypes.find(t => t.id === gameType);
    
    if (!type) {
        showNotification('የቦርድ አይነት አልተገኘም', true);
        return;
    }
    
    board.innerHTML = '';
    header.textContent = `${type.name} - ቦርድ ${window.gameState.boardId}`;
    
    // Generate board based on type
    switch(gameType) {
        case '75ball':
        case '50ball':
            generateBingoBoard(type);
            break;
        case '90ball':
            generate90BallBoard(type);
            break;
        case '30ball':
            generate30BallBoard(type);
            break;
        case 'pattern':
            generatePatternBoard(type);
            break;
        case 'coverall':
            generateCoverallBoard(type);
            break;
        default:
            generateBingoBoard(type);
    }
    
    // Initialize board interactions
    setupBoardInteractions();
}

// Generate BINGO board (75/50 ball)
function generateBingoBoard(type) {
    const board = document.getElementById('gameBoard');
    const wrapper = document.createElement('div');
    wrapper.className = 'board-75-wrapper';
    
    // BINGO Labels
    const labels = document.createElement('div');
    labels.className = 'bingo-labels';
    'BINGO'.split('').forEach(letter => {
        const label = document.createElement('div');
        label.className = 'bingo-label';
        label.textContent = letter;
        labels.appendChild(label);
    });
    wrapper.appendChild(labels);
    
    // Board Grid
    const grid = document.createElement('div');
    grid.className = type.id === '75ball' ? 'board-75' : 'board-50';
    
    const columnRanges = type.id === '75ball' ? 
        [[1,15], [16,30], [31,45], [46,60], [61,75]] :
        [[1,10], [11,20], [21,30], [31,40], [41,50]];
    
    const columnNumbers = columnRanges.map(range => {
        let nums = new Set();
        while (nums.size < 5) {
            nums.add(Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0]);
        }
        return Array.from(nums).sort((a, b) => a - b);
    });
    
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
            const cell = createBoardCell(type, row, col, columnNumbers[col][row]);
            grid.appendChild(cell);
        }
    }
    
    wrapper.appendChild(grid);
    board.appendChild(wrapper);
}

// Generate 90 Ball Board
function generate90BallBoard(type) {
    const board = document.getElementById('gameBoard');
    const wrapper = document.createElement('div');
    wrapper.className = 'board-90-wrapper';
    
    // Column labels
    const labels = document.createElement('div');
    labels.className = 'board-90-labels';
    for (let i = 1; i <= 9; i++) {
        const label = document.createElement('div');
        label.className = 'board-90-label';
        label.textContent = `${(i-1)*10+1}-${i*10}`;
        labels.appendChild(label);
    }
    wrapper.appendChild(labels);
    
    // Board Grid
    const grid = document.createElement('div');
    grid.className = 'board-90';
    
    const ranges = [
        [1,10], [11,20], [21,30], [31,40], [41,50],
        [51,60], [61,70], [71,80], [81,90]
    ];
    
    const columnNumbers = ranges.map(range => {
        const count = Math.floor(Math.random() * 3) + 1;
        let nums = new Set();
        while (nums.size < count) {
            nums.add(Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0]);
        }
        return Array.from(nums).sort((a, b) => a - b);
    });
    
    const layout = Array(3).fill().map(() => Array(9).fill(null));
    
    columnNumbers.forEach((nums, col) => {
        const positions = [0,1,2].sort(() => Math.random() - 0.5).slice(0, nums.length);
        positions.forEach((row, idx) => {
            layout[row][col] = nums[idx];
        });
    });
    
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 9; col++) {
            const num = layout[row][col];
            const cell = createBoardCell(type, row, col, num);
            
            if (!num) {
                cell.classList.add('blank-cell');
                cell.textContent = '✗';
                cell.onclick = null;
            }
            
            grid.appendChild(cell);
        }
    }
    
    wrapper.appendChild(grid);
    board.appendChild(wrapper);
}

// Generate 30 Ball Board
function generate30BallBoard(type) {
    const board = document.getElementById('gameBoard');
    const wrapper = document.createElement('div');
    wrapper.className = 'board-30-wrapper';
    
    // Column labels
    const labels = document.createElement('div');
    labels.className = 'board-30-labels';
    for (let i = 1; i <= 3; i++) {
        const label = document.createElement('div');
        label.className = 'board-30-label';
        label.textContent = `${(i-1)*10+1}-${i*10}`;
        labels.appendChild(label);
    }
    wrapper.appendChild(labels);
    
    // Board Grid
    const grid = document.createElement('div');
    grid.className = 'board-30';
    
    let nums = new Set();
    while (nums.size < 9) {
        nums.add(Math.floor(Math.random() * 30) + 1);
    }
    const numbers = Array.from(nums).sort((a, b) => a - b);
    
    for (let i = 0; i < 9; i++) {
        const cell = createBoardCell(type, Math.floor(i/3), i%3, numbers[i]);
        grid.appendChild(cell);
    }
    
    wrapper.appendChild(grid);
    board.appendChild(wrapper);
}

// Generate Pattern Board
function generatePatternBoard(type) {
    const board = document.getElementById('gameBoard');
    const wrapper = document.createElement('div');
    wrapper.className = 'board-pattern-wrapper';
    
    // BINGO Labels
    const labels = document.createElement('div');
    labels.className = 'board-pattern-labels';
    'BINGO'.split('').forEach(letter => {
        const label = document.createElement('div');
        label.className = 'board-pattern-label';
        label.textContent = letter;
        labels.appendChild(label);
    });
    wrapper.appendChild(labels);
    
    // Board Grid
    const grid = document.createElement('div');
    grid.className = 'board-pattern';
    
    const columnRanges = [[1,15], [16,30], [31,45], [46,60], [61,75]];
    const columnNumbers = columnRanges.map(range => {
        let nums = new Set();
        while (nums.size < 5) {
            nums.add(Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0]);
        }
        return Array.from(nums).sort((a, b) => a - b);
    });
    
    // Select random pattern
    const patternKeys = Object.keys(GAME_CONFIG.patterns);
    const pattern = patternKeys[Math.floor(Math.random() * patternKeys.length)];
    const patternCells = GAME_CONFIG.patterns[pattern];
    
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
            const cell = createBoardCell(type, row, col, columnNumbers[col][row]);
            
            if (patternCells.includes(`${row}-${col}`)) {
                cell.classList.add('pattern-cell');
            }
            
            grid.appendChild(cell);
        }
    }
    
    wrapper.appendChild(grid);
    board.appendChild(wrapper);
}

// Generate Coverall Board
function generateCoverallBoard(type) {
    const board = document.getElementById('gameBoard');
    const wrapper = document.createElement('div');
    wrapper.className = 'board-coverall-wrapper';
    
    // Column labels
    const labels = document.createElement('div');
    labels.className = 'board-coverall-labels';
    for (let i = 1; i <= 9; i++) {
        const label = document.createElement('div');
        label.className = 'board-coverall-label';
        label.textContent = `${(i-1)*10+1}-${i*10}`;
        labels.appendChild(label);
    }
    wrapper.appendChild(labels);
    
    // Board Grid
    const grid = document.createElement('div');
    grid.className = 'board-coverall';
    
    let allNumbers = Array.from({length: 90}, (_, i) => i + 1);
    allNumbers = shuffleArray(allNumbers).slice(0, 45);
    
    for (let i = 0; i < 45; i++) {
        const row = Math.floor(i / 9);
        const col = i % 9;
        const cell = createBoardCell(type, row, col, allNumbers[i]);
        grid.appendChild(cell);
    }
    
    wrapper.appendChild(grid);
    board.appendChild(wrapper);
}

// Create board cell
function createBoardCell(type, row, col, number) {
    const cell = document.createElement('button');
    cell.className = 'board-cell';
    cell.dataset.row = row;
    cell.dataset.column = col;
    
    if (type.id === '75ball' || type.id === '50ball' || type.id === 'pattern') {
        if (row === 2 && col === 2) {
            cell.textContent = '★';
            cell.classList.add('center-cell');
            cell.dataset.center = 'true';
            cell.onclick = () => {
                if (!cell.classList.contains('marked')) {
                    cell.classList.add('marked');
                }
            };
        } else {
            cell.textContent = number;
            cell.dataset.number = number;
            cell.onclick = () => toggleMark(cell, number);
        }
    } else {
        cell.textContent = number;
        cell.dataset.number = number;
        
        // Check if this is center cell
        if (type.id === '90ball' && row === 1 && col === 4) {
            cell.classList.add('center-cell');
        } else if (type.id === '30ball' && row === 1 && col === 1) {
            cell.classList.add('center-cell');
        } else if (type.id === 'coverall' && row === 2 && col === 4) {
            cell.classList.add('center-cell');
        }
        
        cell.onclick = () => toggleMark(cell, number);
    }
    
    return cell;
}

// Shuffle array
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Setup board interactions
function setupBoardInteractions() {
    // Mark/unmark numbers
    window.toggleMark = function(cell, number) {
        if (!window.gameState.gameActive) return;
        
        if (cell.classList.contains('marked')) {
            cell.classList.remove('marked');
            window.gameState.markedNumbers.delete(number);
        } else {
            cell.classList.add('marked');
            window.gameState.markedNumbers.add(number);
            
            // Send mark to server
            sendMessage({
                type: 'mark',
                playerId: window.gameState.playerId,
                number: number,
                marked: true
            });
        }
    };
}

// Start new game
export function startNewGame() {
    window.gameState.gameActive = true;
    window.gameState.calledNumbers = [];
    window.gameState.markedNumbers.clear();
    
    // Reset board
    const cells = document.querySelectorAll('.board-cell');
    cells.forEach(cell => {
        cell.classList.remove('marked');
    });
    
    // Start calling numbers
    sendMessage({
        type: 'start_game',
        playerId: window.gameState.playerId,
        gameType: window.gameState.gameType
    });
}

// Announce win
export function announceWin() {
    if (!window.gameState.gameActive) {
        showNotification('ጨዋታ አልጀመረም', true);
        return;
    }
    
    const win = calculateWin();
    if (win) {
        const winAmount = calculateWinAmount(win.pattern);
        
        sendMessage({
            type: 'win',
            playerId: window.gameState.playerId,
            pattern: win.pattern,
            amount: winAmount
        });
        
        showWinnerNotification(win.pattern, winAmount);
    } else {
        showNotification('አሸናፊ ንድፍ አልተጠናቀቀም። እባክዎ ይቆጥሩ!', true);
    }
}

// Calculate win
function calculateWin() {
    const gameType = window.gameState.gameType;
    const patterns = GAME_CONFIG.winMultipliers[gameType];
    
    if (!patterns) return null;
    
    for (const pattern in patterns) {
        if (checkPattern(pattern)) {
            return { pattern: pattern };
        }
    }
    
    return null;
}

// Check pattern
function checkPattern(pattern) {
    const cells = document.querySelectorAll('.board-cell:not(.blank-cell)');
    const markedCells = Array.from(cells).filter(cell => 
        cell.classList.contains('marked') || 
        (cell.classList.contains('center-cell') && 
         ['75ball', '50ball', 'pattern'].includes(window.gameState.gameType))
    );
    
    const markedPositions = new Set();
    markedCells.forEach(cell => {
        if (cell.dataset.row !== undefined && cell.dataset.column !== undefined) {
            markedPositions.add(`${cell.dataset.row}-${cell.dataset.column}`);
        }
    });
    
    // Pattern checking logic
    switch(pattern) {
        case 'row':
            return checkRows(markedPositions);
        case 'column':
            return checkColumns(markedPositions);
        case 'diagonal':
            return checkDiagonals(markedPositions);
        case 'four-corners':
            return checkFourCorners(markedPositions);
        case 'full-house':
            return checkFullHouse(markedPositions);
        case 'one-line':
            return checkOneLine(markedPositions);
        case 'two-lines':
            return checkTwoLines(markedPositions);
        case 'full-board':
            return checkFullBoard(markedPositions);
        default:
            return false;
    }
}

// Check rows
function checkRows(markedPositions) {
    const rows = window.gameState.gameType === '90ball' ? 3 : 5;
    const cols = window.gameState.gameType === '90ball' ? 9 : 5;
    
    for (let row = 0; row < rows; row++) {
        let complete = true;
        for (let col = 0; col < cols; col++) {
            if (!markedPositions.has(`${row}-${col}`)) {
                complete = false;
                break;
            }
        }
        if (complete) return true;
    }
    return false;
}

// Check columns
function checkColumns(markedPositions) {
    const rows = 5;
    const cols = 5;
    
    for (let col = 0; col < cols; col++) {
        let complete = true;
        for (let row = 0; row < rows; row++) {
            if (!markedPositions.has(`${row}-${col}`)) {
                complete = false;
                break;
            }
        }
        if (complete) return true;
    }
    return false;
}

// Check diagonals
function checkDiagonals(markedPositions) {
    let diag1Complete = true;
    let diag2Complete = true;
    
    for (let i = 0; i < 5; i++) {
        if (!markedPositions.has(`${i}-${i}`)) {
            diag1Complete = false;
        }
        if (!markedPositions.has(`${i}-${4-i}`)) {
            diag2Complete = false;
        }
    }
    
    return diag1Complete || diag2Complete;
}

// Check four corners
function checkFourCorners(markedPositions) {
    const corners = ['0-0', '0-4', '4-0', '4-4'];
    return corners.every(pos => markedPositions.has(pos));
}

// Check full house
function checkFullHouse(markedPositions) {
    const totalCells = window.gameState.gameType === '90ball' ? 15 : 25;
    return markedPositions.size >= totalCells;
}

// Check one line (90-ball)
function checkOneLine(markedPositions) {
    return checkRows(markedPositions);
}

// Check two lines (90-ball)
function checkTwoLines(markedPositions) {
    let lineCount = 0;
    const rows = 3;
    const cols = 9;
    
    for (let row = 0; row < rows; row++) {
        let complete = true;
        for (let col = 0; col < cols; col++) {
            if (!markedPositions.has(`${row}-${col}`)) {
                complete = false;
                break;
            }
        }
        if (complete) lineCount++;
    }
    
    return lineCount >= 2;
}

// Check full board (coverall)
function checkFullBoard(markedPositions) {
    return markedPositions.size >= 45;
}

// Calculate win amount
function calculateWinAmount(pattern) {
    const gameType = window.gameState.gameType;
    const multiplier = GAME_CONFIG.winMultipliers[gameType]?.[pattern] || 1;
    const baseWin = calculatePotentialWin(window.gameState.stake);
    
    return Math.floor(baseWin * multiplier);
}

// Show winner notification
function showWinnerNotification(pattern, amount) {
    const notification = document.createElement('div');
    notification.className = 'winner-notification';
    notification.innerHTML = `
        <div style="font-size: 32px; margin-bottom: 15px;">🎉 ቢንጎ! 🎉</div>
        <div class="amharic-text">${window.gameState.playerName}</div>
        <div class="amharic-text">${getPatternName(pattern)}</div>
        <div class="win-amount amharic-text">${formatCurrency(amount)}</div>
        <div style="margin: 15px 0; color: #ffd700;" class="amharic-text">አረጋግጧል ✓</div>
        <button class="control-btn btn-success" onclick="this.parentElement.remove()">እሺ</button>
    `;
    
    document.body.appendChild(notification);
}

// Get pattern name
function getPatternName(pattern) {
    const names = {
        'row': 'ረድፍ',
        'column': 'አምድ',
        'diagonal': 'ዲያግናል',
        'four-corners': 'አራት ማእዘኖች',
        'full-house': 'ሙሉ ቤት',
        'one-line': 'አንድ ረድፍ',
        'two-lines': 'ሁለት ረድፍ',
        'full-board': 'ሙሉ ቦርድ',
        'x-pattern': 'X ንድፍ',
        'frame': 'አውራ ቀለበት',
        'postage-stamp': 'ማህተም',
        'small-diamond': 'ዲያምንድ'
    };
    
    return names[pattern] || pattern;
}