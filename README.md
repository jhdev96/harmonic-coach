# Harmonic Coach

**An AI lead-sheet tutor for harmonic understanding.**

Harmonic Coach helps piano students understand chord charts measure by measure. Users can enter a lead sheet, select a specific measure, and receive piano-instructor-style harmonic analysis including chord function, confidence level, practice tips, and alternative interpretations.

## Features

- **Polished Frontend UI**: Single-page app with warm, musical design
- **Lead-Sheet Editor**: Grid of editable measure cards with chord inputs
- **Song Metadata**: Configure title, key, and time signature
- **AI Harmonic Analysis**: One click sends the whole chart to Claude, which returns a structured per-measure breakdown (function, roman numeral, confidence, practice tip, alternative hearings)
- **Measure Timeline**: Sticky bottom timeline with one cell per bar, color-coded by harmonic function, synced with measure selection
- **Demo Fallback**: Hardcoded analysis for the demo progression when no AI analysis has run
- **Responsive Design**: Sticky analysis panel on desktop, responsive layout on mobile
- **Measure Selection**: Click to select, edit without losing state, add new measures

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation & Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The app will reload as you make changes.

### AI Analysis Setup

The "Analyze with Claude" feature calls the Anthropic API from a Next.js route handler. Create a `.env.local` file in the project root:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Restart the dev server after adding the key. Without it, the app still runs — analysis requests return a friendly error and the demo fallback analysis remains available.

### Linting

```bash
npm run lint
```
