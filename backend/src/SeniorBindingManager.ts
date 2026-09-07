export interface SafetyThresholds {
  hrMin: number;        // e.g. 50 bpm (Bradycardia threshold)
  hrMax: number;        // e.g. 110 bpm (Tachycardia threshold)
  bpSysMax: number;     // e.g. 140 mmHg (Systolic limit)
  bpDiaMax: number;     // e.g. 90 mmHg (Diastolic limit)
  spo2Min: number;      // e.g. 92% (Hypoxia limit)
  tempMin: number;      // e.g. 35.5 °C (Hypothermia limit)
  tempMax: number;      // e.g. 37.8 °C (Fever limit)
}

export interface SeniorDeviceBinding {
  imei: string;
  seniorRefId: string;                   // Pseudonymized external reference identifier (CNDP compliant: No PII)
  telemetryFrequencySeconds: number;     // Configured transmission cadence
  safetyThresholds: SafetyThresholds;
  profileCategory: 'GENERAL' | 'CARDIO' | 'RESPIRATORY' | 'CUSTOM';
  clinicalRiskNotes?: string;            // Anonymized medical risk tags, e.g. "Cardiovascular Risk Tier 2"
  lastUpdated: string;
}

export class SeniorBindingManager {
  private bindings: Map<string, SeniorDeviceBinding> = new Map();

  constructor() {
    // Seed Senior 1 (Cardio Profile - SNR-84920-X)
    this.bindings.set('353456789012345', {
      imei: '353456789012345',
      seniorRefId: 'SNR-84920-X',
      telemetryFrequencySeconds: 15,
      profileCategory: 'CARDIO',
      clinicalRiskNotes: 'Hypertension & Arrhythmia Protocol Tier 2',
      safetyThresholds: {
        hrMin: 50,
        hrMax: 110,
        bpSysMax: 140,
        bpDiaMax: 90,
        spo2Min: 92,
        tempMin: 35.5,
        tempMax: 37.8,
      },
      lastUpdated: new Date().toISOString(),
    });

    // Seed Senior 2 (Respiratory / COPD Profile - SNR-92104-Y)
    this.bindings.set('867530901234567', {
      imei: '867530901234567',
      seniorRefId: 'SNR-92104-Y',
      telemetryFrequencySeconds: 15,
      profileCategory: 'RESPIRATORY',
      clinicalRiskNotes: 'Severe COPD & Hypoxemia Risk Protocol Tier 1',
      safetyThresholds: {
        hrMin: 55,
        hrMax: 115,
        bpSysMax: 145,
        bpDiaMax: 92,
        spo2Min: 90, // customized for COPD senior baseline
        tempMin: 35.5,
        tempMax: 38.0,
      },
      lastUpdated: new Date().toISOString(),
    });
  }

  getBinding(imei: string): SeniorDeviceBinding | undefined {
    return this.bindings.get(imei);
  }

  getOrCreateBinding(imei: string): SeniorDeviceBinding {
    let binding = this.bindings.get(imei);
    if (!binding) {
      binding = {
        imei,
        seniorRefId: `SNR-${imei.slice(-5)}-X`,
        telemetryFrequencySeconds: 20,
        profileCategory: 'GENERAL',
        clinicalRiskNotes: 'Standard Geriatric Baseline Monitoring',
        safetyThresholds: {
          hrMin: 55,
          hrMax: 105,
          bpSysMax: 140,
          bpDiaMax: 90,
          spo2Min: 93,
          tempMin: 35.5,
          tempMax: 37.8,
        },
        lastUpdated: new Date().toISOString(),
      };
      this.bindings.set(imei, binding);
    }
    return binding;
  }

  updateBinding(binding: SeniorDeviceBinding): SeniorDeviceBinding {
    binding.lastUpdated = new Date().toISOString();
    this.bindings.set(binding.imei, binding);
    return binding;
  }

  getAllBindings(): SeniorDeviceBinding[] {
    return Array.from(this.bindings.values());
  }
}
