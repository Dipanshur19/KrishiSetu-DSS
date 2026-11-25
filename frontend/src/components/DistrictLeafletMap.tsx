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

  const activeDistrict =
    districts.find((d) => d.district === selectedDistrict) || districts[0] || null;

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

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap &copy; CARTO",
        maxZoom: 18,
      }).addTo(map);

      districts.forEach((d) => {
        const isHighRisk = d.weather_rainfall_anomaly < -15 || d.fldg_coverage_active;
        const isCompliant = d.smf_share_pct >= 55.6;
        const color = isHighRisk ? "#d97706" : isCompliant ? "#4d7c0f" : "#5b8fa8";
        const isSelected = selectedDistrict === d.district;

        const circle = L.circleMarker([d.lat, d.lon], {
          radius: isSelected ? 15 : 11,
          color: isSelected ? "#141513" : color,
          weight: isSelected ? 2.5 : 1.5,
          fillColor: color,
          fillOpacity: 0.78,
        }).addTo(map);

        circle.bindPopup(
          `<div style="font-family: inherit; font-size: 12px; min-width: 175px; color: #141513;">
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px;">${d.district}</div>
            <div>Sanctioned: <strong>₹${Number(d.sanctioned_amount).toLocaleString("en-IN")}</strong></div>
            <div>SMF Share: <strong>${d.smf_share_pct}%</strong></div>
            <div>14d Precip: <strong>${d.forecast_14d_precip_mm} mm</strong> (${d.weather_rainfall_anomaly}%)</div>
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
    <div className="relative w-full h-[380px] rounded-2xl overflow-hidden border border-black/[0.08] bg-[#fafaf6]">
      <div ref={containerRef} className="w-full h-full" />

      {/* Translucent Frosted Bottom Metric Bar matching reference card */}
      {activeDistrict && (
        <div className="absolute inset-x-0 bottom-0 z-[400] bg-[#1e2318]/85 backdrop-blur-md text-white px-5 py-3.5 border-t border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-white">{activeDistrict.district}</div>
              <div className="text-[11px] text-white/65">{activeDistrict.agro_climatic_zone}</div>
            </div>

            <div className="grid grid-cols-3 gap-6 text-xs">
              <div>
                <div className="text-[11px] text-white/60">Sanctioned</div>
                <div className="font-mono font-medium text-white mt-0.5">
                  ₹{Number(activeDistrict.sanctioned_amount).toLocaleString("en-IN")}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-white/60">SMF Share</div>
                <div className="font-mono font-medium text-[#d4f04c] mt-0.5">
                  {activeDistrict.smf_share_pct}%
                </div>
              </div>
              <div>
                <div className="text-[11px] text-white/60">14d Rain</div>
                <div className="font-mono font-medium text-white mt-0.5">
                  {activeDistrict.forecast_14d_precip_mm} mm
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
