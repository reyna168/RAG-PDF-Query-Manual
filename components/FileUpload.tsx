import React, { useState, useCallback } from 'react';
import { UploadIcon, DocumentTextIcon } from './Icons';
import { Loader } from './Loader';

interface FileUploadProps {
    onFileSelect: (file: File) => void;
    onTextSubmit: (text: string) => void;
    status: 'idle' | 'parsing' | 'indexing' | 'ready' | 'querying';
}

type InputMode = 'file' | 'text';

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, onTextSubmit, status }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [mode, setMode] = useState<InputMode>('file');
    const [textContent, setTextContent] = useState('');

    const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            if (files[0].type === 'application/pdf') {
                onFileSelect(files[0]);
            } else {
                alert('Please upload a PDF file.');
            }
        }
    }, [onFileSelect]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            onFileSelect(files[0]);
        }
    };
    
    const handleTextProcess = () => {
        if (textContent.trim()) {
            onTextSubmit(textContent.trim());
        }
    }

    const isLoading = status === 'parsing' || status === 'indexing';

    const renderFileUploader = () => (
        <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`w-full border-2 border-dashed rounded-xl p-8 md:p-12 text-center transition-all duration-300 ${isDragging ? 'border-indigo-400 bg-slate-800/50' : 'border-slate-600 hover:border-slate-500'}`}
        >
            <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".pdf"
                onChange={handleFileChange}
                disabled={isLoading}
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center space-y-4">
                <UploadIcon className="w-16 h-16 text-slate-500" />
                <h2 className="text-2xl font-bold text-slate-200">Upload your PDF</h2>
                <p className="text-slate-400">Drag and drop a PDF file here, or click to select a file.</p>
                <span className="mt-4 inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                    Browse Files
                </span>
            </label>
        </div>
    );

    const renderTextUploader = () => (
         <div className="w-full flex flex-col space-y-4">
             <textarea
                 value={textContent}
                 onChange={(e) => setTextContent(e.target.value)}
                 placeholder="Paste your text here..."
                 className="w-full h-64 bg-slate-800 border border-slate-600 rounded-lg p-4 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow custom-scrollbar"
                 disabled={isLoading}
             />
             <button
                 onClick={handleTextProcess}
                 disabled={isLoading || !textContent.trim()}
                 className="self-end bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 transition-colors"
             >
                Process Text
             </button>
        </div>
    );

    return (
        <div className="flex-grow flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                 {isLoading ? (
                    <div className="flex flex-col items-center justify-center space-y-4 p-8 md:p-12">
                        <Loader />
                        <p className="text-lg font-semibold text-slate-300">
                            {status === 'parsing' ? 'Parsing your PDF...' : 'Creating document index...'}
                        </p>
                        <p className="text-slate-400">
                           {status === 'parsing' ? 'Extracting text and images.' : 'This may take a moment for large documents.'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="flex mb-4 border-b border-slate-700">
                            <button
                                onClick={() => setMode('file')}
                                className={`px-4 py-2 text-lg font-semibold transition-colors ${mode === 'file' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Upload PDF
                            </button>
                            <button
                                onClick={() => setMode('text')}
                                className={`px-4 py-2 text-lg font-semibold transition-colors ${mode === 'text' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Paste Text
                            </button>
                        </div>
                        {mode === 'file' ? renderFileUploader() : renderTextUploader()}
                    </>
                )}
            </div>
        </div>
    );
};