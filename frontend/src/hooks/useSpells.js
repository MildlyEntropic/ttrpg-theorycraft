import { useState, useEffect, useCallback } from 'react';
import * as data from '../lib/data.js';
import { analyzeSpell, compareSpells, getBestSpellsForSlot } from '../lib/spell-analyzer.js';

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
      const result = await data.getSpells(filters);
      const limit = filters.limit || 100;
      const offset = filters.offset || 0;

      // Apply pagination locally
      const paginatedSpells = result.slice(offset, offset + limit);

      setSpells(paginatedSpells);
      setPagination({
        total: result.length,
        hasMore: offset + limit < result.length
      });
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
    data.getSpellStats()
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
      const result = await data.searchSpells(query, 20);
      setResults(result);
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
      const spellData = await data.getSpell(spellKey);
      if (spellData) {
        setSpell(spellData);
        // Run analysis locally
        const analysisData = analyzeSpell(spellData, context);
        setAnalysis(analysisData);
      } else {
        setError('Spell not found');
      }
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
      // Get all the spells first
      const spellPromises = spellKeys.map(key => data.getSpell(key));
      const spells = await Promise.all(spellPromises);
      const validSpells = spells.filter(Boolean);

      // Run comparison locally
      const result = compareSpells(validSpells, context);
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

    data.getDamageSpells()
      .then(spells => {
        const result = getBestSpellsForSlot(spells, slotLevel, context);
        setBestSpells(result);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [slotLevel, JSON.stringify(context)]);

  return { bestSpells, loading, error };
}

// Hook for filter options
export function useFilterOptions() {
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    data.getFilterOptions()
      .then(setOptions)
      .finally(() => setLoading(false));
  }, []);

  return { options, loading };
}
