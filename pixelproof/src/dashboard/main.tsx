import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

const container = document.getElementById('pixelproof-dashboard');
if (container) {
  const root = createRoot(container);
  root.render(React.createElement(App));
}
