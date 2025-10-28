export interface ParsedPdf {
    text: string;
    images: string[]; // Array of base64 data URLs
}

export interface ChatMessage {
    sender: 'user' | 'ai';
    text: string;
}

export interface VectorStoreItem {
    content: string;
    embedding: number[];
}
