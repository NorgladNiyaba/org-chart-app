import { useRef, useState } from "react";
import { CARD, HIDDEN_BADGE } from "../lib/chart/layout.js";
import { ICON_PATHS } from "../lib/chart/roleIcons.js";
import { colorsFor, PAPER } from "../lib/chart/palette.js";
import { FONT_STACK } from "../lib/chart/text.js";
import { searchTextFor } from "../lib/chart/model.js";

/**
 * Draws the geometry produced by computeLayout.
 *
 * Deliberately plain SVG — no CSS classes on the drawing itself, every value
 * inline — because the PDF writer walks this same element and CSS it can't
 * resolve would silently drop out of the export.
 *
 * All interaction is opt-in via `interactive`. The export renders this component
 * with interaction off, so selection rings and collapse buttons never print;
 * the "+N more" marker on a collapsed card does print, because omitting people
 * from a chart without saying so would be worse than a little extra ink.
 */

const DIMMED = 0.22;

/** Vertical centre of a line box, expressed as a text baseline. */
const baselineY = (top, index, spec) =>
  top + index * spec.lh + (spec.lh + spec.size * 0.72) / 2;

function IconGlyph({ name, x, y, size, color }) {
  const paths = ICON_PATHS[name] || ICON_PATHS.person;
  const glyph = size * 0.55;
  const scale = glyph / 24;
  const offset = (size - glyph) / 2;

  return (
    <g
      transform={`translate(${x + offset} ${y + offset}) scale(${scale})`}
      fill="none"
      stroke={color}
      strokeWidth={1.5 / scale}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d, index) => (
        <path key={index} d={d} />
      ))}
    </g>
  );
}

function HiddenBadge({ x, y, count, color }) {
  return (
    <text
      x={x}
      y={baselineY(y, 0, HIDDEN_BADGE)}
      textAnchor="middle"
      fontFamily={FONT_STACK}
      fontSize={HIDDEN_BADGE.size}
      fontWeight={HIDDEN_BADGE.weight}
      fill={color}
    >
      {`+${count} more not shown`}
    </text>
  );
}

function RootCard({ card, colors }) {
  const spec = CARD.root;
  const { primary, secondary } = card.lines;

  const textHeight =
    primary.length * spec.primary.lh +
    (secondary.length ? 4 + secondary.length * spec.secondary.lh : 0) +
    (card.hiddenCount ? HIDDEN_BADGE.gap + HIDDEN_BADGE.lh : 0);
  const textTop = card.y + (card.height - textHeight) / 2;
  const textX = card.x + spec.pad + spec.iconSize + spec.iconGap;
  const secondaryTop = textTop + primary.length * spec.primary.lh + 4;

  return (
    <>
      <rect
        x={card.x}
        y={card.y}
        width={card.width}
        height={card.height}
        rx={spec.radius}
        fill={colors.surface}
      />
      <rect
        x={card.x + spec.pad}
        y={card.y + (card.height - spec.iconSize) / 2}
        width={spec.iconSize}
        height={spec.iconSize}
        rx={9}
        fill={colors.tileFill}
        stroke={colors.tileStroke}
        strokeWidth={1}
      />
      <IconGlyph
        name={card.icon}
        x={card.x + spec.pad}
        y={card.y + (card.height - spec.iconSize) / 2}
        size={spec.iconSize}
        color={colors.tileIcon}
      />

      {primary.map((line, index) => (
        <text
          key={`p${index}`}
          x={textX}
          y={baselineY(textTop, index, spec.primary)}
          fontFamily={FONT_STACK}
          fontSize={spec.primary.size}
          fontWeight={spec.primary.weight}
          fill={colors.primaryText}
        >
          {line}
        </text>
      ))}

      {secondary.map((line, index) => (
        <text
          key={`s${index}`}
          x={textX}
          y={baselineY(secondaryTop, index, spec.secondary)}
          fontFamily={FONT_STACK}
          fontSize={spec.secondary.size}
          fontWeight={spec.secondary.weight}
          fill={colors.secondaryText}
        >
          {line}
        </text>
      ))}

      {card.hiddenCount > 0 && (
        <HiddenBadge
          x={card.x + card.width / 2}
          y={
            secondaryTop +
            secondary.length * spec.secondary.lh +
            HIDDEN_BADGE.gap
          }
          count={card.hiddenCount}
          color={colors.secondaryText}
        />
      )}
    </>
  );
}

function BranchCard({ card, colors }) {
  const spec = CARD.branch;
  const { primary, secondary } = card.lines;
  const centreX = card.x + card.width / 2;
  const textTop = card.y + spec.pad + spec.iconSize + spec.iconGap;
  const secondaryTop = textTop + primary.length * spec.primary.lh + 3;

  return (
    <>
      <rect
        x={card.x}
        y={card.y}
        width={card.width}
        height={card.height}
        rx={spec.radius}
        fill={colors.surface}
        stroke={colors.edge}
        strokeWidth={1.25}
      />
      <rect
        x={centreX - spec.iconSize / 2}
        y={card.y + spec.pad}
        width={spec.iconSize}
        height={spec.iconSize}
        rx={9}
        fill={colors.tileFill}
        stroke={colors.tileStroke}
        strokeWidth={1}
      />
      <IconGlyph
        name={card.icon}
        x={centreX - spec.iconSize / 2}
        y={card.y + spec.pad}
        size={spec.iconSize}
        color={colors.tileIcon}
      />

      {primary.map((line, index) => (
        <text
          key={`p${index}`}
          x={centreX}
          y={baselineY(textTop, index, spec.primary)}
          textAnchor="middle"
          fontFamily={FONT_STACK}
          fontSize={spec.primary.size}
          fontWeight={spec.primary.weight}
          fill={colors.primaryText}
        >
          {line}
        </text>
      ))}

      {secondary.map((line, index) => (
        <text
          key={`s${index}`}
          x={centreX}
          y={baselineY(secondaryTop, index, spec.secondary)}
          textAnchor="middle"
          fontFamily={FONT_STACK}
          fontSize={spec.secondary.size}
          fontWeight={spec.secondary.weight}
          fill={colors.secondaryText}
        >
          {line}
        </text>
      ))}

      {card.hiddenCount > 0 && (
        <HiddenBadge
          x={centreX}
          y={secondaryTop + secondary.length * spec.secondary.lh + HIDDEN_BADGE.gap}
          count={card.hiddenCount}
          color={colors.secondaryText}
        />
      )}
    </>
  );
}

function TeamCard({ card, colors }) {
  const spec = CARD.team;
  const heading = card.lines.heading;
  const centreX = card.x + card.width / 2;
  const headingTop = card.y + spec.pad;

  // Stack the members up front rather than accumulating during render.
  const membersTop = headingTop + heading.length * spec.heading.lh + spec.headingGap;
  const tops = [];
  card.members.reduce((offset, member) => {
    tops.push(offset);
    return offset + member.height + spec.memberGap;
  }, membersTop);

  return (
    <>
      <rect
        x={card.x}
        y={card.y}
        width={card.width}
        height={card.height}
        rx={spec.radius}
        fill={colors.surface}
        stroke={colors.edge}
        strokeWidth={1.25}
      />

      {heading.map((line, index) => (
        <text
          key={`h${index}`}
          x={centreX}
          y={baselineY(headingTop, index, spec.heading)}
          textAnchor="middle"
          fontFamily={FONT_STACK}
          fontSize={spec.heading.size}
          fontWeight={spec.heading.weight}
          fill={colors.ink}
        >
          {line}
        </text>
      ))}

      {card.members.map((member, memberIndex) => {
        const top = tops[memberIndex];
        const textX = card.x + spec.pad + spec.bulletInset;

        return (
          <g key={member.id}>
            <circle
              cx={card.x + spec.pad + 3}
              cy={top + spec.member.lh / 2}
              r={2}
              fill={colors.mark}
            />
            {member.nameLines.map((line, index) => (
              <text
                key={`n${index}`}
                x={textX}
                y={baselineY(top, index, spec.member)}
                fontFamily={FONT_STACK}
                fontSize={spec.member.size}
                fontWeight={spec.member.weight}
                fill={PAPER.ink}
              >
                {line}
              </text>
            ))}
            {member.titleLines.map((line, index) => (
              <text
                key={`t${index}`}
                x={textX}
                y={baselineY(
                  top + member.nameLines.length * spec.member.lh,
                  index,
                  spec.memberTitle
                )}
                fontFamily={FONT_STACK}
                fontSize={spec.memberTitle.size}
                fontWeight={spec.memberTitle.weight}
                fill={PAPER.ink2}
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </>
  );
}

function CollapseToggle({ card, colors, collapsed, onToggle }) {
  const cx = card.x + card.width / 2;
  const cy = card.y + card.height;

  return (
    <g
      style={{ cursor: "pointer" }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(card.id);
      }}
    >
      <circle cx={cx} cy={cy} r={8} fill={PAPER.bg} stroke={colors.mark} strokeWidth={1.25} />
      <path
        d={collapsed ? `M${cx - 3.5},${cy}H${cx + 3.5}M${cx},${cy - 3.5}V${cy + 3.5}` : `M${cx - 3.5},${cy}H${cx + 3.5}`}
        stroke={colors.mark}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </g>
  );
}

function ChartSvg({
  layout,
  palette,
  scale = 1,
  className = "",
  interactive = false,
  selectedId = null,
  onSelect,
  onToggleCollapse,
  onReparent,
  canDrop,
  searchQuery = "",
}) {
  const svgRef = useRef(null);
  /**
   * The gesture lives in a ref, not state: pointerdown and pointerup can both
   * land before React commits a re-render, and a handler reading stale state
   * would drop the click entirely. State only mirrors what needs drawing.
   */
  const gesture = useRef(null);
  const [drag, setDrag] = useState(null);

  const { cards, connectors, width, height } = layout;
  if (!cards.length) return null;

  const query = searchQuery.trim().toLowerCase();
  const matches = (card) => !query || searchTextFor(card).includes(query);

  const toLayoutPoint = (event) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    return { x: point.x, y: point.y };
  };

  const cardAt = (point) =>
    cards.find(
      (card) =>
        point.x >= card.x &&
        point.x <= card.x + card.width &&
        point.y >= card.y &&
        point.y <= card.y + card.height
    );

  /**
   * The top card can be selected but not dragged — it has no manager to change,
   * and pulling the whole organisation under one of its own reports is never
   * what someone meant to do.
   */
  const isDraggable = (card) => Boolean(onReparent) && card.variant !== "root";

  const handlePointerDown = (card) => (event) => {
    if (!interactive || event.button !== 0) return;

    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = toLayoutPoint(event);
    gesture.current = {
      card,
      origin: point,
      point,
      targetId: null,
      moved: false,
      draggable: isDraggable(card),
    };
  };

  const handlePointerMove = (event) => {
    const current = gesture.current;
    if (!current || !current.draggable) return;

    const point = toLayoutPoint(event);
    if (!point) return;

    const distance = Math.hypot(point.x - current.origin.x, point.y - current.origin.y);
    const moved = current.moved || distance > 6;
    if (!moved) return;

    const hovered = cardAt(point);
    const valid =
      hovered &&
      hovered.id !== current.card.id &&
      (!canDrop || canDrop(current.card, hovered));

    gesture.current = { ...current, point, moved, targetId: valid ? hovered.id : null };
    setDrag(gesture.current);
  };

  const handlePointerUp = () => {
    const current = gesture.current;
    gesture.current = null;
    setDrag(null);
    if (!current) return;

    if (current.moved) {
      if (current.targetId) {
        const target = cards.find((card) => card.id === current.targetId);
        if (target) onReparent?.(current.card, target);
      }
      return;
    }

    onSelect?.(current.card);
  };

  const handlePointerCancel = () => {
    gesture.current = null;
    setDrag(null);
  };

  return (
    <svg
      ref={svgRef}
      className={className}
      width={width * scale}
      height={height * scale}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Organisational chart"
      onPointerMove={interactive ? handlePointerMove : undefined}
      onPointerUp={interactive ? handlePointerUp : undefined}
      onPointerCancel={interactive ? handlePointerCancel : undefined}
    >
      <rect x="0" y="0" width={width} height={height} fill={PAPER.bg} />

      <g fill="none" stroke={PAPER.line} strokeWidth={1.25} strokeLinecap="round">
        {connectors.map((d, index) => (
          <path key={index} d={d} />
        ))}
      </g>

      {cards.map((card) => {
        const colors = colorsFor(card, palette);
        const dimmed = !matches(card);
        const isSelected = interactive && card.id === selectedId;
        const isDragging = drag?.moved && drag.card.id === card.id;
        const isTarget = drag?.targetId === card.id;

        return (
          <g
            key={card.id}
            opacity={isDragging ? 0.35 : dimmed ? DIMMED : 1}
            style={interactive ? { cursor: drag?.moved ? "grabbing" : "pointer" } : undefined}
            onPointerDown={interactive ? handlePointerDown(card) : undefined}
          >
            {(isSelected || isTarget) && (
              <rect
                x={card.x - 4}
                y={card.y - 4}
                width={card.width + 8}
                height={card.height + 8}
                rx={(card.kind === "team" ? CARD.team.radius : CARD.branch.radius) + 4}
                fill="none"
                stroke={isTarget ? colors.mark : colors.mark}
                strokeWidth={2}
                strokeDasharray={isTarget ? "5 4" : undefined}
              />
            )}

            {card.kind === "team" ? (
              <TeamCard card={card} colors={colors} />
            ) : card.variant === "root" ? (
              <RootCard card={card} colors={colors} />
            ) : (
              <BranchCard card={card} colors={colors} />
            )}

            {interactive &&
              card.kind !== "team" &&
              (card.hasChildren || card.hiddenCount > 0) && (
                <CollapseToggle
                  card={card}
                  colors={colors}
                  collapsed={card.hiddenCount > 0}
                  onToggle={onToggleCollapse}
                />
              )}
          </g>
        );
      })}

      {drag?.moved && (
        <line
          x1={drag.card.x + drag.card.width / 2}
          y1={drag.card.y + drag.card.height / 2}
          x2={drag.point.x}
          y2={drag.point.y}
          stroke={PAPER.ink2}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          pointerEvents="none"
        />
      )}
    </svg>
  );
}

export default ChartSvg;
