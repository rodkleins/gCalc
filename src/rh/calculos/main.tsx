import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles.css';
import '../../calculos/calculos.css';
import { RhCalculosPage } from './RhCalculosPage';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <RhCalculosPage />
    </StrictMode>,
  );
}
