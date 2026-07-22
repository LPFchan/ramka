'use client';

import * as React from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Lightbox, useLightboxItemContext } from 'ramka';

import { ExampleShell } from '../../../_components/example-shell';
import {
  LightboxGallery,
  morphHideClass,
  triggerFocusClass,
} from '../../../_components/lightbox-chrome';

const assetBase =
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models';

/** Grid + lightbox both mount a Three.js canvas inside the morph host / Media. */
const products = [
  {
    id: 'shoe',
    name: 'Materials Variants Shoe',
    material: 'Leather · multi-variant',
    width: 1958,
    height: 808,
    src: `${assetBase}/MaterialsVariantsShoe/glTF-Binary/MaterialsVariantsShoe.glb`,
  },
  {
    id: 'chair',
    name: 'Damask Chair',
    material: 'Purple & gold fabric',
    width: 1280,
    height: 970,
    src: `${assetBase}/ChairDamaskPurplegold/glTF-Binary/ChairDamaskPurplegold.glb`,
  },
  {
    id: 'bottle',
    name: 'Water Bottle',
    material: 'Brushed metal',
    width: 512,
    height: 512,
    src: `${assetBase}/WaterBottle/glTF-Binary/WaterBottle.glb`,
  },
  {
    id: 'helmet',
    name: 'Damaged Helmet',
    material: 'Sci-fi prop',
    width: 512,
    height: 512,
    src: `${assetBase}/DamagedHelmet/glTF-Binary/DamagedHelmet.glb`,
  },
] as const;

type Product = (typeof products)[number];

const gltfCache = new Map<string, Promise<THREE.Group>>();

function loadGltf(url: string): Promise<THREE.Group> {
  let hit = gltfCache.get(url);
  if (!hit) {
    hit = new Promise((resolve, reject) => {
      new GLTFLoader().load(
        url,
        (gltf) => resolve(gltf.scene.clone(true)),
        undefined,
        reject,
      );
    });
    gltfCache.set(url, hit);
  }
  return hit.then((scene) => scene.clone(true));
}

function fitCameraToObject(camera: THREE.PerspectiveCamera, object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z) || 1;
  const fitHeightDistance = maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  const distance = 1.35 * Math.max(fitHeightDistance, fitWidthDistance);
  camera.near = distance / 100;
  camera.far = distance * 100;
  camera.position.set(center.x + distance * 0.35, center.y + distance * 0.2, center.z + distance);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  return center;
}

/**
 * Shared spherical orbit (no radius — each view keeps its own fit distance).
 * Live sync is angles only; `delta*` is set on unmount handoff so the peer can
 * keep coasting after the lightbox closes.
 */
type OrbitPose = {
  theta: number;
  phi: number;
  deltaTheta: number;
  deltaPhi: number;
};

/** OrbitControls keeps inertia on a private spherical; used only for close handoff. */
type OrbitControlsInertia = OrbitControls & {
  _sphericalDelta: THREE.Spherical;
};

type OrbitStore = {
  pose: OrbitPose | null;
  listeners: Set<(pose: OrbitPose, source: symbol) => void>;
  set(pose: OrbitPose, source: symbol): void;
  subscribe(fn: (pose: OrbitPose, source: symbol) => void): () => void;
};

const orbitStores = new Map<string, OrbitStore>();

function getOrbitStore(productId: string): OrbitStore {
  let store = orbitStores.get(productId);
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
    orbitStores.set(productId, store);
  }
  return store;
}

const _offset = new THREE.Vector3();
const _spherical = new THREE.Spherical();
const _yAxis = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _quatInverse = new THREE.Quaternion();

/** Read orbit angles in the same frame OrbitControls uses (see its `update()`). */
function readOrbitPose(controls: OrbitControls, includeInertia = false): OrbitPose {
  const delta = (controls as OrbitControlsInertia)._sphericalDelta;
  return {
    theta: controls.getAzimuthalAngle(),
    phi: controls.getPolarAngle(),
    // Live sync streams angles only; inertia is for unmount handoff.
    deltaTheta: includeInertia ? delta.theta : 0,
    deltaPhi: includeInertia ? delta.phi : 0,
  };
}

function applyOrbitPose(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  pose: OrbitPose,
) {
  // Match OrbitControls’ y-up spherical space so restore matches getAzimuthalAngle/getPolarAngle.
  _quat.setFromUnitVectors(camera.up, _yAxis);
  _quatInverse.copy(_quat).invert();

  _offset.copy(camera.position).sub(controls.target);
  _offset.applyQuaternion(_quat);
  _spherical.setFromVector3(_offset);
  _spherical.theta = pose.theta;
  _spherical.phi = pose.phi;
  _spherical.makeSafe();
  _offset.setFromSpherical(_spherical);
  _offset.applyQuaternion(_quatInverse);

  camera.position.copy(controls.target).add(_offset);

  const inertia = (controls as OrbitControlsInertia)._sphericalDelta;
  inertia.theta = pose.deltaTheta;
  inertia.phi = pose.deltaPhi;
  // Finalize through OrbitControls so internal spherical state stays consistent.
  controls.update();
}

/**
 * Bind Three.js to an existing `<canvas>` (direct Media / trigger child).
 * Orbit only (no zoom). Pose is synced across trigger + lightbox for `productId`.
 */
function useThreeCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  product: Product,
  interactive: boolean,
  /** Trigger: one-finger rotates. Lightbox: one-finger left for pull-to-dismiss. */
  touchMode: 'trigger' | 'lightbox',
) {
  const controlsRef = React.useRef<OrbitControls | null>(null);

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sourceId = Symbol(product.id);
    const store = getOrbitStore(product.id);

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
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = false;
    if (touchMode === 'trigger') {
      controls.touches.ONE = THREE.TOUCH.ROTATE;
      controls.touches.TWO = THREE.TOUCH.ROTATE;
    } else {
      // One-finger → lightbox pull-to-dismiss; two-finger rotates.
      controls.touches.ONE = THREE.TOUCH.PAN;
      controls.touches.TWO = THREE.TOUCH.ROTATE;
    }
    controls.enabled = interactive;
    controlsRef.current = controls;

    let frame = 0;
    let disposed = false;
    let applyingShared = false;
    // Don't sync until the model is fitted — a pre-fit camera at the origin
    // would publish garbage poses into the store and twist the peer on open.
    let ready = false;

    const publishPose = () => {
      // Blocked while fitting / applying shared pose so a fresh lightbox fit
      // cannot clobber the trigger’s rotation in the store.
      if (!ready || applyingShared || disposed) return;
      store.set(readOrbitPose(controls), sourceId);
    };

    controls.addEventListener('change', publishPose);

    const unsub = store.subscribe((pose, source) => {
      if (!ready || source === sourceId || disposed) return;
      applyingShared = true;
      applyOrbitPose(camera, controls, pose);
      applyingShared = false;
    });

    const setSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      if (width < 1 || height < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const render = () => {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };

    setSize();
    frame = requestAnimationFrame(render);

    const ro = new ResizeObserver(setSize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    void loadGltf(product.src)
      .then((model) => {
        if (disposed) return;
        scene.add(model);

        // Capture before fit — `controls.update()` emits `change` and would
        // otherwise publish the default framing over the user’s rotation.
        const savedPose = store.pose;

        applyingShared = true;
        controls.target.copy(fitCameraToObject(camera, model));
        controls.update();
        if (savedPose) {
          applyOrbitPose(camera, controls, savedPose);
        } else {
          store.set(readOrbitPose(controls), sourceId);
        }
        applyingShared = false;
        ready = true;
      })
      .catch((err) => {
        console.warn('[3d-models] Failed to load GLB', product.src, err);
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      unsub();
      controls.removeEventListener('change', publishPose);
      // Handoff angles + remaining inertia so the trigger keeps coasting after close.
      if (ready && !applyingShared) {
        store.set(readOrbitPose(controls, true), sourceId);
      }
      controlsRef.current = null;
      controls.dispose();
      env.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material;
        if (!material) return;
        for (const mat of Array.isArray(material) ? material : [material]) mat.dispose();
      });
    };
    // `interactive` is applied in a separate effect so we don’t rebuild the scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per canvas/product
  }, [canvasRef, product.id, product.src, touchMode]);

  React.useLayoutEffect(() => {
    if (controlsRef.current) controlsRef.current.enabled = interactive;
  }, [interactive]);
}

function TriggerScene({ product }: { product: Product }) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  useThreeCanvas(canvasRef, product, true, 'trigger');
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 block size-full bg-transparent"
      style={{ touchAction: 'none' }}
    />
  );
}

function LightboxScene({
  product,
  lightboxReady,
}: {
  product: Product;
  /** True after open settles / until close completes. */
  lightboxReady: boolean;
}) {
  const item = useLightboxItemContext();
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  // Only the active slide accepts orbit input so swipe / pull-to-dismiss win
  // on neighbors and the inactive canvases don’t fight the scroller.
  useThreeCanvas(
    canvasRef,
    product,
    lightboxReady && !!item?.active,
    'lightbox',
  );
  return (
    <canvas
      ref={canvasRef}
      className="block bg-transparent"
      style={{ touchAction: 'none' }}
    />
  );
}

function ProductTrigger({ product, index }: { product: Product; index: number }) {
  return (
    <Lightbox.Trigger
      index={index}
      className={`group block w-full cursor-pointer rounded-xl border-none bg-transparent p-0 text-left ${triggerFocusClass}`}
      crossfade="both"
    >
      {({ morphRef }) => (
        <>
          <div
            ref={morphRef}
            className={`relative overflow-hidden rounded-xl bg-transparent ${morphHideClass}`}
            style={{ aspectRatio: `${product.width} / ${product.height}` }}
          >
            <TriggerScene product={product} />
          </div>
          <div className="px-0.5 pt-2.5">
            <div className="text-sm font-medium leading-snug">{product.name}</div>
            <div className="text-xs text-muted-foreground">{product.material}</div>
          </div>
        </>
      )}
    </Lightbox.Trigger>
  );
}

function StudioLightbox() {
  const [lightboxReady, setLightboxReady] = React.useState(false);

  const items = React.useMemo(
    () =>
      products.map((product) => ({
        id: product.id,
        src: product.src,
        thumb: product.src,
        alt: product.name,
        caption: `${product.name} · ${product.material}`,
      })),
    [],
  );

  return (
    <Lightbox.Root
      loop
      scrollTriggerIntoView={[
        { type: 'onChange', behavior: 'instant' },
        { type: 'onOpenComplete', behavior: 'instant' },
      ]}
      onOpenChangeComplete={(open) => {
        // Enable orbit only after open settles (avoid fighting the morph).
        setLightboxReady(open);
      }}
    >
      <div className="grid grid-cols-2 gap-5">
        {products.map((product, index) => (
          <ProductTrigger key={product.id} product={product} index={index} />
        ))}
      </div>

      <LightboxGallery
        items={items}
        ariaLabel="3D models"
        preload={0}
        thumbnails="never"
        zoomControls={false}
        renderItem={(_item, index) => {
          const product = products[index]!;
          return (
            <div
              
              className="px-0 flex items-center justify-center size-full pt-[calc(env(safe-area-inset-top,0px)+3.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+3.5rem)] md:px-8"
            >
              <Lightbox.Media
                width={product.width}
                height={product.height}
                className="overflow-hidden rounded-xl bg-transparent"
              >
                <LightboxScene product={product} lightboxReady={lightboxReady} />
              </Lightbox.Media>
            </div>
          );
        }}
      />
    </Lightbox.Root>
  );
}

export default function ThreeDModelsPage() {
  return (
    <ExampleShell
      title="3D models"
      docsHref="/docs/lightbox/composition#slides"
      docsLabel="Composition · Slides"
      description={
        <>
          One lightbox over the grid —{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
            Lightbox.Slides
          </code>{' '}
          for swipe navigation, Three.js canvases in each trigger and{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
            Lightbox.Media
          </code>
          . Rotate only (no zoom); each grid tile stays in sync with its slide.
          Swipe between models; one-finger vertical drag dismisses.
        </>
      }
    >
      <div className="mx-auto max-w-3xl">
        <div className="py-5">
          <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Object studio
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Khronos sample assets</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Open any model, then swipe to the next. Orbit stays in sync with the grid tile.
          </p>
        </div>

        <StudioLightbox />
      </div>
    </ExampleShell>
  );
}
