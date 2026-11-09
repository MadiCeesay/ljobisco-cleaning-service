import { useEffect, useState } from 'react';
import { services as approvedServices } from '../data/services';
import { apiConfigured, apiRequest } from './apiClient';

export function useServices(demo = false) {
  const [services, setServices] = useState(approvedServices);
  useEffect(() => {
    let active = true;
    if (demo) setServices(approvedServices);
    else if (apiConfigured) apiRequest('/services').then(result => { if (active && Array.isArray(result.services)) setServices(result.services); }).catch(() => {});
    return () => { active = false; };
  }, [demo]);
  return services;
}
