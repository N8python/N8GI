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
        this.configuration = new Proxy({
            voxelsOnly: false,
            giOnly: false,
            denoise: true,
            denoiseStrength: 1.0,
            roughness: 1.0,
            giStrength: 1.0,
            useSimpleEnvmap: false,
            samples: 1,
            aoEnabled: true
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
        /* this.defaultTexture = createGBufferSplit(width, height);
          this.normalTexture = createGBufferSplit(width, height);
          this.albedoTexture = createGBufferSplit(width, height);*/
        this.gbuffer = new THREE.WebGLRenderTarget(width, height, {
            count: 4,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType,
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
        });
        this.gbuffer.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
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
            internalFormat: 'R11F_G11F_B10F',
            count: 2
        });
        this.readTargetInternal = new THREE.WebGLRenderTarget(this.width, this.height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            depthBuffer: false,
            format: 'RGB',
            type: THREE.FloatType,
            internalFormat: 'R11F_G11F_B10F',
            count: 2
        });
        this.giTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
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
        this.copyQuad = new FullScreenQuad(new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null }
            },
            vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
            `,
            fragmentShader: `
            uniform sampler2D tDiffuse;
            varying vec2 vUv;
            void main() {
                gl_FragColor = texture2D(tDiffuse, vUv);
            }
            `
        }));
        this.voxelModule.updateVoxels();
        this.n8aopass = new N8AOPass(scene, camera, this.width, this.height);
        this.n8aopass.configuration.autoRenderBeauty = false;
        this.n8aopass.beautyRenderTarget = this.gbuffer;
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
        this.objectGBufferMaterials = new Map();

        this.voxelModule.children.forEach(child => {
            const newGBufferMaterial = child.material.clone();
            newGBufferMaterial.onBeforeCompile = (shader) => {
                shader.fragmentShader = "layout(location = 1) out vec4 gNormal;\nlayout(location = 2) out vec4 gAlbedo;\nlayout(location = 3) out vec4 gMaterial;\n" + shader.fragmentShader;
                shader.fragmentShader = shader.fragmentShader.replace(
                    "#include <dithering_fragment>",
                    `
                    #include <dithering_fragment>
                    gNormal = vec4(normal, 1.0);
                    gAlbedo = vec4(diffuseColor);
                    gMaterial = vec4(metalnessFactor, roughnessFactor, 0.0, 0.0);
                    `);
            };

            // child.material = newGBufferMaterial;

            this.objectGBufferMaterials.set(child, newGBufferMaterial);
            child.material = new Proxy(child.material, {
                set: (target, propName, value) => {
                    /*const oldProp = target[propName];
                    target[propName] = value;
                    if (propName === "envMapIntensity") {
                        newGBufferMaterial.envMapIntensity = value;
                    }*/
                    target[propName] = value;
                    newGBufferMaterial[propName] = value;
                    return true;
                },
                get: (target, propName) => {
                    return target[propName];
                }
            });
        });
    }
    setSize(width, height) {
        this.width = width;
        this.height = height;
        /* this.defaultTexture.setSize(width, height);
         this.normalTexture.setSize(width, height);
         this.albedoTexture.setSize(width, height);*/
        this.gbuffer.setSize(width, height);
        this.giTarget.setSize(width, height);
        this.writeTargetInternal.setSize(width, height);
        this.readTargetInternal.setSize(width, height);
        this.n8aoRenderTarget.setSize(width, height);
        this.n8aopass.setSize(width, height);
    }
    render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
        this.voxelModule.voxelColorShader.material.uniforms['sceneTex'].value = this.giTarget.texture;
        this.voxelModule.voxelColorShader.material.uniforms['sceneDepth'].value = this.gbuffer.depthTexture;
        this.voxelModule.voxelColorShader.material.uniforms['projMat'].value = this.camera.projectionMatrix;
        this.voxelModule.voxelColorShader.material.uniforms['viewMat'].value = this.camera.matrixWorldInverse;
        this.voxelModule.voxelColorShader.material.uniforms['projectionMatrixInv'].value = this.camera.projectionMatrixInverse;
        this.voxelModule.voxelColorShader.material.uniforms['viewMatrixInv'].value = this.camera.matrixWorld;

        this.voxelModule.update();
        this.scene.updateMatrixWorld();
        renderer.shadowMap.needsUpdate = true;
        renderer.setRenderTarget(this.gbuffer);
        renderer.clear();
        const oldBackground = this.scene.background;
        this.scene.background = null;
        const oldMaterials = new Map();
        this.voxelModule.children.forEach(child => {
            oldMaterials.set(child, child.material);
            child.material = this.objectGBufferMaterials.get(child);
        });
        renderer.render(this.scene, this.camera);
        this.scene.background = oldBackground;
        this.voxelModule.children.forEach(child => {
            child.material = oldMaterials.get(child);
        });


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
        this.effectQuad.material.uniforms["sceneDiffuse"].value = this.gbuffer.textures[0];
        this.effectQuad.material.uniforms["sceneDepth"].value = this.gbuffer.depthTexture;
        this.effectQuad.material.uniforms["sceneNormal"].value = this.gbuffer.textures[1];
        this.effectQuad.material.uniforms["sceneAlbedo"].value = this.gbuffer.textures[2];
        this.effectQuad.material.uniforms["sceneMaterial"].value = this.gbuffer.textures[3];
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

        this.horizontalQuad.material.uniforms["sceneDepth"].value = this.gbuffer.depthTexture;
        this.horizontalQuad.material.uniforms["sceneMaterial"].value = this.gbuffer.textures[3];
        this.horizontalQuad.material.uniforms["normalTexture"].value = this.gbuffer.textures[1];
        this.horizontalQuad.material.uniforms["resolution"].value = new THREE.Vector2(this.width, this.height);
        this.horizontalQuad.material.uniforms["projectionMatrixInv"].value = this.camera.projectionMatrixInverse;
        this.horizontalQuad.material.uniforms["viewMatrixInv"].value = this.camera.matrixWorld;
        this.verticalQuad.material.uniforms["sceneDepth"].value = this.gbuffer.depthTexture;
        this.verticalQuad.material.uniforms["sceneMaterial"].value = this.gbuffer.textures[3];
        this.verticalQuad.material.uniforms["normalTexture"].value = this.gbuffer.textures[1];
        this.verticalQuad.material.uniforms["resolution"].value = new THREE.Vector2(this.width, this.height);
        this.verticalQuad.material.uniforms["projectionMatrixInv"].value = this.camera.projectionMatrixInverse;
        this.verticalQuad.material.uniforms["viewMatrixInv"].value = this.camera.matrixWorld;
        if (!this.configuration.voxelsOnly && this.configuration.denoise) {
            const blurnums = [16, 4, 1];
            for (let i = 0; i < blurnums.length; i++) {
                // if (i % 2 == 0) {
                [this.writeTargetInternal, this.readTargetInternal] = [this.readTargetInternal, this.writeTargetInternal];
                this.horizontalQuad.material.uniforms["h"].value = blurnums[i] * this.configuration.denoiseStrength;
                this.horizontalQuad.material.uniforms["tDiffuse"].value = this.readTargetInternal.textures[0];
                this.horizontalQuad.material.uniforms["tSpecular"].value = this.readTargetInternal.textures[1];
                renderer.setRenderTarget(this.writeTargetInternal);
                this.horizontalQuad.render(renderer);
                [this.writeTargetInternal, this.readTargetInternal] = [this.readTargetInternal, this.writeTargetInternal];
                this.verticalQuad.material.uniforms["v"].value = blurnums[i] * this.configuration.denoiseStrength;
                this.verticalQuad.material.uniforms["tDiffuse"].value = this.readTargetInternal.textures[0];
                this.verticalQuad.material.uniforms["tSpecular"].value = this.readTargetInternal.textures[1];
                renderer.setRenderTarget(this.writeTargetInternal);
                this.verticalQuad.render(renderer);

            }
        }
        this.effectCompositer.material.uniforms["cameraPos"].value = this.camera.getWorldPosition(new THREE.Vector3());
        this.effectCompositer.material.uniforms["viewMatrixInv"].value = this.camera.matrixWorld;
        this.effectCompositer.material.uniforms["projectionMatrixInv"].value = this.camera.projectionMatrixInverse;
        this.effectCompositer.material.uniforms["sceneDiffuse"].value = this.gbuffer.textures[0];
        this.effectCompositer.material.uniforms["sceneAlbedo"].value = this.gbuffer.textures[2];
        this.effectCompositer.material.uniforms["sceneDepth"].value = this.gbuffer.depthTexture;
        this.effectCompositer.material.uniforms["sceneAO"].value = this.n8aoRenderTarget.texture;
        this.effectCompositer.material.uniforms["tDiffuse"].value = this.writeTargetInternal.textures[0];
        this.effectCompositer.material.uniforms["tSpecular"].value = this.writeTargetInternal.textures[1];
        this.effectCompositer.material.uniforms["voxelTexture"].value = this.voxelModule.getIndexTexture();
        this.effectCompositer.material.uniforms["giStrengthMultiplier"].value = this.configuration.giStrength * (!this.configuration.useSimpleEnvmap);
        this.effectCompositer.material.uniforms["giOnly"].value = this.configuration.giOnly;
        this.effectCompositer.material.uniforms["background"].value = this.scene.background;
        this.effectCompositer.material.uniforms["aoEnabled"].value = this.configuration.aoEnabled;
        //  renderer.setRenderTarget(this.giTarget);
        //   this.effectCompositer.render(renderer);
        /* renderer.setRenderTarget(this.giTarget);
         this.copyQuad.material.uniforms["tDiffuse"].value = this.writeTargetInternal.texture;
         this.copyQuad.render(renderer);*/
        renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
        this.effectCompositer.render(renderer);




    }

}

export { N8GIPass };