/** TypeScript models mirroring the TerraMind backend API (v1). */

// ---------------------------------------------------------------- auth
export interface User {
  id: number;
  email: string;
  full_name: string;
  is_demo: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in_days: number;
  user: User;
}

// ---------------------------------------------------------------- crops
export interface Crop {
  id: number;
  name: string;
  category: string;
  growth_days: number;
  base_yield_t_per_ha: number;
  optimal_moisture_min: number;
  optimal_moisture_max: number;
  optimal_temp_min: number;
  optimal_temp_max: number;
  peak_water_demand_mm: number;
}

// ---------------------------------------------------------------- farms
export interface Farm {
  id: number;
  name: string;
  location_name: string;
  latitude: number;
  longitude: number;
  is_primary: boolean;
  field_count: number;
  total_area_hectares: number;
  average_health: number | null;
  created_at: string;
}

/** Boundary ring in GeoJSON order: [lng, lat]. */
export type Ring = [number, number][];

export interface CropRef {
  id: number;
  name: string;
  category: string;
  growth_days: number;
  base_yield_t_per_ha: number;
}

export interface Field {
  id: number;
  farm_id: number;
  name: string;
  variety: string;
  crop: CropRef | null;
  planting_date: string | null;
  growth_stage: string;
  soil_type: string;
  soil_ph: number;
  area_hectares: number;
  latitude: number;
  longitude: number;
  boundary: Ring | null;
  health_score: number | null;
  health_status: string | null;
  created_at: string;
}

// ---------------------------------------------------------------- weather
export interface CurrentWeather {
  temperature: number;
  apparent_temperature: number;
  humidity: number;
  wind_speed: number;
  precipitation_mm: number;
  rain_probability: number;
  uv_index: number;
  weather_code: number;
  summary: string;
  is_day: boolean;
  observed_at: string;
  source: "open_meteo" | "simulated";
}

export interface ForecastHour {
  time: string;
  temperature: number;
  precipitation_mm: number;
  rain_probability: number;
  humidity: number;
}

export interface ForecastDay {
  date: string;
  temperature_max: number;
  temperature_min: number;
  precipitation_sum_mm: number;
  rain_probability_max: number;
  wind_speed_max: number;
  summary: string;
  weather_code: number;
}

export interface WeatherForecast {
  farm_id: number;
  latitude: number;
  longitude: number;
  current: CurrentWeather;
  hourly: ForecastHour[];
  daily: ForecastDay[];
  agriculture_notes: string[];
}

// ------------------------------------------------------- field conditions
export interface FieldConditions {
  soil_moisture: number;
  soil_temperature: number;
  air_temperature: number;
  humidity: number;
  disease_risk: number;
  water_stress: number;
  growth_stage: string;
  days_since_planting: number | null;
  water_demand_mm_per_day: number;
  source: string;
}

// ---------------------------------------------------------------- health
export interface HealthFactor {
  name: string;
  value: string;
  status: "good" | "fair" | "poor" | "critical";
  impact: number;
  note?: string;
}

export interface TrendPoint {
  recorded_at: string;
  health_score: number;
  soil_moisture: number;
  air_temperature: number;
  humidity: number;
}

export interface HealthAssessment {
  field_id: number;
  field_name: string;
  health_score: number;
  health_status: string;
  factors: HealthFactor[];
  summary: string;
  trend?: TrendPoint[];
  change_7d?: number | null;
}

// ---------------------------------------------------------------- stress
export interface StressRisk {
  risk_type: "water" | "heat" | "disease";
  level: "low" | "moderate" | "high";
  probability: number;
  window_hours: number;
  contributing_factors: string[];
  prediction: string;
  recommended_action: string;
}

// ------------------------------------------------------------ irrigation
export interface IrrigationAdvice {
  field_id: number;
  field_name: string;
  recommendation: "irrigate" | "monitor" | "hold";
  headline: string;
  urgency_hours: number | null;
  soil_moisture: number;
  target_moisture_min: number;
  target_moisture_max: number;
  deficit_mm: number;
  water_needed_mm: number;
  estimated_volume_m3: number;
  forecast_rain_mm: number;
  reasons: string[];
  status: string;
  forecast_hourly?: { time: string; temperature: number; precipitation_mm: number; rain_probability: number }[];
}

export interface FarmIrrigation {
  farm_id: number;
  recommendations: IrrigationAdvice[];
  total_estimated_volume_m3: number;
  summary: string;
}

// ---------------------------------------------------------------- yield
export interface YieldFactor {
  name: string;
  impact: "positive" | "negative" | "neutral";
  note: string;
}

export interface YieldForecast {
  field_id: number;
  field_name: string;
  crop_name: string;
  expected_yield_t_per_ha: number;
  min_yield_t_per_ha: number;
  max_yield_t_per_ha: number;
  total_expected_tons: number;
  area_hectares: number;
  previous_yield_t_per_ha: number | null;
  trend_percent: number | null;
  expected_harvest_date: string | null;
  days_to_harvest: number | null;
  confidence: number;
  factors: YieldFactor[];
  error?: string;
}

export interface FarmYield {
  farm_id: number;
  fields: YieldForecast[];
  total_expected_tons: number;
  total_area_hectares: number;
  average_yield_t_per_ha: number | null;
}

// ---------------------------------------------------------------- alerts
export interface Alert {
  id: number;
  farm_id: number;
  field_id: number | null;
  field_name: string | null;
  severity: "critical" | "warning" | "info";
  category: string;
  title: string;
  message: string;
  recommended_action: string;
  is_resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface AlertCounts {
  critical: number;
  warning: number;
  info: number;
  resolved: number;
  total: number;
}

export interface AlertList {
  alerts: Alert[];
  counts: AlertCounts;
}

// --------------------------------------------------------------- disease
export interface DiseasePrediction {
  label: string;
  crop: string;
  disease: string;
  confidence: number;
}

export interface DiseaseScan {
  id: number;
  field_id: number | null;
  field_name: string | null;
  image_url: string | null;
  detected_crop: string;
  disease: string;
  confidence: number;
  severity: string;
  disease_risk: number;
  is_healthy: boolean;
  recommended_action: string;
  top_predictions: DiseasePrediction[];
  created_at: string;
}

export interface DiseaseModelStatus {
  enabled: boolean;
  loaded: boolean;
  model_name: string;
  device: string;
  error: string | null;
}

// --------------------------------------------------------------- copilot
export interface CopilotDataSource {
  kind: string;
  label: string;
  ref_id?: number | null;
}

export interface CopilotChatResponse {
  conversation_id: number;
  reply: string;
  intent: string;
  data_sources: CopilotDataSource[];
  suggested_questions: string[];
  provider: string;
}

export interface CopilotMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  data_sources: CopilotDataSource[];
  created_at: string;
}

export interface CopilotConversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  messages: CopilotMessage[];
}

export interface CopilotConversationSummary {
  id: number;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------- iot
export interface SensorNode {
  id: number;
  field_id: number;
  field_name: string | null;
  name: string;
  device_id: string;
  device_key?: string | null;
  status: "planned" | "online" | "offline";
  firmware: string;
  battery_level: number | null;
  signal_strength: number | null;
  last_seen_at: string | null;
  reading_count: number;
  latest_reading: {
    recorded_at: string;
    soil_moisture: number;
    soil_ph: number;
    temperature: number;
    humidity: number;
    battery_level: number;
    is_simulated: boolean;
  } | null;
  created_at: string;
}

export interface SensorReading {
  id: number;
  node_id: number;
  recorded_at: string;
  soil_moisture: number;
  soil_ph: number;
  temperature: number;
  humidity: number;
  battery_level: number;
  signal_strength: number;
  is_simulated: boolean;
}

export interface IoTStatus {
  hardware_available: boolean;
  status: string;
  message: string;
  node_count: number;
  fields_covered: number;
  capabilities: { sensor: string; unit: string; description: string }[];
}

// ---------------------------------------------------------- overview page
export interface OverviewFieldCard {
  id: number;
  name: string;
  crop: string | null;
  variety: string | null;
  growth_stage: string;
  area_hectares: number;
  latitude: number;
  longitude: number;
  boundary: Ring | null;
  health_score: number;
  health_status: string;
  health_change_7d: number | null;
  soil_moisture: number;
  disease_risk: number;
  water_stress: number;
  irrigation_recommendation: "irrigate" | "monitor" | "hold";
  risk_level: "low" | "moderate" | "high";
}

export interface OverviewPayload {
  farm: {
    id: number;
    name: string;
    location_name: string;
    latitude: number;
    longitude: number;
  };
  weather: WeatherForecast;
  fields: OverviewFieldCard[];
  farm_health: {
    average_score: number | null;
    field_count: number;
    total_area_hectares: number;
  };
  alerts: {
    open_count: number;
    critical_count: number;
    latest: Alert[];
  };
  top_recommendation: {
    field_name: string;
    title: string;
    action: string;
  } | null;
  data_sources: {
    weather: string;
    telemetry: string;
  };
}

/** Compact scan summary embedded in the field intelligence bundle. */
export interface LatestScanLite {
  id: number;
  field_id: number | null;
  detected_crop: string;
  disease: string;
  confidence: number;
  severity: string;
  disease_risk: number;
  is_healthy: boolean;
  recommended_action: string;
  created_at: string;
}

/** Full per-field intelligence bundle (GET /fields/{id}). */
export interface FieldIntelligence {
  field: Field;
  conditions: FieldConditions;
  weather: CurrentWeather;
  health: HealthAssessment;
  stress_risks: StressRisk[];
  irrigation: IrrigationAdvice;
  yield_forecast: YieldForecast;
  latest_disease_scan: LatestScanLite | null;
  health_trend: TrendPoint[];
}
