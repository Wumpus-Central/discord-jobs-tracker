export interface GreenhouseBoard {
  readonly name: string;
  readonly content: string;
}

export interface GreenhouseLocation {
  readonly name: string;
}

export interface GreenhouseDepartment {
  readonly id: number;
  readonly name: string;
  readonly child_ids: readonly number[];
  readonly parent_id: number | null;
}

export interface GreenhouseOffice {
  readonly id: number;
  readonly name: string;
  readonly location: string | null;
  readonly child_ids: readonly number[];
  readonly parent_id: number | null;
}

export type GreenhouseMetadataValue = string | readonly string[] | null;

export interface GreenhouseMetadata {
  readonly id: number;
  readonly name: string;
  readonly value: GreenhouseMetadataValue;
  readonly value_type: string;
}

export interface GreenhouseDataCompliance {
  readonly type: string;
  readonly requires_consent: boolean;
  readonly requires_processing_consent: boolean;
  readonly requires_retention_consent: boolean;
  readonly retention_period: number | null;
  readonly demographic_data_consent_applies?: boolean;
}

export interface GreenhouseJob {
  readonly id: number;
  readonly internal_job_id: number;
  readonly title: string;
  readonly updated_at: string;
  readonly requisition_id: string | null;
  readonly location: GreenhouseLocation;
  readonly absolute_url: string;
  readonly company_name: string;
  readonly first_published: string;
  readonly language: string;
  readonly application_deadline: string | null;
  readonly metadata: readonly GreenhouseMetadata[];
  readonly data_compliance: readonly GreenhouseDataCompliance[];
  readonly content?: string;
  readonly departments?: readonly GreenhouseDepartment[];
  readonly offices?: readonly GreenhouseOffice[];
  readonly ai_disclaimer?: string | null;
  readonly include_ai_disclaimer?: boolean;
  readonly ai_opt_out_request_url?: string | null;
}

export interface GreenhouseJobsMeta {
  readonly total: number;
}

export interface GreenhouseJobsResponse {
  readonly jobs: readonly GreenhouseJob[];
  readonly meta: GreenhouseJobsMeta;
}
