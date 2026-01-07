import { app, BrowserWindow, globalShortcut, ipcMain, clipboard, screen, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import Store from 'electron-store';
import { spawn } from 'child_process';
import crypto from 'crypto';

console.log('Main process starting...');

// --- Types ---
interface Page {
    prompts: Record<string, string>; // Key is the accelerator
    tags?: Record<string, string[]>; // Key is accelerator, value is list of tags
}

interface Profile {
    id: string;
    name: string;
    color: string;
    globalPrompts: Record<string, string>;
    globalTags?: Record<string, string[]>;
    group?: string;
    pages: Page[];
}

interface Settings {
    os: 'windows' | 'mac' | 'linux';
    geminiApiKey: string;
    contextAware?: boolean;
    dataPath?: string;
}

interface Schema {
    profiles: Profile[];
    activeProfileId: string;
    activePageIndices: Record<string, number>;
    variables: Record<string, string>;
    settings: Settings;
}

// --- Store Setup ---
const store = new Store<Schema>({
    defaults: {
        profiles: [
            {
                id: 'default',
                name: 'Default',
                color: '#3b82f6',
                globalPrompts: {},
                pages: [{ prompts: {} }]
            }
        ],
        activeProfileId: 'default',
        activePageIndices: { 'default': 0 },
        variables: {},
        settings: {
            os: 'windows',
            geminiApiKey: '',
            contextAware: false
        }
    }
} as any);

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

// --- Helper Functions ---

function getActiveProfile(): Profile {
    const profiles = (store.get('profiles') as unknown) as Profile[];
    const activeId = (store.get('activeProfileId') as unknown) as string;
    return profiles.find((p: Profile) => p.id === activeId) || profiles[0];
}

function getActivePage(profile: Profile): Page {
    const indices = (store.get('activePageIndices') as unknown) as Record<string, number>;
    const index = indices[profile.id] || 0;
    return profile.pages[index] || profile.pages[0];
}

function setActivePage(profileId: string, index: number) {
    const indices = (store.get('activePageIndices') as unknown) as Record<string, number>;
    indices[profileId] = index;
    store.set('activePageIndices', indices);
}

function showOverlay(message: string, color: string, subMessage?: string) {
    if (overlayWindow) {
        overlayWindow.webContents.send('show-overlay', { message, color, subMessage });
        overlayWindow.showInactive();
    }
}

async function pasteText(text: string) {
    const settings = (store.get('settings') as unknown) as Settings;
    const variables = (store.get('variables') as unknown) as Record<string, string> || {};
    const os = settings?.os || 'windows';

    let processedText = text;
    Object.entries(variables).forEach(([key, value]) => {
        processedText = processedText.replace(new RegExp(`#${key}`, 'g'), value);
    });

    clipboard.writeText(processedText);

    if (os === 'windows') {
        const psCommand = `
        $wshell = New-Object -ComObject wscript.shell;
        $wshell.SendKeys('^v');
        `;
        const child = spawn('powershell', ['-Command', psCommand]);
        child.on('error', (err) => console.error('Failed to paste (Windows):', err));
        child.stdin.end();
    } else if (os === 'mac') {
        console.log('Mac paste not implemented yet');
    } else if (os === 'linux') {
        console.log('Linux paste not implemented yet');
    }
}

// --- Window Creation ---

function createOverlayWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width } = primaryDisplay.workAreaSize;

    overlayWindow = new BrowserWindow({
        width: 400,
        height: 100,
        x: Math.round(width / 2 - 200),
        y: 50,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        focusable: false,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    if (process.env.NODE_ENV === 'development') {
        overlayWindow.loadURL('http://localhost:5173/#/overlay');
    } else {
        overlayWindow.loadFile(path.join(__dirname, '../../dist/index.html'), { hash: 'overlay' });
    }

    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
}

function createWindow() {
    console.log('Creating main window...');
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        frame: false,
        titleBarStyle: 'hidden',
        backgroundColor: '#1e1e1e',
        icon: process.env.NODE_ENV === 'development'
            ? path.join(__dirname, '../../public/icon.ico')
            : path.join(__dirname, '../../dist/icon.ico')
    });

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        // mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }
}

// --- Shortcuts ---

let registeredDynamicAccelerators: string[] = [];

function updateDynamicShortcuts() {
    // 1. Unregister only the previously registered DYNAMIC shortcuts
    registeredDynamicAccelerators.forEach(acc => {
        globalShortcut.unregister(acc);
    });
    registeredDynamicAccelerators = [];

    // 2. Register New keys
    const profile = getActiveProfile();
    const page = getActivePage(profile);
    const allPrompts = { ...(profile.globalPrompts || {}), ...page.prompts };

    Object.entries(allPrompts).forEach(([accelerator, text]) => {
        if (!text) return;

        // Safety check to ensure we don't accidentally try to register system shortcuts as dynamic
        if (['CommandOrControl+P', 'CommandOrControl+Left', 'CommandOrControl+Right'].includes(accelerator)) return;

        try {
            let acc = accelerator;
            if (/^[1-9]$/.test(acc)) {
                acc = `Num${acc}`;
            }

            const ret = globalShortcut.register(acc, () => {
                pasteText(text);
            });

            if (ret) {
                registeredDynamicAccelerators.push(acc);
            } else {
                console.warn(`Registration failed for: ${acc}`);
            }
        } catch (err) {
            console.error(`Failed to register shortcut ${accelerator}:`, err);
        }
    });
}

function registerSystemShortcuts() {
    // 1. Profile Switching (Ctrl+P)
    let lastProfileSwitchTime = 0;
    globalShortcut.register('CommandOrControl+P', () => {
        const now = Date.now();
        if (now - lastProfileSwitchTime < 500) return; // Debounce 500ms
        lastProfileSwitchTime = now;

        const profiles = (store.get('profiles') as unknown) as Profile[];
        const activeId = (store.get('activeProfileId') as unknown) as string;
        const currentIndex = profiles.findIndex((p: Profile) => p.id === activeId);
        const nextIndex = (currentIndex + 1) % profiles.length;
        const nextProfile = profiles[nextIndex];

        store.set('activeProfileId', nextProfile.id);

        showOverlay(nextProfile.name, nextProfile.color, 'Profile Switched');
        mainWindow?.webContents.send('profile-changed', nextProfile.id);

        // Send full data update
        mainWindow?.webContents.send('data-update', {
            profiles: store.get('profiles'),
            activeProfileId: store.get('activeProfileId'),
            activePageIndices: store.get('activePageIndices'),
            variables: store.get('variables'),
            settings: store.get('settings')
        });

        updateDynamicShortcuts();
    });

    // 2. Page Switching (Ctrl+Left / Ctrl+Right)
    const sendDataUpdate = () => {
        mainWindow?.webContents.send('data-update', {
            profiles: store.get('profiles'),
            activeProfileId: store.get('activeProfileId'),
            activePageIndices: store.get('activePageIndices'),
            variables: store.get('variables'),
            settings: store.get('settings')
        });
    }

    let lastPageSwitchTime = 0;

    globalShortcut.register('CommandOrControl+Left', () => {
        const now = Date.now();
        if (now - lastPageSwitchTime < 250) return; // Debounce 250ms
        lastPageSwitchTime = now;

        const profile = getActiveProfile();
        const indices = (store.get('activePageIndices') as unknown) as Record<string, number>;
        let index = indices[profile.id] || 0;

        if (index > 0) {
            index--;
            setActivePage(profile.id, index);
            showOverlay(`Page ${index + 1}`, profile.color, 'Previous Page');
            mainWindow?.webContents.send('page-changed', index);
            sendDataUpdate();
            updateDynamicShortcuts();
        }
    });

    globalShortcut.register('CommandOrControl+Right', () => {
        const now = Date.now();
        if (now - lastPageSwitchTime < 250) return; // Debounce 250ms
        lastPageSwitchTime = now;

        const profile = getActiveProfile();
        const indices = (store.get('activePageIndices') as unknown) as Record<string, number>;
        let index = indices[profile.id] || 0;

        if (index < profile.pages.length - 1) {
            index++;
            setActivePage(profile.id, index);
            showOverlay(`Page ${index + 1}`, profile.color, 'Next Page');
            mainWindow?.webContents.send('page-changed', index);
            sendDataUpdate();
            updateDynamicShortcuts();
        }
    });

    // 3. Global Group Filter (Ctrl+Shift+G)
    globalShortcut.register('CommandOrControl+Shift+G', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('focus-group-filter');
        }
    });
}

const registerShortcuts = () => {
    // Initial Registration
    globalShortcut.unregisterAll();
    registerSystemShortcuts();
    updateDynamicShortcuts();
}

app.whenReady().then(() => {
    createWindow();
    createOverlayWindow();

    // Register shortcuts
    registerShortcuts();

    ipcMain.on('get-data', (event) => {
        event.sender.send('data-update', {
            profiles: store.get('profiles'),
            activeProfileId: store.get('activeProfileId'),
            activePageIndices: store.get('activePageIndices'),
            settings: store.get('settings')
        });
    });

    ipcMain.on('save-profiles', (event, profiles: Profile[]) => {
        store.set('profiles', profiles);
        const activeId = (store.get('activeProfileId') as unknown) as string;
        if (!profiles.find((p: Profile) => p.id === activeId)) {
            store.set('activeProfileId', profiles[0].id);
        }
        event.sender.send('data-update', {
            profiles: store.get('profiles'),
            activeProfileId: store.get('activeProfileId'),
            activePageIndices: store.get('activePageIndices'),
            settings: store.get('settings')
        });

        // Also update shortcuts if profile data changed significantly
        // Ideally we only update if the active profile changed, but 
        // if user edited shortcuts for the *active* profile, we need to refresh.
        // So safe bet:
        updateDynamicShortcuts();
    });

    ipcMain.on('set-active-profile', (event, id: string) => {
        store.set('activeProfileId', id);
        const profiles = (store.get('profiles') as unknown) as Profile[];
        const p = profiles.find((p: Profile) => p.id === id);
        showOverlay(p?.name || '', p?.color || '#fff', 'Profile Selected');

        updateDynamicShortcuts();

        event.sender.send('data-update', {
            profiles: store.get('profiles'),
            activeProfileId: store.get('activeProfileId'),
            activePageIndices: store.get('activePageIndices'),
            settings: store.get('settings')
        });
    });

    ipcMain.on('set-active-page', (event, { profileId, index }) => {
        setActivePage(profileId, index);
        const profile = getActiveProfile();
        if (profile.id === profileId) {
            updateDynamicShortcuts(); // Re-register for new page keys
        }
        event.sender.send('data-update', {
            profiles: store.get('profiles'),
            activeProfileId: store.get('activeProfileId'),
            activePageIndices: store.get('activePageIndices'),
            variables: store.get('variables'),
            settings: store.get('settings')
        });
    });

    ipcMain.on('save-settings', (event, settings: Settings) => {
        store.set('settings', settings);
        event.sender.send('data-update', {
            profiles: store.get('profiles'),
            activeProfileId: store.get('activeProfileId'),
            activePageIndices: store.get('activePageIndices'),
            variables: store.get('variables'),
            settings: store.get('settings')
        });
    });

    ipcMain.on('export-profiles', async (event) => {
        const { filePath } = await dialog.showSaveDialog({
            title: 'Export Data',
            defaultPath: 'prompter-data.json',
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });

        if (filePath) {
            const dataToExport = {
                version: 1,
                profiles: store.get('profiles') || [],
                variables: store.get('variables') || {}
            };
            fs.writeFileSync(filePath, JSON.stringify(dataToExport, null, 2));
            event.sender.send('export-complete', true);
        }
    });

    ipcMain.on('import-profiles', async (event) => {
        const { filePaths } = await dialog.showOpenDialog({
            title: 'Import Profiles',
            filters: [{ name: 'JSON', extensions: ['json'] }],
            properties: ['openFile']
        });

        if (filePaths && filePaths.length > 0) {
            try {
                const content = fs.readFileSync(filePaths[0], 'utf-8');
                const rawData = JSON.parse(content);

                // Allow importing either a raw array of profiles OR an object { profiles: [...] }
                let profilesToImport = Array.isArray(rawData) ? rawData : (Array.isArray(rawData.profiles) ? rawData.profiles : null);

                if (!profilesToImport) {
                    console.error('Invalid JSON format');
                    // Ideally send error back, but for now just logging as per original pattern
                    return;
                }

                // Sanitize and Validate
                const validProfiles = profilesToImport.map((p: any) => {
                    if (!p || typeof p !== 'object') return null;
                    // Ensure essential fields
                    if (!p.id) p.id = crypto.randomUUID();
                    if (!p.name) p.name = 'Imported Profile';
                    if (!p.pages || !Array.isArray(p.pages)) p.pages = [{ prompts: {}, tags: {} }];

                    // Sanitize structure
                    p.globalPrompts = p.globalPrompts || {};
                    p.globalTags = p.globalTags || {};
                    p.pages = p.pages.map((page: any) => ({
                        prompts: page.prompts || {},
                        tags: page.tags || {}
                    }));

                    return p;
                }).filter((p: any) => p !== null);

                if (validProfiles.length > 0) {
                    store.set('profiles', validProfiles);

                    // Import variables if present
                    if (!Array.isArray(rawData) && rawData.variables && typeof rawData.variables === 'object') {
                        store.set('variables', rawData.variables);
                    }

                    // Reset active ID if invalid
                    const currentActiveId = (store.get('activeProfileId') as unknown) as string;
                    if (!validProfiles.find((p: any) => p.id === currentActiveId)) {
                        store.set('activeProfileId', validProfiles[0].id);
                    }

                    event.sender.send('data-update', {
                        profiles: store.get('profiles'),
                        activeProfileId: store.get('activeProfileId'),
                        activePageIndices: store.get('activePageIndices'),
                        variables: store.get('variables'),
                        settings: store.get('settings')
                    });

                    updateDynamicShortcuts();
                    event.sender.send('import-complete', true);
                } else {
                    console.error('No valid profiles found in import');
                }
            } catch (error) {
                console.error('Failed to import:', error);
            }
        }
    });

    // --- Window Controls ---
    ipcMain.on('window-minimize', () => mainWindow?.minimize());
    ipcMain.on('window-maximize', () => {
        if (mainWindow?.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow?.maximize();
        }
    });
    ipcMain.on('window-close', () => mainWindow?.close());

    // --- Desktop Shortcut ---
    ipcMain.on('create-desktop-shortcut', () => {
        const targetPath = app.getPath('exe');
        const desktopPath = app.getPath('desktop');
        const shortcutPath = path.join(desktopPath, 'Numpad Prompter.lnk');
        const iconPath = targetPath; // Use exe icon

        const psCommand = `
        $WshShell = New-Object -comObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut("${shortcutPath}")
        $Shortcut.TargetPath = "${targetPath}"
        $Shortcut.IconLocation = "${iconPath}"
        $Shortcut.Save()
        `;

        const child = spawn('powershell', ['-Command', psCommand]);
        child.on('exit', (code) => {
            if (code === 0) {
                dialog.showMessageBox(mainWindow!, {
                    type: 'info',
                    message: 'Shortcut created on Desktop!',
                    buttons: ['OK']
                });
            } else {
                dialog.showErrorBox('Error', 'Failed to create shortcut.');
            }
        });
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
