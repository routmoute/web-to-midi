// Track unsaved changes
let buttons = []
let projectDirty = false

// Sync project dirty state to main process
function setProjectDirty(dirty) {
  projectDirty = dirty
  window.electronAPI.setProjectDirty(dirty)
}

// Helper to escape HTML and prevent XSS
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]))
}

// Apply translations to the DOM
function applyTranslations(lang = null) {
  const currentLang = lang || getCurrentLanguage()
  
  // Translate text content
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n')
    element.textContent = t(key, currentLang)
  })
  
  // Translate placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder')
    element.placeholder = t(key, currentLang)
  })
  
  // Translate select options
  document.querySelectorAll('option[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n')
    element.textContent = t(key, currentLang)
  })
}

// Helper to attach modal event handlers with cleanup
function attachModalHandlers(confirmBtn, cancelBtn, onConfirm, onCancel) {
  const handleKeydown = (e) => {
    if (e.key === 'Enter') onConfirm()
    if (e.key === 'Escape') onCancel()
  }
  
  const cleanup = () => {
    confirmBtn.removeEventListener('click', onConfirm)
    cancelBtn.removeEventListener('click', onCancel)
    document.removeEventListener('keydown', handleKeydown)
  }
  
  confirmBtn.addEventListener('click', onConfirm)
  cancelBtn.addEventListener('click', onCancel)
  document.addEventListener('keydown', handleKeydown)
  
  return cleanup
}

// Show confirmation modal
function showConfirm(message) {
  return new Promise((resolve) => {
    const currentLang = getCurrentLanguage()
    const modal = document.getElementById('confirmModal')
    const messageEl = document.getElementById('confirmMessage')
    const yesBtn = document.getElementById('confirmYes')
    const noBtn = document.getElementById('confirmNo')
    
    messageEl.textContent = message
    yesBtn.textContent = t('yes', currentLang)
    noBtn.textContent = t('no', currentLang)
    modal.style.display = 'flex'
    
    let cleanup
    const handleYes = () => {
      modal.style.display = 'none'
      cleanup()
      resolve(true)
    }
    
    const handleNo = () => {
      modal.style.display = 'none'
      cleanup()
      resolve(false)
    }
    
    cleanup = attachModalHandlers(yesBtn, noBtn, handleYes, handleNo)
  })
}

// Show toast notification (silent, auto-dismiss)
function showToast(message, duration = 2000) {
  const container = document.getElementById('toastContainer')
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = message
  
  container.appendChild(toast)
  
  // Auto-dismiss
  setTimeout(() => {
    toast.classList.add('fade-out')
    setTimeout(() => toast.remove(), 300)
  }, duration)
}

// Show edit modal
function showEditModal(buttonId) {
  const button = buttons.find(b => b.id === buttonId)
  if (!button) return
  
  const currentLang = getCurrentLanguage()
  const modal = document.getElementById('editModal')
  const nameInput = document.getElementById('editNameInput')
  const commandInput = document.getElementById('editCommandInput')
  const channelInput = document.getElementById('editChannelInput')
  const data1Input = document.getElementById('editData1Input')
  const data2Input = document.getElementById('editData2Input')
  const colorInput = document.getElementById('editColorInput')
  const saveBtn = document.getElementById('editSave')
  const cancelBtn = document.getElementById('editCancel')
  
  saveBtn.textContent = t('ok', currentLang)
  cancelBtn.textContent = t('cancel', currentLang)
  nameInput.value = button.name
  commandInput.value = button.command
  channelInput.value = button.channel + 1
  data1Input.value = button.data1
  data2Input.value = button.data2
  colorInput.value = button.color || '#ff6b00'
  modal.style.display = 'flex'
  nameInput.focus()
  updateModalLabels()
  updateChannelLabel()
  updateDataLabels(button.command, 'modal')
  
  let cleanup
  const handleSave = () => {
    const newName = nameInput.value.trim()
    const newCommand = commandInput.value
    const newChannel = parseInt(channelInput.value)
    const newData1 = parseInt(data1Input.value)
    const newData2 = parseInt(data2Input.value)
    const newColor = colorInput.value || '#ff6b00'
    
    // Validation with user feedback
    if (!newName) {
      alert(t('buttonNameRequired', currentLang) || 'Button name is required')
      return
    }
    if (!newCommand) {
      alert(t('commandRequired', currentLang) || 'Command is required')
      return
    }
    if (isNaN(newChannel) || newChannel < 1 || newChannel > 16) {
      alert(`${t('midiChannelLabel', currentLang) || 'Channel'} ${t('mustBe', currentLang) || 'must be'} 1-16`)
      return
    }
    if (isNaN(newData1) || !isValidData1(newCommand, newData1)) {
      alert(`${t('paramValue', currentLang) || 'Value'} ${t('invalid', currentLang) || 'is invalid'}`)
      return
    }
    if (isNaN(newData2) || newData2 < 0 || newData2 > 127) {
      alert(`${t('paramValue', currentLang) || 'Value'} ${t('invalid', currentLang) || 'is invalid'}`)
      return
    }
    
    button.name = newName
    button.command = newCommand
    button.channel = newChannel - 1  // Store 0-15 internally
    button.data1 = newData1
    button.data2 = newData2
    button.color = newColor
    setProjectDirty(true)
    renderButtons()
    modal.style.display = 'none'
    cleanup()
  }
  
  const handleCancel = () => {
    modal.style.display = 'none'
    cleanup()
  }
  
  cleanup = attachModalHandlers(saveBtn, cancelBtn, handleSave, handleCancel)
}

// MIDI command parameters map
const midiCommandParams = {
  noteOn: { data1: 'paramNote', data2: 'paramVelocity' },
  noteOff: { data1: 'paramNote', data2: 'paramVelocity' },
  keyPressure: { data1: 'paramNote', data2: 'paramPressure' },
  controlChange: { data1: 'paramController', data2: 'paramValue' },
  programChange: { data1: 'paramProgram', data2: null },
  channelPressure: { data1: 'paramPressure', data2: null },
  pitchBend: { data1: 'paramPitchBend', data2: null } // 14-bit value in data1 (0-16383)
}

// Update labels based on command
// Format button info with dynamic parameter labels
function formatButtonInfo(btn) {
  const currentLang = getCurrentLanguage()
  const params = midiCommandParams[btn.command]
  
  if (!params) return `Ch: ${btn.channel + 1}`
  
  const commandName = t(btn.command, currentLang)
  let info = `${commandName} | Ch: ${btn.channel + 1}`
  
  if (params.data1) {
    const label = t(params.data1, currentLang)
    info += ` | ${label}: ${btn.data1}`
  }
  
  if (params.data2) {
    const label = t(params.data2, currentLang)
    info += ` | ${label}: ${btn.data2}`
  }
  
  return info
}

function updateDataLabels(command, context = 'both') {
  const currentLang = getCurrentLanguage()
  const params = midiCommandParams[command]
  
  if (!params) return
  
  // Helper: Update a label with min-max range
  const updateLabelWithRange = (labelEl, translationKey, fallbackKey, addColon = false) => {
    if (!labelEl) return
    const baseText = t(translationKey || fallbackKey, currentLang)
    const max = command === 'pitchBend' ? 16383 : 127
    const labelText = baseText.includes('(') ? baseText : `${baseText} (0-${max})`
    labelEl.textContent = addColon && !labelText.endsWith(':') ? labelText + ':' : labelText
  }
  
  // Helper: Update input max and clamp value
  const updateInputRange = (inputEl) => {
    if (!inputEl) return
    const max = command === 'pitchBend' ? 16383 : 127
    inputEl.max = max.toString()
    inputEl.value = Math.min(parseInt(inputEl.value) || 0, max)
  }
  
  // Helper: Toggle data2 visibility and state
  const updateData2State = (context, data2LabelEl, data2InputEl, data2WrapperEl) => {
    if (params.data2) {
      // Data2 is used for this command
      if (context === 'form') {
        if (data2LabelEl) {
          const baseText = t(params.data2, currentLang)
          data2LabelEl.textContent = baseText.includes('(') ? baseText : `${baseText} (0-127)`
        }
        if (data2InputEl) data2InputEl.disabled = false
      } else {
        // Modal context
        if (data2WrapperEl) data2WrapperEl.style.display = 'block'
        if (data2LabelEl) {
          const baseText = t(params.data2, currentLang)
          const labelText = baseText.includes('(') ? baseText : `${baseText} (0-127)`
          data2LabelEl.textContent = labelText.endsWith(':') ? labelText : labelText + ':'
        }
      }
    } else {
      // Data2 is not used for this command
      if (context === 'form') {
        if (data2LabelEl) {
          const baseText = t('buttonData2Label', currentLang)
          data2LabelEl.textContent = baseText.includes('(') ? baseText : `${baseText} (0-127)`
        }
        if (data2InputEl) data2InputEl.disabled = true
      } else {
        // Modal context
        if (data2WrapperEl) data2WrapperEl.style.display = 'none'
      }
    }
  }
  
  // Update form labels (Create button section)
  if (context === 'form' || context === 'both') {
    const data1Label = document.querySelector('label[for="buttonData1"]')
    const data1Input = document.getElementById('buttonData1')
    const data2Label = document.querySelector('label[for="buttonData2"]')
    const data2Input = document.getElementById('buttonData2')
    
    updateLabelWithRange(data1Label, params.data1, 'buttonData1Label')
    updateInputRange(data1Input)
    updateData2State('form', data2Label, data2Input)
  }
  
  // Update modal labels (Edit button section)
  if (context === 'modal' || context === 'both') {
    const editData1Label = document.querySelector('label[for="editData1Input"]')
    const editData1Input = document.getElementById('editData1Input')
    const editData2Wrapper = document.getElementById('editData2Wrapper')
    const editData2Label = document.querySelector('label[for="editData2Input"]')
    
    updateLabelWithRange(editData1Label, params.data1, 'editData1Label', true)
    updateInputRange(editData1Input)
    updateData2State('modal', editData2Label, null, editData2Wrapper)
  }
}

// Update modal labels with colons
function updateModalLabels() {
  const currentLang = getCurrentLanguage()
  const editNameLabel = document.querySelector('label[for="editNameInput"]')
  const editCommandLabel = document.querySelector('label[for="editCommandInput"]')
  
  if (editNameLabel) {
    const baseText = t('editNameLabel', currentLang)
    editNameLabel.textContent = baseText.endsWith(':') ? baseText : baseText + ':'
  }
  
  if (editCommandLabel) {
    const baseText = t('editCommandLabel', currentLang)
    editCommandLabel.textContent = baseText.endsWith(':') ? baseText : baseText + ':'
  }
}

// Update channel label with range (1-16)
function updateChannelLabel() {
  const currentLang = getCurrentLanguage()
  const formChannelLabel = document.querySelector('label[for="buttonChannel"]')
  const modalChannelLabel = document.querySelector('label[for="editChannelInput"]')
  
  if (formChannelLabel) {
    const baseText = t('midiChannelLabel', currentLang)
    const labelText = baseText.includes('(') ? baseText : `${baseText} (1-16)`
    formChannelLabel.textContent = labelText
  }
  
  if (modalChannelLabel) {
    const baseText = t('midiChannelLabel', currentLang)
    const labelText = baseText.includes('(') ? baseText : `${baseText} (1-16)`
    modalChannelLabel.textContent = labelText.endsWith(':') ? labelText : labelText + ':'
  }
}

// Validate data1 range based on command
function isValidData1(command, value) {
  if (command === 'pitchBend') {
    return value >= 0 && value <= 16383
  }
  return value >= 0 && value <= 127
}

// Get max value for data1 based on command
function getMaxData1(command) {
  return command === 'pitchBend' ? 16383 : 127
}

// Add button
function addButton() {
  const nameInput = document.getElementById('buttonName')
  const commandInput = document.getElementById('buttonCommand')
  const channelInput = document.getElementById('buttonChannel')
  const data1Input = document.getElementById('buttonData1')
  const data2Input = document.getElementById('buttonData2')
  const colorInput = document.getElementById('buttonColor')
  
  const name = nameInput.value.trim()
  const command = commandInput.value
  const channel = parseInt(channelInput.value)
  const data1 = parseInt(data1Input.value)
  const data2 = parseInt(data2Input.value)
  const color = colorInput.value || '#ff6b00'
  
  // Validate inputs
  if (!name || !command || isNaN(data1) || !isValidData1(command, data1) || 
      isNaN(data2) || data2 < 0 || data2 > 127 || isNaN(channel) || channel < 1 || channel > 16) {
    return
  }
  
  buttons.push({
    id: Date.now(),
    name,
    command,
    channel: channel - 1,  // Store 0-15 internally
    data1,
    data2,
    color
  })
  
  setProjectDirty(true)
  renderButtons()
}

// Delete button
async function deleteButton(id) {
  const numId = parseInt(id)
  const buttonIndex = buttons.findIndex(b => b.id === numId)
  if (buttonIndex === -1) return
  
  const button = buttons[buttonIndex]
  const currentLang = getCurrentLanguage()
  const template = t('confirmDeleteMessage', currentLang)
  const confirmMsg = template.replace('{name}', button.name)
  const confirmed = await showConfirm(confirmMsg)
  if (confirmed) {
    buttons.splice(buttonIndex, 1)
    setProjectDirty(true)
    renderButtons()
  }
}

// Edit button
function editButton(id) {
  showEditModal(parseInt(id))
}

// Clear all buttons
async function clearAllButtons() {
  const currentLang = getCurrentLanguage()
  const confirmMsg = t('confirmResetMessage', currentLang)
  const confirmed = await showConfirm(confirmMsg)
  if (confirmed) {
    buttons.length = 0
    setProjectDirty(true)
    renderButtons()
  }
}

// Render buttons
function renderButtons() {
  const grid = document.getElementById('buttonsGrid')
  const currentLang = getCurrentLanguage()
  
  if (buttons.length === 0) {
    grid.innerHTML = `<p class="empty-message" data-i18n="emptyMessage">${t('emptyMessage', currentLang)}</p>`
    syncButtonsWithServer()
    return
  }
  
  // Inject dynamic styles for button colors (one style tag for all buttons)
  let buttonStyles = ''
  buttons.forEach(btn => {
    const color = (btn.color && /^#[0-9a-fA-F]{6}$/.test(btn.color)) ? btn.color : '#ff6b00'
    buttonStyles += `.midi-button[data-id="${btn.id}"] { background-color: ${color}; }\n`
  })
  
  // Remove old style tag if it exists
  const oldStyle = document.getElementById('buttonColorsStyle')
  if (oldStyle) oldStyle.remove()
  
  // Create and inject new style tag
  const styleTag = document.createElement('style')
  styleTag.id = 'buttonColorsStyle'
  styleTag.textContent = buttonStyles
  document.head.appendChild(styleTag)
  
  grid.innerHTML = buttons.map(btn => {
    return `
    <div class="button-item">
      <button class="midi-button" data-action="play" data-id="${btn.id}">${escapeHtml(btn.name)}</button>
      <div class="button-actions">
        <button class="edit-btn" data-action="edit" data-id="${btn.id}">${t('editButton', currentLang)}</button>
        <button class="delete-btn" data-action="delete" data-id="${btn.id}">×</button>
      </div>
      <div class="button-info">${escapeHtml(formatButtonInfo(btn))}</div>
    </div>
  `}).join('')
  
  syncButtonsWithServer()
}

// Play MIDI data
function playNote(buttonId) {
  const button = buttons.find(b => b.id === parseInt(buttonId))
  if (!button) return
  
  let data1 = button.data1
  let data2 = button.data2
  
  // Handle Pitch Bend 14-bit value (split into MSB and LSB)
  if (button.command === 'pitchBend') {
    const value = button.data1 // 0-16383
    data1 = (value >> 7) & 0x7F // 7 most significant bits
    data2 = value & 0x7F         // 7 least significant bits
  }
  
  console.log(`Playing: ${button.name} | Command: ${button.command} | Channel: ${button.channel + 1} | Data1: ${data1} | Data2: ${data2}`)
  
  window.electronAPI.playNote({
    command: button.command,
    channel: button.channel,
    data1: data1,
    data2: data2
  }).catch(err => {
    console.error('Failed to play data:', err)
  })
}

// Sync buttons with web server
async function syncButtonsWithServer() {
  try {
    await window.electronAPI.syncButtons(buttons)
  } catch (err) {
    console.error('Failed to sync buttons with server:', err)
  }
}

// Save project
async function saveProject() {
  try {
    const result = await window.electronAPI.saveProjectDialog()
    if (result.success) {
      setProjectDirty(false)
      showToast(t('projectSaved', getCurrentLanguage()) || 'Project saved successfully !')
    } else if (result.error !== 'Save canceled') {
      alert(`${t('error', getCurrentLanguage()) || 'Error'}: ${result.error}`)
    }
  } catch (err) {
    console.error('Failed to save project:', err)
    alert(`${t('error', getCurrentLanguage()) || 'Error'}: ${err.message || 'Failed to save project'}`)
  }
}

// Load project
async function loadProject() {
  const confirmed = await showConfirm(t('confirmLoadMessage', getCurrentLanguage()) || 'Load the project ? (Current buttons will be replaced)')
  if (!confirmed) return
  
  try {
    const result = await window.electronAPI.loadProjectDialog()
    if (result.success) {
      buttons = result.buttons || []
      renderButtons()
      setProjectDirty(false)
      showToast(t('projectLoaded', getCurrentLanguage()) || 'Project loaded successfully !')
    } else if (result.error !== 'Open canceled') {
      alert(`${t('error', getCurrentLanguage()) || 'Error'}: ${result.error}`)
    }
  } catch (err) {
    console.error('Failed to load project:', err)
    alert(`${t('error', getCurrentLanguage()) || 'Error'}: ${err.message || 'Failed to load project'}`)
  }
}

// New project
async function newProject() {
  const confirmed = await showConfirm(t('confirmNewProjectMessage', getCurrentLanguage()) || 'Create a new project ? (Current buttons will be deleted)')
  if (!confirmed) return
  
  try {
    buttons = []
    await window.electronAPI.newProject()
    setProjectDirty(false)
    renderButtons()
  } catch (err) {
    console.error('Failed to create new project:', err)
  }
}

// Load project from a specific file path (used for .w2m file associations)
async function loadProjectFromPath(filePath) {
  try {
    // Check for unsaved changes first
    if (projectDirty) {
      const confirmed = await showConfirm(t('confirmLoadMessage', getCurrentLanguage()) || 'Load the project ? (Current buttons will be replaced)')
      if (!confirmed) return
    }
    
    const result = await window.electronAPI.openFile(filePath)
    if (result.success) {
      buttons = result.buttons || []
      renderButtons()
      setProjectDirty(false)
      const fileName = filePath.split('/').pop() || filePath
      showToast(t('projectLoaded', getCurrentLanguage()) || 'Project loaded successfully !')
    } else if (result.error) {
      alert(`${t('error', getCurrentLanguage()) || 'Error'}: ${result.error}`)
    }
  } catch (err) {
    console.error('Failed to load project from path:', err)
    alert(`${t('error', getCurrentLanguage()) || 'Error'}: ${err.message || 'Failed to load project'}`)
  }
}

// Handle grid actions with event delegation
// Track grid listener to avoid duplicates
let currentGridListener = null

function setupGridListener() {
  const grid = document.getElementById('buttonsGrid')
  if (!grid) return
  
  // Remove old listener if exists to prevent memory leak
  if (currentGridListener) {
    grid.removeEventListener('click', currentGridListener)
  }
  
  currentGridListener = (e) => {
    const action = e.target.getAttribute('data-action')
    if (action === 'play') {
      playNote(e.target.getAttribute('data-id'))
    } else if (action === 'edit') {
      editButton(e.target.getAttribute('data-id'))
    } else if (action === 'delete') {
      deleteButton(e.target.getAttribute('data-id'))
    }
  }
  
  grid.addEventListener('click', currentGridListener)
}

// Listen for save-before-exit request from main process
window.electronAPI.onSaveBeforeExit(() => {
  // Call saveProject and notify main when complete
  saveProject().then(() => {
    window.electronAPI.notifySaveComplete()
  }).catch(err => {
    console.error('Error saving before exit:', err)
    // Still notify to allow exit
    window.electronAPI.notifySaveComplete()
  })
})

// Listen for .w2m files opened externally
window.electronAPI.onLoadFile((filePath) => {
  console.log(`Loading file from external open: ${filePath}`)
  loadProjectFromPath(filePath)
})

// Load and display MIDI devices
async function loadMidiDevices() {
  try {
    const devices = await window.electronAPI.getMidiDevices()
    const midiDeviceSelect = document.getElementById('midiDevice')
    
    if (!midiDeviceSelect) {
      console.warn('MIDI device select element not found')
      return
    }
    
    // Clear existing options (except placeholder)
    while (midiDeviceSelect.options.length > 1) {
      midiDeviceSelect.remove(1)
    }
    
    // Add devices
    if (devices.length === 0) {
      const option = document.createElement('option')
      option.value = ''
      option.textContent = t('noMidiDevices', getCurrentLanguage()) || 'No MIDI devices found'
      option.disabled = true
      midiDeviceSelect.appendChild(option)
    } else {
      devices.forEach(device => {
        const option = document.createElement('option')
        option.value = device.id
        option.textContent = device.name
        midiDeviceSelect.appendChild(option)
      })
      
      // Auto-select first device if available
      if (devices.length > 0) {
        midiDeviceSelect.value = devices[0].id
        selectMidiDevice(devices[0].id)
      }
    }
  } catch (err) {
    console.error('Failed to load MIDI devices:', err)
  }
}

// Select a MIDI device
async function selectMidiDevice(deviceId) {
  try {
    const result = await window.electronAPI.setMidiDevice(parseInt(deviceId))
    if (result.success) {
      console.log(`Selected MIDI device: ${result.deviceName}`)
      showToast(`MIDI Device: ${result.deviceName}`)
    } else {
      console.error('Failed to select MIDI device')
      showToast('Failed to select MIDI device', 3000)
    }
  } catch (err) {
    console.error('Error selecting MIDI device:', err)
  }
}

// Update server status display
async function updateServerStatus() {
  try {
    const status = await window.electronAPI.getServerStatus()
    const statusDiv = document.getElementById('serverStatus')
    const checkbox = document.getElementById('serverEnabled')
    const portInput = document.getElementById('serverPort')
    const currentLang = getCurrentLanguage()
    
    // Update checkbox state
    checkbox.checked = status.running
    
    // Update port input - disable if server is running
    portInput.value = status.port
    portInput.disabled = status.running
    
    // Update status text
    if (status.running) {
      statusDiv.innerHTML = `<p class="server-info">${t('serverRunning', currentLang).replace('{port}', status.port)}</p>`
    } else {
      statusDiv.innerHTML = `<p class="server-info">${t('serverStopped', currentLang)}</p>`
    }
  } catch (err) {
    console.error('Error updating server status:', err)
  }
}

// Toggle server
async function toggleServer() {
  try {
    const checkbox = document.getElementById('serverEnabled')
    const portInput = document.getElementById('serverPort')
    const port = parseInt(portInput.value)
    const currentLang = getCurrentLanguage()
    
    if (checkbox.checked) {
      const result = await window.electronAPI.startServer(port)
      if (result.success) {
        showToast(t('serverRunning', currentLang).replace('{port}', result.port))
      } else {
        checkbox.checked = false
        alert(`${t('serverError', currentLang).replace('{error}', result.error)}`)
      }
    } else {
      await window.electronAPI.stopServer()
      showToast(t('serverStopped', currentLang))
    }
    
    updateServerStatus()
  } catch (err) {
    console.error('Error toggling server:', err)
    document.getElementById('serverEnabled').checked = false
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const currentLang = getCurrentLanguage()
  
  // Set initial language button active state
  document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.getAttribute('data-lang') === currentLang) {
      btn.classList.add('active')
    }
    
    btn.addEventListener('click', () => {
      const newLang = btn.getAttribute('data-lang')
      setLanguage(newLang)
      
      // Update active state
      document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      
      // Apply translations
      applyTranslations(newLang)
      updateModalLabels()
      updateChannelLabel()
      const buttonCommand = document.getElementById('buttonCommand')
      if (buttonCommand) updateDataLabels(buttonCommand.value)
      renderButtons()
    })
  })
  
  // Window control buttons
  document.getElementById('minimizeBtn').addEventListener('click', () => {
    window.windowControl.minimize()
  })
  
  document.getElementById('closeBtn').addEventListener('click', () => {
    window.windowControl.close()
  })
  
  // Setup grid event delegation (single listener)
  setupGridListener()
  
  // Apply initial translations
  applyTranslations(currentLang)
  updateChannelLabel()
  
  // Load MIDI devices
  loadMidiDevices()
  
  // Initialize server status and setup server controls
  updateServerStatus()
  
  document.getElementById('serverEnabled').addEventListener('change', toggleServer)
  
  document.getElementById('serverPort').addEventListener('input', (e) => {
    const port = parseInt(e.target.value)
    // Allow empty or partial input while typing
    if (e.target.value === '') return
    
    // Validate when a complete number is entered
    if (port < 1 || port > 65535) {
      e.target.value = 80
      const currentLang = getCurrentLanguage()
      alert(t('invalidPort', currentLang) || 'Port must be between 1 and 65535')
    }
  })
  
  renderButtons()
  
  // Button event listeners
  document.getElementById('addBtn').addEventListener('click', addButton)
  document.getElementById('clearBtn').addEventListener('click', clearAllButtons)
  document.getElementById('saveBtn').addEventListener('click', saveProject)
  document.getElementById('loadBtn').addEventListener('click', loadProject)
  document.getElementById('newBtn').addEventListener('click', newProject)
  
  // MIDI device selection listener
  const midiDeviceSelect = document.getElementById('midiDevice')
  if (midiDeviceSelect) {
    midiDeviceSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        selectMidiDevice(e.target.value)
      }
    })
  }
  
  // Command change listeners
  const buttonCommand = document.getElementById('buttonCommand')
  const editCommandInput = document.getElementById('editCommandInput')
  
  if (buttonCommand) {
    buttonCommand.addEventListener('change', (e) => {
      updateDataLabels(e.target.value, 'form')
    })
    // Initialize labels
    updateDataLabels(buttonCommand.value)
  }
  
  if (editCommandInput) {
    editCommandInput.addEventListener('change', (e) => {
      updateDataLabels(e.target.value, 'modal')
    })
  }
})
