export type Severity = 'critical' | 'major' | 'minor';
export type IssueStatus = 'open' | 'resolved' | 'ignored';
export interface Project { id: string; name: string; description: string; toleranceProfileId: string; createdAt: string; updatedAt: string }
export interface Run { id: string; projectId: string; state: string; designAssetId?: string; implementationAssetId?: string; score?: number; passed?: boolean; createdAt: string; updatedAt: string }
export interface Rect { x: number; y: number; width: number; height: number }
export interface Issue {
  id: string; runId: string; groupId: string; type: string; severity: Severity; confidence: string;
  detectorTier: string; title: string; plainDescription: string; rect: Rect; expected?: string; actual?: string;
  delta?: number; unit?: string; suggestedCssPatch?: string; status: IssueStatus; createdAt: string;
}
export interface ImageAsset { id: string; kind: string; filename: string; mimeType: string; width: number; height: number; createdAt: string }
export interface ImageNormalization {
  applied: boolean;
  reference: { width: number; height: number };
  candidate: { width: number; height: number };
  target: { width: number; height: number };
  aspectRatioDifferencePercent: number;
  scaleX: number;
  scaleY: number;
}
export interface AnalysisResponse { run: Run; issues: Issue[]; evidenceAssetId: string; alignment: unknown; normalization: ImageNormalization }
