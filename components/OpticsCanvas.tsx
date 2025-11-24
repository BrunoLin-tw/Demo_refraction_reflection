import React, { useRef, useEffect, useState } from 'react';
import { PrismData, LightSourceData, Point, Vector, Ray } from '../types';
import { add, sub, normalize, rotate, scale, intersectRaySegment, dot, distance } from '../utils/vector';

interface OpticsCanvasProps {
  prismIOR: number;
}

// Wavelength presets for dispersion (Pink Floyd rainbow style)
const SPECTRUM = [
  { color: '#ff0000', wlOffset: -0.03, intensity: 1.0 }, // Red
  { color: '#ffa500', wlOffset: -0.02, intensity: 0.9 }, // Orange
  { color: '#ffff00', wlOffset: -0.01, intensity: 0.9 }, // Yellow
  { color: '#00ff00', wlOffset: 0.00, intensity: 0.9 },  // Green
  { color: '#00ffff', wlOffset: 0.01, intensity: 0.9 },  // Cyan
  { color: '#0000ff', wlOffset: 0.02, intensity: 0.9 },  // Blue
  { color: '#8b00ff', wlOffset: 0.03, intensity: 0.8 },  // Violet
];

const OpticsCanvas: React.FC<OpticsCanvasProps> = ({ prismIOR }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Screen state
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Physics State
  const [prism, setPrism] = useState<PrismData>({
    center: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    rotation: Math.PI / 6, // Start flat bottom
    sideLength: 250,
    refractiveIndex: prismIOR,
  });

  const [light, setLight] = useState<LightSourceData>({
    position: { x: window.innerWidth * 0.15, y: window.innerHeight / 2 },
    angle: -0.1, // Slight downward tilt
  });

  // Interaction State
  const interactionRef = useRef<{
    dragging: 'prism' | 'light' | 'rotatePrism' | null;
    lastMouse: Point;
  }>({ dragging: null, lastMouse: { x: 0, y: 0 } });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
      // Recenter prism on resize if not moved too far? No, let's leave it.
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Helper: Get Triangle Vertices
  const getPrismVertices = (p: PrismData): Point[] => {
    const radius = p.sideLength / Math.sqrt(3);
    const angles = [
      p.rotation - Math.PI / 2,
      p.rotation - Math.PI / 2 + (2 * Math.PI) / 3,
      p.rotation - Math.PI / 2 + (4 * Math.PI) / 3,
    ];
    return angles.map((a) => ({
      x: p.center.x + radius * Math.cos(a),
      y: p.center.y + radius * Math.sin(a),
    }));
  };

  // --- PHYSICS ENGINE ---

  const traceRay = (
    ray: Ray,
    depth: number,
    vertices: Point[],
    segments: { p1: Point; p2: Point; color: string; width: number; blur: number }[]
  ) => {
    if (depth > 4) return;

    let closestHit: { point: Point; t: number; normal: Vector; boundaryIndex: number } | null = null;

    // Check intersection with all 3 prism sides
    for (let i = 0; i < 3; i++) {
      const p1 = vertices[i];
      const p2 = vertices[(i + 1) % 3];
      const hit = intersectRaySegment(ray.origin, ray.direction, p1, p2);

      if (hit) {
        if (!closestHit || hit.t < closestHit.t) {
          closestHit = { ...hit, boundaryIndex: i };
        }
      }
    }

    if (closestHit) {
      // Draw ray to hit point
      segments.push({
        p1: ray.origin,
        p2: closestHit.point,
        color: ray.color,
        width: depth === 0 ? 3 : 1.5, // Main beam thicker
        blur: depth === 0 ? 15 : 8,
      });

      // Calculate Refraction (Snell's Law)
      const N = closestHit.normal;
      const L = ray.direction;
      const dotNL = dot(N, L);

      // Determine Entering or Exiting
      // dotNL < 0 means entering (Ray opposes Normal)
      // dotNL > 0 means exiting (Ray aligned with Normal, but our normal calc in helper always points OUT/Against incident? 
      // Wait, helper `intersectRaySegment` flips normal to oppose ray. 
      // So `normal` is always pointing towards where the ray came from (into the medium 1).
      // Actually, standard Snell's: Normal points OUT of surface.
      // Let's trust the vector math derivation below.
      
      // Re-verify helper normal logic: 
      // Helper returns normal opposing ray. So N points INTO the volume the ray is currently in.
      // If ray is in AIR, hitting glass, helper N points into AIR.
      // If ray is in GLASS, hitting air, helper N points into GLASS.
      
      let n1 = 1.0; // Air
      let n2 = prismIOR + ray.wavelength; // Glass with dispersion
      
      // Logic check: Are we inside or outside?
      // We can track this via a flag, or by assuming even depth = inside. 
      // Better: Dot product of Normal (pointing out of surface geometry) vs Ray.
      // Let's assume standard Geometry Normal (pointing Out from Triangle Center).
      
      const edgeP1 = vertices[closestHit.boundaryIndex];
      const edgeP2 = vertices[(closestHit.boundaryIndex + 1) % 3];
      const edgeDir = sub(edgeP2, edgeP1);
      let geoNormal = normalize({ x: -edgeDir.y, y: edgeDir.x });
      
      // Ensure geoNormal points OUT of the triangle center
      const toCenter = sub(prism.center, edgeP1);
      if (dot(geoNormal, toCenter) > 0) {
        geoNormal = scale(geoNormal, -1);
      }

      const entering = dot(L, geoNormal) < 0;
      
      if (!entering) {
        // Exiting: Glass to Air
        n1 = prismIOR + ray.wavelength;
        n2 = 1.0;
        // For exiting, geometry normal is aligned with movement roughly, but math expects N against L for incident angle calc usually.
        // Let's use the standard vector refraction formula:
        // r = (n1/n2) * i + ( (n1/n2)*cos(theta1) - sqrt(1 - (n1/n2)^2 * sin^2(theta1)) ) * n
        // Where n is surface normal facing TOWARDS incident medium.
      } 

      // Standardize N to face the Incident Medium
      const orientedN = entering ? geoNormal : scale(geoNormal, -1);
      
      const eta = n1 / n2;
      const c1 = -dot(L, orientedN); // cos(theta1)
      const cs2 = 1 - eta * eta * (1 - c1 * c1); // cos^2(theta2)

      if (cs2 < 0) {
        // Total Internal Reflection
        const reflectedDir = sub(L, scale(orientedN, 2 * dot(L, orientedN)));
        const offsetOrigin = add(closestHit.point, scale(reflectedDir, 0.01));
         traceRay({
          origin: offsetOrigin,
          direction: normalize(reflectedDir),
          color: ray.color,
          wavelength: ray.wavelength,
          intensity: ray.intensity
        }, depth + 1, vertices, segments);
      } else {
        // Refraction
        const refractDir = add(scale(L, eta), scale(orientedN, eta * c1 - Math.sqrt(cs2)));
        const offsetOrigin = add(closestHit.point, scale(refractDir, 0.01)); // Push slightly to avoid self-intersect
        
        traceRay({
          origin: offsetOrigin,
          direction: normalize(refractDir),
          color: ray.color,
          wavelength: ray.wavelength,
          intensity: ray.intensity
        }, depth + 1, vertices, segments);
      }

    } else {
      // No hit, goes to infinity (screen edge)
      // Just draw a long line
      const endPoint = add(ray.origin, scale(ray.direction, 2000));
      segments.push({
        p1: ray.origin,
        p2: endPoint,
        color: ray.color,
        width: depth === 0 ? 3 : (depth === 2 ? 2 : 6), // Dispersion rays are thicker/fuzzier
        blur: depth === 0 ? 10 : 20,
      });
    }
  };


  // --- RENDERING LOOP ---

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vertices = getPrismVertices(prism);
    
    // Clear
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // --- Draw Prism ---
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    ctx.lineTo(vertices[1].x, vertices[1].y);
    ctx.lineTo(vertices[2].x, vertices[2].y);
    ctx.closePath();

    // Prism Glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Slight Glass Tint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fill();
    
    // Reset Shadow for Rays
    ctx.shadowBlur = 0;

    // --- Ray Tracing ---
    
    // Enable additive blending for "Light" look
    ctx.globalCompositeOperation = 'lighter';

    const segmentsToDraw: { p1: Point; p2: Point; color: string; width: number; blur: number }[] = [];

    // Initial White Ray
    const initialRayDir: Vector = { Math: Math.cos(light.angle), y: Math.sin(light.angle) } as any;
    // Fix vector creation manually
    const dir = { x: Math.cos(light.angle), y: Math.sin(light.angle) };

    // 1. Trace the main white beam first up to the prism
    // Wait, the recursive function handles splitting if we pass multiple wavelengths?
    // Strategy: Trace ONE white ray. If it hits prism, stop drawing white ray at hit point, and spawn spectral rays.
    
    // Actually, simpliest way for visual dispersion:
    // Always trace ALL spectral colors from the source, but stack them perfectly on top of each other 
    // until they hit the refractive medium where their 'n' differs.
    // Because of additive blending, R+G+B... = White. 
    
    SPECTRUM.forEach(spec => {
       traceRay({
         origin: light.position,
         direction: dir,
         color: spec.color,
         wavelength: spec.wlOffset,
         intensity: spec.intensity
       }, 0, vertices, segmentsToDraw);
    });

    // Draw all segments
    segmentsToDraw.forEach(seg => {
      ctx.beginPath();
      ctx.moveTo(seg.p1.x, seg.p1.y);
      ctx.lineTo(seg.p2.x, seg.p2.y);
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = seg.width;
      ctx.shadowColor = seg.color;
      ctx.shadowBlur = seg.blur;
      ctx.stroke();
    });

    // Reset composite
    ctx.globalCompositeOperation = 'source-over';

    // --- Draw Controls / Handles ---
    
    // Light Source
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'white';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(light.position.x, light.position.y, 8, 0, Math.PI * 2);
    ctx.fill();

    // Prism Rotation Handle (Top vertex usually)
    // Let's draw a small circle at the center for movement
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(prism.center.x, prism.center.y, 5, 0, Math.PI * 2);
    ctx.fill();

  }, [prism, light, dimensions, prismIOR]); // Re-render on state change


  // --- INTERACTION HANDLERS ---

  const handleMouseDown = (e: React.MouseEvent) => {
    const mouse = { x: e.clientX, y: e.clientY };
    
    // Check Light
    if (distance(mouse, light.position) < 20) {
      interactionRef.current = { dragging: 'light', lastMouse: mouse };
      return;
    }

    // Check Prism Center (Move)
    if (distance(mouse, prism.center) < 30) {
      interactionRef.current = { dragging: 'prism', lastMouse: mouse };
      return;
    }

    // Check Prism Rotation (roughly inside the triangle or near edge)
    // Simple check: distance from center < sideLength/2 but > 30
    if (distance(mouse, prism.center) < prism.sideLength / 2) {
        interactionRef.current = { dragging: 'rotatePrism', lastMouse: mouse };
        return;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { dragging, lastMouse } = interactionRef.current;
    if (!dragging) return;

    const mouse = { x: e.clientX, y: e.clientY };
    const dx = mouse.x - lastMouse.x;
    const dy = mouse.y - lastMouse.y;

    if (dragging === 'light') {
      // Move position
      // Also update angle to point towards prism center automatically? 
      // No, let user drag to move, maybe logic to auto-aim or separate rotate?
      // Let's just move X/Y. The angle is calculated relative to mouse movement?
      // Let's keep angle fixed relative to source, but maybe user wants to change angle.
      // Improved UX: Dragging source changes position. To change angle, we need a second handle or logic.
      // Let's make the angle look at the mouse if dragging strictly, or just move x/y.
      // Simple: Move X/Y. To change angle, maybe use scroll wheel or just aim at prism center?
      // Let's auto-aim at prism center for easier "Science" UX.
      const newPos = { x: light.position.x + dx, y: light.position.y + dy };
      const angleToPrism = Math.atan2(prism.center.y - newPos.y, prism.center.x - newPos.x);
      
      setLight({
        position: newPos,
        angle: angleToPrism
      });
    } else if (dragging === 'prism') {
      setPrism(prev => ({ ...prev, center: { x: prev.center.x + dx, y: prev.center.y + dy } }));
    } else if (dragging === 'rotatePrism') {
      // Calculate angle difference
      const ang1 = Math.atan2(lastMouse.y - prism.center.y, lastMouse.x - prism.center.x);
      const ang2 = Math.atan2(mouse.y - prism.center.y, mouse.x - prism.center.x);
      const delta = ang2 - ang1;
      setPrism(prev => ({ ...prev, rotation: prev.rotation + delta }));
    }

    interactionRef.current.lastMouse = mouse;
  };

  const handleMouseUp = () => {
    interactionRef.current.dragging = null;
  };

  return (
    <canvas
      ref={canvasRef}
      width={dimensions.width}
      height={dimensions.height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="cursor-crosshair block touch-none"
    />
  );
};

export default OpticsCanvas;
