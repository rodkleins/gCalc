import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import './headtohead.css';
import { HeadToHeadApp } from './HeadToHeadApp';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <HeadToHeadApp />
    </StrictMode>,
  );
}
