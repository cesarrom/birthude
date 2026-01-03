"use client";
import { useEffect } from "react";
import confetti from "canvas-confetti";

export function ConfettiLauncher() {
    useEffect(() => {
        console.log("[Confetti] Launching celebration!");
        const duration = 3000;
        const end = Date.now() + duration;

        (function frame() {
            confetti({
                particleCount: 3,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#bb0000', '#ffffff']
            });
            confetti({
                particleCount: 3,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#bb0000', '#ffffff']
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    }, []);
    return null;
}
