import {
    LineBasicMaterial, WebGLRenderer, Vector3, Color, Scene, PerspectiveCamera,
    OrthographicCamera, GridHelper, AxesHelper, AmbientLight,
    DirectionalLight, Line, BufferGeometry, Raycaster, Vector2,
    BoxGeometry, MeshStandardMaterial, Mesh, TextureLoader, DoubleSide,
    Box2, Box3, Object3D, Plane, MOUSE, TOUCH
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface Wall {
    type: 'wall';
    start: Vector3;
    end: Vector3;
    angle: number;
    length: number;
    id: string;
    selected?: boolean;
    highlighted?: boolean;
}

export class Viewer{
    private container: HTMLElement;
    private renderer: WebGLRenderer;
    private scene2D: Scene;
    private scene3D: Scene;
    private camera2D: OrthographicCamera;
    private camera3D: PerspectiveCamera;
    private controls2D: OrbitControls;
    private controls3D: OrbitControls;
    private is2D: boolean = true;
    private walls: Wall[] = [];
    private wallCounter: number = 0;
    private isDrawing: boolean = false;
    private currentStartPoint: Vector3 | null = null;
    private tempLine: Line | null = null;
    private wallMeshes: Map<string, Object3D> = new Map();
    private raycaster: Raycaster = new Raycaster();
    private mouse: Vector2 = new Vector2();
    private textureLoader: TextureLoader = new TextureLoader();
    private intersectionPlane: Plane;
    private dimensionLabels: Map<string, HTMLDivElement> = new Map();
    private isDragging: boolean = false;
    private dragStartPosition: Vector2 = new Vector2();
    private draggedWalls: Wall[] = [];

    constructor(container: HTMLElement){
        this.container=container;
        this.intersectionPlane = new Plane(new Vector3(0, 0, 1), 0);
   
        this.renderer=this.createRenderer();
            this.renderer.setSize(container.clientWidth,container.clientHeight);
            this.renderer.setPixelRatio(window.devicePixelRatio);
        container.append(this.renderer.domElement);
     
        this.scene2D=this.createScene2D();
        this.scene3D=this.createScene3D();
        this.camera2D=this.createCamera2D();
        this.camera3D=this.createCamera3D();
        this.controls2D=this.createControls2D();
        this.controls3D=this.createControls3D();
        this.setup();
        this.animate();

        // Add window resize handler
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    private setup() {
        // Add event listeners
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));
        window.addEventListener('contextmenu', (e) => e.preventDefault()); // Prevent right-click menu

        // Add grid and lights to both scenes
        this.addGridAndLights(this.scene2D);
        this.addGridAndLights(this.scene3D);
    }

    private createRenderer(): WebGLRenderer {
        var renderer=new WebGLRenderer({antialias:true});
        return renderer;
    }

    private createScene2D(): Scene {
        const scene = new Scene();
        scene.background = new Color('#e0e0e0');  // Match 3D view background
        return scene;
    }

    private createScene3D(): Scene {
        const scene = new Scene();
        scene.background = new Color('#e0e0e0');
        return scene;
    }

    private createCamera2D(): OrthographicCamera {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const frustumSize = 100;
        const camera = new OrthographicCamera(
            -frustumSize * aspect / 2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            -frustumSize / 2,
            1,
            100
        );
        camera.position.set(0, 0, 5);
        return camera;
    }

    private createCamera3D(): PerspectiveCamera {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const camera = new PerspectiveCamera(35, aspect, 0.1, 500);
        camera.position.set(50, 50, 50);
        camera.lookAt(0, 0, 0);
        return camera;
    }

    private createControls2D(): OrbitControls {
        const controls = new OrbitControls(this.camera2D, this.container);
        controls.enableRotate = false;
        controls.enablePan = true;
        controls.mouseButtons = {
            LEFT: undefined,
            MIDDLE: MOUSE.PAN,
            RIGHT: undefined
        };
        controls.touches = {
            ONE: undefined,
            TWO: TOUCH.DOLLY_PAN
        };
        controls.keyPanSpeed = 7.0;
        controls.enableDamping = true;
        controls.panSpeed = 2;
        controls.zoomSpeed = 1;
        controls.update();
        return controls;
    }

    private createControls3D(): OrbitControls {
        const controls = new OrbitControls(this.camera3D, this.container);
        controls.mouseButtons = {
            LEFT: undefined,
            MIDDLE: MOUSE.PAN,
            RIGHT: undefined
        };
        controls.touches = {
            ONE: undefined,
            TWO: TOUCH.DOLLY_PAN
        };
        controls.keyPanSpeed = 7.0;
        controls.enableDamping = true;
        controls.panSpeed = 2;
        controls.zoomSpeed = 1;
        controls.update();
        return controls;
    }

    private addGridAndLights(scene: Scene) {
        // Add grid with different settings for 2D and 3D
        if (scene === this.scene2D) {
            // 2D grid - more subtle, smaller divisions
            const gridSize = 100;
            const divisions = 100;
            const mainGrid = new GridHelper(gridSize, divisions, 0x666666, 0x999999);
            mainGrid.rotation.x = Math.PI / 2; // Rotate to XY plane
            mainGrid.material.opacity = 0.2;
            mainGrid.material.transparent = true;
            scene.add(mainGrid);

            // Add a smaller, more detailed grid
            const smallGrid = new GridHelper(gridSize, divisions * 2, 0x666666, 0x999999);
            smallGrid.rotation.x = Math.PI / 2;
            smallGrid.material.opacity = 0.1;
            smallGrid.material.transparent = true;
            scene.add(smallGrid);
        } else {
            // 3D grid - standard floor grid
            const grid = new GridHelper(100, 100, 0x666666, 0x999999);
            grid.material.opacity = 0.2;
            grid.material.transparent = true;
            scene.add(grid);
        }

        // Add axes helper
        const axesHelper = new AxesHelper(2);
        scene.add(axesHelper);

        // Add lights
        const ambientLight = new AmbientLight('white', 0.5);
        scene.add(ambientLight);

        const directionalLight = new DirectionalLight('white', 1);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);
    }

    public setView(is2D: boolean) {
        this.is2D = is2D;
        // Update all walls and their representations
        this.update3DView();
        
        // Update controls
        if (is2D) {
            this.controls2D.update();
        } else {
            this.controls3D.update();
        }
    }

    private update3DView() {
        // Store currently selected and highlighted walls
        const selectedWalls = new Set(this.walls.filter(w => w.selected).map(w => w.id));
        const highlightedWalls = new Set(this.walls.filter(w => w.highlighted).map(w => w.id));

        // Clear all meshes from both scenes
        this.wallMeshes.forEach(mesh => {
            this.scene2D.remove(mesh);
            this.scene3D.remove(mesh);
            if (mesh instanceof Mesh) {
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material.forEach(mat => mat.dispose());
                    } else {
                        mesh.material.dispose();
                    }
                }
            }
        });
        this.wallMeshes.clear();

        // Clear all dimension labels
        this.dimensionLabels.forEach(label => {
            if (label.parentNode) {
                label.remove();
            }
        });
        this.dimensionLabels.clear();

        // Recreate all walls in current view
        this.walls.forEach(wall => {
            if (this.is2D) {
                this.createWallMesh2D(wall);
            } else {
                this.createWallMesh3D(wall);
            }
            
            // Restore selection and highlight states
            if (selectedWalls.has(wall.id)) {
                wall.selected = true;
                this.updateWallAppearance(wall);
            }
            if (highlightedWalls.has(wall.id)) {
                wall.highlighted = true;
                this.updateWallAppearance(wall);
            }

            // Add dimension label in both views
            this.addDimensionLabel(wall);
        });

        // Force a render to update the scene
        this.renderer.renderLists.dispose();
    }

    private createWallMesh3D(wall: Wall) {
        const wallHeight = 3; // meters
        const wallThickness = 0.4; // meters
        const wallLength = wall.length;

        // Create wall geometry
        const geometry = new BoxGeometry(wallLength, wallHeight, wallThickness);

        // Load and apply wall texture
        const texture = this.textureLoader.load('/textures/brick.jpg');
        texture.wrapS = texture.wrapT = 1000;
        texture.repeat.set(wallLength / 2, wallHeight / 2);

        const material = new MeshStandardMaterial({
            map: texture,
            side: DoubleSide,
            roughness: 0.7,
            metalness: 0.1,
            color: wall.selected ? 0xff0000 : (wall.highlighted ? 0x00ff00 : 0xcccccc)
        });

        const mesh = new Mesh(geometry, material);

        // Position and rotate the wall
        const midPoint = new Vector3().addVectors(wall.start, wall.end).multiplyScalar(0.5);
        mesh.position.set(midPoint.x, wallHeight / 2, midPoint.y); // Keep Y at half height
        mesh.rotation.y = -wall.angle; // Negative for correct orientation

        mesh.userData.wallId = wall.id;
        this.scene3D.add(mesh);
        this.wallMeshes.set(wall.id, mesh);
    }

    public addWall(start: Vector3, end: Vector3): Wall {
        const length = start.distanceTo(end);
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const wall: Wall = {
            type: 'wall',
            start: start.clone(),
            end: end.clone(),
            angle,
            length,
            id: `wall_${this.wallCounter++}`,
            selected: false,
            highlighted: false
        };
        this.walls.push(wall);
        this.createWallMesh2D(wall);
        if (!this.is2D) {
            this.createWallMesh3D(wall);
        }

        // Update info panel
        this.updateInfoPanel();
        return wall;
    }

    private createWallMesh2D(wall: Wall) {
        // Create a rectangle for wall thickness
        const wallThickness = 1.0;  // Increased thickness
        const wallLength = wall.length;
        const wallGeometry = new BoxGeometry(wallLength, wallThickness, 0.01);
        const wallMaterial = new MeshStandardMaterial({ 
            color: wall.selected ? 0xff0000 : (wall.highlighted ? 0x00ff00 : 0xcccccc),
            side: DoubleSide,
            transparent: true,
            opacity: 0.6
        });
        const wallMesh = new Mesh(wallGeometry, wallMaterial);

        // Position and rotate the wall mesh
        const midPoint = new Vector3().addVectors(wall.start, wall.end).multiplyScalar(0.5);
        wallMesh.position.set(midPoint.x, midPoint.y, 0);
        wallMesh.rotation.z = wall.angle;
        wallMesh.userData.wallId = wall.id;

        this.scene2D.add(wallMesh);
        this.wallMeshes.set(wall.id, wallMesh);

        // Add dimension label
        this.addDimensionLabel(wall);
    }

    private onMouseMove(e: MouseEvent) {
        this.updateMousePosition(e);

        if (this.isDragging && this.draggedWalls.length > 0) {
            // Calculate mouse movement delta
            const deltaX = e.clientX - this.dragStartPosition.x;
            const deltaY = e.clientY - this.dragStartPosition.y;

            // Convert screen delta to world delta
            const rect = this.container.getBoundingClientRect();
            let worldDeltaX, worldDeltaY;

            if (this.is2D) {
                worldDeltaX = (deltaX / rect.width) * (this.camera2D.right - this.camera2D.left);
                worldDeltaY = -(deltaY / rect.height) * (this.camera2D.top - this.camera2D.bottom);
            } else {
                // For 3D view, project the movement onto the XY plane
                const planeNormal = new Vector3(0, 1, 0); // Normal vector of the ground plane
                const raycaster = new Raycaster();
                
                // Get two points on the ground plane for the drag start and current position
                const dragStartPos = new Vector2(
                    (this.dragStartPosition.x / rect.width) * 2 - 1,
                    -(this.dragStartPosition.y / rect.height) * 2 + 1
                );
                const currentPos = new Vector2(
                    (e.clientX / rect.width) * 2 - 1,
                    -(e.clientY / rect.height) * 2 + 1
                );

                // Get the 3D points where these rays intersect the ground plane
                const groundPlane = new Plane(planeNormal);
                raycaster.setFromCamera(dragStartPos, this.camera3D);
                const dragStartPoint = new Vector3();
                raycaster.ray.intersectPlane(groundPlane, dragStartPoint);

                raycaster.setFromCamera(currentPos, this.camera3D);
                const currentPoint = new Vector3();
                raycaster.ray.intersectPlane(groundPlane, currentPoint);

                if (dragStartPoint && currentPoint) {
                    worldDeltaX = currentPoint.x - dragStartPoint.x;
                    worldDeltaY = currentPoint.z - dragStartPoint.z; // Use Z for Y in 3D space
                } else {
                    // Fallback if intersection fails
                    worldDeltaX = 0;
                    worldDeltaY = 0;
                }
            }

            // Update walls
            this.draggedWalls.forEach(wall => {
                wall.start.x += worldDeltaX;
                wall.start.y += worldDeltaY;
                wall.end.x += worldDeltaX;
                wall.end.y += worldDeltaY;

                // Update wall meshes
                this.updateWallPosition(wall);
            });

            // Update drag start position
            this.dragStartPosition.set(e.clientX, e.clientY);
            return;
        }

        // Handle wall highlighting in both 2D and 3D modes
        if (this.is2D && this.isDrawing && this.currentStartPoint) {
            const intersects = this.getIntersectionPoint();
            if (intersects) {
                this.updateTempLine(this.currentStartPoint, intersects);
            }
        }

        // Check for wall highlighting
        const intersects = this.getWallIntersection();
        if (intersects.length > 0) {
            const wallId = intersects[0].object.userData.wallId;
            this.highlightWall(wallId);
        } else {
            this.clearHighlights();
        }
    }

    private onMouseDown(e: MouseEvent) {
        // Check if the click is on a button, toolbar, or any of the panels
        if ((e.target as HTMLElement).closest('.toolbar') ||
            (e.target as HTMLElement).closest('.info-panel') ||
            (e.target as HTMLElement).closest('.guide-panel')) {
            return;
        }

        // Enable camera control with Shift + Left Click
        if (e.shiftKey) {
            this.controls2D.mouseButtons.LEFT = MOUSE.PAN;
            this.controls3D.mouseButtons.LEFT = MOUSE.ROTATE;
            return;
        } else {
            this.controls2D.mouseButtons.LEFT = undefined;
            this.controls3D.mouseButtons.LEFT = undefined;
        }

        if (e.button === 0) { // Left click for selection, drawing, and dragging
            // First check if we clicked on a wall
            const wallIntersects = this.getWallIntersection();
            if (wallIntersects.length > 0) {
                // We clicked on a wall - handle selection
                const wallId = wallIntersects[0].object.userData.wallId;
                if (e.ctrlKey) {
                    // Ctrl+click: toggle selection
                    this.toggleWallSelection(wallId);
                } else {
                    // Regular click: clear other selections and select this wall
                    this.selectWall(wallId);
                }
                
                // Start dragging if we clicked a wall
                this.isDragging = true;
                this.dragStartPosition.set(e.clientX, e.clientY);
                this.draggedWalls = this.getSelectedWalls();
                return;
            } else if (!e.ctrlKey) {
                // Clicked on empty space without Ctrl - clear selection
                this.clearWallStates();
            }

            // No wall was clicked, handle drawing in 2D mode
            if (this.is2D) {
                const intersects = this.getIntersectionPoint();
                if (intersects) {
                    if (!this.isDrawing) {
                        // Start drawing
                        this.isDrawing = true;
                        this.currentStartPoint = intersects;
                        this.tempLine = this.createTempLine(intersects, intersects);
                        this.scene2D.add(this.tempLine);
                    } else {
                        // Finish drawing
                        const wall = this.addWall(this.currentStartPoint!, intersects);
                        this.isDrawing = false;
                        this.scene2D.remove(this.tempLine!);
                        this.tempLine = null;
                        this.currentStartPoint = null;
                    }
                }
            }
        } else if (e.button === 2) { // Right click for deletion
            const wallIntersects = this.getWallIntersection();
            if (wallIntersects.length > 0) {
                const clickedWallId = wallIntersects[0].object.userData.wallId;
                const clickedWall = this.walls.find(w => w.id === clickedWallId);
                
                if (clickedWall && clickedWall.selected) {
                    // If we right-clicked a selected wall, delete all selected walls
                    this.getSelectedWalls().forEach(wall => this.deleteWall(wall.id));
                } else {
                    // If we right-clicked an unselected wall, just delete that one
                    this.deleteWall(clickedWallId);
                }
            }
        }
    }

    private onMouseUp(e: MouseEvent) {
        if (this.isDragging) {
            this.isDragging = false;
            this.draggedWalls = [];
            // Update the view to ensure everything is in sync
            if (!this.is2D) {
                this.update3DView();
            }
        }
        
        // Reset camera controls
        this.controls2D.mouseButtons.LEFT = undefined;
        this.controls3D.mouseButtons.LEFT = undefined;
    }

    private createTempLine(start: Vector3, end: Vector3): Line {
        const material = new LineBasicMaterial({ 
            color: 0x0000ff,
            linewidth: 3  // Increased line width for temp line too
        });
        const points = [start, end];
        const geometry = new BufferGeometry().setFromPoints(points);
        return new Line(geometry, material);
    }

    private updateTempLine(start: Vector3, end: Vector3) {
        if (this.tempLine) {
            const positions = this.tempLine.geometry.attributes.position;
            positions.setXYZ(0, start.x, start.y, start.z);
            positions.setXYZ(1, end.x, end.y, end.z);
            positions.needsUpdate = true;
        }
    }

    private updateMousePosition(e: MouseEvent) {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / this.container.clientWidth) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / this.container.clientHeight) * 2 + 1;
    }

    private getIntersectionPoint(): Vector3 | null {
        this.raycaster.setFromCamera(this.mouse, this.is2D ? this.camera2D : this.camera3D);
        const intersects = this.raycaster.ray.intersectPlane(this.intersectionPlane, new Vector3());
        return intersects || null;
    }

    private getWallIntersection(): any[] {
        this.raycaster.setFromCamera(this.mouse, this.is2D ? this.camera2D : this.camera3D);
        // Increase the raycaster's precision for better selection
        this.raycaster.params.Line = { threshold: 0.2 };
        const wallObjects = Array.from(this.wallMeshes.values());
        return this.raycaster.intersectObjects(wallObjects, true);
    }

    private animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.render();
    }

    private render() {
        if (this.is2D) {
            this.controls2D.update();
            this.renderer.render(this.scene2D, this.camera2D);
        } else {
            this.controls3D.update();
            this.renderer.render(this.scene3D, this.camera3D);
        }
        // Always update labels to handle camera movement in 3D
        this.updateAllDimensionLabels();
    }

    private onWindowResize() {
        // Update renderer size
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // Update 2D camera
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const frustumSize = 100;
        this.camera2D.left = -frustumSize * aspect / 2;
        this.camera2D.right = frustumSize * aspect / 2;
        this.camera2D.top = frustumSize / 2;
        this.camera2D.bottom = -frustumSize / 2;
        this.camera2D.updateProjectionMatrix();

        // Update 3D camera
        this.camera3D.aspect = aspect;
        this.camera3D.updateProjectionMatrix();

        // Update dimension labels
        this.updateAllDimensionLabels();
    }

    public zoomExtend() {
        if (this.is2D) {
            // Calculate bounding box of all walls in 2D
            const positions: Vector3[] = [];
            this.walls.forEach(wall => {
                positions.push(wall.start, wall.end);
            });

            if (positions.length > 0) {
                const box = new Box2().setFromPoints(positions.map(p => new Vector2(p.x, p.y)));
                const center = box.getCenter(new Vector2());
                const size = box.getSize(new Vector2());
                const maxDim = Math.max(size.x, size.y);
                
                this.camera2D.position.set(center.x, center.y, 5);
                this.camera2D.zoom = 0.4 / maxDim; // Decreased zoom factor
                this.camera2D.updateProjectionMatrix();
                this.controls2D.update();
            }
        } else {
            // Calculate bounding box of all walls in 3D
            const positions: Vector3[] = [];
            this.walls.forEach(wall => {
                const start = new Vector3(wall.start.x, 0, wall.start.y);
                const end = new Vector3(wall.end.x, 0, wall.end.y);
                positions.push(
                    start,
                    end,
                    new Vector3(start.x, 3, start.z),
                    new Vector3(end.x, 3, end.z)
                );
            });

            if (positions.length > 0) {
                const box = new Box3().setFromPoints(positions);
                const center = box.getCenter(new Vector3());
                const size = box.getSize(new Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const fov = this.camera3D.fov * (Math.PI / 180);
                let cameraZ = Math.abs(maxDim / Math.sin(fov / 2)) * 0.4; // Decreased zoom factor
                
                const cameraOffset = cameraZ * 0.7;
                this.camera3D.position.set(
                    center.x + cameraOffset,
                    cameraOffset * 0.8,
                    center.z + cameraOffset
                );
                this.camera3D.lookAt(center);
                this.controls3D.target.copy(center);
                this.controls3D.update();
            }
        }
    }

    private addDimensionLabel(wall: Wall) {
        // Remove any existing label first
        const existingLabel = this.dimensionLabels.get(wall.id);
        if (existingLabel && existingLabel.parentNode) {
            existingLabel.remove();
            this.dimensionLabels.delete(wall.id);
        }

        const label = document.createElement('div');
        label.className = 'dimension-label';
        label.style.position = 'absolute';
        label.style.color = 'black';
        label.style.fontSize = '12px';
        label.style.pointerEvents = 'none';
        label.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        label.style.padding = '2px 6px';
        label.style.borderRadius = '4px';
        label.style.whiteSpace = 'nowrap';
        label.textContent = `${wall.length.toFixed(2)}m`;
        
        this.container.appendChild(label);
        this.dimensionLabels.set(wall.id, label);
        this.updateDimensionLabelPosition(wall);
    }

    private updateDimensionLabelPosition(wall: Wall) {
        const label = this.dimensionLabels.get(wall.id);
        if (!label) return;
        
        const midPoint = new Vector3().addVectors(wall.start, wall.end).multiplyScalar(0.5);
        if (this.is2D) {
            // 2D view - use original position
            const screenPosition = midPoint.clone().project(this.camera2D);
            const x = (screenPosition.x * 0.5 + 0.5) * this.container.clientWidth;
            const y = (-screenPosition.y * 0.5 + 0.5) * this.container.clientHeight;
            label.style.left = `${x}px`;
            label.style.top = `${y}px`;
            label.style.transform = 'translate(-50%, -50%)';
            label.style.display = 'block';
        } else {
            // 3D view - adjust position based on camera angle
            const position3D = new Vector3(midPoint.x, 1.5, midPoint.y); // Position at half wall height
            const screenPosition = position3D.clone().project(this.camera3D);
            
            // Check if the point is in front of the camera
            if (screenPosition.z < 1) {
                const x = (screenPosition.x * 0.5 + 0.5) * this.container.clientWidth;
                const y = (-screenPosition.y * 0.5 + 0.5) * this.container.clientHeight;

                // Calculate the distance to the camera for scaling
                const distance = position3D.distanceTo(this.camera3D.position);
                const scale = Math.max(0.5, Math.min(1, 20 / distance)); // Scale between 0.5 and 1 based on distance

                label.style.display = 'block';
                label.style.left = `${x}px`;
                label.style.top = `${y}px`;
                label.style.transform = `translate(-50%, -50%) scale(${scale})`;
                label.style.opacity = `${scale}`;
            } else {
                label.style.display = 'none'; // Hide label if it's behind the camera
            }
        }
    }

    private updateAllDimensionLabels() {
        this.walls.forEach(wall => {
            this.updateDimensionLabelPosition(wall);
        });
    }

    private clearHighlights() {
        this.walls.forEach(wall => {
            if (!wall.selected) { // Don't clear highlight if wall is selected
                wall.highlighted = false;
                this.updateWallAppearance(wall);
            }
        });
    }

    private highlightWall(id: string) {
        this.walls.forEach(wall => {
            const wasHighlighted = wall.highlighted;
            wall.highlighted = wall.id === id && !wall.selected;
            if (wasHighlighted !== wall.highlighted) {
                this.updateWallAppearance(wall);
            }
        });
    }

    private selectWall(id: string) {
        this.walls.forEach(wall => {
            const wasSelected = wall.selected;
            wall.selected = wall.id === id;
            if (wasSelected !== wall.selected) {
                this.updateWallAppearance(wall);
            }
        });
        // Update info panel
        this.updateInfoPanel();
    }

    private clearWallStates() {
        this.walls.forEach(wall => {
            if (wall.selected || wall.highlighted) {
                wall.selected = false;
                wall.highlighted = false;
                this.updateWallAppearance(wall);
            }
        });
        // Update info panel
        this.updateInfoPanel();
    }

    private updateWallAppearance(wall: Wall) {
        const mesh = this.wallMeshes.get(wall.id);
        if (mesh && mesh instanceof Mesh) {
            const material = mesh.material as MeshStandardMaterial;
            if (wall.selected) {
                material.color.setHex(0xff0000); // Red for selected
            } else if (wall.highlighted) {
                material.color.setHex(0x00ff00); // Green for highlighted
            } else {
                material.color.setHex(0xcccccc); // Default color
            }
            material.needsUpdate = true;
        }
    }

    private toggleWallSelection(id: string) {
        const wall = this.walls.find(w => w.id === id);
        if (wall) {
            wall.selected = !wall.selected;
            this.updateWallAppearance(wall);
        }
        // Update info panel
        this.updateInfoPanel();
    }

    private deleteWall(id: string) {
        // Find the wall to delete
        const wallIndex = this.walls.findIndex(w => w.id === id);
        if (wallIndex === -1) return;

        // Remove all meshes associated with this wall from both scenes
        const meshesToRemove: Object3D[] = [];
        
        // Search in 2D scene
        this.scene2D.traverse((object) => {
            if (object.userData.wallId === id) {
                meshesToRemove.push(object);
            }
        });
        
        // Search in 3D scene
        this.scene3D.traverse((object) => {
            if (object.userData.wallId === id) {
                meshesToRemove.push(object);
            }
        });

        // Remove all found meshes from their respective scenes
        meshesToRemove.forEach(mesh => {
            if (mesh.parent) {
                mesh.parent.remove(mesh);
                // Dispose of geometries and materials
                if (mesh instanceof Mesh || mesh instanceof Line) {
                    if (mesh.geometry) {
                        mesh.geometry.dispose();
                    }
                    if (mesh.material) {
                        if (Array.isArray(mesh.material)) {
                            mesh.material.forEach(mat => mat.dispose());
                        } else {
                            mesh.material.dispose();
                        }
                    }
                }
            }
        });

        // Clear from wallMeshes map
        const mesh = this.wallMeshes.get(id);
        if (mesh) {
            if (mesh.parent) {
                mesh.parent.remove(mesh);
            }
            this.wallMeshes.delete(id);
        }

        // Remove the dimension label
        const label = this.dimensionLabels.get(id);
        if (label && label.parentNode) {
            label.remove();
            this.dimensionLabels.delete(id);
        }

        // Remove the wall from the walls array
        this.walls.splice(wallIndex, 1);

        // Force a scene update
        this.renderer.renderLists.dispose();
        
        // Update info panel
        this.updateInfoPanel();
    }

    public getSelectedWalls(): Wall[] {
        return this.walls.filter(wall => wall.selected);
    }

    private updateInfoPanel() {
        // Update total walls count
        const totalWallsElement = document.getElementById('total-walls');
        if (totalWallsElement) {
            totalWallsElement.textContent = this.walls.length.toString();
        }

        // Get selected walls and update count
        const selectedWalls = this.getSelectedWalls();
        const selectedWallsElement = document.getElementById('selected-walls');
        if (selectedWallsElement) {
            selectedWallsElement.textContent = selectedWalls.length.toString();
        }

        // Calculate and update total length of all walls
        const totalLengthElement = document.getElementById('total-length');
        if (totalLengthElement) {
            const totalLength = this.walls.reduce((sum, wall) => sum + wall.length, 0);
            totalLengthElement.textContent = `${totalLength.toFixed(2)}m`;
        }

        // Calculate and update length of selected walls
        const selectedLengthElement = document.getElementById('selected-length');
        if (selectedLengthElement) {
            if (selectedWalls.length > 0) {
                const selectedLength = selectedWalls.reduce((sum, wall) => sum + wall.length, 0);
                selectedLengthElement.textContent = `${selectedLength.toFixed(2)}m`;
            } else {
                selectedLengthElement.textContent = '0.00m';
            }
        }
    }

    private updateWallPosition(wall: Wall) {
        // Remove old meshes from BOTH scenes, regardless of current view
        const oldMesh = this.wallMeshes.get(wall.id);
        if (oldMesh) {
            this.scene2D.remove(oldMesh);
            this.scene3D.remove(oldMesh);
            // Dispose of geometries and materials
            if (oldMesh instanceof Mesh) {
                if (oldMesh.geometry) oldMesh.geometry.dispose();
                if (oldMesh.material) {
                    if (Array.isArray(oldMesh.material)) {
                        oldMesh.material.forEach(mat => mat.dispose());
                    } else {
                        oldMesh.material.dispose();
                    }
                }
            }
            this.wallMeshes.delete(wall.id);
        }

        // Remove old dimension label
        const oldLabel = this.dimensionLabels.get(wall.id);
        if (oldLabel && oldLabel.parentNode) {
            oldLabel.remove();
            this.dimensionLabels.delete(wall.id);
        }

        // Create new mesh based on current view
        if (this.is2D) {
            this.createWallMesh2D(wall);
        } else {
            this.createWallMesh3D(wall);
        }

        // Add new dimension label only in 2D view
        if (this.is2D) {
            this.addDimensionLabel(wall);
        }
    }
}