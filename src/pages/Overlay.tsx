import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// import { ipcRenderer } from ... (hook)

const getIpc = () => (window as any).require('electron').ipcRenderer;

interface Alert {
    message: string;
    subMessage?: string;
    color: string;
}

export default function Overlay() {
    const [alert, setAlert] = useState<Alert | null>(null);

    useEffect(() => {
        const ipc = getIpc();
        const handler = (_: any, data: Alert) => {
            setAlert(data);
            // Auto hide after 2 seconds (visual only, actual window hide logic could be separate but usually unnecessary if transparent)
            // Actually main process keeps window open but clicks pass through. 
            // We just clear content.
            setTimeout(() => setAlert(null), 3000);
        };
        ipc.on('show-overlay', handler);
        return () => {
            ipc.removeListener('show-overlay', handler);
        };
    }, []);

    return (
        <div className="w-full h-full flex justify-center items-start pt-4 overflow-hidden bg-transparent">
            <AnimatePresence>
                {alert && (
                    <motion.div
                        initial={{ y: -50, opacity: 0, scale: 0.9 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: -50, opacity: 0, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className="px-8 py-4 rounded-2xl shadow-2xl flex flex-col items-center bg-slate-900/90 backdrop-blur-xl border border-white/10"
                        style={{
                            boxShadow: `0 8px 32px -8px ${alert.color}40, 0 0 0 1px ${alert.color}20` // Clean glow
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className="w-2.5 h-2.5 rounded-full animate-pulse shadow-[0_0_8px_currentColor]"
                                style={{ backgroundColor: alert.color, color: alert.color }}
                            />
                            <span className="text-xl font-bold text-white tracking-wide">{alert.message}</span>
                        </div>
                        {alert.subMessage && (
                            <span className="text-[10px] uppercase font-bold text-white/50 tracking-[0.2em] mt-1">{alert.subMessage}</span>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
