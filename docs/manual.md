# Prompter - Numpad Macro System

## Overview
Prompter is a desktop application that turns your Numpad (and other keys) into a powerful, multi-page macro keyboard. It allows you to store text snippets ("prompts") and paste them into any application using global hotkeys.

## Installation

1.  **Download**: Navigate to the [Releases](https://github.com/Tourettes99/numberpad-keyboard-preconfig-prompts/releases) page of the repository.
2.  **Install**: Download the latest `.exe` installer (e.g., `Numpad Prompter Setup 1.0.1.exe`) and run it.
3.  **Launch**: The application will auto-launch after installation. You can also find it in your Start Menu.
4.  **Permissions**: On first run, Windows may ask for permission to use accessibility features (required for global hotkey detection).

## Getting Started

1.  **Open the App**: You will see the main Dashboard with a default Profile.
2.  **Bind a Key**: Click on a blank card (e.g., Numpad 1).
3.  **Add Text**: Type the text you want to paste in the "Prompt content" box.
4.  **Test It**: Open Notepad, press `Num 1` (or your bound key), and watch the text appear!

## Key Features

### 1. Profiles & Pages
-   **Profiles**: Create different sets of macros for different workflows (e.g., "Coding", "Streaming", "Email").
-   **Pages**: Each profile can have multiple pages of macros, effectively multiplying the number of available keys.
-   **Switching**:
    -   **Switch Profile**: `Ctrl + P` (Cycles through profiles)
    -   **Switch Page**: `Ctrl + Left Arrow` / `Ctrl + Right Arrow`

### 2. Hotkeys
-   **Numpad Keys (1-9)**: Pressing `Num1` through `Num9` will paste the text assigned to that key on the *current page* of the *active profile*.
-   **Custom Bindings**: You can record any key combination (e.g., `Ctrl+Shift+A`) and assign text to it.
-   **Global Keys**: Check the **Globe Icon** to make a key binding available across *all pages* in that profile. The key will appear with a blue globe indicator.

### 3. Dynamic Variables
Define reusable variables in **Settings** to keep your prompts dynamic and easy to update.
-   **Setup**: Go to Settings > Dynamic Variables. Add a key (e.g., `name`) and a value (e.g., `Alex`).
-   **Usage**: In any prompt, type `{{name}}`. When you press the hotkey, Prompter will automatically replace `{{name}}` with `Alex` before pasting.

### 4. Tags & Filtering
Organize your keys with tags and find them instantly.
-   **Add Tags**: Click the **Tag Icon** on any key card. Type a tag name (e.g., "professional", "emoji") in the popup and press Enter.
-   **Tag Display**: Tags appear as small clickable pills on the key card. Click the **X** on a tag to remove it.
-   **Filter Bar**: Use the search bar in the top header to filter keys.
    -   **Hotkey**: Press `Ctrl + F` to instantly focus the filter bar.
    -   **Logic**: Filtering matches Key Name, Prompt Text, or Tags.

### 5. AI Assistant (Gemini)
Prompter integrates with Google Gemini to supercharge your workflow.
-   **Setup**: Enter your Gemini API Key in **Settings**.
-   **Context-Aware**: Enable "Context Aware Generation" in Settings to let AI read your clipboard for context when generating or refining prompts.
-   **Page Wizard**: Generate a full page of macros from a simple description (e.g., "Customer service replies for refunds").
-   **Per-Key Refine**: Click the **Sparkles Icon** on any key card.
    -   Enter instructions (e.g., "Make it shorter", "Translate to Spanish").
    -   The AI will use neighboring keys and your clipboard (if enabled) to suggest an improved prompt.

### 6. Settings & Data Management
Access via the **Gear Icon** in the sidebar.
-   **Cloud Sync**: Set a custom "Config Storage Path" to save your `data.json` in a cloud-synced folder (Dropbox, OneDrive). *Restart required.*
-   **Import/Export**: detailed JSON backup of all your Profiles, Pages, and Variables.

## How It Works (Technical)

The application is built with **Electron** and **React**.

### Architecture
1.  **Electron Main Process (`electron/main.ts`)**:
    -   Handles system-level **Global Shortcuts**.
    -   Manages the database (using `electron-store`) to persist profiles and settings in JSON format.
    -   Performs the actual "Paste" action using efficient OS-level commands (PowerShell on Windows).
    -   Separates "System Shortcuts" (nav) from "Dynamic Shortcuts" (macros) to ensure stability.

2.  **Frontend Renderer (`src/pages/Dashboard.tsx`)**:
    -   A modern React UI for managing your configuration.
    -   Communicates with the backend via **IPC** (Inter-Process Communication).
    -   Syncs state in real-time: When you press `Ctrl+Right`, the backend tells the frontend to show Page 2 immediately.

3.  **Data Synchronization**:
    -   Updates are event-driven. When you change a prompt, it saves to disk and re-registers the hotkey instantly.
    -   Uses a "debounce" mechanism to prevent accidental rapid switching.

### System Requirements
-   **OS**: Windows (optimized), macOS, Linux.
-   **Permissions**: Accessibility access may be required for global hotkey monitoring.


license: MIT