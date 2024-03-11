import * as THREE from 'https://unpkg.com/three@0.162.0/build/three.module.min.js';
import { EffectComposer } from 'https://unpkg.com/three@0.162.0/examples/jsm/postprocessing/EffectComposer.js';
import { ShaderPass } from 'https://unpkg.com/three@0.162.0/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'https://unpkg.com/three@0.162.0/examples/jsm/postprocessing/SMAAPass.js';
import { GammaCorrectionShader } from 'https://unpkg.com/three@0.162.0/examples/jsm/shaders/GammaCorrectionShader.js';
import { OrbitControls } from 'https://unpkg.com/three@0.162.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.162.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://unpkg.com/three@0.162.0/examples/jsm/loaders/DRACOLoader.js';
import { GUI } from 'https://unpkg.com/three@0.162.0/examples/jsm/libs/lil-gui.module.min.js';
import { Stats } from "./stats.js";
import { N8GIPass } from './N8GIPass.js';

async function main() {
    let clientWidth = window.innerWidth;
    let clientHeight = window.innerHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, clientWidth / clientHeight, 0.1, 1000);
    camera.position.set(50, 75, 50);

    const renderer = new THREE.WebGLRenderer();
    THREE.Texture.DEFAULT_ANISOTROPY = renderer.capabilities.getMaxAnisotropy();
    renderer.setSize(clientWidth, clientHeight);
    document.body.appendChild(renderer.domElement);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 25, 0);
    const stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);

    const environment = new THREE.CubeTextureLoader().load([
        "skybox/Box_Right.bmp",
        "skybox/Box_Left.bmp",
        "skybox/Box_Top.bmp",
        "skybox/Box_Bottom.bmp",
        "skybox/Box_Front.bmp",
        "skybox/Box_Back.bmp"
    ]);
    environment.colorSpace = THREE.SRGBColorSpace;
    scene.background = environment;

    const directionalLight = new THREE.DirectionalLight(0xffffff, 5.0);
    directionalLight.position.set(-150, 450, -150);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.left = -200;
    directionalLight.shadow.camera.right = 200;
    directionalLight.shadow.camera.top = 200;
    directionalLight.shadow.camera.bottom = -200;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.bias = -0.01;
    scene.add(directionalLight);

    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("./draco/");
    loader.setDRACOLoader(dracoLoader);

    const sponza = (await loader.loadAsync('./sponza_cd.glb')).scene;

    const tKnot = new THREE.Mesh(
        new THREE.TorusKnotGeometry(5, 1.5, 200, 32),
        new THREE.MeshStandardMaterial({
            emissive: new THREE.Color(1, 1, 0),
            color: new THREE.Color(0, 0, 0),
            metalness: 0.0,
            roughness: 1.0
        })
    );
    tKnot.position.y = 50;
    tKnot.position.z = 35;
    tKnot.castShadow = true;
    tKnot.receiveShadow = true;
    scene.add(tKnot);

    const tKnot2 = new THREE.Mesh(
        new THREE.TorusKnotGeometry(5, 1.5, 200, 32),
        new THREE.MeshStandardMaterial({
            emissive: new THREE.Color(1, 0, 1),
            color: new THREE.Color(0, 0, 0),
            metalness: 0.0,
            roughness: 1.0
        })
    );
    tKnot2.position.y = 15;
    tKnot2.position.z = -35;
    tKnot2.castShadow = true;
    tKnot2.receiveShadow = true;
    scene.add(tKnot2);

    const tKnot3 = new THREE.Mesh(
        new THREE.TorusKnotGeometry(5, 1.5, 200, 32),
        new THREE.MeshStandardMaterial({
            emissive: new THREE.Color(1, 0, 0),
            color: new THREE.Color(0, 0, 0),
            metalness: 0.0,
            roughness: 1.0
        })
    );
    tKnot3.position.y = 15;
    tKnot3.position.x = 70;
    tKnot3.castShadow = true;
    tKnot3.receiveShadow = true;
    scene.add(tKnot3);

    const tKnot4 = new THREE.Mesh(
        new THREE.TorusKnotGeometry(5, 1.5, 200, 32),
        new THREE.MeshStandardMaterial({
            color: new THREE.Color(0, 0, 1),
            metalness: 0.0,
            roughness: 1.0
        })
    );
    tKnot4.position.y = 15;
    tKnot4.position.x = -70;
    tKnot4.castShadow = true;
    tKnot4.receiveShadow = true;
    scene.add(tKnot4);

    sponza.scale.set(10, 10, 10);
    scene.add(sponza);

    scene.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.material.dithering = true;
            child.material.envMap = environment;
            child.material.envMapIntensity = 0.0;
        }
    });

    window.addEventListener('resize', () => {
        clientWidth = window.innerWidth;
        clientHeight = window.innerHeight;
        // main.js (continued)
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();

        renderer.setSize(clientWidth, clientHeight);
        composer.setSize(clientWidth, clientHeight);
    });


    const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(clientWidth, clientHeight, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: 'RGB',
        type: THREE.FloatType,
        internalFormat: 'R11F_G11F_B10F'
    }));


    const smaaPass = new SMAAPass(clientWidth, clientHeight);
    const n8giPass = new N8GIPass(scene, camera, renderer, clientWidth, clientHeight);
    composer.addPass(n8giPass);
    composer.addPass(new ShaderPass(GammaCorrectionShader));
    composer.addPass(smaaPass);

    const gui = new GUI();

    const effectController = {
        voxelsOnly: false,
        giOnly: false,
        denoise: true,
        denoiseStrength: 1.0,
        roughness: 1.0,
        giStrength: 1.0,
        useSimpleEnvmap: false,
        samples: 1,
        aoSamples: 16,
        aoRadius: 5,
        denoiseRadius: 12,
        aoEnabled: true,
        aoIntensity: 5,
        envLeak: 0
    }


    gui.add(effectController, "useSimpleEnvmap").onChange((value) => {
        if (!value) {
            scene.traverse((child) => {
                if (child.isMesh) {
                    child.material.envMapIntensity = effectController.envLeak;
                }
            });
        } else {
            scene.traverse((child) => {
                if (child.isMesh) {
                    child.material.envMapIntensity = 1.0;
                }
            });
        }
    });
    gui.add(effectController, "envLeak", 0, 1, 0.01).onChange((value) => {
        if (!effectController.useSimpleEnvmap) {
            scene.traverse((child) => {
                if (child.isMesh) {
                    child.material.envMapIntensity = value;
                }
            });
        }
    });

    gui.add(effectController, "giOnly");
    gui.add(effectController, "voxelsOnly");
    gui.add(effectController, "samples", 1, 16, 1);
    gui.add(effectController, "denoiseStrength", 0.0, 1.0);
    gui.add(effectController, "giStrength", 0.0, Math.PI);
    gui.add(effectController, "roughness", 0.0, 1.0);
    gui.add(effectController, "aoSamples", 1, 64, 1);
    gui.add(effectController, "aoRadius", 1, 10, 1);
    gui.add(effectController, "denoiseRadius", 1, 12, 1);
    gui.add(effectController, "aoIntensity", 0.0, 10.0);
    gui.add(effectController, "aoEnabled");

    function animate() {
        tKnot.rotation.y += 0.01;
        tKnot.rotation.x += 0.01;
        tKnot.position.x = Math.sin(performance.now() / 1000) * 75;
        tKnot2.rotation.y += 0.01;
        tKnot2.rotation.x += 0.01;
        tKnot2.position.x = Math.sin(performance.now() / 1000) * -75;
        tKnot3.rotation.y += 0.01;
        tKnot3.rotation.x += 0.01;
        tKnot4.rotation.y += 0.01;
        tKnot4.rotation.x += 0.01;
        n8giPass.configuration.samples = effectController.samples;
        n8giPass.configuration.giOnly = effectController.giOnly;
        n8giPass.configuration.voxelsOnly = effectController.voxelsOnly;
        n8giPass.configuration.denoise = effectController.denoise;
        n8giPass.configuration.denoiseStrength = effectController.denoiseStrength;
        n8giPass.configuration.roughness = effectController.roughness;
        n8giPass.configuration.giStrength = effectController.giStrength;
        n8giPass.configuration.useSimpleEnvmap = effectController.useSimpleEnvmap;
        n8giPass.n8aopass.configuration.aoSamples = effectController.aoSamples;
        n8giPass.n8aopass.configuration.aoRadius = effectController.aoRadius;
        n8giPass.n8aopass.configuration.denoiseRadius = effectController.denoiseRadius;
        n8giPass.n8aopass.configuration.intensity = effectController.aoIntensity;

        directionalLight.position.set(
            60 * Math.cos(performance.now() / 1000),
            200,
            60 * Math.sin(performance.now() / 1000)
        );
        composer.render();

        controls.update();
        stats.update();

        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
}

main();