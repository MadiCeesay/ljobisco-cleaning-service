import { create } from 'zustand';
import { getDashboard } from './services';

const empty = { notifications: [], bookings: [], quotations: [], messages: [], payments: [], orders: [] };
let generation = 0;
export const useCustomerData = create(set => ({
  ...empty, loading: false, loaded: false, error: '',
  load: async demo => {
    const request = ++generation;
    set({ loading: true, error: '' });
    try {
      const data = await getDashboard(demo);
      if (request === generation) set({ ...empty, ...data, loading: false, loaded: true });
    } catch (error) { if (request === generation) set({ loading: false, loaded: true, error: error.message }); }
  },
  clear: () => { generation++; set({ ...empty, loading: false, loaded: false, error: '' }); },
}));
