import React from 'react';
import { Folder, FunctionSquare, Sigma, GraduationCap } from 'lucide-react';

interface BottomNavProps {
  currentPage: 'scenes' | 'formulas' | 'symbols' | 'learning';
  onNavigateScenes: () => void;
  onNavigateFormulas: () => void;
  onNavigateSymbols: () => void;
  onNavigateLearning: () => void;
}

export default function BottomNav({
  currentPage,
  onNavigateScenes,
  onNavigateFormulas,
  onNavigateSymbols,
  onNavigateLearning,
}: BottomNavProps) {
  const itemClass = (active: boolean) =>
    `flex-1 py-3 flex flex-col items-center justify-center transition-colors ${
      active ? 'text-primary' : 'text-muted-foreground'
    }`;

  return (
    // z-index & pointer-events are important on mobile/PWA.
    // Some pages may render full-height containers that can intercept taps
    // even when the nav is visible. Keep the nav above and clickable.
    <nav className="fixed bottom-0 left-0 right-0 z-50 pointer-events-auto glass-nav border-t border-border">
      <div className="flex">
        <button onClick={onNavigateScenes} className={itemClass(currentPage === 'scenes')}>
          <Folder className="w-6 h-6" />
        </button>
        <button onClick={onNavigateFormulas} className={itemClass(currentPage === 'formulas')}>
          <FunctionSquare className="w-6 h-6" />
        </button>
        <button onClick={onNavigateSymbols} className={itemClass(currentPage === 'symbols')}>
          <Sigma className="w-6 h-6" />
        </button>
        <button onClick={onNavigateLearning} className={itemClass(currentPage === 'learning')}>
          <GraduationCap className="w-6 h-6" />
        </button>
      </div>
    </nav>
  );
}
