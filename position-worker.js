import * as THREE from 'https://unpkg.com/three@0.155.0/build/three.module.min.js';
const positionMap = new Map();
const indexMap = new Map();
let children = 0;
self.onmessage = (e) => {
    const { type, data } = e.data;
    if (type === "add") {
        const { id, position, index } = data;
        //console.log("add", id, position, index);
        positionMap.set(id, position);
        indexMap.set(id, index);
        children++;
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

}