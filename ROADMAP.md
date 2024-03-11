### Key:
⚫️ - Conceptually very difficult to implement
🔴 - Hard to Implement
🟠 - Moderately Difficult to Implement
🟡 - Tedious to Implement
🟢 - Easy to Implement
### Short Term ( 1-2 Weeks )
- Orthographic Camera 🟢
- Logarithmic Depth Buffer (Ortho + Perspective) 🟢
- More test scenes (Godot Bistro) 🟢
- Support multiple directional lights 🟡
- Support point lights 🟡
- Support spot lights 🟠
- Support shadow mapping on all light types 🟠
### Medium Term ( 2-4 Weeks )
- Proper GBuffer solution to extract material data and prevent having to do many draw calls of the scene (requires overhauling a significant portion of THREE.JS rendering pipeline) 🔴
     - Seperate out rendering of material properties, normals, metalness, etc. - Encode individual material maps into gbuffer when overriding shader (VERY difficult) - Shader swapping might be necessary 🔴
          - Potentially hijack internal shader of each material to create duplicate that writes to the G-Buffer
- Sample according to BSDFs of materials for GI, rather than simple cosine-weighted hemisphere (allows for voxel reflections!!) 🟠
### Other Goals
- General optimizations to denoising pipeline 🟡
- Attempt the implementation of SVOs or some similar structure to accelerate tracing (initial attempts were not successful - it took longer to generate the acceleration structure than it did to trace the scene) 🔴
- Allow moving around the volume being voxelized - to support GI in open worlds 🔴
- Potentially have multiple cascades of voxels (the poor CPU!) ⚫️ 



