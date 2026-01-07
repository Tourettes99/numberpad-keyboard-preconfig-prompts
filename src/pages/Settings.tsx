import { useState, useEffect } from 'react';
import { useData } from '../hooks/useData';
import { Save, Download, Upload, ArrowLeft, Cpu, Database, Braces, FolderOpen, Plus, Trash2, Rocket } from 'lucide-react';
import { TitleBar } from '../components/TitleBar';
const { ipcRenderer } = window.require('electron');

export default function Settings() {
    const { data, saveSettings, saveVariables, exportProfiles, importProfiles } = useData();

    // Settings State
    const [apiKey, setApiKey] = useState('');
    const [os, setOs] = useState<'windows' | 'mac' | 'linux'>('windows');
    const [contextAware, setContextAware] = useState(false);
    const [dataPath, setDataPath] = useState('');

    // Variables State
    const [localVariables, setLocalVariables] = useState<{ key: string, value: string }[]>([]);
    const [newVarKey, setNewVarKey] = useState('');
    const [newVarValue, setNewVarValue] = useState('');

    useEffect(() => {
        if (data.settings) {
            setApiKey(data.settings.geminiApiKey || '');
            setOs(data.settings.os || 'windows');
            setContextAware(data.settings.contextAware || false);
            setDataPath(data.settings.dataPath || '');
        }
        if (data.variables) {
            setLocalVariables(Object.entries(data.variables).map(([key, value]) => ({ key, value })));
        }
    }, [data.settings, data.variables]);

    const handleSave = () => {
        // Save Settings
        saveSettings({
            os,
            geminiApiKey: apiKey,
            contextAware,
            dataPath
        });

        // Save Variables
        const varsObj = localVariables.reduce((acc, curr) => {
            if (curr.key) acc[curr.key] = curr.value;
            return acc;
        }, {} as Record<string, string>);
        saveVariables(varsObj);

        alert('Settings Saved!');
    };

    const handleAddVariable = () => {
        if (!newVarKey) return;
        setLocalVariables([...localVariables, { key: newVarKey, value: newVarValue }]);
        setNewVarKey('');
        setNewVarValue('');
    };

    const handleDeleteVariable = (key: string) => {
        setLocalVariables(localVariables.filter(v => v.key !== key));
    };

    return (
        <div className="flex flex-col h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden selection:bg-blue-500/30">
            <TitleBar />
            <div className="flex-1 flex relative overflow-hidden">
                {/* Background */}
                <div
                    className="absolute inset-0 pointer-events-none opacity-20"
                    style={{
                        background: `radial-gradient(circle at 80% 20%, #3b82f6, transparent 60%)`
                    }}
                />

                <div className="flex-1 flex flex-col relative z-10 max-w-4xl mx-auto w-full h-full overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <header className="flex items-center gap-4 mb-8">
                            <a href="#/" className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                                <ArrowLeft size={24} />
                            </a>
                            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                                Settings
                            </h1>
                        </header>

                        <div className="grid gap-8 pb-20">
                            {/* Dynamic Variables */}
                            <section className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-2xl">
                                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-purple-400">
                                    <Braces size={20} /> Dynamic Variables
                                </h2>
                                <p className="text-sm text-slate-400 mb-4">
                                    Define variables to use in your macros. Use <code className="bg-slate-800 px-1 py-0.5 rounded text-blue-300">{'#variable_name'}</code> in your prompts.
                                </p>

                                <div className="space-y-2 mb-4">
                                    {localVariables.map((v, i) => (
                                        <div key={i} className="flex gap-2">
                                            <input
                                                value={v.key}
                                                onChange={(e) => {
                                                    const newVars = [...localVariables];
                                                    newVars[i].key = e.target.value;
                                                    setLocalVariables(newVars);
                                                }}
                                                className="bg-black/40 border border-white/10 rounded px-3 py-2 text-blue-300 font-mono text-sm w-1/3 outline-none focus:border-blue-500"
                                                placeholder="Key (e.g. name)"
                                            />
                                            <input
                                                value={v.value}
                                                onChange={(e) => {
                                                    const newVars = [...localVariables];
                                                    newVars[i].value = e.target.value;
                                                    setLocalVariables(newVars);
                                                }}
                                                className="bg-black/40 border border-white/10 rounded px-3 py-2 text-slate-300 font-mono text-sm flex-1 outline-none focus:border-blue-500"
                                                placeholder="Value"
                                            />
                                            <button onClick={() => handleDeleteVariable(v.key)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-white/5 rounded">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-2 border-t border-white/5 pt-4">
                                    <input
                                        value={newVarKey}
                                        onChange={(e) => setNewVarKey(e.target.value)}
                                        className="bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-blue-300 font-mono text-sm w-1/3 outline-none focus:border-blue-500"
                                        placeholder="New Variable Name"
                                    />
                                    <input
                                        value={newVarValue}
                                        onChange={(e) => setNewVarValue(e.target.value)}
                                        className="bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-slate-300 font-mono text-sm flex-1 outline-none focus:border-blue-500"
                                        placeholder="Value"
                                    />
                                    <button onClick={handleAddVariable} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-bold flex items-center gap-2">
                                        <Plus size={16} /> Add
                                    </button>
                                </div>
                            </section>

                            {/* General Settings */}
                            <section className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-2xl">
                                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-blue-400">
                                    <Cpu size={20} /> System
                                </h2>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-2">Operating System</label>
                                        <select
                                            value={os}
                                            onChange={(e) => setOs(e.target.value as any)}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-blue-500 transition-colors"
                                        >
                                            <option value="windows">Windows (PowerShell)</option>
                                            <option value="mac">macOS (AppleScript)</option>
                                            <option value="linux">Linux (xdotool)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-2">Config Storage Path (Cloud Sync)</label>
                                        <div className="flex gap-2">
                                            <input
                                                value={dataPath}
                                                onChange={(e) => setDataPath(e.target.value)}
                                                placeholder="Leave empty for default..."
                                                className="flex-1 bg-black/40 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-blue-500 transition-colors font-mono text-sm"
                                            />
                                            <button className="p-3 bg-slate-800 border border-white/10 rounded-lg hover:bg-slate-700 text-slate-400" title="Select Folder (Not Implemented)">
                                                <FolderOpen size={20} />
                                            </button>
                                        </div>
                                        <p className="text-xs text-yellow-500/80 mt-2">
                                            ⚠️ Changing this will require a restart. Ensure the folder exists.
                                        </p>
                                    </div>
                                </div>
                            </section>

                            {/* Deployment */}
                            <section className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-2xl">
                                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-orange-400">
                                    <Rocket size={20} /> Deployment
                                </h2>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-medium text-slate-200">Desktop Shortcut</div>
                                        <div className="text-xs text-slate-500">Create a shortcut on your desktop to launch this app.</div>
                                    </div>
                                    <button
                                        onClick={() => ipcRenderer.send('create-desktop-shortcut')}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-white/10 transition-colors text-sm font-medium"
                                    >
                                        Create Shortcut
                                    </button>
                                </div>
                            </section>

                            {/* AI Settings */}
                            <section className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-2xl">
                                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-indigo-400">
                                    ✨ Gemini AI Assistant
                                </h2>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-2">API Key</label>
                                        <input
                                            type="password"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder="Enter your Gemini API Key..."
                                            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-blue-500 transition-colors placeholder:text-slate-700"
                                        />
                                    </div>

                                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/5">
                                        <input
                                            type="checkbox"
                                            id="contextAware"
                                            checked={contextAware}
                                            onChange={(e) => setContextAware(e.target.checked)}
                                            className="w-5 h-5 rounded border-gray-600 bg-black/40 text-blue-600 focus:ring-blue-500"
                                        />
                                        <label htmlFor="contextAware" className="cursor-pointer select-none">
                                            <div className="font-medium text-slate-200">Context Aware Generation</div>
                                            <div className="text-xs text-slate-500">Allow using clipboard content as context for generation</div>
                                        </label>
                                    </div>
                                </div>
                            </section>

                            {/* Data Management */}
                            <section className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-2xl">
                                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-green-400">
                                    <Database size={20} /> Data Management
                                </h2>

                                <div className="flex gap-4">
                                    <button
                                        onClick={exportProfiles}
                                        className="flex-1 flex items-center justify-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-white/5"
                                    >
                                        <Upload size={18} /> Export Presets (JSON)
                                    </button>
                                    <button
                                        onClick={importProfiles}
                                        className="flex-1 flex items-center justify-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-white/5"
                                    >
                                        <Download size={18} /> Import Presets (JSON)
                                    </button>
                                </div>
                            </section>

                            <button
                                onClick={handleSave}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 sticky bottom-4 z-50"
                            >
                                <Save size={20} /> Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
