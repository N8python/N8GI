import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.min.js';
import { EffectComposer } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/SMAAPass.js';
import { GammaCorrectionShader } from 'https://unpkg.com/three@0.158.0/examples/jsm/shaders/GammaCorrectionShader.js';
import { EffectShader } from "./EffectShader.js";
import { PoissionBlur } from "./PoissionBlur.js";
import { OrbitControls } from 'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.158.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://unpkg.com/three@0.158.0/examples/jsm/loaders/DRACOLoader.js';
import { GUI } from 'https://unpkg.com/three@0.158.0/examples/jsm/libs/lil-gui.module.min.js';
import { FullScreenQuad } from "https://unpkg.com/three/examples/jsm/postprocessing/Pass.js";
import { VerticalBlurShader } from './VerticalBlurShader.js';
import { HorizontalBlurShader } from './HorizontalBlurShader.js';
import { N8AOPass } from "https://unpkg.com/n8ao@latest/dist/N8AO.js"
import { Stats } from "./stats.js";
async function main() {
    // Setup basic renderer, controls, and profiler
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
    // Setup scene
    // Skybox
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
    // Lighting
    // const ambientLight = new THREE.AmbientLight(new THREE.Color(1.0, 1.0, 1.0), 0.25);
    //scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 5.0);
    directionalLight.position.set(-150, 450, -150);
    // Shadows
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
    //  tKnot.scale.set(0.5, 0.5, 0.5);
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
    //tKnot2.scale.set(0.5, 0.5, 0.5);
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
    // tKnot3.scale.set(2, 2, 2);
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
    // tKnot4.scale.set(2, 2, 2);
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
            /* if (child.material.map) {
                 child.material.map.anisotropy = 4;
             }*/
            child.material.envMap = environment;
            child.material.envMapIntensity = 0.0;
        }
    });
    const box = new THREE.Box3().setFromObject(sponza, true);
    box.min = box.min.floor().addScalar(-2);
    box.max = box.max.ceil().addScalar(2);
    const size = box.getSize(new THREE.Vector3()).floor();
    const center = box.getCenter(new THREE.Vector3());

    const VOXEL_AMOUNT = size.clone().multiplyScalar(0.5).floor(); //.addScalar(2);
    let VOXEL_RATIO_MAX = (new THREE.Vector3(VOXEL_AMOUNT.x / size.x, VOXEL_AMOUNT.y / size.y, VOXEL_AMOUNT.z / size.z));
    VOXEL_RATIO_MAX = Math.max(VOXEL_RATIO_MAX.x, VOXEL_RATIO_MAX.y, VOXEL_RATIO_MAX.z);
    const indexArray = new Int32Array(new SharedArrayBuffer(VOXEL_AMOUNT.z * VOXEL_AMOUNT.y * VOXEL_AMOUNT.x * 4));
    const voxelRenderTargetSize = Math.ceil(Math.sqrt(VOXEL_AMOUNT.z * VOXEL_AMOUNT.y * VOXEL_AMOUNT.x));
    const voxelRenderTarget = new THREE.WebGLRenderTarget(voxelRenderTargetSize, voxelRenderTargetSize, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType
    });


    const voxelCenter = center.clone();
    const voxelSize = size.clone();
    const indexTex = new THREE.Data3DTexture(indexArray, VOXEL_AMOUNT.x, VOXEL_AMOUNT.y, VOXEL_AMOUNT.z);
    indexTex.format = THREE.RedIntegerFormat;
    indexTex.type = THREE.IntType;
    indexTex.colorSpace = THREE.NoColorSpace;
    indexTex.minFilter = THREE.NearestFilter;
    indexTex.maxFilter = THREE.NearestFilter;
    // Count the number of points in the scene, do this via the length of all the index buffer
    let total = 0;
    scene.traverse((child) => {
        if (child.isMesh && child.geometry.index) {
            total += child.geometry.index.array.length;
        }
    });
    const MAX_POINTS = total;
    const posTexSize = Math.ceil(Math.sqrt(MAX_POINTS));
    const posBufferAux = new Float32Array(new SharedArrayBuffer(posTexSize * posTexSize * 4 * 4));
    const posBufferTex = new Float32Array(posTexSize * posTexSize * 4);
    const posTex = new THREE.DataTexture(posBufferTex, posTexSize, posTexSize, THREE.RGBAFormat, THREE.FloatType);
    posTex.minFilter = THREE.NearestFilter;
    posTex.maxFilter = THREE.NearestFilter;
    posTex.needsUpdate = true;
    const normalAuxBuffer = new Float32Array(posTexSize * posTexSize * 4);
    const normalTex = new THREE.DataTexture(normalAuxBuffer, posTexSize, posTexSize, THREE.RGBAFormat, THREE.FloatType);
    normalTex.minFilter = THREE.NearestFilter;
    normalTex.maxFilter = THREE.NearestFilter;
    normalTex.needsUpdate = true;
    const uvAuxBuffer = new Float32Array(posTexSize * posTexSize * 4);
    const uvTex = new THREE.DataTexture(uvAuxBuffer, posTexSize, posTexSize, THREE.RGBAFormat, THREE.FloatType);
    uvTex.minFilter = THREE.NearestFilter;
    uvTex.maxFilter = THREE.NearestFilter;
    uvTex.needsUpdate = true;
    const meshIndexBuffer = new Int32Array(posTexSize * posTexSize);
    const meshIndexTex = new THREE.DataTexture(meshIndexBuffer, posTexSize, posTexSize, THREE.RedIntegerFormat, THREE.IntType);
    meshIndexTex.minFilter = THREE.NearestFilter;
    meshIndexTex.maxFilter = THREE.NearestFilter;
    meshIndexTex.needsUpdate = true;
    const materials = [];
    /* if (materials.indexOf(child.material) === -1) {
         materials.push(child.material);
     }*/
    scene.traverse((child) => {
        if (child.isMesh && child.geometry.index) {
            if (materials.indexOf(child.material) === -1) {
                materials.push(child.material);
            }
            child.materialIndex = materials.indexOf(child.material);
        }
    });
    let maps = [
        await new THREE.TextureLoader().loadAsync('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdj+P///38ACfsD/QVDRcoAAAAASUVORK5CYII='),
    ];
    for (let i = 0; i < materials.length; i++) {
        if (materials[i].map) {
            maps.push(materials[i].map);
            materials[i].mapIndex = maps.length - 1;
        } else {
            materials[i].mapIndex = 0;
        }
    }
    const packRGBToUint32 = (v) => {
        const r = Math.floor(v.x * 255.0);
        const g = Math.floor(v.y * 255.0);
        const b = Math.floor(v.z * 255.0);
        return (r << 16) | (g << 8) | b;
    };
    const materialInfoBuffer = new Uint32Array(materials.length * 4);

    for (let i = 0; i < materials.length; i++) {

        // Pack emissive into the material info buffer
        materialInfoBuffer[i * 4] = packRGBToUint32(new THREE.Vector3(materials[i].emissive.r, materials[i].emissive.g, materials[i].emissive.b));
        materialInfoBuffer[i * 4 + 1] = packRGBToUint32(new THREE.Vector3(materials[i].color.r, materials[i].color.g, materials[i].color.b));
        materialInfoBuffer[i * 4 + 2] = packRGBToUint32(new THREE.Vector3(materials[i].metalness, materials[i].roughness, 0.0));
        materialInfoBuffer[i * 4 + 3] = materials[i].mapIndex;
    }
    const materialDataTexture = new THREE.DataTexture(materialInfoBuffer, materials.length, 1);
    materialDataTexture.minFilter = THREE.NearestFilter;
    materialDataTexture.maxFilter = THREE.NearestFilter;
    materialDataTexture.format = THREE.RGBAIntegerFormat;
    materialDataTexture.type = THREE.UnsignedIntType;
    materialDataTexture.internalFormat = "RGBA32UI";
    materialDataTexture.needsUpdate = true;
    // Convert maps to actual pixel data
    const TARGET_SIZE_X = 1024;
    const TARGET_SIZE_Y = 1024;
    maps = maps.map(map => {
        const canvas = document.createElement('canvas');
        canvas.width = TARGET_SIZE_X;
        canvas.height = TARGET_SIZE_Y;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(map.image, 0, 0, TARGET_SIZE_X, TARGET_SIZE_Y);
        return ctx.getImageData(0, 0, TARGET_SIZE_X, TARGET_SIZE_Y);
    });
    const mapAtlasArray = new Uint8Array(TARGET_SIZE_X * TARGET_SIZE_Y * maps.length * 4);
    // Copy all the map data into the array
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

    const children = [];
    scene.traverse((child) => {
        if (child.isMesh && child.geometry.index) {
            child.updateMatrixWorld(true);
            children.push(child);
        }
    });
    let posCount = 0;
    let uvCount = 0;
    let indexCount = 0;
    let normalCount = 0;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const positions = child.geometry.attributes.position.array;
        const uvs = child.geometry.attributes.uv.array;
        const indices = child.geometry.index.array;
        const normals = child.geometry.attributes.normal.array;
        const iLen = indices.length;
        child.meshIndex = i;
        for (let j = 0; j < iLen; j++) {
            const i = indices[j];
            posBufferTex[posCount++] = positions[i * 3];
            posBufferTex[posCount++] = positions[i * 3 + 1];
            posBufferTex[posCount++] = positions[i * 3 + 2];
            posBufferTex[posCount++] = 0;
            uvAuxBuffer[uvCount++] = uvs[i * 2];
            uvAuxBuffer[uvCount++] = uvs[i * 2 + 1];
            uvAuxBuffer[uvCount++] = 0.0;
            uvAuxBuffer[uvCount++] = 0.0;
            meshIndexBuffer[indexCount++] = child.meshIndex;


            normalAuxBuffer[normalCount++] = normals[i * 3];
            normalAuxBuffer[normalCount++] = normals[i * 3 + 1];
            normalAuxBuffer[normalCount++] = normals[i * 3 + 2];
            normalAuxBuffer[normalCount++] = child.materialIndex;

        }
    }
    posTex.needsUpdate = true;
    normalTex.needsUpdate = true;
    uvTex.needsUpdate = true;
    meshIndexTex.needsUpdate = true;
    const uniformsCapture = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
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
    scene.add(uniformsCapture);
    const meshMatrixData = new Float32Array(new SharedArrayBuffer(children.length * 4 * 4 * 4));
    const meshMatrixTex = new THREE.DataTexture(meshMatrixData, 4, children.length, THREE.RGBAFormat, THREE.FloatType);
    meshMatrixTex.needsUpdate = true;
    const voxelColorShader = new FullScreenQuad(new THREE.ShaderMaterial({
        lights: false,
        uniforms: {
            ...THREE.UniformsLib.lights,
            voxelTex: { value: indexTex },
            posTex: { value: posTex },
            normalTex: { value: normalTex },
            uvTex: { value: uvTex },
            textureSize: { value: voxelRenderTargetSize },
            posSize: { value: posTexSize },
            VOXEL_AMOUNT: { value: VOXEL_AMOUNT },
            boxCenter: { value: voxelCenter },
            boxSize: { value: voxelSize },
            mapAtlas: { value: null },
            environment: { value: environment },
            meshIndexTex: { value: meshIndexTex },
            mapSize: { value: TARGET_SIZE_X },
            materialDataTexture: { value: materialDataTexture },
            meshMatrixTex: { value: meshMatrixTex },
            time: { value: 0.0 }
        },
        vertexShader: /*glsl*/ `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
        `,
        fragmentShader: /*glsl*/ `
        #include <common>
        #define N_DIR_LIGHTS 1
       // #include <lights_pars_begin>
       struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};

	uniform DirectionalLight directionalLights[ N_DIR_LIGHTS ];

	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {

		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;

	}
    #define USE_SHADOWMAP
    #define N_DIR_LIGHT_SHADOWS 1

    #ifdef USE_SHADOWMAP

	#if N_DIR_LIGHT_SHADOWS > 0

        uniform mat4 directionalShadowMatrix[ N_DIR_LIGHT_SHADOWS ];

		uniform sampler2D directionalShadowMap[ N_DIR_LIGHT_SHADOWS ];

		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};

		uniform DirectionalLightShadow directionalLightShadows[ N_DIR_LIGHT_SHADOWS ];

	#endif

    #endif


    #include <packing>
    #define SHADOWMAP_TYPE_PCF_SOFT

	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {

		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );

	}

	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {

		return unpackRGBATo2Half( texture2D( shadow, uv ) );

	}

	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){

		float occlusion = 1.0;

		vec2 distribution = texture2DDistribution( shadow, uv );

		float hard_shadow = step( compare , distribution.x ); // Hard Shadow

		if (hard_shadow != 1.0 ) {

			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance ); // Chebeyshevs inequality
			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 ); // 0.3 reduces light bleed
			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );

		}
		return occlusion;

	}

	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {

		float shadow = 1.0;

		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;

		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;

		if ( frustumTest ) {

		#if defined( SHADOWMAP_TYPE_PCF )

			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;

			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;

			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );

		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )

			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;

			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;

			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );

		#elif defined( SHADOWMAP_TYPE_VSM )

			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );

		#else // no percentage-closer filtering:

			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );

		#endif

		}

		return shadow;

	}

	// cubeToUV() maps a 3D direction vector suitable for cube texture mapping to a 2D
	// vector suitable for 2D texture mapping. This code uses the following layout for the
	// 2D texture:
	//
	// xzXZ
	//  y Y
	//
	// Y - Positive y direction
	// y - Negative y direction
	// X - Positive x direction
	// x - Negative x direction
	// Z - Positive z direction
	// z - Negative z direction
	//
	// Source and test bed:
	// https://gist.github.com/tschw/da10c43c467ce8afd0c4

	vec2 cubeToUV( vec3 v, float texelSizeY ) {

		// Number of texels to avoid at the edge of each square

		vec3 absV = abs( v );

		// Intersect unit cube

		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;

		// Apply scale to avoid seams

		// two texels less per square (one texel will do for NEAREST)
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );

		// Unwrap

		// space: -1 ... 1 range for each square
		//
		// #X##		dim    := ( 4 , 2 )
		//  # #		center := ( 1 , 1 )

		vec2 planar = v.xy;

		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;

		if ( absV.z >= almostOne ) {

			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;

		} else if ( absV.x >= almostOne ) {

			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;

		} else if ( absV.y >= almostOne ) {

			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;

		}

		// Transform to UV space

		// scale := 0.5 / dim
		// translate := ( center + 0.5 ) / dim
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );

	}

	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {

		vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );

		// for point lights, the uniform @vShadowCoord is re-purposed to hold
		// the vector from the light to the world-space position of the fragment.
		vec3 lightToPosition = shadowCoord.xyz;

		// dp = normalized distance from light to fragment position
		float dp = ( length( lightToPosition ) - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear ); // need to clamp?
		dp += shadowBias;

		// bd3D = base direction 3D
		vec3 bd3D = normalize( lightToPosition );

		#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )

			vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;

			return (
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
			) * ( 1.0 / 9.0 );

		#else // no percentage-closer filtering

			return texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );

		#endif

	}
        uniform float time;
        uniform highp isampler3D voxelTex;
        uniform highp sampler2D posTex;
        uniform highp sampler2D normalTex;
        uniform highp sampler2D uvTex;
        uniform highp isampler2D meshIndexTex;
        uniform highp usampler2D materialDataTexture;
        uniform highp sampler2D meshMatrixTex;
        uniform highp samplerCube environment;
        uniform int textureSize;
        uniform int posSize;
        uniform highp sampler2DArray mapAtlas;
        uniform float mapSize;
        uniform ivec3 VOXEL_AMOUNT;
        uniform vec3 boxCenter;
        uniform vec3 boxSize;
        varying vec2 vUv;
        float dot2( in vec3 v ) { return dot(v,v); }
float maxcomp( in vec2 v ) { return max(v.x,v.y); }
precision highp isampler2D;

vec4 sample1Dim( sampler2D s, int index, int size ) {
    int y = index / size;
    int x = index - y * size;
    return texelFetch(s, ivec2(x, y), 0);
}
ivec4 sample1Dimi( isampler2D s, int index, int size ) {
    int y = index / size;
    int x = index - y * size;
    return texelFetch(s, ivec2(x, y), 0);
}
        vec3 closestTriangle( in vec3 v0, in vec3 v1, in vec3 v2, in vec3 p )
    {
        vec3 v10 = v1 - v0; vec3 p0 = p - v0;
        vec3 v21 = v2 - v1; vec3 p1 = p - v1;
        vec3 v02 = v0 - v2; vec3 p2 = p - v2;
        vec3 nor = cross( v10, v02 );
        vec3  q = cross( nor, p0 );
        float d = 1.0/dot2(nor);
        float u = d*dot( q, v02 );
        float v = d*dot( q, v10 );
        float w = 1.0-u-v;
        
            if( u<0.0 ) { w = clamp( dot(p2,v02)/dot2(v02), 0.0, 1.0 ); u = 0.0; v = 1.0-w; }
        else if( v<0.0 ) { u = clamp( dot(p0,v10)/dot2(v10), 0.0, 1.0 ); v = 0.0; w = 1.0-u; }
        else if( w<0.0 ) { v = clamp( dot(p1,v21)/dot2(v21), 0.0, 1.0 ); w = 0.0; u = 1.0-v; }
        
            return u*v1 + v*v2 + w*v0;
    }
     
    vec3 bary( in vec3 v0, in vec3 v1, in vec3 v2, in vec3 p ) {
        vec3 normal = cross(v1 - v0, v2 - v0);
        float area = dot(cross(v1 - v0, v2 - v0), normal);
        
        vec3 pv0 = v0 - p;
        vec3 pv1 = v1 - p;
        vec3 pv2 = v2 - p;
        
        vec3 asub = vec3(dot(cross(pv1, pv2), normal),
                        dot(cross(pv2, pv0), normal),
                        dot(cross(pv0, pv1), normal));
        return abs(asub) / vec3(abs(area)).xxx;
    }

    vec3 toWorldSpace(vec3 pos) {
        pos *= boxSize / vec3(VOXEL_AMOUNT);
        pos -= boxSize / 2.0;
        pos += boxCenter;
        return pos;
      }
      vec3 toVoxelSpace(vec3 pos) {
        pos -= boxCenter;
        pos += boxSize / 2.0;
        pos *= vec3(VOXEL_AMOUNT) / boxSize;
        return pos;
      }
      float packThreeBytes(vec3 bytes) {
        // Ensure the input is clamped to the valid range [0, 255]
        bytes = clamp(bytes * 254.99, 0.0, 255.0);
        
        // Combine the three bytes into one integer
        int packedInt = (int(bytes.x) << 16) | (int(bytes.y) << 8) | int(bytes.z);
        
        // Convert the integer to a float
        float packedFloat = float(packedInt) / 16777215.0; // 16777215.0 = 2^24 - 1
        
        return packedFloat;
    }
    float hash(float n) {
        return fract(sin(n) * 43758.5453123);
    }
    
    vec3 randomColor(float seed) {
        float r = hash(seed);
        float g = hash(seed + 1.0);
        float b = hash(seed + 2.0);
        return vec3(r, g, b);
    }
    vec3 unpackRGB(uint rgb) {
        return vec3(
            float((rgb >> 16) & 0xFFu) / 255.0,
            float((rgb >> 8) & 0xFFu) / 255.0,
            float(rgb & 0xFFu) / 255.0
        );
    }

        void main() {
            int index = int(gl_FragCoord.y) * textureSize + int(gl_FragCoord.x);
            int voxelZ = index / (VOXEL_AMOUNT.x * VOXEL_AMOUNT.y);
            int voxelY = (index - voxelZ * VOXEL_AMOUNT.x * VOXEL_AMOUNT.y) / VOXEL_AMOUNT.x;
            int voxelX = index - voxelZ * VOXEL_AMOUNT.x * VOXEL_AMOUNT.y - voxelY * VOXEL_AMOUNT.x;
            int sampledIndex = texelFetch(voxelTex, ivec3(voxelX, voxelY, voxelZ), 0).r;
           if (sampledIndex < 0) {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            } else {
                int meshIndex = sample1Dimi(meshIndexTex, sampledIndex * 3, posSize).r;
                mat4 worldMatrix;
                   worldMatrix = (mat4(
                        texelFetch(meshMatrixTex, ivec2(0, meshIndex), 0),
                        texelFetch(meshMatrixTex, ivec2(1, meshIndex), 0),
                        texelFetch(meshMatrixTex, ivec2(2, meshIndex), 0),
                        texelFetch(meshMatrixTex, ivec2(3, meshIndex), 0)
                    )) ;
                  //  worldMatrix =  [meshIndex];
                
                // Get y rotation of world matrix


                // Compute normal matrix by normalizing the rotation part of the world matrix
                mat3 normalMatrix = transpose(mat3(inverse(worldMatrix)));
               vec3 posA =(worldMatrix * vec4(sample1Dim(posTex, sampledIndex * 3, posSize).xyz, 1.0)).xyz;
                vec3 posB = (worldMatrix *  vec4(sample1Dim(posTex, sampledIndex * 3 + 1, posSize).xyz, 1.0)).xyz;
                vec3 posC = (worldMatrix *  vec4(sample1Dim(posTex, sampledIndex * 3 + 2, posSize).xyz, 1.0)).xyz;
                // Get barycoords 
                vec3 worldPos = closestTriangle(posA, posB, posC, toWorldSpace(vec3(voxelX, voxelY, voxelZ) + vec3(0.5)));
                vec3 baryCoords = bary(posA, posB, posC, worldPos);

                // Get normals
                vec3 normalA = normalMatrix * sample1Dim(normalTex, sampledIndex * 3, posSize).xyz;
                vec3 normalB = normalMatrix * sample1Dim(normalTex, sampledIndex * 3 + 1, posSize).xyz;
                vec4 normalCInitial = sample1Dim(normalTex, sampledIndex * 3 + 2, posSize);
                vec3 normalC = normalMatrix * normalCInitial.xyz;
                int materialIndex = int(normalCInitial.w);
                vec3 interpolatedNormal = normalize(normalA * baryCoords.x + normalB * baryCoords.y + normalC * baryCoords.z);
               if (dot(-interpolatedNormal, directionalLights[0].direction) > dot(interpolatedNormal, directionalLights[0].direction)) {
                    interpolatedNormal = -interpolatedNormal;
                }
                vec2 uvA = sample1Dim(uvTex, sampledIndex * 3, posSize).xy;
                vec2 uvB = sample1Dim(uvTex, sampledIndex * 3 + 1, posSize).xy;
                vec2 uvC = sample1Dim(uvTex, sampledIndex * 3 + 2, posSize).xy;
                vec2 interpolatedUV = uvA * baryCoords.x + uvB * baryCoords.y + uvC * baryCoords.z;

               
                float uvSpanX = max(max(uvA.x, uvB.x), uvC.x) - min(min(uvA.x, uvB.x), uvC.x);
                float uvSpanY = max(max(uvA.y, uvB.y), uvC.y) - min(min(uvA.y, uvB.y), uvC.y);

                vec3 voxelRatio = vec3(VOXEL_AMOUNT) / boxSize;
                float areaOfTriangle = 0.5 * length(cross(posB - posA, posC - posA)) * max(voxelRatio.x, max(voxelRatio.y, voxelRatio.z));
                float xChange = 1024.0 * uvSpanX * (1.0 / sqrt(areaOfTriangle));
                float yChange = 1024.0 * uvSpanY * (1.0 / sqrt(areaOfTriangle));
                float mipLevel = log2(
                    max(
                        xChange,
                        yChange
                    ) / 4.0
                );

                // Get texture
                vec2 uv = vec2(interpolatedUV.x, interpolatedUV.y);
                uvec4 materialData = texelFetch(materialDataTexture, ivec2(materialIndex, 0), 0);
                vec3 mrn = unpackRGB(materialData.b);
                float metalness = mrn.r;
                float roughness = mrn.g;
                float mapIndex = float(materialData.w);
                vec3 color = unpackRGB(
                    materialData.g
                );
                vec3 emissive = unpackRGB(
                    materialData.r
                );//materials[materialIndex].emissive;
                vec4 sampledTexel = textureLod(mapAtlas, vec3(uv, mapIndex), mipLevel);
                vec3 accumulatedLight = vec3(0.0);
                vec3 accumulatedLightBack = vec3(0.0);
                #pragma unroll_loop_start
                for(int i = 0; i < 1; i++) {

                    vec3 lightDirection = directionalLights[ i ].direction;
                    
                    float incidentLight = max(dot( interpolatedNormal, lightDirection ), 0.0);
                    float incidentLightBack = max(dot( -interpolatedNormal, lightDirection ), 0.0);

                    #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < N_DIR_LIGHT_SHADOWS )
                        vec4 shadowCoord = directionalShadowMatrix[i] * vec4(worldPos, 1.0);
                        float shadow = getShadow(directionalShadowMap[i], directionalLightShadows[i].shadowMapSize, directionalLightShadows[i].shadowBias, directionalLightShadows[i].shadowRadius, shadowCoord);
                        incidentLight *= shadow;
                    #endif

                    accumulatedLight += (directionalLights[ i ].color / 3.14159) * incidentLight * sampledTexel.rgb * color;
                    accumulatedLightBack += (directionalLights[ i ].color / 3.14159) * incidentLightBack * sampledTexel.rgb * color;
                }
                #pragma unroll_loop_end

                accumulatedLight += emissive;
                accumulatedLightBack += emissive;


                vec3 center =                     (posA + posB + posC) / 3.0;
                gl_FragColor =
                vec4(
                   packThreeBytes(vec3(
                    accumulatedLight //randomColor(100.0*float(meshIndex))
                   )),
                   packThreeBytes(vec3(
                    accumulatedLightBack //randomColor(100.0*float(meshIndex))
                   )),
                    packThreeBytes(interpolatedNormal * 0.5 + 0.5)
                    , 
                    1.0);
                 //vec4(unpackRGBAToDepth(vec4(accumulatedLight, 1.0)), unpackRGBAToDepth(vec4(accumulatedLightBack, 1.0)), unpackRGBAToDepth(vec4(0.5 + 0.5 * interpolatedNormal, 1.0)), 1.0);


            }
        }
        `
    }));






    // Build postprocessing stack
    // Render Targets
    const defaultTexture = new THREE.WebGLRenderTarget(clientWidth, clientHeight, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.NearestFilter,
        type: THREE.HalfFloatType
    });
    defaultTexture.depthTexture = new THREE.DepthTexture(clientWidth, clientHeight, THREE.FloatType);

    const normalTexture = new THREE.WebGLRenderTarget(clientWidth, clientHeight, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType
    });
    normalTexture.depthTexture = new THREE.DepthTexture(clientWidth, clientHeight, THREE.FloatType);
    const albedoTexture = new THREE.WebGLRenderTarget(clientWidth, clientHeight, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType
    });
    albedoTexture.depthTexture = new THREE.DepthTexture(clientWidth, clientHeight, THREE.FloatType);
    const meshNormalMaterial = new THREE.MeshNormalMaterial();
    const bluenoise = await new THREE.TextureLoader().loadAsync('bluenoise.png');
    bluenoise.wrapS = THREE.RepeatWrapping;
    bluenoise.wrapT = THREE.RepeatWrapping;
    bluenoise.minFilter = THREE.NearestFilter;
    bluenoise.magFilter = THREE.NearestFilter;
    // Post Effects
    const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(clientWidth, clientHeight, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: 'RGB',
        type: THREE.FloatType,
        internalFormat: 'R11F_G11F_B10F'
    }));
    const n8aopass = new N8AOPass(scene, camera, clientWidth, clientHeight);
    n8aopass.configuration.autoRenderBeauty = false;
    n8aopass.beautyRenderTarget = defaultTexture;
    n8aopass.configuration.gammaCorrection = false;
    n8aopass.configuration.aoSamples = 64;
    n8aopass.configuration.denoiseRadius = 3;
    n8aopass.configuration.aoRadius = 10;
    n8aopass.setDisplayMode("AO");

    const n8aoRenderTarget = new THREE.WebGLRenderTarget(clientWidth, clientHeight, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: 'RGB',
        type: THREE.FloatType,
        internalFormat: 'R11F_G11F_B10F'
    });


    const smaaPass = new SMAAPass(clientWidth, clientHeight);
    const effectPass = new ShaderPass(EffectShader);
    const blurs = [];
    for (let i = 0; i < 3; i++) {
        const hblur = new ShaderPass(HorizontalBlurShader);
        const vblur = new ShaderPass(VerticalBlurShader);
        const blurSize = 2.0;
        hblur.uniforms.h.value = blurSize;
        vblur.uniforms.v.value = blurSize;

        blurs.push([hblur, vblur]);
    }


    composer.addPass(effectPass);
    const effectCompositer = new ShaderPass({
        uniforms: {
            sceneDiffuse: { value: null },
            sceneDepth: { value: null },
            sceneAlbedo: { value: null },
            sceneAO: { value: null },
            voxelTexture: { value: null },
            tDiffuse: { value: null },
            giStrengthMultiplier: { value: 1.0 },
            giOnly: { value: false },
            aoEnabled: { value: true },
        },
        vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
        `,
        fragmentShader: `
        uniform sampler2D sceneDiffuse;
        uniform sampler2D sceneDepth;
        uniform sampler2D sceneAlbedo;
        uniform sampler2D sceneAO;
        uniform sampler2D tDiffuse;
        uniform sampler2D voxelTexture;
        uniform float giStrengthMultiplier;
        uniform bool aoEnabled;
        uniform bool giOnly;
        varying vec2 vUv;
        void main() {
            vec4 diffuse = texture2D(sceneDiffuse, vUv);
            float depth = texture2D(sceneDepth, vUv).r;
            vec4 ao =texture2D(sceneAO, vUv);
            if (!aoEnabled) {
                ao = vec4(1.0);
            }
            vec4 albedo = texture2D(sceneAlbedo, vUv);
            vec4 denoised = texture2D(tDiffuse, vUv);
            if (depth == 1.0) {
                gl_FragColor = diffuse;
                return;
            }
            float giStrength = giStrengthMultiplier;
            gl_FragColor = vec4((diffuse.rgb + denoised.rgb * albedo.rgb * giStrength) * ao.rgb, 1.0);
            if (giOnly) {
                gl_FragColor = vec4(giStrength * denoised.rgb * ao.rgb, 1.0);
            }
        }
        `
    });
    blurs.forEach(([h, v], i) => {
        if (i % 2 === 0) {
            composer.addPass(h);
            composer.addPass(v);
        } else {
            composer.addPass(v);
            composer.addPass(h);
        }
    });
    composer.addPass(effectCompositer);
    composer.addPass(new ShaderPass(GammaCorrectionShader));
    composer.addPass(smaaPass);

    const workers = [];
    const positionWorkers = [];
    const workerCount = 16; //navigator.hardwareConcurrency;

    for (let i = 0; i < workerCount; i++) {
        const worker = new Worker('./voxel-worker.js', { type: "module" });
        workers.push(worker);
    }
    for (let i = 0; i < workerCount; i++) {
        const worker = new Worker('./position-worker.js', { type: "module" });
        positionWorkers.push(worker);
    }
    voxelColorShader.material.uniforms["mapAtlas"].value = mapAtlas;

    window.addEventListener('resize', () => {
        clientWidth = window.innerWidth;
        clientHeight = window.innerHeight;

        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();

        renderer.setSize(clientWidth, clientHeight);
        composer.setSize(clientWidth, clientHeight);
        defaultTexture.setSize(clientWidth, clientHeight);
        normalTexture.setSize(clientWidth, clientHeight);
        albedoTexture.setSize(clientWidth, clientHeight);
        defaultTexture.depthTexture.image.width = clientWidth;
        defaultTexture.depthTexture.image.height = clientHeight;
        normalTexture.depthTexture.image.width = clientWidth;
        normalTexture.depthTexture.image.height = clientHeight;
        albedoTexture.depthTexture.image.width = clientWidth;
        albedoTexture.depthTexture.image.height = clientHeight;
        n8aoRenderTarget.setSize(clientWidth, clientHeight);
        n8aopass.setSize(clientWidth, clientHeight);


    });
    // Compute prefix sum of indices of each mesh
    const meshIndexData = [];
    let sum = 0;
    for (let i = 0; i < children.length; i++) {
        meshIndexData[i] = sum;
        sum += children[i].geometry.index.array.length;
    }
    // Compute the splits along the prefix sum for each worker
    const meshIndexSplits = [];
    const splitSize = Math.ceil(sum / workerCount);
    for (let i = 0; i < workerCount; i++) {
        meshIndexSplits[i] = meshIndexData.findIndex((value) => value >= splitSize * (i + 1));
    }
    meshIndexSplits[workerCount - 1] = children.length;

    for (let i = 0; i < workerCount; i++) {
        const worker = positionWorkers[i];
        const startIndex = i === 0 ? 0 : meshIndexSplits[i - 1];
        const endIndex = meshIndexSplits[i];
        for (let j = startIndex; j < endIndex; j++) {
            worker.postMessage({
                type: "add",
                data: {
                    id: j,
                    position: children[j].geometry.attributes.position.array,
                    index: children[j].geometry.index.array,
                }
            });
        }
    }




    let firstVoxelization = true;
    let sahSplits = [];

    function computeSplits({ posArray, posBufferCount, sum }) {
        let triangleSurfaceAreas = new Float32Array(sum / 3);
        let sahSum = 0;
        for (let i = 0; i < posBufferCount; i += 12) {
            const x1 = posArray[i];
            const y1 = posArray[i + 1];
            const z1 = posArray[i + 2];
            const x2 = posArray[i + 4];
            const y2 = posArray[i + 5];
            const z2 = posArray[i + 6];
            const x3 = posArray[i + 8];
            const y3 = posArray[i + 9];
            const z3 = posArray[i + 10];
            const ABx = x2 - x1,
                ABy = y2 - y1,
                ABz = z2 - z1;
            const ACx = x3 - x1,
                ACy = y3 - y1,
                ACz = z3 - z1;

            // Cross product components
            const crossX = ABy * ACz - ABz * ACy;
            const crossY = ABz * ACx - ABx * ACz;
            const crossZ = ABx * ACy - ABy * ACx;
            // Area of the triangle plus a constant factor to account for the cost of rasterizing small triangles
            const area = 0.5 * Math.sqrt(crossX ** 2 + crossY ** 2 + crossZ ** 2) * VOXEL_RATIO_MAX + 10.0;
            sahSum += area;
            triangleSurfaceAreas[i / 12] = sahSum;
        }
        // Compute splits
        const sahSplitSize = sahSum / workerCount;
        sahSplits = [];
        for (let i = 0; i < workerCount; i++) {
            sahSplits[i] = triangleSurfaceAreas.findIndex((value) => value >= sahSplitSize * (i + 1));
        }
        sahSplits[workerCount - 1] = sum / 3;
        return sahSplits;
    }
    async function updateVoxels() {
        console.time();
        indexArray.fill(-1);
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            child.updateWorldMatrix(false, false);
            const transform = child.matrixWorld;
            transform.toArray(meshMatrixData, i * 16);
        }
        const positionPromises = positionWorkers.map((worker, i) => new Promise((resolve, reject) => {
            worker.onmessage = (e) => {
                resolve();
            };
            const startIndex = i === 0 ? 0 : meshIndexSplits[i - 1];
            const endIndex = meshIndexSplits[i];
            worker.postMessage({
                type: "transform",
                data: {
                    meshMatrixData: meshMatrixData,
                    posBufferAux: posBufferAux,
                    startIndex: meshIndexData[startIndex] * 4,
                    startMesh: startIndex,
                    endMesh: endIndex,
                }
            });
        }));
        await Promise.all(positionPromises);
        const posBufferCount = 4 * sum;
        const posArray = posBufferAux.slice(0, posBufferCount);
        if (firstVoxelization) {
            // Compute splits of triangles by surface area
            sahSplits = computeSplits({ posArray, posBufferCount, sum });
            firstVoxelization = false;
        }
        const pLen = posArray.length;
        const workerIndexLength = Math.ceil(pLen / workerCount / 12) * 12;
        const promises = workers.map((worker, i) => new Promise((resolve, reject) => {
            worker.onmessage = (e) => {
                resolve();
            };
            const startIndex = i === 0 ? 0 : sahSplits[i - 1] * 12;
            const endIndex = sahSplits[i] * 12;
            worker.postMessage({
                type: "voxelize",
                data: {
                    posArray: posArray.slice(startIndex, endIndex),
                    voxelCenter: voxelCenter,
                    voxelSize: voxelSize,
                    VOXEL_AMOUNT: VOXEL_AMOUNT,
                    indexArray: indexArray,
                    indexOffset: startIndex / 12,
                }

            });
        }));
        await Promise.all(promises);
        indexTex.needsUpdate = true;
        meshMatrixTex.needsUpdate = true;
        renderer.setRenderTarget(voxelRenderTarget);
        renderer.clear();
        voxelColorShader.render(renderer);
        console.timeEnd();
        requestAnimationFrame(updateVoxels);
    }
    const albedoLight = new THREE.AmbientLight(0xffffff, Math.PI);
    scene.add(albedoLight);

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
        aoIntensity: 5
    }
    gui.add(effectController, "voxelsOnly").onChange((value) => {
        if (value) {
            blurs.forEach(blur => {
                blur[0].enabled = false;
                blur[1].enabled = false;
            });
            effectCompositer.enabled = false;
        } else {
            blurs.forEach(blur => {
                blur[0].enabled = effectController.denoise;
                blur[1].enabled = effectController.denoise;
            });
            effectCompositer.enabled = true;
        }
    });
    gui.add(effectController, "denoise").onChange((value) => {
        if (!effectController.voxelsOnly) {
            blurs.forEach(blur => {
                blur[0].enabled = value;
                blur[1].enabled = value;
            });
        }
    });
    gui.add(effectController, "useSimpleEnvmap").onChange((value) => {

        if (!value) {
            scene.traverse((child) => {
                if (child.isMesh) {
                    child.material.envMapIntensity = 0.0;
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
    gui.add(effectController, "giOnly");
    gui.add(effectController, "samples", 1, 16, 1);
    gui.add(effectController, "denoiseStrength", 0.0, 1.0);
    gui.add(effectController, "giStrength", 0.0, 2.0);
    gui.add(effectController, "roughness", 0.0, 1.0);
    gui.add(effectController, "aoSamples", 1, 64, 1);
    gui.add(effectController, "aoRadius", 1, 10, 1);
    gui.add(effectController, "denoiseRadius", 1, 10, 1);
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

        directionalLight.position.set(
            60 * Math.cos(performance.now() / 1000), //Math.sin(performance.now() / 1000) * 50,
            200,
            60 * Math.sin(performance.now() / 1000), //Math.cos(performance.now() / 1000) * 50
        )
        voxelColorShader.material.uniforms["time"].value = performance.now() / 1000;
        scene.updateMatrixWorld();
        scene.overrideMaterial = meshNormalMaterial;
        renderer.setRenderTarget(normalTexture);
        renderer.clear();
        renderer.render(scene, camera);
        scene.overrideMaterial = null;


        const ogIntensity = directionalLight.intensity;
        directionalLight.intensity = 0.0;
        albedoLight.intensity = Math.PI * Math.PI * (1 + 1 / Math.PI);
        renderer.setRenderTarget(albedoTexture);
        renderer.clear();
        renderer.render(scene, camera);
        directionalLight.intensity = ogIntensity;
        albedoLight.intensity = 0.0;
        renderer.shadowMap.needsUpdate = true;
        renderer.setRenderTarget(defaultTexture);
        renderer.clear();
        renderer.render(scene, camera);

        if (effectController.aoEnabled) {
            n8aopass.configuration.aoSamples = effectController.aoSamples;
            n8aopass.configuration.aoRadius = effectController.aoRadius;
            n8aopass.configuration.denoiseRadius = effectController.denoiseRadius;
            n8aopass.configuration.intensity = effectController.aoIntensity;
            n8aopass.render(
                renderer,
                n8aoRenderTarget,
                null,
                0,
                false
            );
        }

        const uniforms = uniformsCapture.material.uniforms;
        uniforms.directionalLights.value.forEach(light => {
            light.direction.applyMatrix4(new THREE.Matrix4().extractRotation(
                camera.matrixWorld
            ));

        });

        Object.keys(uniforms).forEach(key => {
            voxelColorShader.material.uniforms[key].value = uniforms[key].value;
        });


        camera.updateMatrixWorld();
        effectPass.uniforms["sceneDiffuse"].value = defaultTexture.texture;
        effectPass.uniforms["sceneDepth"].value = defaultTexture.depthTexture;
        effectPass.uniforms["sceneNormal"].value = normalTexture.texture;
        effectPass.uniforms["sceneAlbedo"].value = albedoTexture.texture;
        effectPass.uniforms["bluenoise"].value = bluenoise;
        effectPass.uniforms["skybox"].value = environment;
        effectPass.uniforms["voxelTexture"].value = indexTex;
        effectPass.uniforms["voxelColor"].value = voxelRenderTarget.texture;
        effectPass.uniforms["voxelColorTextureSize"].value = voxelRenderTargetSize;
        effectPass.uniforms["projMat"].value = camera.projectionMatrix;
        effectPass.uniforms["viewMat"].value = camera.matrixWorldInverse;
        effectPass.uniforms["projectionMatrixInv"].value = camera.projectionMatrixInverse;
        effectPass.uniforms["viewMatrixInv"].value = camera.matrixWorld;
        effectPass.uniforms["cameraPos"].value = camera.getWorldPosition(new THREE.Vector3());
        effectPass.uniforms['resolution'].value = new THREE.Vector2(clientWidth, clientHeight);
        effectPass.uniforms['time'].value = performance.now() / 1000;
        effectPass.uniforms['boxSize'].value = voxelSize;
        effectPass.uniforms['boxCenter'].value = voxelCenter;
        effectPass.uniforms['roughness'].value = effectController.roughness;
        effectPass.uniforms['voxelAmount'].value = VOXEL_AMOUNT;
        effectPass.uniforms['debugVoxels'].value = effectController.voxelsOnly;
        effectPass.uniforms['samples'].value = effectController.samples;
        const blurnums = [16, 4, 1];
        blurs.forEach(([hblur, vblur], i) => {
            const blurSize = blurnums[i];
            hblur.uniforms["sceneDepth"].value = defaultTexture.depthTexture;
            hblur.uniforms["normalTexture"].value = normalTexture.texture;
            hblur.uniforms["resolution"].value = new THREE.Vector2(clientWidth, clientHeight);
            hblur.uniforms["projectionMatrixInv"].value = camera.projectionMatrixInverse;
            hblur.uniforms["viewMatrixInv"].value = camera.matrixWorld;
            vblur.uniforms["sceneDepth"].value = defaultTexture.depthTexture;
            vblur.uniforms["normalTexture"].value = normalTexture.texture;
            vblur.uniforms["resolution"].value = new THREE.Vector2(clientWidth, clientHeight);
            vblur.uniforms["projectionMatrixInv"].value = camera.projectionMatrixInverse;
            vblur.uniforms["viewMatrixInv"].value = camera.matrixWorld;
            hblur.uniforms.h.value = blurSize * effectController.denoiseStrength;
            vblur.uniforms.v.value = blurSize * effectController.denoiseStrength;
        });

        effectCompositer.uniforms["sceneDiffuse"].value = defaultTexture.texture;
        effectCompositer.uniforms["sceneAlbedo"].value = albedoTexture.texture;
        effectCompositer.uniforms["sceneDepth"].value = defaultTexture.depthTexture;
        effectCompositer.uniforms["sceneAO"].value = n8aoRenderTarget.texture;
        effectCompositer.uniforms["voxelTexture"].value = voxelRenderTarget.texture;
        effectCompositer.uniforms['giStrengthMultiplier'].value = effectController.giStrength * (effectController.useSimpleEnvmap && !effectController.giOnly ? 0.0 : 1.0);
        effectCompositer.uniforms['giOnly'].value = effectController.giOnly;
        effectCompositer.uniforms['aoEnabled'].value = effectController.aoEnabled;
        composer.render();
        controls.update();
        stats.update();

        requestAnimationFrame(animate);
    }

    // Kick off both animation loops
    requestAnimationFrame(animate);
    requestAnimationFrame(updateVoxels);
}
main();