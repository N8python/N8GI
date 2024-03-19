import * as THREE from 'https://unpkg.com/three@0.162.0/build/three.module.min.js';
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
        'voxelColor1': { value: null },
        'voxelColor2': { value: null },
        'voxelColorTextureSize': { value: 0 },
        'boxSize': { value: new THREE.Vector3(1, 1, 1) },
        'boxCenter': { value: new THREE.Vector3(0, 0, 0) },
        'voxelAmount': { value: new THREE.Vector3(1, 1, 1) },
        'debugVoxels': { value: false },
        'roughness': { value: 1.0 },
        'samples': { value: 1.0 },
        'sceneMaterial': { value: null }
    },

    vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,

    fragmentShader: /* glsl */ `
    #include <packing>
    layout(location = 1) out vec4 specular;
		uniform highp sampler2D sceneDiffuse;
    uniform highp sampler2D sceneDepth;
    uniform highp sampler2D sceneAlbedo;
    uniform highp sampler2D sceneNormal;
    uniform highp sampler2D sceneMaterial;
    uniform highp sampler2D bluenoise;
    uniform highp isampler3D voxelTexture;
    uniform highp samplerCube skybox;
    uniform highp usampler2D voxelColor1;
    uniform highp usampler2D voxelColor2;
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
    uniform float samples;
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
    ivec3 endPos = ivec3(floor(startPos + ray.direction * dist));
    vec3 sideDist = (sign(ray.direction) * (vec3(voxelPos) - startPos) + (sign(ray.direction) * 0.5) + 0.5) * deltaDist;
    bvec3 mask;
    vec3 cushion = 1.0 / voxelAmount;
    vec3 invVoxelAmount = 1.0 / voxelAmount;
    bool hit = false;
    ivec3 minBound = ivec3(0);
    ivec3 maxBound = ivec3(voxelAmount) - 1;
    int maxSteps = 
      (abs(endPos.x - voxelPos.x) +
      abs(endPos.y - voxelPos.y) +
      abs(endPos.z - voxelPos.z));
    
    for(int i = 0; i < maxSteps; i++) {
      int voxel = texelFetch(voxelTexture, 
        (voxelPos), 0
        ).r;
       if (voxel >= 0) {
        hit = true;
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
  uint quantizeToBits(float num, float m, float bitsPowTwo) {
    num = clamp(num, 0.0, m);
    return uint(bitsPowTwo * sqrt(num / m));
  }
  float unquantizeToBits(uint num, float m, float bitsPowTwo) {
    float t = float(num) / bitsPowTwo;
    return (t * t * m);
  }
  uint packThreeBytes(vec3 light) {
    float maxNum = 10.0;
    float bitsPowTwo = 1023.0;
    uint r = quantizeToBits(light.r, maxNum, bitsPowTwo);
    uint g = quantizeToBits(light.g, maxNum, bitsPowTwo);
    uint b = quantizeToBits(light.b, maxNum, bitsPowTwo);
  
    return r << 20 | g << 10 | b;
  }
  vec3 unpackRGB(uint packedInt) {
    float maxNum = 10.0;
    float bitsPowTwo = 1023.0;
    float r = unquantizeToBits(packedInt >> 20u, maxNum, bitsPowTwo);
    float g = unquantizeToBits((packedInt >> 10u) & 1023u, maxNum, bitsPowTwo);
    float b = unquantizeToBits(packedInt & 1023u, maxNum, bitsPowTwo);
    return vec3(r, g, b);
    
  }
  vec3 getVoxelColor(ivec3 voxelPos, vec3 accessDir) {
    ivec3 VOXEL_AMOUNT = ivec3(voxelAmount);
    int index = voxelPos.x + voxelPos.y * VOXEL_AMOUNT.x + voxelPos.z * VOXEL_AMOUNT.x * VOXEL_AMOUNT.y;
    int sampleY = index / voxelColorTextureSize;
    int sampleX = index - sampleY * voxelColorTextureSize;
    uvec4 color = texelFetch(voxelColor1, ivec2(sampleX, sampleY), 0);
    uvec4 color2 = texelFetch(voxelColor2, ivec2(sampleX, sampleY), 0);
    vec3[6] cardinals = vec3[6](
      vec3(1.0, 0.0, 0.0),
      vec3(-1.0, 0.0, 0.0),
      vec3(0.0, 1.0, 0.0),
      vec3(0.0, -1.0, 0.0),
      vec3(0.0, 0.0, 1.0),
      vec3(0.0, 0.0, -1.0)
  );
    vec3[6] accumulatedLight;
    accumulatedLight[0] = unpackRGB(color.r).rgb;
    accumulatedLight[1] = unpackRGB(color.g).rgb;
    accumulatedLight[2] = unpackRGB(color.b).rgb;
    accumulatedLight[3] = unpackRGB(color2.r).rgb;
    accumulatedLight[4] = unpackRGB(color2.g).rgb;
    accumulatedLight[5] = unpackRGB(color2.b).rgb;

    vec3 accumulatedColor = vec3(0.0);
    float w = 0.0;
    vec3 dotAccessDir = -accessDir;
    for (int i = 0; i < 6; i++) {
       float dotProduct = max(dot(cardinals[i], dotAccessDir), 0.0);
        accumulatedColor += accumulatedLight[i] * dotProduct;
    }
    return accumulatedColor;
  }
  vec3 voxelIntersectPos(vec3 voxel, Ray ray) {
    vec3 hitPos = toWorldSpace(voxel);
    vec2 voxelIntersectData = rayBoxDist(floor(hitPos), hitPos + vec3(1.0, 1.0, 1.0), ray.origin, ray.direction);
    vec3 intersectPos = ray.origin + ray.direction * voxelIntersectData.x;
    return intersectPos;
  }
  RayHit raycast(Ray ray) {
    vec3 startPos = toVoxelSpace(ray.origin);
    vec3 voxelSpaceDir = ray.direction;
    vec3 voxelRatioResults = voxelAmount / boxSize;
    voxelSpaceDir *= voxelRatioResults;
    voxelSpaceDir = normalize(voxelSpaceDir);
    vec2 voxelBoxDist = rayBoxDist(vec3(0.0), voxelAmount, startPos, voxelSpaceDir);
    float distToBox = voxelBoxDist.x + 0.0001;
    float distInsideBox = voxelBoxDist.y;
    startPos += distToBox * voxelSpaceDir;
    RayHit result = voxelCast(startPos, Ray(
      startPos,
      voxelSpaceDir
    ), distInsideBox);
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


vec4 getSampleDir(vec3 diskInfo, vec3 normal, vec3 viewDir, vec3 worldPos, float roughness, float metalness) {
  float f0 = 0.04 + 0.96 * metalness;
  float schlick = f0 + (1.0 - f0) * pow(1.0 - dot(-viewDir, normal), 5.0);
  if (diskInfo.b > schlick || debugVoxels) {

   vec3 reflectedDir;
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
       reflectedDir = (TBN * hemisphereDir);
       return vec4(reflectedDir, 0.0);
    } else {
    float alpha = roughness * roughness;
    float theta = atan(sqrt(
      alpha * alpha * diskInfo.r / (1.0 - diskInfo.r)
    ));
    float phi = diskInfo.g * 2.0 * 3.14159;
    vec3 hemisphereDir = vec3(
      sin(theta) * cos(phi),
      sin(theta) * sin(phi),
      cos(theta)
    );
    vec3 helper = vec3(1.0, 0.0, 0.0);
    if (abs(dot(helper, normal)) > 0.99) {
      helper = vec3(0.0, 1.0, 0.0);
    }
    vec3 tangent = normalize(cross(normal, helper));
    vec3 bitangent = cross(normal, tangent);
    mat3 TBN = mat3(tangent, bitangent, normal);
    vec3 hNormal = normalize(TBN * hemisphereDir);
    vec3 reflectedDir = reflect(viewDir, hNormal);
    return vec4(reflectedDir, 1.0);
  }
    
}
vec4 takeSample(
  vec3 cameraPos,
  vec3 worldPos,
  vec3 normal,
  vec3 viewDir,
  vec3 diskInfo,
  float roughness,
  float metalness
) {
  vec4 sampleData = getSampleDir(diskInfo, normal, viewDir, worldPos, roughness, metalness);
  vec3 reflectedDir = sampleData.rgb;
  vec3 voxelRatioResults = voxelAmount / boxSize;
  float voxelRatioMax = 1.0 / max(max(voxelRatioResults.x, voxelRatioResults.y), voxelRatioResults.z);

    Ray ray;
    ray.origin = debugVoxels ? cameraPos : worldPos + normal * voxelRatioMax + reflectedDir * voxelRatioMax;
    ray.direction = debugVoxels ? viewDir : reflectedDir;
    RayHit hit = raycast(ray);
    vec3 reflectedColor = vec3(0.0);
    if (hit.hit) {
      reflectedColor = getVoxelColor(hit.voxelPos, -hit.normal);
    } else {
      reflectedColor = textureLod(skybox, ray.direction, 9.0 * roughness).rgb / 3.14159;
    }
    return vec4(reflectedColor, sampleData.a);
}
		void main() {
      if (texture2D(sceneDepth, vUv).r == 1.0) {
        gl_FragColor = texture(sceneDiffuse, vUv);
        return;
      }
      float depth = texture(sceneDepth, vUv).r;
      vec3 worldPos = (viewMatrixInv * vec4(getWorldPos(depth, vUv), 1.0)).xyz;
      vec3 normal = (viewMatrixInv * vec4(
        texture2D(sceneNormal, vUv).rgb,
         0.0)).xyz;



      vec3 viewDir = normalize(worldPos - cameraPos);

     vec3 initialSample = texture2D(
        bluenoise,
        gl_FragCoord.xy / vec2(textureSize(bluenoise, 0).xy)
      ).rgb;
      vec3 harmoniousNumbers = vec3(
        1.618033988749895,
        1.324717957244746,
        1.220744084605759
      );
    //  vec3 reflectedColor = vec3(0.0);
    vec3 diffuseColor = vec3(0.0);
    vec3 specularColor = vec3(0.0);
    float diffuseSamples = 0.0;
    float specularSamples = 0.0;
      vec4 matData = texture2D(sceneMaterial, vUv);
      float r = matData.g;
      float m = matData.r;
      for(float i = 0.0; i < samples; i++) {
        vec3 s = fract(initialSample + i * harmoniousNumbers);
        //reflectedColor += takeSample(cameraPos, worldPos, normal, viewDir, s, r, m);  
        vec4 sampleData = takeSample(cameraPos, worldPos, normal, viewDir, s, r, m);  
        vec3 reflCol = sampleData.rgb;
        if (sampleData.a == 0.0) {
          diffuseColor += reflCol;
          diffuseSamples += 1.0;
        }
        if (sampleData.a == 1.0) {
          specularColor += reflCol;
          specularSamples += 1.0;
        }
      }
    //  reflectedColor /= samples;
    if (diffuseSamples > 0.0) {
      diffuseColor /= diffuseSamples;
    }
    if (specularSamples > 0.0) {
      specularColor /= specularSamples;
    }

      gl_FragColor = vec4(diffuseColor, 1.0);
      specular = vec4(specularColor, 1.0);
  }`

};

export { EffectShader };