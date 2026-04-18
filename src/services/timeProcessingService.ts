import { supabase } from './supabaseClient';

export async function closeTimesheet(
  companyId: string,
  month: number,
  year: number,
  userId?: string
) {
  const { data, error } = await supabase
    .from('timesheet_closures')
    .insert({
      company_id: companyId,
      month,
      year,
      user_id: userId,
      closed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function isTimesheetClosed(
  companyId: string,
  month: number,
  year: number
): Promise<boolean> {
  const { data, error } = await supabase
    .from('timesheet_closures')
    .select('id')
    .eq('company_id', companyId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}
