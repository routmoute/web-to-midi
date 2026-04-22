# Web-to-MIDI

A desktop application that lets you control MIDI devices through a web-based interface. Built with Electron and Express.

## Features

- 🎛️ Desktop application for MIDI control
- 🌐 Web-based button remote interface
- ⚡ Real-time MIDI command sending
- 🎨 Customizable button colors
- 🔌 Enable/disable web server on demand
- ⚙️ Configurable server port
- 🌍 Bilingual interface (English/French)
- 💾 Save and load project configurations

## Installation

Download the latest release for your operating system:
- **Windows**: `.exe` installer or portable version
- **macOS**: `.dmg` installer  
- **Linux**: `.deb` package or `.AppImage`

## Getting Started

1. **Launch the application**
   - Start Web-to-MIDI from your applications menu or command line

2. **Connect your MIDI device**
   - Select your MIDI device from the dropdown menu in the application

3. **Create and configure buttons**
   - Click "Create button" to add new MIDI control buttons
   - Customize each button:
     - Set a name for the button
     - Choose a custom color
     - Configure MIDI channel, control type, and values
   - Save your configuration as a project for future use

4. **Configure the web server** (optional)
   - Toggle "Enable Web Server" to turn the server on/off
   - Change the server port if needed (default: 80, range: 1-65535)
   - View the real-time server status

5. **Access the remote interface**
   - **On the same computer**: `http://localhost` 
   - **From another device on the same network**: `http://<machine-ip>` (e.g., `http://192.168.1.100`)

6. **Control your MIDI device**
   - Use the remote buttons from any connected device to send MIDI commands in real-time

## Download

👉 [Latest Releases & Downloads](https://github.com/routmoute/web-to-midi/releases)

---

## Contributing

Contributions are welcome! Feel free to open issues or pull requests.

- Fork the repository
- Create a new branch
- Commit your changes
- Open a pull request

For questions or suggestions, open an issue on GitHub.
