import * as THREE from 'three';
import { Pass, FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { EffectShader } from './EffectShader.js';
import { EffectCompositer } from './EffectCompositer.js';
import BlueNoise from './BlueNoise.js';
import { VerticalBlurShader } from './VerticalBlurShader.js';
import { HorizontalBlurShader } from './HorizontalBlurShader.js';
import { VoxelModule } from './VoxelModule.js';
import { N8AOPass } from "https://unpkg.com/n8ao@latest/dist/N8AO.js";
import { packRGBToUint32, createBufferTexture, imageToDataTexture, createGBufferSplit } from './utils.js';
const bluenoiseBits = Uint8Array.from(atob(BlueNoise), c => c.charCodeAt(0));

class N8GIPass extends Pass {
    constructor(scene, camera, renderer, width = 512, height = 512) {
        super();
        this.width = width;
        this.height = height;

        this.clear = true;

        this.camera = camera;
        this.scene = scene;
        this.albedoLight = new THREE.AmbientLight(0xffffff, Math.PI);
        scene.add(this.albedoLight);
        this.configuration = new Proxy({
            voxelsOnly: false,
            giOnly: false,
            denoise: true,
            denoiseStrength: 1.0,
            roughness: 1.0,
            giStrength: 1.0,
            useSimpleEnvmap: false,
            samples: 1
        }, {
            set: (target, propName, value) => {
                const oldProp = target[propName];
                target[propName] = value;
                return true;
            },
            get: (target, propName) => {
                return target[propName];
            }
        });
        /*
         const box = new THREE.Box3().setFromObject(sponza, true);
    box.min = box.min.floor().addScalar(-2);
    box.max = box.max.ceil().addScalar(2);
    const size = box.getSize(new THREE.Vector3()).floor();
    const center = box.getCenter(new THREE.Vector3());

    const VOXEL_AMOUNT = size.clone().multiplyScalar(0.5).floor(); //.addScalar(2);
    let VOXEL_RATIO_MAX = (new THREE.Vector3(VOXEL_AMOUNT.x / size.x, VOXEL_AMOUNT.y / size.y, VOXEL_AMOUNT.z / size.z));
    VOXEL_RATIO_MAX = Math.max(VOXEL_RATIO_MAX.x, VOXEL_RATIO_MAX.y, VOXEL_RATIO_MAX.z);

    const voxelCenter = center.clone();
    const voxelSize = size.clone();

    const voxelModule = new VoxelModule({
        scene,
        renderer,
        VOXEL_AMOUNT,
        voxelCenter,
        voxelSize,
        workers: navigator.hardwareConcurrency,
    });

    await voxelModule.init();
    */
        const box = new THREE.Box3().setFromObject(scene, true);
        box.min = box.min.floor().addScalar(-2);
        box.max = box.max.ceil().addScalar(2);
        const size = box.getSize(new THREE.Vector3()).floor();
        const center = box.getCenter(new THREE.Vector3());

        this.VOXEL_AMOUNT = size.clone().multiplyScalar(0.5).floor(); //.addScalar(2);
        const VOXEL_AMOUNT = this.VOXEL_AMOUNT;
        let VOXEL_RATIO_MAX = (new THREE.Vector3(VOXEL_AMOUNT.x / size.x, VOXEL_AMOUNT.y / size.y, VOXEL_AMOUNT.z / size.z));
        this.VOXEL_RATIO_MAX = Math.max(VOXEL_RATIO_MAX.x, VOXEL_RATIO_MAX.y, VOXEL_RATIO_MAX.z);

        this.voxelCenter = center.clone();
        this.voxelSize = size.clone();

        this.voxelModule = new VoxelModule({
            scene,
            renderer,
            VOXEL_AMOUNT: this.VOXEL_AMOUNT,
            voxelCenter: this.voxelCenter,
            voxelSize: this.voxelSize,
            workers: navigator.hardwareConcurrency,
        });

        this.voxelModule.init();

        this.uniformsCapture = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
            lights: true,
            uniforms: {
                ...THREE.UniformsLib.lights,
            },
            vertexShader: /*glsl*/ `
            void main() {
                gl_Position = vec4(position, 1.0);
            }
            `,
            fragmentShader: /*glsl*/ `
            #include <common>
            #include <lights_pars_begin>
            void main() {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            }
            `
        }));
        scene.add(this.uniformsCapture);
        this.defaultTexture = createGBufferSplit(width, height);
        this.normalTexture = createGBufferSplit(width, height);
        this.albedoTexture = createGBufferSplit(width, height);
        this.meshNormalMaterial = new THREE.MeshNormalMaterial();
        this.bluenoise = new THREE.DataTexture(
            bluenoiseBits,
            128,
            128
        );
        this.bluenoise.wrapS = THREE.RepeatWrapping;
        this.bluenoise.wrapT = THREE.RepeatWrapping;
        this.bluenoise.minFilter = THREE.NearestFilter;
        this.bluenoise.magFilter = THREE.NearestFilter;
        this.bluenoise.needsUpdate = true;

        this.writeTargetInternal = new THREE.WebGLRenderTarget(this.width, this.height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            depthBuffer: false,
            format: 'RGB',
            type: THREE.FloatType,
            internalFormat: 'R11F_G11F_B10F'
        });
        this.readTargetInternal = new THREE.WebGLRenderTarget(this.width, this.height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            depthBuffer: false,
            format: 'RGB',
            type: THREE.FloatType,
            internalFormat: 'R11F_G11F_B10F'
        });

        this.effectQuad = new FullScreenQuad(new THREE.ShaderMaterial(EffectShader));
        /* const blurs = [];
         for (let i = 0; i < 3; i++) {
             const hblur = new ShaderPass(HorizontalBlurShader);
             const vblur = new ShaderPass(VerticalBlurShader);
             const blurSize = 2.0;
             hblur.uniforms.h.value = blurSize;
             vblur.uniforms.v.value = blurSize;
             blurs.push([hblur, vblur]);
         }*/
        this.horizontalQuad = new FullScreenQuad(new THREE.ShaderMaterial(HorizontalBlurShader));
        this.verticalQuad = new FullScreenQuad(new THREE.ShaderMaterial(VerticalBlurShader));
        this.effectCompositer = new FullScreenQuad(new THREE.ShaderMaterial(EffectCompositer));
        this.voxelModule.updateVoxels();
        this.n8aopass = new N8AOPass(scene, camera, this.width, this.height);
        this.n8aopass.configuration.autoRenderBeauty = false;
        this.n8aopass.beautyRenderTarget = this.defaultTexture;
        this.n8aopass.configuration.gammaCorrection = false;
        //  n8aopass.configuration.aoSamples = 64;
        //  n8aopass.configuration.denoiseRadius = 3;
        //  n8aopass.configuration.aoRadius = 10;
        this.n8aopass.setDisplayMode("AO");
        this.n8aoRenderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: 'RGB',
            type: THREE.FloatType,
            internalFormat: 'R11F_G11F_B10F'
        });
    }
    setSize(width, height) {
        this.width = width;
        this.height = height;
        this.defaultTexture.setSize(width, height);
        this.normalTexture.setSize(width, height);
        this.albedoTexture.setSize(width, height);
        this.writeTargetInternal.setSize(width, height);
        this.readTargetInternal.setSize(width, height);
        this.n8aoRenderTarget.setSize(width, height);
        this.n8aopass.setSize(width, height);
    }
    render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
        this.voxelModule.update();
        this.scene.updateMatrixWorld();
        this.scene.overrideMaterial = this.meshNormalMaterial;
        renderer.setRenderTarget(this.normalTexture);
        renderer.clear();
        renderer.render(this.scene, this.camera);
        this.scene.overrideMaterial = null;
        const oldIntensities = new Map();
        this.scene.traverse((obj) => {
            if (obj.isLight) {
                oldIntensities.set(obj, obj.intensity);
                obj.intensity = 0;
            }
        });
        this.albedoLight.intensity = (Math.PI * Math.PI) / (1 - 1 / Math.PI);
        renderer.setRenderTarget(this.albedoTexture);
        renderer.clear();
        renderer.render(this.scene, this.camera);
        this.scene.traverse((obj) => {
            if (obj.isLight) {
                obj.intensity = oldIntensities.get(obj);
            }
        });
        this.albedoLight.intensity = 0;
        renderer.shadowMap.needsUpdate = true;
        renderer.setRenderTarget(this.defaultTexture);
        renderer.clear();
        renderer.render(this.scene, this.camera);

        this.n8aopass.render(
            renderer,
            this.n8aoRenderTarget,
            null,
            0,
            false
        );

        const uniforms = this.uniformsCapture.material.uniforms;
        uniforms.directionalLights.value.forEach(light => {
            light.direction.applyMatrix4(new THREE.Matrix4().extractRotation(
                this.camera.matrixWorld
            ));
        });
        Object.keys(uniforms).forEach(key => {
            this.voxelModule.setUniform(key, uniforms[key].value);
        });
        this.camera.updateMatrixWorld();
        this.effectQuad.material.uniforms["sceneDiffuse"].value = this.defaultTexture.texture;
        this.effectQuad.material.uniforms["sceneDepth"].value = this.defaultTexture.depthTexture;
        this.effectQuad.material.uniforms["sceneNormal"].value = this.normalTexture.texture;
        this.effectQuad.material.uniforms["sceneAlbedo"].value = this.albedoTexture.texture;
        this.effectQuad.material.uniforms["bluenoise"].value = this.bluenoise;
        this.effectQuad.material.uniforms["skybox"].value = this.scene.background;
        this.effectQuad.material.uniforms["voxelTexture"].value = this.voxelModule.getIndexTexture();
        this.effectQuad.material.uniforms["voxelColor"].value = this.voxelModule.getVoxelRenderTarget().texture;
        this.effectQuad.material.uniforms["voxelColorTextureSize"].value = this.voxelModule.getVoxelRenderTargetSize();
        this.effectQuad.material.uniforms["projMat"].value = this.camera.projectionMatrix;
        this.effectQuad.material.uniforms["viewMat"].value = this.camera.matrixWorldInverse;
        this.effectQuad.material.uniforms["projectionMatrixInv"].value = this.camera.projectionMatrixInverse;
        this.effectQuad.material.uniforms["viewMatrixInv"].value = this.camera.matrixWorld;
        this.effectQuad.material.uniforms["cameraPos"].value = this.camera.getWorldPosition(new THREE.Vector3());
        this.effectQuad.material.uniforms['resolution'].value = new THREE.Vector2(this.width, this.height);
        this.effectQuad.material.uniforms['time'].value = performance.now() / 1000;
        this.effectQuad.material.uniforms['boxSize'].value = this.voxelSize;
        this.effectQuad.material.uniforms['boxCenter'].value = this.voxelCenter;
        this.effectQuad.material.uniforms['roughness'].value = this.configuration.roughness;
        this.effectQuad.material.uniforms['voxelAmount'].value = this.VOXEL_AMOUNT;
        this.effectQuad.material.uniforms['debugVoxels'].value = this.configuration.voxelsOnly;
        this.effectQuad.material.uniforms['samples'].value = this.configuration.samples;

        /*renderer.setRenderTarget(
            this.renderToScreen ? null :
            writeBuffer
        );
        this.effectQuad.render(renderer);*/
        if (this.configuration.voxelsOnly) {
            renderer.setRenderTarget(
                this.renderToScreen ? null :
                writeBuffer
            );
            this.effectQuad.render(renderer);
            return;
        }

        renderer.setRenderTarget(this.writeTargetInternal);
        this.effectQuad.render(renderer);

        this.horizontalQuad.material.uniforms["sceneDepth"].value = this.defaultTexture.depthTexture;
        this.horizontalQuad.material.uniforms["normalTexture"].value = this.normalTexture.texture;
        this.horizontalQuad.material.uniforms["resolution"].value = new THREE.Vector2(this.width, this.height);
        this.horizontalQuad.material.uniforms["projectionMatrixInv"].value = this.camera.projectionMatrixInverse;
        this.horizontalQuad.material.uniforms["viewMatrixInv"].value = this.camera.matrixWorld;
        this.verticalQuad.material.uniforms["sceneDepth"].value = this.defaultTexture.depthTexture;
        this.verticalQuad.material.uniforms["normalTexture"].value = this.normalTexture.texture;
        this.verticalQuad.material.uniforms["resolution"].value = new THREE.Vector2(this.width, this.height);
        this.verticalQuad.material.uniforms["projectionMatrixInv"].value = this.camera.projectionMatrixInverse;
        this.verticalQuad.material.uniforms["viewMatrixInv"].value = this.camera.matrixWorld;
        if (!this.configuration.voxelsOnly && this.configuration.denoise) {
            const blurnums = [16, 4, 1];
            for (let i = 0; i < blurnums.length; i++) {
                /*  this.horizontalQuad.material.uniforms["h"].value = blurnums[i];
                  this.verticalQuad.material.uniforms["v"].value = blurnums[i];
                  renderer.setRenderTarget(this.readTargetInternal);
                  this.horizontalQuad.render(renderer);
                  this.verticalQuad.material.uniforms["tDiffuse"].value = this.readTargetInternal.texture;
                  renderer.setRenderTarget(this.writeTargetInternal);
                  this.verticalQuad.render(renderer);*/
                if (i % 2 == 0) {
                    [this.writeTargetInternal, this.readTargetInternal] = [this.readTargetInternal, this.writeTargetInternal];
                    this.horizontalQuad.material.uniforms["h"].value = blurnums[i] * this.configuration.denoiseStrength;
                    this.horizontalQuad.material.uniforms["tDiffuse"].value = this.readTargetInternal.texture;
                    renderer.setRenderTarget(this.writeTargetInternal);
                    this.horizontalQuad.render(renderer);
                    [this.writeTargetInternal, this.readTargetInternal] = [this.readTargetInternal, this.writeTargetInternal];
                    this.verticalQuad.material.uniforms["v"].value = blurnums[i] * this.configuration.denoiseStrength;
                    this.verticalQuad.material.uniforms["tDiffuse"].value = this.readTargetInternal.texture;
                    renderer.setRenderTarget(this.writeTargetInternal);
                    this.verticalQuad.render(renderer);
                } else {
                    [this.writeTargetInternal, this.readTargetInternal] = [this.readTargetInternal, this.writeTargetInternal];
                    this.verticalQuad.material.uniforms["v"].value = blurnums[i] * this.configuration.denoiseStrength;
                    this.verticalQuad.material.uniforms["tDiffuse"].value = this.readTargetInternal.texture;
                    renderer.setRenderTarget(this.writeTargetInternal);
                    this.verticalQuad.render(renderer);
                    [this.writeTargetInternal, this.readTargetInternal] = [this.readTargetInternal, this.writeTargetInternal];
                    this.horizontalQuad.material.uniforms["h"].value = blurnums[i] * this.configuration.denoiseStrength;
                    this.horizontalQuad.material.uniforms["tDiffuse"].value = this.readTargetInternal.texture;
                    renderer.setRenderTarget(this.writeTargetInternal);
                    this.horizontalQuad.render(renderer);

                }

            }
        }

        /*  effectCompositer.uniforms["sceneDiffuse"].value = defaultTexture.texture;
          effectCompositer.uniforms["sceneAlbedo"].value = albedoTexture.texture;
          effectCompositer.uniforms["sceneDepth"].value = defaultTexture.depthTexture;
          effectCompositer.uniforms["sceneAO"].value = n8aoRenderTarget.texture;
          effectCompositer.uniforms["voxelTexture"].value = voxelModule.getVoxelRenderTarget().texture;
          effectCompositer.uniforms['giStrengthMultiplier'].value = effectController.giStrength * (effectController.useSimpleEnvmap && !effectController.giOnly ? 0.0 : 1.0);
          effectCompositer.uniforms['giOnly'].value = effectController.giOnly;
          effectCompositer.uniforms['aoEnabled'].value = effectController.aoEnabled;*/

        this.effectCompositer.material.uniforms["sceneDiffuse"].value = this.defaultTexture.texture;
        this.effectCompositer.material.uniforms["sceneAlbedo"].value = this.albedoTexture.texture;
        this.effectCompositer.material.uniforms["sceneDepth"].value = this.defaultTexture.depthTexture;
        this.effectCompositer.material.uniforms["sceneAO"].value = this.n8aoRenderTarget.texture;
        this.effectCompositer.material.uniforms["tDiffuse"].value = this.writeTargetInternal.texture;
        this.effectCompositer.material.uniforms["voxelTexture"].value = this.voxelModule.getIndexTexture();
        this.effectCompositer.material.uniforms["giStrengthMultiplier"].value = this.configuration.giStrength * (!this.configuration.useSimpleEnvmap);
        this.effectCompositer.material.uniforms["giOnly"].value = this.configuration.giOnly;
        this.effectCompositer.material.uniforms["aoEnabled"].value = true;

        renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
        this.effectCompositer.render(renderer);



    }

}

export { N8GIPass };