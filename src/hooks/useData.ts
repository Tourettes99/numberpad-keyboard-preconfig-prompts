import { useEffect, useState } from 'react';
const { ipcRenderer } = window.require('electron');

// Types
export interface Page {
    prompts: Record<string, string>;
    tags?: Record<string, string[]>;
}

export interface Profile {
    id: string;
    name: string;
    color: string;
    globalPrompts: Record<string, string>;
    globalTags?: Record<string, string[]>;
    group?: string;
    pages: Page[];
}

export interface Settings {
    os: 'windows' | 'mac' | 'linux';
    geminiApiKey: string;
    contextAware?: boolean;
    dataPath?: string;
}

export interface DataState {
    profiles: Profile[];
    activeProfileId: string;
    activePageIndices: Record<string, number>;
    variables: Record<string, string>;
    settings: Settings;
}

export interface UseDataReturn {
    data: DataState;
    saveProfiles: (profiles: Profile[]) => void;
    setActiveProfile: (id: string) => void;
    setActivePage: (profileId: string, index: number) => void;
    saveSettings: (settings: Settings) => void;
    saveVariables: (variables: Record<string, string>) => void;
    exportProfiles: () => void;
    importProfiles: () => void;
}

export function useData(): UseDataReturn {
    const [data, setData] = useState<DataState>({
        profiles: [],
        activeProfileId: '',
        activePageIndices: {},
        variables: {},
        settings: { os: 'windows', geminiApiKey: '', contextAware: false }
    });

    useEffect(() => {
        console.log('[useData] Mounting, sending get-data');
        ipcRenderer.send('get-data');

        const handler = (_: any, newData: DataState) => {
            console.log('[useData] Received data-update:', newData);
            setData(newData);
        };

        const exportHandler = (_: any, success: boolean) => {
            if (success) alert('Profiles Exported Successfully!');
        };

        const importHandler = (_: any, success: boolean) => {
            if (success) alert('Profiles Imported Successfully!');
        };

        ipcRenderer.on('data-update', handler);
        ipcRenderer.on('export-complete', exportHandler);
        ipcRenderer.on('import-complete', importHandler);

        ipcRenderer.on('profile-changed', (_e: any, id: string) => {
            console.log('[useData] profile-changed event received. ID:', id);
            ipcRenderer.send('get-data');
        });

        return () => {
            ipcRenderer.removeListener('data-update', handler);
            ipcRenderer.removeListener('export-complete', exportHandler);
            ipcRenderer.removeListener('import-complete', importHandler);
        };
    }, []);

    const saveProfiles = (profiles: Profile[]) => {
        ipcRenderer.send('save-profiles', profiles);
    };

    const setActiveProfile = (id: string) => {
        ipcRenderer.send('set-active-profile', id);
    };

    const saveSettings = (settings: Settings) => {
        ipcRenderer.send('save-settings', settings);
    };

    const saveVariables = (variables: Record<string, string>) => {
        ipcRenderer.send('save-variables', variables);
    };

    const exportProfiles = () => {
        ipcRenderer.send('export-profiles');
    };

    const importProfiles = () => {
        ipcRenderer.send('import-profiles');
    };

    const setActivePage = (profileId: string, index: number) => {
        ipcRenderer.send('set-active-page', { profileId, index });
    };

    return { data, saveProfiles, setActiveProfile, setActivePage, saveSettings, saveVariables, exportProfiles, importProfiles };
}
