const VoxelColorShader = {
    vertexShader: `
        varying vec3 vNormal;
        void main() {
            vNormal = normal;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `,
    vertexShader: /*glsl*/ `
        in vec2 uv;
        in vec3 position;
        out vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
        `,
    fragmentShader: /*glsl*/ `
    #define varying in
    #define texture2D texture
    precision highp float;
    uniform mat4 viewMatrix;
        #include <common>
        #include <packing>
        #include <envmap_common_pars_fragment>
        #include <envmap_physical_pars_fragment>
        #include <fog_pars_fragment>
        #include <lights_pars_begin>
        #include <lights_physical_pars_fragment>
        #include <shadowmap_pars_fragment>
        #if defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 )
            uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
        #endif
        #if ( NUM_SPOT_LIGHT_SHADOWS > 0 )
            uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_SHADOWS ];
        #endif
        uniform float time;
        uniform sampler2D sceneTex;
        uniform sampler2D sceneDepth;
        uniform mat4 projMat;
        uniform mat4 viewMat;
        uniform mat4 projectionMatrixInv;
        uniform mat4 viewMatrixInv;
        vec3 getWorldPos(float depth, vec2 coord) {
            float z = depth * 2.0 - 1.0;
            vec4 clipSpacePosition = vec4(coord * 2.0 - 1.0, z, 1.0);
            vec4 viewSpacePosition = projectionMatrixInv * clipSpacePosition;
            // Perspective division
           vec4 worldSpacePosition = viewSpacePosition;
           worldSpacePosition.xyz /= worldSpacePosition.w;
           worldSpacePosition = (viewMatrixInv * vec4(worldSpacePosition.xyz, 1.0));
            return worldSpacePosition.xyz;
        }
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
        layout(location = 0) out uvec4 pcColor1;
        layout(location = 1) out uvec4 pcColor2;
        
        in vec2 vUv;
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
      uint quantizeToBits(float num, float m, float bitsPowTwo) {
        num = clamp(num, 0.0, m);
        return uint(bitsPowTwo * sqrt(num / m));
      }
      uint packThreeBytes(vec3 light) {
        float maxNum = 10.0;
        float bitsPowTwo = 1023.0;
        uint r = quantizeToBits(light.r, maxNum, bitsPowTwo);
        uint g = quantizeToBits(light.g, maxNum, bitsPowTwo);
        uint b = quantizeToBits(light.b, maxNum, bitsPowTwo);

        return r << 20 | g << 10 | b;
    }
    float unquantizeToBits(uint num, float m, float bitsPowTwo) {
        float t = float(num) / bitsPowTwo;
        return (t * t * m);
      }
      vec3 unpackRGB(uint packedInt) {
        float maxNum = 10.0;
        float bitsPowTwo = 1023.0;
        float r = unquantizeToBits(packedInt >> 20u, maxNum, bitsPowTwo);
        float g = unquantizeToBits((packedInt >> 10u) & 1023u, maxNum, bitsPowTwo);
        float b = unquantizeToBits(packedInt & 1023u, maxNum, bitsPowTwo);
        return vec3(r, g, b);
        
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
    

        void main() {
            int index = int(gl_FragCoord.y) * textureSize + int(gl_FragCoord.x);
            int voxelZ = index / (VOXEL_AMOUNT.x * VOXEL_AMOUNT.y);
            int voxelY = (index - voxelZ * VOXEL_AMOUNT.x * VOXEL_AMOUNT.y) / VOXEL_AMOUNT.x;
            int voxelX = index - voxelZ * VOXEL_AMOUNT.x * VOXEL_AMOUNT.y - voxelY * VOXEL_AMOUNT.x;
            int sampledIndex = texelFetch(voxelTex, ivec3(voxelX, voxelY, voxelZ), 0).r;
           if (sampledIndex < 0) {
                pcColor1 = uvec4(0, 0, 0, 0);
                pcColor2 = uvec4(0, 0, 0, 0);
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
                /*vec3 accumulatedLight = vec3(0.0);
                vec3 accumulatedLightBack = vec3(0.0);*/
                vec3[6] cardinals = vec3[6](
                    vec3(1.0, 0.0, 0.0),
                    vec3(-1.0, 0.0, 0.0),
                    vec3(0.0, 1.0, 0.0),
                    vec3(0.0, -1.0, 0.0),
                    vec3(0.0, 0.0, 1.0),
                    vec3(0.0, 0.0, -1.0)
                );
                vec3[6] accumulatedLight = vec3[6](
                    vec3(0.0),
                    vec3(0.0),
                    vec3(0.0),
                    vec3(0.0),
                    vec3(0.0),
                    vec3(0.0)
                );
              
                #if ( NUM_DIR_LIGHTS > 0 )
                vec3 lightDirection;
                vec4 shadowCoord;
                float s, shadow;
                #pragma unroll_loop_start
                for(int i = 0; i < NUM_DIR_LIGHTS; i++) {

                    lightDirection = directionalLights[ i ].direction;
                    
                   //float incidentLight = max(dot( interpolatedNormal, lightDirection ), 0.0);
                   // float incidentLightBack = max(dot( -interpolatedNormal, lightDirection ), 0.0);
                    s = 1.0;
                    #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
                        shadowCoord = directionalShadowMatrix[i] * vec4(worldPos, 1.0);
                        shadow = getShadow(directionalShadowMap[i], directionalLightShadows[i].shadowMapSize, directionalLightShadows[i].shadowBias, directionalLightShadows[i].shadowRadius, shadowCoord);
                        s *= shadow;
                    #endif
                    if (s > 0.0) {
                        for (int j = 0; j < 6; j++) {
                            accumulatedLight[j] += (directionalLights[ i ].color / 3.14159) * s * sampledTexel.rgb * color * (1.0 - metalness) * max(dot(cardinals[j], lightDirection), 0.0);
                        }
                    }
                }
                #pragma unroll_loop_end
                #endif

                #if (NUM_POINT_LIGHTS > 0)
                PointLight pointLight;
                IncidentLight directLight;
                #if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
                PointLightShadow pointLightShadow;
                #endif
                #pragma unroll_loop_start
                for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {

                    pointLight = pointLights[ i ];

                    getPointLightInfo( pointLight, worldPos, directLight );

                    #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
                    pointLightShadow = pointLightShadows[ i ];
                    directLight.color *= ( directLight.visible ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vec4(
                        worldPos - pointLight.position  , 1.0
                    ), pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
                    #endif

                    for (int j = 0; j < 6; j++) {
                        accumulatedLight[j] += (directLight.color / 3.14159) * sampledTexel.rgb * color * (1.0 - metalness) * max(dot(cardinals[j], directLight.direction), 0.0);
                    }
                }
                #pragma unroll_loop_end            
                #endif


                #if (NUM_SPOT_LIGHTS > 0)
                SpotLight spotLight;
                IncidentLight directLight;
                #if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
                SpotLightShadow spotLightShadow;
                #endif
                #pragma unroll_loop_start
                for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {

                    spotLight = spotLights[ i ];

                    getSpotLightInfo( spotLight, worldPos, directLight );

                    #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
                    spotLightShadow = spotLightShadows[ i ];
                    directLight.color *= ( directLight.visible ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, spotLightMatrix[i] * vec4(worldPos, 1.0) ) : 1.0;
                    #endif            
                    for (int j = 0; j < 6; j++) {
                        accumulatedLight[j] += (directLight.color / 3.14159) * sampledTexel.rgb * color * (1.0 - metalness) * max(dot(cardinals[j], directLight.direction), 0.0);
                    }
                }
                #pragma unroll_loop_end
                #endif

              /*  accumulatedLight += emissive;
                accumulatedLightBack += emissive;*/
                for(int j = 0; j < 6; j++) {
                    accumulatedLight[j] += emissive;
                }


                


                vec3 center =                     (posA + posB + posC) / 3.0;
              /*  pcColor1 =
                uvec4(
                   packThreeBytes(vec3(
                    accumulatedLight
                    //randomColor(100.0*float(meshIndex)) 
                   )),
                   packThreeBytes(vec3(
                    accumulatedLightBack //randomColor(100.0*float(meshIndex))
                   )),
                    packThreeBytes(interpolatedNormal * 0.5 + 0.5)
                    , 
                    1);
                pcColor2 = uvec4(0, 0, 0, 0);*/
                pcColor1 = uvec4(
                    packThreeBytes(accumulatedLight[0]),
                    packThreeBytes(accumulatedLight[1]),
                    packThreeBytes(accumulatedLight[2]),
                    1
                );
                pcColor2 = uvec4(
                    packThreeBytes(accumulatedLight[3]),
                    packThreeBytes(accumulatedLight[4]),
                    packThreeBytes(accumulatedLight[5]),
                    1
                );
                 //vec4(unpackRGBAToDepth(vec4(accumulatedLight, 1.0)), unpackRGBAToDepth(vec4(accumulatedLightBack, 1.0)), unpackRGBAToDepth(vec4(0.5 + 0.5 * interpolatedNormal, 1.0)), 1.0);


            }
        }
        `
}
export { VoxelColorShader };