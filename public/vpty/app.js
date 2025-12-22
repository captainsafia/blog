// State management
const state = {
    styles: {
        bold: false,
        dim: false,
        italic: false,
        underline: false,
        blink: false,
        reverse: false
    },
    fgColor: 'default',
    bgColor: 'default'
};

// ANSI code mappings
const ansiCodes = {
    styles: {
        bold: { on: 1, off: 22 },
        dim: { on: 2, off: 22 },
        italic: { on: 3, off: 23 },
        underline: { on: 4, off: 24 },
        blink: { on: 5, off: 25 },
        reverse: { on: 7, off: 27 }
    },
    fgColors: {
        black: 30,
        red: 31,
        green: 32,
        yellow: 33,
        blue: 34,
        magenta: 35,
        cyan: 36,
        white: 37,
        default: 39
    },
    bgColors: {
        black: 40,
        red: 41,
        green: 42,
        yellow: 43,
        blue: 44,
        magenta: 45,
        cyan: 46,
        white: 47,
        default: 49
    }
};

// Generate current ANSI sequence
function generateAnsiSequence() {
    const codes = [];
    
    // Add style codes
    for (const [style, enabled] of Object.entries(state.styles)) {
        if (enabled) {
            codes.push(ansiCodes.styles[style].on);
        }
    }
    
    // Add foreground color
    if (state.fgColor !== 'default') {
        codes.push(ansiCodes.fgColors[state.fgColor]);
    }
    
    // Add background color
    if (state.bgColor !== 'default') {
        codes.push(ansiCodes.bgColors[state.bgColor]);
    }
    
    if (codes.length === 0) {
        return null;
    }
    
    return `\\x1b[${codes.join(';')}m`;
}

// Update ANSI display
function updateAnsiDisplay() {
    const ansiDisplay = document.getElementById('ansiDisplay');
    const sequence = generateAnsiSequence();
    
    if (sequence) {
        const codes = sequence.match(/\[(.+)m/)[1].split(';');
        const styledCodes = codes.map(code => {
            const num = parseInt(code);
            let style = '';
            let color = '';
            
            // Style codes
            if (num === 1) style = 'font-weight: bold';
            else if (num === 2) style = 'opacity: 0.6';
            else if (num === 3) style = 'font-style: italic';
            else if (num === 4) style = 'text-decoration: underline';
            else if (num === 5) style = 'animation: blink 1s infinite';
            else if (num === 7) style = 'filter: invert(1)';
            
            // Foreground colors
            else if (num === 30) color = '#000000';
            else if (num === 31) color = '#ef4444';
            else if (num === 32) color = '#22c55e';
            else if (num === 33) color = '#eab308';
            else if (num === 34) color = '#3b82f6';
            else if (num === 35) color = '#a855f7';
            else if (num === 36) color = '#06b6d4';
            else if (num === 37) color = '#f5f5f5';
            
            // Background colors - show with background
            else if (num >= 40 && num <= 47) {
                const bgColors = {
                    40: '#000000', 41: '#ef4444', 42: '#22c55e', 43: '#eab308',
                    44: '#3b82f6', 45: '#a855f7', 46: '#06b6d4', 47: '#f5f5f5'
                };
                return `<span style="background-color: ${bgColors[num]}; color: white; padding: 2px 4px; border-radius: 3px;">${code}</span>`;
            }
            
            if (color) {
                return `<span style="color: ${color}; font-weight: 600;">${code}</span>`;
            } else if (style) {
                return `<span style="${style}">${code}</span>`;
            }
            return code;
        }).join('<span class="text-slate-400">;</span>');
        
        ansiDisplay.innerHTML = `
            <div class="space-y-2">
                <div>
                    <span class="text-slate-500 text-xs">Sequence:</span> 
                    <span class="text-slate-600">\\x1b[</span><span>${styledCodes}</span><span class="text-slate-600">m</span>
                </div>
            </div>
        `;
    } else {
        ansiDisplay.innerHTML = '<span class="text-slate-500">No styles applied</span>';
    }
}

// Convert ANSI to HTML styling
function ansiToHtml(text, ansiSequence) {
    let styles = [];
    let classes = [];
    
    // Parse ANSI codes
    const codes = ansiSequence ? ansiSequence.match(/\[(.+)m/)[1].split(';').map(Number) : [];
    
    for (const code of codes) {
        // Font styles
        if (code === 1) styles.push('font-weight: bold');
        else if (code === 2) styles.push('opacity: 0.6');
        else if (code === 3) styles.push('font-style: italic');
        else if (code === 4) styles.push('text-decoration: underline');
        else if (code === 5) styles.push('animation: blink 1s infinite');
        else if (code === 7) styles.push('filter: invert(1)');
        
        // Foreground colors
        else if (code === 30) styles.push('color: #000000');
        else if (code === 31) styles.push('color: #ef4444');
        else if (code === 32) styles.push('color: #22c55e');
        else if (code === 33) styles.push('color: #eab308');
        else if (code === 34) styles.push('color: #3b82f6');
        else if (code === 35) styles.push('color: #a855f7');
        else if (code === 36) styles.push('color: #06b6d4');
        else if (code === 37) styles.push('color: #f5f5f5');
        
        // Background colors
        else if (code === 40) styles.push('background-color: #000000');
        else if (code === 41) styles.push('background-color: #ef4444');
        else if (code === 42) styles.push('background-color: #22c55e');
        else if (code === 43) styles.push('background-color: #eab308');
        else if (code === 44) styles.push('background-color: #3b82f6');
        else if (code === 45) styles.push('background-color: #a855f7');
        else if (code === 46) styles.push('background-color: #06b6d4');
        else if (code === 47) styles.push('background-color: #f5f5f5');
    }
    
    return `<span style="${styles.join('; ')}">${escapeHtml(text)}</span>`;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// State to track cursor position
let cursorPosition = 0; // Position in text content
let minCursorPosition = 0; // Minimum position cursor can move to (after welcome message)

// Add or update cursor at specific position
function updateCursor(position = null) {
    const terminal = document.getElementById('terminal');
    
    // Remove existing cursor and restore its character to the text
    const existingCursor = terminal.querySelector('.terminal-cursor, .terminal-cursor-empty');
    if (existingCursor) {
        // Only restore the character if it's not the empty cursor
        if (existingCursor.classList.contains('terminal-cursor')) {
            const charInCursor = existingCursor.textContent;
            const textNode = document.createTextNode(charInCursor);
            existingCursor.parentNode.replaceChild(textNode, existingCursor);
        } else {
            // Empty cursor, just remove it
            existingCursor.remove();
        }
    }
    
    // If position is specified, update cursor position
    if (position !== null) {
        cursorPosition = Math.max(position, minCursorPosition);
    } else {
        // Default to end of content
        cursorPosition = terminal.textContent.length;
    }
    
    // Get all text nodes and find where to insert cursor
    const walker = document.createTreeWalker(
        terminal,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    let currentPos = 0;
    let targetNode = null;
    let offsetInNode = 0;
    
    while (walker.nextNode()) {
        const nodeLength = walker.currentNode.textContent.length;
        if (currentPos + nodeLength > cursorPosition) {
            targetNode = walker.currentNode;
            offsetInNode = cursorPosition - currentPos;
            break;
        }
        currentPos += nodeLength;
    }
    
    // Create cursor element
    const cursor = document.createElement('span');
    
    if (targetNode) {
        // Insert cursor at the position within the text node
        const beforeText = targetNode.textContent.substring(0, offsetInNode);
        const charAtCursor = targetNode.textContent.charAt(offsetInNode);
        const afterText = targetNode.textContent.substring(offsetInNode + 1);
        
        if (charAtCursor) {
            // Cursor overlays a character
            cursor.className = 'terminal-cursor';
            cursor.textContent = charAtCursor;
        } else {
            // Cursor at end of content (no character to overlay)
            cursor.className = 'terminal-cursor-empty';
            cursor.innerHTML = '&nbsp;';
        }
        
        const beforeNode = document.createTextNode(beforeText);
        const afterNode = document.createTextNode(afterText);
        
        targetNode.parentNode.insertBefore(beforeNode, targetNode);
        targetNode.parentNode.insertBefore(cursor, targetNode);
        if (afterText) {
            targetNode.parentNode.insertBefore(afterNode, targetNode);
        }
        targetNode.remove();
    } else {
        // Add cursor at the end (no character to overlay)
        cursor.className = 'terminal-cursor-empty';
        cursor.innerHTML = '&nbsp;';
        terminal.appendChild(cursor);
    }
}

// Apply text to terminal
function applyText() {
    const textInput = document.getElementById('textInput');
    const terminal = document.getElementById('terminal');
    const text = textInput.value;
    
    if (!text) return;
    
    const ansiSequence = generateAnsiSequence();
    const html = ansiToHtml(text, ansiSequence);
    
    // Remove cursor and restore its character before adding text
    const cursor = terminal.querySelector('.terminal-cursor, .terminal-cursor-empty');
    if (cursor) {
        // Only restore the character if it's not the empty cursor
        if (cursor.classList.contains('terminal-cursor')) {
            const charInCursor = cursor.textContent;
            const textNode = document.createTextNode(charInCursor);
            cursor.parentNode.replaceChild(textNode, cursor);
        } else {
            // Empty cursor, just remove it
            cursor.remove();
        }
    }
    
    terminal.innerHTML += html;
    textInput.value = '';
    
    // Re-add cursor
    updateCursor();
}

// Toggle style
function toggleStyle(style) {
    state.styles[style] = !state.styles[style];
    
    const btn = document.getElementById(`btn-${style}`);
    if (state.styles[style]) {
        btn.classList.add('bg-cyan-100', 'border-cyan-500', 'text-cyan-700', 'shadow-md');
        btn.classList.remove('bg-white', 'hover:bg-slate-200', 'border-slate-300', 'text-slate-700');
    } else {
        btn.classList.remove('bg-cyan-100', 'border-cyan-500', 'text-cyan-700', 'shadow-md');
        btn.classList.add('bg-white', 'hover:bg-slate-200', 'border-slate-300', 'text-slate-700');
    }
    
    updateAnsiDisplay();
}

// Set foreground color
function setFgColor(color) {
    state.fgColor = color;
    updateAnsiDisplay();
}

// Set background color
function setBgColor(color) {
    state.bgColor = color;
    updateAnsiDisplay();
}

// Clear terminal
function clearTerminal() {
    const terminal = document.getElementById('terminal');
    terminal.innerHTML = '<span style="color: #06b6d4">Explore ANSI codes!</span>\n<span style="color: #a8dadc">Try setting styles and colors, then type some text to see ANSI codes in action. Use the arrow keys to move around the terminal.</span>\n\n';
    minCursorPosition = terminal.textContent.length;
    updateCursor();
}

// Helper function to show ANSI popup
function showAnsiPopup(buttonId, text) {
    const button = document.getElementById(buttonId);
    const popup = document.createElement('div');
    popup.className = 'ansi-popup';
    popup.textContent = text;
    button.appendChild(popup);
    
    // Remove popup after animation
    setTimeout(() => {
        popup.remove();
    }, 1000);
}

// Add newline
function addNewline() {
    const terminal = document.getElementById('terminal');
    // Remove cursor and restore its character before adding newline
    const cursor = terminal.querySelector('.terminal-cursor, .terminal-cursor-empty');
    if (cursor) {
        // Only restore the character if it's not the empty cursor
        if (cursor.classList.contains('terminal-cursor')) {
            const charInCursor = cursor.textContent;
            const textNode = document.createTextNode(charInCursor);
            cursor.parentNode.replaceChild(textNode, cursor);
        } else {
            // Empty cursor, just remove it
            cursor.remove();
        }
    }
    terminal.innerHTML += '\n';
    // Re-add cursor
    updateCursor();
    showAnsiPopup('btn-newline', '\\n (newline)');
}

// Get lines from terminal content
function getTerminalLines() {
    const terminal = document.getElementById('terminal');
    const text = terminal.textContent.replace(/\u00A0/g, ' '); // Replace nbsp with space
    return text.split('\n');
}

// Get current cursor line and column
function getCursorLineCol() {
    const lines = getTerminalLines();
    let pos = 0;
    
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const lineLength = lines[lineNum].length;
        if (pos + lineLength >= cursorPosition) {
            return {
                line: lineNum,
                col: cursorPosition - pos,
                totalLines: lines.length
            };
        }
        pos += lineLength + 1; // +1 for newline
    }
    
    return { line: lines.length - 1, col: lines[lines.length - 1].length, totalLines: lines.length };
}

// Calculate position from line and column
function getPositionFromLineCol(line, col) {
    const lines = getTerminalLines();
    let pos = 0;
    
    for (let i = 0; i < line && i < lines.length; i++) {
        pos += lines[i].length + 1; // +1 for newline
    }
    
    return pos + Math.min(col, lines[line]?.length || 0);
}

// Move cursor up
function moveCursorUp() {
    const { line, col } = getCursorLineCol();
    
    if (line > 0) {
        const newPos = getPositionFromLineCol(line - 1, col);
        updateCursor(newPos);
    }
    // else: no-op if already at top
    
    showAnsiPopup('btn-cursor-up', '\\x1b[A (cursor up)');
}

// Move cursor down
function moveCursorDown() {
    const { line, col, totalLines } = getCursorLineCol();
    
    if (line < totalLines - 1) {
        const newPos = getPositionFromLineCol(line + 1, col);
        updateCursor(newPos);
    }
    // else: no-op if already at bottom
    
    showAnsiPopup('btn-cursor-down', '\\x1b[B (cursor down)');
}

// Move cursor left
function moveCursorLeft() {
    const { line, col } = getCursorLineCol();
    const terminal = document.getElementById('terminal');
    const text = terminal.textContent;
    
    // Check if we're at the beginning of a line
    if (col === 0) {
        // At beginning of line, don't move
        showAnsiPopup('btn-cursor-left', '\\x1b[D (cursor left)');
        return;
    }
    
    // Check if we can move (not at minimum position and previous char is not newline)
    if (cursorPosition > minCursorPosition) {
        const prevChar = text.charAt(cursorPosition - 1);
        if (prevChar !== '\n') {
            updateCursor(cursorPosition - 1);
        }
    }
    
    showAnsiPopup('btn-cursor-left', '\\x1b[D (cursor left)');
}

// Move cursor right
function moveCursorRight() {
    const terminal = document.getElementById('terminal');
    const text = terminal.textContent;
    const maxPos = text.length;
    const { line, col } = getCursorLineCol();
    const lines = getTerminalLines();
    const currentLineLength = lines[line]?.length || 0;
    
    // Check if we're at the end of the current line
    if (col >= currentLineLength) {
        // At end of line, don't move
        showAnsiPopup('btn-cursor-right', '\\x1b[C (cursor right)');
        return;
    }
    
    // Check if next character is a newline
    if (cursorPosition < maxPos) {
        const nextChar = text.charAt(cursorPosition);
        if (nextChar !== '\n') {
            updateCursor(cursorPosition + 1);
        }
    }
    
    showAnsiPopup('btn-cursor-right', '\\x1b[C (cursor right)');
}

// Trigger bell (visual flash)
function triggerBell() {
    const terminal = document.getElementById('terminal');
    
    // Add flash animation
    terminal.classList.add('terminal-flashing');
    
    // Remove animation class after it completes
    setTimeout(() => {
        terminal.classList.remove('terminal-flashing');
    }, 300);
    
    // Show popup with bell ANSI code
    showAnsiPopup('btn-bell', '\\x07 or \\a (bell)');
}

// Reset all styles
function resetStyles() {
    // Reset state
    for (const style in state.styles) {
        state.styles[style] = false;
        const btn = document.getElementById(`btn-${style}`);
        btn.classList.remove('bg-cyan-100', 'border-cyan-500', 'text-cyan-700', 'shadow-md');
        btn.classList.add('bg-white', 'hover:bg-slate-200', 'border-slate-300', 'text-slate-700');
    }
    
    state.fgColor = 'default';
    state.bgColor = 'default';
    
    // Apply reset sequence to terminal
    const terminal = document.getElementById('terminal');
    terminal.innerHTML += '<span style="all: revert"></span>';
    
    updateAnsiDisplay();
}

// Add blink animation
const style = document.createElement('style');
style.textContent = `
    @keyframes blink {
        0%, 49% { opacity: 1; }
        50%, 100% { opacity: 0; }
    }
`;
document.head.appendChild(style);

// Add Enter key support for text input
document.getElementById('textInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        applyText();
    }
});

// Initialize display
updateAnsiDisplay();

// Welcome message constant
const WELCOME_MESSAGE = '<span style="color: #06b6d4">Explore ANSI codes!</span>\n<span style="color: #a8dadc">Try setting styles and colors, then type some text to see ANSI codes in action. Use the arrow keys to move around the terminal.</span>\n\n';

// Add welcome message
document.addEventListener('DOMContentLoaded', function() {
    const terminal = document.getElementById('terminal');
    terminal.innerHTML = WELCOME_MESSAGE;
    minCursorPosition = terminal.textContent.length;
    updateCursor();
});
