import { getSupabase } from '../../services/supabaseClient';
import { handleError } from '../utils/handleError';

/** Cargos / funções (`job_titles`). */
export async function getJobTitles(companyId: string) {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from('job_titles').select('*').eq('company_id', companyId);
  if (error) {
    handleError(error, 'getJobTitles');
    return [];
  }
  return data ?? [];
}
