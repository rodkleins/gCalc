import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import './calculos.css';
import { CalculosPage } from './CalculosPage';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <CalculosPage />
    </StrictMode>,
  );
}
