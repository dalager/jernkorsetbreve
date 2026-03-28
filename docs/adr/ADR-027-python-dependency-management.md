# ADR-027: Python Dependency Management for Pipeline Scripts

## Status

Proposed (partially implemented 2026-03-28: `requirements-cvp.txt` created for CVP pipeline; full `requirements.txt` restructuring pending)

## Date

2026-03-28

## Context

The Python notebooks currently have implicit dependencies: each notebook imports libraries (`pandas`, `afinn`, `sentida`, `danlp`, `nltk`, `seaborn`, `matplotlib`) without any centralized requirements file. New contributors (or future-you after a machine change) must read notebook imports and install packages ad hoc.

With ADR-026 extracting three notebooks to scripts, the dependencies become part of the build pipeline. They need to be explicit and reproducible.

### Current Python dependencies (from notebook imports)

| Package | Used By | Purpose |
|---------|---------|---------|
| `pandas` | cleanup, sentences, sentiment | Data manipulation |
| `nltk` | sentences, sentiment | Tokenization (`punkt`) |
| `afinn` | sentiment | Lexicon-based sentiment (Danish) |
| `sentida` | sentiment | Danish sentiment analysis |
| `danlp` | sentiment | BERT emotion classifier |
| `matplotlib` | visualization notebooks | Plotting |
| `seaborn` | visualization notebooks | Statistical plots |
| `geopandas` | geodata notebooks | Geospatial data |

### Special case: danlp model download

`danlp`'s `load_bert_emotion_model()` downloads a ~400 MB model on first use. This is an implicit setup step that will surprise first-time users.

## Decision

1. **Create `requirements.txt`** at the project root with pinned major versions for pipeline scripts:

   ```
   pandas>=2.0
   nltk>=3.8
   afinn>=0.1
   sentida>=0.4
   danlp>=0.1
   ```

2. **Create `requirements-notebooks.txt`** for additional notebook exploration dependencies:

   ```
   -r requirements.txt
   matplotlib>=3.7
   seaborn>=0.12
   geopandas>=0.14
   ```

3. **Document the model download step** in a setup section in `requirements.txt` or a comment in the sentiment script:

   ```python
   # First-time setup: run `python -c "from danlp.models import load_bert_emotion_model; load_bert_emotion_model()"` to download the BERT model (~400 MB)
   ```

4. **No `pyproject.toml`** — this project is not a Python package, and adding one would imply it is. `requirements.txt` is the simplest, most universally understood format.

## Alternatives Considered

### `pyproject.toml` with `[project]`

Rejected. The project is a multi-language monorepo (Node.js + Python), not a Python package. `pyproject.toml` implies Python package semantics (build backends, entry points) that don't apply.

### Conda environment file

Rejected. Adds a heavy dependency manager requirement. The packages are all pip-installable.

### `uv` with `pyproject.toml`

Fast and modern, but adds a tool that must be installed separately. `requirements.txt` + `pip` works everywhere Python is installed.

### Do nothing

Rejected. Without explicit dependencies, the pipeline is not reproducible after a fresh clone or machine change.

## Consequences

### Positive

- `pip install -r requirements.txt` sets up the full pipeline
- Clear separation between pipeline dependencies (required) and notebook dependencies (optional)
- Model download step is documented, not a surprise

### Negative

- Python packages are not version-locked (only minimum versions). For full lockfile behavior, `pip freeze > requirements.lock` could be added later, but is overkill for a personal project.
- Two requirements files to maintain

## Related

- ADR-026: Extract Notebooks to Scripts (the scripts whose dependencies are being managed)
