import { useEffect, useRef, forwardRef, useImperativeHandle } from "preact/compat";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const Map = forwardRef(({ origin, destination, stops, avoids, route, alternateRoutes = [] }, ref) => {
    const mapRef = useRef(null);
    const markersGroup = useRef(L.layerGroup());
    const routeLayer = useRef(null);

    useEffect(() => {
        if (mapRef.current) return;

        const map = L.map("map", { worldCopyJump: true }).setView([20, 0], 2);
        mapRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 18,
        }).addTo(map);

        markersGroup.current.addTo(map);

        return () => map.remove();
    }, []);

    useImperativeHandle(ref, () => ({
        flyTo: (coords, zoom, options) => {
            if (mapRef.current) {
                const adjusted = adjustLng(coords);
                mapRef.current.flyTo(adjusted, zoom, options);
            }
        },
    }));

    const adjustLng = ([lat, lng]) => {
        let newLng = ((lng + 180) % 360 + 360) % 360 - 180;
        return [lat, newLng];
    };

    const normalizeRoute = (points) => {
        if (!points || points.length < 2) return points;
        const normalized = [points[0]];
        for (let i = 1; i < points.length; i++) {
            let [lat1, lon1] = normalized[normalized.length - 1];
            let [lat2, lon2] = points[i];
            const dLon = lon2 - lon1;
            if (dLon > 180) lon2 -= 360;
            else if (dLon < -180) lon2 += 360;
            normalized.push([lat2, lon2]);
        }
        return normalized;
    };

    useEffect(() => {
        const map = mapRef.current;
        const group = markersGroup.current;
        if (!map || !group) return;

        group.clearLayers();
        const markers = [];
        const added = new Set();

        const icons = {
            origin: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
            destination: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
            stop: "https://cdn-icons-png.flaticon.com/512/854/854878.png",
            avoid: "https://cdn-icons-png.flaticon.com/512/463/463612.png",
            scale: "https://cdn-icons-png.flaticon.com/512/64/64113.png",
        };

        const addMarker = (a, type, iconUrl, size = [26, 26]) => {
            if (!a) return;

            const key = a.id || `${a.lat.toFixed(3)},${a.lng.toFixed(3)}`;
            if (added.has(key)) return;
            added.add(key);

            const coords = adjustLng([a.lat, a.lng]);

            const popupLabel = `
            <div style="text-align:center; line-height:1.4; font-size:13px;">
                <div style="font-weight:600; color:#333;">${type}</div>
                <div style="font-size:15px; font-weight:700; color:#007bff; margin-top:2px;">
                    ${a.city || "Unknown"}, ${a.country || ""}
                </div>
                <div style="color:#555; font-size:12px; margin-top:2px;">
                    ${a.name || "Unknown Airport"}
                </div>
            </div>
        `;

            for (let offset of [-360, 0, 360]) {
                const marker = L.marker([coords[0], coords[1] + offset], {
                    icon: L.icon({ iconUrl, iconSize: size }),
                }).bindPopup(popupLabel);
                marker.addTo(group);
                markers.push(marker);
            }
        };

        addMarker(origin, "🛫 Origin", icons.origin);
        addMarker(destination, "🛬 Destination", icons.destination);
        stops.forEach((s) => addMarker(s, "🕓 Stop", icons.stop));
        avoids.forEach((a) => addMarker(a, "🚫 Avoid", icons.avoid));

        if (route && route.length > 2) {
            const middlePoints = route.slice(1, -1);
            middlePoints.forEach((p) =>
                addMarker(p, "⚫ Scale", icons.scale, [18, 18])
            );
        }

        if (markers.length > 0) {
            const bounds = L.featureGroup(markers).getBounds().pad(0.4);
            map.fitBounds(bounds);
        }
    }, [origin, destination, stops, avoids, route]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (routeLayer.current) {
            map.removeLayer(routeLayer.current);
            routeLayer.current = null;
        }

        const layers = [];

        const drawRoute = (points, color, weight = 3, dashArray = null) => {
            if (!points || points.length < 2) return;
            const latlngs = normalizeRoute(points.map((a) => [a.lat, a.lng]));
            for (let offset of [-360, 0, 360]) {
                const shifted = latlngs.map(([lat, lng]) => [lat, lng + offset]);
                const poly = L.polyline(shifted, {
                    color,
                    weight,
                    opacity: 0.85,
                    dashArray,
                }).addTo(map);
                layers.push(poly);
            }
        };

        if (route && route.length > 1) drawRoute(route, "#007bff", 4);

        alternateRoutes.forEach((alt, i) => {
            const colors = ["#e67e22", "#9b59b6", "#e74c3c"];
            drawRoute(alt, colors[i % colors.length], 2, "6 8");
        });

        if (layers.length > 0) {
            routeLayer.current = L.layerGroup(layers);
            routeLayer.current.addTo(map);

            const bounds = L.polyline(normalizeRoute(route.map(a => [a.lat, a.lng]))).getBounds();
            map.fitBounds(bounds.pad(0.3));
        }
    }, [route, alternateRoutes]);

    return (
        <div
            id="map"
            class="w-full h-96 md:h-full border rounded shadow relative overflow-hidden"
            style={{ borderColor: "#ddd" }}
        >
            <div class="absolute top-2 right-2 bg-white bg-opacity-90 text-xs text-gray-700 rounded shadow px-2 py-1 z-1000">
                <div>🛫 Origin</div>
                <div>🛬 Destination</div>
                <div>🕓 Stop</div>
                <div>⚫ Scale</div>
                <div>🚫 Avoid</div>
            </div>
        </div>
    );
});

export default Map;
