
import { GoogleGenAI } from "@google/genai";
import type { VectorStoreItem } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const embeddingModel = 'text-embedding-004';
const generativeModel = 'gemini-2.5-flash';

// --- Vector Database Logic ---

function dotProduct(vecA: number[], vecB: number[]): number {
    return vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
}

function magnitude(vec: number[]): number {
    return Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
    const magA = magnitude(vecA);
    const magB = magnitude(vecB);
    if (magA === 0 || magB === 0) return 0;
    return dotProduct(vecA, vecB) / (magA * magB);
}

// --- Gemini API Wrappers ---

export async function embedChunks(chunks: string[]): Promise<VectorStoreItem[]> {
    try {
        // FIX: Property 'batchEmbedContents' does not exist on type 'Models'.
        // Use `embedContent` for each chunk and run requests in parallel with `Promise.all`.
        // FIX: Removed 'taskType' property from embedContent call as it is not available in EmbedContentParameters.
        const responses = await Promise.all(
            chunks.map(chunk => ai.models.embedContent({
                model: embeddingModel,
                contents: chunk,
            }))
        );
        
        // Based on the error in `embedQuery`, assuming the response contains an `embeddings` array.
        const embeddings = responses.map(res => res.embeddings[0].values);

        if (embeddings.length !== chunks.length) {
            throw new Error("Mismatch between number of chunks and embeddings returned.");
        }

        return chunks.map((chunk, i) => ({
            content: chunk,
            embedding: embeddings[i],
        }));
    } catch (error) {
        console.error("Error batch embedding content:", error);
        throw new Error("Failed to embed document chunks.");
    }
}

async function embedQuery(query: string): Promise<number[]> {
    // FIX: Removed 'taskType' property from embedContent call as it is not available in EmbedContentParameters.
    const response = await ai.models.embedContent({
        model: embeddingModel,
        // FIX: Object literal may only specify known properties, but 'content' does not exist in type 'EmbedContentParameters'. Changed to 'contents'.
        contents: query,
    });
    // FIX: Property 'embedding' does not exist on type 'EmbedContentResponse'. Changed to 'embeddings' and accessing the first element.
    return response.embeddings[0].values;
}


export async function queryDocument(
    query: string,
    vectorStore: VectorStoreItem[],
    documentImages: string[]
): Promise<string> {
    try {
        // 1. Embed the user's query
        const queryEmbedding = await embedQuery(query);

        // 2. Find relevant chunks from the vector store
        const scoredChunks = vectorStore.map(item => ({
            ...item,
            similarity: cosineSimilarity(queryEmbedding, item.embedding),
        }));

        // 3. Sort by similarity and take the top N (e.g., top 5)
        scoredChunks.sort((a, b) => b.similarity - a.similarity);
        const topK = 5;
        const relevantChunks = scoredChunks.slice(0, topK).map(chunk => chunk.content);
        const context = relevantChunks.join('\n\n---\n\n');

        // 4. Construct the prompt for the generative model
        const prompt = `You are an expert AI assistant specializing in analyzing documents. Your task is to answer the user's question based *exclusively* on the provided context and images from a PDF document.

Analyze the following document context and answer the user's question. Do not use any external knowledge. If the answer cannot be found in the provided context, state that clearly and concisely.

--- DOCUMENT CONTEXT START ---
${context}
--- DOCUMENT CONTEXT END ---

The document also includes the document pages as images. Refer to them if the text is unclear or if the question relates to visual elements.
`;
        
        const imageParts = documentImages.map(dataUrl => ({
            inlineData: {
                mimeType: 'image/jpeg',
                data: dataUrl.split(',')[1],
            }
        }));

        const contents = [
            { text: prompt },
            ...imageParts,
            { text: `--- USER QUESTION --- \n${query}` }
        ];

        // 5. Call the generative model
        const response = await ai.models.generateContent({
            model: generativeModel,
            contents: { parts: contents },
            config: {
                temperature: 0.1,
                topP: 0.9,
            }
        });
        
        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to get a response from the AI model.");
    }
}
