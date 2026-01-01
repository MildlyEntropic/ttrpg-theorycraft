import { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api.js';

// Hook for fetching spell list with filters
export function useSpells(initialFilters = {}) {
  const [spells, setSpells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [pagination, setPagination] = useState({ total: 0, hasMore: false });

  const fetchSpells = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.getSpells('dnd5e-2014', filters);
      setSpells(result.spells);
      setPagination(result.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchSpells();
  }, [fetchSpells]);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters, offset: 0 }));
  }, []);

  const loadMore = useCallback(() => {
    if (pagination.hasMore) {
      setFilters(prev => ({
        ...prev,
        offset: (prev.offset || 0) + (prev.limit || 100)
      }));
    }
  }, [pagination.hasMore]);

  return {
    spells,
    loading,
    error,
    filters,
    pagination,
    updateFilters,
    loadMore,
    refresh: fetchSpells
  };
}

// Hook for spell statistics
export function useSpellStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getSpellStats('dnd5e-2014')
      .then(setStats)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { stats, loading, error };
}

// Hook for spell search
export function useSpellSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const search = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await api.searchSpells('dnd5e-2014', query, 20);
      setResults(result.spells);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, search };
}

// Hook for single spell with analysis
export function useSpellAnalysis(spellKey, context = {}) {
  const [spell, setSpell] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalysis = useCallback(async () => {
    if (!spellKey) {
      setSpell(null);
      setAnalysis(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [spellData, analysisData] = await Promise.all([
        api.getSpell('dnd5e-2014', spellKey),
        api.analyzeSpell('dnd5e-2014', spellKey, context)
      ]);

      setSpell(spellData);
      setAnalysis(analysisData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [spellKey, JSON.stringify(context)]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  return { spell, analysis, loading, error, refresh: fetchAnalysis };
}

// Hook for comparing spells
export function useSpellComparison() {
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const compare = useCallback(async (spellKeys, context = {}) => {
    if (!spellKeys || spellKeys.length < 2) {
      setComparison(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await api.compareSpells('dnd5e-2014', spellKeys, context);
      setComparison(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { comparison, loading, error, compare };
}

// Hook for best spells at a slot level
export function useBestSpells(slotLevel, context = {}) {
  const [bestSpells, setBestSpells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slotLevel || slotLevel < 1) {
      setBestSpells([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    api.getBestSpells('dnd5e-2014', slotLevel, context)
      .then(result => setBestSpells(result.bestSpells))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [slotLevel, JSON.stringify(context)]);

  return { bestSpells, loading, error };
}

// Hook for sync status
export function useSyncStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await api.getSyncStatus('dnd5e-2014');
      setStatus(result.status);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const sync = useCallback(async (resource = null) => {
    setSyncing(true);
    setError(null);

    try {
      await api.syncData('dnd5e-2014', resource);
      await fetchStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }, [fetchStatus]);

  return { status, loading, syncing, error, sync, refresh: fetchStatus };
}
