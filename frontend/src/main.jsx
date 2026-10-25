import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/login.css';
import './styles/assistant.css';
import './styles/notebook.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
