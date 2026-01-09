import { Menu, Book } from 'lucide-react';
import { AnimatedTitle } from './AnimatedTitle';

export const Header = ({ onMenuOpen, showTitle, onHomeClick }) => {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 px-4 flex items-center justify-between bg-background border-b border-foreground/10 z-30">
      <div className="w-10">
        {/* Logo */}
        <button onClick={onHomeClick} className="hover:opacity-70 transition-opacity">
          <Book size={28} strokeWidth={1.5} />
        </button>
      </div>
      
      <div className="absolute left-1/2 transform -translate-x-1/2">
        {showTitle && (
          <button onClick={onHomeClick} className="hover:opacity-70 transition-opacity">
            <AnimatedTitle size="small" />
          </button>
        )}
      </div>

      <button 
        onClick={onMenuOpen}
        className="p-2 hover:bg-foreground/5 rounded-full transition-colors"
      >
        <Menu size={28} />
      </button>
    </header>
  );
};
