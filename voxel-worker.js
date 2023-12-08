import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.min.js';
const renderTriangle = (ax, ay, az, bx, by, bz, cx, cy, cz, voxelAmountX, voxelAmountY, voxelAmountZ, indexArray, i) => {
    const voxelAmountXY = voxelAmountX * voxelAmountY;

    const flooredAx = Math.floor(ax);
    const flooredAy = Math.floor(ay);
    const flooredAz = Math.floor(az);
    const flooredBx = Math.floor(bx);
    const flooredBy = Math.floor(by);
    const flooredBz = Math.floor(bz);
    const flooredCx = Math.floor(cx);
    const flooredCy = Math.floor(cy);
    const flooredCz = Math.floor(cz);
    let xmin = Math.max(Math.floor(Math.min(ax, bx, cx)), 0);
    let xmax = Math.min(Math.ceil(Math.max(ax, bx, cx)), voxelAmountX - 1);
    let ymin = Math.max(Math.floor(Math.min(ay, by, cy)), 0);
    let ymax = Math.min(Math.ceil(Math.max(ay, by, cy)), voxelAmountY - 1);
    let zmin = Math.max(Math.floor(Math.min(az, bz, cz)), 0);
    let zmax = Math.min(Math.ceil(Math.max(az, bz, cz)), voxelAmountZ - 1);

    if (flooredAx === flooredBx && flooredAx === flooredCx &&
        flooredAy === flooredBy && flooredAy === flooredCy &&
        flooredAz === flooredBz && flooredAz === flooredCz) {

        const index = (flooredAz * voxelAmountXY + flooredAy * voxelAmountX + flooredAx);
        if (i > indexArray[index]) {
            indexArray[index] = i;
        }
        return;
    }
    let Ax = az;
    let Ay = ay;
    let Adepth = ax;
    let Bx = bz;
    let By = by;
    let Bdepth = bx;
    let Cx = cz;
    let Cy = cy;
    let Cdepth = cx;

    let invDenom = 1.0 / ((By - Cy) * (Ax - Cx) + (Cx - Bx) * (Ay - Cy));
    if (Number.isFinite(invDenom)) {
        const b1y = (By - Cy);
        const b1x = (Cx - Bx);
        const b2y = (Cy - Ay);
        const b2x = (Ax - Cx);
        let minX = zmin; //Math.max(Math.floor(Math.min(Ax, Bx, Cx)), 0);
        let maxX = zmax; //Math.min(Math.ceil(Math.max(Ax, Bx, Cx)), voxelAmountZ - 1);
        let minY = ymin; //Math.max(Math.floor(Math.min(Ay, By, Cy)), 0);
        let maxY = ymax; //Math.min(Math.ceil(Math.max(Ay, By, Cy)), voxelAmountY - 1);
        const b1yinvDenom = b1y * invDenom;
        const b1xinvDenom = b1x * invDenom;
        const b2yinvDenom = b2y * invDenom;
        const b2xinvDenom = b2x * invDenom;
        const b1yinvDenomPlusb2yinvDenom = -(b1yinvDenom + b2yinvDenom);
        const w1A = -Cx * b1yinvDenom - Cy * b1xinvDenom;
        const w2A = -Cx * b2yinvDenom - Cy * b2xinvDenom;
        for (let y = minY; y <= maxY; y++) {
            let weight1 = w1A + b1yinvDenom * minX + b1xinvDenom * y;
            let weight2 = w2A + b2yinvDenom * minX + b2xinvDenom * y;
            let weight3 = 1 - weight1 - weight2;
            for (let x = minX; x <= maxX; x++) {
                weight1 += b1yinvDenom;
                weight2 += b2yinvDenom;
                weight3 += b1yinvDenomPlusb2yinvDenom;
                if (weight1 < 0 || weight2 < 0 || weight3 < 0) {
                    continue;
                }
                const depth = weight1 * Adepth + weight2 * Bdepth + weight3 * Cdepth;
                if (depth >= 0 && depth < voxelAmountX) {
                    const index = x * voxelAmountXY + y * voxelAmountX + Math.floor(depth);
                    if (i > indexArray[index]) {
                        indexArray[index] = i;
                    }
                }

            }
        }
    }
    Ax = ax;
    Ay = az;
    Bx = bx;
    By = bz;
    Cx = cx;
    Cy = cz;
    Adepth = ay;
    Bdepth = by;
    Cdepth = cy;
    invDenom = 1.0 / ((By - Cy) * (Ax - Cx) + (Cx - Bx) * (Ay - Cy));
    if (Number.isFinite(invDenom)) {
        const b1y = (By - Cy);
        const b1x = (Cx - Bx);
        const b2y = (Cy - Ay);
        const b2x = (Ax - Cx);
        let minX = xmin; // Math.max(Math.floor(Math.min(Ax, Bx, Cx)), 0);
        let maxX = xmax; //Math.min(Math.ceil(Math.max(Ax, Bx, Cx)), voxelAmountX - 1);
        let minY = zmin; //Math.max(Math.floor(Math.min(Ay, By, Cy)), 0);
        let maxY = zmax; //Math.min(Math.ceil(Math.max(Ay, By, Cy)), voxelAmountZ - 1);
        const b1yinvDenom = b1y * invDenom;
        const b1xinvDenom = b1x * invDenom;
        const b2yinvDenom = b2y * invDenom;
        const b2xinvDenom = b2x * invDenom;
        const b1yinvDenomPlusb2yinvDenom = -(b1yinvDenom + b2yinvDenom);
        const w1A = -Cx * b1yinvDenom - Cy * b1xinvDenom;
        const w2A = -Cx * b2yinvDenom - Cy * b2xinvDenom;
        for (let y = minY; y <= maxY; y++) {
            let weight1 = w1A + b1yinvDenom * minX + b1xinvDenom * y;
            let weight2 = w2A + b2yinvDenom * minX + b2xinvDenom * y;
            let weight3 = 1 - weight1 - weight2;
            for (let x = minX; x <= maxX; x++) {
                weight1 += b1yinvDenom;
                weight2 += b2yinvDenom;
                weight3 += b1yinvDenomPlusb2yinvDenom;
                if (weight1 < 0 || weight2 < 0 || weight3 < 0) {
                    continue;
                }
                const depth = weight1 * Adepth + weight2 * Bdepth + weight3 * Cdepth;
                if (depth >= 0 && depth < voxelAmountY) {
                    const index = y * voxelAmountXY + Math.floor(depth) * voxelAmountX + x;
                    if (i > indexArray[index]) {
                        indexArray[index] = i;
                    }

                }

            }
        }
    }
    Ax = ax;
    Ay = ay;
    Bx = bx;
    By = by;
    Cx = cx;
    Cy = cy;
    Adepth = az;
    Bdepth = bz;
    Cdepth = cz;
    invDenom = 1.0 / ((By - Cy) * (Ax - Cx) + (Cx - Bx) * (Ay - Cy));
    if (Number.isFinite(invDenom)) {
        const b1y = (By - Cy);
        const b1x = (Cx - Bx);
        const b2y = (Cy - Ay);
        const b2x = (Ax - Cx);
        let minX = xmin; //Math.max(Math.floor(Math.min(Ax, Bx, Cx)), 0);
        let maxX = xmax; //Math.min(Math.ceil(Math.max(Ax, Bx, Cx)), voxelAmountX - 1);
        let minY = ymin; //Math.max(Math.floor(Math.min(Ay, By, Cy)), 0);
        let maxY = ymax; //Math.min(Math.ceil(Math.max(Ay, By, Cy)), voxelAmountY - 1);
        const b1yinvDenom = b1y * invDenom;
        const b1xinvDenom = b1x * invDenom;
        const b2yinvDenom = b2y * invDenom;
        const b2xinvDenom = b2x * invDenom;
        const b1yinvDenomPlusb2yinvDenom = -(b1yinvDenom + b2yinvDenom);
        const w1A = -Cx * b1yinvDenom - Cy * b1xinvDenom;
        const w2A = -Cx * b2yinvDenom - Cy * b2xinvDenom;
        for (let y = minY; y <= maxY; y++) {
            let weight1 = w1A + b1yinvDenom * minX + b1xinvDenom * y;
            let weight2 = w2A + b2yinvDenom * minX + b2xinvDenom * y;
            let weight3 = 1 - weight1 - weight2;
            for (let x = minX; x <= maxX; x++) {
                weight1 += b1yinvDenom;
                weight2 += b2yinvDenom;
                weight3 += b1yinvDenomPlusb2yinvDenom;
                if (weight1 < 0 || weight2 < 0 || weight3 < 0) {
                    continue;
                }
                const depth = weight1 * Adepth + weight2 * Bdepth + weight3 * Cdepth;
                if (depth >= 0 && depth < voxelAmountZ) {
                    const index = Math.floor(depth) * voxelAmountXY + y * voxelAmountX + x;
                    if (i > indexArray[index]) {
                        indexArray[index] = i;
                    }
                }
            }
        }
    }
}
const positionMap = new Map();
const indexMap = new Map();
self.onmessage = async(event) => {
    const { type, data } = event.data;
    if (type === "add") {
        const { id, position, index } = data;
        //console.log("add", id, position, index);
        positionMap.set(id, position);
        indexMap.set(id, index);
    }
    if (type === "transform") {
        const { meshMatrixData, posBufferAux, startIndex, startMesh, endMesh } = data;

        let posBufferCount = startIndex;
        for (let i = startMesh; i < endMesh; i++) {
            const id = i;
            const positions = positionMap.get(id);
            const indices = indexMap.get(id);
            const [
                e0, e1, e2, e3,
                e4, e5, e6, e7,
                e8, e9, e10, e11,
                e12, e13, e14, e15
            ] = meshMatrixData.slice(id * 16, id * 16 + 16);

            const iLen = indices.length;

            for (let j = 0; j < iLen; j++) {
                const i = indices[j];
                const _x = positions[i * 3];
                const _y = positions[i * 3 + 1];
                const _z = positions[i * 3 + 2];
                const x = _x * e0 + _y * e4 + _z * e8 + e12;
                const y = _x * e1 + _y * e5 + _z * e9 + e13;
                const z = _x * e2 + _y * e6 + _z * e10 + e14;

                posBufferAux[posBufferCount++] = x;
                posBufferAux[posBufferCount++] = y;
                posBufferAux[posBufferCount++] = z;
                posBufferAux[posBufferCount++] = 1.0;
            }
        }
        self.postMessage({ type: "transform", data: { posBufferCount: posBufferCount } });
    }
    if (type === "voxelize") {
        const voxelCenter = new THREE.Vector3(data.voxelCenter.x, data.voxelCenter.y, data.voxelCenter.z);
        const voxelSize = new THREE.Vector3(data.voxelSize.x, data.voxelSize.y, data.voxelSize.z);
        const VOXEL_AMOUNT = new THREE.Vector3(data.VOXEL_AMOUNT.x, data.VOXEL_AMOUNT.y, data.VOXEL_AMOUNT.z);
        const halfSize = voxelSize.clone().multiplyScalar(0.5);
        const voxelRatio = VOXEL_AMOUNT.clone().divide(voxelSize);
        const halfSizeMinusVoxelCenter = halfSize.clone().sub(voxelCenter);

        const posArray = data.posArray;
        //const iLen = indices.length;
        const voxelAmountX = VOXEL_AMOUNT.x;
        const voxelAmountY = VOXEL_AMOUNT.y;
        const voxelAmountXY = voxelAmountX * voxelAmountY;
        const voxelAmountZ = VOXEL_AMOUNT.z;
        const halfSizeMinusVoxelCenterX = halfSizeMinusVoxelCenter.x;
        const halfSizeMinusVoxelCenterY = halfSizeMinusVoxelCenter.y;
        const halfSizeMinusVoxelCenterZ = halfSizeMinusVoxelCenter.z;
        const voxelRatioX = voxelRatio.x;
        const voxelRatioY = voxelRatio.y;
        const voxelRatioZ = voxelRatio.z;
        const halfSizeMinusVoxelCenterXTimesVoxelRatioX = halfSizeMinusVoxelCenterX * voxelRatioX;
        const halfSizeMinusVoxelCenterYTimesVoxelRatioY = halfSizeMinusVoxelCenterY * voxelRatioY;
        const halfSizeMinusVoxelCenterZTimesVoxelRatioZ = halfSizeMinusVoxelCenterZ * voxelRatioZ;
        const indexArray = data.indexArray;
        const indexOffset = data.indexOffset;
        const pLength = posArray.length;
        for (let i = 0, j = indexOffset; i < pLength; i += 12) {
            renderTriangle(posArray[i] * voxelRatioX + halfSizeMinusVoxelCenterXTimesVoxelRatioX,
                posArray[i + 1] * voxelRatioY + halfSizeMinusVoxelCenterYTimesVoxelRatioY,
                posArray[i + 2] * voxelRatioZ + halfSizeMinusVoxelCenterZTimesVoxelRatioZ,
                posArray[i + 4] * voxelRatioX + halfSizeMinusVoxelCenterXTimesVoxelRatioX,
                posArray[i + 5] * voxelRatioY + halfSizeMinusVoxelCenterYTimesVoxelRatioY,
                posArray[i + 6] * voxelRatioZ + halfSizeMinusVoxelCenterZTimesVoxelRatioZ,
                posArray[i + 8] * voxelRatioX + halfSizeMinusVoxelCenterXTimesVoxelRatioX,
                posArray[i + 9] * voxelRatioY + halfSizeMinusVoxelCenterYTimesVoxelRatioY,
                posArray[i + 10] * voxelRatioZ + halfSizeMinusVoxelCenterZTimesVoxelRatioZ,
                voxelAmountX,
                voxelAmountY,
                voxelAmountZ,
                indexArray,
                j++
            );
        }
        self.postMessage({});
    }


}