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
    precision highp float;
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

		return step( compare, unpackRGBAToDepth( texture( depths, uv ) ) );

	}

	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {

		return unpackRGBATo2Half( texture( shadow, uv ) );

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
        layout(location = 0) out uvec4 pcColor;
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
                pcColor = uvec4(0, 0, 0, 0);
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

                    accumulatedLight += (directionalLights[ i ].color / 3.14159) * incidentLight * sampledTexel.rgb * color * (1.0 - metalness);
                    accumulatedLightBack += (directionalLights[ i ].color / 3.14159) * incidentLightBack * sampledTexel.rgb * color * (1.0 - metalness);
                }
                #pragma unroll_loop_end

                accumulatedLight += emissive;
                accumulatedLightBack += emissive;


                


                vec3 center =                     (posA + posB + posC) / 3.0;
                pcColor =
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
                 //vec4(unpackRGBAToDepth(vec4(accumulatedLight, 1.0)), unpackRGBAToDepth(vec4(accumulatedLightBack, 1.0)), unpackRGBAToDepth(vec4(0.5 + 0.5 * interpolatedNormal, 1.0)), 1.0);


            }
        }
        `
}
export { VoxelColorShader };