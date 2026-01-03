"use client";
import { useEffect, useRef } from "react";

export function SlotMachinePro({ items, assignedItem }: { items: string[]; assignedItem: string }) {
  const slotsRef = useRef<HTMLDivElement[]>([]);
  const size = 100;
  const totalDuplicates = 7;
  function shuffle<T>(arr: T[]) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function buildLists(winItem: string) {
    const base = (items && items.length ? items : ["🎁","🎉","🥤","🍪","🍫"]).map((w) => String(w));
    slotsRef.current.forEach((slot, s) => {
      if (!slot) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'slot-machine__prizes';
      const list = shuffle(base.flatMap((w) => Array(totalDuplicates).fill(w)));
      list.forEach((word) => {
        const el = document.createElement('div');
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.color = '#fff';
        el.style.fontWeight = 'bold';
        el.style.fontSize = '18px';
        el.textContent = word;
        wrapper.appendChild(el);
      });
      const endEl = document.createElement('div');
      endEl.style.width = `${size}px`;
      endEl.style.height = `${size}px`;
      endEl.style.display = 'flex';
      endEl.style.alignItems = 'center';
      endEl.style.justifyContent = 'center';
      endEl.style.color = '#fff';
      endEl.style.fontWeight = 'bold';
      endEl.style.fontSize = '20px';
      endEl.textContent = winItem;
      wrapper.appendChild(endEl);
      while (slot.firstChild) slot.removeChild(slot.firstChild);
      slot.appendChild(wrapper);
    });
  }
  function start() {
    console.log("[SlotMachine] Starting spin", { assignedItem });
    buildLists(assignedItem || '');
    const count = (items && items.length ? items.length : 5);
    const listHeight = count * totalDuplicates * size;
    slotsRef.current.forEach((slot, s) => {
      const wrapper = slot?.querySelector('.slot-machine__prizes') as HTMLElement;
      if (!wrapper) return;
      wrapper.animate([
        { transform: 'translateY(0)' },
        { transform: `translateY(-${listHeight}px)` }
      ], { duration: 3000 + s * 500, easing: 'ease-in-out', fill: 'forwards' });
    });
  }
  useEffect(() => { if (slotsRef.current.length === 3 && assignedItem !== undefined) start(); }, [assignedItem, items]);
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="relative rounded-xl bg-[#0F3460] p-4">
        <div className="grid grid-cols-3 gap-4 rounded-md bg-black/20 p-4">
          {[0,1,2].map((i) => (
            <div key={i} className="h-[100px] w-[100px] overflow-hidden rounded-md bg-black/30">
              <div ref={(el) => { if (el) slotsRef.current[i] = el; }} className="slot" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
