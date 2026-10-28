import type { Mesh as TreeMesh, TreeNode } from 'fiddy';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BARK, GROUND, LEAF, SOIL } from '../colors';

function geometry(m: TreeMesh): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  return g;
}

/** The tree in three.js: bark and leaf meshes over a ground disc, lit from the sky, orbited with
 *  the mouse. Draws only when something changes. */
export class TreeScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1e5);
  private readonly controls: OrbitControls;
  private readonly bark = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: BARK, roughness: 0.9 }));
  private readonly leaves = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: LEAF, roughness: 0.8, side: THREE.DoubleSide }));
  private readonly ground = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ color: SOIL }));

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(devicePixelRatio);
    this.scene.background = new THREE.Color(GROUND);
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2018, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(0.6, 1, 0.8);
    this.scene.add(sun, this.bark, this.leaves, this.ground);
    this.ground.rotation.x = -Math.PI / 2;
    this.camera.position.set(0.35, 0.2, 1);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.addEventListener('change', () => this.render());
  }

  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.render();
  }

  setTree(bark: TreeMesh, leaves: TreeMesh): void {
    for (const [mesh, m] of [[this.bark, bark], [this.leaves, leaves]] as const) {
      mesh.geometry.dispose();
      mesh.geometry = geometry(m);
    }
    this.render();
  }

  private framed: { center: THREE.Vector3; radius: number } | null = null;

  /** Points the camera at `nodes` from the direction it already looks, far enough to see them all.
   *  Unless `force`d, a tree within a tenth of its size of the last one framed keeps the view. */
  frame(nodes: readonly TreeNode[], force = false): void {
    const box = new THREE.Box3();
    for (const n of nodes) box.expandByPoint(new THREE.Vector3(n.pos[0], n.pos[1], n.pos[2]));
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1e-3);
    const last = this.framed;
    if (!force && last && Math.abs(radius - last.radius) < 0.1 * last.radius && center.distanceTo(last.center) < 0.1 * last.radius) return;
    this.framed = { center, radius };
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const dist = radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(dir, dist * 1.05);
    this.camera.near = dist / 100;
    this.camera.far = dist * 10;
    this.camera.updateProjectionMatrix();
    this.ground.scale.setScalar(radius * 0.8);
    this.ground.position.set(center.x, box.min.y, center.z);
    this.controls.update();
    this.render();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.controls.dispose();
    for (const m of [this.bark, this.leaves, this.ground]) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.renderer.dispose();
  }
}
