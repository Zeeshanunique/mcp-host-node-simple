import React from 'react';
import { Keyboard, HelpCircle } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';

export function ShortcutsHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Keyboard shortcuts">
          <Keyboard className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate the MCP Host Interface more efficiently.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_2fr] items-center gap-4">
              <div className="flex justify-end">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  Alt+C
                </kbd>
              </div>
              <span className="text-sm text-muted-foreground">Switch to Chat tab</span>
            </div>
            <div className="grid grid-cols-[1fr_2fr] items-center gap-4">
              <div className="flex justify-end">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  Alt+T
                </kbd>
              </div>
              <span className="text-sm text-muted-foreground">Switch to Tools tab</span>
            </div>
            <div className="grid grid-cols-[1fr_2fr] items-center gap-4">
              <div className="flex justify-end">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  Alt+X
                </kbd>
              </div>
              <span className="text-sm text-muted-foreground">Clear chat history</span>
            </div>
            <div className="grid grid-cols-[1fr_2fr] items-center gap-4">
              <div className="flex justify-end space-x-1">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  Ctrl
                </kbd>
                <span>+</span>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  Enter
                </kbd>
              </div>
              <span className="text-sm text-muted-foreground">Send message</span>
            </div>
            <div className="grid grid-cols-[1fr_2fr] items-center gap-4">
              <div className="flex justify-end">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  Shift+Enter
                </kbd>
              </div>
              <span className="text-sm text-muted-foreground">New line in message</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-start space-x-2 bg-muted/50 p-3 rounded-md">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Press <kbd className="px-1 bg-background rounded text-[10px] border">?</kbd> anywhere to open this dialog.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
