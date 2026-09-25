export type Language = 'fr' | 'en' | 'es' | 'ar';

export interface TranslationDict {
  // Top Header
  appTitle: string;
  appSubtitle: string;
  liveFeedActive: string;
  serverOffline: string;
  cndpCompliant: string;
  activeTerminal: string;
  mappedSeniorRef: string;
  tcpPortLabel: string;
  streamCadenceLabel: string;
  activeAlarmsLabel: string;
  intervalSuffix: string;
  activeSuffix: string;
  activeSocketsLabel: string;

  // Fleet Carousel & Filter Bar
  fleetTitle: string;
  totalCountBadge: string;
  onlineBadge: string;
  inAlertBadge: string;
  searchFleetPlaceholder: string;
  allFilter: string;
  cardioFilter: string;
  respFilter: string;
  generalFilter: string;
  sortAlertsFirst: string;
  sortOnlineFirst: string;
  sortName: string;
  sortRoom: string;
  browseFleetButton: string;
  standbyBadge: string;
  noResidentsMatch: string;
  resetFiltersBtn: string;

  // Tabs
  tabTelemetry: string;
  tabAlarms: string;
  tabCommands: string;
  tabLocation: string;

  // Patient Banner
  pinnedSeniorLabel: string;
  roomPrefix: string;
  stationIntercom: string;
  caregiverMobile: string;
  configuredCadenceLabel: string;
  ingestionSuffix: string;
  configureThresholdsBtn: string;

  // Vitals Cards
  cardHeartRate: string;
  cardBloodPressure: string;
  cardBloodOxygen: string;
  cardBodyTemp: string;
  cardStepCount: string;
  cardBattery: string;
  safePrefix: string;
  limitPrefix: string;
  statusInTarget: string;
  statusOptimal: string;
  statusHealthy: string;
  statusNormal: string;
  statusWarning: string;
  statusCritical: string;
  rollsLabel: string;
  goalLabel: string;
  gsmLabel: string;
  satsLabel: string;

  // Operator Controls
  operatorControlsTitle: string;
  operatorControlsSubtitle: string;
  pollVitalsBtn: string;
  locateGpsBtn: string;
  fullCommandCenterBtn: string;

  // Sniffer / Packet Viewer
  rawSnifferTitle: string;
  rawSnifferSubtitle: string;
  packetCountSuffix: string;
  noPacketsMatch: string;
  packetDissectorTitle: string;
  packetDissectorHint: string;
  dissectedPayload: string;
  frameType: string;
  checksumStatus: string;
  validChecksum: string;
  invalidChecksum: string;

  // Alarms Tab
  alarmsHeaderTitle: string;
  alarmsHeaderSubtitle: string;
  filterAllAlarms: string;
  filterCritical: string;
  filterWarning: string;
  colTimestamp: string;
  colSeniorId: string;
  colAlarmType: string;
  colSeverity: string;
  colTriggerVal: string;
  colStatus: string;
  colActions: string;
  btnAcknowledge: string;
  btnResolve: string;
  statusAck: string;
  statusResolved: string;
  statusActive: string;
  emergencySosAlarm: string;
  noAlarmsLogged: string;

  // Commands Tab
  commandsHeaderTitle: string;
  commandsHeaderSubtitle: string;
  cmdBpReading: string;
  cmdBpReadingDesc: string;
  cmdGpsPosition: string;
  cmdGpsPositionDesc: string;
  cmdVoiceCall: string;
  cmdVoiceCallDesc: string;
  cmdCustomHex: string;
  cmdCustomHexDesc: string;
  btnSendPayload: string;
  commandSentSuccess: string;

  // Location Tab
  locationHeaderTitle: string;
  locationHeaderSubtitle: string;
  lastKnownGps: string;
  latitude: string;
  longitude: string;
  accuracy: string;
  addressLookup: string;
  geofenceRadius: string;
  geofenceStatus: string;
  geofenceInside: string;

  // Thresholds Modal / Drawer
  thresholdsModalTitle: string;
  thresholdsModalSubtitle: string;
  thHrHigh: string;
  thHrLow: string;
  thBpSys: string;
  thBpDia: string;
  thSpo2Low: string;
  thTempHigh: string;
  thCadence: string;
  btnSaveThresholds: string;
  btnResetThresholds: string;
  thresholdSavedNotice: string;

  // Fleet Matrix Drawer
  fleetDrawerTitle: string;
  fleetDrawerSubtitle: string;
  viewGrid: string;
  viewTable: string;
  tblColResident: string;
  tblColDeviceImei: string;
  tblColCategory: string;
  tblColRoom: string;
  tblColVitals: string;
  tblColAction: string;
  btnSelectPatient: string;
  btnCurrentlyMonitored: string;
  footerProtocolNotice: string;
  footerPiiNotice: string;
}

export const translations: Record<Language, TranslationDict> = {
  fr: {
    appTitle: "RMA-HealthCare Console Médicale",
    appSubtitle: "Supervision Télémétrique & Télémédecine Multi-Patients en Temps Réel",
    liveFeedActive: "Télémétrie Active (Connecté)",
    serverOffline: "Serveur Déconnecté (En attente)",
    cndpCompliant: "Conforme CNDP : Pseudonymisé",
    activeTerminal: "Terminal Actif",
    mappedSeniorRef: "Réf. Résident Associé",
    tcpPortLabel: "PORT PROTOCOLE TCP",
    streamCadenceLabel: "CADENCE DU FLUX",
    activeAlarmsLabel: "ALARMES ACTIVES",
    intervalSuffix: "Intervalle",
    activeSuffix: "Actives",
    activeSocketsLabel: "Connexion(s) Active(s)",

    fleetTitle: "GESTION DE LA FLOTTE DES PATIENTS",
    totalCountBadge: "Total",
    onlineBadge: "En Ligne",
    inAlertBadge: "En Alerte",
    searchFleetPlaceholder: "Rechercher patient, chambre, profil...",
    allFilter: "Tous",
    cardioFilter: "Cardio",
    respFilter: "Respiratoire",
    generalFilter: "Général",
    sortAlertsFirst: "Trier : Alertes d'abord",
    sortOnlineFirst: "Trier : En ligne d'abord",
    sortName: "Trier : Nom (A-Z)",
    sortRoom: "Trier : N° Chambre",
    browseFleetButton: "Flotte des Patients",
    standbyBadge: "VEILLE",
    noResidentsMatch: "Aucun résident ne correspond aux critères sélectionnés.",
    resetFiltersBtn: "Réinitialiser les filtres",

    tabTelemetry: "Télémétrie Directe",
    tabAlarms: "Historique des Alarmes & Audit Clinique",
    tabCommands: "Centre de Commandes (Commandes BP)",
    tabLocation: "Localisation & Suivi GPS/LBS",

    pinnedSeniorLabel: "RÉFÉRENCE RÉSIDENT SÉLECTIONNÉ :",
    roomPrefix: "Chambre",
    stationIntercom: "Interphone Station",
    caregiverMobile: "Mobile Soignant",
    configuredCadenceLabel: "CADENCE CONFIGURÉE",
    ingestionSuffix: "Ingestion",
    configureThresholdsBtn: "Configurer Seuils & Cadence",

    cardHeartRate: "FRÉQUENCE CARDIAQUE",
    cardBloodPressure: "PRESSION ARTÉRIELLE",
    cardBloodOxygen: "OXYGÉNATION (SPO2)",
    cardBodyTemp: "TEMPÉRATURE CORPORELLE",
    cardStepCount: "NOMBRE DE PAS",
    cardBattery: "NIVEAU BATTERIE",
    safePrefix: "Normal :",
    limitPrefix: "Limite :",
    statusInTarget: "Dans la Cible",
    statusOptimal: "Optimale",
    statusHealthy: "Sain",
    statusNormal: "Normale",
    statusWarning: "Avertissement",
    statusCritical: "CRITIQUE",
    rollsLabel: "Mouv. :",
    goalLabel: "Objectif :",
    gsmLabel: "Signal GSM :",
    satsLabel: "Satellites :",

    operatorControlsTitle: "Commandes Opérateur en Direct",
    operatorControlsSubtitle: "Interrogation directe de la télémétrie et commandes de localisation d'urgence",
    pollVitalsBtn: "Interroger Signes Vitaux (BPXL)",
    locateGpsBtn: "Localiser GPS (BP16)",
    fullCommandCenterBtn: "Centre de Commandes Complet",

    rawSnifferTitle: "Moniteur de Trames TCP Brutes",
    rawSnifferSubtitle: "Encapsulation protocolaire port 5088 en direct (IW...#)",
    packetCountSuffix: "Paquets",
    noPacketsMatch: "Aucune trame reçue pour le filtre actuel.",
    packetDissectorTitle: "Dissecteur de Paquets",
    packetDissectorHint: "Sélectionnez une trame dans le tableau pour analyser sa structure binaire décodée.",
    dissectedPayload: "Charge Utile Décodée",
    frameType: "Type de Trame",
    checksumStatus: "Statut Checksum",
    validChecksum: "Checksum Valide",
    invalidChecksum: "Erreur Checksum",

    alarmsHeaderTitle: "Historique & Traitement des Alarmes",
    alarmsHeaderSubtitle: "Audit des alertes biométriques, dépassements de seuils et événements SOS",
    filterAllAlarms: "Toutes les alarmes",
    filterCritical: "Critiques uniquement",
    filterWarning: "Avertissements",
    colTimestamp: "Horodatage",
    colSeniorId: "Réf. Résident",
    colAlarmType: "Type d'Alerte",
    colSeverity: "Sévérité",
    colTriggerVal: "Valeur Déclenchée",
    colStatus: "Statut",
    colActions: "Actions Soignant",
    btnAcknowledge: "Acquitter",
    btnResolve: "Résoudre",
    statusAck: "Acquittée",
    statusResolved: "Résolue",
    statusActive: "ACTIVE",
    emergencySosAlarm: "BOUTON SOS PANIQUE PRESSÉ",
    noAlarmsLogged: "Aucune alarme enregistrée à ce jour.",

    commandsHeaderTitle: "Centre de Commandes Télémétriques",
    commandsHeaderSubtitle: "Envoi d'instructions distantes aux montres connectées des patients",
    cmdBpReading: "Déclencher Mesure Biométrique Immédiate (BPXL)",
    cmdBpReadingDesc: "Force la montre à mesurer immédiatement le rythme cardiaque, la tension et la SpO2.",
    cmdGpsPosition: "Demande de Positionnement GPS Urgent (BP16)",
    cmdGpsPositionDesc: "Active le module GPS haute précision pour transmettre les coordonnées actuelles.",
    cmdVoiceCall: "Appel Vocal d'Urgence (BP22)",
    cmdVoiceCallDesc: "Initie un appel bidirectionnel vers l'interphone soignant.",
    cmdCustomHex: "Commande Hexadécimale Personnalisée",
    cmdCustomHexDesc: "Envoi direct de payload de bas niveau au protocole de la montre.",
    btnSendPayload: "Transmettre l'Instruction",
    commandSentSuccess: "Instruction transmise avec succès au socket de la montre !",

    locationHeaderTitle: "Suivi Géographique & Balisage",
    locationHeaderSubtitle: "Coordonnées satellite en temps réel et zone de sécurité géolocalisée",
    lastKnownGps: "Dernière Position GPS Reçue",
    latitude: "Latitude",
    longitude: "Longitude",
    accuracy: "Précision",
    addressLookup: "Localisation Estimée",
    geofenceRadius: "Rayon de Sécurité (Geofence)",
    geofenceStatus: "Statut Périmètre",
    geofenceInside: "À l'intérieur du périmètre sécurisé",

    thresholdsModalTitle: "Configuration des Seuils d'Alerte Médicaux",
    thresholdsModalSubtitle: "Définition des limites cliniques pour la surveillance automatisée",
    thHrHigh: "Plafond Fréquence Cardiaque (BPM Max)",
    thHrLow: "Plancher Fréquence Cardiaque (BPM Min)",
    thBpSys: "Tension Systolique Max (mmHg)",
    thBpDia: "Tension Diastolique Max (mmHg)",
    thSpo2Low: "Seuil Critique SpO2 (Min %)",
    thTempHigh: "Seuil Hyperthermie (Max °C)",
    thCadence: "Cadence de Transmission (Secondes)",
    btnSaveThresholds: "Enregistrer les Paramètres",
    btnResetThresholds: "Valeurs Médicales par Défaut",
    thresholdSavedNotice: "Seuils mis à jour et synchronisés avec le serveur !",

    fleetDrawerTitle: "Annuaire Complet de la Flotte des Résidents",
    fleetDrawerSubtitle: "Vue d'ensemble matricielle de tous les patients appareillés",
    viewGrid: "Grille Cartes",
    viewTable: "Tableau Détaillé",
    tblColResident: "Patient / Résident",
    tblColDeviceImei: "IMEI & Connexion",
    tblColCategory: "Profil Médical",
    tblColRoom: "Emplacement",
    tblColVitals: "Signes Vitaux Clés",
    tblColAction: "Action",
    btnSelectPatient: "Superviser ce Patient",
    btnCurrentlyMonitored: "Actuellement Supervisé",
    footerProtocolNotice: "Protocole Smartwatch GPS & Santé V1.1 • Passerelle Télémétrique Conforme CNDP",
    footerPiiNotice: "Zéro Donnée Personnelle Non-Anonymisée • Port Interne TCP 5088 • Port WebSocket 3001",
  },

  en: {
    appTitle: "RMA-HealthCare Clinical Console",
    appSubtitle: "Multi-Patient Real-Time Biometric Telemetry & Telemedicine",
    liveFeedActive: "Telemetry Active (Connected)",
    serverOffline: "Server Offline (Awaiting Login)",
    cndpCompliant: "CNDP Compliant: Pseudonymized",
    activeTerminal: "Active Terminal",
    mappedSeniorRef: "Mapped Senior Ref",
    tcpPortLabel: "TCP PROTOCOL PORT",
    streamCadenceLabel: "STREAM CADENCE",
    activeAlarmsLabel: "ACTIVE ALARMS",
    intervalSuffix: "Interval",
    activeSuffix: "Active",
    activeSocketsLabel: "Active Socket(s)",

    fleetTitle: "MONITORED SENIORS FLEET MANAGEMENT",
    totalCountBadge: "Total",
    onlineBadge: "Online",
    inAlertBadge: "In Alert",
    searchFleetPlaceholder: "Search patient, room, care tier, or IMEI...",
    allFilter: "All",
    cardioFilter: "Cardio",
    respFilter: "Respiratory",
    generalFilter: "General",
    sortAlertsFirst: "Sort: Alerts First",
    sortOnlineFirst: "Sort: Online First",
    sortName: "Sort: Name (A-Z)",
    sortRoom: "Sort: Room Number",
    browseFleetButton: "Browse Fleet",
    standbyBadge: "STANDBY",
    noResidentsMatch: "No residents match the selected filters.",
    resetFiltersBtn: "Reset Filters",

    tabTelemetry: "Live Telemetry & Clinical Vitals",
    tabAlarms: "Alarm History & Clinical Audit",
    tabCommands: "Command Center (BP Commands)",
    tabLocation: "GPS & LBS Location Tracking",

    pinnedSeniorLabel: "PINNED SENIOR REF ID:",
    roomPrefix: "Room",
    stationIntercom: "Station Intercom",
    caregiverMobile: "Caregiver Mobile",
    configuredCadenceLabel: "CONFIGURED CADENCE",
    ingestionSuffix: "Ingestion",
    configureThresholdsBtn: "Configure Safety Thresholds & Cadence",

    cardHeartRate: "HEART RATE",
    cardBloodPressure: "BLOOD PRESSURE",
    cardBloodOxygen: "BLOOD OXYGEN (SPO2)",
    cardBodyTemp: "BODY TEMPERATURE",
    cardStepCount: "STEP COUNT",
    cardBattery: "BATTERY LEVEL",
    safePrefix: "Safe:",
    limitPrefix: "Limit:",
    statusInTarget: "In Target",
    statusOptimal: "Optimal",
    statusHealthy: "Healthy",
    statusNormal: "Normal",
    statusWarning: "Warning",
    statusCritical: "CRITICAL",
    rollsLabel: "Rolls:",
    goalLabel: "Goal:",
    gsmLabel: "GSM Signal:",
    satsLabel: "Satellites:",

    operatorControlsTitle: "Live Operator Telemetry Controls",
    operatorControlsSubtitle: "Direct telemetry polling and emergency positioning commands",
    pollVitalsBtn: "Poll Health Reading (BPXL)",
    locateGpsBtn: "Locate GPS (BP16)",
    fullCommandCenterBtn: "Full Command Center",

    rawSnifferTitle: "Raw TCP Stream Sniffer",
    rawSnifferSubtitle: "Live TCP port 5088 protocol framing (IW...#)",
    packetCountSuffix: "Packets",
    noPacketsMatch: "No packets match current filter.",
    packetDissectorTitle: "Packet Dissector",
    packetDissectorHint: "Select any packet from the table to inspect its decoded frame structure.",
    dissectedPayload: "Decoded Payload",
    frameType: "Frame Type",
    checksumStatus: "Checksum Status",
    validChecksum: "Valid Checksum",
    invalidChecksum: "Invalid Checksum",

    alarmsHeaderTitle: "Alarm History & Dispatch",
    alarmsHeaderSubtitle: "Audit log of biometric alerts, threshold breaches, and fall incidents",
    filterAllAlarms: "All Alarms",
    filterCritical: "Critical Only",
    filterWarning: "Warnings",
    colTimestamp: "Timestamp",
    colSeniorId: "Senior Ref",
    colAlarmType: "Alarm Type",
    colSeverity: "Severity",
    colTriggerVal: "Trigger Value",
    colStatus: "Status",
    colActions: "Caregiver Actions",
    btnAcknowledge: "Acknowledge",
    btnResolve: "Resolve",
    statusAck: "Acknowledged",
    statusResolved: "Resolved",
    statusActive: "ACTIVE",
    emergencySosAlarm: "SOS PANIC BUTTON PRESSED",
    noAlarmsLogged: "No alarm records logged.",

    commandsHeaderTitle: "Telemetry Command Center",
    commandsHeaderSubtitle: "Send remote instructions to senior smartwatches",
    cmdBpReading: "Trigger Instant Biometric Measurement (BPXL)",
    cmdBpReadingDesc: "Instructs the watch to take an immediate heart rate, BP and SpO2 reading.",
    cmdGpsPosition: "Request High-Precision GPS Fix (BP16)",
    cmdGpsPositionDesc: "Wakes the GPS chip to transmit current satellite coordinates.",
    cmdVoiceCall: "Emergency Voice Channel (BP22)",
    cmdVoiceCallDesc: "Opens direct audio channel to caregiver intercom.",
    cmdCustomHex: "Custom Hex Command Payload",
    cmdCustomHexDesc: "Send raw command bytes directly to watch firmware socket.",
    btnSendPayload: "Transmit Instruction",
    commandSentSuccess: "Command successfully dispatched to watch socket!",

    locationHeaderTitle: "Location & Geofencing",
    locationHeaderSubtitle: "Real-time satellite coordinates and safety boundary audit",
    lastKnownGps: "Last Known GPS Fix",
    latitude: "Latitude",
    longitude: "Longitude",
    accuracy: "Accuracy",
    addressLookup: "Estimated Address",
    geofenceRadius: "Safety Geofence Radius",
    geofenceStatus: "Geofence Status",
    geofenceInside: "Inside safe resident zone",

    thresholdsModalTitle: "Safety Threshold Settings",
    thresholdsModalSubtitle: "Configure trigger limits for automated vital warnings and alarms",
    thHrHigh: "Tachycardia Limit (Max BPM)",
    thHrLow: "Bradycardia Limit (Min BPM)",
    thBpSys: "Systolic Limit Max (mmHg)",
    thBpDia: "Diastolic Limit Max (mmHg)",
    thSpo2Low: "Hypoxia Limit (Min SpO2 %)",
    thTempHigh: "Fever Limit (Max Temp °C)",
    thCadence: "Streaming Cadence (Seconds)",
    btnSaveThresholds: "Save Thresholds",
    btnResetThresholds: "Reset to Clinical Defaults",
    thresholdSavedNotice: "Thresholds successfully saved and synced to gateway!",

    fleetDrawerTitle: "Enterprise Seniors Fleet Directory",
    fleetDrawerSubtitle: "Complete directory matrix with card grid and table views",
    viewGrid: "Card Grid",
    viewTable: "Data Table",
    tblColResident: "Patient / Resident",
    tblColDeviceImei: "IMEI & Connection",
    tblColCategory: "Clinical Profile",
    tblColRoom: "Location",
    tblColVitals: "Key Vitals",
    tblColAction: "Action",
    btnSelectPatient: "Select for Telemetry & Action",
    btnCurrentlyMonitored: "Currently Monitored",
    footerProtocolNotice: "GPS & Health Smartwatch Protocol V1.1 • CNDP Compliant Real-time Telemetry Gateway",
    footerPiiNotice: "Zero PII Stored • Internal Port 5088 • WS Port 3001",
  },

  es: {
    appTitle: "Consola Médica RMA-HealthCare",
    appSubtitle: "Telemetría Biomédica Multi-Paciente en Tiempo Real",
    liveFeedActive: "Telemetría Activa (Conectado)",
    serverOffline: "Servidor Desconectado",
    cndpCompliant: "Conforme CNDP: Anonimizado",
    activeTerminal: "Terminal Activo",
    mappedSeniorRef: "Ref. Paciente Asociado",
    tcpPortLabel: "PUERTO PROTOCOLO TCP",
    streamCadenceLabel: "FRECUENCIA DE TRANSMISIÓN",
    activeAlarmsLabel: "ALARMAS ACTIVAS",
    intervalSuffix: "Intervalo",
    activeSuffix: "Activas",
    activeSocketsLabel: "Conexión(es) Activa(s)",

    fleetTitle: "GESTIÓN DE LA FLOTA DE PACIENTES",
    totalCountBadge: "Total",
    onlineBadge: "En Línea",
    inAlertBadge: "En Alerta",
    searchFleetPlaceholder: "Buscar paciente, habitación, perfil...",
    allFilter: "Todos",
    cardioFilter: "Cardio",
    respFilter: "Respiratorio",
    generalFilter: "General",
    sortAlertsFirst: "Ordenar: Alertas primero",
    sortOnlineFirst: "Ordenar: En línea primero",
    sortName: "Ordenar: Nombre (A-Z)",
    sortRoom: "Ordenar: Habitación",
    browseFleetButton: "Flota de Pacientes",
    standbyBadge: "EN ESPERA",
    noResidentsMatch: "No se encontraron pacientes con los filtros seleccionados.",
    resetFiltersBtn: "Restablecer Filtros",

    tabTelemetry: "Telemetría en Vivo & Signos Vitales",
    tabAlarms: "Historial de Alarmas & Auditoría",
    tabCommands: "Centro de Comandos (Comandos BP)",
    tabLocation: "Localización & Rastreo GPS/LBS",

    pinnedSeniorLabel: "REF. PACIENTE SELECCIONADO:",
    roomPrefix: "Habitación",
    stationIntercom: "Interfono",
    caregiverMobile: "Móvil Cuidador",
    configuredCadenceLabel: "CADENCIA CONFIGURADA",
    ingestionSuffix: "Ingestión",
    configureThresholdsBtn: "Configurar Límites & Frecuencia",

    cardHeartRate: "FRECUENCIA CARDÍACA",
    cardBloodPressure: "PRESIÓN ARTERIAL",
    cardBloodOxygen: "OXIGENACIÓN (SPO2)",
    cardBodyTemp: "TEMPERATURA CORPORAL",
    cardStepCount: "PASOS",
    cardBattery: "BATERÍA",
    safePrefix: "Normal:",
    limitPrefix: "Límite:",
    statusInTarget: "En Rango",
    statusOptimal: "Óptima",
    statusHealthy: "Saludable",
    statusNormal: "Normal",
    statusWarning: "Aviso",
    statusCritical: "CRÍTICO",
    rollsLabel: "Mov.:",
    goalLabel: "Objetivo:",
    gsmLabel: "Señal GSM:",
    satsLabel: "Satélites:",

    operatorControlsTitle: "Controles de Operador en Vivo",
    operatorControlsSubtitle: "Comandos inmediatos de lectura biométrica y posicionamiento GPS",
    pollVitalsBtn: "Leer Signos Vitales (BPXL)",
    locateGpsBtn: "Localizar GPS (BP16)",
    fullCommandCenterBtn: "Centro de Comandos Completo",

    rawSnifferTitle: "Monitor de Paquetes TCP",
    rawSnifferSubtitle: "Estructura de tramas en vivo por puerto 5088 (IW...#)",
    packetCountSuffix: "Paquetes",
    noPacketsMatch: "No hay paquetes que coincidan con el filtro.",
    packetDissectorTitle: "Disector de Paquetes",
    packetDissectorHint: "Seleccione un paquete para examinar su trama binaria decodificada.",
    dissectedPayload: "Carga Decodificada",
    frameType: "Tipo de Trama",
    checksumStatus: "Estado del Checksum",
    validChecksum: "Checksum Válido",
    invalidChecksum: "Error de Checksum",

    alarmsHeaderTitle: "Registro de Alarmas",
    alarmsHeaderSubtitle: "Auditoría de emergencias e incidencias",
    filterAllAlarms: "Todas las Alarmas",
    filterCritical: "Solo Críticas",
    filterWarning: "Avisos",
    colTimestamp: "Hora",
    colSeniorId: "Ref. Paciente",
    colAlarmType: "Tipo de Alarma",
    colSeverity: "Severidad",
    colTriggerVal: "Valor Registrado",
    colStatus: "Estado",
    colActions: "Acciones",
    btnAcknowledge: "Reconocer",
    btnResolve: "Resolver",
    statusAck: "Reconocida",
    statusResolved: "Resuelta",
    statusActive: "ACTIVA",
    emergencySosAlarm: "BOTÓN SOS DE PÁNICO ACTIVADO",
    noAlarmsLogged: "No hay alarmas registradas.",

    commandsHeaderTitle: "Centro de Comandos",
    commandsHeaderSubtitle: "Envío de instrucciones remotas a los relojes de pacientes",
    cmdBpReading: "Iniciar Medición Inmediata (BPXL)",
    cmdBpReadingDesc: "Solicita lectura inmediata de ritmo cardíaco, presión arterial y SpO2.",
    cmdGpsPosition: "Solicitar Ubicación GPS Precisa (BP16)",
    cmdGpsPositionDesc: "Activa el receptor GPS satelital.",
    cmdVoiceCall: "Llamada de Emergencia (BP22)",
    cmdVoiceCallDesc: "Abre canal de audio bidireccional.",
    cmdCustomHex: "Comando Hex Personalizado",
    cmdCustomHexDesc: "Envío directo de bytes al socket del dispositivo.",
    btnSendPayload: "Transmitir Comando",
    commandSentSuccess: "¡Comando enviado exitosamente al dispositivo!",

    locationHeaderTitle: "Ubicación & Geocercas",
    locationHeaderSubtitle: "Coordenadas satelitales en tiempo real y perímetro de seguridad",
    lastKnownGps: "Última Posición GPS",
    latitude: "Latitud",
    longitude: "Longitud",
    accuracy: "Precisión",
    addressLookup: "Dirección Estimada",
    geofenceRadius: "Radio de Seguridad",
    geofenceStatus: "Estado del Perímetro",
    geofenceInside: "Dentro de la zona segura",

    thresholdsModalTitle: "Configuración de Límites de Seguridad",
    thresholdsModalSubtitle: "Ajuste de umbrales automáticos para detección clínica",
    thHrHigh: "Taquicardia Máx (LPM)",
    thHrLow: "Bradicardia Mín (LPM)",
    thBpSys: "Sistólica Máx (mmHg)",
    thBpDia: "Diastólica Máx (mmHg)",
    thSpo2Low: "Hipoxia Mín (% SpO2)",
    thTempHigh: "Fiebre Máx (Temp °C)",
    thCadence: "Frecuencia de Envío (Segundos)",
    btnSaveThresholds: "Guardar Cambios",
    btnResetThresholds: "Valores por Defecto",
    thresholdSavedNotice: "¡Límites guardados y sincronizados!",

    fleetDrawerTitle: "Directorio de la Flota de Pacientes",
    fleetDrawerSubtitle: "Matriz completa de pacientes monitorizados",
    viewGrid: "Vista Cuadrícula",
    viewTable: "Vista Tabla",
    tblColResident: "Paciente / Residente",
    tblColDeviceImei: "IMEI & Conexión",
    tblColCategory: "Perfil Médico",
    tblColRoom: "Habitación",
    tblColVitals: "Signos Vitales",
    tblColAction: "Acción",
    btnSelectPatient: "Supervisar este Paciente",
    btnCurrentlyMonitored: "Actualmente Supervisado",
    footerProtocolNotice: "Protocolo Smartwatch GPS & Salud V1.1 • Pasarela Conforme CNDP",
    footerPiiNotice: "Cero Datos Personales • Puerto TCP 5088 • Puerto WS 3001",
  },

  ar: {
    appTitle: "لوحة التحكم الطبية RMA-HealthCare",
    appSubtitle: "مراقبة القياسات الحيوية والتطبيب عن بعد لعدة مرضى في الوقت الفعلي",
    liveFeedActive: "المراقبة الحية نشطة (متصل)",
    serverOffline: "الخادم غير متصل (بانتظار التسجيل)",
    cndpCompliant: "مطابق لمعايير CNDP : مجهول الهوية",
    activeTerminal: "الجهاز النشط",
    mappedSeniorRef: "معرف المريض المقترن",
    tcpPortLabel: "منفذ بروتوكول TCP",
    streamCadenceLabel: "معدل تدفق البيانات",
    activeAlarmsLabel: "الإنذارات النشطة",
    intervalSuffix: "فاصل زمني",
    activeSuffix: "نشط",
    activeSocketsLabel: "الاتصال(ات) النشطة",

    fleetTitle: "إدارة أسطول المرضى الخاضعين للمراقبة",
    totalCountBadge: "الإجمالي",
    onlineBadge: "متصل",
    inAlertBadge: "في حالة إنذار",
    searchFleetPlaceholder: "البحث عن مريض، غرفة، ملف طبي...",
    allFilter: "الكل",
    cardioFilter: "قلب وأوعية",
    respFilter: "تنفسي",
    generalFilter: "عام",
    sortAlertsFirst: "ترتيب: الإنذارات أولاً",
    sortOnlineFirst: "ترتيب: المتصل أولاً",
    sortName: "ترتيب: الاسم (أ-ي)",
    sortRoom: "ترتيب: رقم الغرفة",
    browseFleetButton: "تصفح أسطول المرضى",
    standbyBadge: "في الانتظار",
    noResidentsMatch: "لا يوجد مرضى يطابقون خيارات البحث.",
    resetFiltersBtn: "إعادة ضبط التصفية",

    tabTelemetry: "القياسات الحية والمؤشرات الحيوية",
    tabAlarms: "سجل الإنذارات والتدقيق الطبي",
    tabCommands: "مركز الأوامر (أوامر BP)",
    tabLocation: "تتبع الموقع عبر GPS/LBS",

    pinnedSeniorLabel: "معرف المريض المحدد:",
    roomPrefix: "الغرفة",
    stationIntercom: "اتصال داخلي",
    caregiverMobile: "هاتف مقدم الرعاية",
    configuredCadenceLabel: "معدل التدفق المحدد",
    ingestionSuffix: "استقبال",
    configureThresholdsBtn: "ضبط حدود الأمان والمعدل",

    cardHeartRate: "نبضات القلب",
    cardBloodPressure: "ضغط الدم",
    cardBloodOxygen: "تشبع الأكسجين (SPO2)",
    cardBodyTemp: "حرارة الجسم",
    cardStepCount: "عدد الخطوات",
    cardBattery: "مستوى البطارية",
    safePrefix: "آمن:",
    limitPrefix: "الحد:",
    statusInTarget: "في النطاق المستهدف",
    statusOptimal: "مثالي",
    statusHealthy: "سليم",
    statusNormal: "طبيعي",
    statusWarning: "تحذير",
    statusCritical: "حرج جداً",
    rollsLabel: "حركات:",
    goalLabel: "الهدف:",
    gsmLabel: "إشارة GSM:",
    satsLabel: "الأقمار الصناعية:",

    operatorControlsTitle: "أوامر المشغل المباشرة",
    operatorControlsSubtitle: "طلب القياسات الفورية وأوامر تحديد الموقع الطارئ",
    pollVitalsBtn: "طلب فحص المؤشرات الحيوية (BPXL)",
    locateGpsBtn: "تحديد موقع GPS (BP16)",
    fullCommandCenterBtn: "مركز الأوامر الكامل",

    rawSnifferTitle: "محلل حزم بيانات TCP المباشرة",
    rawSnifferSubtitle: "تتبع وتفكيك حزم المنفذ 5088 المباشرة (IW...#)",
    packetCountSuffix: "حزم",
    noPacketsMatch: "لا توجد حزم تطابق التصفية الحالية.",
    packetDissectorTitle: "محلل الحزم التفصيلي",
    packetDissectorHint: "اختر أي حزمة من الجدول لتفحص بنيتها المفككة.",
    dissectedPayload: "البيانات المفككة",
    frameType: "نوع الحزمة",
    checksumStatus: "حالة المجموع الاختباري",
    validChecksum: "مجموع اختباري سليم",
    invalidChecksum: "خطأ في المجموع الاختباري",

    alarmsHeaderTitle: "سجل وتدقيق الإنذارات",
    alarmsHeaderSubtitle: "تتبع التنبيهات الحيوية وتجاوز الحدود وحالات الطوارئ",
    filterAllAlarms: "جميع الإنذارات",
    filterCritical: "الحرجة فقط",
    filterWarning: "التحذيرات",
    colTimestamp: "الوقت",
    colSeniorId: "معرف المريض",
    colAlarmType: "نوع الإنذار",
    colSeverity: "مستوى الخطورة",
    colTriggerVal: "القيمة المسجلة",
    colStatus: "الحالة",
    colActions: "إجراءات مقدم الرعاية",
    btnAcknowledge: "تأكيد الاطلاع",
    btnResolve: "معالجة",
    statusAck: "تم الاطلاع",
    statusResolved: "معالج",
    statusActive: "نشط",
    emergencySosAlarm: "تم الضغط على زر الاستغاثة SOS",
    noAlarmsLogged: "لا توجد إنذارات مسجلة.",

    commandsHeaderTitle: "مركز الأوامر التلمترية",
    commandsHeaderSubtitle: "إرسال التعليمات عن بُعد إلى الساعات الذكية للمرضى",
    cmdBpReading: "إطلاق قياس حيوي فوري (BPXL)",
    cmdBpReadingDesc: "يوجه الساعة لقياس النبض والضغط والأكسجين فوراً.",
    cmdGpsPosition: "طلب إحداثيات GPS الدقيقة (BP16)",
    cmdGpsPositionDesc: "يقوم بتنشيط وحدة GPS وإرسال الموقع.",
    cmdVoiceCall: "مكالمة صوتية طارئة (BP22)",
    cmdVoiceCallDesc: "فتح قناة اتصال صوتية مباشرة مع مقدم الرعاية.",
    cmdCustomHex: "أمر سداسي عشري مخصص",
    cmdCustomHexDesc: "إرسال بايتات مخصصة إلى مأخذ الساعة مباشرة.",
    btnSendPayload: "إرسال التعليمات",
    commandSentSuccess: "تم إرسال الأمر بنجاح إلى الساعة !",

    locationHeaderTitle: "الموقع الجغرافي والسياج الأمني",
    locationHeaderSubtitle: "إحداثيات الأقمار الصناعية المباشرة ومراقبة النطاق الآمن",
    lastKnownGps: "آخر موقع GPS معروف",
    latitude: "خط العرض",
    longitude: "خط الطول",
    accuracy: "الدقة",
    addressLookup: "العنوان المقدر",
    geofenceRadius: "نصف قطر النطاق الآمن",
    geofenceStatus: "حالة السياج الأمني",
    geofenceInside: "داخل النطاق الآمن",

    thresholdsModalTitle: "إعدادات حدود الأمان الطبية",
    thresholdsModalSubtitle: "تحديد الحدود القصوى والدنيا للمراقبة الآلية",
    thHrHigh: "الحد الأقصى للنبض (BPM)",
    thHrLow: "الحد الأدنى للنبض (BPM)",
    thBpSys: "الضغط الانقباضي الأقصى (mmHg)",
    thBpDia: "الضغط الانبساطي الأقصى (mmHg)",
    thSpo2Low: "الحد الأدنى للأكسجين (% SpO2)",
    thTempHigh: "الحد الأقصى للحرارة (°C)",
    thCadence: "معدل البث التلقائي (بالثواني)",
    btnSaveThresholds: "حفظ الإعدادات",
    btnResetThresholds: "استعادة القيم الافتراضية",
    thresholdSavedNotice: "تم حفظ وتحديث حدود الأمان بنجاح !",

    fleetDrawerTitle: "دليل أسطول المرضى الكامل",
    fleetDrawerSubtitle: "جدول وشبكة عرض لجميع المرضى المجهزين بساعات",
    viewGrid: "عرض البطاقات",
    viewTable: "جدول تفصيلي",
    tblColResident: "المريض / المقيم",
    tblColDeviceImei: "معرف الساعة والاتصال",
    tblColCategory: "الملف الطبي",
    tblColRoom: "الموقع / الغرفة",
    tblColVitals: "المؤشرات الحيوية",
    tblColAction: "الإجراء",
    btnSelectPatient: "مراقبة هذا المريض",
    btnCurrentlyMonitored: "تحت المراقبة حالياً",
    footerProtocolNotice: "بروتوكول الساعات الذكية V1.1 • بوابة قياسات متوافقة مع CNDP",
    footerPiiNotice: "عدم تخزين بيانات شخصية • منفذ TCP 5088 • منفذ WS 3001",
  }
};
