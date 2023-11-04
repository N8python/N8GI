import * as THREE from 'https://unpkg.com/three@0.155.0/build/three.module.min.js';
const EffectShader = {

    uniforms: {

        'sceneDiffuse': { value: null },
        'sceneDepth': { value: null },
        'sceneNormal': { value: null },
        'sceneAlbedo': { value: null },
        'bluenoise': { value: null },
        'skybox': { value: null },
        'projMat': { value: new THREE.Matrix4() },
        'viewMat': { value: new THREE.Matrix4() },
        'projectionMatrixInv': { value: new THREE.Matrix4() },
        'viewMatrixInv': { value: new THREE.Matrix4() },
        'cameraPos': { value: new THREE.Vector3() },
        'resolution': { value: new THREE.Vector2() },
        'time': { value: 0.0 },
        'voxelTexture': { value: null },
        'voxelColor': { value: null },
        'voxelColorTextureSize': { value: 0 },
        'boxSize': { value: new THREE.Vector3(1, 1, 1) },
        'boxCenter': { value: new THREE.Vector3(0, 0, 0) },
        'voxelAmount': { value: new THREE.Vector3(1, 1, 1) },
        'debugVoxels': { value: false },
        'roughness': { value: 1.0 }
    },

    vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,

    fragmentShader: /* glsl */ `
    #include <packing>
		uniform highp sampler2D sceneDiffuse;
    uniform highp sampler2D sceneDepth;
    uniform highp sampler2D sceneAlbedo;
    uniform highp sampler2D sceneNormal;
    uniform highp sampler2D bluenoise;
    uniform highp isampler3D voxelTexture;
    uniform highp samplerCube skybox;
    uniform highp sampler2D voxelColor;
    uniform int voxelColorTextureSize;
    uniform mat4 projMat;
    uniform mat4 viewMat;
    uniform highp mat4 projectionMatrixInv;
    uniform highp mat4 viewMatrixInv;
    uniform vec3 voxelAmount;
    uniform vec3 cameraPos;
    uniform vec2 resolution;
    uniform float time;
    uniform float roughness;
    uniform bool debugVoxels;
    uniform vec3 boxSize;
    uniform vec3 boxCenter;
    varying vec2 vUv;
    struct Ray {
      highp vec3 origin;
      highp vec3 direction;
    };
    struct RayHit {
      highp vec3 normal;
      highp ivec3 voxelPos;
      bool hit;
    };
      Ray createRay(vec3 origin, vec3 direction) {
        Ray ray;
        ray.origin = origin;
        ray.direction = direction;
        return ray;
    }
      Ray createCameraRay(vec2 uv) {
        vec3 origin = (viewMatrixInv * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 direction = (projectionMatrixInv * vec4(uv, 0.0, 1.0)).xyz;
        direction = (viewMatrixInv * vec4(direction, 0.0)).xyz;
        direction = normalize(direction);
        return createRay(origin, direction);
    }
    vec2 rayBoxDist(vec3 boundsMin, vec3 boundsMax, vec3 rayOrigin, vec3 rayDir) {
      vec3 t0 = (boundsMin - rayOrigin) / rayDir;
      vec3 t1 = (boundsMax - rayOrigin) / rayDir;
      vec3 tmin = min(t0, t1);
      vec3 tmax = max(t0, t1);
  
      float distA = max(max(tmin.x, tmin.y), tmin.z);
      float distB = min(tmax.x, min(tmax.y, tmax.z));
  
      float distToBox = max(0.0, distA);
      float distInsideBox = max(0.0, distB - distToBox);
      return vec2(distToBox, distInsideBox);
  }
  RayHit voxelCast(vec3 startPos, Ray ray, float dist) {
    vec3 deltaDist = abs(vec3(length(ray.direction)) / ray.direction);
    ivec3 rayStep = ivec3(sign(ray.direction));
    ivec3 voxelPos = ivec3(floor(startPos));
    vec3 sideDist = (sign(ray.direction) * (vec3(voxelPos) - startPos) + (sign(ray.direction) * 0.5) + 0.5) * deltaDist;
    bvec3 mask;
    vec3 cushion = 1.0 / voxelAmount;
    vec3 invVoxelAmount = 1.0 / voxelAmount;
    bool hit = false;
    ivec3 minBound = ivec3(0);
    ivec3 maxBound = ivec3(voxelAmount) - 1;
    int maxSteps = int(ceil(dist * 2.0));
    for(int i = 0; i < maxSteps; i++) {
      int voxel = texelFetch(voxelTexture, 
        (voxelPos), 0
        ).r;
      if(voxel >= 0) {
        hit = true;
        break;
      } else if (any(lessThan(voxelPos, minBound)) || any(greaterThan(voxelPos, maxBound))) {
        hit = false;
        break;
      }
      mask = lessThanEqual(sideDist.xyz, min(sideDist.yzx, sideDist.zxy));
      sideDist += vec3(mask) * deltaDist;
      voxelPos += ivec3(mask) * rayStep;
    }
    if (hit) {

       vec3 normal = vec3(0.0);
        if (mask.x) {
          normal = vec3(-sign(rayStep.x), 0.0, 0.0);
        } else if (mask.y) {
          normal = vec3(0.0, -sign(rayStep.y), 0.0);
        } else {
          normal = vec3(0.0, 0.0, -sign(rayStep.z));
        }
      
        return RayHit(normal, (voxelPos), true);
      } else {
      return RayHit(vec3(-1.0), ivec3(-1), false);
      }
  }
  vec3 toVoxelSpace(vec3 pos) {
    pos -= boxCenter;
    pos += boxSize / 2.0;
    pos *= voxelAmount / boxSize;
    return pos;
  }
  vec3 toWorldSpace(vec3 pos) {
    pos *= boxSize / voxelAmount;
    pos -= boxSize / 2.0;
    pos += boxCenter;
    return pos;
  }
  vec3 getVoxelColor(ivec3 voxelPos) {
    ivec3 VOXEL_AMOUNT = ivec3(voxelAmount);
    int index = voxelPos.x + voxelPos.y * VOXEL_AMOUNT.x + voxelPos.z * VOXEL_AMOUNT.x * VOXEL_AMOUNT.y;
    int sampleY = index / voxelColorTextureSize;
    int sampleX = index - sampleY * voxelColorTextureSize;
    vec4 color = texelFetch(voxelColor, ivec2(sampleX, sampleY), 0);
    return color.rgb;
  }
  vec3 voxelIntersectPos(vec3 voxel, Ray ray) {
    vec3 hitPos = toWorldSpace(voxel);
    vec2 voxelIntersectData = rayBoxDist(floor(hitPos), hitPos + vec3(1.0, 1.0, 1.0), ray.origin, ray.direction);
    vec3 intersectPos = ray.origin + ray.direction * voxelIntersectData.x;
    return intersectPos;
  }
  RayHit raycast(Ray ray) {
    vec2 voxelBoxDist = rayBoxDist(boxCenter - boxSize / 2.0, boxCenter + boxSize / 2.0, ray.origin, ray.direction);
    float distToBox = voxelBoxDist.x;
    float distInsideBox = voxelBoxDist.y;
    vec3 startPos = toVoxelSpace(ray.origin + distToBox * ray.direction);
    vec3 endPos = toVoxelSpace(ray.origin + (distToBox + distInsideBox) * ray.direction);
    vec3 voxelRatioResults = voxelAmount / boxSize;
    float voxelRatioMax = max(max(voxelRatioResults.x, voxelRatioResults.y), voxelRatioResults.z);
    ray.direction *= voxelRatioResults;
    RayHit result = voxelCast(startPos, ray, distInsideBox * voxelRatioMax);
   // result.pos = voxelIntersectPos(result.pos, ray);
    return result;
  }



  vec3 getWorldPos(float depth, vec2 coord) {
    float z = depth * 2.0 - 1.0;
    vec4 clipSpacePosition = vec4(coord * 2.0 - 1.0, z, 1.0);
    vec4 viewSpacePosition = projectionMatrixInv * clipSpacePosition;
    // Perspective division
   vec4 worldSpacePosition = viewSpacePosition;
   worldSpacePosition.xyz /= worldSpacePosition.w;
    return worldSpacePosition.xyz;
}
vec3 computeNormal(vec3 worldPos, vec2 vUv) {
  ivec2 p = ivec2(vUv * resolution);
  float c0 = texelFetch(sceneDepth, p, 0).x;
  float l2 = texelFetch(sceneDepth, p - ivec2(2, 0), 0).x;
  float l1 = texelFetch(sceneDepth, p - ivec2(1, 0), 0).x;
  float r1 = texelFetch(sceneDepth, p + ivec2(1, 0), 0).x;
  float r2 = texelFetch(sceneDepth, p + ivec2(2, 0), 0).x;
  float b2 = texelFetch(sceneDepth, p - ivec2(0, 2), 0).x;
  float b1 = texelFetch(sceneDepth, p - ivec2(0, 1), 0).x;
  float t1 = texelFetch(sceneDepth, p + ivec2(0, 1), 0).x;
  float t2 = texelFetch(sceneDepth, p + ivec2(0, 2), 0).x;

  float dl = abs((2.0 * l1 - l2) - c0);
  float dr = abs((2.0 * r1 - r2) - c0);
  float db = abs((2.0 * b1 - b2) - c0);
  float dt = abs((2.0 * t1 - t2) - c0);

  vec3 ce = getWorldPos(c0, vUv).xyz;

  vec3 dpdx = (dl < dr) ? ce - getWorldPos(l1, (vUv - vec2(1.0 / resolution.x, 0.0))).xyz
                        : -ce + getWorldPos(r1, (vUv + vec2(1.0 / resolution.x, 0.0))).xyz;
  vec3 dpdy = (db < dt) ? ce - getWorldPos(b1, (vUv - vec2(0.0, 1.0 / resolution.y))).xyz
                        : -ce + getWorldPos(t1, (vUv + vec2(0.0, 1.0 / resolution.y))).xyz;

  return normalize(cross(dpdx, dpdy));
}

vec3 unpackThreeBytes(float packedFloat) {
  // Convert the float back to an integer
  int packedInt = int(packedFloat * 16777215.0); // 16777215.0 = 2^24 - 1
  
  // Extract the three bytes
  int byteR = (packedInt >> 16) & 0xFF;
  int byteG = (packedInt >> 8) & 0xFF;
  int byteB = packedInt & 0xFF;
  
  // Convert the bytes to a vec3
  vec3 bytes = vec3(float(byteR), float(byteG), float(byteB));
  
  return bytes / 255.0;
}
		void main() {
      if (texture2D(sceneDepth, vUv).r == 1.0) {
        gl_FragColor = texture(sceneDiffuse, vUv);
        return;
      }
      float depth = texture(sceneDepth, vUv).r;
      vec3 worldPos = (viewMatrixInv * vec4(getWorldPos(depth, vUv), 1.0)).xyz;
      vec3 normal = normalize((viewMatrixInv * vec4(
        texture2D(sceneNormal, vUv).rgb * 2.0 - 1.0,
         0.0)).xyz);



      vec3 viewDir = normalize(worldPos - cameraPos);
      vec3 reflectedDir = reflect(viewDir, normal);
      vec2 diskInfo;
      diskInfo = texture2D(
        bluenoise,
        gl_FragCoord.xy / vec2(1024)
      ).rg;
      diskInfo.r = sqrt(diskInfo.r);

      vec2 diskPos = vec2(
        diskInfo.r * cos(diskInfo.g * 2.0 * 3.14159),
        diskInfo.r * sin(diskInfo.g * 2.0 * 3.14159)
      );
      vec3 hemisphereDir = normalize(vec3(diskPos, sqrt(1.0 - dot(diskPos, diskPos))));

      vec3 helper = vec3(1.0, 0.0, 0.0);
      if (abs(dot(helper, normal)) > 0.99) {
        helper = vec3(0.0, 1.0, 0.0);
      }
      vec3 tangent = normalize(cross(normal, helper));
      vec3 bitangent = cross(normal, tangent);
      mat3 TBN = mat3(tangent, bitangent, normal);
       reflectedDir = normalize(mix(reflectedDir, normalize(TBN * hemisphereDir), roughness));
    vec3 voxelRatioResults = voxelAmount / boxSize;
    float voxelRatioMax = 1.0 / max(max(voxelRatioResults.x, voxelRatioResults.y), voxelRatioResults.z);

      Ray ray;
      ray.origin = debugVoxels ? cameraPos : worldPos + normal * voxelRatioMax + reflectedDir * voxelRatioMax;
      ray.direction = debugVoxels ? viewDir : reflectedDir;
      RayHit hit = raycast(ray);
      vec3 reflectedColor = vec3(0.0);
      if (hit.hit) {
        vec3 voxData = getVoxelColor(hit.voxelPos);
        vec3 voxNormal = 2.0 * unpackThreeBytes(voxData.b) - 1.0;
        vec3 color = unpackThreeBytes(voxData.r).rgb;
        vec3 backColor = unpackThreeBytes(voxData.g).rgb;
        reflectedColor = dot(voxNormal, -ray.direction) > 0.0 ? color : backColor;
      //  reflectedColor = color;

      } else {
        reflectedColor = texture(skybox, viewDir).rgb / 3.14159;
      }

    vec3 s = texture2D(
      sceneDiffuse,
      vUv
    ).rgb;
    float giStrength = 16.0;

     gl_FragColor = vec4(reflectedColor, 1.0);
      


		}`

};

export { EffectShader };