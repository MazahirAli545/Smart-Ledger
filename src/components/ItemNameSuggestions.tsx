import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { fetchItemNames } from '../api/items';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface ItemNameSuggestionsProps {
  query: string;
  visible: boolean;
  onSelect: (name: string) => void;
  maxHeight?: number;
  localCandidates?: string[]; // optional list of local item names to include
}

const DEBOUNCE_MS = 200;

const ItemNameSuggestions: React.FC<ItemNameSuggestionsProps> = ({
  query,
  visible,
  onSelect,
  maxHeight = 200,
  localCandidates = [],
}) => {
  const [names, setNames] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<any>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Ensure dropdown is fresh on each screen load: clear any persisted dismissals
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.removeItem('dismissedItemNames_v1');
      } catch {}
      setDismissed(new Set());
    })();
  }, []);

  const q = (query || '').trim();

  useEffect(() => {
    if (!visible) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchItemNames(q, 1, 10);
        setNames(res.data || []);
        // Also load recent local names for immediate suggestions
        try {
          const raw = await AsyncStorage.getItem('recentItemNames_v1');
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) setRecent(arr.filter(Boolean));
          }
          const dismissedRaw = await AsyncStorage.getItem(
            'dismissedItemNames_v1',
          );
          if (dismissedRaw) {
            const arr = JSON.parse(dismissedRaw);
            if (Array.isArray(arr))
              setDismissed(
                new Set(arr.map((s: string) => String(s || '').toLowerCase())),
              );
          }
        } catch {}
      } catch (e: any) {
        setError(e?.message || 'Failed to load items');
        setNames([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => timerRef.current && clearTimeout(timerRef.current);
  }, [q, visible]);

  // Merge local candidates with fetched names, filter by query, and dedupe
  const mergedNames = useMemo(() => {
    const needle = (q || '').toLowerCase();

    // Collect all candidates from all sources
    const allCandidates: string[] = [
      ...(localCandidates || []),
      ...(names || []),
      ...(recent || []),
    ];

    // Normalize and deduplicate using case-insensitive comparison
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const candidate of allCandidates) {
      const normalized = String(candidate || '').trim();
      if (normalized.length === 0) continue;

      // Check if it matches the query
      if (needle && !normalized.toLowerCase().includes(needle)) continue;

      // Use lowercase for deduplication
      const key = normalized.toLowerCase();
      // Skip dismissed entries
      if (dismissed.has(key)) continue;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(normalized);
      }
    }

    return unique;
  }, [q, names, localCandidates, recent, dismissed]);

  const handleDismiss = async (name: string) => {
    const key = String(name || '')
      .trim()
      .toLowerCase();
    if (!key) return;
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    try {
      // persist dismissed list
      const raw = await AsyncStorage.getItem('dismissedItemNames_v1');
      const arr = raw ? JSON.parse(raw) : [];
      const set = new Set<string>(
        Array.isArray(arr)
          ? arr.map((s: string) => String(s || '').toLowerCase())
          : [],
      );
      set.add(key);
      await AsyncStorage.setItem(
        'dismissedItemNames_v1',
        JSON.stringify(Array.from(set)),
      );
      // also remove from recent cache so it doesn't reappear from local source
      const recentRaw = await AsyncStorage.getItem('recentItemNames_v1');
      if (recentRaw) {
        const rArr = JSON.parse(recentRaw);
        if (Array.isArray(rArr)) {
          const filtered = rArr.filter(
            (s: string) =>
              String(s || '')
                .trim()
                .toLowerCase() !== key,
          );
          await AsyncStorage.setItem(
            'recentItemNames_v1',
            JSON.stringify(filtered),
          );
          setRecent(filtered);
        }
      }
    } catch {}
  };

  if (!visible) return null;

  return (
    <View style={[styles.dropdown, { maxHeight }]}>
      {loading && mergedNames.length === 0 ? (
        <Text style={styles.hint}>Loading items...</Text>
      ) : error ? (
        <Text style={[styles.hint, styles.error]} numberOfLines={2}>
          {error}
        </Text>
      ) : mergedNames.length === 0 ? (
        <Text style={styles.hint}>No items found</Text>
      ) : (
        <ScrollView
          style={[styles.scrollView, { maxHeight }]}
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
          bounces={true}
          scrollEnabled={true}
        >
          {mergedNames.map(name => (
            <View key={name} style={styles.itemRow}>
              <TouchableOpacity
                style={styles.itemTextContainer}
                onPress={() => onSelect(name)}
                activeOpacity={0.7}
              >
                <Text style={styles.itemText} numberOfLines={1}>
                  {name}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDismiss(name)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.iconButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={18}
                  color="#9ca3af"
                />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    overflow: 'hidden',
  },
  scrollView: {
    maxHeight: 200,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  itemRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  itemText: {
    fontSize: 14,
    color: '#1f2937',
    fontFamily: 'Roboto-Medium',
  },
  iconButton: {
    height: 28,
    width: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  hint: {
    padding: 12,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
    backgroundColor: '#fafafa',
  },
  error: {
    color: '#dc3545',
  },
});

export default ItemNameSuggestions;
