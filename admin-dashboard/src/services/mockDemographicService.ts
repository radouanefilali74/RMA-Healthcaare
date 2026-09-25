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
  imei: string;
  category: 'CARDIO' | 'RESPIRATORY' | 'GENERAL' | 'CUSTOM';
  icon: string;
}

const MOCK_REGISTRY: Record<string, MockSeniorDemographics> = {
  'SNR-84920-X': {
    seniorRefId: 'SNR-84920-X',
    displayAlias: 'Eleanor V. (Demo)',
    careStation: 'West Wing - Room 304',
    clinicalRiskGroup: 'Cardiovascular Risk Group 2',
    emergencyChannel: 'Station Intercom #304 / Caregiver Mobile (+1-555-0192)',
    primaryPhysician: 'Dr. Sarah Jenkins, MD (Geriatric Cardiology)',
    conditionsSummary: ['Hypertension Stage 2', 'Chronic AFib', 'Mobility Assistance'],
    imei: '353456789012345',
    category: 'CARDIO',
    icon: '❤️',
  },
  'SNR-92104-Y': {
    seniorRefId: 'SNR-92104-Y',
    displayAlias: 'Arthur M. (Demo)',
    careStation: 'East Wing - Room 112',
    clinicalRiskGroup: 'Respiratory Risk Group 1 (COPD)',
    emergencyChannel: 'Oxygen Station #112 / Caregiver Mobile (+1-555-0188)',
    primaryPhysician: 'Dr. Robert Chen, MD (Pulmonology)',
    conditionsSummary: ['COPD Gold Stage 3', 'Nocturnal Hypoxemia', 'Supplemental O2'],
    imei: '867530901234567',
    category: 'RESPIRATORY',
    icon: '🫁',
  },
  'SNR-73201-A': {
    seniorRefId: 'SNR-73201-A',
    displayAlias: 'Beatrice L.',
    careStation: 'West Wing - Room 308',
    clinicalRiskGroup: 'Cardiovascular Risk Group 1',
    emergencyChannel: 'Intercom #308 / Caregiver Mobile (+1-555-0144)',
    primaryPhysician: 'Dr. Sarah Jenkins, MD (Cardiology)',
    conditionsSummary: ['Atrial Flutter', 'Mild Hypotension', 'Pacemaker Implanted'],
    imei: '865432109876543',
    category: 'CARDIO',
    icon: '❤️',
  },
  'SNR-64102-B': {
    seniorRefId: 'SNR-64102-B',
    displayAlias: 'Charles D.',
    careStation: 'North Wing - Room 201',
    clinicalRiskGroup: 'Metabolic & Diabetic Care',
    emergencyChannel: 'Station Intercom #201 / Care Station Ext. 22',
    primaryPhysician: 'Dr. Alan Morales, MD (Internal Medicine)',
    conditionsSummary: ['Type 2 Diabetes', 'Peripheral Neuropathy', 'Diet Controlled'],
    imei: '359876543210987',
    category: 'GENERAL',
    icon: '🏥',
  },
  'SNR-51203-C': {
    seniorRefId: 'SNR-51203-C',
    displayAlias: 'Dorothy K.',
    careStation: 'Memory Care - Suite 104',
    clinicalRiskGroup: 'Neurological / High Fall Risk',
    emergencyChannel: 'Nurse Station #1 / Emergency Pendant Channel 4',
    primaryPhysician: 'Dr. Elena Rostova, MD (Neurology)',
    conditionsSummary: ['Early Cognitive Decline', 'Gait Instability', 'High Fall Risk'],
    imei: '861234567890123',
    category: 'GENERAL',
    icon: '⚠️',
  },
  'SNR-42304-D': {
    seniorRefId: 'SNR-42304-D',
    displayAlias: 'Edward S.',
    careStation: 'South Wing - Room 410',
    clinicalRiskGroup: 'Post-Surgical Cardiac Recovery',
    emergencyChannel: 'Cardiac Monitor Ext. 410 / Lead RN Direct',
    primaryPhysician: 'Dr. Sarah Jenkins, MD (Cardiology)',
    conditionsSummary: ['CABG Recovery Day 14', 'Telemetry Monitored', 'Strict Vitals Cadence'],
    imei: '352345678901234',
    category: 'CARDIO',
    icon: '❤️',
  },
  'SNR-33405-E': {
    seniorRefId: 'SNR-33405-E',
    displayAlias: 'Florence N.',
    careStation: 'West Wing - Room 312',
    clinicalRiskGroup: 'Hypertension Tier 2',
    emergencyChannel: 'Intercom #312 / Duty Nurse Mobile',
    primaryPhysician: 'Dr. Marcus Vance, MD (Geriatrics)',
    conditionsSummary: ['Essential Hypertension', 'Mild Renal Insufficiency'],
    imei: '863456789012345',
    category: 'CARDIO',
    icon: '❤️',
  },
  'SNR-24506-F': {
    seniorRefId: 'SNR-24506-F',
    displayAlias: 'George B.',
    careStation: 'East Wing - Room 115',
    clinicalRiskGroup: 'Chronic Pulmonary Protocol',
    emergencyChannel: 'Oxygen Station #115 / Pulmonology On-Call',
    primaryPhysician: 'Dr. Robert Chen, MD (Pulmonology)',
    conditionsSummary: ['Severe Emphysema', 'Continuous 2L O2 Cannula', 'Dyspnea upon Exertion'],
    imei: '354567890123456',
    category: 'RESPIRATORY',
    icon: '🫁',
  },
  'SNR-15607-G': {
    seniorRefId: 'SNR-15607-G',
    displayAlias: 'Helen T.',
    careStation: 'North Wing - Room 205',
    clinicalRiskGroup: 'Standard Geriatric Baseline',
    emergencyChannel: 'Station Intercom #205 / Caregiver Mobile',
    primaryPhysician: 'Dr. Alan Morales, MD (Internal Medicine)',
    conditionsSummary: ['Mild Osteoarthritis', 'Independent Mobility'],
    imei: '865678901234567',
    category: 'GENERAL',
    icon: '🏥',
  },
  'SNR-96708-H': {
    seniorRefId: 'SNR-96708-H',
    displayAlias: 'Isaac P.',
    careStation: 'West Wing - Room 302',
    clinicalRiskGroup: 'Congestive Heart Failure',
    emergencyChannel: 'Cardiac Station #302 / Code Response Team',
    primaryPhysician: 'Dr. Sarah Jenkins, MD (Cardiology)',
    conditionsSummary: ['CHF Class III', 'Fluid Retention Monitoring', 'Daily Vitals Tracking'],
    imei: '356789012345678',
    category: 'CARDIO',
    icon: '❤️',
  },
  'SNR-87809-J': {
    seniorRefId: 'SNR-87809-J',
    displayAlias: 'Judith M.',
    careStation: 'Memory Care - Suite 109',
    clinicalRiskGroup: 'Memory Support & Wandering Risk',
    emergencyChannel: 'Perimeter Alert #109 / Memory Care Desk',
    primaryPhysician: 'Dr. Elena Rostova, MD (Neurology)',
    conditionsSummary: ['Moderate Dementia', 'Sleep Cycle Inversion', 'Geo-Fenced Protocol'],
    imei: '867890123456789',
    category: 'GENERAL',
    icon: '⚠️',
  },
  'SNR-78910-K': {
    seniorRefId: 'SNR-78910-K',
    displayAlias: 'Kenneth R.',
    careStation: 'East Wing - Room 118',
    clinicalRiskGroup: 'Adult Asthma & Bronchospasm',
    emergencyChannel: 'Nebulizer Station #118 / Respiratory Therapy',
    primaryPhysician: 'Dr. Robert Chen, MD (Pulmonology)',
    conditionsSummary: ['Refractory Asthma', 'Steroid Dependent', 'Nocturnal Wheezing'],
    imei: '358901234567890',
    category: 'RESPIRATORY',
    icon: '🫁',
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
    imei: `35${seniorRefId.replace(/[^0-9]/g, '').padEnd(13, '0')}`,
    category: 'GENERAL',
    icon: '🏥',
  };
}

export function getRegisteredFleetRoster(): MockSeniorDemographics[] {
  return Object.values(MOCK_REGISTRY);
}
