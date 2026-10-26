import React from 'react';
export function Form({ children, label, onSubmit }: { children: React.ReactNode; label: string; onSubmit: () => void }) {
  return <form aria-label={label} onSubmit={(event) => { event.preventDefault(); onSubmit(); }} style={{ display: 'flex', flexDirection: 'column', gap: 16, margin: 0 }}>{children}</form>;
}
