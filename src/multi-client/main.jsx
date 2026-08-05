import React from 'react';
import { createRoot } from 'react-dom/client';
import MultiClientDock from './MultiClientDock';
import './multi-client.scss';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MultiClientDock />
  </React.StrictMode>,
);
