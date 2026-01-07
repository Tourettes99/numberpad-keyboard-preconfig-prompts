import { useState } from 'react';
import { useData } from './useData';

export function useGemini() {
    const { data } = useData();
    const apiKey = data.settings?.geminiApiKey;
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generatePage = async (description: string, context?: string): Promise<Record<string, string> | null> => {
        if (!apiKey) {
            setError('API Key is missing');
            return null;
        }

        setIsLoading(true);
        setError(null);

        try {
            const systemPrompt = `You are a helper for a Numpad Macro app. The user will give you a topic or a list of items. 
            You must output a JSON object where keys are numbers "1" through "9" (or fewer) and values are the text to be pasted. 
            Example Output: { "1": "Hello", "2": "World" }. 
            Do NOT include markdown formatting like \`\`\`json. Just the raw JSON string.`;

            let prompt = `User Request: ${description}`;
            if (context) {
                prompt += `\n\nAdditional Context (Clipboard/Background): ${context}`;
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: `${systemPrompt}\n\n${prompt}` }]
                    }]
                })
            });

            const result = await response.json();
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                return JSON.parse(cleanText);
            }
            return null;
        } catch (err) {
            console.error(err);
            setError('Failed to generate');
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const refineKey = async (currentPrompt: string, neighbors: Record<string, string>, userRequest?: string, context?: string): Promise<string | null> => {
        if (!apiKey) {
            setError('API Key is missing');
            return null;
        }

        setIsLoading(true);
        setError(null);

        try {
            const systemPrompt = `You are a helper for a Numpad Macro app. You are refining a SINGLE key's prompt.
            The user will provide the current prompt (if any), prompts of neighboring keys (for context), and a specific instruction safely.
            You must output ONLY the raw text for the new prompt. No JSON, no Quotes, no Markdown. Just the text to paste.`;

            let prompt = `Current Prompt: "${currentPrompt || ''}"\n`;
            prompt += `Neighboring Keys: ${JSON.stringify(neighbors)}\n`;
            if (userRequest) prompt += `User Instruction: ${userRequest}\n`;
            if (context) prompt += `Clipboard/Context: ${context}\n`;

            prompt += `\nGenerate the new prompt text for this key.`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: `${systemPrompt}\n\n${prompt}` }]
                    }]
                })
            });

            const result = await response.json();
            return result.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } catch (err) {
            console.error(err);
            setError('Failed to refine');
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    return { generatePage, refineKey, isLoading, error };
}
