import { HorizontalBlurShader } from './HorizontalBlurShader.js';
import { VerticalBlurShader } from './VerticalBlurShader.js';
import { ShaderPass } from 'https://unpkg.com/three@0.162.0/examples/jsm/postprocessing/ShaderPass.js';
import { EffectShader } from './EffectShader.js';
import { EffectCompositer } from './EffectCompositer.js';
import { VoxelModule } from './VoxelModule.js';
import * as THREE from 'https://unpkg.com/three@0.162.0/build/three.module.min.js';

export class N8GIPass {
    constructor(scene, camera, renderer, environment, {
        size,
        center,
        defaultTexture,
        normalTexture,
        albedoTexture,
        n8aoRenderTarget,
        bluenoise
    }) {
        const VOXEL_AMOUNT = size.clone().multiplyScalar(0.5).floor();
        let VOXEL_RATIO_MAX = (new THREE.Vector3(VOXEL_AMOUNT.x / size.x, VOXEL_AMOUNT.y / size.y, VOXEL_AMOUNT.z / size.z));
        VOXEL_RATIO_MAX = Math.max(VOXEL_RATIO_MAX.x, VOXEL_RATIO_MAX.y, VOXEL_RATIO_MAX.z);

        const voxelCenter = center.clone();
        const voxelSize = size.clone();

        this.voxelModule = new VoxelModule({
            scene,
            renderer,
            VOXEL_AMOUNT,
            voxelCenter,
            voxelSize,
            workers: navigator.hardwareConcurrency,
        });

        this.voxelModule.init();
        this.voxelModule.updateVoxels();

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

        const clientWidth = renderer.domElement.width;
        const clientHeight = renderer.domElement.height;
        this.effectPass = new ShaderPass(EffectShader);
        this.blurs = [];
        for (let i = 0; i < 3; i++) {
            const hblur = new ShaderPass(HorizontalBlurShader);
            const vblur = new ShaderPass(VerticalBlurShader);
            const blurSize = 2.0;
            hblur.uniforms.h.value = blurSize;
            vblur.uniforms.v.value = blurSize;
            this.blurs.push([hblur, vblur]);
        }

        this.effectCompositer = new ShaderPass(EffectCompositer);

        this.configuration = {
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
            aoIntensity: 5
        };

        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.environment = environment;
        this.defaultTexture = defaultTexture;
        this.normalTexture = normalTexture;
        this.albedoTexture = albedoTexture;
        this.n8aoRenderTarget = n8aoRenderTarget;
        this.bluenoise = bluenoise;
    }

    update() {
        this.voxelModule.update();

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
        this.effectPass.uniforms["sceneDiffuse"].value = this.defaultTexture.texture;
        this.effectPass.uniforms["sceneDepth"].value = this.defaultTexture.depthTexture;
        this.effectPass.uniforms["sceneNormal"].value = this.normalTexture.texture;
        this.effectPass.uniforms["sceneAlbedo"].value = this.albedoTexture.texture;
        this.effectPass.uniforms["bluenoise"].value = this.bluenoise;
        this.effectPass.uniforms["skybox"].value = this.environment;
        this.effectPass.uniforms["voxelTexture"].value = this.voxelModule.getIndexTexture();
        this.effectPass.uniforms["voxelColor"].value = this.voxelModule.getVoxelRenderTarget().texture;
        this.effectPass.uniforms["voxelColorTextureSize"].value = this.voxelModule.getVoxelRenderTargetSize();
        this.effectPass.uniforms["projMat"].value = this.camera.projectionMatrix;
        this.effectPass.uniforms["viewMat"].value = this.camera.matrixWorldInverse;
        this.effectPass.uniforms["projectionMatrixInv"].value = this.camera.projectionMatrixInverse;
        this.effectPass.uniforms["viewMatrixInv"].value = this.camera.matrixWorld;
        this.effectPass.uniforms["cameraPos"].value = this.camera.getWorldPosition(new THREE.Vector3());
        this.effectPass.uniforms['resolution'].value = new THREE.Vector2(this.renderer.domElement.width, this.renderer.domElement.height);
        this.effectPass.uniforms['time'].value = performance.now() / 1000;
        this.effectPass.uniforms['boxSize'].value = this.voxelModule.voxelSize;
        this.effectPass.uniforms['boxCenter'].value = this.voxelModule.voxelCenter;
        this.effectPass.uniforms['roughness'].value = this.configuration.roughness;
        this.effectPass.uniforms['voxelAmount'].value = this.voxelModule.VOXEL_AMOUNT;
        this.effectPass.uniforms['debugVoxels'].value = this.configuration.voxelsOnly;
        this.effectPass.uniforms['samples'].value = this.configuration.samples;

        const blurnums = [16, 4, 1];
        this.blurs.forEach(([hblur, vblur], i) => {
            const blurSize = blurnums[i];
            hblur.uniforms["sceneDepth"].value = this.defaultTexture.depthTexture;
            hblur.uniforms["normalTexture"].value = this.normalTexture.texture;
            hblur.uniforms["resolution"].value = new THREE.Vector2(this.renderer.domElement.width, this.renderer.domElement.height);
            hblur.uniforms["projectionMatrixInv"].value = this.camera.projectionMatrixInverse;
            hblur.uniforms["viewMatrixInv"].value = this.camera.matrixWorld;
            vblur.uniforms["sceneDepth"].value = this.defaultTexture.depthTexture;
            vblur.uniforms["normalTexture"].value = this.normalTexture.texture;
            vblur.uniforms["resolution"].value = new THREE.Vector2(this.renderer.domElement.width, this.renderer.domElement.height);
            vblur.uniforms["projectionMatrixInv"].value = this.camera.projectionMatrixInverse;
            vblur.uniforms["viewMatrixInv"].value = this.camera.matrixWorld;
            hblur.uniforms.h.value = blurSize * this.configuration.denoiseStrength;
            vblur.uniforms.v.value = blurSize * this.configuration.denoiseStrength;
            hblur.enabled = this.configuration.denoise && !this.configuration.voxelsOnly;
            vblur.enabled = this.configuration.denoise && !this.configuration.voxelsOnly;
        });

        this.effectCompositer.uniforms["sceneDiffuse"].value = this.defaultTexture.texture;
        this.effectCompositer.uniforms["sceneAlbedo"].value = this.albedoTexture.texture;
        this.effectCompositer.uniforms["sceneDepth"].value = this.defaultTexture.depthTexture;
        this.effectCompositer.uniforms["sceneAO"].value = this.n8aoRenderTarget.texture;
        this.effectCompositer.uniforms["voxelTexture"].value = this.voxelModule.getVoxelRenderTarget().texture;
        this.effectCompositer.uniforms['giStrengthMultiplier'].value = this.configuration.giStrength * (this.configuration.useSimpleEnvmap && !this.configuration.giOnly ? 0.0 : 1.0);
        this.effectCompositer.uniforms['giOnly'].value = this.configuration.giOnly;
        this.effectCompositer.uniforms['aoEnabled'].value = this.configuration.aoEnabled;
        this.effectCompositer.enabled = !this.configuration.voxelsOnly;
    }

    render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
        this.update();

        this.effectPass.render(renderer, readBuffer, writeBuffer, deltaTime, maskActive);

        for (const [hblur, vblur] of this.blurs) {
            hblur.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
            vblur.render(renderer, readBuffer, writeBuffer, deltaTime, maskActive);
        }

        this.effectCompositer.render(renderer, readBuffer, writeBuffer, deltaTime, maskActive);
    }

    setSize(width, height) {
        this.effectPass.setSize(width, height);
        this.blurs.forEach(([hblur, vblur]) => {
            hblur.setSize(width, height);
            vblur.setSize(width, height);
        });
        this.effectCompositer.setSize(width, height);
    }
}