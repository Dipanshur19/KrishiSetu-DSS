"use client";

import React, { useId } from "react";
import { ArrowUpRight, Sun, Wind, CloudRain } from "lucide-react";

interface ClimateGaugeCardProps {
  title?: string;
  subtitle?: string;
  primaryValue: string;
  unit?: string;
  progressRatio: number; // 0 to 1
  metric1Label: string;
  metric1Val: string;
  metric2Label: string;
  metric2Val: string;
  metric3Label: string;
  metric3Val: string;
  onExpand?: () => void;
}

export default function ClimateGaugeCard({
  title = "Climate & Coverage",
  subtitle,
  primaryValue,
  unit = "",
  progressRatio,
  metric1Label,
  metric1Val,
  metric2Label,
  metric2Val,
  metric3Label,
  metric3Val,
  onExpand,
}: ClimateGaugeCardProps) {
  const gradId = useId();
  const clamped = Math.max(0.05, Math.min(1, progressRatio));
  const r = 82;
  const cx = 110;
  const cy = 100;
  const circumference = Math.PI * r;
  const dashOffset = circumference * (1 - clamped);

  return (
    <div className="bento-card p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[15px] font-medium text-[#141513]">{title}</h3>
          {subtitle && <p className="text-xs text-[#8a877d] mt-0.5">{subtitle}</p>}
        </div>
        {onExpand && (
          <button
            onClick={onExpand}
            className="w-7 h-7 rounded-full border border-black/[0.08] flex items-center justify-center text-[#5e5c55] hover:text-[#141513] hover:bg-[#fafaf6] transition-colors"
            title="Inspect details"
          >
            <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Semi-Circular Arc Gauge matching ClimateIQ reference */}
      <div className="relative flex flex-col items-center justify-center py-2">
        <svg viewBox="0 0 220 120" className="w-full max-w-[240px]">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#a3d929" />
              <stop offset="65%" stopColor="#d4f04c" />
              <stop offset="100%" stopColor="#8bb8cc" />
            </linearGradient>
          </defs>
          {/* Background Dotted Track */}
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="#e5e5dc"
            strokeWidth="6"
            strokeDasharray="2 5"
            strokeLinecap="round"
          />
          {/* Active Value Arc */}
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
          <text
            x={cx}
            y={cy - 10}
            textAnchor="middle"
            className="fill-[#141513] font-mono"
            style={{ fontSize: "28px", fontWeight: 500 }}
          >
            {primaryValue}
            {unit && (
              <tspan style={{ fontSize: "13px", fill: "#8a877d" }} dx="3" dy="-10">
                {unit}
              </tspan>
            )}
          </text>
        </svg>
      </div>

      {/* Bottom 3 Metrics Row */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-black/[0.06] text-center">
        <div>
          <div className="flex items-center justify-center space-x-1 text-[11px] text-[#8a877d]">
            <Sun className="w-3 h-3 text-[#d97706]" strokeWidth={1.5} />
            <span>{metric1Label}</span>
          </div>
          <div className="text-xs font-medium text-[#141513] font-mono mt-0.5">{metric1Val}</div>
        </div>
        <div>
          <div className="flex items-center justify-center space-x-1 text-[11px] text-[#8a877d]">
            <Wind className="w-3 h-3 text-[#5e5c55]" strokeWidth={1.5} />
            <span>{metric2Label}</span>
          </div>
          <div className="text-xs font-medium text-[#141513] font-mono mt-0.5">{metric2Val}</div>
        </div>
        <div>
          <div className="flex items-center justify-center space-x-1 text-[11px] text-[#8a877d]">
            <CloudRain className="w-3 h-3 text-[#5b8fa8]" strokeWidth={1.5} />
            <span>{metric3Label}</span>
          </div>
          <div className="text-xs font-medium text-[#141513] font-mono mt-0.5">{metric3Val}</div>
        </div>
      </div>
    </div>
  );
}
