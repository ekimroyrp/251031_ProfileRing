# Profile Ring Designer

Interactive Three.js playground for sculpting procedural ring geometries. Sketch a custom 2D cross-section, array it around a circular path, and instantly preview the resulting mesh with configurable twist, scale, and taper parameters.

## Features
- Real-time Three.js viewport with orbit controls and physically based shading.
- Draggable 2D profile editor canvas for shaping the sweep cross-section.
- Slider controls for profile count, twist, scale, and taper along the ring.
- Automatic mesh regeneration with smooth surface normals for clean renders.

## Getting Started
```bash
npm install
npm run dev
```

Open the URL printed by Vite (default `http://localhost:5173/`) to start sculpting your ring profile live in the browser.

## Controls
- Drag the white handles in the profile canvas (bottom-left) to reshape the cross-section curve.
- Use the sliders to adjust the number of profiles distributed around the circle, twist the copies progressively, scale the overall profile, and apply a taper across the sweep.
- Orbit, pan, and zoom the viewport with your mouse (or trackpad) via OrbitControls to inspect the mesh from every angle.
