# Flight Route Optimizer

Flight Route Optimizer is a web application that allows users to find the shortest flights between an origin and a destination. The app also provides the flexibility to add stopovers or avoid specific airports, making it easier to plan efficient and personalized flight routes.

## Features

- **Select Origin and Destination:** Choose your starting and ending airports to find the shortest route.  
- **Add Stopovers:** Include one or multiple stopovers along your journey.  
- **Avoid Airports:** Specify airports to skip in your route calculation.  
- **Shortest Distance:** Automatically calculates the flight path with the least distance using the **A\* algorithm**.  
- **User-Friendly Interface:** Clean, responsive, and interactive UI built with Astro and Preact.

## Installation

To run the app locally:

```bash
# Clone the repository
git clone https://github.com/YairJeri/SkyRoutes.git
cd SkyRoutes

# Install dependencies
npm install

# Start the development server
npm run dev
```

## Technologies Used

- Astro: A static site generator for building fast and SEO-friendly websites.
- Preact: A lightweight alternative to React for building user interfaces.
- Dexie: A fast, lightweight, and easy-to-use client-side database for JavaScript applications.
- Leaflet: A popular open-source JavaScript library for creating interactive maps.
- A\* algorithm: A pathfinding algorithm used to calculate the shortest route between two points.
