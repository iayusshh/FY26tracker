# FY26 Finance Tracker

## Project Overview
This project is a Finance Tracker web application for FY26. It allows users to track, view, and manage financial data interactively through a modern web interface.

## Features
- Interactive dashboard for financial tracking
- Data visualization and summary
- Responsive UI built with React (Vite)
- Python script for generating or processing finance data

## Project Structure
- `src/` — Source code for the React frontend
- `index.html` — Main HTML file
- `vite.config.js` — Vite configuration
- `package.json` — Project dependencies and scripts
- `generate_finance_tracker.py` — Python script for finance data processing
- `FY26_Finance_Tracker.jsx` — Main React component or entry point

## Getting Started

### Prerequisites
- Node.js (v16 or above recommended)
- npm or yarn
- Python 3.x (for running the Python script)

### Installation
1. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```
2. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```
3. Open your browser and navigate to the local server URL (usually http://localhost:5173).

### Using the Python Script
To process or generate finance data, run:
```bash
python generate_finance_tracker.py
```

## Notes
- The `dist/` and `node_modules/` folders are generated and should not be edited directly.
- Remove or ignore any files not listed above if not required for your workflow.
