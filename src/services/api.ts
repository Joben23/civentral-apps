import { DomainApplication } from '@/types/domain';
import { API_BASE_URL } from './auth-service';

export class CivicApiService {
  /**
   * Fetch Real Citizen Applications from PHP Backend API
   * Endpoint: https://civentral.tech/api/citizen/get-applications.php
   */
  static async getApplications(): Promise<DomainApplication[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/get-applications.php`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const text = await response.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        return [];
      }

      if (response.ok && json.status === 'success' && Array.isArray(json.data)) {
        return json.data.map((item: any) => ({
          id: item.application_id || item.id || `APP-${item.id}`,
          domainId: item.domain_id || item.domainId || 'identity',
          serviceTitle: item.service_title || item.title || 'Civic Service Application',
          applicantId: item.applicant_id || item.applicantId || '',
          status: item.status || 'Pending',
          createdAt: item.created_at || item.createdAt || '',
          updatedAt: item.updated_at || item.updatedAt || '',
        }));
      }

      return [];
    } catch {
      return [];
    }
  }
}
