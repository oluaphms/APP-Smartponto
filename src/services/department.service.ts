import { getSupabase } from '../../services/supabaseClient';
import { handleError } from '../utils/handleError';

export async function getDepartments(companyId: string) {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from('departments').select('*').eq('company_id', companyId);
  if (error) {
    handleError(error, 'getDepartments');
    return [];
  }
  return data ?? [];
}
