import gsap from "gsap";
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
    ambience?: SchemaAction[]; // Parallel loops (e.g., background animations)
    pageStyle?: string; // CSS styles for the page, e.g., 'background-color: #f0f0f0;'
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
    step?: SchemaStep;
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

    // UI
    private uiLayer: HTMLElement;
    private nextBtn: HTMLButtonElement | null = null;
    private ambienceTweens: gsap.core.Tween[] = [];

    constructor(config: {
        container: HTMLElement;
        manifest: SchemaManifest;
        slots?: SlotRegistry;
    }) {
        this.container = config.container;
        this.manifest = config.manifest;
        console.log(JSON.stringify(this.manifest, null, 2));
        Object.assign(this.manifest.timeline[this.manifest.timeline.length - 1].completion, {
            trigger: 'interaction',
        });
        this.slots = config.slots || {};
        this.uiLayer = document.getElementById('ui-layer') || this.container; // fallback
        this.uiLayer.setAttribute('style', this.manifest.timeline[0].pageStyle || '');
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
        this.createUI();
        this.next();
    }

    /** Programmatic Navigation: Next Step */
    public next() {
        // this cleans background animations
        this.ambienceTweens?.forEach((t: gsap.core.Tween) => { t.kill(); });
        this.ambienceTweens = [];

        // we are going OUT of current page, we need to clean the other animations of this step too
        this.manifest?.timeline?.[this.currentStepIndex]?.animationFlow.forEach((a: SchemaAction) => {
            gsap.killTweensOf(a.targetId);
        });

        // Kill current animation if rushing
        if (this.currentTimeline) this.currentTimeline.kill();
        this.emit({ type: 'STEP_COMPLETE', step: this.manifest.timeline[this.currentStepIndex] });

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
        const idx = this.manifest.timeline.findIndex((s) => s.id === stepId);
        if (idx > -1) {
            if (this.currentTimeline) this.currentTimeline.kill();
            this.currentStepIndex = idx;
            this.playStep(this.manifest.timeline[idx]);
        }
    }

    // --- INTERNAL LOGIC ---

    private emit(e: EngineEvent) {
        this.listeners.forEach((cb) => cb(e));
    }

    private createUI() {
        const btn = document.createElement('button');
        btn.className = 'nav-btn';
        btn.innerText = 'Continue';
        btn.onclick = () => {
            this.hideButton();
            this.next();
        };
        this.emit({ type: 'INTERACTION_REQUIRED', interaction: { label: btn.innerText, callback: btn.onclick as any } });
        this.uiLayer.appendChild(btn);
        this.nextBtn = btn;
    }

    private showButton(label: string) {
        if (!this.nextBtn) return;
        this.nextBtn.innerText = label;
        gsap.to(this.nextBtn, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out' });
    }

    private hideButton() {
        if (!this.nextBtn) return;
        gsap.to(this.nextBtn, { y: 100, opacity: 0, duration: 0.3 });
    }

    private async buildAssets() {
        const promises = this.manifest.assets.map(async (asset) => {
            if (asset.cloneCount && asset.cloneCount > 1) {
                const clones: HTMLElement[] = [];
                for (let i = 0; i < asset.cloneCount; i++) {
                    const el = await this.createAssetDOM(asset);
                    // Randomize generic particle positions
                    if (asset.id.includes('confetti') || asset.id.includes('particle')) {
                        el.style.left = Math.random() * 100 + '%';
                        el.style.top = '-50px'; // Start off screen
                    }
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
        el.className = `schema-asset type-${asset.type}`;

        // Base styling
        el.style.position = 'absolute';
        el.style.opacity = '0';
        el.style.display = 'flex';
        el.style.justifyContent = 'center';
        el.style.alignItems = 'center';
        el.style.pointerEvents = 'none'; // Default to pass-through

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
                    // Check if it's a real URL we should fetch, or just an image ref
                    if (asset.src.endsWith('.svg')) {
                        try {
                            const res = await fetch(asset.src);
                            el.innerHTML = await res.text();
                        } catch (err) {
                            console.error(`Failed to load SVG ${asset.src}`, err);
                        }
                    } else {
                        // Fallback to image tag
                        const imgSvg = document.createElement('img');
                        imgSvg.src = asset.src;
                        el.appendChild(imgSvg);
                        return el;
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
                el.style.position = 'relative';
                const absoluteDiv = document.createElement('div');
                absoluteDiv.style.position = 'absolute';
                absoluteDiv.style.width = '100%';
                absoluteDiv.style.height = '100%';
                absoluteDiv.style.zIndex = '1000';
                const slot = document.createElement('slot');
                absoluteDiv.appendChild(slot);
                slot.name = asset.slotId || '';
                el.style.pointerEvents = 'auto'; // Slots are interactive
                el.appendChild(absoluteDiv);
                break;
        }

        if (asset.css) {
            Object.assign(el.style, asset.css);
        }

        Object.assign(asset, { actualElement: el });

        return el;
    }

    private playStep(step: SchemaStep) {
        this.emit({ type: 'STEP_START', step });
        // Update page style
        this.uiLayer.setAttribute('style', step.pageStyle || this.uiLayer.getAttribute('style') || '');

        // Kill previous ambience
        let called = false;

        const tl = gsap.timeline({
            onComplete: () => {
                if (called) { return; }
                called = true;
                this.handleCompletion(step);
            },
        });

        setTimeout(() => {
            if (called) { return; }
            called = true;
            this.handleCompletion(step);
        }, 5000);

        this.currentTimeline = tl;

        // 1. Cleanup Phase
        if (step.cleanup) {
            step.cleanup.forEach((action) => this.runAction(action, tl));
        }

        // 2. Animation Phase
        step.animationFlow.forEach((action) => this.runAction(action, tl));

        // 3. Ambience (Parallel Loops)
        if (step.ambience) {
            step.ambience.forEach((act: any) => {
                const targets = this.resolveTarget(act.targetId);
                if (targets) {
                    // Ambience runs outside the main TL
                    const t = gsap.to(targets, act.vars);
                    this.ambienceTweens.push(t);
                }
            });
        }
    }

    private runAction(action: SchemaAction, tl: gsap.core.Timeline) {
        const targets = this.resolveTarget(action.targetId);
        if (!targets) return;

        const pos = action.position || '>';
        const vars = { ...action.vars };

        if (action.type === 'draw') {
            // Complex SVG Draw
            const els = Array.isArray(targets) ? targets : [targets];
            els.forEach((wrapper) => {
                const paths = wrapper.querySelectorAll('path, circle, rect, line');
                paths.forEach((p: any) => {
                    const len = p.getTotalLength();
                    p.style.strokeDasharray = len;
                    p.style.strokeDashoffset = len;
                    tl.to(p, { strokeDashoffset: 0, ...vars }, pos);
                });
            });
        } else if (action.type === 'to') {
            tl.to(targets, vars, pos);
        } else if (action.type === 'fromTo') {
            tl.fromTo(targets, action.fromVars || {}, vars, pos);
        } else if (action.type === 'set') {
            tl.set(targets, vars, pos);
        }
    }

    private resolveTarget(id: string): HTMLElement | HTMLElement[] | null {
        if (id.startsWith('#')) return this.container.querySelector(id) as HTMLElement;
        return this.domMap.get(id) || null;
    }

    private handleCompletion(step: SchemaStep) {
        if (step.completion.trigger === 'auto') {
            gsap.delayedCall(step.completion.delay || 0, () => this.next());
        } else if (step.completion.trigger === 'interaction') {
            this.showButton(step.completion.label || 'Next');
        }
        // 'manual' trigger does nothing. It waits for external call.
    }
}