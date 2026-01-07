import { useState, useEffect, useRef } from 'react';
import { useData, Profile } from '../hooks/useData';
import { useGemini } from '../hooks/useGemini';
import { Plus, Trash2, Monitor, ArrowLeft, ArrowRight, Settings as SettingsIcon, Sparkles, Keyboard, Globe, Tag, Search, X, Folder } from 'lucide-react';
import { TitleBar } from '../components/TitleBar';
const { ipcRenderer } = window.require('electron');

// Helper to convert KeyboardEvent to Electron Accelerator
const getAccelerator = (e: React.KeyboardEvent | KeyboardEvent) => {
    const modifiers = [];
    if (e.ctrlKey) modifiers.push('Ctrl');
    if (e.metaKey) modifiers.push('Super');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');

    let key = e.key.toUpperCase();

    // Clean up key names
    if (key === 'CONTROL') return '';
    if (key === 'SHIFT') return '';
    if (key === 'ALT') return '';
    if (key === 'META') return '';
    if (key === ' ') key = 'Space';
    if (key === 'ARROWUP') key = 'Up';
    if (key === 'ARROWDOWN') key = 'Down';
    if (key === 'ARROWLEFT') key = 'Left';
    if (key === 'ARROWRIGHT') key = 'Right';

    // Handle Numpad specifically if needed, but 'key' usually returns '1' or 'End' etc.
    // e.code might be better for Numpad differentiation (Numpad1 vs Digit1)
    if (e.code.startsWith('NUMPAD')) { // Changed from Numpad to NUMPAD to match e.code
        key = 'Num' + e.code.replace('NUMPAD', '');
    } else if (e.code.startsWith('DIGIT')) { // Changed from Digit to DIGIT
        key = e.code.replace('DIGIT', ''); // 1, 2, 3
    } else if (e.code.startsWith('KEY')) { // Changed from Key to KEY
        key = e.code.replace('KEY', ''); // A, B, C
    }

    if (modifiers.length > 0) {
        return `${modifiers.join('+')} +${key} `;
    }
    return key;
};

export default function Dashboard() {
    const { data, saveProfiles, setActiveProfile, setActivePage } = useData();
    const { refineKey, isLoading: isRefining } = useGemini();
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
    const [recordingKey, setRecordingKey] = useState(false);
    const [newKeyData, setNewKeyData] = useState<{ code: string, isGlobal: boolean } | null>(null);
    const [refiningKeyId, setRefiningKeyId] = useState<string | null>(null);
    const [refiningInstructionKeyId, setRefiningInstructionKeyId] = useState<string | null>(null);
    const [instructionText, setInstructionText] = useState('');
    const [addingTagKeyId, setAddingTagKeyId] = useState<string | null>(null);
    const [newTagText, setNewTagText] = useState('');
    const [filterText, setFilterText] = useState('');
    const filterInputRef = useRef<HTMLInputElement>(null);

    // Grouping & Sidebar Filter
    const [sidebarFilter, setSidebarFilter] = useState('');
    const sidebarFilterRef = useRef<HTMLInputElement>(null);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null); // Profile ID being edited for group
    const [tempGroupName, setTempGroupName] = useState('');
    const [draggedProfileId, setDraggedProfileId] = useState<string | null>(null);

    useEffect(() => {
        const handleFocus = () => {
            sidebarFilterRef.current?.focus();
        };
        ipcRenderer.on('focus-group-filter', handleFocus);
        return () => {
            ipcRenderer.removeListener('focus-group-filter', handleFocus);
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey)) {
                if (e.key.toLowerCase() === 'f') {
                    e.preventDefault();
                    filterInputRef.current?.focus();
                }
                if (e.key.toLowerCase() === 'g') {
                    e.preventDefault();
                    sidebarFilterRef.current?.focus();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // If no selected profile, default to active
    const viewingId = selectedProfileId || data.activeProfileId;
    const viewingProfile = data.profiles.find(p => p.id === viewingId) || data.profiles[0];

    // Local state for editing prompts before save?
    // Or direct update? Direct update is friendlier for "preconfig" apps.
    // But we need to update the `profiles` array.

    const handleUpdateProfile = (updatedProfile: Profile) => {
        const newProfiles = data.profiles.map(p => p.id === updatedProfile.id ? updatedProfile : p);
        saveProfiles(newProfiles);
    };

    const handleAddProfile = () => {
        const newProfile: Profile = {
            id: crypto.randomUUID(),
            name: 'New Profile',
            color: '#10b981', // green
            globalPrompts: {},
            pages: [{ prompts: {} }]
        };
        saveProfiles([...data.profiles, newProfile]);
        setSelectedProfileId(newProfile.id);
    };

    const handleDeleteProfile = (id: string) => {
        if (data.profiles.length <= 1) return; // Prevent deleting last
        const newProfiles = data.profiles.filter(p => p.id !== id);
        saveProfiles(newProfiles);
        if (selectedProfileId === id) setSelectedProfileId(null);
    };

    const [localPageIndex, setLocalPageIndex] = useState(0);

    // Sync local page index if switching profiles?
    // Maybe just reset to 0 when profile changes.
    // 1. Reset/Sync when switching WHICH profile we view
    useEffect(() => {
        console.log('[Dashboard] Viewing Profile Changed. ID:', viewingId);
        if (viewingId === data.activeProfileId) {
            setLocalPageIndex(data.activePageIndices[viewingId] || 0);
        } else {
            setLocalPageIndex(0);
        }
    }, [viewingId]);

    // 2. Sync whenever global backend index changes (e.g. via hotkey), BUT only if we are viewing the active profile
    useEffect(() => {
        if (viewingId === data.activeProfileId) {
            const globalIndex = data.activePageIndices[viewingId] || 0;
            if (localPageIndex !== globalIndex) {
                console.log('[Dashboard] Global Index changed. Syncing local to:', globalIndex);
                setLocalPageIndex(globalIndex);
            }
        }
    }, [data.activePageIndices, data.activeProfileId]); // removed viewingId from dependency to avoid double-fire, though viewingId is in closure

    // Global Key Listener for Recording
    useEffect(() => {
        if (!recordingKey) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const accelerator = getAccelerator(e);
            if (accelerator) {
                setNewKeyData({ code: accelerator, isGlobal: false });
                setRecordingKey(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [recordingKey]);

    if (!viewingProfile) return <div className="p-10">Loading...</div>;

    const currentPage = viewingProfile.pages[localPageIndex] || { prompts: {} };
    // Ensure globalPrompts exists (migration fallback)
    const globalPrompts = viewingProfile.globalPrompts || {};
    const globalTags = viewingProfile.globalTags || {};

    const handlePromptChange = (key: string, text: string, isGlobal: boolean) => {
        if (isGlobal) {
            handleUpdateProfile({
                ...viewingProfile,
                globalPrompts: { ...globalPrompts, [key]: text }
            });
        } else {
            const newPages = [...viewingProfile.pages];
            if (!newPages[localPageIndex]) newPages[localPageIndex] = { prompts: {}, tags: {} };

            newPages[localPageIndex] = {
                ...newPages[localPageIndex],
                prompts: { ...newPages[localPageIndex].prompts, [key]: text }
            };
            handleUpdateProfile({ ...viewingProfile, pages: newPages });
        }
    };

    const handleTagChange = (key: string, tag: string, isGlobal: boolean, action: 'add' | 'remove') => {
        if (isGlobal) {
            const currentTags = globalTags[key] || [];
            let newTags = [...currentTags];
            if (action === 'add') {
                if (!newTags.includes(tag)) newTags.push(tag);
            } else {
                newTags = newTags.filter(t => t !== tag);
            }
            handleUpdateProfile({
                ...viewingProfile,
                globalTags: { ...globalTags, [key]: newTags }
            });
        } else {
            const newPages = [...viewingProfile.pages];
            if (!newPages[localPageIndex]) newPages[localPageIndex] = { prompts: {}, tags: {} };

            const pageTags = newPages[localPageIndex].tags || {};
            const currentTags = pageTags[key] || [];
            let newTags = [...currentTags];

            if (action === 'add') {
                if (!newTags.includes(tag)) newTags.push(tag);
            } else {
                newTags = newTags.filter(t => t !== tag);
            }

            newPages[localPageIndex] = {
                ...newPages[localPageIndex],
                tags: { ...pageTags, [key]: newTags }
            };
            handleUpdateProfile({ ...viewingProfile, pages: newPages });
        }
    };

    const handleDeleteKey = (key: string, isGlobal: boolean) => {
        if (isGlobal) {
            const newGlobals = { ...globalPrompts };
            delete newGlobals[key];
            handleUpdateProfile({ ...viewingProfile, globalPrompts: newGlobals });
        } else {
            const newPages = [...viewingProfile.pages];
            const newPrompts = { ...newPages[localPageIndex].prompts };
            delete newPrompts[key];
            newPages[localPageIndex] = { ...newPages[localPageIndex], prompts: newPrompts };
            handleUpdateProfile({ ...viewingProfile, pages: newPages });
        }
    };

    const handleSetGroup = (profileId: string, groupName: string) => {
        const profile = data.profiles.find(p => p.id === profileId);
        if (profile) {
            const newGroupName = groupName.trim();
            handleUpdateProfile({ ...profile, group: newGroupName || undefined });
        }
        setEditingGroupId(null);
    };

    const handleDragStart = (e: React.DragEvent, profileId: string) => {
        setDraggedProfileId(profileId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetGroupName: string) => {
        e.preventDefault();
        if (!draggedProfileId) return;

        // Don't do anything if dropping onto same group logic but we just need ID
        // Actually, logic is simple: update dragged profile to have targetGroupName
        const targetGroup = targetGroupName === 'Uncategorized' ? undefined : targetGroupName;
        handleSetGroup(draggedProfileId, targetGroup || '');
        setDraggedProfileId(null);
    };

    const handleStartRecording = () => {
        setRecordingKey(true);
        setNewKeyData(null);
    };

    const handleAddKey = () => {
        if (!newKeyData) return;
        // Init with empty string
        handlePromptChange(newKeyData.code, '', newKeyData.isGlobal);
        setNewKeyData(null);
    };

    const handleAddPage = () => {
        const newPages = [...viewingProfile.pages, { prompts: {} }];
        const newIndex = newPages.length - 1;

        handleUpdateProfile({ ...viewingProfile, pages: newPages });
        setLocalPageIndex(newIndex);

        if (isActive) {
            console.log('[Dashboard] Added page to active profile. Syncing backend to:', newIndex);
            setActivePage(viewingProfile.id, newIndex);
        }
    };

    const handleClearPage = () => {
        if (confirm('Are you sure you want to clear all prompts on this page?')) {
            const newPages = [...viewingProfile.pages];
            newPages[localPageIndex] = { prompts: {} };
            handleUpdateProfile({ ...viewingProfile, pages: newPages });
        }
    };

    const isActive = viewingProfile.id === data.activeProfileId;
    const filter = filterText.toLowerCase();

    return (
        <div className="flex flex-col h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden selection:bg-blue-500/30">
            <TitleBar />
            <div className="flex-1 flex overflow-hidden relative">
                {/* Ambient Background Gradient */}
                <div
                    className="absolute inset-0 pointer-events-none transition-colors duration-700 ease-in-out opacity-20"
                    style={{
                        background: `radial-gradient(circle at 70% 30%, ${viewingProfile.color}, transparent 60%),
    radial-gradient(circle at 10% 80%, ${viewingProfile.color}40, transparent 50%)`
                    }}
                />

                {/* Sidebar */}
                <div className="w-72 relative z-10 flex flex-col bg-slate-900/50 backdrop-blur-xl border-r border-white/5">
                    <div className="p-6">
                        <h2 className="text-2xl font-bold flex items-center gap-3 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                            <Monitor className="text-blue-400" size={24} />
                            Prompter
                        </h2>
                        <p className="text-xs text-slate-500 mt-2 font-medium">NUMPAD MACRO SYSTEM</p>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 space-y-4 py-2">
                        <div className="relative px-2 mb-2">
                            <Search size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                ref={sidebarFilterRef}
                                value={sidebarFilter}
                                onChange={e => setSidebarFilter(e.target.value)}
                                placeholder="Filter / Group (Ctrl+G)"
                                className="w-full bg-black/40 border border-white/5 rounded-lg pl-8 pr-2 py-1.5 text-xs text-slate-400 focus:text-white focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-600"
                            />
                        </div>

                        {[...new Set(data.profiles.map(p => p.group || 'Uncategorized'))].sort().map(groupName => {
                            const groupProfiles = data.profiles.filter(p => (p.group || 'Uncategorized') === groupName);
                            // Filter by sidebar search
                            const filteredProfiles = groupProfiles.filter(p =>
                                p.name.toLowerCase().includes(sidebarFilter.toLowerCase()) ||
                                (p.group || '').toLowerCase().includes(sidebarFilter.toLowerCase())
                            );

                            if (filteredProfiles.length === 0) return null;

                            return (
                                <div
                                    key={groupName}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, groupName)}
                                >
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-1 flex items-center gap-2 hover:text-white transition-colors cursor-default">
                                        {groupName !== 'Uncategorized' && <Folder size={10} />}
                                        {groupName}
                                    </div>
                                    <div className="space-y-1">
                                        {filteredProfiles.map(p => (
                                            <div
                                                key={p.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, p.id)}
                                                onClick={() => setSelectedProfileId(p.id)}
                                                className={`group relative p-3 rounded-xl cursor-pointer transition-all duration-200 border border-transparent
                                                ${viewingId === p.id
                                                        ? 'bg-white/10 border-white/10 shadow-lg'
                                                        : 'hover:bg-white/5 hover:border-white/5'
                                                    } ${draggedProfileId === p.id ? 'opacity-50' : ''}`}
                                            >
                                                <div className="flex items-center gap-3 relative z-10">
                                                    <div
                                                        className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] transition-all duration-300 ${viewingId === p.id ? 'scale-110' : 'opacity-70'}`}
                                                        style={{ backgroundColor: p.color, color: p.color }}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`font-medium truncate transition-colors ${viewingId === p.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                                            {p.name}
                                                        </div>
                                                        {editingGroupId === p.id ? (
                                                            <input
                                                                autoFocus
                                                                value={tempGroupName}
                                                                onChange={e => setTempGroupName(e.target.value)}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') handleSetGroup(p.id, tempGroupName);
                                                                    if (e.key === 'Escape') setEditingGroupId(null);
                                                                }}
                                                                onBlur={() => handleSetGroup(p.id, tempGroupName)}
                                                                className="w-full bg-black/50 text-[10px] rounded px-1 py-0.5 text-white border border-blue-500 mt-1 outline-none"
                                                                placeholder="Group Name..."
                                                            />
                                                        ) : (
                                                            <div className="flex items-center justify-between">
                                                                {p.id === data.activeProfileId ? (
                                                                    <div className="text-[10px] text-blue-400 font-bold tracking-wider mt-0.5 flex items-center gap-1">
                                                                        <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" /> ACTIVE
                                                                    </div>
                                                                ) : <div className="h-4" />}

                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingGroupId(p.id);
                                                                setTempGroupName(p.group || '');
                                                            }}
                                                            className="p-1.5 text-slate-500 hover:text-blue-400 rounded hover:bg-white/5"
                                                            title="Set Group"
                                                        >
                                                            <Folder size={14} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (confirm(`Delete profile "${p.name}"?`)) {
                                                                    handleDeleteProfile(p.id);
                                                                }
                                                            }}
                                                            className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-white/5"
                                                            title="Delete Profile"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                                {/* Active Indicator Bar */}
                                                {viewingId === p.id && (
                                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-transparent via-blue-500 to-transparent rounded-r-full opacity-50" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-md flex flex-col gap-2">
                        <button
                            onClick={handleAddProfile}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Plus size={18} /> New Profile
                        </button>
                        <a href="#/assistant" className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-semibold border border-purple-500/20 transition-all hover:scale-[1.02]">
                            <Sparkles size={18} /> Page Wizard
                        </a>
                        <a href="#/settings" className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm">
                            <SettingsIcon size={16} /> Settings
                        </a>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col relative z-0 overflow-hidden">
                    {/* Header */}
                    <header className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-black/20 backdrop-blur-md">
                        <div className="flex items-center gap-6">
                            <div className="group relative">
                                <input
                                    value={viewingProfile.name}
                                    onChange={(e) => handleUpdateProfile({ ...viewingProfile, name: e.target.value })}
                                    className="bg-transparent text-3xl font-bold text-white placeholder-slate-600 outline-none w-64 border-b-2 border-transparent focus:border-white/20 transition-all pb-1"
                                />
                                <div className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-blue-500 transition-all group-focus-within:w-full" />
                            </div>
                            <div className="relative group">
                                <div
                                    className="w-8 h-8 rounded-full cursor-pointer ring-2 ring-white/10 group-hover:scale-110 transition-transform shadow-lg"
                                    style={{ backgroundColor: viewingProfile.color }}
                                />
                                <input
                                    type="color"
                                    value={viewingProfile.color}
                                    onChange={(e) => handleUpdateProfile({ ...viewingProfile, color: e.target.value })}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Filter Bar */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                <input
                                    ref={filterInputRef}
                                    value={filterText}
                                    onChange={e => setFilterText(e.target.value)}
                                    placeholder="Filter keys... (Ctrl+F)"
                                    className="pl-9 pr-8 py-2 bg-slate-800/50 border border-white/5 rounded-lg text-sm focus:border-blue-500/50 outline-none w-48 transition-all focus:w-64"
                                />
                                {filterText && <button onClick={() => setFilterText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X size={14} /></button>}
                            </div>

                            {!isActive ? (
                                <button
                                    onClick={() => setActiveProfile(viewingProfile.id)}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-all hover:ring-2 ring-blue-500/50"
                                >
                                    <span className="w-2 h-2 rounded-full bg-slate-500" /> Set Active (Ctrl+P)
                                </button>
                            ) : (
                                <div className="flex items-center gap-2 px-5 py-2.5 bg-blue-500/10 text-blue-400 rounded-lg font-bold border border-blue-500/20">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Currently Active
                                </div>
                            )}
                        </div>
                    </header>

                    {/* Content Area */}
                    <main className="flex-1 p-8 overflow-y-auto">
                        {/* Add Key Bar */}
                        <div className="mb-6 p-4 bg-slate-900/40 rounded-xl border border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                                {newKeyData ? (
                                    <div className="flex items-center gap-3">
                                        <div className="px-3 py-1 bg-blue-500 rounded text-sm font-bold">{newKeyData.code}</div>
                                        <div className="flex items-center gap-2 text-sm text-slate-300">
                                            <input
                                                type="checkbox"
                                                checked={newKeyData.isGlobal}
                                                onChange={e => setNewKeyData({ ...newKeyData, isGlobal: e.target.checked })}
                                                className="rounded border-white/20 bg-black/40"
                                            />
                                            <span>Apply to all pages in this profile</span>
                                        </div>
                                        <button
                                            onClick={handleAddKey}
                                            className="px-4 py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm font-bold"
                                        >
                                            Add Key
                                        </button>
                                        <button
                                            onClick={() => setNewKeyData(null)}
                                            className="px-3 py-1.5 hover:bg-white/10 rounded text-sm text-slate-400"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleStartRecording}
                                        className={`px - 4 py - 2 rounded - lg font - bold flex items - center gap - 2 transition - all ${recordingKey ? 'bg-red-500/20 text-red-400 animate-pulse ring-2 ring-red-500' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'} `}
                                    >
                                        <Keyboard size={18} />
                                        {recordingKey ? 'Press any key...' : 'Add New Key Binding'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Page Navigation */}
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/5 backdrop-blur-sm">
                                <button
                                    disabled={localPageIndex === 0}
                                    onClick={() => {
                                        console.log('[Dashboard] Prev Page Clicked');
                                        const newIndex = localPageIndex - 1;
                                        setLocalPageIndex(newIndex);
                                        if (isActive) {
                                            console.log('[Dashboard] Updating backend active page to:', newIndex);
                                            setActivePage(viewingProfile.id, newIndex);
                                        }
                                    }}
                                    className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-300"
                                >
                                    <ArrowLeft size={18} />
                                </button>
                                <div className="px-4 py-1 font-mono font-bold text-sm text-blue-400">
                                    PAGE <span className="text-xl text-white ml-2">{localPageIndex + 1}</span>
                                </div>
                                <button
                                    onClick={() => {
                                        console.log('[Dashboard] Next Page Clicked');
                                        if (localPageIndex < viewingProfile.pages.length - 1) {
                                            const newIndex = localPageIndex + 1;
                                            setLocalPageIndex(newIndex);
                                            if (isActive) {
                                                console.log('[Dashboard] Updating backend active page to:', newIndex);
                                                setActivePage(viewingProfile.id, newIndex);
                                            }
                                        } else {
                                            console.log('[Dashboard] Adding new page');
                                            handleAddPage();
                                        }
                                    }}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-300"
                                >
                                    <ArrowRight size={18} />
                                </button>
                            </div>

                            <button
                                onClick={handleClearPage}
                                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition-colors text-sm font-bold"
                                title="Clear all prompts on this page"
                            >
                                <Trash2 size={16} /> Clear Page
                            </button>

                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
                                <span className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 border border-white/10">Ctrl</span> + <span className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 border border-white/10">arrows</span> to switch pages
                            </div>
                        </div>

                        {/* Numpad Grid (Visual) */}
                        {/* Filter out keys that are NOT Numpad 1-9 so we don't duplicate them in the Custom list if they exist in the grid? */}
                        {/* Actually, user might want to see everything. Let's show Standard Grid, then "Custom Keys" */}

                        <div className="grid grid-cols-3 gap-5 max-w-4xl mx-auto mb-10">
                            {['Num7', 'Num8', 'Num9', 'Num4', 'Num5', 'Num6', 'Num1', 'Num2', 'Num3'].map(num => {
                                // Fallback for migration: Check '7' if 'Num7' is missing
                                const digit = num.replace('Num', '');
                                const val = currentPage.prompts[num] || currentPage.prompts[digit] || globalPrompts[num] || globalPrompts[digit] || '';
                                const isGlo = !!(globalPrompts[num] || globalPrompts[digit]);
                                const tags = (isGlo ? globalTags[num] : currentPage.tags?.[num]) || [];

                                if (filter && !val.toLowerCase().includes(filter) && !num.toLowerCase().includes(filter) && !tags.some(t => t.toLowerCase().includes(filter))) return null;

                                return (
                                    <div
                                        key={num}
                                        className="group relative bg-slate-800/40 hover:bg-slate-800/60 border border-white/5 hover:border-blue-500/30 rounded-2xl p-5 h-44 flex flex-col transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.15)] hover:-translate-y-1 focus-within:ring-2 ring-blue-500/50 ring-offset-2 ring-offset-[#0a0a0a]"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center font-black text-xl text-slate-500 group-hover:text-white group-focus-within:text-blue-400 group-focus-within:bg-blue-500/10 transition-colors border border-white/5">
                                                {digit}
                                            </div>
                                            <div className='flex items-center gap-2'>
                                                {isGlo && <Globe size={12} className="text-blue-400" />}
                                                <span className="text-[10px] font-bold text-slate-600 tracking-wider group-hover:text-slate-400 transition-colors">{num.toUpperCase()}</span>

                                                {/* Refine Button */}
                                                {data.settings?.geminiApiKey && (
                                                    <div className="relative">
                                                        <button
                                                            onClick={() => {
                                                                if (refiningInstructionKeyId === num) {
                                                                    setRefiningInstructionKeyId(null);
                                                                } else {
                                                                    setRefiningInstructionKeyId(num);
                                                                    setInstructionText('');
                                                                }
                                                            }}
                                                            className="p-1 text-slate-600 hover:text-purple-400 hover:bg-purple-500/10 rounded transition-colors ml-1"
                                                            title="Refine with AI"
                                                        >
                                                            {isRefining && refiningKeyId === num ? (
                                                                <div className="w-3 h-3 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                                                            ) : (
                                                                <Sparkles size={12} />
                                                            )}
                                                        </button>

                                                        {/* Inline Instruction Input */}
                                                        {refiningInstructionKeyId === num && (
                                                            <div className="absolute top-8 left-0 z-50 bg-slate-800 border border-purple-500/30 rounded-lg p-2 shadow-xl flex gap-2 w-64 animate-in fade-in zoom-in-95 duration-200">
                                                                <input
                                                                    autoFocus
                                                                    value={instructionText}
                                                                    onChange={e => setInstructionText(e.target.value)}
                                                                    onKeyDown={async e => {
                                                                        if (e.key === 'Enter') {
                                                                            const instruction = instructionText.trim() || 'Improve this';
                                                                            setRefiningInstructionKeyId(null);
                                                                            setRefiningKeyId(num);

                                                                            // Gather neighbors context
                                                                            const neighbors: Record<string, string> = {};
                                                                            ['Num1', 'Num2', 'Num3', 'Num4', 'Num5', 'Num6', 'Num7', 'Num8', 'Num9'].forEach(k => {
                                                                                if (k !== num) {
                                                                                    const d = k.replace('Num', '');
                                                                                    const v = currentPage.prompts[k] || currentPage.prompts[d] || globalPrompts[k] || globalPrompts[d];
                                                                                    if (v) neighbors[k] = v;
                                                                                }
                                                                            });

                                                                            let context = '';
                                                                            if (data.settings?.contextAware) {
                                                                                try { context = await navigator.clipboard.readText(); } catch (e) { console.warn(e); }
                                                                            }

                                                                            const result = await refineKey(val, neighbors, instruction, context);
                                                                            if (result) {
                                                                                handlePromptChange(currentPage.prompts[num] ? num : (currentPage.prompts[digit] ? digit : num), result, isGlo);
                                                                            }
                                                                            setRefiningKeyId(null);
                                                                        } else if (e.key === 'Escape') {
                                                                            setRefiningInstructionKeyId(null);
                                                                        }
                                                                    }}
                                                                    placeholder="AI Instruction (e.g. 'Make it shorter')..."
                                                                    className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-purple-500"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Add Tag Button */}
                                                <div className="relative">
                                                    <button
                                                        onClick={() => {
                                                            if (addingTagKeyId === num) {
                                                                setAddingTagKeyId(null);
                                                            } else {
                                                                setAddingTagKeyId(num);
                                                                setNewTagText('');
                                                            }
                                                        }}
                                                        className={`p-1 rounded transition-colors ml-1 ${addingTagKeyId === num ? 'bg-blue-500 text-white' : 'text-slate-600 hover:text-blue-400 hover:bg-blue-500/10'}`}
                                                        title="Add Tag"
                                                    >
                                                        <Tag size={12} />
                                                    </button>

                                                    {/* Inline Tag Input Popover */}
                                                    {addingTagKeyId === num && (
                                                        <div className="absolute top-8 left-0 z-50 bg-slate-800 border border-blue-500/30 rounded-lg p-2 shadow-xl flex gap-2 w-48 animate-in fade-in zoom-in-95 duration-200">
                                                            <input
                                                                autoFocus
                                                                value={newTagText}
                                                                onChange={e => setNewTagText(e.target.value)}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter' && newTagText.trim()) {
                                                                        handleTagChange(num, newTagText.trim(), isGlo, 'add');
                                                                        setAddingTagKeyId(null);
                                                                    } else if (e.key === 'Escape') {
                                                                        setAddingTagKeyId(null);
                                                                    }
                                                                }}
                                                                placeholder="New tag..."
                                                                className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    if (newTagText.trim()) {
                                                                        handleTagChange(num, newTagText.trim(), isGlo, 'add');
                                                                        setAddingTagKeyId(null);
                                                                    }
                                                                }}
                                                                className="bg-blue-600 hover:bg-blue-500 text-white p-1 rounded"
                                                            >
                                                                <Plus size={12} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Clear Prompt Button */}
                                                {val && (
                                                    <button
                                                        onClick={() => handlePromptChange(currentPage.prompts[num] ? num : (currentPage.prompts[digit] ? digit : num), '', isGlo)}
                                                        className="p-1 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors ml-1"
                                                        title="Clear this key"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <textarea
                                            className="flex-1 bg-transparent w-full resize-none outline-none text-sm text-slate-200 placeholder-slate-700/50 leading-relaxed custom-scrollbar"
                                            placeholder={`Enter text prompt...`}
                                            value={val}
                                            onChange={(e) => handlePromptChange(currentPage.prompts[num] ? num : (currentPage.prompts[digit] ? digit : num), e.target.value, isGlo)}
                                            spellCheck={false}
                                        />
                                        {/* Tags Display */}
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {tags.map(tag => (
                                                <span key={tag} onClick={() => handleTagChange(num, tag, isGlo, 'remove')} className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] rounded hover:bg-red-500/20 hover:text-red-400 cursor-pointer transition-colors border border-blue-500/10">{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Custom Keys List */}
                        <div className="max-w-4xl mx-auto">
                            <h3 className="text-lg font-bold text-slate-400 mb-4 flex items-center gap-2"><Keyboard size={20} /> Custom Bindings</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {/* Merge Global and Page keys, filter out Numpad 1-9 to avoid duplication in this list */}
                                {(() => {
                                    const standardKeys = new Set(['Num1', 'Num2', 'Num3', 'Num4', 'Num5', 'Num6', 'Num7', 'Num8', 'Num9', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
                                    const allKeys = Array.from(new Set([...Object.keys(currentPage.prompts), ...Object.keys(globalPrompts)]));
                                    const customKeys = allKeys.filter(k => !standardKeys.has(k));

                                    return customKeys.map(key => {
                                        const isGlo = !!globalPrompts[key];
                                        const val = currentPage.prompts[key] || globalPrompts[key] || '';
                                        const tags = (isGlo ? globalTags[key] : currentPage.tags?.[key]) || [];
                                        if (filter && !val.toLowerCase().includes(filter) && !key.toLowerCase().includes(filter) && !tags.some(t => t.toLowerCase().includes(filter))) return null;

                                        return (
                                            <div key={key} className="bg-slate-800/40 border border-white/5 rounded-xl p-4 flex flex-col gap-2 relative group hover:border-white/20 transition-colors">
                                                <div className="flex justify-between items-center">
                                                    <div className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-bold font-mono border border-blue-500/20">
                                                        {key}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {isGlo && <div title="Global Key"><Globe size={14} className="text-blue-400" /></div>}

                                                        {/* Refine Button */}
                                                        {data.settings?.geminiApiKey && (
                                                            <div className="relative">
                                                                <button
                                                                    onClick={() => {
                                                                        if (refiningInstructionKeyId === key) {
                                                                            setRefiningInstructionKeyId(null);
                                                                        } else {
                                                                            setRefiningInstructionKeyId(key);
                                                                            setInstructionText('');
                                                                        }
                                                                    }}
                                                                    className="text-slate-600 hover:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    title="Refine with AI"
                                                                >
                                                                    {isRefining && refiningKeyId === key ? (
                                                                        <div className="w-3 h-3 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                                                                    ) : (
                                                                        <Sparkles size={16} />
                                                                    )}
                                                                </button>

                                                                {/* Inline Instruction Input */}
                                                                {refiningInstructionKeyId === key && (
                                                                    <div className="absolute top-8 right-0 z-50 bg-slate-800 border border-purple-500/30 rounded-lg p-2 shadow-xl flex gap-2 w-64 animate-in fade-in zoom-in-95 duration-200">
                                                                        <input
                                                                            autoFocus
                                                                            value={instructionText}
                                                                            onChange={e => setInstructionText(e.target.value)}
                                                                            onKeyDown={async e => {
                                                                                if (e.key === 'Enter') {
                                                                                    const instruction = instructionText.trim() || 'Improve this';
                                                                                    setRefiningInstructionKeyId(null);
                                                                                    setRefiningKeyId(key);

                                                                                    const neighbors = { ...currentPage.prompts, ...globalPrompts };
                                                                                    delete neighbors[key];

                                                                                    let context = '';
                                                                                    if (data.settings?.contextAware) {
                                                                                        try { context = await navigator.clipboard.readText(); } catch (e) { console.warn(e); }
                                                                                    }

                                                                                    const result = await refineKey(val, neighbors, instruction, context);
                                                                                    if (result) {
                                                                                        handlePromptChange(key, result, isGlo);
                                                                                    }
                                                                                    setRefiningKeyId(null);
                                                                                } else if (e.key === 'Escape') {
                                                                                    setRefiningInstructionKeyId(null);
                                                                                }
                                                                            }}
                                                                            placeholder="AI Instruction..."
                                                                            className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-purple-500"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Add Tag Button */}
                                                        <div className="relative">
                                                            <button
                                                                onClick={() => {
                                                                    if (addingTagKeyId === key) {
                                                                        setAddingTagKeyId(null);
                                                                    } else {
                                                                        setAddingTagKeyId(key);
                                                                        setNewTagText('');
                                                                    }
                                                                }}
                                                                className={`text-slate-600 hover:text-blue-400 transition-opacity ${addingTagKeyId === key ? 'opacity-100 text-blue-500' : 'opacity-0 group-hover:opacity-100'}`}
                                                                title="Add Tag"
                                                            >
                                                                <Tag size={16} />
                                                            </button>

                                                            {/* Inline Tag Input Popover */}
                                                            {addingTagKeyId === key && (
                                                                <div className="absolute top-8 right-0 z-50 bg-slate-800 border border-blue-500/30 rounded-lg p-2 shadow-xl flex gap-2 w-48 animate-in fade-in zoom-in-95 duration-200">
                                                                    <input
                                                                        autoFocus
                                                                        value={newTagText}
                                                                        onChange={e => setNewTagText(e.target.value)}
                                                                        onKeyDown={e => {
                                                                            if (e.key === 'Enter' && newTagText.trim()) {
                                                                                handleTagChange(key, newTagText.trim(), isGlo, 'add');
                                                                                setAddingTagKeyId(null);
                                                                            } else if (e.key === 'Escape') {
                                                                                setAddingTagKeyId(null);
                                                                            }
                                                                        }}
                                                                        placeholder="New tag..."
                                                                        className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                                                                    />
                                                                    <button
                                                                        onClick={() => {
                                                                            if (newTagText.trim()) {
                                                                                handleTagChange(key, newTagText.trim(), isGlo, 'add');
                                                                                setAddingTagKeyId(null);
                                                                            }
                                                                        }}
                                                                        className="bg-blue-600 hover:bg-blue-500 text-white p-1 rounded"
                                                                    >
                                                                        <Plus size={12} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <button
                                                            onClick={() => handleDeleteKey(key, isGlo)}
                                                            className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <textarea
                                                    className="w-full bg-transparent resize-none outline-none text-sm text-slate-300 placeholder-slate-600 h-20 custom-scrollbar"
                                                    placeholder="Enter prompt..."
                                                    value={val}
                                                    onChange={(e) => handlePromptChange(key, e.target.value, isGlo)}
                                                />
                                                {/* Tags Display */}
                                                <div className="flex flex-wrap gap-1">
                                                    {tags.map(tag => (
                                                        <span key={tag} onClick={() => handleTagChange(key, tag, isGlo, 'remove')} className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] rounded hover:bg-red-500/20 hover:text-red-400 cursor-pointer transition-colors border border-blue-500/10">{tag}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })
                                })()}
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
