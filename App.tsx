import React, { useState, useCallback, useEffect } from 'react';
import type { ChatMessage, VectorStoreItem } from './types';
import { FileUpload } from './components/FileUpload';
import { ChatInterface } from './components/ChatInterface';
import { embedChunks, queryDocument } from './services/geminiService';
import { PDFIcon } from './components/Icons';

// pdfjs types are not easily available, so using 'any'
declare const pdfjsLib: any;

const PDF_PROCESSING_TIMEOUT = 30000; // 30 seconds

const App: React.FC = () => {
    const [documentLoaded, setDocumentLoaded] = useState(false);
    const [documentTitle, setDocumentTitle] = useState('');
    const [pdfImages, setPdfImages] = useState<string[]>([]);
    const [vectorStore, setVectorStore] = useState<VectorStoreItem[]>([]);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [status, setStatus] = useState<'idle' | 'parsing' | 'indexing' | 'ready' | 'querying'>('idle');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Configure PDF.js worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.mjs`;
        }
    }, []);

    const resetState = () => {
        setDocumentLoaded(false);
        setDocumentTitle('');
        setPdfImages([]);
        setVectorStore([]);
        setChatHistory([]);
        setStatus('idle');
        setError(null);
    };

    const handleFileSelect = (file: File | null) => {
        if (file) {
            resetState();
            setDocumentTitle(file.name);
            processAndIndexPdf(file);
        } else {
            resetState();
        }
    };
    
    const handleTextSubmit = (text: string) => {
        if (text.trim()) {
            resetState();
            setDocumentTitle('Pasted Text');
            processAndIndexText(text);
        }
    };

    const chunkText = (text: string): string[] => {
        return text.split(/\n\s*\n/).filter(p => p.trim().length > 10);
    };
    
    const processAndIndexText = useCallback(async (text: string) => {
        setStatus('indexing');
        setError(null);
        try {
            const textChunks = chunkText(text);
            if (textChunks.length === 0) {
                throw new Error("No text provided or text is too short.");
            }
            const embeddedChunks = await embedChunks(textChunks);
            setVectorStore(embeddedChunks);
            
            setStatus('ready');
            setDocumentLoaded(true);
            setChatHistory([{
                sender: 'ai',
                text: `The provided text has been processed and indexed. You can now ask questions about its content.`
            }]);

        } catch (err) {
            console.error('Error processing text:', err);
            setError(err instanceof Error ? err.message : 'An unexpected error occurred while processing the text.');
            setStatus('idle');
        }
    }, []);

    const processAndIndexPdf = useCallback(async (file: File) => {
        setStatus('parsing');
        setError(null);

        const processingPromise = new Promise<void>((resolve, reject) => {
            const fileReader = new FileReader();
            
            fileReader.onload = async () => {
                try {
                    if (!fileReader.result) {
                        return reject(new Error("File could not be read."));
                    }
                    
                    const typedArray = new Uint8Array(fileReader.result as ArrayBuffer);
                    const pdf = await pdfjsLib.getDocument(typedArray).promise;
                    
                    let fullText = '';
                    const images: string[] = [];
                    
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n\n';

                        const viewport = page.getViewport({ scale: 1.5 });
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;

                        if (context) {
                             await page.render({ canvasContext: context, viewport: viewport }).promise;
                             images.push(canvas.toDataURL('image/jpeg'));
                        }
                    }
                    
                    setPdfImages(images);
                    setStatus('indexing');

                    const textChunks = chunkText(fullText);
                    if (textChunks.length === 0) {
                        throw new Error("NoTextContent");
                    }
                    const embeddedChunks = await embedChunks(textChunks);
                    setVectorStore(embeddedChunks);
                    
                    setStatus('ready');
                    setDocumentLoaded(true);
                    setChatHistory([{
                        sender: 'ai',
                        text: `Document "${file.name}" has been processed and indexed. You can now ask questions about its content.`
                    }]);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            };

            fileReader.onerror = () => reject(new Error("Error reading file."));
            fileReader.readAsArrayBuffer(file);
        });

        const timeoutPromise = new Promise<void>((_, reject) => {
            setTimeout(() => reject(new Error("Timeout")), PDF_PROCESSING_TIMEOUT);
        });

        try {
            await Promise.race([processingPromise, timeoutPromise]);
        } catch (err: any) {
            console.error('Error processing PDF:', err);
            let errorMessage = 'An unexpected error occurred. Please try another file.';
            
            if (err instanceof Error) {
                switch (err.message) {
                    case "Timeout":
                        errorMessage = `Processing timed out. The PDF might be too large or complex.`;
                        break;
                    case "NoTextContent":
                        errorMessage = "Could not extract any text from the PDF. The document might be image-based or empty.";
                        break;
                    default:
                        switch (err.name) {
                            case 'InvalidPDFException':
                                errorMessage = 'The file appears to be a corrupted or invalid PDF.';
                                break;
                            case 'PasswordException':
                                errorMessage = 'The PDF is password-protected and cannot be processed.';
                                break;
                            default:
                                errorMessage = 'Failed to process the PDF. It might be corrupted or in a complex format.';
                                break;
                        }
                }
            }
            setError(errorMessage);
            setStatus('idle');
        }
    }, []);

    const handleQuerySubmit = async (query: string) => {
        if (vectorStore.length === 0 || status !== 'ready') return;

        setStatus('querying');
        setError(null);
        
        const userMessage: ChatMessage = { sender: 'user', text: query };
        setChatHistory(prev => [...prev, userMessage]);

        try {
            const answer = await queryDocument(query, vectorStore, pdfImages);
            const aiMessage: ChatMessage = { sender: 'ai', text: answer };
            setChatHistory(prev => [...prev, aiMessage]);
        } catch (err) {
            console.error('Error querying document:', err);
            const errorMessage: ChatMessage = { sender: 'ai', text: 'Sorry, I encountered an error trying to answer your question. Please try again.' };
            setChatHistory(prev => [...prev, errorMessage]);
            setError('An error occurred while querying the Gemini API.');
        } finally {
            setStatus('ready');
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
            <header className="bg-slate-800/50 backdrop-blur-sm shadow-lg p-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center space-x-3">
                    <PDFIcon className="w-8 h-8 text-indigo-400" />
                    <h1 className="text-xl md:text-2xl font-bold text-slate-200">RAG PDF Query Manual</h1>
                </div>
                {documentLoaded && (
                    <button 
                        onClick={resetState} 
                        className="text-sm bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                        Clear Document
                    </button>
                )}
            </header>

            <main className="flex-grow flex flex-col p-4 md:p-6">
                {!documentLoaded ? (
                    <FileUpload onFileSelect={handleFileSelect} onTextSubmit={handleTextSubmit} status={status} />
                ) : (
                    <ChatInterface
                        documentTitle={documentTitle}
                        chatHistory={chatHistory}
                        status={status}
                        onQuerySubmit={handleQuerySubmit}
                    />
                )}
                {error && <div className="mt-4 p-3 bg-red-900/50 text-red-300 border border-red-700 rounded-lg text-center">{error}</div>}
            </main>
        </div>
    );
};

export default App;