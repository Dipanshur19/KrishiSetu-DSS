"use client";

import React, { useEffect, useRef } from "react";
import { DistrictHeatmapRow } from "@/types/dss";

interface DistrictLeafletMapProps {
  districts: DistrictHeatmapRow[];
  selectedDistrict: string | null;
  onSelectDistrict: (district: string) => void;
}

export default function DistrictLeafletMap({
  districts,
  selectedDistrict,
  onSelectDistrict,
}: DistrictLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!containerRef.current || districts.length === 0) return;
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current, {
        center: [26.35, 80.1],
        zoom: 7,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);

      districts.forEach((d) => {
        const isHighRisk = d.weather_rainfall_anomaly < -15 || d.fldg_coverage_active;
        const isCompliant = d.smf_share_pct >= 55.6;
        const color = isHighRisk ? "#d97706" : isCompliant ? "#047857" : "#2563eb";
        const isSelected = selectedDistrict === d.district;

        const circle = L.circleMarker([d.lat, d.lon], {
          radius: isSelected ? 16 : 12,
          color: isSelected ? "#0f172a" : color,
          weight: isSelected ? 3 : 2,
          fillColor: color,
          fillOpacity: 0.72,
        }).addTo(map);

        circle.bindPopup(
          `<div style="font-family: Inter, sans-serif; font-size: 12px; min-width: 185px;">
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px;">${d.district}</div>
            <div>Zone: <strong>${d.agro_climatic_zone}</strong></div>
            <div>Sanctioned: <strong>₹${Number(d.sanctioned_amount).toLocaleString("en-IN")}</strong></div>
            <div>SMF Share: <strong style="color:${color}">${d.smf_share_pct}%</strong></div>
            <div>14d Open-Meteo Rain: <strong>${d.forecast_14d_precip_mm} mm</strong> (${d.weather_rainfall_anomaly}%)</div>
            <div>Avg Max Temp: <strong>${d.avg_max_temp_c}°C</strong></div>
            ${d.fldg_coverage_active ? '<div style="margin-top:4px; color:#b45309; font-weight:700;">FLDG Climate Cover Active</div>' : ""}
          </div>`
        );

        circle.on("click", () => {
          onSelectDistrict(d.district);
        });
      });

      mapRef.current = map;
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [districts, selectedDistrict, onSelectDistrict]);

  return (
    <div className="relative w-full h-[380px] rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg px-3 py-2 text-[11px] text-slate-700 space-y-1 shadow-xs">
        <div className="font-semibold text-slate-900">District PSL & Weather Legend</div>
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-700 inline-block" />
            <span>PSL Compliant (&ge;55.6%)</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
            <span>Moderate</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" />
            <span>Drought / FLDG Active</span>
          </span>
        </div>
      </div>
    </div>
  );
}
