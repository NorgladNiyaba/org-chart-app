import { useEffect } from "react";

/**
 * Plexa One section reveal: each block fades in and staggers its children 55ms
 * apart.
 *
 * State is written to `data-visible` rather than a class. React owns `className`
 * on these elements and rewrites it whenever a layout class changes — a `visible`
 * class added here would be silently wiped on the next render, leaving the block
 * permanently transparent but still clickable.
 *
 * Anything already on screen is revealed on the next animation frame rather than
 * waiting for the IntersectionObserver callback, which can lag on a busy load.
 * Children that appear inside an already-revealed block are shown immediately —
 * they are the result of an interaction, not a page entry, so they don't stagger.
 */
export function useReveal(deps = []) {
  useEffect(() => {
    const timers = [];

    const revealChildren = (block, stagger) => {
      block.querySelectorAll(".reveal-child:not([data-visible])").forEach((child, index) => {
        if (!stagger) {
          child.dataset.visible = "true";
          return;
        }
        timers.push(
          window.setTimeout(() => {
            child.dataset.visible = "true";
          }, index * 55)
        );
      });
    };

    // Catch up any children that appeared inside a block already shown.
    document
      .querySelectorAll(".reveal[data-visible]")
      .forEach((block) => revealChildren(block, false));

    const pending = Array.from(document.querySelectorAll(".reveal:not([data-visible])"));
    if (!pending.length) {
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    }

    const show = (block) => {
      if (block.dataset.visible) return;
      block.dataset.visible = "true";
      revealChildren(block, true);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          show(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.05 }
    );

    pending.forEach((block) => observer.observe(block));

    const frame = window.requestAnimationFrame(() => {
      pending.forEach((block) => {
        if (block.getBoundingClientRect().top < window.innerHeight) {
          show(block);
          observer.unobserve(block);
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
