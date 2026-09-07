/**
 * CNDP COMPLIANCE NOTICE:
 * This module is a decoupled, independent mock adapter designed ONLY for UI testing & demonstrations.
 * Under CNDP regulations, the core telemetry system does not store or process any senior PII.
 * 
 * To disable this mock entirely, set ENABLE_DEMOGRAPHIC_MOCK to false.
 * When disabled, the UI operates strictly on anonymous `seniorRefId` identifiers provided by the external demographic authority.
 */

export const ENABLE_DEMOGRAPHIC_MOCK = true;

export interface MockSeniorDemographics {
  seniorRefId: string;
  displayAlias: string;
  careStation: string;
  clinicalRiskGroup: string;
  emergencyChannel: string;
  primaryPhysician: string;
  conditionsSummary: string[];
}

const MOCK_REGISTRY: Record<string, MockSeniorDemographics> = {
  'SNR-84920-X': {
    seniorRefId: 'SNR-84920-X',
    displayAlias: 'Resident #84920 (Eleanor V. - Demo)',
    careStation: 'West Wing - Room 304',
    clinicalRiskGroup: 'Cardiovascular Risk Group 2',
    emergencyChannel: 'Station Intercom #304 / Caregiver Mobile (+1-555-0192)',
    primaryPhysician: 'Dr. Sarah Jenkins, MD (Geriatric Cardiology)',
    conditionsSummary: ['Hypertension Stage 2', 'Chronic AFib', 'Mobility Assistance'],
  },
  'SNR-92104-Y': {
    seniorRefId: 'SNR-92104-Y',
    displayAlias: 'Resident #92104 (Arthur M. - Demo)',
    careStation: 'East Wing - Room 112',
    clinicalRiskGroup: 'Respiratory Risk Group 1 (COPD)',
    emergencyChannel: 'Oxygen Station #112 / Caregiver Mobile (+1-555-0188)',
    primaryPhysician: 'Dr. Robert Chen, MD (Pulmonology)',
    conditionsSummary: ['COPD Gold Stage 3', 'Nocturnal Hypoxemia', 'Supplemental O2'],
  },
};

export function getMockDemographics(seniorRefId?: string): MockSeniorDemographics | null {
  if (!ENABLE_DEMOGRAPHIC_MOCK || !seniorRefId) {
    return null;
  }

  if (MOCK_REGISTRY[seniorRefId]) {
    return MOCK_REGISTRY[seniorRefId];
  }

  // Fallback procedural mock for new unseen seniorRefId
  return {
    seniorRefId,
    displayAlias: `Senior Resident (${seniorRefId})`,
    careStation: 'General Care Sector',
    clinicalRiskGroup: 'Standard Geriatric Protocol',
    emergencyChannel: 'Nurse Call Center Ext. 100',
    primaryPhysician: 'Attending Duty Physician',
    conditionsSummary: ['Baseline Geriatric Monitoring'],
  };
}
