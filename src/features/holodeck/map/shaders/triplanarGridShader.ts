import * as THREE from 'three';

export interface TriplanarMaterialOptions {
  baseColor?: string | number;
  gridColor?: string | number;
  edgeColor?: string | number;
  gridScale?: number;
  lineWidth?: number;
  roughness?: number;
  metalness?: number;
}

/**
 * Creates a PBR MeshStandardMaterial augmented with a procedural triplanar grid in onBeforeCompile.
 * Receives full directional sunlight, soft PCF shadows, and ambient bounce without external textures.
 */
export function createTriplanarGridMaterial(
  options: TriplanarMaterialOptions = {},
): THREE.MeshStandardMaterial {
  const baseColor = new THREE.Color(options.baseColor ?? '#0f172a');
  const gridColor = new THREE.Color(options.gridColor ?? '#1e293b');
  const edgeColor = new THREE.Color(options.edgeColor ?? '#06b6d4');
  const gridScale = options.gridScale ?? 1.0;
  const lineWidth = options.lineWidth ?? 0.04;

  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: options.roughness ?? 0.6,
    metalness: options.metalness ?? 0.3,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uBaseColor = { value: baseColor };
    shader.uniforms.uGridColor = { value: gridColor };
    shader.uniforms.uEdgeColor = { value: edgeColor };
    shader.uniforms.uGridScale = { value: gridScale };
    shader.uniforms.uLineWidth = { value: lineWidth };

    // 1. Inject varying world position & normal into vertex shader
    shader.vertexShader = `
      varying vec3 vTriplanarWorldPos;
      varying vec3 vTriplanarWorldNormal;
      ${shader.vertexShader}
    `;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      /* glsl */ `
      #include <worldpos_vertex>
      vTriplanarWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vTriplanarWorldNormal = normalize(mat3(modelMatrix) * normal);
      `,
    );

    // 2. Inject procedural triplanar grid math into fragment shader before lighting chunks
    shader.fragmentShader = `
      uniform vec3 uBaseColor;
      uniform vec3 uGridColor;
      uniform vec3 uEdgeColor;
      uniform float uGridScale;
      uniform float uLineWidth;
      varying vec3 vTriplanarWorldPos;
      varying vec3 vTriplanarWorldNormal;

      float getGridLine(vec2 coord, float scale, float width) {
        vec2 grid = abs(fract(coord * scale - 0.5) - 0.5) / max(fwidth(coord * scale), 0.0001);
        float line = min(grid.x, grid.y);
        return 1.0 - min(line, 1.0);
      }
      ${shader.fragmentShader}
    `;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      /* glsl */ `
      #include <color_fragment>

      vec3 blendWeights = abs(vTriplanarWorldNormal);
      blendWeights = (blendWeights - 0.2) * 7.0;
      blendWeights = max(blendWeights, 0.0);
      blendWeights /= (blendWeights.x + blendWeights.y + blendWeights.z + 0.0001);

      vec2 coordYZ = vTriplanarWorldPos.yz;
      vec2 coordXZ = vTriplanarWorldPos.xz;
      vec2 coordXY = vTriplanarWorldPos.xy;

      float lineX = getGridLine(coordYZ, uGridScale, uLineWidth);
      float lineY = getGridLine(coordXZ, uGridScale, uLineWidth);
      float lineZ = getGridLine(coordXY, uGridScale, uLineWidth);
      float gridFactor = lineX * blendWeights.x + lineY * blendWeights.y + lineZ * blendWeights.z;

      float majorX = getGridLine(coordYZ, uGridScale * 0.2, uLineWidth * 1.6);
      float majorY = getGridLine(coordXZ, uGridScale * 0.2, uLineWidth * 1.6);
      float majorZ = getGridLine(coordXY, uGridScale * 0.2, uLineWidth * 1.6);
      float majorGrid = majorX * blendWeights.x + majorY * blendWeights.y + majorZ * blendWeights.z;

      vec3 proceduralAlbedo = mix(uBaseColor, uGridColor, clamp(gridFactor, 0.0, 1.0));
      proceduralAlbedo = mix(proceduralAlbedo, uEdgeColor, clamp(majorGrid * 0.75, 0.0, 1.0));

      diffuseColor.rgb = proceduralAlbedo;
      `,
    );
  };

  return mat;
}
