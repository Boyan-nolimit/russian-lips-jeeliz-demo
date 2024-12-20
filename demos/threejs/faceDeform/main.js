// some globalz:
let THREECAMERA = null;


// callback: launched if a face is detected or lost
function detect_callback(isDetected){
  if (isDetected){
    console.log('INFO in detect_callback(): DETECTED');
  } else {
    console.log('INFO in detect_callback(): LOST');
  }
}


function build_maskMaterial(videoTransformMat2){
  /*
    THIS IS WHERE THE DEFORMATIONS ARE BUILT:
    1) create a tearpoint where the deformation will be located
    2) add a displacement(x, y) to deform the zone around your tearpoint
    3) select a radius: the bigger the radius the bigger the size of the deformed zone
    around your tearpoint will be
  */
  const vertexShaderSource = `uniform mat2 videoTransformMat2;
  varying vec2 vUVvideo;
    
  // Parameters for scaling (tuned for realistic lips-only effect):
  const vec2 TEARPOINT0 = vec2(0., -0.5); // Center of lips
  const float RADIUS0 = 0.18; // Smaller radius for lips center
  
  const vec2 TEARPOINT1 = vec2(0.2, -0.45); // Right corner of lips
  const float RADIUS1 = 0.18; // Tight radius for right corner
  
  const vec2 TEARPOINT2 = vec2(-0.2, -0.45); // Left corner of lips
  const float RADIUS2 = 0.18; // Tight radius for left corner

  void main() {
    vec3 positionDeformed = position;
  
    // Lips center scaling
    float distance0 = distance(TEARPOINT0, position.xy);
    if (distance0 < RADIUS0) {
      float deformFactor0 = 1.0 - smoothstep(0.0, RADIUS0, distance0);
      positionDeformed.xy += deformFactor0 * (position.xy - TEARPOINT0) * 0.60 * (1.0 - distance0 / RADIUS0); // Stronger near center
    }
  
    // Right corner scaling
    float distance1 = distance(TEARPOINT1, position.xy);
    if (distance1 < RADIUS1) {
      float deformFactor1 = 1.0 - smoothstep(0.0, RADIUS1, distance1);
      positionDeformed.xy += deformFactor1 * (position.xy - TEARPOINT1) * 0.6 * (1.0 - distance1 / RADIUS1); // Smooth scaling
    }
  
    // Left corner scaling
    float distance2 = distance(TEARPOINT2, position.xy);
    if (distance2 < RADIUS2) {
      float deformFactor2 = 1.0 - smoothstep(0.0, RADIUS2, distance2);
      positionDeformed.xy += deformFactor2 * (position.xy - TEARPOINT2) * 0.6 * (1.0 - distance2 / RADIUS2); // Smooth scaling
    }
  
    // project deformed point:
    vec4 mvPosition = modelViewMatrix * vec4(positionDeformed, 1.0);
    vec4 projectedPosition = projectionMatrix * mvPosition;
    gl_Position = projectedPosition;
  
    // compute UV coordinates on the video texture:
    vec4 mvPosition0 = modelViewMatrix * vec4(position, 1.0);
    vec4 projectedPosition0 = projectionMatrix * mvPosition0;
    vUVvideo = vec2(0.5) + videoTransformMat2 * projectedPosition0.xy / projectedPosition0.w;
  }`;

  const fragmentShaderSource = "precision mediump float;\n\
  uniform sampler2D samplerVideo;\n\
  varying vec2 vUVvideo;\n\
  void main() {\n\
    gl_FragColor = texture2D(samplerVideo, vUVvideo);\n\
  }";

  const mat = new THREE.ShaderMaterial({
    vertexShader: vertexShaderSource,
    fragmentShader: fragmentShaderSource,
    uniforms: {
      samplerVideo:{value: JeelizThreeHelper.get_threeVideoTexture()},
      videoTransformMat2: {value: videoTransformMat2}
    }
  });
  return mat;
}


// build the 3D. called once when Jeeliz Face Filter is OK:
function init_threeScene(spec){
  const threeStuffs = JeelizThreeHelper.init(spec, detect_callback);

  // CREATE THE MASK:
  const maskLoader=new  THREE.BufferGeometryLoader();
  /*
  faceLowPoly.json has been exported from dev/faceLowPoly.blend using THREE.JS blender exporter with Blender v2.76
  */
  maskLoader.load('./models/faceLowPoly.json', function(maskBufferGeometry){
    maskBufferGeometry.computeVertexNormals();
    const threeMask = new THREE.Mesh(maskBufferGeometry, build_maskMaterial(spec.videoTransformMat2));
    threeMask.frustumCulled=false;
    threeMask.scale.multiplyScalar(1.2);
    threeMask.position.set(0,0.2,-0.5);
    threeStuffs.faceObject.add(threeMask);
  });

  // CREATE THE CAMERA:
  THREECAMERA = JeelizThreeHelper.create_camera();
} //end init_threeScene()


// Entry point:
function main(){
  JeelizResizer.size_canvas({
    canvasId: 'jeeFaceFilterCanvas',
    callback: function(isError, bestVideoSettings){
      init_faceFilter(bestVideoSettings);
    }
  })
}


function init_faceFilter(videoSettings){
  JEELIZFACEFILTER.init({
    canvasId: 'jeeFaceFilterCanvas',
    NNCPath: '../../../neuralNets/', // root of NN_DEFAULT.json file
    videoSettings: videoSettings,
    callbackReady: function(errCode, spec){
      if (errCode){
        console.log('AN ERROR HAPPENS. SORRY BRO :( . ERR =', errCode);
        return;
      }

      console.log('INFO: JEELIZFACEFILTER IS READY');
      init_threeScene(spec);
    },

    // called at each render iteration (drawing loop):
    callbackTrack: function(detectState){
       JeelizThreeHelper.render(detectState, THREECAMERA);
    }
  }); //end JEELIZFACEFILTER.init call
}


window.addEventListener('load', main);