"use client";
import dynamic from "next/dynamic";
import { normalizeExperience, Invitation } from "./types";
import { GsapScreen } from "./gsap-screen";
import { CountdownTarget } from "./countdown-target";
import { SlotMachinePro } from "./slot-machine-pro";

const MapCanvas = dynamic(() => import("@/app/create/map-canvas"), { ssr: false });

function ProgressDots({ count, current, color = "#ffffff" }: { count: number; current: number; color?: string }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className={`h-2 w-2 rounded-full ${i === current ? '' : 'opacity-40'}`} style={{ backgroundColor: color }} />
      ))}
    </div>
  );
}

function Collage({ images }: { images: Array<{ name: string; source: string; mimeType?: string }> }) {
 return null; // Placeholder from original file
}

export function RewindExperience({ experience, invitation, assignedItem, step, onNext, onBack, onToggleSound }: { experience: any; invitation: Invitation; assignedItem: string; step: number; onNext: () => void; onBack: () => void; onToggleSound: () => void }) {
  // Normalize again just in case, though parent should have done it
  const norm = normalizeExperience(experience);
  const screens = norm?.screens ?? [];
  const current = screens[Math.min(step, Math.max(0, screens.length - 1))];
  
  // Use current.bg if available, otherwise use a theme-based default or fallback to black
  const bgValue = current?.bg || "#111"; 
  const bgStyle = bgValue.startsWith("linear-gradient") || bgValue.startsWith("radial-gradient") 
    ? { backgroundImage: bgValue } 
    : { backgroundColor: bgValue };

  const assets = norm?.assets ?? {};


  // Colors
  const titleColor = current?.titleColor || "#ffffff";
  const textColor = current?.textColor || "#ffffff";
  const btnBg = current?.buttonColor || "rgba(255,255,255,0.2)";
  const btnText = current?.buttonTextColor || "#ffffff";

  function downloadCalendar() {
     console.log("[RewindExperience] Downloading calendar");
     const start = new Date(invitation.eventAt);
     const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // Assume 2 hours
     const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
     const content = [
       "BEGIN:VCALENDAR",
       "VERSION:2.0",
       "BEGIN:VEVENT",
       `DTSTART:${fmt(start)}`,
       `DTEND:${fmt(end)}`,
       `SUMMARY:${invitation.title}`,
       `DESCRIPTION:${invitation.description || ""}`,
       `LOCATION:${invitation.location}`,
       "END:VEVENT",
       "END:VCALENDAR"
     ].join("\r\n");
     const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
     const url = URL.createObjectURL(blob);
     const a = document.createElement("a");
     a.href = url;
     a.download = "invitation.ics";
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
  }

  function openMaps() {
    console.log("[RewindExperience] Opening maps");
    if (invitation.lat && invitation.lng) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${invitation.lat},${invitation.lng}`, '_blank');
    } else {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(invitation.location)}`, '_blank');
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden" style={bgStyle}>
      {/* Background Pattern - subtle overlay, blending with color */}
      <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay" style={{ backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`, backgroundSize: '20px 20px' }} />
      
      {/* GSAP Screen Renderer */}
      {current && (
        <GsapScreen
          key={current.id} // Re-mount on screen change to reset animations
          screen={current}
          assets={assets}
        />
      )}

      {/* Persistent UI Layer */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center pointer-events-none">
        <div className="pointer-events-auto" style={{ color: textColor }}>
          {/* We now prefer to render title/text via GSAP actors if they exist in the timeline */}
          {/* But we keep this as fallback or if the schema doesn't include them as actors */}
          {!current?.actors?.some((a: any) => a.id === 'title') && current?.title && <h2 className="text-4xl font-extrabold drop-shadow-md" style={{ color: titleColor }}>{current.title}</h2>}
          {!current?.actors?.some((a: any) => a.id === 'text') && current?.text && <p className="mt-3 max-w-xl text-lg drop-shadow-sm" style={{ color: textColor }}>{current.text}</p>}
          
          {/* Interactive Modules per step */}
          {step === 1 && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 backdrop-blur" style={{ backgroundColor: btnBg, color: btnText }}><span>📅</span> Calendar reminder</span>
              <CountdownTarget eventAt={invitation.eventAt} />
              <button onClick={downloadCalendar} className="mt-2 text-sm underline opacity-80 hover:opacity-100">Add to Calendar</button>
            </div>
          )}
          {step === 2 && (
            <div className="mt-6 w-full max-w-md rounded-2xl bg-white/10 p-2 overflow-hidden backdrop-blur flex flex-col gap-2">
              <MapCanvas onClick={() => {}} marker={invitation.lat ? { lat: invitation.lat, lng: invitation.lng! } : undefined} center={invitation.lat ? { lat: invitation.lat, lng: invitation.lng! } : undefined} height={256} />
              <button onClick={openMaps} className="text-sm underline opacity-80 hover:opacity-100 py-1">Open in Maps</button>
            </div>
          )}
          {/* Slot Machine - Only show if we have items AND it's step 3 */}
          {step === 3 && invitation.items && invitation.items.length > 0 && (
            <div className="mt-6">
              <SlotMachinePro items={invitation.items} assignedItem={assignedItem} />
            </div>
          )}
          {step === screens.length - 1 && (
             <Collage images={invitation.assets.images} />
          )}
        </div>

        <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-3 pointer-events-auto">
          <button className="rounded-full px-4 py-2 backdrop-blur hover:opacity-80 transition-opacity" style={{ backgroundColor: btnBg, color: btnText }} onClick={onBack}>Back</button>
          <ProgressDots count={screens.length} current={step} color={btnText} />
          <button className="rounded-full px-4 py-2 backdrop-blur hover:opacity-80 transition-opacity" style={{ backgroundColor: btnBg, color: btnText }} onClick={onNext}>
            {step === screens.length - 1 ? "Finish" : "Next"}
          </button>
          <button className="ml-2 rounded-full px-3 py-2 text-sm backdrop-blur hover:opacity-80 transition-opacity" style={{ backgroundColor: btnBg, color: btnText }} onClick={onToggleSound}>Sound</button>
        </div>
      </div>
    </div>
  );
}
