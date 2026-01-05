"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useTranslations } from "next-intl";

const MapContainerAny = MapContainer as any;
const TileLayerAny = TileLayer as any;
const MarkerAny = Marker as any;

const destIcon = L.icon({
  iconUrl: 'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-red.png',
  iconRetinaUrl: 'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
  shadowAnchor: [13, 41]
});

type Props = {
  onClick: (lat: number, lng: number) => void;
  marker?: { lat: number; lng: number };
  center?: { lat: number; lng: number };
  height?: number;
  showExternalLink?: boolean;
  locationName?: string;
};

export default function MapCanvas({ onClick, marker, center, height = 300, showExternalLink = false, locationName = "" }: Props) {
  const t = useTranslations("viewer"); // Assuming 'viewer' namespace has 'openMaps'
  const defaultCenter: [number, number] = [40.7128, -74.006];
  const mapCenter: [number, number] = center ? [center.lat, center.lng] : (marker ? [marker.lat, marker.lng] : defaultCenter);

  function openMaps() {
    if (marker) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${marker.lat},${marker.lng}`, '_blank');
    } else {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationName)}`, '_blank');
    }
  }

  return (
    <div style={{ height, width: "100%", position: "relative" }}>
      <MapContainerAny center={mapCenter} zoom={12} style={{ height: "100%", width: "100%" }}>
        <TileLayerAny url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
        <ClickCatcher onClick={onClick} />
        <MapUpdater center={mapCenter} />
        {marker && <MarkerAny position={[marker.lat, marker.lng]} icon={destIcon} />}
      </MapContainerAny>
      
      {showExternalLink && (
        <button 
          onClick={(e) => { e.stopPropagation(); openMaps(); }} 
          className="absolute bottom-2 right-2 z-[1000] rounded-full bg-white px-3 py-1 text-xs text-black shadow hover:bg-gray-100 font-bold"
        >
          {t('openMaps')}
        </button>
      )}
    </div>
  );
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMapEvents({});
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center[0], center[1], map]);
  return null;
}

function ClickCatcher({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e: any) { onClick(e.latlng.lat, e.latlng.lng); } });
  return null;
}
