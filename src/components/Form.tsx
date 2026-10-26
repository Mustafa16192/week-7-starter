import React from 'react';
// Native inputs use their onSubmitEditing callbacks; web gets a semantic form.
export function Form({ children }: { children: React.ReactNode; label: string; onSubmit: () => void }) { return <>{children}</>; }
