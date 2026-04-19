import { getSupabase } from '../../services/supabaseClient';
import { handleError } from '../utils/handleError';

export async function getEstruturas(companyId: string) {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from('estruturas').select('*').eq('company_id', companyId);
  if (error) {
    handleError(error, 'getEstruturas');
    return [];
  }
  return data ?? [];
}
