# Jernkorsetbreve Web Application

## Project Overview

This web application is designed to display and modernize Danish letters from World War I ("Jernkorsetbreve" translates to "Iron Cross Letters"). The application allows users to:

1. Browse a collection of historical letters
2. View individual letters with their metadata (date, place, sender, recipient)
3. Modernize the text of letters from old Danish spelling to contemporary Danish using AI

## Architecture

The project follows a client-server architecture:

- **Frontend**: React application with TypeScript
- **Backend**: Python FastAPI application
- **AI Integration**: Uses Anthropic's Claude API for text modernization
- **Data Source**: Letters are loaded from a CSV file

```
jernkorsetbreve/
├── api/                 # Python FastAPI backend
├── frontend/            # React TypeScript frontend
├── docker-compose.yml   # Docker configuration for Ollama
└── README.md            # This file
```

## Key Components

### Backend (API)

- **FastAPI Server**: Provides endpoints for letter data and modernization
- **Modernizer**: Uses Anthropic's Claude API to modernize old Danish text to contemporary Danish
- **Data Loading**: Reads letter data from a CSV file

### Frontend

- **Letter List**: Displays all letters in a table with metadata
- **Letter View**: Shows a single letter with its content and metadata
- **Modernization**: Allows users to modernize letter text and see differences
- **Diff Resolver**: Interactive component to accept/reject specific text changes

## Setup Instructions

### Prerequisites

- Python 3.8+
- Node.js 18+
- Anthropic API key (for modernization functionality)
- NVIDIA GPU (optional, for Ollama)

### Backend Setup

1. Navigate to the `api` directory:

   ```
   cd api
   ```

2. Create and activate a virtual environment:

   ```
   # Windows
   python -m venv venv
   venv\Scripts\activate

   # Linux/macOS
   python -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:

   ```
   pip install -r requirements.txt
   ```

4. Set the Anthropic API key as an environment variable:

   ```
   # Windows
   set ANTHROPIC_API_KEY=your_api_key_here

   # Linux/macOS
   export ANTHROPIC_API_KEY=your_api_key_here
   ```

5. Run the API server:
   ```
   uvicorn main:app --reload
   ```
   The API will be available at http://127.0.0.1:8000

### Frontend Setup

1. Navigate to the `frontend` directory:

   ```
   cd frontend
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Run the development server:
   ```
   npm run dev
   ```
   The frontend will be available at http://localhost:5173

## Development Workflow

1. The frontend makes API calls to the backend to fetch letter data
2. When a user clicks "Modernisér" on a letter, the backend calls the Anthropic API
3. The modernized text is returned to the frontend
4. The MarkdownDiffResolver component shows differences between original and modernized text
5. Users can accept or reject specific changes

## Important Files and Their Purposes

### Backend

- `api/main.py`: FastAPI application with endpoints for letters and modernization
- `api/modernizer.py`: Module for text modernization using Anthropic's Claude API
- `api/requirements.txt`: Python dependencies

### Frontend

- `frontend/src/App.tsx`: Main application component with routing
- `frontend/src/components/LetterList.tsx`: Component for displaying the list of letters
- `frontend/src/components/LetterView.tsx`: Component for displaying a single letter
- `frontend/src/components/MarkdownDiffResolver.tsx`: Component for showing and resolving text differences

## API Endpoints

- `GET /`: Returns all letters with full details
- `GET /letters`: Returns all letters with basic metadata
- `GET /letters/{letter_id}`: Returns a specific letter by ID
- `POST /proofread/{letter_id}`: Modernizes the text of a specific letter

## Frontend Routes

- `/`: Letter list view
- `/letters/:id`: Individual letter view

## Data Structure

Letters are stored in a CSV file with the following structure:

- `id`: Unique identifier
- `date`: Date of the letter
- `place`: Place where the letter was written
- `sender`: Person who wrote the letter
- `recipient`: Person who received the letter
- `text`: Content of the letter

## Dependencies

### Backend Dependencies

- FastAPI: Web framework
- Uvicorn: ASGI server
- Pandas: Data manipulation
- Anthropic: Claude API client

### Frontend Dependencies

- React: UI library
- React Router: Navigation
- Ant Design: UI components
- diff: Text difference calculation

## Additional Context

### Modernization Process

The modernization process uses Anthropic's Claude API to update old Danish spelling to contemporary Danish. The system prompt instructs the model to:

- Focus on updating old spelling to modern Danish
- Fix incorrectly combined words
- Identify potential typing errors

### Letter Navigation

The application supports navigation between letters with previous/next buttons. There are 665 letters in the collection (as indicated by the navigation limit in the LetterView component).

### Diff Resolution

The MarkdownDiffResolver component provides an interactive interface for users to:

- See word-level differences between original and modernized text
- Accept or reject specific changes
- Accept all, reject all, or reset all changes
- View the final text based on their decisions

### Performance Metrics

The application tracks and displays performance metrics for the modernization process:

- Time taken for the API call
- Tokens per second (TPS) processing rate

## Troubleshooting

- If the modernization feature doesn't work, check that the ANTHROPIC_API_KEY environment variable is set correctly
- If letters don't load, ensure the CSV file is in the correct location (../../data/letters.csv relative to the API)
- For frontend issues, check the browser console for error messages
