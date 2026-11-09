import { pipeline } from '@xenova/transformers';
import { v4 as uuidv4 } from 'uuid';

// Types
export interface DocumentChunk {
    id: string;
    text: string;
    metadata: {
        source: string;
        page?: number;
        [key: string]: any;
    };
    embedding?: number[];
}

export interface SearchResult extends DocumentChunk {
    score: number;
}

// Configuration
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

class VectorStore {
    private chunks: DocumentChunk[] = [];

    add(chunks: DocumentChunk[]) {
        this.chunks.push(...chunks);
    }

    clear() {
        this.chunks = [];
    }

    // Cosine similarity search
    search(queryEmbedding: number[], topK: number = 5): SearchResult[] {
        if (this.chunks.length === 0) return [];

        const results = this.chunks.map(chunk => {
            if (!chunk.embedding) return { ...chunk, score: -1 };
            const score = this.cosineSimilarity(queryEmbedding, chunk.embedding);
            return { ...chunk, score };
        });

        // Sort by score descending
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }

    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}

class RAGProcessor {
    private static instance: RAGProcessor;
    private vectorStore: VectorStore;
    private embedder: any = null;
    private isModelLoading: boolean = false;

    private constructor() {
        this.vectorStore = new VectorStore();
    }

    public static getInstance(): RAGProcessor {
        if (!RAGProcessor.instance) {
            RAGProcessor.instance = new RAGProcessor();
        }
        return RAGProcessor.instance;
    }

    // Initialize the embedding model
    private async getEmbedder() {
        if (this.embedder) return this.embedder;

        if (this.isModelLoading) {
            // Wait for model to load if already in progress
            while (this.isModelLoading) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (this.embedder) return this.embedder;
        }

        this.isModelLoading = true;
        try {
            console.log('Loading embedding model...');
            // @ts-ignore
            this.embedder = await pipeline('feature-extraction', EMBEDDING_MODEL);
            console.log('Embedding model loaded.');
        } catch (error) {
            console.error('Failed to load embedding model:', error);
            throw error;
        } finally {
            this.isModelLoading = false;
        }
        return this.embedder;
    }

    // Chunk text into smaller pieces
    public chunkText(text: string, source: string): DocumentChunk[] {
        const chunks: DocumentChunk[] = [];
        let start = 0;

        while (start < text.length) {
            const end = Math.min(start + CHUNK_SIZE, text.length);
            // Try to find a sentence break near the end
            let actualEnd = end;
            if (actualEnd < text.length) {
                const lastPeriod = text.lastIndexOf('.', actualEnd);
                if (lastPeriod > start + CHUNK_SIZE / 2) {
                    actualEnd = lastPeriod + 1;
                }
            }

            const chunkText = text.slice(start, actualEnd).trim();
            if (chunkText.length > 0) {
                chunks.push({
                    id: uuidv4(),
                    text: chunkText,
                    metadata: { source }
                });
            }

            start += CHUNK_SIZE - CHUNK_OVERLAP;
            // Ensure we don't get stuck
            if (start >= actualEnd) start = actualEnd;
        }

        return chunks;
    }

    // Generate embeddings for chunks
    public async ingestDocument(text: string, source: string): Promise<void> {
        const chunks = this.chunkText(text, source);
        const embedder = await this.getEmbedder();

        console.log(`Generating embeddings for ${chunks.length} chunks...`);

        for (const chunk of chunks) {
            // Generate embedding
            // pooling: 'mean' or 'cls' depending on model, 'mean' is usually safe for sentence-transformers
            const output = await embedder(chunk.text, { pooling: 'mean', normalize: true });
            chunk.embedding = Array.from(output.data);
        }

        this.vectorStore.add(chunks);
        console.log(`Ingested ${chunks.length} chunks from ${source}`);
    }

    public clearStore() {
        this.vectorStore.clear();
    }

    public async retrieveContext(query: string, topK: number = 3): Promise<string> {
        const embedder = await this.getEmbedder();
        const output = await embedder(query, { pooling: 'mean', normalize: true });
        const queryEmbedding = Array.from(output.data) as number[];

        const results = this.vectorStore.search(queryEmbedding, topK);

        if (results.length === 0) return '';

        console.log('Retrieved chunks:', results.map(r => ({ score: r.score, text: r.text.substring(0, 50) + '...' })));

        return results.map(r => r.text).join('\n\n');
    }
}

export const ragProcessor = RAGProcessor.getInstance();
