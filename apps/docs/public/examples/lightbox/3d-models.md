# 3D models

Three.js product grid with Lightbox.Slides — onBeforeOpen preheats GLBs before the morph; shared orbit with each trigger.

## Source

```tsx examples/lightbox/3d-models/page.tsx
'use client';

import * as React from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { Lightbox } from 'ramka';

import { ExampleShell } from '../../../../_components/example-shell';
import {
  LightboxGallery,
  triggerFocusClass,
} from '../../../../_components/lightbox-chrome';

const assetBase =
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models';

/** Shared square frame for every trigger + Media so tiles match in the grid. */
const FRAME_SIZE = 1024;

/** Each product mounts its own lightbox; trigger + Media each get a Three.js canvas. */
const products = [
  {
    id: 'shoe',
    name: 'Materials Variants Shoe',
    material: 'Leather · multi-variant',
    src: `${assetBase}/MaterialsVariantsShoe/glTF-Binary/MaterialsVariantsShoe.glb`,
  },
  {
    id: 'chair',
    name: 'Damask Chair',
    material: 'Purple & gold fabric',
    src: `${assetBase}/ChairDamaskPurplegold/glTF-Binary/ChairDamaskPurplegold.glb`,
  },
  {
    id: 'bottle',
    name: 'Water Bottle',
    material: 'Brushed metal',
    src: `${assetBase}/WaterBottle/glTF-Binary/WaterBottle.glb`,
  },
  {
    id: 'helmet',
    name: 'Damaged Helmet',
    material: 'Sci-fi prop',
    src: `${assetBase}/DamagedHelmet/glTF-Binary/DamagedHelmet.glb`,
  },
] as const;

type Product = (typeof products)[number];

const gltfCache = new Map<string, Promise<THREE.Group>>();

/** Underlying load promise (one scene per URL). Prefer {@link loadGltf} for mounts. */
function getGltfPromise(url: string): Promise<THREE.Group> {
  let hit = gltfCache.get(url);
  if (!hit) {
    hit = new Promise((resolve, reject) => {
      new GLTFLoader().load(
        url,
        (gltf) => resolve(gltf.scene),
        undefined,
        reject,
      );
    });
    gltfCache.set(url, hit);
  }
  return hit;
}

/** Clone a cached GLB for a canvas mount. */
function loadGltf(url: string): Promise<THREE.Group> {
  return getGltfPromise(url).then((scene) => scene.clone(true));
}

/**
 * Open-prepare gate: wait until the prepared lightbox canvas has loaded, synced
 * pose from the (still spinning) trigger, and painted — then start the VT.
 * We intentionally do NOT freeze spin: close feels smooth because motion stays
 * live through the morph; freezing until `onOpenChangeComplete` caused the
 * post-open “dead then start moving” hitch.
 */
type PaintGate = {
  painted: boolean;
  waiters: Set<() => void>;
};

const paintGates = new Map<string, PaintGate>();

function getPaintGate(productId: string): PaintGate {
  let gate = paintGates.get(productId);
  if (!gate) {
    gate = { painted: false, waiters: new Set() };
    paintGates.set(productId, gate);
  }
  return gate;
}

function resetPaintGate(productId: string) {
  const gate = getPaintGate(productId);
  gate.painted = false;
}

function markLightboxPainted(productId: string) {
  const gate = getPaintGate(productId);
  if (gate.painted) return;
  gate.painted = true;
  for (const waiter of gate.waiters) waiter();
  gate.waiters.clear();
}

/** Wait until the prepared lightbox has painted (or abort / timeout). Always resolves. */
function waitForLightboxPainted(
  productId: string,
  { signal, timeoutMs }: { signal: AbortSignal; timeoutMs: number },
): Promise<void> {
  const gate = getPaintGate(productId);
  if (signal.aborted || gate.painted) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      gate.waiters.delete(finish);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    gate.waiters.add(finish);
    signal.addEventListener('abort', finish, { once: true });
    if (gate.painted) finish();
  });
}

/**
 * Center the model and scale so its longest axis is 1. Returns a wrapper at the
 * origin so every asset frames at the same camera distance.
 */
function normalizeModel(model: THREE.Object3D): THREE.Group {
  const wrapped = new THREE.Group();
  wrapped.add(model);
  model.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;

  model.position.sub(center);
  wrapped.scale.setScalar(1 / maxDim);
  wrapped.updateMatrixWorld(true);
  return wrapped;
}

/** Fixed framing for {@link normalizeModel} unit-sized roots (target at origin). */
function fitCameraToUnitObject(
  camera: THREE.PerspectiveCamera,
  controls: TrackballControls,
) {
  const maxSize = 1;
  const fitHeightDistance =
    maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  const fitWidthDistance = fitHeightDistance / Math.max(camera.aspect, 0.001);
  const distance = 1.45 * Math.max(fitHeightDistance, fitWidthDistance);
  camera.near = distance / 100;
  camera.far = distance * 100;
  controls.target.set(0, 0, 0);
  camera.up.set(0, 1, 0);
  camera.position.set(distance * 0.35, distance * 0.2, distance);
  camera.lookAt(controls.target);
  camera.updateProjectionMatrix();
}

/**
 * Shared view orientation (no radius — each canvas keeps its own fit distance).
 * Trackball uses free camera.up, so we sync look-direction + up, not polar angles.
 * `spinAxis` / `spinSpeed` — one continuous coast that eases toward auto-spin.
 */
type ViewPose = {
  direction: [number, number, number];
  up: [number, number, number];
  spinAxis: [number, number, number];
  /** rad/s around {@link ViewPose.spinAxis} */
  spinSpeed: number;
};

type SpinState = {
  axis: THREE.Vector3;
  /** rad/s — eases toward {@link TARGET_SPIN_RAD_PER_SEC} after each flick */
  speed: number;
};

/** Trackball internals — used only to sample flick axis/speed on pointer up. */
type TrackballInertia = TrackballControls & {
  _eye: THREE.Vector3;
  _lastPosition: THREE.Vector3;
  _lastAxis: THREE.Vector3;
  _lastAngle: number;
};

type ViewStore = {
  pose: ViewPose | null;
  listeners: Set<(pose: ViewPose, source: symbol) => void>;
  set(pose: ViewPose, source: symbol): void;
  subscribe(fn: (pose: ViewPose, source: symbol) => void): () => void;
};

const viewStores = new Map<string, ViewStore>();

function getViewStore(productId: string): ViewStore {
  let store = viewStores.get(productId);
  if (!store) {
    store = {
      pose: null,
      listeners: new Set(),
      set(pose, source) {
        this.pose = pose;
        for (const listener of this.listeners) listener(pose, source);
      },
      subscribe(fn) {
        this.listeners.add(fn);
        return () => {
          this.listeners.delete(fn);
        };
      },
    };
    viewStores.set(productId, store);
  }
  return store;
}

const _offset = new THREE.Vector3();
const _direction = new THREE.Vector3();
const _up = new THREE.Vector3();

/** Auto-spin cruise speed — same units as OrbitControls.autoRotateSpeed (revs / 60s). */
const TRIGGER_AUTO_ROTATE_SPEED = 1;
const TARGET_SPIN_RAD_PER_SEC = ((2 * Math.PI) / 60) * TRIGGER_AUTO_ROTATE_SPEED;
/** How quickly flick speed eases into the cruise speed (higher = snappier). */
const SPIN_SPEED_BLEND = 2.2;

/** Unit look-direction + up; radius stays local to each canvas. */
function readViewPose(
  camera: THREE.PerspectiveCamera,
  controls: TrackballControls,
  spin: SpinState,
): ViewPose {
  _direction.copy(camera.position).sub(controls.target).normalize();
  _up.copy(camera.up).normalize();
  return {
    direction: [_direction.x, _direction.y, _direction.z],
    up: [_up.x, _up.y, _up.z],
    spinAxis: [spin.axis.x, spin.axis.y, spin.axis.z],
    spinSpeed: spin.speed,
  };
}

function applyViewPose(
  camera: THREE.PerspectiveCamera,
  controls: TrackballControls,
  pose: ViewPose,
  spin: SpinState,
) {
  const tb = controls as TrackballInertia;
  const radius = camera.position.distanceTo(controls.target) || 1;
  _direction.fromArray(pose.direction).normalize();
  _up.fromArray(pose.up).normalize();
  camera.position.copy(controls.target).addScaledVector(_direction, radius);
  camera.up.copy(_up);
  camera.lookAt(controls.target);
  tb._eye.subVectors(camera.position, controls.target);
  tb._lastPosition.copy(camera.position);
  // We own coasting — don't let Trackball damping fight the blended spin.
  tb._lastAngle = 0;
  if (pose.spinAxis[0] !== 0 || pose.spinAxis[1] !== 0 || pose.spinAxis[2] !== 0) {
    spin.axis.fromArray(pose.spinAxis).normalize();
  }
  if (Number.isFinite(pose.spinSpeed)) {
    spin.speed = Math.max(0, pose.spinSpeed);
  }
}

/** Sample flick axis + rad/s from Trackball, then clear its private damping. */
function captureFlickIntoSpin(
  controls: TrackballControls,
  spin: SpinState,
  dt: number,
) {
  const tb = controls as TrackballInertia;
  if (tb._lastAxis.lengthSq() > 1e-8) {
    spin.axis.copy(tb._lastAxis).normalize();
  }
  // `_lastAngle` is rad/frame; convert with the latest frame dt.
  const frameDt = Math.max(dt, 1 / 120);
  if (Math.abs(tb._lastAngle) > 1e-6) {
    spin.speed = Math.abs(tb._lastAngle) / frameDt;
  }
  tb._lastAngle = 0;
}

function applySpinStep(
  camera: THREE.PerspectiveCamera,
  controls: TrackballControls,
  spin: SpinState,
  dt: number,
) {
  // Ease flick velocity toward the cruise auto-spin — never drops through zero.
  const blend = 1 - Math.exp(-SPIN_SPEED_BLEND * dt);
  spin.speed += (TARGET_SPIN_RAD_PER_SEC - spin.speed) * blend;

  const angle = spin.speed * dt;
  if (Math.abs(angle) < 1e-8) return;

  _offset.copy(camera.position).sub(controls.target);
  _offset.applyAxisAngle(spin.axis, angle);
  camera.position.copy(controls.target).add(_offset);
  camera.up.applyAxisAngle(spin.axis, angle);
  camera.lookAt(controls.target);

  const tb = controls as TrackballInertia;
  tb._eye.subVectors(camera.position, controls.target);
  tb._lastPosition.copy(camera.position);
}

/**
 * Mount a disposable `<canvas>` inside `host` and bind Three.js to it.
 * Canvas is created/destroyed in the effect so `forceContextLoss` never
 * poisons a React-owned element (Strict Mode remount / reopen).
 * Free trackball rotate (no zoom/pan). Pose is synced across trigger + lightbox.
 */
function useThreeCanvas(
  hostRef: React.RefObject<HTMLElement | null>,
  product: Product,
  interactive: boolean,
  /** Idle spin for grid tiles; pause while lightbox is open so it doesn’t fight orbit. */
  autoRotate = false,
  /**
   * Lightbox canvases signal {@link markLightboxPainted} after a pose-synced
   * frame so `onBeforeOpen` can wait before the morph.
   */
  role: 'trigger' | 'lightbox' = 'trigger',
) {
  const controlsRef = React.useRef<TrackballControls | null>(null);
  const autoRotateRef = React.useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  React.useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Own the canvas node — after forceContextLoss a canvas cannot host WebGL again.
    const canvas = document.createElement('canvas');
    canvas.className = 'absolute inset-0 block size-full bg-transparent';
    canvas.style.touchAction = 'none';
    host.appendChild(canvas);

    const sourceId = Symbol(product.id);
    const store = getViewStore(product.id);
    let paintSignaled = false;
    if (role === 'lightbox') resetPaintGate(product.id);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    pmrem.dispose();

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2.5, 4, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.7);
    fill.position.set(-3, 1.5, -2);
    scene.add(fill);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    // Trackball (not Orbit): vertical drag can pass the poles without locking.
    const controls = new TrackballControls(camera, canvas);
    controls.noPan = true;
    controls.noZoom = true;
    controls.rotateSpeed = 1.4;
    controls.dynamicDampingFactor = 0.15;
    controls.enabled = interactive;
    controlsRef.current = controls;

    // Continuous spin state: flick speed eases into cruise auto-spin (no dead zone).
    const spin: SpinState = {
      axis: store.pose?.spinAxis
        ? new THREE.Vector3().fromArray(store.pose.spinAxis).normalize()
        : new THREE.Vector3(0, 1, 0),
      speed: store.pose?.spinSpeed ?? TARGET_SPIN_RAD_PER_SEC,
    };

    let frame = 0;
    let disposed = false;
    let applyingShared = false;
    let userDragging = false;
    let lastFrameTime = performance.now();
    let lastDt = 1 / 60;
    // Don't sync until the model is fitted — a pre-fit camera at the origin
    // would publish garbage poses into the store and twist the peer on open.
    let ready = false;

    const publishPose = () => {
      // Blocked while fitting / applying shared pose so a fresh lightbox fit
      // cannot clobber the trigger’s rotation in the store.
      if (!ready || applyingShared || disposed) return;
      store.set(readViewPose(camera, controls, spin), sourceId);
    };

    const onControlsChange = () => {
      publishPose();
    };
    controls.addEventListener('change', onControlsChange);

    // Pause idle spin while the user drags; on release, coast from flick → cruise.
    const onOrbitStart = () => {
      userDragging = true;
    };
    const onOrbitEnd = () => {
      userDragging = false;
      captureFlickIntoSpin(controls, spin, lastDt);
      publishPose();
    };
    controls.addEventListener('start', onOrbitStart);
    controls.addEventListener('end', onOrbitEnd);

    const unsub = store.subscribe((pose, source) => {
      if (!ready || source === sourceId || disposed) return;
      applyingShared = true;
      applyViewPose(camera, controls, pose, spin);
      applyingShared = false;
    });

    const setSize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (width < 1 || height < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      controls.handleResize();
    };

    const signalPaintedIfNeeded = () => {
      if (role !== 'lightbox' || !ready || disposed || paintSignaled) return;
      if (host.clientWidth < 1 || host.clientHeight < 1) return;

      paintSignaled = true;
      // Sync to the live trigger pose, then paint before the VT captures "new".
      if (store.pose) {
        applyingShared = true;
        applyViewPose(camera, controls, store.pose, spin);
        applyingShared = false;
      }
      setSize();
      controls.update();
      renderer.render(scene, camera);
      // Two rAFs: one for the GL submit, one so the composited canvas is current.
      requestAnimationFrame(() => {
        if (disposed) return;
        requestAnimationFrame(() => {
          if (disposed) return;
          markLightboxPainted(product.id);
        });
      });
    };

    const render = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
      lastFrameTime = now;
      lastDt = dt;

      if (autoRotateRef.current && !userDragging && ready) {
        applySpinStep(camera, controls, spin, dt);
        publishPose();
      }

      signalPaintedIfNeeded();
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };

    setSize();
    frame = requestAnimationFrame(render);

    const ro = new ResizeObserver(setSize);
    ro.observe(host);

    void loadGltf(product.src)
      .then((model) => {
        if (disposed) return;
        const framed = normalizeModel(model);
        scene.add(framed);

        // Capture before fit — `controls.update()` emits `change` and would
        // otherwise publish the default framing over the user’s rotation.
        const savedPose = store.pose;

        applyingShared = true;
        fitCameraToUnitObject(camera, controls);
        controls.handleResize();
        controls.update();
        if (savedPose) {
          applyViewPose(camera, controls, savedPose, spin);
        } else {
          store.set(readViewPose(camera, controls, spin), sourceId);
        }
        applyingShared = false;
        ready = true;
        signalPaintedIfNeeded();
      })
      .catch((err) => {
        console.warn('[3d-models] Failed to load GLB', product.src, err);
      });

    return () => {
      disposed = true;
      if (role === 'lightbox') resetPaintGate(product.id);
      cancelAnimationFrame(frame);
      ro.disconnect();
      unsub();
      controls.removeEventListener('change', onControlsChange);
      controls.removeEventListener('start', onOrbitStart);
      controls.removeEventListener('end', onOrbitEnd);
      // Handoff orientation + blended spin so the trigger keeps coasting after close.
      if (ready && !applyingShared) {
        captureFlickIntoSpin(controls, spin, lastDt);
        store.set(readViewPose(camera, controls, spin), sourceId);
      }
      controlsRef.current = null;
      controls.dispose();
      env.dispose();
      // Cloned GLBs share geometry/materials with the cache — do not dispose them
      // here or sibling canvases (and later remounts) will render broken meshes.
      scene.clear();
      // `dispose()` alone does not free the browser WebGL context; without
      // `forceContextLoss`, open/close cycles hit the ~8–16 context cap.
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
    // `interactive` / `autoRotate` applied in separate effects so we don’t rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per host/product
  }, [hostRef, product.id, product.src, role]);

  React.useLayoutEffect(() => {
    if (controlsRef.current) controlsRef.current.enabled = interactive;
  }, [interactive]);
}

function TriggerScene({
  product,
  autoRotate,
}: {
  product: Product;
  autoRotate: boolean;
}) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  // Grid tiles are view-only — orbit only in the lightbox.
  useThreeCanvas(hostRef, product, false, autoRotate, 'trigger');
  return <div ref={hostRef} className="absolute inset-0 size-full pointer-events-none" />;
}

function LightboxScene({
  product,
  /** Orbit input — only after open settles so it doesn’t fight the morph. */
  interactive,
  /**
   * Idle spin. True from reveal (`onOpenChange`) so motion continues through
   * the morph like close — not deferred to `onOpenChangeComplete`.
   */
  autoRotate,
}: {
  product: Product;
  interactive: boolean;
  autoRotate: boolean;
}) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  useThreeCanvas(hostRef, product, interactive, autoRotate, 'lightbox');
  return <div ref={hostRef} className="relative size-full min-h-0" />;
}

/**
 * Each model is its own `Lightbox.Root` (no shared gallery) so open/close is a
 * single tile → fullscreen morph — same pattern as film-trailers.
 */
function ProductLightbox({ product }: { product: Product }) {
  const [orbitReady, setOrbitReady] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  return (
    <Lightbox.Root
      awaitImageDecode={false}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setOrbitReady(false);
      }}
      onBeforeOpen={async ({ signal }) => {
        // Prepare already mounted the lightbox (hidden). Keep the trigger
        // spinning; wait until the lightbox has synced + painted, then morph
        // while motion stays live (same feel as close).
        await waitForLightboxPainted(product.id, { signal, timeoutMs: 2500 });
      }}
      onOpenChangeComplete={(nextOpen) => {
        // Orbit only after open settles (avoid fighting the morph).
        setOrbitReady(nextOpen);
      }}
    >
      <Lightbox.Trigger
        index={0}
        className={`group block w-full cursor-pointer rounded-xl border-none bg-transparent p-0 text-center ${triggerFocusClass}`}
        crossfade="both"
      >
        {({ morphRef }) => (
          <>
            <div
              ref={morphRef}
              className={`relative aspect-square w-full overflow-hidden rounded-xl bg-transparent`}
            >
              {/* Pause grid spin while this lightbox is open. */}
              <TriggerScene product={product} autoRotate={!open} />
            </div>
            <div className="px-0.5 pt-2.5 text-center">
              <div className="text-sm font-medium leading-snug">{product.name}</div>
              <div className="text-xs text-muted-foreground">{product.material}</div>
            </div>
          </>
        )}
      </Lightbox.Trigger>

      <LightboxGallery
        items={[
          {
            id: product.id,
            src: product.src,
            thumb: product.src,
            alt: product.name,
            caption: `${product.name} · ${product.material}`,
          },
        ]}
        ariaLabel={product.name}
        preload={0}
        thumbnails="never"
        zoomControls={false}
        renderItem={() => (
          <div className="flex size-full items-center justify-center">
            <Lightbox.Media
              width={FRAME_SIZE}
              height={FRAME_SIZE}
              className="overflow-hidden rounded-xl bg-transparent"
            >
              <LightboxScene
                product={product}
                interactive={orbitReady}
                // Spin from reveal so the post-morph canvas is already moving.
                autoRotate={open}
              />
            </Lightbox.Media>
          </div>
        )}
      />
    </Lightbox.Root>
  );
}

export default function ThreeDModelsPage() {
  return (
    <ExampleShell
      title="3D models"
      docsHref="/docs/lightbox/state-lifecycle#before-open"
      docsLabel="State & lifecycle · onBeforeOpen"
      description={
        <>
          Each tile is its own{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
            Lightbox.Root
          </code>{' '}
          with a single-item gallery — Three.js canvases in the trigger and{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
            Lightbox.Media
          </code>
          . <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
            onBeforeOpen
          </code>{' '}
          waits for the prepared lightbox canvas to paint a synced frame before the morph (spin
          stays live, like close). Rotate only (no zoom); orbit stays in sync with the grid tile.{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
            pullToClose={'{false}'}
          </code>{' '}
          so vertical drag stays with orbit.
        </>
      }
    >
      <div className="max-w-3xl">
        <div className="py-5">
          <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Object studio
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Khronos sample assets</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Open any model. Orbit stays in sync with the grid tile.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {products.map((product) => (
            <ProductLightbox key={product.id} product={product} />
          ))}
        </div>
      </div>
    </ExampleShell>
  );
}
```
