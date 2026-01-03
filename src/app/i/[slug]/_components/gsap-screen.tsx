"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function GsapScreen({ screen, assets }: { screen: any; assets: Record<string, string> }) {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!container.current) return;
    const actors = screen.actors || [];
    
    // Timeline for the screen
    const tl = gsap.timeline();

    actors.forEach((actor: any) => {
      const el = document.getElementById(actor.uniqueId || actor.id); // Fallback to id if uniqueId missing
      if (!el) return;

      // ENTRANCE
      if (actor.actions?.entrance) {
        const ent = actor.actions.entrance;
        
        // Handle Array-based GSAP tweens (AI's preferred format)
        if (Array.isArray(ent)) {
            ent.forEach((tween: any) => {
                // If it has 'from' and 'to', use fromTo
                if (tween.from && tween.to) {
                    tl.fromTo(el, tween.from, { ...tween.to, duration: tween.duration || tween.to.duration || 1 }, tween.delay || tween.to.delay || 0);
                } else if (tween.from) {
                    tl.from(el, { ...tween.from, duration: tween.duration || 1 }, tween.delay || 0);
                } else if (tween.to) {
                    tl.to(el, { ...tween.to, duration: tween.duration || 1 }, tween.delay || 0);
                }
            });
        }
        // Handle legacy object format
        else if (ent.type === 'move_to' && ent.target) {
           tl.to(el, {
             ...ent.target,
             duration: ent.duration || 1,
             ease: ent.ease || "power1.out"
           }, 0); 
        } else if (ent.type === 'scale_up') {
           tl.fromTo(el, 
             { scale: 0 }, 
             { scale: (ent.targetScale || 100) / 100, duration: ent.duration || 1, ease: ent.ease || "back.out(1.7)" },
             0
           );
        } else if (ent.type === 'fade_in') {
           tl.to(el, { opacity: 1, duration: ent.duration || 1 }, 0);
        }
      }

      // IDLE (Loops)
      if (actor.actions?.idle) {
        const idle = actor.actions.idle;
        
        // Handle Array-based GSAP tweens
        if (Array.isArray(idle)) {
             idle.forEach((tween: any) => {
                 if (tween.to) {
                     gsap.to(el, { ...tween.to, duration: tween.duration || 2, repeat: -1, yoyo: true, ease: "sine.inOut" });
                 }
             });
        }
        // Legacy
        else if (idle.type === 'float') {
          gsap.to(el, {
            y: idle.y_amplitude || 15,
            duration: idle.duration || 2,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut"
          });
        } else if (idle.type === 'sway') {
          gsap.to(el, {
            rotation: idle.intensity || 5,
            duration: idle.speed || 2,
            yoyo: true,
            repeat: -1,
            transformOrigin: "50% 0%",
            ease: "sine.inOut"
          });
        } else if (idle.type === 'spin') {
           gsap.to(el, {
             rotation: 360,
             duration: idle.duration || 5,
             repeat: -1,
             ease: "linear"
           });
        }
      }
    });

  }, { scope: container, dependencies: [screen.id] }); // Re-run when screen ID changes

  return (
    <div ref={container} className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {screen.actors?.filter((a: any) => a.type !== 'text').map((actor: any) => {
        // Resolve content
        let content = null;
        const style: any = {
          position: 'absolute',
          ...actor.layout,
        };

        // Safety for unit-less values that might be interpreted as pixels but need %
        ['top', 'left', 'right', 'bottom', 'width', 'height'].forEach(prop => {
            if (typeof style[prop] === 'number') style[prop] = `${style[prop]}%`;
        });

        // Ensure we have a valid ID for GSAP to target
        const safeId = actor.uniqueId || actor.id;

        if ((actor.type === 'image' || actor.type === 'svg') && actor.assetId) {
          const src = assets[actor.assetId];
          if (src) content = <img src={src} alt={safeId} className="w-full h-full object-contain" />;
        }
        
        if (!content && (actor.type === 'svg' || actor.type === 'emoji' || actor.type === 'text')) {
           // Handle emoji/text specially with styling
           if (actor.type === 'emoji') {
               content = <div className="flex items-center justify-center h-full w-full">{actor.content}</div>;
           } else if (actor.type === 'text') {
               content = <div>{actor.content}</div>;
           } else {
               content = <div dangerouslySetInnerHTML={{ __html: actor.content }} />;
           }
        }

        return (
          <div key={safeId} id={safeId} style={style}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
