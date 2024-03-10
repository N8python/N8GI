const EffectCompositer = {
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
};
export { EffectCompositer };