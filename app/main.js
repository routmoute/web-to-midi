const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('node:path')
const express = require('express')
const fs = require('fs')
const fsPromises = require('fs').promises
const midi = require('@julusian/midi')

// MIDI Output instance (lazy initialization)
let midiOutput = null

// Get or create MIDI output (lazy initialization to avoid Docker crash without ALSA)
function getOrCreateMidiOutput() {
  if (midiOutput === null) {
    try {
      midiOutput = new midi.Output()
      console.log('MIDI Output initialized')
    } catch (err) {
      console.error('Failed to initialize MIDI Output:', err.message)
      return null
    }
  }
  return midiOutput
}

// Close MIDI output on app termination
function closeMidiOutput() {
  if (midiOutput) {
    try {
      midiOutput.closePort()
      midiOutput = null
      console.log('MIDI Output closed')
    } catch (err) {
      console.error('Error closing MIDI Output:', err.message)
    }
  }
}

// Shared state for buttons
const appState = {
  buttons: [],
  selectedDevice: null
}

// Get list of available MIDI devices
function getMidiDevices() {
  const output = getOrCreateMidiOutput()
  if (!output) {
    console.warn('MIDI Output not available')
    return []
  }
  
  const outputCount = output.getPortCount()
  const devices = []
  
  for (let i = 0; i < outputCount; i++) {
    devices.push({
      id: i,
      name: output.getPortName(i)
    })
  }
  
  return devices
}

// Open a MIDI device
function openMidiDevice(deviceId) {
  const output = getOrCreateMidiOutput()
  if (!output) {
    console.error('MIDI Output not available')
    return false
  }
  
  try {
    if (typeof deviceId === 'number' && deviceId >= 0 && deviceId < output.getPortCount()) {
      output.openPort(deviceId)
      appState.selectedDevice = deviceId
      console.log(`Opened MIDI device: ${output.getPortName(deviceId)}`)
      return true
    }
  } catch (err) {
    console.error('Failed to open MIDI device:', err.message)
  }
  return false
}

// Play MIDI data on selected device
function playNote(midiData) {
  const output = getOrCreateMidiOutput()
  if (!output) {
    console.warn('MIDI Output not available')
    return false
  }
  
  try {
    const { command, channel, data1, data2 } = midiData
    
    if (appState.selectedDevice === null || appState.selectedDevice === undefined) {
      console.warn('No MIDI device selected')
      return false
    }
    
    // Map command to MIDI status byte (0 = Note Off, 1 = Note On, etc.)
    const commandMap = {
      noteOff: 0x80,
      noteOn: 0x90,
      keyPressure: 0xA0,
      controlChange: 0xB0,
      programChange: 0xC0,
      channelPressure: 0xD0,
      pitchBend: 0xE0
    }
    
    const statusByte = (commandMap[command] || 0x90) + channel
    
    // Send MIDI message based on command
    if (command === 'programChange' || command === 'channelPressure') {
      // Single-byte data commands
      output.sendMessage([statusByte, data1])
    } else {
      // Two-byte data commands
      output.sendMessage([statusByte, data1, data2])
    }
    
    console.log(`Sent MIDI: ${command} on channel ${channel + 1} | Data1: ${data1} | Data2: ${data2}`)
    return true
  } catch (err) {
    console.error('Failed to play MIDI note:', err.message)
    return false
  }
}

// Save project to file (with full path) - async to prevent UI blocking
async function saveProject(filePath) {
  try {
    // Ensure .w2m extension
    if (!filePath.endsWith('.w2m')) {
      filePath = filePath + '.w2m'
    }
    
    const projectData = {
      buttons: appState.buttons,
      selectedDevice: appState.selectedDevice,
      savedAt: new Date().toISOString()
    }
    await fsPromises.writeFile(filePath, JSON.stringify(projectData, null, 2))
    console.log(`Project saved: ${filePath}`)
    return { success: true, path: filePath }
  } catch (err) {
    console.error('Failed to save project:', err.message)
    return { success: false, error: err.message }
  }
}

// Load project from file (with full path) - async to prevent UI blocking
async function loadProject(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Project file not found' }
    }
    const data = await fsPromises.readFile(filePath, 'utf-8')
    const projectData = JSON.parse(data)
    
    // Validate project format
    if (!Array.isArray(projectData.buttons)) {
      return { success: false, error: 'Invalid project format: buttons must be an array' }
    }
    
    // Validate each button
    for (const btn of projectData.buttons) {
      if (!btn.id || !btn.name || !btn.command || btn.data1 === undefined || btn.data2 === undefined || btn.channel === undefined) {
        return { success: false, error: 'Invalid button format: missing required fields' }
      }
      
      const validCommands = ['noteOn', 'noteOff', 'keyPressure', 'controlChange', 'programChange', 'channelPressure', 'pitchBend']
      if (!validCommands.includes(btn.command)) {
        return { success: false, error: `Invalid command: ${btn.command}` }
      }
      
      const channel = parseInt(btn.channel)
      if (isNaN(channel) || channel < 0 || channel > 15) {
        return { success: false, error: `Invalid MIDI channel: ${btn.channel} (must be 0-15)` }
      }
      
      const data1 = parseInt(btn.data1)
      // Pitch Bend can have data1 0-16383, others 0-127
      const maxData1 = btn.command === 'pitchBend' ? 16383 : 127
      if (isNaN(data1) || data1 < 0 || data1 > maxData1) {
        return { success: false, error: `Invalid Data1: ${btn.data1} (must be 0-${maxData1})` }
      }
      
      // Data2 validation: only required for commands that use it (not Pitch Bend)
      if (btn.command !== 'pitchBend') {
        const data2 = parseInt(btn.data2)
        if (isNaN(data2) || data2 < 0 || data2 > 127) {
          return { success: false, error: `Invalid Data2: ${btn.data2} (must be 0-127)` }
        }
      }
    }
    
    appState.buttons = projectData.buttons
    appState.selectedDevice = projectData.selectedDevice || null
    console.log(`Project loaded: ${filePath}`)
    return { success: true, buttons: appState.buttons, device: appState.selectedDevice }
  } catch (err) {
    if (err instanceof SyntaxError) {
      return { success: false, error: 'Invalid JSON format' }
    }
    console.error('Failed to load project:', err.message)
    return { success: false, error: err.message }
  }
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    frame: false,
    resizable: false,
    webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true
    }
  })

  win.loadFile(path.join(__dirname, 'index.html'))
  
  // Handle window close with unsaved changes check
  win.on('close', async (event) => {
    try {
      // Check if renderer has unsaved changes
      if (global.projectDirty) {
        event.preventDefault()
        
        // Ask user if they want to save
        const response = await dialog.showMessageBox(win, {
          type: 'question',
          buttons: ['Save', 'Don\'t Save', 'Cancel'],
          defaultId: 0,
          title: 'Unsaved Changes',
          message: 'You have unsaved changes. Do you want to save them before closing ?'
        })
        
        if (response.response === 0) {
          // User clicked "Save" - send save request to renderer
          win.webContents.send('save-before-exit')
          // Will wait for save-complete or save-failed from renderer
        } else if (response.response === 1) {
          // User clicked "Don't Save"
          app.exit(0)
        }
        // If response === 2, user clicked "Cancel" - do nothing, keep window open
      }
    } catch (err) {
      console.error('Error in window close handler:', err)
    }
  })
  
  // When window is ready, load pending .w2m file if any
  win.webContents.on('did-finish-load', () => {
    if (global.pendingFile) {
      const filePath = global.pendingFile
      global.pendingFile = null
      win.webContents.send('load-file', filePath)
    }
  })
  
  return win
}

// Cleanup on app quit
app.on('before-quit', () => {
  closeMidiOutput()
})

// Setup Express server
const setupExpressServer = () => {
  const expressApp = express()
  const PORT = 80

  // Middleware
  expressApp.use(express.json())
  expressApp.use(express.static(path.join(__dirname, 'public')))

  // API Routes
  expressApp.get('/api/buttons', (req, res) => {
    res.json(appState.buttons)
  })

  expressApp.post('/api/buttons/:id/play', (req, res) => {
    const buttonId = parseInt(req.params.id)
    const button = appState.buttons.find(b => b.id === buttonId)
    
    if (!button) {
      return res.status(404).json({ error: 'Button not found' })
    }

    playNote({
      command: button.command,
      channel: button.channel,
      data1: button.data1,
      data2: button.data2
    })
    
    res.json({ success: true })
  })

  // Start server
  const server = expressApp.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`)
  })

  server.on('error', (err) => {
    if (err.code === 'EACCES' || err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} unavailable, trying port 3000...`)
      const fallbackPort = 3000
      const fallbackServer = expressApp.listen(fallbackPort, () => {
        console.log(`Express server running on port ${fallbackPort} (fallback from ${PORT})`)
      })
      fallbackServer.on('error', (err) => {
        console.error(`Failed to start Express server on both ports:`, err.message)
        process.exit(1)
      })
    } else {
      console.error(`Express server error:`, err.message)
      process.exit(1)
    }
  })
}

app.whenReady().then(() => {
  ipcMain.handle('ping', () => 'pong')
  
  // Handle .w2m file opening
  ipcMain.handle('open-file', async (event, filePath) => {
    const result = await loadProject(filePath)
    return result
  })
  
  // Listener for project dirty state updates (sent from renderer)
  ipcMain.on('project-dirty-state', (event, dirty) => {
    global.projectDirty = dirty
  })
  
  // Listener for save completion (from renderer)
  ipcMain.on('save-complete', (event) => {
    app.exit(0)
  })
  ipcMain.handle('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.minimize()
  })
  ipcMain.handle('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.close()
  })

  // IPC handlers to sync buttons with web server
  ipcMain.handle('sync-buttons', (event, buttons) => {
    appState.buttons = buttons
    return { success: true }
  })

  ipcMain.handle('sync-device', (event, device) => {
    appState.selectedDevice = device
    return { success: true }
  })

  ipcMain.handle('play-note', (event, midiData) => {
    playNote(midiData)
    return { success: true }
  })

  ipcMain.handle('get-midi-devices', (event) => {
    return getMidiDevices()
  })

  ipcMain.handle('set-midi-device', (event, deviceId) => {
    const success = openMidiDevice(deviceId)
    let deviceName = null
    if (success) {
      const devices = getMidiDevices()
      const device = devices.find(d => d.id === deviceId)
      deviceName = device ? device.name : null
    }
    return { success, deviceId, deviceName }
  })

  ipcMain.handle('save-project', (event, projectName = 'default') => {
    return saveProject(projectName)
  })

  ipcMain.handle('load-project', (event, projectName = 'default') => {
    return loadProject(projectName)
  })

  ipcMain.handle('save-project-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showSaveDialog(win, {
      title: 'Save Project',
      defaultPath: path.join(app.getPath('documents'), 'project.w2m'),
      filters: [
        { name: 'Web to MIDI Project', extensions: ['w2m'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    
    if (!result.canceled && result.filePath) {
      return saveProject(result.filePath)
    }
    return { success: false, error: 'Save canceled' }
  })

  // Handler for save before exit (waits for completion)
  ipcMain.handle('save-before-exit', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showSaveDialog(win, {
      title: 'Save Project',
      defaultPath: path.join(app.getPath('documents'), 'project.w2m'),
      filters: [
        { name: 'Web to MIDI Project', extensions: ['w2m'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    
    if (!result.canceled && result.filePath) {
      const saveResult = await saveProject(result.filePath)
      return saveResult
    }
    return { success: false, error: 'Save canceled' }
  })

  ipcMain.handle('load-project-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win, {
      title: 'Open Project',
      defaultPath: app.getPath('documents'),
      filters: [
        { name: 'Web to MIDI Project', extensions: ['w2m'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      return loadProject(result.filePaths[0])
    }
    return { success: false, error: 'Open canceled' }
  })

  ipcMain.handle('new-project', (event) => {
    appState.buttons = []
    appState.selectedDevice = null
    return { success: true }
  })

  createWindow()
  setupExpressServer()

  // Handle .w2m files opened with the app (Windows)
  if (process.argv.length > 1) {
    const filePath = process.argv[process.argv.length - 1]
    if (filePath.endsWith('.w2m')) {
      global.pendingFile = filePath
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})