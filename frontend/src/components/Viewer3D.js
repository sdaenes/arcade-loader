import React, { useEffect, useRef, useState } from 'react';
import styles from './Viewer3D.module.css';

export default function Viewer3D({ truckData }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const [threeLoaded, setThreeLoaded] = useState(false);

  useEffect(() => {
    function initScene(THREE) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a14);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(8, 6, 10);
    camera.lookAt(0, 0, 0);

    // Lights
    const ambient = new THREE.AmbientLight(0x404060, 1.5);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0x00f5ff, 1.5);
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0xff00aa, 0.5);
    fillLight.position.set(-5, 2, -5);
    scene.add(fillLight);

    // Grid
    const grid = new THREE.GridHelper(30, 30, 0x1a1a3a, 0x1a1a3a);
    scene.add(grid);

    // Mouse orbit
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let spherical = { theta: Math.PI / 4, phi: Math.PI / 3, radius: 14 };

    function updateCamera() {
      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = spherical.radius * Math.cos(spherical.phi);
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(0, 0, 0);
    }
    updateCamera();

    canvas.addEventListener('mousedown', (e) => { isDragging = true; prevMouse = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('mouseup', () => { isDragging = false; });
    canvas.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = (e.clientX - prevMouse.x) * 0.01;
      const dy = (e.clientY - prevMouse.y) * 0.01;
      spherical.theta -= dx;
      spherical.phi = Math.max(0.2, Math.min(Math.PI / 2, spherical.phi + dy));
      prevMouse = { x: e.clientX, y: e.clientY };
      updateCamera();
    });
    canvas.addEventListener('wheel', (e) => {
      spherical.radius = Math.max(3, Math.min(40, spherical.radius + e.deltaY * 0.02));
      updateCamera();
    });

    // Groups
    const truckGroup = new THREE.Group();
    scene.add(truckGroup);

    function hexToThree(hex) {
      return new THREE.Color(hex || '#00f5ff');
    }

    function buildTruck(data) {
      // Clear
      while (truckGroup.children.length > 0) {
        const obj = truckGroup.children[0];
        obj.geometry && obj.geometry.dispose();
        obj.material && obj.material.dispose();
        truckGroup.remove(obj);
      }

      if (!data) return;

      const tw = data.dimensions.width;
      const th = data.dimensions.height;
      const td = data.dimensions.depth;

      // Truck wireframe container
      const truckGeo = new THREE.BoxGeometry(tw, th, td);
      const truckEdges = new THREE.EdgesGeometry(truckGeo);
      const truckLine = new THREE.LineSegments(
        truckEdges,
        new THREE.LineBasicMaterial({ color: 0xffaa00, linewidth: 2, transparent: true, opacity: 0.7 })
      );
      truckLine.position.set(tw / 2, th / 2, td / 2);
      truckGroup.add(truckLine);

      // Floor
      const floorGeo = new THREE.PlaneGeometry(tw, td);
      const floorMat = new THREE.MeshBasicMaterial({ color: 0x0d0d1a, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(tw / 2, 0.001, td / 2);
      truckGroup.add(floor);

      // Cabinets
      for (const p of data.placements) {
        const color = hexToThree(p.color);

        // Box mesh
        const geo = new THREE.BoxGeometry(p.width - 0.02, p.height - 0.02, p.depth - 0.02);
        const mat = new THREE.MeshLambertMaterial({
          color,
          transparent: true,
          opacity: 0.75,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(p.x + p.width / 2, p.y + p.height / 2, p.z + p.depth / 2);
        mesh.castShadow = true;
        truckGroup.add(mesh);

        // Edges
        const edges = new THREE.EdgesGeometry(geo);
        const edgeMat = new THREE.LineBasicMaterial({ color, linewidth: 1 });
        const edgeLines = new THREE.LineSegments(edges, edgeMat);
        edgeLines.position.copy(mesh.position);
        truckGroup.add(edgeLines);
      }

      // Center camera on truck
      const cx = tw / 2;
      const cy = th / 2;
      const cz = td / 2;
      scene.position.set(-cx, -cy / 2, -cz);
    }

    buildTruck(truckData);

    // Animate
    let animId;
    function animate() {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    // Resize
    const observer = new ResizeObserver(() => {
      const w2 = canvas.clientWidth;
      const h2 = canvas.clientHeight;
      renderer.setSize(w2, h2, false);
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
    });
    observer.observe(canvas);

    sceneRef.current = {
      updateTruck: buildTruck,
      dispose: () => {
        cancelAnimationFrame(animId);
        observer.disconnect();
        renderer.dispose();
      },
    };
  }

    import('three').then((THREE) => {
      setThreeLoaded(true);
      initScene(THREE);
    });

    return () => {
      if (sceneRef.current) {
        sceneRef.current.dispose();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (threeLoaded && sceneRef.current) {
      sceneRef.current.updateTruck(truckData);
    }
  }, [truckData, threeLoaded]);

  return (
    <div className={styles.viewerWrapper}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.hint}>Cliquer-glisser pour pivoter • Scroll pour zoomer</div>
    </div>
  );
}
