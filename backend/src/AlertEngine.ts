import { SeniorDeviceBinding } from './SeniorBindingManager';

export interface ActionAudit {
  action: string;
  operator: string;
  timestamp: string;
  notes?: string;
}

export interface AlarmEvent {
  id: string;
  imei: string;
  seniorRefId: string;
  timestamp: string;
  type: 'HR_TACHYCARDIA' | 'HR_BRADYCARDIA' | 'HYPERTENSION' | 'HYPOXIA' | 'HYPOTHERMIA' | 'FEVER' | 'SOS_PANIC';
  severity: 'CRITICAL' | 'WARNING';
  vitalType: 'Heart Rate' | 'Blood Pressure' | 'Blood Oxygen' | 'Body Temp' | 'SOS';
  currentValue: string;
  thresholdRule: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  actionsTaken: ActionAudit[];
}

export interface TelemetrySnapshot {
  hr?: number;
  bp_sys?: number;
  bp_dia?: number;
  spo2?: number;
  temp?: number;
}

export class AlertEngine {
  private alarms: AlarmEvent[] = [];
  private lastAlertTime: Map<string, number> = new Map(); // key: `${imei}_${vitalType}`

  evaluateTelemetry(binding: SeniorDeviceBinding, data: TelemetrySnapshot): AlarmEvent[] {
    const triggered: AlarmEvent[] = [];
    const thresholds = binding.safetyThresholds;
    const now = Date.now();

    // Helper to evaluate and trigger
    const checkAndTrigger = (
      type: AlarmEvent['type'],
      severity: AlarmEvent['severity'],
      vitalType: AlarmEvent['vitalType'],
      currentValue: string,
      thresholdRule: string
    ) => {
      const key = `${binding.imei}_${vitalType}`;
      const lastTime = this.lastAlertTime.get(key) || 0;
      // Debounce: don't re-trigger within 30 seconds for the same vital if already active
      const existingActive = this.alarms.find(
        (a) => a.imei === binding.imei && a.vitalType === vitalType && a.status === 'ACTIVE'
      );

      if (existingActive) {
        existingActive.currentValue = currentValue;
        existingActive.timestamp = new Date().toISOString();
        triggered.push(existingActive);
        return;
      }

      if (now - lastTime < 15000) {
        return; // suppress rapid re-firing
      }

      this.lastAlertTime.set(key, now);
      const alarm: AlarmEvent = {
        id: `ALM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        imei: binding.imei,
        seniorRefId: binding.seniorRefId,
        timestamp: new Date().toISOString(),
        type,
        severity,
        vitalType,
        currentValue,
        thresholdRule,
        status: 'ACTIVE',
        actionsTaken: [
          {
            action: 'Automated Threshold Evaluation Breach Detected',
            operator: 'System (Real-time Rule Engine)',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      this.alarms.unshift(alarm);
      triggered.push(alarm);
    };

    // 1. Heart Rate
    if (data.hr !== undefined && data.hr > 0) {
      if (data.hr > thresholds.hrMax) {
        checkAndTrigger(
          'HR_TACHYCARDIA',
          'CRITICAL',
          'Heart Rate',
          `${data.hr} bpm`,
          `Exceeds maximum safety limit (${thresholds.hrMax} bpm)`
        );
      } else if (data.hr < thresholds.hrMin) {
        checkAndTrigger(
          'HR_BRADYCARDIA',
          'CRITICAL',
          'Heart Rate',
          `${data.hr} bpm`,
          `Below minimum safety limit (${thresholds.hrMin} bpm)`
        );
      }
    }

    // 2. Blood Pressure
    if (data.bp_sys !== undefined && data.bp_dia !== undefined && data.bp_sys > 0) {
      if (data.bp_sys > thresholds.bpSysMax || data.bp_dia > thresholds.bpDiaMax) {
        checkAndTrigger(
          'HYPERTENSION',
          'CRITICAL',
          'Blood Pressure',
          `${data.bp_sys}/${data.bp_dia} mmHg`,
          `Exceeds configured safety limit (${thresholds.bpSysMax}/${thresholds.bpDiaMax} mmHg)`
        );
      }
    }

    // 3. Blood Oxygen (SpO2)
    if (data.spo2 !== undefined && data.spo2 > 0) {
      if (data.spo2 < thresholds.spo2Min) {
        checkAndTrigger(
          'HYPOXIA',
          'CRITICAL',
          'Blood Oxygen',
          `${data.spo2}%`,
          `Desaturation below clinical threshold (${thresholds.spo2Min}%)`
        );
      }
    }

    // 4. Body Temperature
    if (data.temp !== undefined && data.temp > 0) {
      if (data.temp > thresholds.tempMax) {
        checkAndTrigger(
          'FEVER',
          'WARNING',
          'Body Temp',
          `${data.temp} °C`,
          `Pyrexia above maximum threshold (${thresholds.tempMax} °C)`
        );
      } else if (data.temp < thresholds.tempMin) {
        checkAndTrigger(
          'HYPOTHERMIA',
          'WARNING',
          'Body Temp',
          `${data.temp} °C`,
          `Hypothermia risk below threshold (${thresholds.tempMin} °C)`
        );
      }
    }

    return triggered;
  }

  triggerSOS(binding: SeniorDeviceBinding, rawFrame: string): AlarmEvent {
    const alarm: AlarmEvent = {
      id: `ALM-SOS-${Date.now()}`,
      imei: binding.imei,
      seniorRefId: binding.seniorRefId,
      timestamp: new Date().toISOString(),
      type: 'SOS_PANIC',
      severity: 'CRITICAL',
      vitalType: 'SOS',
      currentValue: 'SOS Button Triggered',
      thresholdRule: 'Physical emergency panic button activated by senior',
      status: 'ACTIVE',
      actionsTaken: [
        {
          action: 'Physical SOS Packet IWAP10 Intercepted',
          operator: 'System (Emergency Gateway)',
          timestamp: new Date().toISOString(),
          notes: rawFrame,
        },
      ],
    };
    this.alarms.unshift(alarm);
    return alarm;
  }

  acknowledgeAlarm(alarmId: string, operator: string = 'Care Operator'): AlarmEvent | null {
    const alarm = this.alarms.find((a) => a.id === alarmId);
    if (alarm) {
      alarm.status = 'ACKNOWLEDGED';
      alarm.actionsTaken.push({
        action: 'Alert Acknowledged by Operator (Audible Alert Silenced)',
        operator,
        timestamp: new Date().toISOString(),
      });
      return alarm;
    }
    return null;
  }

  resolveAlarm(alarmId: string, actionNote: string, operator: string = 'Care Operator'): AlarmEvent | null {
    const alarm = this.alarms.find((a) => a.id === alarmId);
    if (alarm) {
      alarm.status = 'RESOLVED';
      alarm.actionsTaken.push({
        action: `Incident Resolved: ${actionNote}`,
        operator,
        timestamp: new Date().toISOString(),
      });
      return alarm;
    }
    return null;
  }

  recordIntervention(alarmId: string, actionDescription: string, operator: string = 'Care Operator'): AlarmEvent | null {
    const alarm = this.alarms.find((a) => a.id === alarmId);
    if (alarm) {
      alarm.actionsTaken.push({
        action: actionDescription,
        operator,
        timestamp: new Date().toISOString(),
      });
      return alarm;
    }
    return null;
  }

  getActiveAlarms(): AlarmEvent[] {
    return this.alarms.filter((a) => a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED');
  }

  getAllAlarms(): AlarmEvent[] {
    return this.alarms;
  }
}
