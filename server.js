import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = 3000;

// Enable CORS so that your extension can communicate with this server
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

// Define the endpoint for proxying data to Google Sheets
app.post('/sheet-proxy', async (req, res) => {
  const data = req.body;
  
  // Replace with your actual Google Apps Script URL
  const scriptURL = "https://script.google.com/macros/s/AKfycbwQlYuB6eE93gfEI-LLGo9TiHR4P2nNem3Lsk8Lq1yTLTfOxuXIyvh7xKii_Co5tNJQ/exec";
  
  try {
    const response = await fetch(scriptURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to forward data to Google Sheets" });
    }
    
    const responseData = await response.text();
    res.json({ status: 'Data forwarded successfully', sheetsResponse: responseData });
  } catch (error) {
    console.error('Error forwarding data:', error);
    res.status(500).json({ error: 'Error forwarding data to Google Sheets' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
