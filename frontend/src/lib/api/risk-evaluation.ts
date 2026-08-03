import { apiClient } from '@/lib/api/client';

export interface RiskEvaluationCondition {
  condicion: string;
  tipo: string;
  riesgos: string | null;
  impacto: 'Alto' | 'Medio' | 'Bajo' | string | null;
  imagen_url: string | null;
}

export interface RiskEvaluationKmPoint {
  id: number;
  risk_evaluation_id: number;
  km_label: string;
  km_number: number;
  lat: number;
  lng: number;
  fecha_video: string | null;
  video_filename: string | null;
  video_url: string | null;
  tipo_camino: string | null;
  comentario: string | null;
  conditions: RiskEvaluationCondition[];
}

export interface RiskEvaluationResponse {
  evaluation: { id: number; nombre: string } | null;
  kms: RiskEvaluationKmPoint[];
}

export function getRiskEvaluation(evaluationId?: number): Promise<RiskEvaluationResponse> {
  return apiClient.get<RiskEvaluationResponse>('/risk-evaluations', {
    query: { evaluation_id: evaluationId },
  });
}

export interface RiskEvaluationUploadResult {
  evaluation_id: number;
  nombre: string;
  kms: number;
}

/** Sube el .ods de Evaluación de Riesgo — parsea las 4 hojas y hace upsert
 * por km directo en el backend. */
export function uploadRiskEvaluation(file: File, nombre: string): Promise<RiskEvaluationUploadResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('nombre', nombre);
  return apiClient.form<RiskEvaluationUploadResult>('/admin/risk-evaluations/upload', form, 5 * 60_000);
}
