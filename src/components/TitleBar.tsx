import { Minus, Square, X } from 'lucide-react';
const { ipcRenderer } = window.require('electron');

export function TitleBar() {
    return (
        <div className="h-8 bg-black/20 backdrop-blur-md flex items-center justify-between pointer-events-auto select-none border-b border-white/5" style={{ WebkitAppRegion: 'drag' } as any}>
            <div className="px-4 text-[10px] font-bold text-slate-500 tracking-widest uppercase flex-1 flex items-center gap-2">
                <img src="./icon.ico" className="w-4 h-4 object-contain opacity-80" alt="App Icon" />
                Numpad Prompter
            </div>
            <div className="flex bg-black/20 h-full" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <button
                    onClick={() => ipcRenderer.send('window-minimize')}
                    className="w-10 h-full flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                >
                    <Minus size={14} />
                </button>
                <button
                    onClick={() => ipcRenderer.send('window-maximize')}
                    className="w-10 h-full flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                >
                    <Square size={12} />
                </button>
                <button
                    onClick={() => ipcRenderer.send('window-close')}
                    className="w-10 h-full flex items-center justify-center text-slate-400 hover:bg-red-500 hover:text-white transition-colors"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
}
