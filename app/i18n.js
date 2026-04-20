const translations = {
  en: {
    title: '🎵 Web to MIDI',
    subtitle: 'Configure your custom MIDI buttons',
    createButton: 'Create a button',
    buttonNameLabel: 'Button name',
    buttonNamePlaceholder: 'e.g. Do, Kick, Snare...',
    commandLabel: 'Command',
    noteOn: 'Note On',
    noteOff: 'Note Off',
    keyPressure: 'Key Pressure',
    controlChange: 'Control Change (CC)',
    programChange: 'Program Change',
    channelPressure: 'Channel Pressure',
    pitchBend: 'Pitch Bend',
    buttonData1Label: 'Data 1',
    buttonData1Placeholder: 'e.g. 60',
    buttonData2Label: 'Data 2',
    buttonData2Placeholder: 'e.g. 64',
    paramNote: 'Note',
    paramVelocity: 'Velocity',
    paramPressure: 'Pressure',
    paramController: 'Controller',
    paramValue: 'Value',
    paramProgram: 'Program',
    paramPitchBend: 'Value',
    addButton: 'Add',
    resetButton: 'Reset',
    yourButtons: 'Your buttons',
    emptyMessage: 'No buttons configured',
    confirmResetMessage: 'Delete all buttons ?',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    cancel: 'Cancel',
    editButton: 'Edit',
    editNameLabel: 'Button name',
    editCommandLabel: 'Command',
    editData1Label: 'Data 1',
    editData2Label: 'Data 2',
    confirmDeleteMessage: 'Delete "{name}" ?',
    midiDeviceLabel: 'MIDI Device',
    selectDevice: 'Select a device...',
    saveProject: 'Save',
    loadProject: 'Load',
    newProject: 'New',
    midiChannelLabel: 'Channel',
    confirmLoadMessage: 'Load project ? (Current buttons will be replaced)',
    confirmNewProjectMessage: 'Create new project ? (Current buttons will be deleted)',
    buttonNameRequired: 'Button name is required',
    commandRequired: 'Command is required',
    mustBe: 'must be',
    invalid: 'is invalid',
    error: 'Error',
    errorLoading: 'Error loading project',
    projectSaved: 'Project saved successfully !',
    projectLoaded: 'Project loaded successfully !',
    unsavedChanges: 'Unsaved Changes',
    unsavedChangesMessage: 'You have unsaved changes. Do you want to save them before closing ?',
    save: 'Save',
    dontSave: 'Don\'t Save',
    cancelExit: 'Cancel',
    noMidiDevices: 'No MIDI devices found',
    midiDeviceSelected: 'MIDI Device:'
  },
  fr: {
    title: '🎵 Web to MIDI',
    subtitle: 'Configurez vos boutons MIDI personnalisés',
    createButton: 'Créer un bouton',
    buttonNameLabel: 'Nom du bouton',
    buttonNamePlaceholder: 'ex: Do, Kick, Snare...',
    commandLabel: 'Commande',
    noteOn: 'Note On',
    noteOff: 'Note Off',
    keyPressure: 'Key Pressure',
    controlChange: 'Control Change (CC)',
    programChange: 'Program Change',
    channelPressure: 'Channel Pressure',
    pitchBend: 'Pitch Bend',
    buttonData1Label: 'Data 1',
    buttonData1Placeholder: 'ex: 60',
    buttonData2Label: 'Data 2',
    buttonData2Placeholder: 'ex: 64',
    paramNote: 'Note',
    paramVelocity: 'Vélocité',
    paramPressure: 'Pression',
    paramController: 'Contrôleur',
    paramValue: 'Valeur',
    paramProgram: 'Programme',
    paramPitchBend: 'Valeur',
    addButton: 'Ajouter',
    resetButton: 'Réinitialiser',
    yourButtons: 'Vos boutons',
    emptyMessage: 'Aucun bouton configuré',
    confirmResetMessage: 'Supprimer tous les boutons ?',
    yes: 'Oui',
    no: 'Non',
    ok: 'OK',
    cancel: 'Annuler',
    editButton: 'Modifier',
    editNameLabel: 'Nom du bouton',
    editCommandLabel: 'Commande',
    editData1Label: 'Data 1',
    editData2Label: 'Data 2',
    confirmDeleteMessage: 'Supprimer "{name}" ?',
    midiDeviceLabel: 'Périphérique MIDI',
    selectDevice: 'Sélectionner un appareil...',
    saveProject: 'Enreg.',
    loadProject: 'Charger',
    newProject: 'Nouveau',
    midiChannelLabel: 'Canal',
    confirmLoadMessage: 'Charger un projet ? (Les boutons actuels seront remplacés)',
    confirmNewProjectMessage: 'Créer un nouveau projet ? (Les boutons actuels seront supprimés)',
    buttonNameRequired: 'Le nom du bouton est requis',
    commandRequired: 'La commande est requise',
    mustBe: 'doit être',
    invalid: 'est invalide',
    error: 'Erreur',
    errorLoading: 'Erreur lors du chargement du projet',
    projectSaved: 'Projet enregistré avec succès !',
    projectLoaded: 'Projet chargé avec succès !',
    unsavedChanges: 'Modifications non enregistrées',
    unsavedChangesMessage: 'Vous avez des modifications non enregistrées. Voulez-vous les enregistrer avant de fermer ?',
    save: 'Enregistrer',
    dontSave: 'Ne pas enregistrer',
    cancelExit: 'Annuler',
    noMidiDevices: 'Aucun appareil MIDI trouvé',
    midiDeviceSelected: 'Appareil MIDI :'
  }
}

let currentLanguage = null

// Detect system language
function detectLanguage() {
  const browserLang = navigator.language.split('-')[0]
  return translations[browserLang] ? browserLang : 'en'
}

// Get saved language or detect system language
function getSavedLanguage() {
  const saved = localStorage.getItem('language')
  if (saved && translations[saved]) {
    return saved
  }
  return detectLanguage()
}

// Get current language
function getCurrentLanguage() {
  if (!currentLanguage) {
    currentLanguage = getSavedLanguage()
  }
  return currentLanguage
}

// Set language and save to localStorage
function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang
    localStorage.setItem('language', lang)
  }
}

// Get current translations
function getTranslations(lang = null) {
  const lang_to_use = lang || getCurrentLanguage()
  return translations[lang_to_use]
}

// Get a single translation
function t(key, lang = null) {
  const trans = getTranslations(lang)
  return trans[key] || translations.en[key] || key
}
