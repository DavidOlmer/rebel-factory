import { useState, useEffect, useCallback } from 'react';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiResult<T> extends UseApiState<T> {
  refetch: () => Promise<void>;
}

export function useApi<T>(
  fetchFn: () => Promise<T>,
  dependencies: unknown[] = []
): UseApiResult<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchFn();
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : 'An error occurred',
      });
    }
  }, [fetchFn, ...dependencies]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...state,
    refetch: fetchData,
  };
}

// Simple fetch wrapper with error handling
export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const baseUrl = process.env.REACT_APP_API_URL || '/api';
  
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Mutation hook for POST/PUT/DELETE operations
export function useMutation<T, P = unknown>(
  mutationFn: (params: P) => Promise<T>
) {
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    data: T | null;
  }>({
    loading: false,
    error: null,
    data: null,
  });

  const mutate = useCallback(async (params: P) => {
    setState({ loading: true, error: null, data: null });
    try {
      const data = await mutationFn(params);
      setState({ loading: false, error: null, data });
      return data;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'An error occurred';
      setState({ loading: false, error, data: null });
      throw err;
    }
  }, [mutationFn]);

  return {
    ...state,
    mutate,
    reset: () => setState({ loading: false, error: null, data: null }),
  };
}
