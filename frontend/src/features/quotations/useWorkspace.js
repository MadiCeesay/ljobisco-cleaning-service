import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../customer/authStore';
import { getWorkspace } from './services';

export function useWorkspace() {
  const { user, demo } = useAuth();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ quotes: [], bookings: [], conversations: [], loading: true, loaded: false, error: '' });
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let active = true;
    setState(previous => ({ ...previous, loading: !previous.loaded, error: '' }));
    getWorkspace(demo, user).then(data => { if (active) setState(previous => ({ ...previous, ...data, loaded: true, loading: false, error: '' })); }).catch(error => { if (active) setState(previous => ({ ...previous, loading: false, error: error.message })); });
    return () => { active = false; };
  }, [user, demo, revision]);
  return { ...state, refresh, user, demo };
}
