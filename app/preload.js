const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  ping: () => ipcRenderer.invoke('ping')
})

contextBridge.exposeInMainWorld('windowControl', {
  minimize: () => ipcRenderer.invoke('window-minimize'),
  close: () => ipcRenderer.invoke('window-close')
})

contextBridge.exposeInMainWorld('electronAPI', {
  syncButtons: (buttons) => ipcRenderer.invoke('sync-buttons', buttons),
  syncDevice: (device) => ipcRenderer.invoke('sync-device', device),
  playNote: (midiData) => ipcRenderer.invoke('play-note', midiData),
  getMidiDevices: () => ipcRenderer.invoke('get-midi-devices'),
  setMidiDevice: (deviceId) => ipcRenderer.invoke('set-midi-device', deviceId),
  saveProject: (projectName = 'default') => ipcRenderer.invoke('save-project', projectName),
  loadProject: (projectName = 'default') => ipcRenderer.invoke('load-project', projectName),
  saveProjectDialog: () => ipcRenderer.invoke('save-project-dialog'),
  loadProjectDialog: () => ipcRenderer.invoke('load-project-dialog'),
  newProject: () => ipcRenderer.invoke('new-project'),
  checkUnsavedChanges: () => ipcRenderer.invoke('check-unsaved-changes'),
  setProjectDirty: (dirty) => ipcRenderer.send('project-dirty-state', dirty),
  onSaveBeforeExit: (callback) => ipcRenderer.on('save-before-exit', callback),
  notifySaveComplete: () => ipcRenderer.send('save-complete'),
  onLoadFile: (callback) => ipcRenderer.on('load-file', (event, filePath) => callback(filePath)),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath)
})
