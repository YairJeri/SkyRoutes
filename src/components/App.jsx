import { useState, useRef } from "preact/hooks";
import Dexie from "dexie";
import Searcher from "./Searcher.jsx";
import Map from "./Map.jsx";

async function buildGraph() {
    const db = new Dexie("SkyRoutes");
    db.version(1).stores({
        airports: "id, name, city, country, lat, lng",
        routes: "++id, id_origin, id_destination, distance",
    });

    const routes = await db.routes.toArray();
    const airports = await db.airports.toArray();

    const airportMap = Object.fromEntries(airports.map(a => [a.id, a]));

    const graph = {};
    for (const r of routes) {
        if (!graph[r.id_origin]) graph[r.id_origin] = [];
        graph[r.id_origin].push({ to: r.id_destination, distance: r.distance });

        if (!graph[r.id_destination]) graph[r.id_destination] = [];
        graph[r.id_destination].push({ to: r.id_origin, distance: r.distance });
    }

    return { graph, airportMap };
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

function aStar(graph, start, goal, airportMap, avoidSet) {
    const open = new Set([start]);
    const cameFrom = {};
    const gScore = { [start]: 0 };
    const fScore = {
        [start]: haversine(
            airportMap[start].lat,
            airportMap[start].lng,
            airportMap[goal].lat,
            airportMap[goal].lng
        ),
    };

    while (open.size > 0) {
        const current = [...open].reduce((a, b) =>
            (fScore[a] ?? Infinity) < (fScore[b] ?? Infinity) ? a : b
        );

        if (current === goal) {
            const path = [];
            let u = goal;
            while (u) {
                path.unshift(u);
                u = cameFrom[u];
            }
            return { path, distance: gScore[goal] };
        }

        open.delete(current);
        for (const edge of graph[current] || []) {
            if (avoidSet.has(edge.to)) continue;
            const tentativeG = (gScore[current] ?? Infinity) + edge.distance;
            if (tentativeG < (gScore[edge.to] ?? Infinity)) {
                cameFrom[edge.to] = current;
                gScore[edge.to] = tentativeG;
                fScore[edge.to] =
                    tentativeG +
                    haversine(
                        airportMap[edge.to].lat,
                        airportMap[edge.to].lng,
                        airportMap[goal].lat,
                        airportMap[goal].lng
                    );
                open.add(edge.to);
            }
        }
    }

    return { path: [], distance: Infinity };
}

async function routeWithStops({ graph, airportMap, origin, destination, stops, avoids }) {
    const avoidSet = new Set(avoids.map(a => a.id));
    let current = origin.id;
    let totalPath = [];
    let totalDistance = 0;
    let remainingStops = [...stops];

    while (remainingStops.length > 0) {
        let best = null;
        let bestResult = null;

        for (const s of remainingStops) {
            const result = aStar(graph, current, s.id, airportMap, avoidSet);
            if (!best || result.distance < bestResult.distance) {
                best = s;
                bestResult = result;
            }
        }

        totalPath = [...totalPath, ...bestResult.path.slice(0, -1)];
        totalDistance += bestResult.distance;
        current = best.id;
        remainingStops = remainingStops.filter(s => s.id !== best.id);
    }

    const finalLeg = aStar(graph, current, destination.id, airportMap, avoidSet);
    totalPath = [...totalPath, ...finalLeg.path];
    totalDistance += finalLeg.distance;

    return { path: totalPath, totalDistance };
}

export default function App() {
    const [origin, setOrigin] = useState(null);
    const [destination, setDestination] = useState(null);
    const [stops, setStops] = useState([]);
    const [avoids, setAvoids] = useState([]);
    const [route, setRoute] = useState(null);
    const [distance, setDistance] = useState(0);
    const [message, setMessage] = useState(null);

    const mapRef = useRef(null);

    const handleSelect = (item, type) => {
        const shouldFly = item.lat && item.lng && mapRef.current;
        const zoom = type === "country" ? 5 : type === "city" ? 8 : 12;

        if (["origin", "destination", "stop", "avoid"].includes(type)) {
            if (origin?.id === item.id) setOrigin(null);
            if (destination?.id === item.id) setDestination(null);
            setStops(stops.filter(a => a.id !== item.id));
            setAvoids(avoids.filter(a => a.id !== item.id));

            switch (type) {
                case "origin": setOrigin(item); break;
                case "destination": setDestination(item); break;
                case "stop": setStops([...stops, item]); break;
                case "avoid": setAvoids([...avoids, item]); break;
            }

            setTimeout(() => {
                if (shouldFly) {
                    mapRef.current.flyTo([item.lat, item.lng], zoom, { duration: 1.2 });
                }
            }, 50);
        } else if (shouldFly) {
            mapRef.current.flyTo([item.lat, item.lng], zoom, { duration: 1.2 });
        }
    };

    const handleCalculate = async () => {
        setMessage(null);
        setRoute(null);

        if (!origin || !destination) {
            setMessage({ type: "error", text: "⚠️ You must select an origin and destination before calculating the route." });
            return;
        }

        const { graph, airportMap } = await buildGraph();
        const { path, totalDistance } = await routeWithStops({
            graph, airportMap, origin, destination, stops, avoids
        });

        if (!path || path.length === 0 || totalDistance === Infinity) {
            setMessage({ type: "warning", text: "❌ No route found with the selected conditions." });
            setRoute(null);
            setDistance(0);
            return;
        }

        setRoute(path.map(id => airportMap[id]));
        setDistance(totalDistance);
        setMessage({ type: "success", text: "✅ Optimal route calculated successfully." });
    };

    const renderAirportCard = (airport, color) => (
        <div class={`mt-2 flex items-center justify-between bg-${color}-50 border border-${color}-200 px-3 py-2 rounded-md`}>
            <div>
                <p class={`font-semibold text-${color}-800 text-sm`}>
                    {airport.city}, {airport.country}
                </p>
                <p class={`text-xs text-${color}-600`}>{airport.name}</p>
            </div>
            <button
                onClick={() => {
                    if (color === "blue") setOrigin(null);
                    else if (color === "green") setDestination(null);
                }}
                class={`text-${color}-500 hover:text-${color}-700 text-lg ml-3`}
            >
                ✖
            </button>
        </div>
    );

    return (
        <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 h-screen bg-gray-50">
            <div class="overflow-y-auto bg-white shadow rounded-lg p-4 space-y-4 border border-gray-200">
                <h2 class="text-xl font-semibold text-gray-800 text-center w-full">
                    ✈️ SkyRoutes Planner
                </h2>

                <Searcher onSelect={handleSelect} />

                {message && (
                    <div
                        class={`p-3 rounded-md text-sm border ${message.type === "error"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : message.type === "warning"
                                ? "bg-yellow-50 text-yellow-800 border-yellow-200"
                                : "bg-green-50 text-green-700 border-green-200"
                            }`}
                    >
                        {message.text}
                    </div>
                )}

                <div class="mt-4 space-y-5 text-sm">
                    <div>
                        <h3 class="text-gray-700 font-semibold">🛫 Origin:</h3>
                        {origin ? renderAirportCard(origin, "blue") : (
                            <p class="text-gray-400 mt-1 italic">None selected</p>
                        )}
                    </div>

                    <div>
                        <h3 class="text-gray-700 font-semibold">🛬 Destination:</h3>
                        {destination ? renderAirportCard(destination, "green") : (
                            <p class="text-gray-400 mt-1 italic">None selected</p>
                        )}
                    </div>

                    <div>
                        <h3 class="text-gray-700 font-semibold">🕓 Stops:</h3>
                        {stops.length > 0 ? (
                            <div class="flex flex-wrap gap-2 mt-2">
                                {stops.map((s) => (
                                    <div
                                        key={s.id}
                                        class="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2 text-yellow-800 text-sm w-full"
                                    >
                                        <div>
                                            <span class="font-semibold block">{s.city}, {s.country}</span>
                                            <span class="text-xs text-yellow-700">{s.name}</span>
                                        </div>
                                        <button
                                            onClick={() => setStops(stops.filter(a => a.id !== s.id))}
                                            class="text-yellow-600 hover:text-yellow-800 text-base ml-3"
                                            title="Remove stop"
                                        >
                                            ✖
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p class="text-gray-400 mt-1 italic">None</p>
                        )}
                    </div>

                    <div>
                        <h3 class="text-gray-700 font-semibold">🚫 Avoid Airports:</h3>
                        {avoids.length > 0 ? (
                            <div class="flex flex-wrap gap-2 mt-2">
                                {avoids.map((a) => (
                                    <div
                                        key={a.id}
                                        class="flex items-center justify-between bg-red-50 border border-red-200 rounded-md px-3 py-2 text-red-800 text-sm w-full"
                                    >
                                        <div>
                                            <span class="font-semibold block">{a.city}, {a.country}</span>
                                            <span class="text-xs text-red-700">{a.name}</span>
                                        </div>
                                        <button
                                            onClick={() => setAvoids(avoids.filter(x => x.id !== a.id))}
                                            class="text-red-600 hover:text-red-800 text-base ml-3"
                                            title="Remove avoided airport"
                                        >
                                            ✖
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p class="text-gray-400 mt-1 italic">None</p>
                        )}
                    </div>
                </div>

                <button
                    onClick={handleCalculate}
                    class="mt-4 bg-blue-600 text-white font-medium px-4 py-2 rounded w-full hover:bg-blue-700 transition-colors"
                >
                    Calculate Optimal Route
                </button>

                {route && (
                    <div class="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm">
                        <h3 class="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            🌍 Optimal Route Found
                        </h3>
                        <p class="text-gray-700 mb-4">
                            <strong>Total Distance:</strong> {distance.toFixed(1)} km
                        </p>

                        <div class="flex flex-col items-center space-y-2">
                            {route.map((a, i) => {
                                const isOrigin = i === 0;
                                const isDest = i === route.length - 1;
                                return (
                                    <div key={a.id} class="flex flex-col items-center w-full">
                                        <div class="flex items-center space-x-2">
                                            <span class="text-lg">
                                                {isOrigin ? "🛫" : isDest ? "🛬" : "🕓"}
                                            </span>
                                            <div class="bg-white rounded border border-gray-200 px-3 py-1 text-sm shadow-sm">
                                                <p class="font-semibold text-gray-800">
                                                    {a.city}, {a.country}
                                                </p>
                                                <p class="text-xs text-gray-500">{a.name}</p>
                                            </div>
                                        </div>
                                        {!isDest && (
                                            <div class="flex justify-center text-gray-400 text-sm mt-1 mb-1">
                                                <span class="select-none">⬇️ ✈️</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <div class="h-full">
                <Map
                    ref={mapRef}
                    origin={origin}
                    destination={destination}
                    stops={stops}
                    avoids={avoids}
                    route={route}
                />
            </div>
        </div>
    );
}
