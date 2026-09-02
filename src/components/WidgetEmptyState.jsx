import React from "react";
import { EMPTY_STATE, EMPTY_ICON, EMPTY_TITLE, EMPTY_HINT } from "./widgetStyles";

/** 所有 widget 通用的空状态 / 错误态块 */
const WidgetEmptyState = ({ icon, title, hint }) => (
  <div className={EMPTY_STATE}>
    <i className={`${icon} ${EMPTY_ICON} ${icon.includes("loader") ? "animate-spin" : ""}`} />
    <p className={EMPTY_TITLE}>{title}</p>
    {hint ? <p className={EMPTY_HINT}>{hint}</p> : null}
  </div>
);

export default WidgetEmptyState;
