import * as THREE from 'https://unpkg.com/three@0.162.0/build/three.module.min.js';

const packRGBToUint32 = (v) => {
    const r = Math.floor(v.x * 255.0);
    const g = Math.floor(v.y * 255.0);
    const b = Math.floor(v.z * 255.0);
    return (r << 16) | (g << 8) | b;
};
const createBufferTexture = (size) => {
    const buffer = new Float32Array(size * size * 4);
    const tex = new THREE.DataTexture(buffer, size, size, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = THREE.NearestFilter;
    tex.maxFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return [buffer, tex];
};
const createGBufferSplit = (width, height) => {
    const texture = new THREE.WebGLRenderTarget(width, height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType
    });
    texture.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
    return texture;
}
const imageToDataTexture = (map, TARGET_SIZE_X, TARGET_SIZE_Y) => {
    const canvas = document.createElement('canvas');
    canvas.width = TARGET_SIZE_X;
    canvas.height = TARGET_SIZE_Y;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(map.image, 0, 0, TARGET_SIZE_X, TARGET_SIZE_Y);
    return ctx.getImageData(0, 0, TARGET_SIZE_X, TARGET_SIZE_Y);
}

function computeSplits({ posArray, posBufferCount, sum, workerCount, VOXEL_RATIO_MAX }) {
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
    let sahSplits = new Int32Array(workerCount);
    for (let i = 0; i < workerCount; i++) {
        sahSplits[i] = triangleSurfaceAreas.findIndex((value) => value >= sahSplitSize * (i + 1));
    }
    sahSplits[workerCount - 1] = sum / 3;
    return sahSplits;
}
export { packRGBToUint32, createBufferTexture, imageToDataTexture, computeSplits, createGBufferSplit };