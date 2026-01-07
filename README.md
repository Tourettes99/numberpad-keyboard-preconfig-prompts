# Numpad Prompter

**Numpad Prompter** is a powerful Desktop application that allows you to trigger pre-configured Gemini AI prompts using your number pad (or any mapped keys). Designed for speed and efficiency, it integrates a seamless overlay UI to keep you in your flow.

## Features

- ⚡ **Dynamic Key Bindings**: Bind specific AI prompts to any key combination.
- 🤖 **Gemini AI Integration**: Leverages Google's Gemini models for intelligent text generation.
- 🎯 **Overlay Interface**: Minimized, unobtrusive UI for quick interactions.
- ⚙️ **Configurable Prompts**: personalized prompts for your specific workflow needs.
- 🛠️ **Built with Modern Tech**: Electron, React, TypeScript, and Vite.

## Getting Started

### Installation

1.  Download the latest installer from the [Releases]([https://github.com/yourusername/numberpad-keyboard-preconfig-prompts/releases](https://github.com/Tourettes99/numberpad-keyboard-preconfig-prompts/releases/tag/EXE)) page.
2.  Run the installer (`Numpad Prompter Setup <version>.exe`).
3.  Launch the application.

### Development Setup

If you want to run the project locally or contribute:

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/numberpad-keyboard-preconfig-prompts.git
    cd numberpad-keyboard-preconfig-prompts
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Run in Development Mode**
    ```bash
    npm run dev
    ```
    This will start the Vite dev server and the Electron main process.

4.  **Build for Production**
    ```bash
    npm run build
    ```
    The output installers will be in the `dist/` directory.

## Project Structure

- **src/**: React frontend source code.
- **electron/**: Electron main process code.
- **dist/**: Production build artifacts.

## License

MIT LICENSE
