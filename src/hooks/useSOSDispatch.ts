import { useState } from 'react';
import { EmergencyCategory, IncidentSOSReport } from '@/types/emergency';

export function useSOSDispatch() {
  const [activeIncident, setActiveIncident] = useState<IncidentSOSReport | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);

  const triggerSOS = async (category: EmergencyCategory) => {
    setIsDispatching(true);
    // Simulate high-priority dispatch API call
    setTimeout(() => {
      const incident: IncidentSOSReport = {
        id: `SOS-${Math.floor(1000 + Math.random() * 9000)}`,
        category,
        status: 'Dispatched',
        location: {
          latitude: 14.5995,
          longitude: 120.9842,
          addressName: 'Barangay Central Municipal Plaza',
        },
        timestamp: new Date().toLocaleTimeString(),
        responderUnit: 'Central DRRM Unit 4',
      };
      setActiveIncident(incident);
      setIsDispatching(false);
    }, 1500);
  };

  const cancelSOS = () => {
    setActiveIncident(null);
  };

  return {
    activeIncident,
    isDispatching,
    triggerSOS,
    cancelSOS,
  };
}
