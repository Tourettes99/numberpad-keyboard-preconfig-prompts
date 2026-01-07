import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import Overlay from './pages/Overlay';
import Settings from './pages/Settings';
import GeminiAssistant from './pages/GeminiAssistant';

export default function App() {
    const [route, setRoute] = useState(window.location.hash);

    useEffect(() => {
        // Also check on mount just in case
        setRoute(window.location.hash);

        const handleHashChange = () => setRoute(window.location.hash);
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    if (route.includes('overlay')) {
        return <Overlay />;
    }

    if (route.includes('settings')) {
        return <Settings />;
    }

    if (route.includes('assistant')) {
        return <GeminiAssistant />;
    }

    return <Dashboard />;
}
