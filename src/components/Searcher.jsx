import { useState, useEffect, useRef } from "preact/hooks";
import Dexie from "dexie";

export default function Searcher({ onSelect }) {
    const [selectedCountry, setSelectedCountry] = useState(null);
    const [selectedCity, setSelectedCity] = useState(null);

    const [countryQuery, setCountryQuery] = useState("");
    const [cityQuery, setCityQuery] = useState("");
    const [airportQuery, setAirportQuery] = useState("");

    const [countries, setCountries] = useState([]);
    const [cities, setCities] = useState([]);
    const [airports, setAirports] = useState([]);

    const [showCountries, setShowCountries] = useState(false);
    const [showCities, setShowCities] = useState(false);
    const [showAirports, setShowAirports] = useState(false);

    const [dropdownVisible, setDropdownVisible] = useState(true);

    const db = new Dexie("SkyRoutes");
    db.version(1).stores({
        airports: "id, name, city, country, lat, lng",
        routes: "++id, id_origin, id_destination, distance",
    });

    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                // Animación de salida
                setDropdownVisible(false);
                setTimeout(() => {
                    setShowCountries(false);
                    setShowCities(false);
                    setShowAirports(false);
                    setDropdownVisible(true);
                }, 200);
            }
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    // Buscar países
    useEffect(() => {
        if (!countryQuery) {
            setCountries([]);
            return;
        }
        db.airports
            .filter((a) =>
                a.country.toLowerCase().includes(countryQuery.toLowerCase())
            )
            .toArray()
            .then((res) => {
                const uniqueCountries = Array.from(new Set(res.map((a) => a.country)));
                setCountries(uniqueCountries);
            });
    }, [countryQuery]);

    // Buscar ciudades
    useEffect(() => {
        if (!selectedCountry) return;
        db.airports
            .filter((a) => a.country === selectedCountry.name)
            .toArray()
            .then((res) => {
                const uniqueCities = Array.from(new Set(res.map((a) => a.city)));
                const filtered =
                    cityQuery.trim() === ""
                        ? uniqueCities
                        : uniqueCities.filter((c) =>
                            c.toLowerCase().includes(cityQuery.toLowerCase())
                        );
                setCities(filtered);
            });
    }, [selectedCountry, cityQuery]);

    // Buscar aeropuertos
    useEffect(() => {
        if (!selectedCountry || !selectedCity) return;
        db.airports
            .filter(
                (a) =>
                    a.country === selectedCountry.name && a.city === selectedCity.name
            )
            .limit(50)
            .toArray()
            .then((res) => {
                const filtered =
                    airportQuery.trim() === ""
                        ? res
                        : res.filter((a) =>
                            a.name.toLowerCase().includes(airportQuery.toLowerCase())
                        );
                setAirports(filtered);
            });
    }, [selectedCountry, selectedCity, airportQuery]);

    const centerFromAirports = (list) => {
        const avgLat = list.reduce((s, a) => s + a.lat, 0) / list.length;
        const avgLng = list.reduce((s, a) => s + a.lng, 0) / list.length;
        return { lat: avgLat, lng: avgLng };
    };

    const dropdownClass = dropdownVisible
        ? "animate-dropdown-in"
        : "animate-dropdown-out";

    return (
        <div ref={containerRef} class="space-y-8 max-w-lg mx-auto p-4 relative">
            {/* Country */}
            <div class="relative animate-dropdown-class">
                <label class="block text-sm font-semibold text-gray-700 mb-1">
                    Country
                </label>
                <input
                    type="text"
                    value={countryQuery}
                    onFocus={() => setShowCountries(true)}
                    onInput={(e) => {
                        setCountryQuery(e.target.value);
                        setShowCountries(true);
                    }}
                    placeholder="Search country..."
                    class="border p-2 w-full rounded-lg shadow-sm focus:ring focus:ring-blue-200 outline-none"
                />
                {showCountries && countries.length > 0 && (
                    <div
                        class={`absolute z-10 bg-white border mt-1 rounded-lg shadow-lg max-h-48 overflow-auto w-full ${dropdownClass}`}
                    >
                        {countries.map((c) => (
                            <div
                                key={c}
                                class="p-2 cursor-pointer hover:bg-blue-50"
                                onClick={() => {
                                    db.airports
                                        .filter((a) => a.country === c)
                                        .toArray()
                                        .then((res) => {
                                            const center = centerFromAirports(res);
                                            const countryData = { name: c, ...center };
                                            setSelectedCountry(countryData);
                                            setCountryQuery(c);
                                            setShowCountries(false);
                                            setSelectedCity(null);
                                            setCityQuery("");
                                            setAirportQuery("");
                                            setAirports([]);
                                            onSelect(countryData, "country");
                                        });
                                }}
                            >
                                {c}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* City */}
            {selectedCountry && (
                <div class="relative transition-all duration-500 ease-out animate-dropdown-class">
                    <label class="block text-sm font-semibold text-gray-700 mb-1">
                        City
                    </label>
                    <input
                        type="text"
                        value={cityQuery}
                        onFocus={() => selectedCountry && setShowCities(true)}
                        onInput={(e) => {
                            setCityQuery(e.target.value);
                            selectedCountry && setShowCities(true);
                        }}
                        placeholder="Search city..."
                        class="border p-2 w-full rounded-lg shadow-sm outline-none focus:ring focus:ring-blue-200"
                    />
                    {showCities && cities.length > 0 && (
                        <div
                            class={`absolute z-10 bg-white border mt-1 rounded-lg shadow-lg max-h-48 overflow-auto w-full ${dropdownClass}`}
                        >
                            {cities.map((c) => (
                                <div
                                    key={c}
                                    class="p-2 cursor-pointer hover:bg-blue-50 bg-white"
                                    onClick={() => {
                                        db.airports
                                            .filter(
                                                (a) => a.country === selectedCountry.name && a.city === c
                                            )
                                            .toArray()
                                            .then((res) => {
                                                const center = centerFromAirports(res);
                                                const cityData = { name: c, ...center };
                                                setSelectedCity(cityData);
                                                setCityQuery(c);
                                                setShowCities(false);
                                                setAirportQuery("");
                                                setAirports(res);
                                                onSelect(cityData, "city");
                                            });
                                    }}
                                >
                                    {c}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Airport */}
            {selectedCity && (
                <div class="relative transition-all duration-500 ease-out animate-dropdown-class">
                    <label class="block text-sm font-semibold text-gray-700 mb-1">
                        Airport
                    </label>

                    {airports.length === 1 ? (
                        <div class="p-3 border rounded-lg bg-gray-50 shadow-sm">
                            <div class="font-semibold">{airports[0].name}</div>
                            <div class="text-sm text-gray-500 mb-2">
                                {airports[0].city}, {airports[0].country}
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <button
                                    class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                                    onClick={() => onSelect(airports[0], "origin")}
                                >
                                    Origin
                                </button>
                                <button
                                    class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                                    onClick={() => onSelect(airports[0], "destination")}
                                >
                                    Destination
                                </button>
                                <button
                                    class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm"
                                    onClick={() => onSelect(airports[0], "stop")}
                                >
                                    Stop
                                </button>
                                <button
                                    class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                                    onClick={() => onSelect(airports[0], "avoid")}
                                >
                                    Avoid
                                </button>
                            </div>
                        </div>
                    ) : (
                        <input
                            type="text"
                            value={airportQuery}
                            onFocus={() => selectedCity && setShowAirports(true)}
                            onInput={(e) => {
                                setAirportQuery(e.target.value);
                                selectedCity && setShowAirports(true);
                            }}
                            placeholder="Search airport..."
                            class="border p-2 w-full rounded-lg shadow-sm outline-none focus:ring focus:ring-blue-200"
                        />
                    )}

                    {showAirports && airports.length > 1 && (
                        <div
                            class={`absolute z-10 bg-white border mt-1 rounded-lg shadow-lg max-h-64 overflow-auto w-full ${dropdownClass}`}
                        >
                            {airports.map((a) => (
                                <div
                                    key={a.id}
                                    class="p-3 border-b last:border-0 hover:bg-blue-50 transition bg-white"
                                >
                                    <div class="font-semibold">{a.name}</div>
                                    <div class="text-sm text-gray-500 mb-2">
                                        {a.city}, {a.country}
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <button
                                            class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                                            onClick={() => {
                                                setAirportQuery(a.name);
                                                setShowAirports(false);
                                                onSelect(a, "origin");
                                            }}
                                        >
                                            Origin
                                        </button>
                                        <button
                                            class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                                            onClick={() => {
                                                setAirportQuery(a.name);
                                                setShowAirports(false);
                                                onSelect(a, "destination");
                                            }}
                                        >
                                            Destination
                                        </button>
                                        <button
                                            class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm"
                                            onClick={() => {
                                                setAirportQuery(a.name);
                                                setShowAirports(false);
                                                onSelect(a, "stop");
                                            }}
                                        >
                                            Stop
                                        </button>
                                        <button
                                            class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                                            onClick={() => {
                                                setAirportQuery(a.name);
                                                setShowAirports(false);
                                                onSelect(a, "avoid");
                                            }}
                                        >
                                            Avoid
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
