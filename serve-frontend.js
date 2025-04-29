// Simple Express server to serve frontend static files
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// The frontend build directory
const staticDir = path.join(__dirname, 'src/frontend/build');
console.log('Serving static files from:', staticDir);

// Serve static files
app.use(express.static(staticDir));

// Serve index.html for any route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

// Start server
const PORT = 7564;
app.listen(PORT, () => {
  console.log(`Frontend server running on http://localhost:${PORT}`);
}); 