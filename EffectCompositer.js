import * as THREE from 'https://unpkg.com/three@0.162.0/build/three.module.min.js';

const EffectCompositer = {
    uniforms: {
        sceneDiffuse: { value: null },
        sceneDepth: { value: null },
        sceneAlbedo: { value: null },
        sceneAO: { value: null },
        voxelTexture: { value: null },
        tDiffuse: { value: null },
        tSpecular: { value: null },
        giStrengthMultiplier: { value: 1.0 },
        giOnly: { value: false },
        aoEnabled: { value: true },
        background: { value: null },
        viewMatrixInv: { value: new THREE.Matrix4() },
        projectionMatrixInv: { value: new THREE.Matrix4() },
        cameraPos: { value: new THREE.Vector3() }
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
    uniform sampler2D tSpecular;
    uniform sampler2D voxelTexture;
    uniform samplerCube background;
    uniform mat4 viewMatrixInv;
    uniform mat4 projectionMatrixInv;
    uniform vec3 cameraPos;
    uniform float giStrengthMultiplier;
    uniform bool aoEnabled;
    uniform bool giOnly;
    varying vec2 vUv;
    vec3 getWorldPos(float depth, vec2 coord) {
        float z = depth * 2.0 - 1.0;
        vec4 clipSpacePosition = vec4(coord * 2.0 - 1.0, z, 1.0);
        vec4 viewSpacePosition = projectionMatrixInv * clipSpacePosition;
        // Perspective division
        viewSpacePosition /= viewSpacePosition.w;
        vec4 worldSpacePosition = viewMatrixInv * viewSpacePosition;
        return worldSpacePosition.xyz;
    }
    void main() {
        vec4 diffuse = texture2D(sceneDiffuse, vUv);
        float depth = texture2D(sceneDepth, vUv).r;
        vec4 ao =texture2D(sceneAO, vUv);
        if (depth == 1.0) {
            gl_FragColor = textureCube(background, normalize(getWorldPos(depth, vUv) - cameraPos));
            return;
        }
        if (!aoEnabled) {
            ao = vec4(1.0);
        }
        vec4 albedo = texture2D(sceneAlbedo, vUv);
        vec4 denoised = texture2D(tDiffuse, vUv);
        vec4 specular = texture2D(tSpecular, vUv);
        float giStrength = giStrengthMultiplier;
        gl_FragColor = vec4((diffuse.rgb + denoised.rgb * albedo.rgb * giStrength + specular.rgb * albedo.rgb) * ao.rgb, 1.0);
        if (giOnly) {
            gl_FragColor = vec4(giStrength * denoised.rgb * ao.rgb, 1.0);
        }
        
    }
    `
};
export { EffectCompositer };