


export const startListening = (
    onResult: (text: string) => void,
    onEnd: () => void,
    onError: (error: any) => void
): (() => void) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
        onError("Speech Recognition not supported in this browser.");
        return () => { };
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Stop after one sentence/phrase
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
            .map((result: any) => result[0])
            .map((result: any) => result.transcript)
            .join('');

        onResult(transcript);
    };

    recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        onError(event.error);
    };

    recognition.onend = () => {
        onEnd();
    };

    try {
        recognition.start();
    } catch (e) {
        console.error("Failed to start recognition", e);
        onError(e);
    }

    return () => {
        try {
            recognition.stop();
        } catch (e) {
            // Ignore
        }
    };
};

export const speak = (text: string, onEnd?: () => void) => {
    if (!window.speechSynthesis) {
        console.error("Text-to-Speech not supported.");
        return;
    }

    // Cancel any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try to find a good voice
    const voices = window.speechSynthesis.getVoices();
    // Prefer a "Google US English" or similar if available, otherwise default
    const preferredVoice = voices.find(v => v.name.includes('Google US English')) || voices.find(v => v.lang === 'en-US');
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }

    utterance.onend = () => {
        if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
        console.error("TTS Error", e);
        if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
};

export const stopSpeaking = () => {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
};
