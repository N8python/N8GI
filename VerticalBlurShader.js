import * as THREE from 'https://unpkg.com/three@0.162.0/build/three.module.min.js';

const VerticalBlurShader = {

    uniforms: {

        'tDiffuse': { value: null },
        'sceneDepth': { value: null },
        'blurSharp': { value: 0 },
        'depthBias': { value: 1.0 },
        'sceneMaterial': { value: null },
        'near': { value: 0 },
        'far': { value: 0 },
        'v': { value: 1.0 / 512.0 },
        'resolution': { value: new THREE.Vector2() },
        'blurThreshold': { value: 0.25 },
        'normalTexture': { value: null },
        'projectionMatrixInv': { value: new THREE.Matrix4() },
        'viewMatrixInv': { value: new THREE.Matrix4() },
        "tSpecular": { value: null }


    },

    vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,

    fragmentShader: /* glsl */ `
	layout(location = 1) out vec4 specular;
		uniform sampler2D tDiffuse;
		uniform sampler2D tSpecular;
		uniform sampler2D sceneDepth;
		uniform sampler2D sceneMaterial;
		uniform sampler2D normalTexture;
		uniform float blurSharp;
		uniform float v;
		uniform float near;
		uniform float far;
		uniform vec2 resolution;
		uniform float blurThreshold;
		uniform float depthBias;
		uniform mat4 projectionMatrixInv;
		uniform mat4 viewMatrixInv;
		varying vec2 vUv;
		float linearize_depth(float d,float zNear,float zFar)
        {
            return zNear * zFar / (zFar + d * (zNear - zFar));
        }

float sdPlane( vec3 p, vec3 n, float h )
{
  // n must be normalized
  return dot(p,n) + h;
}
vec3 getWorldPos(float depth, vec2 coord) {
	float z = depth * 2.0 - 1.0;
	vec4 clipSpacePosition = vec4(coord * 2.0 - 1.0, z, 1.0);
	vec4 viewSpacePosition = projectionMatrixInv * clipSpacePosition;
	// Perspective division
	viewSpacePosition /= viewSpacePosition.w;
	vec4 worldSpacePosition = viewMatrixInv * viewSpacePosition;
	return worldSpacePosition.xyz;
}
		float depthFalloff(vec2 uv, vec3 norm, float c) {
			vec3 uvPos = getWorldPos(texture2D(sceneDepth, uv).x, uv);
			return exp(-1.0 * depthBias * abs(sdPlane(uvPos, norm, c)));
		}
		float colorFalloff(vec2 uv, vec3 color) {
			vec3 color2 = texture2D(tDiffuse, uv).rgb;
			return exp(-0.5 * length(color - color2));
		}
		vec3 computeNormal(vec3 worldPos) {
			vec2 downUv = vUv + vec2(0.0, 1.0 / resolution.y);
			vec3 downPos = getWorldPos(texture2D(sceneDepth, downUv).x, downUv).xyz;
			vec2 rightUv = vUv + vec2(1.0 / resolution.x, 0.0);;
			vec3 rightPos = getWorldPos(texture2D(sceneDepth, rightUv).x, rightUv).xyz;
			vec2 upUv = vUv - vec2(0.0, 1.0 / resolution.y);
			vec3 upPos = getWorldPos(texture2D(sceneDepth, upUv).x, upUv).xyz;
			vec2 leftUv = vUv - vec2(1.0 / resolution.x, 0.0);
			vec3 leftPos = getWorldPos(texture2D(sceneDepth, leftUv).x, leftUv).xyz;
			int hChoice;
			int vChoice;
			if (length(leftPos - worldPos) < length(rightPos - worldPos)) {
			  hChoice = 0;
			} else {
			  hChoice = 1;
			}
			if (length(upPos - worldPos) < length(downPos - worldPos)) {
			  vChoice = 0;
			} else {
			  vChoice = 1;
			}
			vec3 hVec;
			vec3 vVec;
			if (hChoice == 0 && vChoice == 0) {
			  hVec = leftPos - worldPos;
			  vVec = upPos - worldPos;
			} else if (hChoice == 0 && vChoice == 1) {
			  hVec = leftPos - worldPos;
			  vVec = worldPos - downPos;
			} else if (hChoice == 1 && vChoice == 1) {
			  hVec = rightPos - worldPos;
			  vVec = downPos - worldPos;
			} else if (hChoice == 1 && vChoice == 0) {
			  hVec = rightPos - worldPos;
			  vVec = worldPos - upPos;
			}
			return normalize(cross(hVec, vVec));
		  }
		void main() {
			float[9] weights =  float[9](0.051, 0.0918, 0.12245, 0.1531, 0.1633, 0.1531, 0.12245, 0.0918, 0.051);
			float d = texture2D(sceneDepth, vUv).x;
			if (d == 1.0) {
				gl_FragColor = texture2D(tDiffuse, vUv);
				return;
			}
			float uvDepth = linearize_depth(d, 0.1, 1000.0);
			vec3 uvWorldPos = getWorldPos(d, vUv);
			vec3 normal =  normalize((viewMatrixInv * normalize(vec4(texture2D(normalTexture, vUv).rgb, 0.0))).xyz);
			vec4 matData = texture2D(sceneMaterial, vUv);
			float metalness = matData.r;
			float roughness = matData.g;
			float radius = v / resolution.y; //max(h * (1.0 - d) * (-blurSharp * pow(b - 0.5, 2.0) + 1.0), blurThreshold / resolution.x);
			vec3 planeNormal = normal;
			float planeConstant = -dot(uvWorldPos, normal);
			vec3 diffuseSum = vec3( 0.0 );
			float weightSum = 0.0;
			for(float i = -4.0; i <= 4.0; i++) {
				vec2 sampleUv = vec2( vUv.x, vUv.y + i * radius );
				vec2 clipRangeCheck = step(vec2(0.0),sampleUv.xy) * step(sampleUv.xy, vec2(1.0));
				float w = weights[int(i + 4.0)] * depthFalloff(sampleUv, planeNormal, planeConstant) * clipRangeCheck.x * clipRangeCheck.y;
				diffuseSum += texture2D( tDiffuse, sampleUv).rgb * w ;
				weightSum += w;
			}
			diffuseSum /= weightSum;
			radius *= clamp(sqrt(roughness), 0.1 * (1.0-metalness), 1.0);
			vec3 specularSum = vec3( 0.0 );
			weightSum = 0.0;
			for(float i = -4.0; i <= 4.0; i++) {
				vec2 sampleUv = vec2( vUv.x, vUv.y  + i * radius );
				vec2 clipRangeCheck = step(vec2(0.0),sampleUv.xy) * step(sampleUv.xy, vec2(1.0));
				float w = weights[int(i + 4.0)] * depthFalloff(sampleUv, planeNormal, planeConstant) * clipRangeCheck.x * clipRangeCheck.y;
				specularSum += texture2D( tSpecular, sampleUv).rgb * w ;
				weightSum += w;
			}
			specularSum /= weightSum;


			gl_FragColor = vec4(diffuseSum, 1.0);
			specular = vec4(specularSum, 1.0);
		}`

};

export { VerticalBlurShader };