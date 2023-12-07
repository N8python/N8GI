import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.min.js';

const HorizontalBlurShader = {

    uniforms: {

        'tDiffuse': { value: null },
        'sceneDepth': { value: null },
        'blurSharp': { value: 0 },
        'depthBias': { value: 1.0 },
        'near': { value: 0 },
        'far': { value: 0 },
        'h': { value: 1.0 / 512.0 },
        'resolution': { value: new THREE.Vector2() },
        'blurThreshold': { value: 0.25 },
        'normalTexture': { value: null },
        'projectionMatrixInv': { value: new THREE.Matrix4() },
        'viewMatrixInv': { value: new THREE.Matrix4() }

    },

    vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,

    fragmentShader: /* glsl */ `
		uniform sampler2D tDiffuse;
		uniform sampler2D sceneDepth;
		uniform sampler2D normalTexture;
		uniform float blurSharp;
		uniform float h;
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
			vec4 sum = vec4( 0.0 );
			float[9] weights =  float[9](0.051, 0.0918, 0.12245, 0.1531, 0.1633, 0.1531, 0.12245, 0.0918, 0.051);
			float weightSum = 0.0;
			float d = texture2D(sceneDepth, vUv).x;
			vec3 myColor = texture2D(tDiffuse, vUv).rgb;
			float b = texture2D(tDiffuse, vUv).x;
			float uvDepth = linearize_depth(d, 0.1, 1000.0);
			vec3 uvWorldPos = getWorldPos(d, vUv);
			vec3 normal =  normalize((viewMatrixInv * normalize(vec4((texture2D(normalTexture, vUv).rgb - 0.5) * 2.0, 0.0))).xyz);
			float radius = h / resolution.x; //max(h * (1.0 - d) * (-blurSharp * pow(b - 0.5, 2.0) + 1.0), blurThreshold / resolution.x);
			vec3 planeNormal = normal;
			float planeConstant = -dot(uvWorldPos, normal);
			for(float i = -4.0; i <= 4.0; i++) {
				vec2 sampleUv = vec2( vUv.x + i * radius, vUv.y );
				float w = weights[int(i + 4.0)] * depthFalloff(sampleUv, planeNormal, planeConstant);// * colorFalloff(sampleUv, myColor);
				sum += texture2D( tDiffuse, sampleUv) * w;
				weightSum += w;
			}
			sum /= weightSum;
		/*	sum += texture2D( tDiffuse, vec2( vUv.x - 3.0 * radius, vUv.y ) ) * 0.0918;
			sum += texture2D( tDiffuse, vec2( vUv.x - 2.0 * radius, vUv.y ) ) * 0.12245;
			sum += texture2D( tDiffuse, vec2( vUv.x - 1.0 * radius, vUv.y ) ) * 0.1531;
			sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y ) ) * 0.1633;
			sum += texture2D( tDiffuse, vec2( vUv.x + 1.0 * radius, vUv.y ) ) * 0.1531;
			sum += texture2D( tDiffuse, vec2( vUv.x + 2.0 * radius, vUv.y ) ) * 0.12245;
			sum += texture2D( tDiffuse, vec2( vUv.x + 3.0 * radius, vUv.y ) ) * 0.0918;
			sum += texture2D( tDiffuse, vec2( vUv.x + 4.0 * radius, vUv.y ) ) * 0.051;*/
			gl_FragColor = sum;
		}`

};
export { HorizontalBlurShader };