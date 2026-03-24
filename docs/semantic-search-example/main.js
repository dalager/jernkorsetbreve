import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';
import { movies } from './movies.js';

// Use remote models from HuggingFace Hub (ONNX)
env.allowLocalModels = false;

// --- DOM elements ---

const statusEl = document.getElementById('status');
const progressBar = document.getElementById('progress');
const progressFill = document.getElementById('progress-fill');
const searchInput = document.getElementById('search-input');
const resultsEl = document.getElementById('results');

const statModel = document.getElementById('stat-model');
const statModelSub = document.getElementById('stat-model-sub');
const statEmbed = document.getElementById('stat-embed');
const statEmbedSub = document.getElementById('stat-embed-sub');
const statQuery = document.getElementById('stat-query');
const statQuerySub = document.getElementById('stat-query-sub');

// --- State ---

let extractor = null;
let movieEmbeddings = [];

// --- Genre colors ---

const GENRE_COLORS = {
  drama: '#6366f1',
  komedie: '#f59e0b',
  thriller: '#ef4444',
  eventyr: '#10b981',
  krimi: '#8b5cf6',
  animation: '#ec4899',
  dokumentar: '#06b6d4',
  familie: '#f97316',
  romantik: '#e11d48',
  action: '#dc2626',
  gyser: '#1e1b4b',
  musical: '#a855f7',
  sci_fi: '#0ea5e9',
  historisk: '#92400e',
  familiefilm: '#f97316',
};

function genreColor(genre) {
  const key = genre.toLowerCase().replace(/[\s-]/g, '_');
  return GENRE_COLORS[key] || '#64748b';
}

// --- Cosine similarity ---

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// --- Embedding helper ---

async function embed(text) {
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

// --- Model loading ---

async function loadModel() {
  statusEl.textContent = 'Henter model (~33 MB, caches efter første gang)...';
  progressFill.style.width = '5%';

  const t0 = performance.now();

  try {
    extractor = await pipeline(
      'feature-extraction',
      'Xenova/gte-small',
      {
        progress_callback: (progress) => {
          if (progress.status === 'progress' && progress.progress) {
            const pct = Math.round(progress.progress);
            progressFill.style.width = `${pct}%`;
            statusEl.textContent = `Henter: ${progress.file} (${pct}%)`;
          } else if (progress.status === 'ready') {
            progressFill.style.width = '100%';
          }
        },
      },
    );

    const loadTime = performance.now() - t0;

    progressBar.classList.add('hidden');
    statModel.textContent = `${(loadTime / 1000).toFixed(1)}s`;
    statModelSub.textContent = 'gte-small (multilingual)';

    statusEl.textContent = 'Model klar. Indekserer film...';
    await indexMovies();
  } catch (err) {
    progressBar.classList.add('hidden');
    statusEl.textContent = `Fejl ved indlæsning af model: ${err.message}`;
    console.error(err);
  }
}

// --- Index movies ---

async function indexMovies() {
  const t0 = performance.now();

  statusEl.textContent = `Indekserer ${movies.length} film...`;
  movieEmbeddings = [];

  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i];
    const text = movie.description;
    const embedding = await embed(text);
    movieEmbeddings.push(new Float32Array(embedding));

    // Update status periodically
    if ((i + 1) % 5 === 0 || i === movies.length - 1) {
      statusEl.textContent = `Indekserer film... (${i + 1}/${movies.length})`;
    }
  }

  const embedTime = performance.now() - t0;
  const filmsPerSec = (movies.length / (embedTime / 1000)).toFixed(1);

  statEmbed.textContent = `${(embedTime / 1000).toFixed(1)}s`;
  statEmbedSub.textContent = `${movies.length} film, ${filmsPerSec} film/sek`;

  statusEl.textContent = 'Klar! Søg efter danske film herunder.';
  searchInput.disabled = false;
  searchInput.focus();
}

// --- Search ---

let debounceTimer;

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  const query = searchInput.value.trim();

  if (!query) {
    resultsEl.innerHTML = '';
    statQuery.textContent = '-';
    statQuerySub.textContent = 'cosine similarity';
    statusEl.textContent = 'Klar! Søg efter danske film herunder.';
    return;
  }

  statusEl.textContent = 'Søger...';

  debounceTimer = setTimeout(async () => {
    try {
      await performSearch(query);
    } catch (err) {
      statusEl.textContent = `Søgefejl: ${err.message}`;
      console.error(err);
    }
  }, 300);
});

async function performSearch(query) {
  const t0 = performance.now();

  const queryEmbedding = await embed(query);

  // Compute similarity against all movies
  const scored = movies.map((movie, i) => ({
    movie,
    score: cosineSimilarity(queryEmbedding, movieEmbeddings[i]),
  }));

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  const queryTime = performance.now() - t0;

  statQuery.textContent = `${queryTime.toFixed(0)}ms`;
  statQuerySub.textContent = 'cosine similarity';
  statusEl.textContent = `Fandt ${scored.length} resultater for "${query}"`;

  renderResults(scored);
}

// --- Render results ---

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderResults(scored) {
  if (scored.length === 0) {
    resultsEl.innerHTML = '<div style="color:#64748b;text-align:center;padding:2rem;">Ingen resultater</div>';
    return;
  }

  resultsEl.innerHTML = scored
    .map((item, index) => {
      const { movie, score } = item;
      const pct = Math.max(0, Math.min(100, score * 100));
      // Map score to hue: 0 (red) to 120 (green)
      const hue = Math.round(pct * 1.2);
      const color = `hsl(${hue}, 70%, 50%)`;
      const delay = Math.min(index * 40, 600);

      const genres = movie.genre
        .split(',')
        .map(g => g.trim())
        .filter(Boolean);

      const genreTags = genres
        .map(g => `<span class="genre-tag" style="background:${genreColor(g)}">${escapeHtml(g)}</span>`)
        .join(' ');

      return `<div class="result-card" style="animation-delay:${delay}ms">
        <div class="result-score-bar" style="width:${pct}%;background:${color}"></div>
        <div class="result-top">
          <span class="result-title">${escapeHtml(movie.title)}</span>
          <span class="result-year">(${movie.year})</span>
        </div>
        <div class="result-meta">
          ${genreTags}
          <span class="result-score-num" style="color:${color}">${pct.toFixed(1)}%</span>
        </div>
        <p class="result-desc">${escapeHtml(movie.description)}</p>
      </div>`;
    })
    .join('');
}

// --- Example query buttons ---

document.querySelectorAll('.example-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    searchInput.value = btn.dataset.query || btn.textContent.trim();
    searchInput.dispatchEvent(new Event('input'));
  });
});

// --- Start ---

loadModel();
