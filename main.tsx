import './lib/api';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import AppGuard from './components/AppGuard';
import './index.css';

// Safe DOM manipulation guard against browser extensions (Google Translate) and Framer Motion removeChild errors
if (typeof window !== 'undefined') {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (console && console.warn) {
        console.warn('Cannot remove child, parent mismatch prevented', child, this);
      }
      if (child.parentNode) {
        return originalRemoveChild.call(child.parentNode, child) as T;
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (console && console.warn) {
        console.warn('Cannot insert before, reference parent mismatch prevented', referenceNode, this);
      }
      return originalInsertBefore.call(this, newNode, null) as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

console.log('main.tsx executing...');
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppGuard>
        <App />
      </AppGuard>
    </BrowserRouter>
  </StrictMode>,
);

