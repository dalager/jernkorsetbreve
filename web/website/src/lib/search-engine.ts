/**
 * Client-side semantic search engine for letter corpus.
 *
 * Loads pre-computed embeddings (Float32Array binary) and a lightweight
 * multilingual model (multilingual-e5-small via @huggingface/transformers from CDN).
 * Only the query is embedded at runtime -- all letter embeddings are
 * pre-built by the data pipeline and served as static assets.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  letterId: number;
  score: number;
}

export interface SearchEngineState {
  status:
    | "idle"
    | "loading-model"
    | "loading-embeddings"
    | "ready"
    | "searching"
    | "error";
  modelLoadTime?: number;
  embeddingLoadTime?: number;
  error?: string;
  letterCount?: number;
  modelProgress?: number;
  modelProgressFile?: string;
}

export type StateListener = (state: SearchEngineState) => void;

// ---------------------------------------------------------------------------
// Embedding index JSON shape (maps position -> letter id)
// ---------------------------------------------------------------------------

interface EmbeddingIndex {
  dimensions: number;
  count: number;
  letterIds: number[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMBEDDING_BIN_PATH = "/data/embeddings.bin";
const EMBEDDING_INDEX_PATH = "/data/embedding-index.json";
const SEARCH_SNIPPETS_PATH = "/data/search-snippets.json";

/**
 * CDN URL for transformers.js v3.
 * We dynamically import this at runtime to avoid bundling the library.
 */
const TRANSFORMERS_CDN =
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3";

const MODEL_NAME = "Xenova/multilingual-e5-small";

// ---------------------------------------------------------------------------
// Cosine similarity (ported from the experiment)
// ---------------------------------------------------------------------------

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ---------------------------------------------------------------------------
// SearchEngine singleton
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Extractor = any;

class SearchEngine {
  private state: SearchEngineState = { status: "idle" };
  private listeners: Set<StateListener> = new Set();

  private extractor: Extractor = null;
  private embeddingIndex: EmbeddingIndex | null = null;
  private embeddings: Float32Array | null = null;
  private dimension = 0;

  /** Keyed by letter id */
  private snippets: Record<string, string> | null = null;

  private initPromise: Promise<void> | null = null;

  // -----------------------------------------------------------------------
  // State management
  // -----------------------------------------------------------------------

  getState(): SearchEngineState {
    return { ...this.state };
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(patch: Partial<SearchEngineState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.getState()));
  }

  // -----------------------------------------------------------------------
  // Initialisation
  // -----------------------------------------------------------------------

  /**
   * Call once to start loading model + embeddings in parallel.
   * Subsequent calls return the same promise.
   */
  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    try {
      // Load model and embeddings in parallel
      await Promise.all([this.loadModel(), this.loadEmbeddings()]);
      // Try to load snippets (non-critical)
      await this.loadSnippets().catch(() => {
        /* snippets are optional */
      });
      this.setState({ status: "ready" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown initialisation error";
      this.setState({ status: "error", error: message });
      // Allow retry
      this.initPromise = null;
      throw err;
    }
  }

  // -----------------------------------------------------------------------
  // Model loading (dynamic import from CDN)
  // -----------------------------------------------------------------------

  private async loadModel(): Promise<void> {
    this.setState({ status: "loading-model", modelProgress: 0 });

    const t0 = performance.now();

    // Dynamic import from CDN -- this is NOT bundled
    const { pipeline, env } = await import(
      /* webpackIgnore: true */ TRANSFORMERS_CDN
    );

    // Use remote models
    env.allowLocalModels = false;

    this.extractor = await pipeline("feature-extraction", MODEL_NAME, {
      dtype: "q8",
      progress_callback: (progress: {
        status: string;
        progress?: number;
        file?: string;
      }) => {
        if (progress.status === "progress" && progress.progress) {
          this.setState({
            modelProgress: Math.round(progress.progress),
            modelProgressFile: progress.file,
          });
        }
      },
    });

    const elapsed = performance.now() - t0;
    this.setState({ modelLoadTime: elapsed, modelProgress: 100 });
  }

  // -----------------------------------------------------------------------
  // Embedding loading (binary + JSON index)
  // -----------------------------------------------------------------------

  private async loadEmbeddings(): Promise<void> {
    this.setState({ status: "loading-embeddings" });

    const t0 = performance.now();

    // Fetch both files
    const [binResponse, indexResponse] = await Promise.all([
      fetch(EMBEDDING_BIN_PATH),
      fetch(EMBEDDING_INDEX_PATH),
    ]);

    if (!binResponse.ok || !indexResponse.ok) {
      throw new Error(
        `Failed to load embeddings: bin=${binResponse.status}, index=${indexResponse.status}`
      );
    }

    const [buffer, index] = await Promise.all([
      binResponse.arrayBuffer(),
      indexResponse.json() as Promise<EmbeddingIndex>,
    ]);

    this.embeddingIndex = index;
    this.dimension = index.dimensions;
    this.embeddings = new Float32Array(buffer);

    const elapsed = performance.now() - t0;
    this.setState({
      embeddingLoadTime: elapsed,
      letterCount: index.count,
    });
  }

  // -----------------------------------------------------------------------
  // Snippets (optional)
  // -----------------------------------------------------------------------

  private async loadSnippets(): Promise<void> {
    const res = await fetch(SEARCH_SNIPPETS_PATH);
    if (res.ok) {
      this.snippets = await res.json();
    }
  }

  getSnippet(letterId: number): string | undefined {
    return this.snippets?.[String(letterId)];
  }

  // -----------------------------------------------------------------------
  // Query embedding (mean pooling + normalisation via the pipeline)
  // -----------------------------------------------------------------------

  private async embed(text: string): Promise<Float32Array> {
    if (!this.extractor) {
      throw new Error("Model not loaded");
    }
    const output = await this.extractor('query: ' + text, {
      pooling: "mean",
      normalize: true,
    });
    return new Float32Array(output.data);
  }

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  async search(query: string, topK = 20): Promise<SearchResult[]> {
    if (
      !this.extractor ||
      !this.embeddings ||
      !this.embeddingIndex
    ) {
      return [];
    }

    this.setState({ status: "searching" });

    const queryEmbedding = await this.embed(query);

    const results: SearchResult[] = [];
    const { letterIds, count } = this.embeddingIndex;
    const dim = this.dimension;

    for (let i = 0; i < count; i++) {
      const offset = i * dim;
      const letterEmbedding = this.embeddings.subarray(offset, offset + dim);
      const score = cosineSimilarity(queryEmbedding, letterEmbedding);
      results.push({ letterId: letterIds[i], score });
    }

    // Sort descending by score
    results.sort((a, b) => b.score - a.score);

    this.setState({ status: "ready" });

    return results.slice(0, topK);
  }

  // -----------------------------------------------------------------------
  // Status helpers
  // -----------------------------------------------------------------------

  isReady(): boolean {
    return this.state.status === "ready";
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

let instance: SearchEngine | null = null;

export function getSearchEngine(): SearchEngine {
  if (!instance) {
    instance = new SearchEngine();
  }
  return instance;
}

export type { SearchEngine };
