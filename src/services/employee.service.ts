import { db } from '../../services/supabaseClient';
import { handleError } from '../utils/handleError';

export async function getUsersByCompany(companyId: string) {
  try {
    return await db.select(
      'users',
      [{ column: 'company_id', operator: 'eq', value: companyId }],
      { column: 'created_at', ascending: false },
    );
  } catch (e) {
    handleError(e, 'getUsersByCompany');
    return [];
  }
}

export async function getLegacyEmployeesByCompany(companyId: string) {
  try {
    return await db.select('employees', [{ column: 'company_id', operator: 'eq', value: companyId }]);
  } catch (e) {
    handleError(e, 'getLegacyEmployeesByCompany');
    return [];
  }
}
