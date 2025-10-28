import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { SendIcon, UserIcon, SparklesIcon, DocumentIcon } from './Icons';
import { Loader } from './Loader';

// Using esm.sh for react-markdown as it's a reliable CDN for ES modules
import ReactMarkdown from 'https://esm.sh/react-markdown@9';
import remarkGfm from 'https://esm.sh/remark-gfm@4';


interface ChatInterfaceProps {
    documentTitle: string;
    chatHistory: ChatMessage[];
    status: 'idle' | 'parsing' | 'indexing' | 'ready' | 'querying';
    onQuerySubmit: (query: string) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ documentTitle, chatHistory, status, onQuerySubmit }) => {
    const [query, setQuery] = useState('');
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim() && status === 'ready') {
            onQuerySubmit(query.trim());
            setQuery('');
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] max-w-4xl w-full mx-auto bg-slate-800/50 rounded-xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center space-x-3 bg-slate-800">
                 <DocumentIcon className="w-6 h-6 text-indigo-400"/>
                 <span className="font-semibold text-slate-300 truncate">{documentTitle}</span>
            </div>
            
            <div ref={chatContainerRef} className="flex-grow p-4 md:p-6 overflow-y-auto custom-scrollbar">
                <div className="space-y-6">
                    {chatHistory.map((message, index) => (
                        <div key={index} className={`flex items-start gap-4 ${message.sender === 'user' ? 'justify-end' : ''}`}>
                            {message.sender === 'ai' && (
                                <div className="w-8 h-8 flex-shrink-0 bg-indigo-500 rounded-full flex items-center justify-center">
                                    <SparklesIcon className="w-5 h-5 text-white" />
                                </div>
                            )}
                            <div className={`max-w-xl p-4 rounded-xl ${message.sender === 'user'
                                ? 'bg-slate-700 text-slate-200 rounded-br-none'
                                : 'bg-slate-900 text-slate-300 rounded-bl-none'
                                }`}>
                                <div className="prose prose-invert prose-sm max-w-none prose-p:text-slate-300 prose-headings:text-slate-100 prose-strong:text-slate-100 prose-a:text-indigo-400">
                                     <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                                </div>
                            </div>
                            {message.sender === 'user' && (
                                 <div className="w-8 h-8 flex-shrink-0 bg-slate-600 rounded-full flex items-center justify-center">
                                    <UserIcon className="w-5 h-5 text-white" />
                                </div>
                            )}
                        </div>
                    ))}
                    {status === 'querying' && (
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 flex-shrink-0 bg-indigo-500 rounded-full flex items-center justify-center">
                                <SparklesIcon className="w-5 h-5 text-white" />
                            </div>
                            <div className="max-w-xl p-4 rounded-xl rounded-bl-none bg-slate-900">
                                <Loader />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 border-t border-slate-700 bg-slate-800">
                <form onSubmit={handleSubmit} className="flex items-center space-x-4">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Ask a question about the document..."
                        className="flex-grow bg-slate-700 border border-slate-600 rounded-lg py-3 px-4 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                        disabled={status !== 'ready'}
                    />
                    <button
                        type="submit"
                        disabled={status !== 'ready' || !query.trim()}
                        className="bg-indigo-600 text-white rounded-lg p-3 disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 transition-colors"
                    >
                        <SendIcon className="w-6 h-6" />
                    </button>
                </form>
            </div>
        </div>
    );
};