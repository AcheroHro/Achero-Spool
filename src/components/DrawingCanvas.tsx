import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { Stage, Layer, Line, Rect, Circle, Group, Text, Label, Tag, Image as KonvaImage } from "react-konva";
import { Html } from "react-konva-utils";
import useImage from "use-image";
import { useStore, DrawingElement, Point, COTAS_LAYER_ID } from "../store/useStore";
import { nanoid } from "nanoid";
import {
  Check,
  X,
  Combine,
  Grid,
  Layers,
  Trash2,
  RotateCcw,
  RotateCw,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Pencil,
  MoreVertical,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const GRID_SIZE = 5;
const PIPE_STROKE_WIDTH = 1.25;
const PIPE_HIT_STROKE_WIDTH = 14;
const ACCESSORY_BASE_SIZE = 30;
const VALVE_BASE_SIZE = 60;

// Helper to calculate label text consistently
const getPipeLabel = (points: number[], diameter: number) => {
  const dx = points[2] - points[0];
  const dy = points[3] - points[1];
  const lengthPixels = Math.sqrt(dx * dx + dy * dy);
  const mm = lengthPixels * 50; // 20px = 1000mm
  return `${mm.toFixed(0)}mm (${diameter}")`;
};

interface DimensionLabelProps {
  el: DrawingElement;
  pipeNum?: number;
  isSelected: boolean;
  currentTool: string;
  onUpdateOffset: (id: string, offset: Point) => void;
  onSelect: (id: string, lengthMm: string) => void;
  scale: number;
  onLabelClick?: (elementId: string) => void;
  isOverlapping?: boolean;
}

const DimensionLabel = React.memo<DimensionLabelProps>(
  ({
    el,
    pipeNum,
    isSelected,
    currentTool,
    onUpdateOffset,
    onSelect,
    scale,
    onLabelClick,
    isOverlapping,
  }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState("");

    if (!el.points) return null;
    const [x1, y1, x2, y2] = el.points;

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    // Normal vector
    const nx = -dy / len;
    const ny = dx / len;

    // Direction vector
    const ux = dx / len;
    const uy = dy / len;

    const dimOffset = el.labelOffset || { x: nx * 40, y: ny * 40 };
    const labelX = midX + dimOffset.x;
    const labelY = midY + dimOffset.y;

    // Points on the dimension line (offset from the pipe)
    // Witness lines go from pipe to dimension line
    const dimX1 = x1 + nx * 30; // Standardize distance
    const dimY1 = y1 + ny * 30;
    const dimX2 = x2 + nx * 30;
    const dimY2 = y2 + ny * 30;
    const dimMidX = (dimX1 + dimX2) / 2;
    const dimMidY = (dimY1 + dimY2) / 2;

    // Wait for text calculation
    const currentLengthMm = (len * 50).toFixed(0);
    const isCustom = !!el.customLabels?.main;
    const labelText = isCustom
      ? pipeNum
        ? `#${pipeNum}: ${el.customLabels!.main}`
        : el.customLabels!.main
      : pipeNum
        ? `#${pipeNum}: ${el.label}`
        : el.label;

    // Calculate rotation to keep text upright
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;

    // Visual constants
    const arrowSize = Math.max(5, 10 / scale);
    const tickSize = Math.max(4, 7 / scale);
    const dimLineStrokeWidth = Math.max(1.2, 2.2 / scale);
    const witnessStrokeWidth = Math.max(0.4, 0.7 / scale);

    return (
      <Group>
        {/* Witness Lines */}
        <Line
          points={[x1, y1, dimX1, dimY1]}
          stroke="#495057"
          strokeWidth={witnessStrokeWidth}
          opacity={0.5}
          dash={[2 / scale, 3 / scale]}
        />
        <Line
          points={[x2, y2, dimX2, dimY2]}
          stroke="#495057"
          strokeWidth={witnessStrokeWidth}
          opacity={0.5}
          dash={[2 / scale, 3 / scale]}
        />

        {/* Main Dimension Line */}
        <Line
          points={[dimX1, dimY1, dimX2, dimY2]}
          stroke={isSelected ? "#fcc419" : "#6c757d"}
          strokeWidth={dimLineStrokeWidth}
        />

        {/* Ticks at ends (often used in architectural/pipe drafting) */}
        <Line
          points={[
            dimX1 - (nx + ux) * tickSize,
            dimY1 - (ny + uy) * tickSize,
            dimX1 + (nx + ux) * tickSize,
            dimY1 + (ny + uy) * tickSize,
          ]}
          stroke={isSelected ? "#fcc419" : "#6c757d"}
          strokeWidth={dimLineStrokeWidth * 1.3}
        />
        <Line
          points={[
            dimX2 - (nx + ux) * tickSize,
            dimY2 - (ny + uy) * tickSize,
            dimX2 + (nx + ux) * tickSize,
            dimY2 + (ny + uy) * tickSize,
          ]}
          stroke={isSelected ? "#fcc419" : "#6c757d"}
          strokeWidth={dimLineStrokeWidth * 1.3}
        />

        {/* Leader line to label if it's offset from the center of the dimension line */}
        {Math.sqrt(
          Math.pow(labelX - dimMidX, 2) + Math.pow(labelY - dimMidY, 2),
        ) > 10 && (
          <Line
            points={[dimMidX, dimMidY, labelX, labelY]}
            stroke={isSelected ? "#fcc419" : "#6c757d"}
            strokeWidth={witnessStrokeWidth}
            dash={[2, 1]}
            opacity={0.8}
          />
        )}

        {/* Draggable Label Container */}
        <Label
          x={labelX}
          y={labelY}
          rotation={angle}
          draggable={currentTool === "select"}
          scaleX={isHovered ? 1.1 : 1}
          scaleY={isHovered ? 1.1 : 1}
          onDragStart={(e) => {
            e.cancelBubble = true;
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            const pos = e.target.position();
            const relX = pos.x - midX;
            const relY = pos.y - midY;

            // Snap distance from pipe (normal) and position along pipe (tangent)
            const distFromPipe = relX * nx + relY * ny;
            const distAlongPipe = relX * ux + relY * uy;

            const snappedFrom = Math.round(distFromPipe / 5) * 5;
            const snappedAlong = Math.round(distAlongPipe / 5) * 5;

            onUpdateOffset(el.id, {
              x: snappedFrom * nx + snappedAlong * ux,
              y: snappedFrom * ny + snappedAlong * uy,
            });
          }}
          onDblClick={(e) => {
            if (currentTool === "select") {
              e.cancelBubble = true;
              setIsEditing(true);
              setEditValue(isCustom ? (el.customLabels?.main || "") : currentLengthMm);
            }
          }}
          onDblTap={(e) => {
            if (currentTool === "select") {
              e.cancelBubble = true;
              setIsEditing(true);
              setEditValue(isCustom ? (el.customLabels?.main || "") : currentLengthMm);
            }
          }}
          onClick={(e) => {
            e.cancelBubble = true;
            if (onLabelClick) {
              onLabelClick(el.id);
            } else if (currentTool === "select" && !isEditing) {
              onSelect(el.id, currentLengthMm);
            }
          }}
          onMouseEnter={(e) => {
            setIsHovered(true);
            if (onLabelClick || currentTool === "select") {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = "pointer";
            }
          }}
          onMouseLeave={(e) => {
            setIsHovered(false);
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = "default";
          }}
        >
          {isEditing ? (
            <Html transform>
              <div className="absolute -translate-x-1/2 -translate-y-1/2">
                <input
                  type="text"
                  title="Editar valor"
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const store = useStore.getState();
                      if (editValue.trim() !== '') {
                        store.updateCustomLabel(el.id, 'main', editValue.trim());
                      } else {
                        store.updateCustomLabel(el.id, 'main', '');
                      }
                      setIsEditing(false);
                    } else if (e.key === 'Escape') {
                      setIsEditing(false);
                    }
                  }}
                  onBlur={() => setIsEditing(false)}
                  style={{
                    width: Math.max(60, editValue.length * 8 + 20) + 'px',
                    padding: '4px',
                    border: '2px solid #339af0',
                    borderRadius: '6px',
                    background: '#1a1c1e',
                    color: '#fff',
                    textAlign: 'center',
                    outline: 'none',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                />
              </div>
            </Html>
          ) : (
            <>
              <Tag
                fill="#1e2024"
                cornerRadius={4}
                stroke={
                  isHovered
                    ? "#fff"
                    : isOverlapping
                      ? "#f59f00"
                      : isCustom
                        ? "#20c997"
                        : isSelected
                          ? "#fcc419"
                          : "#495057"
                }
                strokeWidth={isHovered ? 2 : isOverlapping ? 2.5 : isCustom ? 2 : 1.5}
                dash={isOverlapping ? [2, 1] : isCustom ? [4, 2] : undefined}
                shadowBlur={isOverlapping ? 15 : isHovered ? 12 : isSelected ? 10 : 2}
                shadowColor={isOverlapping ? "#f59f00" : isHovered ? "#fff" : "black"}
                opacity={0.95}
              />
              <Text
                text={labelText}
                fill={
                  isHovered
                    ? "#fff"
                    : isOverlapping
                      ? "#f59f00"
                      : isCustom
                        ? "#20c997"
                        : isSelected
                          ? "#fcc419"
                          : "#fff"
                }
                padding={6}
                fontSize={12}
                fontStyle={
                  isSelected || isCustom || isOverlapping || isHovered ? "bold" : "normal"
                }
                align="center"
                verticalAlign="middle"
              />
            </>
          )}
        </Label>
      </Group>
    );
  },
);

DimensionLabel.displayName = "DimensionLabel";

const SimpleDimension: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lengthMm: number;
  color?: string;
  side?: number; // 1 or -1 for determining offset direction
  distance?: number;
  scale: number;
  customLabel?: string;
  onLabelEdit?: (newVal: string) => void;
  isOverlapping?: boolean;
  labelOffset?: Point;
  onUpdateOffset?: (offset: Point) => void;
  currentTool?: string;
}> = ({
  x1,
  y1,
  x2,
  y2,
  lengthMm,
  color = "#1098ad",
  side = 1,
  distance = 20,
  scale,
  customLabel,
  onLabelEdit,
  isOverlapping,
  labelOffset,
  onUpdateOffset,
  currentTool,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;

  const nx = -dy / len;
  const ny = dx / len;

  const ux = dx / len;
  const uy = dy / len;

  // Base position
  const dimP1 = { x: x1 + nx * distance * side, y: y1 + ny * distance * side };
  const dimP2 = { x: x2 + nx * distance * side, y: y2 + ny * distance * side };
  const midX = (dimP1.x + dimP2.x) / 2;
  const midY = (dimP1.y + dimP2.y) / 2;

  // Actual label position using offset if provided
  const offset = labelOffset || { x: nx * 5 * side, y: ny * 5 * side };
  const labelX = midX + offset.x;
  const labelY = midY + offset.y;

  let angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;

  const arrowSize = Math.max(4, 8 / scale);
  const dimLineStrokeWidth = Math.max(1, 1.8 / scale);
  const witnessStrokeWidth = Math.max(0.3, 0.5 / scale);

  return (
    <Group>
      {/* Witness lines */}
      <Line
        points={[x1, y1, dimP1.x, dimP1.y]}
        stroke="#495057"
        strokeWidth={witnessStrokeWidth}
        opacity={0.6}
        dash={[1 / scale, 2 / scale]}
      />
      <Line
        points={[x2, y2, dimP2.x, dimP2.y]}
        stroke="#495057"
        strokeWidth={witnessStrokeWidth}
        opacity={0.6}
        dash={[1 / scale, 2 / scale]}
      />

      {/* Dimension Line */}
      <Line
        points={[dimP1.x, dimP1.y, dimP2.x, dimP2.y]}
        stroke={color}
        strokeWidth={dimLineStrokeWidth}
      />

      {/* Leader line if text is offset from dimension line */}
      {Math.sqrt(offset.x * offset.x + offset.y * offset.y) > 10 && (
        <Line
          points={[midX, midY, labelX, labelY]}
          stroke={color}
          strokeWidth={witnessStrokeWidth}
          dash={[2, 1]}
          opacity={0.5}
        />
      )}

      {/* Filled Arrows */}
      <Line
        points={[
          dimP1.x,
          dimP1.y,
          dimP1.x + ux * arrowSize + ((nx * arrowSize) / 2.5) * side,
          dimP1.y + uy * arrowSize + ((ny * arrowSize) / 2.5) * side,
          dimP1.x + ux * arrowSize - ((nx * arrowSize) / 2.5) * side,
          dimP1.y + uy * arrowSize - ((ny * arrowSize) / 2.5) * side,
        ]}
        fill={color}
        closed={true}
      />
      <Line
        points={[
          dimP2.x,
          dimP2.y,
          dimP2.x - ux * arrowSize + ((nx * arrowSize) / 2.5) * side,
          dimP2.y - uy * arrowSize + ((ny * arrowSize) / 2.5) * side,
          dimP2.x - ux * arrowSize - ((nx * arrowSize) / 2.5) * side,
          dimP2.y - uy * arrowSize - ((ny * arrowSize) / 2.5) * side,
        ]}
        fill={color}
        closed={true}
      />

      <Label
        x={labelX}
        y={labelY}
        rotation={angle}
        draggable={currentTool === "select" && !!onUpdateOffset}
        scaleX={isHovered ? 1.15 : 1}
        scaleY={isHovered ? 1.15 : 1}
        onDragStart={(e) => {
          e.cancelBubble = true;
        }}
        onDragEnd={(e) => {
          e.cancelBubble = true;
          if (onUpdateOffset) {
            const pos = e.target.position();
            const relX = pos.x - midX;
            const relY = pos.y - midY;

            // Basic 5px snapping
            onUpdateOffset({
              x: Math.round(relX / 5) * 5,
              y: Math.round(relY / 5) * 5,
            });
          }
        }}
        onDblClick={(e) => {
          if (onLabelEdit && currentTool === "select") {
            e.cancelBubble = true;
            setIsEditing(true);
            setEditValue(customLabel || lengthMm.toFixed(0));
          }
        }}
        onDblTap={(e) => {
          if (onLabelEdit && currentTool === "select") {
            e.cancelBubble = true;
            setIsEditing(true);
            setEditValue(customLabel || lengthMm.toFixed(0));
          }
        }}
        onMouseEnter={(e) => {
          setIsHovered(true);
          if (onLabelEdit || (currentTool === "select" && onUpdateOffset)) {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = "pointer";
          }
        }}
        onMouseLeave={(e) => {
          setIsHovered(false);
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = "default";
        }}
      >
        {isEditing ? (
          <Html transform>
            <div className="absolute -translate-x-1/2 -translate-y-1/2">
              <input
                type="text"
                title="Editar valor"
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (onLabelEdit) {
                      onLabelEdit(editValue.trim());
                    }
                    setIsEditing(false);
                  } else if (e.key === 'Escape') {
                    setIsEditing(false);
                  }
                }}
                onBlur={() => setIsEditing(false)}
                style={{
                  width: Math.max(50, editValue.length * 8 + 16) + 'px',
                  padding: '2px',
                  border: `2px solid ${color}`,
                  borderRadius: '4px',
                  background: '#1a1c1e',
                  color: '#fff',
                  textAlign: 'center',
                  outline: 'none',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
              />
            </div>
          </Html>
        ) : (
          <>
            <Tag
              fill="#1a1c1e"
              stroke={
                isHovered
                  ? "#fff"
                  : isOverlapping
                    ? "#f59f00"
                    : customLabel
                      ? "#20c997"
                      : color
              }
              strokeWidth={isHovered ? 1.5 : isOverlapping ? 1.5 : customLabel ? 1 : 0.5}
              cornerRadius={2}
              dash={isOverlapping ? [1, 0.5] : customLabel ? [2, 1] : undefined}
              shadowBlur={isOverlapping ? 8 : isHovered ? 5 : 0}
              shadowColor={isOverlapping ? "#f59f00" : isHovered ? "#fff" : "transparent"}
              opacity={0.8}
            />
            <Text
              text={customLabel || `${lengthMm.toFixed(0)}`}
              fill={
                isHovered
                  ? "#fff"
                  : isOverlapping
                    ? "#f59f00"
                    : customLabel
                      ? "#20c997"
                      : color
              }
              padding={3}
              fontSize={8}
              fontStyle={isHovered || isOverlapping || customLabel ? "bold" : "normal"}
              align="center"
              verticalAlign="middle"
            />
          </>
        )}
      </Label>
    </Group>
  );
};

const SupportDimensions: React.FC<{
  support: DrawingElement;
  allElements: DrawingElement[];
  scale: number;
  overlappingLabels: Set<string>;
  currentTool: string;
}> = ({ support, allElements, scale, overlappingLabels, currentTool }) => {
  const updateCustomLabel = useStore((s) => s.updateCustomLabel);
  const updateElementLabelOffset = useStore((s) => s.updateElementLabelOffset);
  if (support.type !== "support" || !support.position) return null;
  const { x, y } = support.position;

  // Find the pipe this support is on
  const pipe = allElements.find((el) => {
    if (el.type !== "pipe" || !el.points) return false;
    const [px1, py1, px2, py2] = el.points;
    const dx = px2 - px1;
    const dy = py2 - py1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return false;
    let t = ((x - px1) * dx + (y - py1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const dist = Math.sqrt(
      Math.pow(x - (px1 + t * dx), 2) + Math.pow(y - (py1 + t * dy), 2),
    );
    return dist < 8;
  });

  if (!pipe || !pipe.points) return null;
  const [x1, y1, x2, y2] = pipe.points;

  // Find other supports on the same pipe to determine offset level
  const supportsOnSamePipe = allElements
    .filter((el) => el.type === "support" && el.position)
    .filter((s) => {
      const sp = s.position!;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const l2 = dx * dx + dy * dy;
      let t = ((sp.x - x1) * dx + (sp.y - y1) * dy) / l2;
      t = Math.max(0, Math.min(1, t));
      const d = Math.sqrt(
        Math.pow(sp.x - (x1 + t * dx), 2) + Math.pow(sp.y - (y1 + t * dy), 2),
      );
      return d < 8;
    });

  // Sort supports by distance from pipe start
  supportsOnSamePipe.sort((a, b) => {
    const da =
      Math.pow(a.position!.x - x1, 2) + Math.pow(a.position!.y - y1, 2);
    const db =
      Math.pow(b.position!.x - x2, 2) + Math.pow(b.position!.y - y2, 2);
    return da - db;
  });

  const myIndex = supportsOnSamePipe.findIndex((s) => s.id === support.id);
  const isLast = myIndex === supportsOnSamePipe.length - 1;

  // Staggering offsets to prevent overlapping labels on the same pipe
  // We alternate between levels to create space
  const offsetLevel = 25 + (myIndex % 2) * 15;

  const pipeMainOffset = pipe.labelOffset || { x: 0, y: 0 };
  const side = pipeMainOffset.x > 0 || pipeMainOffset.y > 0 ? -1 : 1;

  // Previous point for chaining
  const prevPoint =
    myIndex === 0
      ? { x: x1, y: y1 }
      : supportsOnSamePipe[myIndex - 1].position!;

  const distPrevMm =
    Math.sqrt(Math.pow(x - prevPoint.x, 2) + Math.pow(y - prevPoint.y, 2)) * 50;
  const distNextMm = isLast
    ? Math.sqrt(Math.pow(x - x2, 2) + Math.pow(y - y2, 2)) * 50
    : 0;

  return (
    <Group opacity={0.9}>
      {distPrevMm > 10 && (
        <SimpleDimension
          x1={prevPoint.x}
          y1={prevPoint.y}
          x2={x}
          y2={y}
          lengthMm={distPrevMm}
          color="#1098ad"
          side={side}
          distance={offsetLevel}
          scale={scale}
          customLabel={support.customLabels?.prev}
          onLabelEdit={(newVal) =>
            updateCustomLabel(support.id, "prev", newVal)
          }
          isOverlapping={overlappingLabels.has(`${support.id}-prev`)}
          labelOffset={support.labelOffsets?.prev}
          onUpdateOffset={(offset) =>
            updateElementLabelOffset(support.id, "prev", offset)
          }
          currentTool={currentTool}
        />
      )}
      {isLast && distNextMm > 10 && (
        <SimpleDimension
          x1={x}
          y1={y}
          x2={x2}
          y2={y2}
          lengthMm={distNextMm}
          color="#1098ad"
          side={side}
          distance={offsetLevel}
          scale={scale}
          customLabel={support.customLabels?.next}
          onLabelEdit={(newVal) =>
            updateCustomLabel(support.id, "next", newVal)
          }
          isOverlapping={overlappingLabels.has(`${support.id}-next`)}
          labelOffset={support.labelOffsets?.next}
          onUpdateOffset={(offset) =>
            updateElementLabelOffset(support.id, "next", offset)
          }
          currentTool={currentTool}
        />
      )}
    </Group>
  );
};

// Pipe Element wrapped in React.memo for performance
const PipeElement = React.memo<{
  el: DrawingElement;
  isSelected: boolean;
  isInGroup: boolean;
  isLocked: boolean;
  isCotasVisible: boolean;
  currentTool: string;
  pipeNum?: number;
  scale: number;
  overlappingLabels: Set<string>;
  selectedIds: string[];
  handleElementSelect: (id: string, shiftKey: boolean) => void;
  moveElements: (ids: string[], dx: number, dy: number) => void;
  onUpdateOffset: (id: string, offset: Point) => void;
  handlePointDrag: (id: string, pointIndex: 0 | 1, newPoint: Point) => void;
  snapPoint: (p: Point, excludeId?: string) => Point;
}>(({
  el, isSelected, isInGroup, isLocked, isCotasVisible, currentTool,
  pipeNum, scale, overlappingLabels, selectedIds, handleElementSelect, moveElements,
  onUpdateOffset, handlePointDrag, snapPoint
}) => {
  if (!el.points) return null;
  const [x1, y1, x2, y2] = el.points;

  return (
    <Group key={el.id}>
      <Group
        draggable={currentTool === "select" && !isLocked}
        onDragMove={(e) => {
          if (!isSelected || isLocked) return;
        }}
        onDragStart={() => {
          if (!isSelected && !isLocked) {
            handleElementSelect(el.id, false);
          }
        }}
        onDragEnd={(e) => {
          if (isLocked) return;
          const group = e.target;
          const snapped = snapPoint(group.position(), el.id);
          const dx = snapped.x;
          const dy = snapped.y;

          moveElements(selectedIds, dx, dy);
          group.position({ x: 0, y: 0 });
        }}
        onClick={(e) => {
          if (currentTool === "select" && !isLocked) {
            handleElementSelect(el.id, e.evt.shiftKey);
          }
        }}
      >
        <Line
          points={el.points}
          stroke={isSelected ? "#fcc419" : "#4dabf7"}
          strokeWidth={PIPE_STROKE_WIDTH}
          hitStrokeWidth={PIPE_HIT_STROKE_WIDTH}
          lineCap="round"
          lineJoin="round"
          shadowColor="black"
          shadowBlur={isSelected ? 10 : isInGroup ? 5 : 0}
          shadowOpacity={isInGroup ? 0.3 : 0.5}
          opacity={isLocked ? 0.6 : 1}
        />
        {isCotasVisible && (
          <DimensionLabel
            el={el}
            pipeNum={pipeNum}
            isSelected={isSelected}
            currentTool={currentTool}
            onUpdateOffset={onUpdateOffset}
            onSelect={(id, len) => !isLocked && handleElementSelect(id, false)}
            scale={scale}
            isOverlapping={overlappingLabels.has(`${el.id}-main`)}
          />
        )}
      </Group>

      {/* Handles for resizing */}
      {isSelected && currentTool === "select" && !isInGroup && !isLocked && (
        <Group>
          <Circle
            x={x1}
            y={y1}
            radius={6}
            fill="#fff"
            stroke="#fcc419"
            strokeWidth={2}
            draggable
            onDragMove={(e) => {
              const pos = e.target.position();
              handlePointDrag(el.id, 0, snapPoint(pos, el.id));
            }}
            onDragEnd={(e) =>
              e.target.position({ x: el.points![0], y: el.points![1] })
            }
          />
          <Circle
            x={x2}
            y={x2 === x1 && y2 === y1 ? y1 + 10 : y2}
            radius={6}
            fill="#fff"
            stroke="#fcc419"
            strokeWidth={2}
            draggable
            onDragMove={(e) => {
              const pos = e.target.position();
              handlePointDrag(el.id, 1, snapPoint(pos, el.id));
            }}
            onDragEnd={(e) =>
              e.target.position({ x: el.points![2], y: el.points![3] })
            }
          />
        </Group>
      )}
    </Group>
  );
});

// Node Element wrapped in React.memo for performance
const NodeElement = React.memo<{
  el: DrawingElement;
  isSelected: boolean;
  isInGroup: boolean;
  isLocked: boolean;
  isCotasVisible: boolean;
  currentTool: string;
  scale: number;
  overlappingLabels: Set<string>;
  selectedIds: string[];
  elements: DrawingElement[];
  images: Record<string, HTMLImageElement | undefined>;
  handleElementSelect: (id: string, shiftKey: boolean) => void;
  moveElements: (ids: string[], dx: number, dy: number) => void;
  snapPoint: (p: Point, excludeId?: string) => Point;
}>(({
  el, isSelected, isInGroup, isLocked, isCotasVisible, currentTool,
  scale, overlappingLabels, selectedIds, elements, images,
  handleElementSelect, moveElements, snapPoint
}) => {
  if (!el.position) return null;

  const baseSize =
    el.type === "accessory"
      ? el.accessoryType === "valve"
        ? VALVE_BASE_SIZE
        : ACCESSORY_BASE_SIZE
      : 8 + (el.diameter || 2) * 2;

  const {
    codoImg, codo45Img, teeImg, teeRedImg, reducexcImg,
    valvulaImg, bridaImg, reducerImg, supportImg
  } = images;

  return (
    <Group key={el.id}>
      {el.type === "support" && isCotasVisible && (
        <SupportDimensions
          support={el}
          allElements={elements}
          scale={scale}
          overlappingLabels={overlappingLabels}
          currentTool={currentTool}
        />
      )}
      <Group
        x={el.position.x}
        y={el.position.y}
        rotation={el.rotation || 0}
        draggable={currentTool === "select" && !isLocked}
        onDragStart={() => {
          if (!isSelected && !isLocked) {
            handleElementSelect(el.id, false);
          }
        }}
        onDragEnd={(e) => {
          if (isLocked) return;
          const pos = e.target.position();
          const snapped = snapPoint(pos, el.id);
          const dx = snapped.x - el.position!.x;
          const dy = snapped.y - el.position!.y;

          moveElements(selectedIds, dx, dy);
          e.target.position({
            x: el.position!.x,
            y: el.position!.y,
          }); // Store will update it
        }}
        onClick={(e) => {
          if (currentTool === "select" && !isLocked) {
            handleElementSelect(el.id, e.evt.shiftKey);
          }
        }}
      >
        {/* Accessory visual representation */}
        {el.type === "accessory" && el.accessoryType === "elbow" && (
          codoImg ? (
            <Group opacity={isLocked ? 0.6 : 1}>
              {isSelected && (
                <Rect x={-baseSize / 2 - 2} y={-baseSize / 2 - 2} width={baseSize + 4} height={baseSize + 4} stroke="#fff" strokeWidth={2} dash={[4, 4]} />
              )}
              <KonvaImage image={codoImg} x={-baseSize / 2} y={-baseSize / 2} width={baseSize} height={baseSize} cornerRadius={4} />
            </Group>
          ) : (
            <Group opacity={isLocked ? 0.6 : 1}>
              <Circle radius={baseSize / 2} fill={isSelected ? "#fff" : "#ffc107"} stroke="#000" strokeWidth={1} />
              <Line points={[0, 0, baseSize / 2, 0]} stroke="#000" strokeWidth={1} />
              <Line points={[0, 0, 0, -baseSize / 2]} stroke="#000" strokeWidth={1} />
            </Group>
          )
        )}
        {el.type === "accessory" && el.accessoryType === "elbow45" && (
          codo45Img ? (
            <Group opacity={isLocked ? 0.6 : 1}>
              {isSelected && (
                <Rect x={-baseSize / 2 - 2} y={-baseSize / 2 - 2} width={baseSize + 4} height={baseSize + 4} stroke="#fff" strokeWidth={2} dash={[4, 4]} />
              )}
              <KonvaImage image={codo45Img} x={-baseSize / 2} y={-baseSize / 2} width={baseSize} height={baseSize} cornerRadius={4} />
            </Group>
          ) : (
            <Group opacity={isLocked ? 0.6 : 1}>
              <Circle radius={baseSize / 2} fill={isSelected ? "#fff" : "#ffc107"} stroke="#000" strokeWidth={1} />
              <Line points={[0, 0, baseSize / 3, -baseSize / 3]} stroke="#000" strokeWidth={2} />
            </Group>
          )
        )}
        {el.type === "accessory" && el.accessoryType === "tee" && (
          teeImg ? (
            <Group opacity={isLocked ? 0.6 : 1}>
              {isSelected && (
                <Rect x={-baseSize / 2 - 2} y={-baseSize / 2 - 2} width={baseSize + 4} height={baseSize + 4} stroke="#fff" strokeWidth={2} dash={[4, 4]} />
              )}
              <KonvaImage image={teeImg} x={-baseSize / 2} y={-baseSize / 2} width={baseSize} height={baseSize} cornerRadius={4} />
            </Group>
          ) : (
            <Group opacity={isLocked ? 0.6 : 1}>
              <Circle radius={baseSize * 0.4} fill={isSelected ? "#fff" : "#fd7e14"} stroke="#000" strokeWidth={1} />
              <Line points={[-baseSize / 2, 0, baseSize / 2, 0]} stroke="#000" strokeWidth={1.5} />
              <Line points={[0, 0, 0, -baseSize / 2]} stroke="#000" strokeWidth={1.5} />
            </Group>
          )
        )}
        {el.type === "accessory" && el.accessoryType === "teered" && (
          teeRedImg ? (
            <Group opacity={isLocked ? 0.6 : 1}>
              {isSelected && (
                <Rect x={-baseSize / 2 - 2} y={-baseSize / 2 - 2} width={baseSize + 4} height={baseSize + 4} stroke="#fff" strokeWidth={2} dash={[4, 4]} />
              )}
              <KonvaImage image={teeRedImg} x={-baseSize / 2} y={-baseSize / 2} width={baseSize} height={baseSize} cornerRadius={4} />
            </Group>
          ) : (
            <Group opacity={isLocked ? 0.6 : 1}>
              <Circle radius={baseSize * 0.4} fill={isSelected ? "#fff" : "#fd7e14"} stroke="#000" strokeWidth={1} />
              <Text text="R" x={-4} y={-6} fontSize={10} fill="#000" />
            </Group>
          )
        )}
        {el.type === "accessory" && el.accessoryType === "reducexc" && (
          reducexcImg ? (
            <Group opacity={isLocked ? 0.6 : 1}>
              {isSelected && (
                <Rect x={-baseSize / 2 - 2} y={-baseSize / 2 - 2} width={baseSize + 4} height={baseSize + 4} stroke="#fff" strokeWidth={2} dash={[4, 4]} />
              )}
              <KonvaImage image={reducexcImg} x={-baseSize / 2} y={-baseSize / 2} width={baseSize} height={baseSize} cornerRadius={4} />
            </Group>
          ) : (
            <Group opacity={isLocked ? 0.6 : 1}>
              <Circle radius={baseSize * 0.4} fill={isSelected ? "#fff" : "#ffc107"} stroke="#000" strokeWidth={1} />
              <Text text="RX" x={-6} y={-6} fontSize={10} fill="#000" />
            </Group>
          )
        )}
        {el.type === "accessory" && el.accessoryType === "valve" && (
          valvulaImg ? (
            <Group opacity={isLocked ? 0.6 : 1}>
              {isSelected && (
                <Rect x={-baseSize / 2 - 2} y={-baseSize / 2 - 2} width={baseSize + 4} height={baseSize + 4} stroke="#fff" strokeWidth={2} dash={[4, 4]} />
              )}
              <KonvaImage image={valvulaImg} x={-baseSize / 2} y={-baseSize / 2} width={baseSize} height={baseSize} cornerRadius={4} />
            </Group>
          ) : (
            <Group opacity={isLocked ? 0.6 : 1}>
              <Line points={[-baseSize / 2, -baseSize / 2, baseSize / 2, baseSize / 2]} stroke={isSelected ? "#fff" : "#fa5252"} strokeWidth={3} />
              <Line points={[-baseSize / 2, baseSize / 2, baseSize / 2, -baseSize / 2]} stroke={isSelected ? "#fff" : "#fa5252"} strokeWidth={3} />
              <Circle radius={baseSize / 4} fill="#1a1b1e" stroke="#fff" strokeWidth={0.5} />
            </Group>
          )
        )}
        {el.type === "accessory" && el.accessoryType === "flange" && (
          bridaImg ? (
            <Group opacity={isLocked ? 0.6 : 1}>
              {isSelected && (
                <Rect x={-baseSize / 2 - 2} y={-baseSize / 2 - 2} width={baseSize + 4} height={baseSize + 4} stroke="#fff" strokeWidth={2} dash={[4, 4]} />
              )}
              <KonvaImage image={bridaImg} x={-baseSize / 2} y={-baseSize / 2} width={baseSize} height={baseSize} cornerRadius={4} />
            </Group>
          ) : (
            <Group opacity={isLocked ? 0.6 : 1}>
              <Rect x={-1} y={-baseSize / 2} width={2} height={baseSize} fill={isSelected ? "#fff" : "#adb5bd"} stroke="#000" strokeWidth={0.5} />
              <Circle radius={baseSize * 0.1} x={0} y={-baseSize / 3} fill="#000" />
              <Circle radius={baseSize * 0.1} x={0} y={baseSize / 3} fill="#000" />
            </Group>
          )
        )}
        {el.type === "accessory" && el.accessoryType === "reducer" && (
          reducerImg ? (
            <Group opacity={isLocked ? 0.6 : 1}>
              {isSelected && (
                <Rect x={-baseSize / 2 - 2} y={-baseSize / 2 - 2} width={baseSize + 4} height={baseSize + 4} stroke="#fff" strokeWidth={2} dash={[4, 4]} />
              )}
              <KonvaImage image={reducerImg} x={-baseSize / 2} y={-baseSize / 2} width={baseSize} height={baseSize} cornerRadius={4} />
            </Group>
          ) : (
            <Line points={[-baseSize / 2, -baseSize / 2, baseSize / 2, -baseSize / 4, baseSize / 2, baseSize / 4, -baseSize / 2, baseSize / 2]} closed fill={isSelected ? "#fff" : "#845ef7"} stroke="#000" strokeWidth={1} opacity={isLocked ? 0.6 : 1} />
          )
        )}

        {/* Support visual representation */}
        {el.type === "support" && el.supportType === "fixed" && (
          supportImg ? (
            <Group opacity={isLocked ? 0.6 : 1}>
              {isSelected && (
                <Rect x={-baseSize / 2 - 2} y={-baseSize / 2 - 2} width={baseSize + 4} height={baseSize + 4} stroke="#fff" strokeWidth={2} dash={[4, 4]} />
              )}
              <KonvaImage image={supportImg} x={-baseSize / 2} y={-baseSize / 2} width={baseSize} height={baseSize} cornerRadius={4} />
            </Group>
          ) : (
            <Group opacity={isLocked ? 0.6 : 1}>
              <Rect x={-baseSize / 2} y={-baseSize / 2} width={baseSize} height={baseSize} fill={isSelected ? "#fff" : "#1098ad"} stroke="#000" strokeWidth={1} />
              <Line points={[-baseSize / 2, -baseSize / 2, baseSize / 2, baseSize / 2]} stroke="#000" strokeWidth={0.5} />
              <Line points={[baseSize / 2, -baseSize / 2, -baseSize / 2, baseSize / 2]} stroke="#000" strokeWidth={0.5} />
            </Group>
          )
        )}
        {el.type === "support" && el.supportType === "sliding" && (
          <Group opacity={isLocked ? 0.6 : 1}>
            <Circle radius={baseSize / 2} fill={isSelected ? "#fff" : "#20c997"} stroke="#000" strokeWidth={1} />
            <Line points={[-baseSize / 2, 0, baseSize / 2, 0]} stroke="#000" strokeWidth={1} />
          </Group>
        )}
        {el.type === "support" && el.supportType === "guide" && (
          <Group opacity={isLocked ? 0.6 : 1}>
            <Rect x={-baseSize / 2} y={-baseSize / 2} width={baseSize} height={baseSize} fill={isSelected ? "#fff" : "#f06595"} stroke="#000" strokeWidth={1} />
            <Line points={[-baseSize / 2, -baseSize / 4, baseSize / 2, -baseSize / 4]} stroke="#000" strokeWidth={0.5} />
            <Line points={[-baseSize / 2, baseSize / 4, baseSize / 2, baseSize / 4]} stroke="#000" strokeWidth={0.5} />
          </Group>
        )}
      </Group>
    </Group>
  );
});

export const DrawingCanvas: React.FC = () => {
  const [reducerImg] = useImage('/reducer-icon.png');
  const [bridaImg] = useImage('/brida-icon.png');
  const [supportImg] = useImage('/soporte-icon.png');
  const [valvulaImg] = useImage('/valvula-icon.png');
  const [codoImg] = useImage('/codo90-icon.png');
  const [codo45Img] = useImage('/codo45-icon.png');
  const [teeImg] = useImage('/te-icon.png');
  const [teeRedImg] = useImage('/tered-icon.png');
  const [reducexcImg] = useImage('/reducexc-icon.png');
  const {
    elements,
    currentTool,
    selectedAccessory,
    selectedSupport,
    currentDiameter,
    selectedId,
    selectedIds,
    addDiameter,
    addElement,
    updateElement,
    updatePipeLength,
    updateLabelOffset,
    setDiameter,
    setSelectedId,
    setSelectedIds,
    moveElements,
    rotateElements,
    groupElements,
    ungroupElements,
    deleteElement,
    scale,
    viewPos,
    notification,
    setNotification,
    layers,
    activeLayerId,
    addLayer,
    renameLayer,
    deleteLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    setActiveLayer,
    updateCustomLabel,
    updateElementLabelOffset,
  } = useStore();

  const isCotasVisible = useMemo(() => {
    return layers.find((l) => l.id === COTAS_LAYER_ID)?.visible !== false;
  }, [layers]);

  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [newLayerName, setNewLayerName] = useState("");

  const visibleElements = useMemo(() => {
    return elements.filter((el) => {
      const layer = layers.find(
        (l) => l.id === (el.layerId || "default-layer"),
      );
      return layer?.visible !== false;
    });
  }, [elements, layers]);

  // Collision detection for dimension labels
  const dimensionBoxes = useMemo(() => {
    const boxes: Array<{
      id: string;
      type: string;
      x: number;
      y: number;
      w: number;
      h: number;
      angle: number;
      elementId: string;
    }> = [];

    visibleElements.forEach((el) => {
      if (el.type === "pipe" && el.points) {
        const [x1, y1, x2, y2] = el.points;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;

        const dimOffset = el.labelOffset || { x: nx * 40, y: ny * 40 };
        const labelX = midX + dimOffset.x;
        const labelY = midY + dimOffset.y;
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;

        boxes.push({
          id: `${el.id}-main`,
          type: "pipe",
          x: labelX,
          y: labelY,
          w: 100,
          h: 20,
          angle,
          elementId: el.id,
        });
      }

      if (el.type === "support" && el.position) {
        const { x, y } = el.position;
        // Logic similar to SupportDimensions to calculate label positions
        const pipe = elements.find((p) => {
          if (p.type !== "pipe" || !p.points) return false;
          const [px1, py1, px2, py2] = p.points;
          const dx = px2 - px1;
          const dy = py2 - py1;
          const l2 = dx * dx + dy * dy;
          if (l2 === 0) return false;
          let t = ((x - px1) * dx + (y - py1) * dy) / l2;
          t = Math.max(0, Math.min(1, t));
          const dist = Math.sqrt(
            Math.pow(x - (px1 + t * dx), 2) + Math.pow(y - (py1 + t * dy), 2),
          );
          return dist < 8;
        });

        if (pipe && pipe.points) {
          const [px1, py1, px2, py2] = pipe.points;
          const supportsOnSamePipe = elements
            .filter((sel) => sel.type === "support" && sel.position)
            .filter((s) => {
              const sp = s.position!;
              const dx = px2 - px1;
              const dy = py2 - py1;
              const l2 = dx * dx + dy * dy;
              let t = ((sp.x - px1) * dx + (sp.y - py1) * dy) / l2;
              t = Math.max(0, Math.min(1, t));
              const d = Math.sqrt(
                Math.pow(sp.x - (px1 + t * dx), 2) +
                  Math.pow(sp.y - (py1 + t * dy), 2),
              );
              return d < 8;
            });

          supportsOnSamePipe.sort((a, b) => {
            const da =
              Math.pow(a.position!.x - px1, 2) +
              Math.pow(a.position!.y - py1, 2);
            const db =
              Math.pow(b.position!.x - px1, 2) +
              Math.pow(b.position!.y - py1, 2);
            return da - db;
          });

          const myIndex = supportsOnSamePipe.findIndex((s) => s.id === el.id);
          const isLast = myIndex === supportsOnSamePipe.length - 1;
          const offsetLevel = 25 + (myIndex % 2) * 15;
          const pipeMainOffset = pipe.labelOffset || { x: 0, y: 0 };
          const side = pipeMainOffset.x > 0 || pipeMainOffset.y > 0 ? -1 : 1;
          const pdx = px2 - px1;
          const pdy = py2 - py1;
          const plen = Math.sqrt(pdx * pdx + pdy * pdy) || 1;
          const pnx = -pdy / plen;
          const pny = pdx / plen;

          const prevPoint =
            myIndex === 0
              ? { x: px1, y: py1 }
              : supportsOnSamePipe[myIndex - 1].position!;
          const distPrevMm =
            Math.sqrt(
              Math.pow(x - prevPoint.x, 2) + Math.pow(y - prevPoint.y, 2),
            ) * 50;

          let angle = Math.atan2(pdy, pdx) * (180 / Math.PI);
          if (angle > 90) angle -= 180;
          if (angle < -90) angle += 180;

          if (distPrevMm > 10) {
            const lx = (prevPoint.x + x) / 2 + pnx * offsetLevel * side;
            const ly = (prevPoint.y + y) / 2 + pny * offsetLevel * side;
            boxes.push({
              id: `${el.id}-prev`,
              type: "support",
              x: lx,
              y: ly,
              w: 30,
              h: 12,
              angle,
              elementId: el.id,
            });
          }

          if (isLast) {
            const distNextMm =
              Math.sqrt(Math.pow(x - px2, 2) + Math.pow(y - py2, 2)) * 50;
            if (distNextMm > 10) {
              const lx = (x + px2) / 2 + pnx * offsetLevel * side;
              const ly = (y + py2) / 2 + pny * offsetLevel * side;
              boxes.push({
                id: `${el.id}-next`,
                type: "support",
                x: lx,
                y: ly,
                w: 30,
                h: 12,
                angle,
                elementId: el.id,
              });
            }
          }
        }
      }
    });

    return boxes;
  }, [visibleElements, elements]);

  const overlappingLabels = useMemo(() => {
    const overlaps = new Set<string>();
    for (let i = 0; i < dimensionBoxes.length; i++) {
      for (let j = i + 1; j < dimensionBoxes.length; j++) {
        const b1 = dimensionBoxes[i];
        const b2 = dimensionBoxes[j];

        // Simple distance-based circle check for performance, or AABB
        // Labels are small, so if centers are distance < (w+w)/2 + threshold, flag it
        const dist = Math.sqrt(
          Math.pow(b1.x - b2.x, 2) + Math.pow(b1.y - b2.y, 2),
        );
        const threshold = (Math.max(b1.w, b1.h) + Math.max(b2.w, b2.h)) / 2 + 5;

        if (dist < threshold) {
          overlaps.add(b1.id);
          overlaps.add(b2.id);
        }
      }
    }
    return overlaps;
  }, [dimensionBoxes]);

  const isLayerLocked = useCallback(
    (layerId?: string) => {
      const layer = layers.find((l) => l.id === (layerId || "default-layer"));
      return layer?.locked === true;
    },
    [layers],
  );

  const selectionBounds = useMemo(() => {
    if (selectedIds.length === 0) return null;
    const selectedElements = elements.filter((el) =>
      selectedIds.includes(el.id),
    );
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    selectedElements.forEach((el) => {
      if (el.type === "pipe" && el.points) {
        minX = Math.min(minX, el.points[0], el.points[2]);
        maxX = Math.max(maxX, el.points[0], el.points[2]);
        minY = Math.min(minY, el.points[1], el.points[3]);
        maxY = Math.max(maxY, el.points[1], el.points[3]);
      } else if (el.position) {
        minX = Math.min(minX, el.position.x);
        maxX = Math.max(maxX, el.position.x);
        minY = Math.min(minY, el.position.y);
        maxY = Math.max(maxY, el.position.y);
      }
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
  }, [selectedIds, elements]);

  const [stageSize, setStageSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [isDrawing, setIsDrawing] = useState(false);
  const [newPipe, setNewPipe] = useState<number[] | null>(null);
  const [editingLength, setEditingLength] = useState<string>("");
  const [editingPrev, setEditingPrev] = useState<string>("");
  const [editingNext, setEditingNext] = useState<string>("");

  const [selectionRect, setSelectionRect] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<Point | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const showError = useCallback(
    (msg: string) => {
      setNotification({ message: msg, type: "error" });
      setTimeout(() => setNotification(null), 3000);
    },
    [setNotification],
  );

  const selectedElement = elements.find((el) => el.id === selectedId);

  const handleUpdateLength = () => {
    if (selectedId && editingLength) {
      updateCustomLabel(selectedId, "main", editingLength.trim());
      setSelectedId(null);
      setSelectedIds([]);
      setEditingLength("");
    }
  };

  const handleUpdateSupportLabels = () => {
    if (selectedId && selectedElement?.type === "support") {
      updateElement(selectedId, {
        customLabels: {
          ...(selectedElement.customLabels || {}),
          prev: editingPrev,
          next: editingNext,
        },
      });
      setNotification({ message: "Dimensiones actualizadas", type: "success" });
      setTimeout(() => setNotification(null), 2000);
    }
  };

  const pipeNumbers = useMemo(() => {
    const map: Record<string, number> = {};
    const countByDiameter: Record<number, number> = {};

    elements.forEach((el) => {
      if (el.type === "pipe") {
        const d = el.diameter || 2;
        countByDiameter[d] = (countByDiameter[d] || 0) + 1;
        map[el.id] = countByDiameter[d];
      }
    });
    return map;
  }, [elements]);

  const onUpdateOffset = useCallback(
    (id: string, offset: Point) => {
      updateLabelOffset(id, offset);
    },
    [updateLabelOffset],
  );

  const onSelectLabel = useCallback(
    (id: string, lengthMm: string) => {
      setSelectedId(id);
      setEditingLength(lengthMm);
    },
    [setSelectedId],
  );

  const handlePointDrag = (id: string, pointIndex: 0 | 1, newPoint: Point) => {
    const el = elements.find((e) => e.id === id);
    if (!el || !el.points) return;

    const newPoints = [...el.points];
    if (pointIndex === 0) {
      newPoints[0] = newPoint.x;
      newPoints[1] = newPoint.y;
    } else {
      newPoints[2] = newPoint.x;
      newPoints[3] = newPoint.y;
    }

    const dx = newPoints[2] - newPoints[0];
    const dy = newPoints[3] - newPoints[1];
    const length = Math.sqrt(dx * dx + dy * dy);

    updateElement(id, {
      points: newPoints,
      length: length,
      label: getPipeLabel(newPoints, el.diameter || 2),
    });
  };

  const handleGroupAction = () => {
    if (selectedIds.length > 1) {
      groupElements(selectedIds);
    } else {
      showError("Seleccione al menos 2 elementos para agrupar.");
    }
  };

  const handleUngroupAction = () => {
    const hasGroup = elements.some(
      (el) => selectedIds.includes(el.id) && el.groupId,
    );
    if (hasGroup) {
      // Find all groupIds associated with these elements
      const groupIds = Array.from(
        new Set(
          elements
            .filter((el) => selectedIds.includes(el.id) && el.groupId)
            .map((el) => el.groupId as string),
        ),
      );
      const elementsToUngroup = elements
        .filter((el) => groupIds.includes(el.groupId as string))
        .map((el) => el.id);
      ungroupElements(elementsToUngroup);
    } else {
      showError("Los elementos seleccionados no pertenecen a ningún grupo.");
    }
  };

  const handleDeleteMany = () => {
    if (selectedIds.length === 0) {
      showError("No hay elementos seleccionados para eliminar.");
      return;
    }
    selectedIds.forEach((id) => deleteElement(id));
    setSelectedIds([]);
  };

  const handleRotateSelectedAccessory = (angleDeg: number) => {
    if (!selectedElement || selectedElement.type !== "accessory") return;
    rotateElements([selectedElement.id], angleDeg);
  };

  const handleResetSelectedAccessoryRotation = () => {
    if (!selectedElement || selectedElement.type !== "accessory") return;
    updateElement(selectedElement.id, { rotation: 0 });
  };

  const handleElementSelect = (id: string, shiftKey: boolean) => {
    const el = elements.find((e) => e.id === id);
    if (!el) return;

    let newSelectedIds = [...selectedIds];

    // If it's part of a group, select the whole group
    const idsToToggle = el.groupId
      ? elements.filter((e) => e.groupId === el.groupId).map((e) => e.id)
      : [id];

    if (shiftKey) {
      if (newSelectedIds.includes(id)) {
        newSelectedIds = newSelectedIds.filter(
          (sid) => !idsToToggle.includes(sid),
        );
      } else {
        newSelectedIds = [...new Set([...newSelectedIds, ...idsToToggle])];
      }
    } else {
      newSelectedIds = idsToToggle;
    }

    setSelectedIds(newSelectedIds);
    if (newSelectedIds.length === 1) {
      const singleEl = elements.find((e) => e.id === newSelectedIds[0]);
      if (singleEl?.type === "pipe") {
        if (singleEl.diameter) {
          addDiameter(singleEl.diameter);
          setDiameter(singleEl.diameter);
        }
        setEditingLength(singleEl.customLabels?.main || ((singleEl.length || 0) * 50).toFixed(0));
      } else if (singleEl?.type === "accessory") {
        if (singleEl.diameter) {
          addDiameter(singleEl.diameter);
          setDiameter(singleEl.diameter);
        }
      } else if (singleEl?.type === "support") {
        setEditingPrev(singleEl.customLabels?.prev || "");
        setEditingNext(singleEl.customLabels?.next || "");
      }
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setStageSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const snapEnabled = useStore(state => state.snapEnabled);
  
  const snapToGrid = useCallback((val: number) => {
    return Math.round(val / GRID_SIZE) * GRID_SIZE;
  }, []);

  const snapPoint = useCallback((p: {x: number, y: number}, excludeId?: string) => {
    if (!snapEnabled) return { x: snapToGrid(p.x), y: snapToGrid(p.y) };

    const SNAP_DIST = 15;
    let closestDist = SNAP_DIST;
    let snapped = { x: snapToGrid(p.x), y: snapToGrid(p.y) }; // Default to grid

    elements.forEach(el => {
      if (el.id === excludeId) return;
      
      const checkNode = (nx: number, ny: number) => {
        const dist = Math.sqrt(Math.pow(p.x - nx, 2) + Math.pow(p.y - ny, 2));
        if (dist < closestDist) {
          closestDist = dist;
          snapped = { x: nx, y: ny };
        }
      };

      if (el.type === 'pipe' && el.points) {
        checkNode(el.points[0], el.points[1]);
        checkNode(el.points[2], el.points[3]);
      } else if (el.position) {
        checkNode(el.position.x, el.position.y);
      }
    });

    return snapped;
  }, [snapEnabled, snapToGrid, elements]);
  const getRelativePointerPosition = (stage: any) => {
    const transform = stage.getAbsoluteTransform().copy().invert();
    const pos = stage.getPointerPosition();
    return transform.point(pos);
  };

  const handleMouseDown = (e: any) => {
    const stage = e.target.getStage();
    const relativePos = getRelativePointerPosition(stage);
    const snapped = snapPoint(relativePos);
    const snappedX = snapped.x;
    const snappedY = snapped.y;

    if (currentTool === "pipe") {
      setIsDrawing(true);
      setNewPipe([snappedX, snappedY, snappedX, snappedY]);
    } else if (currentTool === "accessory" && selectedAccessory) {
      addElement({
        id: nanoid(),
        type: "accessory",
        accessoryType: selectedAccessory,
        position: { x: snappedX, y: snappedY },
        rotation: 0,
        diameter: currentDiameter,
        size: 10 + currentDiameter * 4, // size scales with diameter
      });
    } else if (currentTool === "support" && selectedSupport) {
      addElement({
        id: nanoid(),
        type: "support",
        supportType: selectedSupport,
        position: { x: snappedX, y: snappedY },
        rotation: 0,
        diameter: currentDiameter,
        size: 10 + currentDiameter * 2,
      });
    } else if (currentTool === "select") {
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) {
        setIsSelecting(true);
        setSelectionRect({
          x1: relativePos.x,
          y1: relativePos.y,
          x2: relativePos.x,
          y2: relativePos.y,
        });
        setSelectedIds([]);
      } else {
        setDragStartPos({ x: snappedX, y: snappedY });
      }
    }
  };

  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const relativePos = getRelativePointerPosition(stage);
    const snapped = snapPoint(relativePos);
    const snappedX = snapped.x;
    const snappedY = snapped.y;

    if (isDrawing && newPipe) {
      setNewPipe([newPipe[0], newPipe[1], snappedX, snappedY]);
    } else if (isSelecting && selectionRect) {
      setSelectionRect({
        ...selectionRect,
        x2: relativePos.x,
        y2: relativePos.y,
      });
    }
  };

  const handleMouseUp = (e: any) => {
    if (isSelecting && selectionRect) {
      const x1 = Math.min(selectionRect.x1, selectionRect.x2);
      const x2 = Math.max(selectionRect.x1, selectionRect.x2);
      const y1 = Math.min(selectionRect.y1, selectionRect.y2);
      const y2 = Math.max(selectionRect.y1, selectionRect.y2);

      const newlySelectedIds = visibleElements
        .filter((el) => {
          if (isLayerLocked(el.layerId)) return false;
          if (el.type === "pipe" && el.points) {
            const px1 = Math.min(el.points[0], el.points[2]);
            const px2 = Math.max(el.points[0], el.points[2]);
            const py1 = Math.min(el.points[1], el.points[3]);
            const py2 = Math.max(el.points[1], el.points[3]);
            return px1 >= x1 && px2 <= x2 && py1 >= y1 && py2 <= y2;
          } else if (
            (el.type === "accessory" || el.type === "support") &&
            el.position
          ) {
            return (
              el.position.x >= x1 &&
              el.position.x <= x2 &&
              el.position.y >= y1 &&
              el.position.y <= y2
            );
          }
          return false;
        })
        .map((el) => el.id);

      setSelectedIds(newlySelectedIds);
      setIsSelecting(false);
      setSelectionRect(null);
    } else if (isDrawing && newPipe) {
      const dx = newPipe[2] - newPipe[0];
      const dy = newPipe[3] - newPipe[1];
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length > 0) {
        addElement({
          id: nanoid(),
          type: "pipe",
          points: newPipe,
          diameter: currentDiameter,
          length: length,
          label: `${(length * 50).toFixed(0)}mm (${currentDiameter}")`,
        });
      }
    }
    setIsDrawing(false);
    setNewPipe(null);
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-[#1a1c1e] overflow-hidden touch-none"
    >
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        draggable={currentTool === "select"}
        onClick={(e) => {
          if (e.target === e.target.getStage()) {
            setSelectedId(null);
          }
        }}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            useStore.setState({
              viewPos: { x: e.target.x(), y: e.target.y() },
            });
          }
        }}
        onWheel={(e) => {
          e.evt.preventDefault();
          const stage = e.target.getStage();
          const oldScale = stage.scaleX();
          const pointer = stage.getPointerPosition();

          const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
          };

          const speed = 1.1;
          const newScale =
            e.evt.deltaY > 0 ? oldScale / speed : oldScale * speed;

          const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
          };

          useStore.setState({ scale: newScale, viewPos: newPos });
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        scaleX={scale}
        scaleY={scale}
        x={viewPos.x}
        y={viewPos.y}
      >
        <Layer>
          {/* Grid */}
          {Array.from({
            length: Math.ceil(stageSize.width / GRID_SIZE) + 1,
          }).map((_, i) => (
            <Line
              key={`v-${i}`}
              points={[i * GRID_SIZE, 0, i * GRID_SIZE, stageSize.height]}
              stroke="#2c2e33"
              strokeWidth={1}
            />
          ))}
          {Array.from({
            length: Math.ceil(stageSize.height / GRID_SIZE) + 1,
          }).map((_, i) => (
            <Line
              key={`h-${i}`}
              points={[0, i * GRID_SIZE, stageSize.width, i * GRID_SIZE]}
              stroke="#2c2e33"
              strokeWidth={1}
            />
          ))}
        </Layer>

        <Layer>
          {visibleElements.map((el) => {
            const isSelected = selectedIds.includes(el.id);
            const isInGroup = !!el.groupId;
            const isLocked = isLayerLocked(el.layerId);

            if (el.type === "pipe" && el.points) {
              // We pass selectedIds length to know if it's the only one selected for resize handles
              const isOnlySelected = selectedIds.length === 1 && isSelected;
              return (
                <PipeElement
                  key={el.id}
                  el={el}
                  isSelected={isSelected}
                  isInGroup={isInGroup}
                  isLocked={isLocked}
                  isCotasVisible={isCotasVisible}
                  currentTool={currentTool}
                  pipeNum={pipeNumbers[el.id]}
                  scale={scale}
                  overlappingLabels={overlappingLabels}
                  selectedIds={selectedIds}
                  handleElementSelect={handleElementSelect}
                  moveElements={moveElements}
                  onUpdateOffset={onUpdateOffset}
                  handlePointDrag={handlePointDrag}
                  snapPoint={snapPoint}
                />
              );
            }
            if (
              (el.type === "accessory" || el.type === "support") &&
              el.position
            ) {
              const baseSize =
                el.type === "accessory"
                  ? el.accessoryType === "valve"
                    ? VALVE_BASE_SIZE
                    : ACCESSORY_BASE_SIZE
                  : 8 + (el.diameter || 2) * 2;
              const isLocked = isLayerLocked(el.layerId);
              return (
                <NodeElement
                  key={el.id}
                  el={el}
                  isSelected={isSelected}
                  isInGroup={isInGroup}
                  isLocked={isLocked}
                  isCotasVisible={isCotasVisible}
                  currentTool={currentTool}
                  scale={scale}
                  overlappingLabels={overlappingLabels}
                  selectedIds={selectedIds}
                  elements={elements}
                  images={{ codoImg, codo45Img, teeImg, teeRedImg, reducexcImg, valvulaImg, bridaImg, reducerImg, supportImg }}
                  handleElementSelect={handleElementSelect}
                  moveElements={moveElements}
                  snapPoint={snapPoint}
                />
              );
            }
            return null;
          })}

          {selectionRect && (
            <Rect
              x={Math.min(selectionRect.x1, selectionRect.x2)}
              y={Math.min(selectionRect.y1, selectionRect.y2)}
              width={Math.abs(selectionRect.x2 - selectionRect.x1)}
              height={Math.abs(selectionRect.y2 - selectionRect.y1)}
              fill="rgba(77, 171, 247, 0.1)"
              stroke="#4dabf7"
              strokeWidth={1}
              dash={[5, 5]}
            />
          )}

          {newPipe && (
            <Line
              points={newPipe}
              stroke="#4dabf7"
              strokeWidth={PIPE_STROKE_WIDTH}
              opacity={0.5}
              lineCap="round"
            />
          )}

          {selectedIds.length > 0 &&
            selectionBounds &&
            currentTool === "select" && (
              <Group>
                <Rect
                  x={selectionBounds.x - 10}
                  y={selectionBounds.y - 10}
                  width={selectionBounds.width + 20}
                  height={selectionBounds.height + 20}
                  stroke="#fcc419"
                  strokeWidth={1 / scale}
                  dash={[4 / scale, 4 / scale]}
                />
              </Group>
            )}
        </Layer>
      </Stage>

      {/* Floating Toolbar for canvas settings */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-40">
        <div className="pointer-events-none mb-1">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-mono">
            Precisión: {GRID_SIZE}mm
          </p>
          {overlappingLabels.size > 0 && (
            <div className="flex items-center gap-2 text-amber-500 animate-pulse bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20 w-fit mt-1">
              <AlertCircle size={12} />
              <span className="text-[9px] uppercase font-bold tracking-tight">
                Conflicto de Cotas
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 w-fit bg-[#1e2024]/90 backdrop-blur-md border border-white/10 rounded-xl p-1 shadow-2xl">
          <button
            onClick={() =>
              useStore.setState({ scale: Math.min(scale * 1.2, 5) })
            }
            className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <div className="w-full h-px bg-white/10 my-0.5" />
          <button
            onClick={() =>
              useStore.setState({ scale: Math.max(scale / 1.2, 0.1) })
            }
            className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
        </div>
      </div>

      {selectedIds.length > 0 && currentTool === "select" && (
        <div className="absolute bottom-6 left-1/2 w-fit max-w-[95vw] overflow-x-auto pointer-events-auto -translate-x-1/2 flex items-center gap-3 bg-[#1e2024] p-3 rounded-2xl border border-blue-500/30 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300">
          {selectedIds.length === 1 && selectedElement?.type === "pipe" && (
            <>
              <div className="flex flex-col flex-shrink-0">
                <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-1">
                  Longitud Cañería
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    title="Longitud"
                    value={editingLength}
                    onChange={(e) => setEditingLength(e.target.value)}
                    className="w-20 bg-black/40 text-white text-[16px] md:text-sm p-2 rounded-lg border border-white/10 outline-none focus:border-blue-500"
                    placeholder="mm"
                    onBlur={handleUpdateLength}
                    onKeyDown={(e) => e.key === "Enter" && handleUpdateLength()}
                  />
                  <span className="text-xs text-gray-400 font-mono">mm</span>
                  <button
                    title="Confirmar longitud"
                    onClick={handleUpdateLength}
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors flex-shrink-0"
                  >
                    <Check size={16} />
                  </button>
                </div>
              </div>
              <div className="w-px h-10 bg-white/5 mx-1 flex-shrink-0" />
            </>
          )}

          {selectedIds.length === 1 && selectedElement?.type === "support" && (
            <>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-1">
                    Cotas (mm)
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-black/40 rounded-lg border border-white/10 px-2 flex-shrink-0">
                      <span className="text-[10px] text-gray-500 mr-2">
                        Ant:
                      </span>
                      <input
                        type="text"
                        title="Cota anterior"
                        value={editingPrev}
                        onChange={(e) => setEditingPrev(e.target.value)}
                        onBlur={handleUpdateSupportLabels}
                        className="w-16 bg-transparent text-white text-[16px] md:text-sm py-2 outline-none"
                        placeholder="Auto"
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleUpdateSupportLabels()
                        }
                      />
                    </div>
                    <div className="flex items-center bg-black/40 rounded-lg border border-white/10 px-2 flex-shrink-0">
                      <span className="text-[10px] text-gray-500 mr-2">
                        Sig:
                      </span>
                      <input
                        type="text"
                        title="Cota siguiente"
                        value={editingNext}
                        onChange={(e) => setEditingNext(e.target.value)}
                        onBlur={handleUpdateSupportLabels}
                        className="w-16 bg-transparent text-white text-[16px] md:text-sm py-2 outline-none"
                        placeholder="Auto"
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleUpdateSupportLabels()
                        }
                      />
                    </div>
                    <button
                      title="Confirmar cotas"
                      onClick={handleUpdateSupportLabels}
                      className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors flex-shrink-0"
                    >
                      <Check size={16} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="w-px h-10 bg-white/5 mx-1 flex-shrink-0" />
            </>
          )}

          {selectedIds.length === 1 && selectedElement?.type === "accessory" && (
            <>
              <div className="flex flex-col flex-shrink-0">
                <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-1">
                  Rotacion
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleRotateSelectedAccessory(-15)}
                    className="p-2 text-gray-300 hover:text-blue-400 hover:bg-white/5 rounded-lg transition-all"
                    title="Rotar 15 grados a la izquierda"
                  >
                    <RotateCcw size={18} />
                  </button>
                  <button
                    onClick={() => handleRotateSelectedAccessory(15)}
                    className="p-2 text-gray-300 hover:text-blue-400 hover:bg-white/5 rounded-lg transition-all"
                    title="Rotar 15 grados a la derecha"
                  >
                    <RotateCw size={18} />
                  </button>
                  <button
                    onClick={handleResetSelectedAccessoryRotation}
                    className="px-3 py-2 text-[10px] uppercase font-bold text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                    title="Restablecer rotacion"
                  >
                    0
                  </button>
                </div>
              </div>
              <div className="w-px h-10 bg-white/5 mx-1 flex-shrink-0" />
            </>
          )}

          <div className="flex items-center gap-1 flex-shrink-0">
            {selectedIds.length > 1 && (
              <button
                onClick={handleGroupAction}
                className="p-2 text-gray-300 hover:text-blue-400 hover:bg-white/5 rounded-lg transition-all flex flex-col items-center gap-1"
                title="Agrupar"
              >
                <Combine size={18} />
                <span className="text-[8px] uppercase">Agrupar</span>
              </button>
            )}

            {selectedIds.some(
              (id) => elements.find((el) => el.id === id)?.groupId,
            ) && (
              <button
                onClick={handleUngroupAction}
                className="p-2 text-gray-300 hover:text-orange-400 hover:bg-white/5 rounded-lg transition-all flex flex-col items-center gap-1"
                title="Desagrupar"
              >
                <Layers size={18} />
                <span className="text-[8px] uppercase">Desagrupar</span>
              </button>
            )}

            <button
              onClick={handleDeleteMany}
              className="p-2 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-all flex flex-col items-center gap-1"
              title="Borrar Selección"
            >
              <Trash2 size={18} />
              <span className="text-[8px] uppercase">Borrar</span>
            </button>
          </div>

          <div className="w-px h-10 bg-white/5 mx-1" />

          <button
            title="Cerrar selección"
            onClick={() => setSelectedIds([])}
            className="p-2 text-gray-500 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Header / Layer Indicator */}
      <div className="absolute top-6 right-6 z-40 bg-[#1e2024]/90 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-4 text-white/50 text-[10px] shadow-2xl">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-blue-400" />
          <span className="font-semibold text-white">
            Capa:{" "}
            {layers.find((l) => l.id === activeLayerId)?.name || "Desconocida"}
          </span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <button
          onClick={() => setShowLayerPanel(!showLayerPanel)}
          className="hover:text-white transition-colors flex items-center gap-1"
        >
          {showLayerPanel ? "Cerrar Capas" : "Administrar Capas"}
        </button>
      </div>

      {/* Layer Panel */}
      {showLayerPanel && (
        <div className="absolute right-6 top-24 bottom-24 w-72 z-50 bg-[#1e2024] border border-white/10 rounded-3xl shadow-2xl flex flex-col p-6 animate-in slide-in-from-right-8 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Layers size={18} className="text-blue-400" />
              Capas
            </h3>
            <button
              title="Cerrar panel de capas"
              onClick={() => setShowLayerPanel(false)}
              className="text-white/30 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {layers.map((layer) => (
              <div
                key={layer.id}
                className={cn(
                  "group flex items-center gap-3 p-3 rounded-2xl transition-all border cursor-pointer",
                  activeLayerId === layer.id
                    ? "bg-blue-600/20 border-blue-500/50"
                    : "bg-white/5 border-transparent hover:bg-white/10",
                )}
                onClick={() => setActiveLayer(layer.id)}
              >
                <div className="flex-1 flex flex-col min-w-0">
                  {editingLayerId === layer.id ? (
                    <input
                      autoFocus
                      title="Nombre de la capa"
                      className="bg-black/20 text-white text-sm px-2 py-1 rounded outline-none border border-blue-500/30"
                      value={newLayerName}
                      onChange={(e) => setNewLayerName(e.target.value)}
                      onBlur={() => {
                        if (newLayerName.trim())
                          renameLayer(layer.id, newLayerName.trim());
                        setEditingLayerId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (newLayerName.trim())
                            renameLayer(layer.id, newLayerName.trim());
                          setEditingLayerId(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="text-white text-sm font-medium truncate">
                      {layer.name}
                    </span>
                  )}
                  <span className="text-[10px] text-white/30">
                    {
                      elements.filter(
                        (el) => (el.layerId || "default-layer") === layer.id,
                      ).length
                    }{" "}
                    elementos
                  </span>
                </div>

                <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                  <button
                    title={layer.visible ? "Ocultar capa" : "Mostrar capa"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLayerVisibility(layer.id);
                    }}
                    className={cn(
                      "p-1.5 rounded-lg hover:bg-white/10",
                      !layer.visible && "text-red-400",
                    )}
                  >
                    {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    title={layer.locked ? "Desbloquear capa" : "Bloquear capa"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLayerLock(layer.id);
                    }}
                    className={cn(
                      "p-1.5 rounded-lg hover:bg-white/10",
                      layer.locked && "text-yellow-400",
                    )}
                  >
                    {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                  <button
                    title="Editar nombre de capa"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingLayerId(layer.id);
                      setNewLayerName(layer.name);
                    }}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"
                  >
                    <Pencil size={14} />
                  </button>
                  {layer.id !== "default-layer" && (
                    <button
                      title="Eliminar capa"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLayer(layer.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => addLayer("Nueva Capa")}
            className="mt-6 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium py-3 rounded-2xl border border-white/10 transition-all"
          >
            <Plus size={16} />
            Añadir Capa
          </button>
        </div>
      )}
    </div>
  );
};
