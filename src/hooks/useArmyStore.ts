import { useState, useEffect } from 'react';
import type { Army, Attachments } from '../types';
import { parseNR } from '../utils/parseNR';
import type { NRJson } from '../utils/parseNR';
import { readStore, writeStore, buildOrder, CURRENT_KEY } from '../utils/storage';
import { colorForCluster } from '../utils/clusterColors';

export function useArmyStore() {
  const [currentListId, setCurrentListId] = useState<string | null>(
    () => localStorage.getItem(CURRENT_KEY),
  );

  const [army, setArmy] = useState<Army | null>(() => {
    try {
      const id = localStorage.getItem(CURRENT_KEY);
      if (!id) return null;
      const entry = readStore()[id];
      return entry ? parseNR(JSON.parse(entry.raw) as NRJson) : null;
    } catch { return null; }
  });

  const [savedLists, setSavedLists] = useState<Record<string, string>>(() => {
    const s = readStore();
    return Object.fromEntries(Object.entries(s).map(([id, e]) => [id, e.name]));
  });

  const [attachments, setAttachments] = useState<Attachments>(() => {
    try {
      const id = localStorage.getItem(CURRENT_KEY);
      if (!id) return {};
      return readStore()[id]?.attachments ?? {};
    } catch { return {}; }
  });

  const [unitOrder, setUnitOrder] = useState<string[]>(() => {
    try {
      const id = localStorage.getItem(CURRENT_KEY);
      if (!id) return [];
      const entry = readStore()[id];
      if (!entry) return [];
      const parsed = parseNR(JSON.parse(entry.raw) as NRJson);
      return buildOrder(parsed.units.map(u => u.id), entry.order);
    } catch { return []; }
  });

  const [unitImages, setUnitImages] = useState<Record<string, string>>(() => {
    try {
      const id = localStorage.getItem(CURRENT_KEY);
      if (!id) return {};
      return readStore()[id]?.images ?? {};
    } catch { return {}; }
  });

  const [clusterColors, setClusterColors] = useState<Record<string, string>>(() => {
    try {
      const id = localStorage.getItem(CURRENT_KEY);
      if (!id) return {};
      return readStore()[id]?.clusterColors ?? {};
    } catch { return {}; }
  });

  useEffect(() => {
    if (!currentListId) return;
    const store = readStore();
    const entry = store[currentListId];
    if (!entry) return;
    store[currentListId] = { ...entry, attachments, clusterColors, order: unitOrder, images: unitImages };
    writeStore(store);
  }, [currentListId, attachments, clusterColors, unitOrder, unitImages]);

  function importRaw(raw: string) {
    try {
      const parsed = parseNR(JSON.parse(raw) as NRJson);
      const store = readStore();
      // If the roster ID is already taken by a differently-named list, use the
      // name as the key instead (New Recruit sometimes reuses IDs across lists).
      let newId = parsed.id;
      if (store[newId] && store[newId].name !== parsed.name) {
        newId = parsed.name;
        if (store[newId] && store[newId].raw !== raw) {
          newId = `${parsed.name}_${Date.now()}`;
        }
      }
      const saved = store[newId];
      const newAttachments = saved?.attachments ?? {};
      const newColors = saved?.clusterColors ?? {};
      const newImages = saved?.images ?? {};
      const newOrder = buildOrder(parsed.units.map(u => u.id), saved?.order ?? null);
      store[newId] = { raw, name: parsed.name, attachments: newAttachments, clusterColors: newColors, order: newOrder, images: newImages };
      writeStore(store);
      localStorage.setItem(CURRENT_KEY, newId);
      setArmy(parsed);
      setCurrentListId(newId);
      setAttachments(newAttachments);
      setClusterColors(newColors);
      setUnitOrder(newOrder);
      setUnitImages(newImages);
      setSavedLists(prev => ({ ...prev, [newId]: parsed.name }));
    } catch (err) {
      alert('Could not parse JSON: ' + (err as Error).message);
    }
  }

  function selectList(id: string) {
    if (id === currentListId) return;
    const store = readStore();
    const entry = store[id];
    if (!entry) return;
    try {
      const parsed = parseNR(JSON.parse(entry.raw) as NRJson);
      const order = buildOrder(parsed.units.map(u => u.id), entry.order);
      localStorage.setItem(CURRENT_KEY, id);
      setArmy(parsed);
      setCurrentListId(id);
      setAttachments(entry.attachments);
      setClusterColors(entry.clusterColors);
      setUnitOrder(order);
      setUnitImages(entry.images);
    } catch { /* ignore */ }
  }

  function deleteList(id: string) {
    const store = readStore();
    delete store[id];
    writeStore(store);
    setSavedLists(prev => { const next = { ...prev }; delete next[id]; return next; });
  }

  function attachTo(unitId: string, primaryId: string) {
    setAttachments(prev => ({ ...prev, [primaryId]: [...(prev[primaryId] ?? []), unitId] }));
    setClusterColors(prev => prev[primaryId] ? prev : { ...prev, [primaryId]: colorForCluster(primaryId) });
  }

  function detach(unitId: string) {
    setAttachments(prev => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key].filter(id => id !== unitId);
        if (next[key].length === 0) delete next[key];
      }
      return next;
    });
  }

  function reattach(unitId: string, newPrimaryId: string) {
    setAttachments(prev => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key].filter(id => id !== unitId);
        if (next[key].length === 0) delete next[key];
      }
      next[newPrimaryId] = [...(next[newPrimaryId] ?? []), unitId];
      return next;
    });
  }

  function setImage(unitId: string, url: string | null) {
    setUnitImages(prev => {
      const next = { ...prev };
      if (url) next[unitId] = url;
      else delete next[unitId];
      return next;
    });
  }

  function dissolve(primaryId: string) {
    setAttachments(prev => { const next = { ...prev }; delete next[primaryId]; return next; });
    setClusterColors(prev => { const next = { ...prev }; delete next[primaryId]; return next; });
  }

  function setClusterColor(unitId: string, hex: string) {
    setClusterColors(prev => ({ ...prev, [unitId]: hex }));
  }

  return {
    army, currentListId, savedLists,
    attachments, clusterColors, unitOrder, setUnitOrder, unitImages,
    importRaw, selectList, deleteList,
    attachTo, detach, reattach, dissolve, setImage, setClusterColor,
  };
}
