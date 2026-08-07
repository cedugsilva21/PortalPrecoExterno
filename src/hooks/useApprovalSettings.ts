import { useState, useEffect, useCallback } from 'react';
import { supabase, type ApprovalSettings, DEFAULT_SETTINGS } from '@/lib/supabase';

export function useApprovalSettings() {
  const [settings, setSettings] = useState<ApprovalSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('approval_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) {
      setSettings(DEFAULT_SETTINGS);
    } else {
      setSettings(data as ApprovalSettings);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  return { settings, loading, refetch: fetchSettings };
}
