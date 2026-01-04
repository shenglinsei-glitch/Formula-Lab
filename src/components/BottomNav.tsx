import React from 'react';
import { Home, GraduationCap } from 'lucide-react';

interface BottomNavProps {
  currentPage: 'home' | 'learning';
  onNavigateHome: () => void;
  onNavigateLearning: () => void;
}

export default function BottomNav({ currentPage, onNavigateHome, onNavigateLearning }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-nav border-t border-border">
      <div className="flex">
        <button
          onClick={onNavigateHome}
          className={`flex-1 py-3 flex flex-col items-center justify-center transition-colors ${
            currentPage === 'home' ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Home className="w-6 h-6" />
        </button>
        <button
          onClick={onNavigateLearning}
          className={`flex-1 py-3 flex flex-col items-center justify-center transition-colors ${
            currentPage === 'learning' ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <GraduationCap className="w-6 h-6" />
        </button>
      </div>
    </nav>
  );
}
