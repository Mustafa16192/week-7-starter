import { useEffect, useRef, useState } from 'react';
import type { ClassroomService } from '../firebase/service';
import type { Question, QuestionActivity } from '../model';
import { readableError } from '../model';

export function useRoomFeed(service: ClassroomService, code: string, retry: number) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activity, setActivity] = useState<Record<string, QuestionActivity>>({});
  const [authored, setAuthored] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [cached, setCached] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    let active = true;
    const children = new Map<string, () => void>();
    const fail = (err: Error) => { if (active) { setError(readableError(err)); setLoading(false); } };
    const stopAuthored = service.subscribeAuthored(code, (ids) => { if (active) setAuthored(ids); }, fail);
    const stopQuestions = service.subscribeQuestions(code, (next, fromCache) => {
      if (!active) return;
      setQuestions(next); setCached(fromCache); setLoading(false); setError('');
      const ids = new Set(next.map((q) => q.id));
      setActivity((previous) => Object.fromEntries(Object.entries(previous).filter(([id]) => ids.has(id))));
      for (const [id, stop] of children) if (!ids.has(id)) { stop(); children.delete(id); }
      for (const q of next) if (!children.has(q.id) && !q.pending) {
        let responseReady = false; let votesReady = false;
        const patch = (value: Partial<QuestionActivity>) => {
          if (!active || current !== generation.current) return;
          setActivity((previous) => ({ ...previous, [q.id]: { ...(previous[q.id] || { responses: [], voters: [], error: '', loaded: false }), ...value } }));
        };
        const childFail = (err: Error) => patch({ error: readableError(err), loaded: false });
        const stopResponses = service.subscribeResponses(code, q.id, (responses) => { responseReady = true; patch({ responses, error: '', loaded: responseReady && votesReady }); }, childFail);
        const stopVotes = service.subscribeVotes(code, q.id, (voters) => { votesReady = true; patch({ voters, error: '', loaded: responseReady && votesReady }); }, childFail);
        children.set(q.id, () => { stopResponses(); stopVotes(); });
      }
    }, fail);
    return () => { active = false; stopQuestions(); stopAuthored(); children.forEach((stop) => stop()); };
  }, [service, code, retry]);
  return { questions, activity, authored, loading, cached, error };
}
