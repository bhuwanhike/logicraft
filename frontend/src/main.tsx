import './three-fix';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
// Both layers are declared here, base first, so the workspace layer always
// cascades last. Importing workspace.css from App.tsx instead put it *before*
// the base sheet, and equal-specificity rules in the base silently won.
import './styles.css';
import './styles/workspace.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root container in index.html');

createRoot(container).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
