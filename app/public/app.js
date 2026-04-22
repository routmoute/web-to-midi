const API_BASE = window.location.origin;
let lastButtons = null;

// Handle button clicks with event delegation
async function handleButtonClick(e) {
  if (!e.target.classList.contains('midi-button')) return;
  
  const id = e.target.dataset.id;
  try {
    await fetch(`${API_BASE}/api/buttons/${id}/play`, { method: 'POST' });
  } catch (err) {
    console.error('Error triggering MIDI:', err);
  }
}

async function loadButtons() {
  const container = document.getElementById('buttonsContainer');
  
  try {
    const response = await fetch(`${API_BASE}/api/buttons`);
    if (!response.ok) throw new Error('Failed to fetch buttons');
    
    const buttons = await response.json();
    
    // Compare with last state
    if (lastButtons && JSON.stringify(lastButtons) === JSON.stringify(buttons)) {
      return; // No changes, skip render
    }
    
    lastButtons = buttons;
    
    if (buttons.length === 0) {
      container.innerHTML = '<p class="loading">No buttons configured</p>';
      return;
    }
    
    // Inject dynamic styles for button colors (one style tag for all buttons)
    let buttonStyles = '';
    buttons.forEach(btn => {
      const color = (btn.color && /^#[0-9a-fA-F]{6}$/.test(btn.color)) ? btn.color : '#ff6b00';
      buttonStyles += `.midi-button[data-id="${btn.id}"] { background-color: ${color}; }\n`;
    });
    
    // Remove old style tag if it exists
    const oldStyle = document.getElementById('buttonColorsStyle');
    if (oldStyle) oldStyle.remove();
    
    // Create and inject new style tag
    const styleTag = document.createElement('style');
    styleTag.id = 'buttonColorsStyle';
    styleTag.textContent = buttonStyles;
    document.head.appendChild(styleTag);
    
    container.innerHTML = buttons.map(btn => `
      <button class="midi-button" data-id="${btn.id}">
        ${btn.name}
      </button>
    `).join('');
  } catch (err) {
    console.error('Error loading buttons:', err);
    container.innerHTML = `<div class="error">Error loading buttons: ${err.message}</div>`;
  }
}

// Load buttons on page load
document.addEventListener('DOMContentLoaded', () => {
  loadButtons();
  // Attach single event listener on container for all button clicks
  document.getElementById('buttonsContainer').addEventListener('click', handleButtonClick);
});

// Refresh buttons every 5 seconds with smart comparison
setInterval(loadButtons, 5000);
