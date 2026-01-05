/**
 * ============================================================================
 * 1. TYPE DEFINITIONS
 * ============================================================================
 */

// --- GSAP TYPES (Simplified Shim for context) ---
type GSAPVars = Record<string, any>;

// --- ASSET TYPES ---
export type AssetType = 'text' | 'image' | 'svg' | 'slot';

export interface SchemaAsset {
  id: string;
  type: AssetType;
  // Content: specific to type
  content?: string; // HTML string or Raw SVG
  src?: string;     // URL for image/svg
  slotId?: string;  // For slots
  // Configuration
  cloneCount?: number; // For particle systems
  css?: Partial<CSSStyleDeclaration> | Record<string, string | number>;
}

// --- ANIMATION ACTION TYPES ---
export type ActionType = 'to' | 'fromTo' | 'set' | 'draw';

export interface SchemaAction {
  targetId: string;
  type: ActionType;
  vars: GSAPVars;      // Standard GSAP properties (x, y, opacity...)
  fromVars?: GSAPVars; // Only for fromTo
  position?: string | number; // Timeline position (e.g., "<", "+=0.5")
}

// --- STEP / STORYBOARD TYPES ---
export type CompletionTrigger = 'auto' | 'interaction' | 'manual';

export interface SchemaStep {
  id: string;
  cleanup?: SchemaAction[];
  animationFlow: SchemaAction[];
  completion: {
    trigger: CompletionTrigger;
    delay?: number;   // Used if trigger is auto
    label?: string;   // Used if trigger is interaction (button label)
  };
}

// --- MANIFEST ROOT ---
export interface SchemaManifest {
  assets: SchemaAsset[];
  timeline: SchemaStep[];
}

// --- EVENTS ---
export type EngineEventType = 
  | 'INIT' 
  | 'STEP_START' 
  | 'STEP_COMPLETE' 
  | 'SEQUENCE_COMPLETE' 
  | 'INTERACTION_REQUIRED'
  | 'LOG';

export interface EngineEvent {
  type: EngineEventType;
  stepId?: string;
  message?: string;
  // Payload for interaction requests
  interaction?: {
    label: string;
    callback: () => void;
  };
}

// --- SLOTS ---
// The component receives the container AND the engine instance
export type SlotRenderer = (container: HTMLElement, engine: SchemaEngine) => void;

export interface SlotRegistry {
  [key: string]: SlotRenderer;
}

/**
 * ============================================================================
 * 2. THE ENGINE CLASS
 * ============================================================================
 */
export class SchemaEngine {
  private container: HTMLElement;
  private manifest: SchemaManifest;
  private slots: SlotRegistry;
  private listeners: ((e: EngineEvent) => void)[] = [];
  
  // State
  private domMap = new Map<string, HTMLElement | HTMLElement[]>();
  private currentStepIndex = -1;
  private currentTimeline: gsap.core.Timeline | null = null;

  constructor(config: { 
    container: HTMLElement; 
    manifest: SchemaManifest; 
    slots?: SlotRegistry 
  }) {
    this.container = config.container;
    this.manifest = config.manifest;
    this.slots = config.slots || {};
  }

  // --- PUBLIC API ---

  /** Subscribe to engine events */
  public on(callback: (e: EngineEvent) => void) {
    this.listeners.push(callback);
  }

  /** Start the engine */
  public async init() {
    this.emit({ type: 'LOG', message: 'Engine Initializing...' });
    await this.buildAssets();
    this.emit({ type: 'INIT' });
    this.next();
  }

  /** Programmatic Navigation: Next Step */
  public next() {
    // Kill current animation if rushing
    if (this.currentTimeline) this.currentTimeline.kill();
    
    this.currentStepIndex++;
    if (this.currentStepIndex >= this.manifest.timeline.length) {
      this.emit({ type: 'SEQUENCE_COMPLETE' });
      return;
    }
    this.playStep(this.manifest.timeline[this.currentStepIndex]);
  }

  /** Programmatic Navigation: Previous Step (Basic Implementation) */
  public previous() {
    if (this.currentStepIndex <= 0) return;
    
    if (this.currentTimeline) this.currentTimeline.kill();
    this.currentStepIndex--;
    
    // Note: Reversing complex Cleanups perfectly requires state snapshots.
    // This implementation simply re-runs the previous step's flow.
    this.playStep(this.manifest.timeline[this.currentStepIndex]);
  }

  /** Jump to specific step ID */
  public goTo(stepId: string) {
    const idx = this.manifest.timeline.findIndex(s => s.id === stepId);
    if (idx > -1) {
      if (this.currentTimeline) this.currentTimeline.kill();
      this.currentStepIndex = idx;
      this.playStep(this.manifest.timeline[idx]);
    }
  }

  // --- INTERNAL LOGIC ---

  private emit(e: EngineEvent) {
    this.listeners.forEach(cb => cb(e));
  }

  private async buildAssets() {
    const promises = this.manifest.assets.map(async (asset) => {
      if (asset.cloneCount && asset.cloneCount > 1) {
        const clones: HTMLElement[] = [];
        for (let i = 0; i < asset.cloneCount; i++) {
          const el = await this.createAssetDOM(asset);
          this.container.appendChild(el);
          clones.push(el);
        }
        this.domMap.set(asset.id, clones);
      } else {
        const el = await this.createAssetDOM(asset);
        this.container.appendChild(el);
        this.domMap.set(asset.id, el);
      }
    });
    await Promise.all(promises);
  }

  private async createAssetDOM(asset: SchemaAsset): Promise<HTMLElement> {
    const el = document.createElement('div');
    el.id = asset.id;
    // Base styling
    el.style.position = 'absolute';
    el.style.display = 'flex';
    el.style.justifyContent = 'center';
    el.style.alignItems = 'center';
    el.style.pointerEvents = 'none'; // Default to pass-through
    
    if (asset.css) {
      Object.assign(el.style, asset.css);
    }

    // Default hidden
    // @ts-ignore (GSAP is global)
    gsap.set(el, { autoAlpha: 0 });

    switch (asset.type) {
      case 'text':
        el.innerHTML = asset.content || '';
        el.style.textAlign = 'center';
        break;
      
      case 'image':
        const img = document.createElement('img');
        img.src = asset.src || '';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        el.appendChild(img);
        break;

      case 'svg':
        // 1. Inline Content
        if (asset.content) {
          el.innerHTML = asset.content;
        } 
        // 2. URL Fetch
        else if (asset.src) {
          try {
            // Check if it's a dummy mock URL for the demo, otherwise fetch
            if (asset.src.startsWith('http') && !asset.src.includes('api.dicebear')) {
                 const res = await fetch(asset.src);
                 el.innerHTML = await res.text();
            } else {
                 // Fallback for images masquerading as SVGs or Dicebear API
                 const imgSvg = document.createElement('img');
                 imgSvg.src = asset.src;
                 el.appendChild(imgSvg);
            }
          } catch (err) {
            console.error(`Failed to load SVG ${asset.src}`, err);
          }
        }
        // Ensure SVG scales
        const svg = el.querySelector('svg');
        if (svg) {
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.overflow = 'visible';
        }
        break;

      case 'slot':
        el.style.pointerEvents = 'auto'; // Slots are interactive
        if (asset.slotId && this.slots[asset.slotId]) {
          // PASS ENGINE INSTANCE HERE
          this.slots[asset.slotId](el, this);
        } else {
          el.innerHTML = `<div style="background:red">Missing Slot: ${asset.slotId}</div>`;
        }
        break;
    }

    return el;
  }

  private playStep(step: SchemaStep) {
    this.emit({ type: 'STEP_START', stepId: step.id });

    const tl = gsap.timeline({
      onComplete: () => {
        this.emit({ type: 'STEP_COMPLETE', stepId: step.id });
        this.handleCompletion(step);
      }
    });
    this.currentTimeline = tl;

    // 1. Cleanup Phase
    if (step.cleanup) {
      step.cleanup.forEach(action => this.runAction(action, tl));
    }

    // 2. Animation Phase
    step.animationFlow.forEach(action => this.runAction(action, tl));
  }

  private runAction(action: SchemaAction, tl: gsap.core.Timeline) {
    const targets = this.resolveTarget(action.targetId);
    if (!targets) return;

    const pos = action.position || ">";
    const vars = { ...action.vars };

    if (action.type === 'draw') {
      // SVG Draw Logic
      const els = Array.isArray(targets) ? targets : [targets];
      els.forEach(wrapper => {
        // Find path inside wrapper or wrapper itself
        const path = wrapper instanceof SVGPathElement ? wrapper : wrapper.querySelector('path');
        if (path) {
          const len = path.getTotalLength();
          path.style.strokeDasharray = `${len}`;
          path.style.strokeDashoffset = `${len}`;
          tl.to(path, { strokeDashoffset: 0, ...vars }, pos);
        }
      });
    } else if (action.type === 'to') {
      tl.to(targets, vars, pos);
    } else if (action.type === 'fromTo') {
      tl.fromTo(targets, action.fromVars || {}, vars, pos);
    } else if (action.type === 'set') {
      tl.set(targets, vars, pos);
    }
  }

  private resolveTarget(id: string): HTMLElement | HTMLElement[] | null | Element {
    if (id.startsWith('#')) return this.container.querySelector(id);
    return this.domMap.get(id) || null;
  }

  private handleCompletion(step: SchemaStep) {
    if (step.completion.trigger === 'auto') {
      gsap.delayedCall(step.completion.delay || 0, () => this.next());
    } 
    else if (step.completion.trigger === 'interaction') {
      this.emit({ 
        type: 'INTERACTION_REQUIRED', 
        interaction: {
          label: step.completion.label || 'Next',
          callback: () => this.next()
        }
      });
    }
    // 'manual' trigger does nothing. It waits for external call.
  }
}