import * as THREE from 'https://unpkg.com/three@0.162.0/build/three.module.min.js';
import { FullScreenQuad } from "https://unpkg.com/three/examples/jsm/postprocessing/Pass.js";
import { VoxelColorShader } from './VoxelColorShader.js';
import { packRGBToUint32, createBufferTexture, imageToDataTexture, createGBufferSplit, computeSplits } from './utils.js';

export class VoxelModule {
    constructor({ scene, renderer, VOXEL_AMOUNT, voxelCenter, voxelSize, workers }) {
        this.scene = scene;
        this.renderer = renderer;
        this.VOXEL_AMOUNT = VOXEL_AMOUNT;
        this.voxelCenter = voxelCenter;
        this.voxelSize = voxelSize;
        this.workers = [];
        this.workerCount = workers;
    }

    init() {
        this.children = [];
        this.scene.traverse((child) => {
            if (child.isMesh && child.geometry.index) {
                child.updateMatrixWorld(true);
                this.children.push(child);
            }
        });


        this.meshMatrixData = new Float32Array(new SharedArrayBuffer(this.children.length * 4 * 4 * 4));
        this.meshMatrixTex = new THREE.DataTexture(this.meshMatrixData, 4, this.children.length, THREE.RGBAFormat, THREE.FloatType);
        this.meshMatrixTex.needsUpdate = true;
        this.indexArray = new Int32Array(new SharedArrayBuffer(this.VOXEL_AMOUNT.z * this.VOXEL_AMOUNT.y * this.VOXEL_AMOUNT.x * 4));
        this.voxelRenderTargetSize = Math.ceil(Math.sqrt(this.VOXEL_AMOUNT.z * this.VOXEL_AMOUNT.y * this.VOXEL_AMOUNT.x));
        this.voxelRenderTarget = new THREE.WebGLRenderTarget(this.voxelRenderTargetSize, this.voxelRenderTargetSize, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAIntegerFormat,
            type: THREE.UnsignedIntType,
            internalFormat: "RGBA32UI",
            count: 2
        });

        this.indexTex = new THREE.Data3DTexture(this.indexArray, this.VOXEL_AMOUNT.x, this.VOXEL_AMOUNT.y, this.VOXEL_AMOUNT.z);
        this.indexTex.format = THREE.RedIntegerFormat;
        this.indexTex.type = THREE.IntType;
        this.indexTex.colorSpace = THREE.NoColorSpace;
        this.indexTex.minFilter = THREE.NearestFilter;
        this.indexTex.maxFilter = THREE.NearestFilter;

        let total = 0;
        this.children.forEach((child) => {
            total += child.geometry.index.array.length;
        });
        this.MAX_POINTS = total;
        const MAX_POINTS = this.MAX_POINTS;

        const posTexSize = Math.ceil(Math.sqrt(MAX_POINTS));
        const meshIndexBuffer = new Int32Array(posTexSize * posTexSize);
        const meshIndexTex = new THREE.DataTexture(meshIndexBuffer, posTexSize, posTexSize, THREE.RedIntegerFormat, THREE.IntType);
        meshIndexTex.minFilter = THREE.NearestFilter;
        meshIndexTex.maxFilter = THREE.NearestFilter;
        meshIndexTex.needsUpdate = true;

        const materials = [];
        /* scene.traverse((child) => {
             if (child.isMesh && child.geometry.index) {
                 if (materials.indexOf(child.material) === -1) {
                     materials.push(child.material);
                 }
                 child.materialIndex = materials.indexOf(child.material);
             }
         });*/
        this.children.forEach((child) => {
            if (materials.indexOf(child.material) === -1) {
                materials.push(child.material);
            }
            child.materialIndex = materials.indexOf(child.material);
        });

        /* let maps = [
             await new THREE.TextureLoader().loadAsync('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdj+P///38ACfsD/QVDRcoAAAAASUVORK5CYII='),
         ];*/
        // Use data texture
        let maps = [
            new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType)
        ]
        for (let i = 0; i < materials.length; i++) {
            if (materials[i].map) {
                maps.push(materials[i].map);
                materials[i].mapIndex = maps.length - 1;
            } else {
                materials[i].mapIndex = 0;
            }
        }

        const materialInfoBuffer = new Uint32Array(materials.length * 4);
        this.materials = materials;
        this.materialInfoBuffer = materialInfoBuffer;
        for (let i = 0; i < materials.length; i++) {
            materialInfoBuffer[i * 4] = packRGBToUint32(new THREE.Vector3(materials[i].emissive.r, materials[i].emissive.g, materials[i].emissive.b));
            materialInfoBuffer[i * 4 + 1] = packRGBToUint32(new THREE.Vector3(materials[i].color.r, materials[i].color.g, materials[i].color.b));
            materialInfoBuffer[i * 4 + 2] = packRGBToUint32(new THREE.Vector3(
                materials[i].metalnessMap ? 0 : materials[i].metalness,
                materials[i].roughnessMap ? 0 : materials[i].roughness,
                0.0));
            materialInfoBuffer[i * 4 + 3] = materials[i].mapIndex;
        }

        const materialDataTexture = new THREE.DataTexture(materialInfoBuffer, materials.length, 1);
        materialDataTexture.minFilter = THREE.NearestFilter;
        materialDataTexture.maxFilter = THREE.NearestFilter;
        materialDataTexture.format = THREE.RGBAIntegerFormat;
        materialDataTexture.type = THREE.UnsignedIntType;
        materialDataTexture.internalFormat = "RGBA32UI";
        materialDataTexture.needsUpdate = true;
        this.materialDataTexture = materialDataTexture;

        const TARGET_SIZE_X = 1024;
        const TARGET_SIZE_Y = 1024;
        maps = maps.map((map, i) => {
            if (i === 0) {
                const blank = new ImageData(TARGET_SIZE_X, TARGET_SIZE_Y);
                for (let i = 0; i < blank.data.length; i++) {
                    blank.data[i] = 255;
                }
                return blank;
            }
            return imageToDataTexture(map, TARGET_SIZE_X, TARGET_SIZE_Y);
        });

        const mapAtlasArray = new Uint8Array(TARGET_SIZE_X * TARGET_SIZE_Y * maps.length * 4);
        for (let i = 0; i < maps.length; i++) {
            mapAtlasArray.set(maps[i].data, i * TARGET_SIZE_X * TARGET_SIZE_Y * 4);
        }

        const mapAtlas = new THREE.DataArrayTexture(mapAtlasArray, TARGET_SIZE_X, TARGET_SIZE_Y, maps.length);
        mapAtlas.format = THREE.RGBAFormat;
        mapAtlas.type = THREE.UnsignedByteType;
        mapAtlas.minFilter = THREE.LinearMipMapLinearFilter;
        mapAtlas.magFilter = THREE.LinearFilter;
        mapAtlas.wrapS = THREE.RepeatWrapping;
        mapAtlas.wrapT = THREE.RepeatWrapping;
        mapAtlas.colorSpace = "srgb";
        mapAtlas.generateMipmaps = true;
        mapAtlas.needsUpdate = true;
        this.mapAtlas = mapAtlas;
        this.posTexSize = Math.ceil(Math.sqrt(this.MAX_POINTS));
        this.posBufferAux = new Float32Array(new SharedArrayBuffer(this.posTexSize * this.posTexSize * 4 * 4));
        [this.posBufferTex, this.posTex] = createBufferTexture(this.posTexSize);
        [this.normalAuxBuffer, this.normalTex] = createBufferTexture(this.posTexSize);
        [this.uvAuxBuffer, this.uvTex] = createBufferTexture(this.posTexSize);

        this.meshIndexBuffer = new Int32Array(this.posTexSize * this.posTexSize);
        this.meshIndexTex = new THREE.DataTexture(this.meshIndexBuffer, this.posTexSize, this.posTexSize, THREE.RedIntegerFormat, THREE.IntType);
        this.meshIndexTex.minFilter = THREE.NearestFilter;
        this.meshIndexTex.maxFilter = THREE.NearestFilter;
        this.meshIndexTex.needsUpdate = true;

        for (let i = 0; i < this.workerCount; i++) {
            const worker = new Worker('./voxel-worker.js', { type: "module" });
            this.workers.push(worker);
        }

        let posCount = 0;
        let uvCount = 0;
        let indexCount = 0;
        let normalCount = 0;
        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];
            const positions = child.geometry.attributes.position.array;
            const uvs = child.geometry.attributes.uv.array;
            const indices = child.geometry.index.array;
            const normals = child.geometry.attributes.normal.array;
            const iLen = indices.length;
            child.meshIndex = i;

            for (let j = 0; j < iLen; j++) {
                const i = indices[j];
                this.posBufferTex[posCount++] = positions[i * 3];
                this.posBufferTex[posCount++] = positions[i * 3 + 1];
                this.posBufferTex[posCount++] = positions[i * 3 + 2];
                this.posBufferTex[posCount++] = 0;
                this.uvAuxBuffer[uvCount++] = uvs[i * 2];
                this.uvAuxBuffer[uvCount++] = uvs[i * 2 + 1];
                this.uvAuxBuffer[uvCount++] = 0.0;
                this.uvAuxBuffer[uvCount++] = 0.0;
                this.meshIndexBuffer[indexCount++] = child.meshIndex;
                this.normalAuxBuffer[normalCount++] = normals[i * 3];
                this.normalAuxBuffer[normalCount++] = normals[i * 3 + 1];
                this.normalAuxBuffer[normalCount++] = normals[i * 3 + 2];
                this.normalAuxBuffer[normalCount++] = child.materialIndex;
            }
        }

        this.posTex.needsUpdate = true;
        this.normalTex.needsUpdate = true;
        this.uvTex.needsUpdate = true;
        this.meshIndexTex.needsUpdate = true;

        this.meshIndexData = [];
        let sum = 0;
        for (let i = 0; i < this.children.length; i++) {
            this.meshIndexData[i] = sum;
            sum += this.children[i].geometry.index.array.length;
        }

        this.meshIndexSplits = [];
        const splitSize = Math.ceil(sum / this.workerCount);
        for (let i = 0; i < this.workerCount; i++) {
            this.meshIndexSplits[i] = this.meshIndexData.findIndex((value) => value >= splitSize * (i + 1));
        }
        this.meshIndexSplits[this.workerCount - 1] = this.children.length;

        for (let i = 0; i < this.workerCount; i++) {
            const worker = this.workers[i];
            const startIndex = i === 0 ? 0 : this.meshIndexSplits[i - 1];
            const endIndex = this.meshIndexSplits[i];
            for (let j = startIndex; j < endIndex; j++) {
                worker.postMessage({
                    type: "add",
                    data: {
                        id: j,
                        position: this.children[j].geometry.attributes.position.array,
                        index: this.children[j].geometry.index.array,
                    }
                });
            }
        }
        let s = 0;
        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];
            child.meshIndex = i;
            s += child.geometry.index.array.length;
        }
        this.posSum = s;

        this.firstVoxelization = true;
        this.sahSplits = [];

        let vs = VoxelColorShader.vertexShader;
        let fs = VoxelColorShader.fragmentShader;
        const lights = [];
        this.scene.traverse((child) => {
            if (child.isLight) {
                lights.push(child);
            }
        });
        fs = fs.replace(`#include <lights_pars_begin>`, THREE.ShaderChunk.lights_pars_begin);
        fs = fs.replace(`#include <shadowmap_pars_fragment>`, THREE.ShaderChunk.shadowmap_pars_fragment);
        if (this.renderer.shadowMap.enabled) {
            fs = "#define USE_SHADOWMAP\n" + fs;
        }
        if (this.renderer.shadowMap.type === THREE.PCFShadowMap) {
            fs = "#define SHADOWMAP_TYPE_PCF\n" + fs;
        } else if (this.renderer.shadowMap.type === THREE.PCFSoftShadowMap) {
            fs = "#define SHADOWMAP_TYPE_PCF_SOFT\n" + fs;
        } else if (this.renderer.shadowMap.type === THREE.VSMShadowMap) {
            fs = "#define SHADOWMAP_TYPE_VSM\n" + fs;
        }
        fs = fs.replace(/NUM_DIR_LIGHTS/g, lights.filter((light) => light.isDirectionalLight).length);
        fs = fs.replace(/NUM_DIR_LIGHT_SHADOWS/g, lights.filter((light) => light.isDirectionalLight && light.castShadow).length);
        fs = fs.replace(/NUM_POINT_LIGHTS/g, lights.filter((light) => light.isPointLight).length);
        fs = fs.replace(/NUM_POINT_LIGHT_SHADOWS/g, lights.filter((light) => light.isPointLight && light.castShadow).length);
        fs = fs.replace(/NUM_SPOT_LIGHTS/g, lights.filter((light) => light.isSpotLight).length);
        fs = fs.replace(/NUM_SPOT_LIGHT_SHADOWS/g, lights.filter((light) => light.isSpotLight && light.castShadow).length);
        this.voxelColorShader = new FullScreenQuad(new THREE.RawShaderMaterial({
            lights: false,
            uniforms: {
                ...THREE.UniformsLib.lights,
                voxelTex: { value: this.indexTex },
                posTex: { value: this.posTex },
                normalTex: { value: this.normalTex },
                uvTex: { value: this.uvTex },
                textureSize: { value: this.voxelRenderTargetSize },
                posSize: { value: this.posTexSize },
                VOXEL_AMOUNT: { value: this.VOXEL_AMOUNT },
                boxCenter: { value: this.voxelCenter },
                boxSize: { value: this.voxelSize },
                mapAtlas: { value: this.mapAtlas },
                environment: { value: null },
                meshIndexTex: { value: this.meshIndexTex },
                mapSize: { value: 1024 },
                materialDataTexture: { value: this.materialDataTexture },
                meshMatrixTex: { value: this.meshMatrixTex },
                time: { value: 0.0 },
                sceneTex: { value: null },
                sceneDepth: { value: null },
                viewMat: { value: new THREE.Matrix4() },
                projMat: { value: new THREE.Matrix4() },
                viewMatrixInv: { value: new THREE.Matrix4() },
                projectionMatrixInv: { value: new THREE.Matrix4() },
            },
            vertexShader: vs,
            fragmentShader: fs,
            glslVersion: THREE.GLSL3
        }));

        //this.voxelColorShader._mesh.add(

        /* this.voxelColorShader.material.onBeforeCompile = (shader) => {
             console.log(shader.fragmentShader);
         }*/

    }

    update() {
        this.voxelColorShader.material.uniforms["time"].value = performance.now() / 1000;
    }

    setUniform(key, value) {
        this.voxelColorShader.material.uniforms[key].value = value;
    }

    async updateVoxels() {
        console.time("Voxelization: ");
        this.indexArray.fill(-1);

        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];
            child.updateWorldMatrix(false, false);
            const transform = child.matrixWorld;
            transform.toArray(this.meshMatrixData, i * 16);
        }

        const positionPromises = this.workers.map((worker, i) => new Promise((resolve, reject) => {
            worker.onmessage = (e) => {
                resolve();
            };
            const startIndex = i === 0 ? 0 : this.meshIndexSplits[i - 1];
            const endIndex = this.meshIndexSplits[i];
            worker.postMessage({
                type: "transform",
                data: {
                    meshMatrixData: this.meshMatrixData,
                    posBufferAux: this.posBufferAux,
                    startIndex: this.meshIndexData[startIndex] * 4,
                    startMesh: startIndex,
                    endMesh: endIndex,
                }
            });
        }));

        await Promise.all(positionPromises);
        const posBufferCount = 4 * this.posSum;
        const posArray = this.posBufferAux.slice(0, posBufferCount);

        if (this.firstVoxelization) {
            this.sahSplits = computeSplits({
                posArray,
                posBufferCount,
                sum: this.posSum,
                workerCount: this.workerCount,
                VOXEL_RATIO_MAX: Math.max(
                    this.VOXEL_AMOUNT.x / this.voxelSize.x,
                    this.VOXEL_AMOUNT.y / this.voxelSize.y,
                    this.VOXEL_AMOUNT.z / this.voxelSize.z
                )
            });
            this.firstVoxelization = false;
        }

        const pLen = posArray.length;
        const workerIndexLength = Math.ceil(pLen / this.workerCount / 12) * 12;
        const promises = this.workers.map((worker, i) => new Promise((resolve, reject) => {
            worker.onmessage = (e) => {
                resolve();
            };
            const startIndex = i === 0 ? 0 : this.sahSplits[i - 1] * 12;
            const endIndex = this.sahSplits[i] * 12;
            worker.postMessage({
                type: "voxelize",
                data: {
                    posArray: posArray.slice(startIndex, endIndex),
                    voxelCenter: this.voxelCenter,
                    voxelSize: this.voxelSize,
                    VOXEL_AMOUNT: this.VOXEL_AMOUNT,
                    indexArray: this.indexArray,
                    indexOffset: startIndex / 12,
                }
            });
        }));

        await Promise.all(promises);
        this.indexTex.needsUpdate = true;
        this.meshMatrixTex.needsUpdate = true;

        this.renderer.setRenderTarget(this.voxelRenderTarget);
        this.renderer.clear();
        this.voxelColorShader.render(this.renderer);

        console.timeEnd("Voxelization: ");

        requestAnimationFrame(this.updateVoxels.bind(this));
    }

    getIndexTexture() {
        return this.indexTex;
    }

    getVoxelRenderTarget() {
        return this.voxelRenderTarget;
    }

    getVoxelRenderTargetSize() {
        return this.voxelRenderTargetSize;
    }
    setUniform(key, value) {
        this.voxelColorShader.material.uniforms[key].value = value;
    }
    updateMaterialDataTexture() {
        const materials = this.materials;
        const materialInfoBuffer = this.materialInfoBuffer;
        for (let i = 0; i < materials.length; i++) {
            materialInfoBuffer[i * 4] = packRGBToUint32(new THREE.Vector3(materials[i].emissive.r, materials[i].emissive.g, materials[i].emissive.b));
            materialInfoBuffer[i * 4 + 1] = packRGBToUint32(new THREE.Vector3(materials[i].color.r, materials[i].color.g, materials[i].color.b));
            materialInfoBuffer[i * 4 + 2] = packRGBToUint32(new THREE.Vector3(
                materials[i].metalnessMap ? 0 : materials[i].metalness,
                materials[i].roughnessMap ? 0 : materials[i].roughness,
                0.0));
            materialInfoBuffer[i * 4 + 3] = materials[i].mapIndex;
        }
        this.materialDataTexture.needsUpdate = true;
    }
}