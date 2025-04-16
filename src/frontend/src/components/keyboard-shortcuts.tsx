import { useEffect } from 'react';

interface KeyboardShortcutsProps {
  onSend: () => void;
  onClearChat?: () => void;
  onSwitchToTools?: () => void;
  onSwitchToChat?: () => void;
  isInputEmpty: boolean;
}

export function KeyboardShortcuts({
  onSend,
  onClearChat,
  onSwitchToTools,
  onSwitchToChat,
  isInputEmpty
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if target is input or textarea (to avoid triggering when typing)
      const targetElement = e.target as HTMLElement;
      const isEditingInput = 
        targetElement.tagName === 'INPUT' || 
        targetElement.tagName === 'TEXTAREA' ||
        targetElement.isContentEditable;

      // Command+Enter or Ctrl+Enter to send
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isInputEmpty) {
        onSend();
        e.preventDefault();
      }

      // Avoid triggering shortcuts when typing in inputs
      if (isEditingInput) return;

      // Alt+T to switch to tools tab
      if (e.altKey && e.key === 't' && onSwitchToTools) {
        onSwitchToTools();
        e.preventDefault();
      }

      // Alt+C to switch to chat tab
      if (e.altKey && e.key === 'c' && onSwitchToChat) {
        onSwitchToChat();
        e.preventDefault();
      }

      // Alt+X to clear chat
      if (e.altKey && e.key === 'x' && onClearChat) {
        onClearChat();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSend, onClearChat, onSwitchToTools, onSwitchToChat, isInputEmpty]);

  return null;
}
