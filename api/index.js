import { createServer } from 'http';
import { URL } from 'url';
import { app } from '../dist/backend/server.js';

// Create a serverless function for Vercel
export default async function handler(req, res) {
  // Handle CORS for preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Pass the request to the Express app
  await new Promise((resolve, reject) => {
    const server = createServer(app);
    server.on('error', reject);
    
    // Parse the request
    const url = new URL(req.url, `http://${req.headers.host}`);
    const originalUrl = url.pathname + url.search;
    
    // Create mock req and res objects to pass to the express app
    const mockReq = Object.assign({}, req, {
      url: originalUrl,
      originalUrl,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
    });
    
    app(mockReq, res);
    resolve();
  });
} 