import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import './rh.css';
import RhApp from './RhApp';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <RhApp />
    </StrictMode>,
  );
}
