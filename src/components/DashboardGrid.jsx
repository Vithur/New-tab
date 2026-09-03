import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
} from "@dnd-kit/core";
import Todo from "./Todo";
import Clock from "./Clock";
import ImportantTabs from "./ImportantTabs";
import SongPlayer from "./SongPlayer";
import CalendarWidget from "./CalendarWidget";
import RssWidget from "./RssWidget";
import CarouselWidget from "./CarouselWidget";
import HaWidget from "./HaWidget";
import { storageGet, storageSet } from "../utils/storage.js";
import DEFAULT_LAYOUT_SEED from "../data/default-layout.json";

/* ─── Grid Configuration & Responsive Helpers ─── */
const MIN_GRID_ROWS = 6;

const WIDGET_CONFIGS_LAPTOP = {
  todo: {
    title: "便签",
    cols: 4,
    minCols: 2,
    maxCols: 6,
    defaultRows: 2,
    minRows: 2,
    maxRows: 6,
    resizable: true,
    draggable: true,
  },
  importantTabs: {
    title: "常用标签页",
    cols: 3,
    minCols: 2,
    maxCols: 5,
    defaultRows: 2,
    minRows: 2,
    maxRows: 6,
    resizable: true,
    draggable: true,
  },
  songPlayer: {
    title: "播放器",
    cols: 5,
    minCols: 3,
    maxCols: 8,
    defaultRows: 2,
    minRows: 1,
    maxRows: 5,
    resizable: true,
    draggable: true,
  },
  timeBoxing: {
    title: "日历订阅",
    cols: 4,
    minCols: 3,
    maxCols: 7,
    defaultRows: 4,
    minRows: 2,
    maxRows: 10,
    resizable: true,
    draggable: true,
  },
  rssReader: {
    title: "新消息",
    cols: 3,
    minCols: 2,
    maxCols: 6,
    defaultRows: 2,
    minRows: 1,
    maxRows: 5,
    resizable: true,
    draggable: true,
  },
  carousel: {
    title: "照片",
    cols: 6,
    minCols: 3,
    maxCols: 10,
    defaultRows: 4,
    minRows: 2,
    maxRows: 8,
    resizable: true,
    draggable: true,
  },
  haWidget: {
    title: "家庭",
    cols: 3,
    minCols: 2,
    maxCols: 6,
    defaultRows: 3,
    minRows: 2,
    maxRows: 8,
    resizable: true,
    draggable: true,
  },
  // clock: {
  //   cols: 3,
  //   defaultRows: 2,
  //   minRows: 2,
  //   maxRows: 2,
  //   resizable: false,
  //   draggable: false,
  // },
};

const WIDGET_CONFIGS_DESKTOP = {
  todo: {
    cols: 4,
    minCols: 2,
    maxCols: 6,
    defaultRows: 2,
    minRows: 2,
    maxRows: 6,
    resizable: true,
    draggable: true,
  },
  importantTabs: {
    cols: 3,
    minCols: 2,
    maxCols: 6,
    defaultRows: 2,
    minRows: 2,
    maxRows: 6,
    resizable: true,
    draggable: true,
  },
  songPlayer: {
    cols: 4,
    minCols: 3,
    maxCols: 8,
    defaultRows: 2,
    minRows: 1,
    maxRows: 5,
    resizable: true,
    draggable: true,
  },
  timeBoxing: {
    cols: 5,
    minCols: 3,
    maxCols: 8,
    defaultRows: 6,
    minRows: 2,
    maxRows: 12,
    resizable: true,
    draggable: true,
  },
  rssReader: {
    cols: 3,
    minCols: 2,
    maxCols: 6,
    defaultRows: 2,
    minRows: 1,
    maxRows: 5,
    resizable: true,
    draggable: true,
  },
  carousel: {
    cols: 6,
    minCols: 3,
    maxCols: 10,
    defaultRows: 4,
    minRows: 2,
    maxRows: 8,
    resizable: true,
    draggable: true,
  },
  haWidget: {
    cols: 3,
    minCols: 2,
    maxCols: 6,
    defaultRows: 3,
    minRows: 2,
    maxRows: 8,
    resizable: true,
    draggable: true,
  },
  // clock: {
  //   cols: 4,
  //   defaultRows: 2,
  //   minRows: 2,
  //   maxRows: 2,
  //   resizable: false,
  //   draggable: false,
  // },
};

const getWidgetConfigs = (tier) =>
  tier === "desktop" ? WIDGET_CONFIGS_DESKTOP : WIDGET_CONFIGS_LAPTOP;

/* Current column span of a widget (clamped to its min/max and its stored cols) */
const getWidgetCols = (cfg, pos) => {
  if (!cfg) return 1;
  const min = cfg.minCols ?? cfg.cols;
  const max = cfg.maxCols ?? cfg.cols;
  return Math.max(min, Math.min(max, pos?.cols || cfg.cols || 1));
};

/* ─── Device Tier Breakpoints & Default Positions ─── */
const getDeviceTier = (width) => {
  if (typeof window === "undefined") return "laptop";
  const w = width ?? window.innerWidth;
  return w >= 1600 ? "desktop" : "laptop";
};

const DEFAULT_POSITIONS_LAPTOP = {
  todo: { col: 1, row: 1, rows: 2 },
  importantTabs: { col: 4, row: 1, rows: 2 },
  songPlayer: { col: 7, row: 1, rows: 2 },
  timeBoxing: { col: 12, row: 1, rows: 4 },
  rssReader: { col: 12, row: 5, rows: 2 },
  carousel: { col: 12, row: 7, rows: 4 },
  haWidget: { col: 12, row: 11, rows: 4 },
};

const DEFAULT_POSITIONS_DESKTOP = {
  todo: { col: 1, row: 1, rows: 2 },
  importantTabs: { col: 5, row: 1, rows: 2 },
  songPlayer: { col: 9, row: 1, rows: 2 },
  timeBoxing: { col: 17, row: 1, rows: 4 },
  rssReader: { col: 17, row: 5, rows: 2 },
  carousel: { col: 17, row: 7, rows: 4 },
  haWidget: { col: 17, row: 11, rows: 4 },
};

const getDefaultPositions = (tier) =>
  tier === "desktop" ? DEFAULT_POSITIONS_DESKTOP : DEFAULT_POSITIONS_LAPTOP;

const getStorageKeyForTier = (tier) => `settings_widget_positions_v7_${tier}`;

/* Calculate columns & rows dynamically based on window size */
const getDynamicGridSize = (tier = getDeviceTier()) => {
  if (typeof window === "undefined") {
    const minCols = tier === "desktop" ? 16 : 15;
    return { cols: minCols, rows: MIN_GRID_ROWS };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const minCols = tier === "desktop" ? 16 : 15;
  const cols = Math.max(minCols, Math.floor((width - 32) / 80));
  return {
    cols,
    rows: Math.max(MIN_GRID_ROWS, Math.floor((height - 96) / 100)),
  };
};

const clampPositionsToGrid = (
  posMap,
  gridCols,
  gridRows,
  widgetConfigs = WIDGET_CONFIGS_LAPTOP,
) => {
  const result = { ...posMap };
  for (const [id, pos] of Object.entries(result)) {
    const cfg = widgetConfigs[id];
    if (!cfg || typeof pos?.col !== "number" || typeof pos?.row !== "number")
      continue;
    const itemCols = getWidgetCols(cfg, pos);
    const itemRows = cfg.resizable
      ? Math.max(
          cfg.minRows,
          Math.min(cfg.maxRows, pos.rows || cfg.defaultRows),
        )
      : cfg.defaultRows;

    // 右对齐 widget 先贴右，再统一 clamp
    let baseCol = pos.col;
    if (pos.align === "right") {
      baseCol = Math.max(1, gridCols - itemCols + 1);
    }
    const clampedCol = Math.max(1, Math.min(gridCols - itemCols + 1, baseCol));
    const clampedRow = Math.max(1, Math.min(gridRows - itemRows + 1, pos.row));

    // 实际右边缘贴齐时记 align="right"；否则清掉，避免下次 resize 误贴右
    const newAlign = clampedCol + itemCols - 1 === gridCols ? "right" : undefined;

    result[id] = {
      ...pos,
      col: clampedCol,
      row: clampedRow,
      cols: itemCols,
      rows: itemRows,
      align: newAlign,
    };
  }
  return result;
};

/* ─── Storage Keys ─── */
const STORAGE_KEY = "settings_widget_positions_v7";
const STORAGE_KEY_V5 = "settings_widget_positions_v5";

/* ─── Collision Helpers ─── */

class CustomPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown",
      handler: ({ nativeEvent }) => {
        // 仅屏蔽 resize 手柄上的 pointerdown，避免缩放误触发拖拽。
        // 其它位置（尤其是 header，dragHandleProps 监听器就铺在 header 上）
        // 一律允许拖拽——这样 ImportantTabs 这种不挂 .drag-grip 图标的组件
        // 也能从标题拖拽。
        if (
          nativeEvent.target &&
          typeof nativeEvent.target.closest === "function" &&
          nativeEvent.target.closest(
            "[data-resize-handle], [data-resize-handle-cols]",
          )
        ) {
          return false;
        }
        return true;
      },
    },
  ];
}

/** True when two axis-aligned grid rectangles share at least one cell */
const rectsOverlap = (aCol, aRow, aCols, aRows, bCol, bRow, bCols, bRows) =>
  !(
    aCol + aCols <= bCol ||
    bCol + bCols <= aCol ||
    aRow + aRows <= bRow ||
    bRow + bRows <= aRow
  );

/** Can `widgetId` be placed at (col, row) with (cols, rows) without going OOB or colliding? */
const canPlace = (
  widgetId,
  col,
  row,
  positions,
  activeWidgets,
  gridCols,
  gridRows,
  customRows = null,
  customCols = null,
  widgetConfigs = WIDGET_CONFIGS_LAPTOP,
) => {
  const cfg = widgetConfigs[widgetId];
  if (!cfg) return false;
  const currentPos = positions[widgetId];
  const itemRows = customRows || currentPos?.rows || cfg.defaultRows || 1;
  const itemCols = customCols || getWidgetCols(cfg, currentPos);

  if (
    col < 1 ||
    row < 1 ||
    col + itemCols - 1 > gridCols
  )
    return false;

  for (const [id, pos] of Object.entries(positions)) {
    if (id === widgetId || !activeWidgets[id] || !pos || typeof pos?.col !== "number" || typeof pos?.row !== "number") continue;
    const oc = widgetConfigs[id];
    const oRows = pos.rows || oc?.defaultRows || 1;
    const oCols = getWidgetCols(oc, pos);
    if (
      oc &&
      rectsOverlap(
        col,
        row,
        itemCols,
        itemRows,
        pos.col,
        pos.row,
        oCols,
        oRows,
      )
    )
      return false;
  }
  return true;
};

/**
 * Checks if dragging `widgetId` to (targetCol, targetRow) can swap with an existing widget.
 * Returns the target widget ID to swap with if valid, or null otherwise.
 */
const findSwapWidget = (
  widgetId,
  targetCol,
  targetRow,
  positions,
  activeWidgets,
  gridCols,
  gridRows,
  itemRows,
  itemCols,
  widgetConfigs = WIDGET_CONFIGS_LAPTOP,
) => {
  const currentPos = positions[widgetId];
  if (!currentPos) return null;

  if (
    targetCol < 1 ||
    targetRow < 1 ||
    targetCol + itemCols - 1 > gridCols ||
    targetRow + itemRows - 1 > gridRows
  ) {
    return null;
  }

  const activeIds = Object.keys(activeWidgets).filter(
    (id) => activeWidgets[id] && positions[id],
  );

  const overlapping = activeIds.filter((id) => {
    if (id === widgetId) return false;
    const pos = positions[id];
    const oc = widgetConfigs[id];
    if (!pos || !oc) return false;
    const oCols = getWidgetCols(oc, pos);
    const oRows = pos.rows || oc.defaultRows || 1;

    return rectsOverlap(
      targetCol,
      targetRow,
      itemCols,
      itemRows,
      pos.col,
      pos.row,
      oCols,
      oRows,
    );
  });

  if (overlapping.length !== 1) return null;

  const swapId = overlapping[0];
  const swapPos = positions[swapId];
  const swapCfg = widgetConfigs[swapId];
  if (!swapPos || !swapCfg) return null;

  const swapCols = getWidgetCols(swapCfg, swapPos);
  const swapRows = swapPos.rows || swapCfg.defaultRows || 1;

  if (swapCols !== itemCols || swapRows !== itemRows) return null;
  if (swapPos.col !== targetCol || swapPos.row !== targetRow) return null;

  for (const otherId of activeIds) {
    if (otherId === widgetId || otherId === swapId) continue;
    const pos = positions[otherId];
    const oc = widgetConfigs[otherId];
    if (!pos || !oc) continue;
    const oCols = getWidgetCols(oc, pos);
    const oRows = pos.rows || oc.defaultRows || 1;

    if (
      rectsOverlap(
        currentPos.col,
        currentPos.row,
        swapCols,
        swapRows,
        pos.col,
        pos.row,
        oCols,
        oRows,
      )
    ) {
      return null;
    }
  }

  return swapId;
};

/** Convert initial bounding rect + delta → 1-indexed grid cell */
const cellFromTranslatedRect = (
  initialRect,
  delta,
  widgetId,
  gridEl,
  gridCols,
  gridRows,
  itemRows = null,
  itemCols = null,
  widgetConfigs = WIDGET_CONFIGS_LAPTOP,
) => {
  if (!gridEl || !initialRect || !delta) return null;
  const cfg = widgetConfigs[widgetId];
  if (!cfg) return null;
  const gridRect = gridEl.getBoundingClientRect();
  if (gridRect.width <= 0 || gridRect.height <= 0) return null;

  const currentLeft = initialRect.left + delta.x;
  const currentTop = initialRect.top + delta.y;

  const relLeft = currentLeft - gridRect.left;
  const relTop = currentTop - gridRect.top;
  const cellWidth = gridRect.width / gridCols;
  const cellHeight = gridRect.height / gridRows;

  const activeItemRows = itemRows || cfg.defaultRows || 2;
  const activeItemCols = itemCols || cfg.cols || 1;

  const targetCol = Math.min(
    gridCols - activeItemCols + 1,
    Math.max(1, Math.round(relLeft / cellWidth) + 1),
  );
  const targetRow = Math.min(
    gridRows - activeItemRows + 1,
    Math.max(1, Math.round(relTop / cellHeight) + 1),
  );

  return { col: targetCol, row: targetRow };
};

/* ─── Draggable Widget Wrapper Component ─── */
const DraggableWidget = ({
  id,
  config,
  pos,
  renderWidget,
  widgetEditMode,
  onResizeStart,
}) => {
  const currentRows = config.resizable
    ? Math.max(
        config.minRows,
        Math.min(config.maxRows, pos.rows || config.defaultRows),
      )
    : config.defaultRows;
  const currentCols = getWidgetCols(config, pos);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id,
      disabled: !config.draggable,
    });

  const style = {
    gridColumn: `${pos.col} / span ${currentCols}`,
    gridRow: `${pos.row} / span ${currentRows}`,
    ...(transform
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
          zIndex: 100,
        }
      : {}),
  };

  const dragHandleProps = useMemo(
    () => ({ ...attributes, ...listeners }),
    [attributes, listeners],
  );

  return (
    <div
      ref={setNodeRef}
      className={`grid-widget group/widget ${isDragging ? "grid-widget--dragging" : ""}`}
      style={style}
    >
      {renderWidget(id, dragHandleProps)}

      {/* Hover-only resize handles — only mounted while 布局调整 is ON.
          Visibility is driven purely by CSS (.grid-widget:hover), so we
          avoid any Tailwind named-group variant that previously failed to
          compile under v4 and left the handles permanently visible. */}
      {widgetEditMode && (
        <>
          <div
            className="resize-handle resize-handle--cols"
            data-resize-handle="cols"
            onPointerDown={(e) => onResizeStart(e, id, "cols")}
          />
          <div
            className="resize-handle resize-handle--rows"
            data-resize-handle="rows"
            onPointerDown={(e) => onResizeStart(e, id, "rows")}
          />
        </>
      )}
    </div>
  );
};

/* ─── DashboardGrid Component ─── */

const DashboardGrid = ({
  showTodo = true,
  showSongPlayer = true,
  showImportantTabs = true,
  showTimeBoxing = true,
  showRssReader = true,
  showCarousel = true,
  showHaWidget = false,
  widgetEditMode = false,
  importantTabsConfig,
  calendarSub,
  rssConfig,
  carouselConfig,
  haConfig,
  songPlaylistUrl,
  songAutoPlay,
  musicSources,
  lofiVolume = 80,
  onLofiVolumeChange,
  pianoVolume = 80,
  onPianoVolumeChange,
}) => {
  const gridRef = useRef(null);
  const [deviceTier, setDeviceTier] = useState(() => getDeviceTier());
  const widgetConfigs = useMemo(
    () => getWidgetConfigs(deviceTier),
    [deviceTier],
  );

  const [positions, setPositions] = useState(() =>
    clampPositionsToGrid(
      getDefaultPositions(getDeviceTier()),
      getDynamicGridSize(getDeviceTier()).cols,
      getDynamicGridSize(getDeviceTier()).rows,
      getWidgetConfigs(getDeviceTier()),
    ),
  );
  const [ghostInfo, setGhostInfo] = useState(null);
  const [{ cols: gridCols, rows: gridRows }, setGridSize] = useState(() =>
    getDynamicGridSize(getDeviceTier()),
  );

  const sensors = useSensors(
    useSensor(CustomPointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  /* Window resize listener: updates grid size & device tier (Laptop vs Desktop) */
  useEffect(() => {
    const handleResize = () => {
      const newTier = getDeviceTier();
      const newGrid = getDynamicGridSize(newTier);
      setGridSize(newGrid);
      setDeviceTier((prevTier) => (prevTier !== newTier ? newTier : prevTier));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const hydratedRef = useRef(false);
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  const activeWidgets = useMemo(() => {
    const w = {};
    
    if (showTodo) w.todo = true;
    
    if (showSongPlayer) w.songPlayer = true;
    
    if (showImportantTabs) w.importantTabs = true;
    if (showTimeBoxing) w.timeBoxing = true;
    if (showRssReader) w.rssReader = true;
    if (showCarousel) w.carousel = true;
    if (showHaWidget) w.haWidget = true;
    return w;
  }, [showTodo, showSongPlayer, showImportantTabs, showTimeBoxing, showRssReader, showCarousel, showHaWidget]);

  const activeRef = useRef(activeWidgets);
  activeRef.current = activeWidgets;

  /* ── Hydrate from storage per Device Tier (Laptop vs Desktop) ── */
  useEffect(() => {
    let cancelled = false;
    hydratedRef.current = false;
    (async () => {
      try {
        const tierKey = getStorageKeyForTier(deviceTier);
        let stored = await storageGet(tierKey);
        let isV5 = false;

        if (!stored || typeof stored !== "object") {
          const universalV6 = await storageGet(STORAGE_KEY);
          if (universalV6 && typeof universalV6 === "object") {
            stored = universalV6;
          } else {
            const v5stored = await storageGet(STORAGE_KEY_V5);
            if (v5stored && typeof v5stored === "object") {
              stored = v5stored;
              isV5 = true;
            } else if (deviceTier === "desktop" && DEFAULT_LAYOUT_SEED?.positions && typeof DEFAULT_LAYOUT_SEED.positions === "object") {
              // 新装扩展 / 未存值时回退到导出的桌面布局种子（widget_positions_v7_desktop）
              stored = DEFAULT_LAYOUT_SEED.positions;
            }
          }
        }

        if (cancelled) return;
        const defaults = getDefaultPositions(deviceTier);
        const currentConfigs = getWidgetConfigs(deviceTier);

        if (stored && typeof stored === "object") {
          setPositions(() => {
            const merged = { ...defaults };
            for (const [id, pos] of Object.entries(stored)) {
              if (
                currentConfigs[id] &&
                typeof pos?.col === "number" &&
                typeof pos?.row === "number"
              ) {
                if (isV5) {
                  merged[id] = {
                    ...merged[id],
                    col: (pos.col - 1) * 2 + 1,
                    row: (pos.row - 1) * 2 + 1,
                    rows: (typeof pos?.rows === "number" ? pos.rows : 1) * 2,
                  };
                } else {
                  const cfg = currentConfigs[id];
                  const validRows = cfg.resizable
                    ? Math.max(
                        cfg.minRows,
                        Math.min(
                          cfg.maxRows,
                          typeof pos?.rows === "number"
                            ? pos.rows
                            : cfg.defaultRows,
                        ),
                      )
                    : cfg.defaultRows;
                  const validCols = cfg.resizable
                    ? Math.max(
                        cfg.minCols ?? cfg.cols,
                        Math.min(
                          cfg.maxCols ?? cfg.cols,
                          typeof pos?.cols === "number"
                            ? pos.cols
                            : cfg.cols,
                        ),
                      )
                    : cfg.cols;

                  merged[id] = {
                    ...merged[id],
                    col: pos.col,
                    row: pos.row,
                    rows: validRows,
                    cols: validCols,
                  };
                }
              }
            }
            return clampPositionsToGrid(
              merged,
              gridCols,
              gridRows,
              currentConfigs,
            );
          });
        } else {
          setPositions(
            clampPositionsToGrid(defaults, gridCols, gridRows, currentConfigs),
          );
        }
      } catch (err) {
        console.error("DashboardGrid hydration error:", err);
      } finally {
        if (!cancelled) hydratedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deviceTier, gridCols, gridRows]);

  /* ── Grid resize: re-clamp positions so right-anchored widgets (align="right")
        stay glued to the right edge across window resizes ── */
  useEffect(() => {
    if (!hydratedRef.current) return;
    setPositions((prev) => {
      const next = clampPositionsToGrid(
        prev,
        gridCols,
        gridRows,
        widgetConfigs,
      );
      // Avoid infinite loop / unnecessary state churn: only update if something changed
      const changed = Object.keys(next).some((id) => {
        const a = prev[id];
        const b = next[id];
        return (
          !a ||
          a.col !== b.col ||
          a.row !== b.row ||
          a.cols !== b.cols ||
          a.rows !== b.rows ||
          a.align !== b.align
        );
      });
      return changed ? next : prev;
    });
  }, [gridCols, gridRows, widgetConfigs]);

  /* ── Persist on change per Device Tier ── */
  useEffect(() => {
    if (!hydratedRef.current) return;
    const tierKey = getStorageKeyForTier(deviceTier);
    storageSet(tierKey, positions);
  }, [positions, deviceTier]);

  // 右键缩放菜单已移除（需求 #5）

  /* ── Drag Event Handlers ── */
  const handleDragStart = (event) => {
    const { active, delta } = event;
    if (!active) return;
    const cfg = widgetConfigs[active.id];
    if (!cfg) return;

    const currentRows = positions[active.id]?.rows || cfg.defaultRows || 2;
    const currentCols = getWidgetCols(cfg, positions[active.id]);
    const initialRect = active.rect.current.initial;
    const target = cellFromTranslatedRect(
      initialRect,
      delta,
      active.id,
      gridRef.current,
      gridCols,
      gridRows,
      currentRows,
      currentCols,
      widgetConfigs,
    );
    if (!target) return;

    const canDirectPlace = canPlace(
      active.id,
      target.col,
      target.row,
      positions,
      activeWidgets,
      gridCols,
      gridRows,
      currentRows,
      currentCols,
      widgetConfigs,
    );

    const swapTargetId = !canDirectPlace
      ? findSwapWidget(
          active.id,
          target.col,
          target.row,
          positions,
          activeWidgets,
          gridCols,
          gridRows,
          currentRows,
          currentCols,
          widgetConfigs,
        )
      : null;

    const valid = canDirectPlace || Boolean(swapTargetId);

    setGhostInfo({
      col: target.col,
      row: target.row,
      cols: currentCols,
      rows: currentRows,
      valid,
      isSwap: Boolean(swapTargetId),
    });
  };

  const handleDragMove = (event) => {
    const { active, delta } = event;
    if (!active) return;
    const cfg = widgetConfigs[active.id];
    if (!cfg) return;

    const currentRows = positions[active.id]?.rows || cfg.defaultRows || 2;
    const currentCols = getWidgetCols(cfg, positions[active.id]);
    const initialRect = active.rect.current.initial;
    const target = cellFromTranslatedRect(
      initialRect,
      delta,
      active.id,
      gridRef.current,
      gridCols,
      gridRows,
      currentRows,
      currentCols,
      widgetConfigs,
    );
    if (!target) {
      setGhostInfo(null);
      return;
    }

    const canDirectPlace = canPlace(
      active.id,
      target.col,
      target.row,
      positions,
      activeWidgets,
      gridCols,
      gridRows,
      currentRows,
      currentCols,
      widgetConfigs,
    );

    const swapTargetId = !canDirectPlace
      ? findSwapWidget(
          active.id,
          target.col,
          target.row,
          positions,
          activeWidgets,
          gridCols,
          gridRows,
          currentRows,
          currentCols,
          widgetConfigs,
        )
      : null;

    const valid = canDirectPlace || Boolean(swapTargetId);

    setGhostInfo({
      col: target.col,
      row: target.row,
      cols: currentCols,
      rows: currentRows,
      valid,
      isSwap: Boolean(swapTargetId),
    });
  };

  const handleDragEnd = (event) => {
    const { active, delta } = event;
    if (active) {
      const cfg = widgetConfigs[active.id];
      const currentRows = positions[active.id]?.rows || cfg?.defaultRows || 2;
      const currentCols = getWidgetCols(cfg, positions[active.id]);
      const initialRect = active.rect.current.initial;
      const target = cellFromTranslatedRect(
        initialRect,
        delta,
        active.id,
        gridRef.current,
        gridCols,
        gridRows,
        currentRows,
        currentCols,
        widgetConfigs,
      );

      if (target) {
        const canDirectPlace = canPlace(
          active.id,
          target.col,
          target.row,
          positions,
          activeWidgets,
          gridCols,
          gridRows,
          currentRows,
          currentCols,
          widgetConfigs,
        );

        if (canDirectPlace) {
          setPositions((p) => {
            const cur = p[active.id];
            const newCols = currentCols;
            const newAlign = target.col + newCols - 1 === gridCols ? "right" : undefined;
            return {
              ...p,
              [active.id]: { ...cur, col: target.col, row: target.row, cols: newCols, align: newAlign },
            };
          });
        } else {
          const swapId = findSwapWidget(
            active.id,
            target.col,
            target.row,
            positions,
            activeWidgets,
            gridCols,
            gridRows,
            currentRows,
            currentCols,
            widgetConfigs,
          );
          if (swapId && positions[swapId]) {
            const origPosA = positions[active.id];
            setPositions((p) => {
              const curA = p[active.id];
              const curS = p[swapId];
              const colsA = currentCols;
              const colsS = getWidgetCols(widgetConfigs[swapId], curS);
              return {
                ...p,
                [active.id]: {
                  ...curA,
                  col: target.col,
                  row: target.row,
                  cols: colsA,
                  align: target.col + colsA - 1 === gridCols ? "right" : undefined,
                },
                [swapId]: {
                  ...curS,
                  col: origPosA.col,
                  row: origPosA.row,
                  cols: colsS,
                  align: origPosA.col + colsS - 1 === gridCols ? "right" : undefined,
                },
              };
            });
          }
        }
      }
    }
    setGhostInfo(null);
  };

  const handleDragCancel = () => {
    setGhostInfo(null);
  };

  /* ── Resize via hover handle (only mounted when widgetEditMode is ON) ──
     Plain pointer events (mouse + touch). Reads start cols/rows from
     positionsRef so the closure never goes stale, then clamps the new
     span to the widget's min/max and to the grid bounds so it can't run
     off the right/bottom edge. */
  const handleResizeStart = useCallback(
    (e, id, mode) => {
      e.preventDefault();
      e.stopPropagation();
      const gridEl = gridRef.current;
      if (!gridEl) return;
      const cfg = widgetConfigs[id];
      if (!cfg) return;
      const gridRect = gridEl.getBoundingClientRect();
      if (gridRect.width <= 0 || gridRect.height <= 0) return;
      const cellW = gridRect.width / gridCols;
      const cellH = gridRect.height / gridRows;
      const startX = e.clientX;
      const startY = e.clientY;
      const cur = positionsRef.current[id];
      if (!cur) return;
      const startCols = getWidgetCols(cfg, cur);
      const startRows = cur.rows || cfg.defaultRows;
      const startCol = cur.col;
      const startRow = cur.row;

      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let newCols = startCols;
        let newRows = startRows;
        if (mode === "cols" || mode === "both") {
          newCols = Math.round((dx + startCols * cellW) / cellW);
        }
        if (mode === "rows" || mode === "both") {
          newRows = Math.round((dy + startRows * cellH) / cellH);
        }
        newCols = Math.max(cfg.minCols, Math.min(cfg.maxCols, newCols));
        newRows = Math.max(cfg.minRows, Math.min(cfg.maxRows, newRows));
        newCols = Math.min(newCols, gridCols - startCol + 1);
        newRows = Math.min(newRows, gridRows - startRow + 1);
        setPositions((prev) => {
          const c = prev[id];
          if (!c) return prev;
          return { ...prev, [id]: { ...c, cols: newCols, rows: newRows } };
        });
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.userSelect = "";
      };
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [widgetConfigs, gridCols, gridRows],
  );

  /* ── Render widget by ID ── */
  const renderWidget = (id, dragHandleProps) => {
    switch (id) {
      case "todo":
        return <Todo dragHandleProps={dragHandleProps} />;
      case "importantTabs":
        return <ImportantTabs dragHandleProps={dragHandleProps} tabsConfig={importantTabsConfig} />;
      case "songPlayer":
        return <SongPlayer dragHandleProps={dragHandleProps} musicSources={musicSources} autoPlay={songAutoPlay} volume={lofiVolume} onVolumeChange={onLofiVolumeChange} pianoVolume={pianoVolume} onPianoVolumeChange={onPianoVolumeChange} />;
      case "timeBoxing":
        return <CalendarWidget dragHandleProps={dragHandleProps} calendarSub={calendarSub} />;
      case "rssReader":
        return <RssWidget dragHandleProps={dragHandleProps} rssConfig={rssConfig} />;
      case "haWidget":
        return <HaWidget dragHandleProps={dragHandleProps} haConfig={haConfig} />;
      case "carousel":
        return <CarouselWidget dragHandleProps={dragHandleProps} carouselConfig={carouselConfig} />;
      // case "clock":
      //   return null;
      default:
        return null;
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        ref={gridRef}
        className="dashboard-grid"
        style={{
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          gridTemplateRows: `repeat(${gridRows}, 1fr)`,
        }}
      >
        {/* Ghost drop-target indicator */}
        {ghostInfo && (
          <div
            className={`grid-ghost ${ghostInfo.valid ? "" : "grid-ghost--invalid"}`}
            style={{
              gridColumn: `${ghostInfo.col} / span ${ghostInfo.cols}`,
              gridRow: `${ghostInfo.row} / span ${ghostInfo.rows}`,
            }}
          />
        )}

        {/* Place each active widget in its grid cell */}
        {Object.entries(widgetConfigs).map(([id, config]) => {
          if (!activeWidgets[id]) return null;
          const pos = positions[id] || getDefaultPositions(deviceTier)[id] || { col: 1, row: 1, rows: 2 };
          if (!pos) return null;

          return (
            <DraggableWidget
              key={id}
              id={id}
              config={config}
              pos={pos}
              renderWidget={renderWidget}
              widgetEditMode={widgetEditMode}
              onResizeStart={handleResizeStart}
            />
          );
        })}

        {/* 右键缩放菜单已移除（需求 #5） */}
      </div>
    </DndContext>
  );
};

export default DashboardGrid;
