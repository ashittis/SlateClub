"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import * as THREE from "three";

interface Props {
  /** Defaults to filling its parent; pass e.g. "absolute inset-0" to use as a backdrop. */
  className?: string;
}

/*
  ShaderAnimation — a live WebGL radial line-burst (Three.js), warm-tinted to
  the SlateClub brand ramp (crimson → rust → amber on black) so it reads as a
  glowing film-projector flare rather than a rainbow. Self-animates via its own
  RAF loop; GSAP fades the canvas in on mount. Renders null if WebGL is
  unavailable so a CSS fallback behind it can show through.
*/
export function ShaderAnimation({ className = "h-full w-full" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    uniforms: { time: { value: number }; resolution: { value: THREE.Vector2 } };
    animationId: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const vertexShader = `
      void main() {
        gl_Position = vec4( position, 1.0 );
      }
    `;

    // Warm-tinted radial line-burst. The 3 phase-shifted fields give a subtle
    // chromatic shimmer at line edges; intensity is mapped through the brand
    // ramp (black → #95122C → #CA3F16 → #FF9408 → hot amber).
    const fragmentShader = `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;

      void main(void) {
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        float t = time * 0.05;
        float lineWidth = 0.002;

        vec3 e = vec3(0.0);
        for (int j = 0; j < 3; j++) {
          for (int i = 0; i < 5; i++) {
            e[j] += lineWidth * float(i * i) /
              abs(fract(t - 0.01 * float(j) + float(i) * 0.01) * 5.0 - length(uv) + mod(uv.x + uv.y, 0.2));
          }
        }

        float m = clamp((e.r + e.g + e.b) * 0.6, 0.0, 1.6);

        vec3 crimson = vec3(0.584, 0.071, 0.173);  // #95122C
        vec3 rust    = vec3(0.792, 0.247, 0.086);  // #CA3F16
        vec3 amber   = vec3(1.000, 0.580, 0.031);  // #FF9408

        vec3 col = mix(crimson, rust, smoothstep(0.0, 0.5, m));
        col = mix(col, amber, smoothstep(0.4, 1.0, m));
        col = mix(vec3(0.0), col, clamp(m, 0.0, 1.0));     // dark gaps fall to black
        col += amber * max(0.0, m - 1.0);                  // hot cores bloom warm-white
        col += (e - vec3((e.r + e.g + e.b) / 3.0)) * vec3(0.6, 0.25, 0.0); // warm shimmer

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const camera = new THREE.Camera();
    camera.position.z = 1;

    const scene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(2, 2);

    const uniforms = {
      time: { value: 1.0 },
      resolution: { value: new THREE.Vector2() },
    };

    const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      // WebGL unavailable — bail so the CSS fallback shows.
      geometry.dispose();
      material.dispose();
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const onWindowResize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height);
      uniforms.resolution.value.x = renderer.domElement.width;
      uniforms.resolution.value.y = renderer.domElement.height;
    };
    onWindowResize();
    window.addEventListener("resize", onWindowResize, false);

    // Gentle GSAP reveal (instant under reduced motion).
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      gsap.fromTo(renderer.domElement, { opacity: 0 }, { opacity: 1, duration: 1, ease: "power2.out" });
    }

    const animate = () => {
      const animationId = requestAnimationFrame(animate);
      uniforms.time.value += 0.05;
      renderer.render(scene, camera);
      if (sceneRef.current) sceneRef.current.animationId = animationId;
    };

    sceneRef.current = { renderer, uniforms, animationId: 0 };
    animate();

    return () => {
      window.removeEventListener("resize", onWindowResize);
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
        const el = sceneRef.current.renderer.domElement;
        if (container && el.parentNode === container) container.removeChild(el);
        sceneRef.current.renderer.dispose();
        sceneRef.current = null;
      }
      geometry.dispose();
      material.dispose();
    };
  }, []);

  if (failed) return null;

  return <div ref={containerRef} aria-hidden className={className} style={{ overflow: "hidden" }} />;
}
