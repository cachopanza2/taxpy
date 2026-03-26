import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Shim process.env for production builds where Vite's define might not be enough
if (typeof window !== 'undefined' && !window.process) {
  // @ts-ignore
  window.process = { env: {} };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
