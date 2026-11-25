"use client";

import React, { useEffect, useRef } from "react";
import { DistrictHeatmapRow } from "@/types/dss";

interface DistrictLeafletMapProps {
  districts: DistrictHeatmapRow[];
  selectedDistrict: string | null;
  onSelectDistrict: (district: string) => void;
}

function getMarkerStyle(d: DistrictHeatmapRow, isSelected: boolean) {
  const isHighRisk = d.weather_rainfall_anomaly < -15 || d.fldg_coverage_active;
  const isCompliant = d.smf_share_pct >= 55.6;
  const color = isHighRisk ? "#d97706" : isCompliant ? "#4d7c0f" : "#5b8fa8";
  return {
    radius: isSelected ? 15 : 11,
    color: isSelected ? "#141513" : color,
    weight: isSelected ? 2.5 : 1.5,
    fillColor: color,
    fillOpacity: isSelected ? 0.9 : 0.78,
  };
}

export default function DistrictLeafletMap({
  districts,
  selectedDistrict,
  onSelectDistrict,
}: DistrictLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Record<string, import("leaflet").CircleMarker>>({});
  const onSelectRef = useRef(onSelectDistrict);
  onSelectRef.current = onSelectDistrict;

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
      markersRef.current = {};

      const map = L.map(containerRef.current, {
        center: [26.35, 80.1],
        zoom: 7,
        scrollWheelZoom: false,
      });

      // Keyless ESRI World Light Gray Canvas + Reference labels (automatic OSM fallback if blocked)
      const baseLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "&copy; Esri, OpenStreetMap contributors",
          maxZoom: 16,
        }
      ).addTo(map);

      const refLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 16,
          pane: "overlayPane",
        }
      ).addTo(map);

      let fallbackApplied = false;
      baseLayer.on("tileerror", () => {
        if (fallbackApplied) return;
        fallbackApplied = true;
        map.removeLayer(baseLayer);
        map.removeLayer(refLayer);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 18,
        }).addTo(map);
      });

      const coords: [number, number][] = [];
      districts.forEach((d) => {
        coords.push([d.lat, d.lon]);
        const isSelected = selectedDistrict === d.district;
        const circle = L.circleMarker([d.lat, d.lon], getMarkerStyle(d, isSelected)).addTo(map);

        circle.bindPopup(
          `<div style="font-family: inherit; font-size: 12px; min-width: 175px; color: #141513;">
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px;">${d.district}</div>
            <div>Sanctioned: <strong>₹${Number(d.sanctioned_amount).toLocaleString("en-IN")}</strong></div>
            <div>SMF Share: <strong>${d.smf_share_pct}%</strong></div>
            <div>14d Precip: <strong>${d.forecast_14d_precip_mm} mm</strong> (${d.weather_rainfall_anomaly}%)</div>
          </div>`
        );

        circle.on("click", () => {
          onSelectRef.current(d.district);
        });

        markersRef.current[d.district] = circle;
      });

      if (coords.length > 0) {
        map.fitBounds(L.latLngBounds(coords), {
          paddingTopLeft: [28, 28],
          paddingBottomRight: [28, 96],
          maxZoom: 8,
        });
      }

      mapRef.current = map;
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = {};
    };
  }, [districts]);

  useEffect(() => {
    districts.forEach((d) => {
      const marker = markersRef.current[d.district];
      if (marker) {
        marker.setStyle(getMarkerStyle(d, selectedDistrict === d.district));
        if (selectedDistrict === d.district) {
          marker.bringToFront();
        }
      }
    });
  }, [districts, selectedDistrict]);

  return (
    <div className="relative w-full h-[380px] rounded-2xl overflow-hidden border border-black/[0.08] bg-[#efefea]">
      <div ref={containerRef} className="w-full h-full" />

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
