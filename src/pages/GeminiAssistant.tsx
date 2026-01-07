import { useState } from 'react';
import { useData } from '../hooks/useData';
import { useGemini } from '../hooks/useGemini';
import { ArrowLeft, Sparkles, Send, Check, Clipboard } from 'lucide-react';

export default function GeminiAssistant() {
    const { data, saveProfiles } = useData();
    const { generatePage, isLoading: apiLoading } = useGemini();
    const [input, setInput] = useState('');
    const [targetPageIndex, setTargetPageIndex] = useState<number>(-1); // -1 = New Page
    const [generatedMap, setGeneratedMap] = useState<Record<string, string> | null>(null);
    const [useClipboard, setUseClipboard] = useState(data.settings?.contextAware || false);

    const apiKey = data.settings?.geminiApiKey;

    const handleGenerate = async () => {
        if (!input.trim() || !apiKey) return;
        setGeneratedMap(null);

        let context = '';
        if (useClipboard) {
            try {
                context = await navigator.clipboard.readText();
            } catch (e) {
                console.warn('Failed to read clipboard', e);
            }
        }

        const result = await generatePage(input, context);
        if (result) {
            setGeneratedMap(result);
        }
    };

    const handleApply = () => {
        if (!generatedMap) return;

        const activeProfile = data.profiles.find(p => p.id === data.activeProfileId);
        if (!activeProfile) return;

        let newPages;
        if (targetPageIndex === -1) {
            // Append new page
            newPages = [...activeProfile.pages, { prompts: generatedMap }];
        } else {
            // Merge into existing page
            newPages = activeProfile.pages.map((page, idx) => {
                if (idx === targetPageIndex) {
                    return {
                        ...page,
                        prompts: { ...page.prompts, ...generatedMap } // Wizard overwrites collisions
                    };
                }
                return page;
            });
        }

        const newProfiles = data.profiles.map(p => p.id === activeProfile.id ? { ...p, pages: newPages } : p);

        saveProfiles(newProfiles);
        alert(targetPageIndex === -1 ? 'Added as a new page!' : `Updated Page ${targetPageIndex + 1}!`);
        window.location.hash = ''; // Go back to dashboard
    };

    if (!apiKey) {
        return (
            <div className="h-screen flex items-center justify-center flex-col text-slate-400 gap-4 bg-[#0a0a0a]">
                <Sparkles size={48} className="text-slate-600" />
                <p>Gemini API Key is missing.</p>
                <a href="#/settings" className="text-blue-400 hover:underline">Go to Settings</a>
            </div>
        )
    }

    // Get active profile for selector
    const activeProfile = data.profiles.find(p => p.id === data.activeProfileId);

    return (
        <div className="flex h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden">
            <div
                className="absolute inset-0 pointer-events-none opacity-10"
                style={{ background: `radial-gradient(circle at 20% 80%, #a855f7, transparent 60%)` }}
            />

            <div className="flex-1 flex flex-col relative z-9 max-w-4xl mx-auto w-full p-8 h-full">
                <header className="flex items-center gap-4 mb-4">
                    <a href="#/" className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                        <ArrowLeft size={24} />
                    </a>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 flex items-center gap-3">
                        <Sparkles size={28} className="text-purple-400" />
                        Page Wizard
                    </h1>
                </header>

                <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                    {/* Chat Area */}
                    <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-2xl flex-1 flex flex-col min-h-0">
                        <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                            <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl text-purple-200 text-sm">
                                👋 Hi! formatting a keypad page? Tell me what you need.<br />
                                <i>"Standard email replies for customer support"</i><br />
                                <i>"Discord emotes for streams"</i>
                            </div>

                            {generatedMap && (
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 animate-in fade-in slide-in-from-bottom-4">
                                    <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Preview Generated Page</h3>
                                    <div className="grid grid-cols-3 gap-3 mb-4">
                                        {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(num => (
                                            <div key={num} className="bg-black/40 p-2 rounded border border-white/5 flex gap-2 items-center">
                                                <span className="font-mono text-purple-400 font-bold">{num}</span>
                                                <span className="text-xs truncate text-slate-300">{generatedMap[num] || '-'}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex gap-2 items-center">
                                        <button
                                            onClick={handleApply}
                                            className="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <Check size={16} /> {targetPageIndex === -1 ? 'Add as New Page' : 'Merge & Apply'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div className="relative">
                            <div className="flex items-center gap-2 mb-2 px-2">
                                <button
                                    onClick={() => setUseClipboard(!useClipboard)}
                                    className={`flex items-center gap-2 text-xs font-bold px-2 py-1 rounded transition-colors ${useClipboard ? 'bg-blue-600/20 text-blue-300' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <Clipboard size={12} />
                                    {useClipboard ? 'Clipboard Context ON' : 'Clipboard Context OFF'}
                                </button>

                                <select
                                    value={targetPageIndex}
                                    onChange={e => setTargetPageIndex(parseInt(e.target.value))}
                                    className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-slate-400 outline-none focus:border-purple-500 hover:text-white transition-colors"
                                >
                                    <option value={-1}>Target: New Page</option>
                                    {activeProfile?.pages.map((_, i) => (
                                        <option key={i} value={i}>Target: Page {i + 1}</option>
                                    ))}
                                </select>
                            </div>
                            <textarea
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder="Describe your keypad page..."
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 pr-12 text-white outline-none focus:border-purple-500 transition-colors resize-none h-24"
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleGenerate();
                                    }
                                }}
                            />
                            <button
                                onClick={handleGenerate}
                                disabled={apiLoading || !input.trim()}
                                className="absolute bottom-3 right-3 p-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-white transition-all hover:scale-110 active:scale-95"
                            >
                                {apiLoading ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Send size={20} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
