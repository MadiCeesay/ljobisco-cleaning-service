import { create } from 'zustand';

export const emptyDraft = { contactPhone: '', service: '', propertyType: '', size: '', rooms: '', requirements: '', address: '', town: '', directions: '', date: '', time: '', description: '' };
export const useBookingDraft = create(set => ({
  values: { ...emptyDraft }, files: [], step: 0, requestId: crypto.randomUUID(),
  setValues: values => set({ values }),
  setFiles: files => set({ files }),
  setStep: step => set({ step }),
  clear: () => set({ values: { ...emptyDraft }, files: [], step: 0, requestId: crypto.randomUUID() }),
}));
