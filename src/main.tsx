import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

// Ensure dark mode persistence and purge any legacy light mode storage
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('fixit-theme');
    document.documentElement.removeAttribute('data-theme');
  } catch {
    // Ignore storage errors
  }
}

const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
