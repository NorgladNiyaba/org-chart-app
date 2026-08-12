import { useEffect, useMemo, useRef, useState } from "react";
import { buildChartModel } from "../lib/chart/model.js";
import { computeLayout } from "../lib/chart/layout.js";
import { readCategoryPalette } from "../lib/chart/palette.js";
import { whenFontsReady } from "../lib/chart/text.js";

const EMPTY = { cards: [], connectors: [], width: 0, height: 0 };

/** cardId → every card id beneath it, used to reject cyclic drops. */
function collectDescendants(cards) {
  const map = new Map();

  const walk = (card) => {
    const ids = new Set();
    card.children.forEach((child) => {
      ids.add(child.id);
      walk(child).forEach((id) => ids.add(id));
    });
    map.set(card.id, ids);
    return ids;
  };

  cards.forEach(walk);
  return map;
}

/**
 * Card sizes come from measuring real text, so the layout has to be recomputed
 * once Inter has actually loaded — measuring against a fallback face would size
 * every card slightly wrong.
 */
export function useChartLayout(roots, { groupTeams, roleFirst, overrides, collapsed }) {
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    whenFontsReady().then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const palette = useMemo(() => readCategoryPalette(), []);

  const model = useMemo(
    () =>
      roots.length
        ? buildChartModel(roots, { groupTeams, roleFirst, overrides, collapsed })
        : [],
    [roots, groupTeams, roleFirst, overrides, collapsed]
  );

  const layout = useMemo(() => {
    if (!model.length) return EMPTY;
    return computeLayout(model);
    // fontsReady is a genuine input: it changes what measureText returns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, fontsReady]);

  const descendants = useMemo(() => collectDescendants(model), [model]);

  return { model, layout, palette, descendants, fontsReady };
}

/** Tracks a container's content width so the chart can be scaled to fit it. */
export function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });

    observer.observe(element);
    setWidth(element.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
