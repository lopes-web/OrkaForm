import React from 'react';
import { createRoot } from 'react-dom/client';
import { OrkaApp } from './OrkaApp';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <OrkaApp />
  </React.StrictMode>,
);
