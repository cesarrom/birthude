import { Invitation, Invitee } from "@/db/schema";

// ============================================================================
// Shared Types
// ============================================================================

export interface Slot {
  name: string;
  description: string;
}

// ============================================================================
// Step 1: Generate Copy
// ============================================================================

export interface GenerateCopyInput {
  invitation: Invitation;
  invitee: Invitee;
  availableSlots: Slot[];
  locale: string;
}

export type ScreenPurpose =
  | 'intro'
  | 'welcome'
  | 'date'
  | 'location'
  | 'bring_item'
  | 'raffle'
  | 'rsvp'
  | 'farewell';

export interface ScreenCopy {
  id: string;
  purpose: ScreenPurpose;
  headline: string;
  subtext?: string;
  suggestedSlot?: string;
  completionTrigger: 'auto' | 'interaction' | 'manual';
  completionLabel?: string;
  suggestedMood?: string;
  suggestedPageStyle?: string;
}

export interface CopyResult {
  screens: ScreenCopy[];
  overallTheme: string;
  colorPalette: string[];
}

// ============================================================================
// Step 2: Generate SVGs
// ============================================================================

export interface GenerateSVGsInput {
  copy: CopyResult;
}

export interface GeneratedSVG {
  screenId: string;
  svgContent: string;
  role: 'hero' | 'decoration' | 'accent';
  description: string;
  semanticName: string;
  isAnimated: boolean;
}

export interface UploadedSVG {
  screenId: string;
  url: string;
  role: 'hero' | 'decoration' | 'accent';
  description: string;
  semanticName: string;
  isAnimated: boolean;
}

// ============================================================================
// Step 3: Name Assets
// ============================================================================

export interface AssetToName {
  id: string;
  url: string;
  type: 'image' | 'svg';
}

export interface NameAssetsInput {
  assets: AssetToName[];
}

export interface NamedAsset {
  id: string;
  url: string;
  semanticName: string;
  description: string;
  suggestedUsage: ScreenPurpose[];
  type: 'image' | 'svg';
}

// ============================================================================
// Step 4: Pick Assets for Screens
// ============================================================================

export interface PickAssetsInput {
  copy: CopyResult;
  namedAssets: NamedAsset[];
}

export type AssetRole = 'background' | 'hero' | 'decoration' | 'accent';

export interface AssetPlacement {
  assetId: string;
  role: AssetRole;
  css: Record<string, string>;
}

export interface ScreenAssetAssignment {
  screenId: string;
  assets: AssetPlacement[];
}

// ============================================================================
// Step 5: Generate Experience (Final Manifest)
// ============================================================================

export interface GenerateExperienceInput {
  copy: CopyResult;
  assetAssignments: ScreenAssetAssignment[];
  availableSlots: Slot[];
  assetUrlMap: Record<string, string>;
}

// Manifest types (matching existing prompts.ts schema)
export type AssetType = 'text' | 'image' | 'svg' | 'slot';

export interface Asset {
  id: string;
  type: AssetType;
  content?: string;
  src?: string;
  slotId?: string;
  cloneCount?: number;
  css?: Record<string, string | number>;
}

export interface Action {
  targetId: string;
  type: 'to' | 'fromTo' | 'set' | 'draw';
  vars: Record<string, any>;
  fromVars?: Record<string, any>;
  position?: string;
}

export interface Step {
  id: string;
  cleanup?: Action[];
  animationFlow: Action[];
  ambience?: Action[];
  completion: {
    trigger: 'auto' | 'interaction' | 'manual';
    delay?: number;
    label?: string;
  };
  pageStyle?: string;
}

export interface Manifest {
  assets: Asset[];
  timeline: Step[];
}
