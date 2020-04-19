
/**
 * @file A simple WebGL example for viewing meshes read from OBJ files
 * @author Eric Shaffer <shaffer1@illinois.edu>
 */

/** @global The WebGL context */
var gl;

/** @global The HTML5 canvas we draw on */
var canvas;

/** @global A simple GLSL shader program for the skybox */
var skyShader;

/** @global A simple GLSL shader program for the teapot */
var teapotShader;

/** @global The Modelview matrix */
var mvMatrix = mat4.create();

/** @global The model (world) matrix */
var mMatrix = mat4.create();

/** @global The View matrix */
var vMatrix = mat4.create();

/** @global The Projection matrix */
var pMatrix = mat4.create();

/** @global The Normal matrix */
var nMatrix = mat3.create();

/** @global The matrix stack for hierarchical modeling */
var mMatrixStack = [];

/** @global An object holding the geometry for a 3D mesh */
var myMesh;


// View parameters
/** @global Location of the camera in world coordinates */
var eyePt = vec3.fromValues(0.0,0.0,10);
/** @global Direction of the view in world coordinates */
var viewDir = vec3.fromValues(0.0,0.0,-1.0);
/** @global Up vector for view matrix creation, in world coordinates */
var up = vec3.fromValues(0.0,1.0,0.0);
/** @global Location of a point along viewDir in world coordinates */
var viewPt = vec3.fromValues(0.0,0.0,0.0);

//Light parameters
/** @global Light position in VIEW coordinates */
var lightPosition = [1,1,1];
/** @global Ambient light color/intensity for Phong reflection */
var lAmbient = [.1,.1,.1];
/** @global Diffuse light color/intensity for Phong reflection */
var lDiffuse = [1,1,1];
/** @global Specular light color/intensity for Phong reflection */
var lSpecular =[.5,.5,.5];

//Material parameters
/** @global Ambient material color/intensity for Phong reflection */
var kAmbient = [205.0/255.0,163.0/255.0,63.0/255.0];
/** @global Diffuse material color/intensity for Phong reflection */
var kTerrainDiffuse = [205.0/255.0,163.0/255.0,63.0/255.0];
/** @global Specular material color/intensity for Phong reflection */
var kSpecular = [.5,.5,.5];
/** @global Shininess exponent for Phong reflection */
var shininess = 23;
/** @global Edge color fpr wireframeish rendering */
var kEdgeBlack = [0.0,0.0,0.0];
/** @global Edge color for wireframe rendering */
var kEdgeWhite = [1.0,1.0,1.0];

/** @global variable for the skybox */
var mySkyBox;

/** @global keeps track of shader to use */
var shaderSelect=0;

//Model parameters
var eulerY=0; //camera orbit
var teapotY=0; // teapot rotation


//-------------------------------------------------------------------------
/**
 * Asynchronously read a server-side text file
 */
function asyncGetFile(url) {
    console.log("Getting obj file");
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url);
      xhr.onload = () => resolve(xhr.responseText);
      xhr.onerror = () => reject(xhr.statusText);
      xhr.send();
      console.log("Made Promise");
    })

}

//-------------------------------------------------------------------------
/**
 * Sends model and view matrices to shader (seperate uniforms)
 * @param {String} program Name of shader program to upload to
 */
function uploadModelViewMatrixToShader(program) {
  if(program=="skyShader"){
    gl.uniformMatrix4fv(skyShader.mMatrixUniform, false, mMatrix);
    gl.uniformMatrix4fv(skyShader.vMatrixUniform, false, vMatrix);
  }
  else if(program=="teapotShader"){
    gl.uniformMatrix4fv(teapotShader.mMatrixUniform, false, mMatrix);
    gl.uniformMatrix4fv(teapotShader.vMatrixUniform, false, vMatrix);
  }
}

//-------------------------------------------------------------------------
/**
 * Sends projection matrix to shader
 * @param {String} program Name of shader program to upload to
 */
function uploadProjectionMatrixToShader(program) {
  if(program=="skyShader"){
    gl.uniformMatrix4fv(skyShader.pMatrixUniform,false, pMatrix);
  }
  else if (program=="teapotShader"){
    gl.uniformMatrix4fv(teapotShader.pMatrixUniform,false, pMatrix);
  }
}

//-------------------------------------------------------------------------
/**
 * Generates and sends the normal matrix to the shader
 * @param {String} program Name of shader program to upload to
 */
function uploadNormalMatrixToShader(program) {
  mat3.fromMat4(nMatrix,mMatrix);
  mat3.transpose(nMatrix,nMatrix);
  mat3.invert(nMatrix,nMatrix);
  //skybox doesnt need the normal matrix
  if(program!="skyShader"){
    gl.uniformMatrix3fv(teapotShader.nMatrixUniform, false, nMatrix);
  }
}

//----------------------------------------------------------------------------------
/**
 * Pushes matrix onto model matrix stack
 */
function mPushMatrix() {
    var copy = mat4.clone(mMatrix);
    mMatrixStack.push(copy);
}


//----------------------------------------------------------------------------------
/**
 * Pops matrix off of model matrix stack
 */
function mPopMatrix() {
    if (mMatrixStack.length == 0) {
      throw "Invalid popMatrix!";
    }
    mMatrix = mMatrixStack.pop();
}

//----------------------------------------------------------------------------------
/**
 * Sends projection/modelview matrices to shader
 * @param {String} program Name of shader program to upload to
 */
function setMatrixUniforms(program) {
  uploadModelViewMatrixToShader(program);
  uploadProjectionMatrixToShader(program);
  uploadNormalMatrixToShader(program);
}


//----------------------------------------------------------------------------------
/**
 * Translates degrees to radians
 * @param {Number} degrees Degree input to function
 * @return {Number} The radians that correspond to the degree input
 */
function degToRad(degrees) {
        return degrees * Math.PI / 180;
}

//----------------------------------------------------------------------------------
/**
 * Creates a context for WebGL
 * @param {element} canvas WebGL canvas
 * @return {Object} WebGL context
 */
function createGLContext(canvas) {
  var names = ["webgl", "experimental-webgl"];
  var context = null;
  for (var i=0; i < names.length; i++) {
    try {
      context = canvas.getContext(names[i]);
    } catch(e) {}
    if (context) {
      break;
    }
  }
  if (context) {
    context.viewportWidth = canvas.width;
    context.viewportHeight = canvas.height;
  } else {
    alert("Failed to create WebGL context!");
  }
  return context;
}

//----------------------------------------------------------------------------------
/**
 * Loads Shaders
 * @param {string} id ID string for shader to load. Either vertex shader/fragment shader
 */
function loadShaderFromDOM(id) {
  var shaderScript = document.getElementById(id);

  // If we don't find an element with the specified id
  // we do an early exit
  if (!shaderScript) {
    return null;
  }

  // Loop through the children for the found DOM element and
  // build up the shader source code as a string
  var shaderSource = "";
  var currentChild = shaderScript.firstChild;
  while (currentChild) {
    if (currentChild.nodeType == 3) { // 3 corresponds to TEXT_NODE
      shaderSource += currentChild.textContent;
    }
    currentChild = currentChild.nextSibling;
  }

  var shader;
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;
  }

  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function setupShaders() {
  setupSkyShaders();
  setupTeapotShaders();
}

//----------------------------------------------------------------------------------
/**
 * Setup the fragment and vertex shaders for the skybox
 */
function setupSkyShaders() {
  vertexShader = loadShaderFromDOM("shader-vs-skybox");
  fragmentShader = loadShaderFromDOM("shader-fs-skybox");

  skyShader = gl.createProgram();
  gl.attachShader(skyShader, vertexShader);
  gl.attachShader(skyShader, fragmentShader);
  gl.linkProgram(skyShader);

  if (!gl.getProgramParameter(skyShader, gl.LINK_STATUS)) {
    alert("Failed to setup shaders");
  }

  gl.useProgram(skyShader);

  skyShader.vertexPositionAttribute = gl.getAttribLocation(skyShader, "aVertexPosition");
  gl.enableVertexAttribArray(skyShader.vertexPositionAttribute);


  skyShader.mMatrixUniform = gl.getUniformLocation(skyShader, "uMMatrix");
  skyShader.vMatrixUniform = gl.getUniformLocation(skyShader, "uVMatrix");
  skyShader.pMatrixUniform = gl.getUniformLocation(skyShader, "uPMatrix");
  skyShader.texture = gl.getUniformLocation(skyShader, "uTexture");
}

//----------------------------------------------------------------------------------
/**
 * Setup the fragment and vertex shaders for the teapot
 */
function setupTeapotShaders() {
  vertexShader = loadShaderFromDOM("shader-vs-teapot");
  fragmentShader = loadShaderFromDOM("shader-fs-teapot");

  teapotShader = gl.createProgram();
  gl.attachShader(teapotShader, vertexShader);
  gl.attachShader(teapotShader, fragmentShader);
  gl.linkProgram(teapotShader);

  if (!gl.getProgramParameter(teapotShader, gl.LINK_STATUS)) {
    alert("Failed to setup shaders");
  }

  gl.useProgram(teapotShader);

  teapotShader.vertexPositionAttribute = gl.getAttribLocation(teapotShader, "aVertexPosition");
  gl.enableVertexAttribArray(teapotShader.vertexPositionAttribute);


  teapotShader.vertexNormalAttribute = gl.getAttribLocation(teapotShader, "aVertexNormal");
  gl.enableVertexAttribArray(teapotShader.vertexNormalAttribute);

  teapotShader.mMatrixUniform = gl.getUniformLocation(teapotShader, "uMMatrix");
  teapotShader.vMatrixUniform = gl.getUniformLocation(teapotShader, "uVMatrix");
  teapotShader.pMatrixUniform = gl.getUniformLocation(teapotShader, "uPMatrix");
  teapotShader.cameraPosUniform = gl.getUniformLocation(teapotShader, "worldCameraPosition");
  teapotShader.selectVal = gl.getUniformLocation(teapotShader, "select");
  teapotShader.fSelectVal = gl.getUniformLocation(teapotShader, "fSelect");
  teapotShader.texture = gl.getUniformLocation(teapotShader, "uTexture");
  teapotShader.nMatrixUniform = gl.getUniformLocation(teapotShader, "uNMatrix");
  teapotShader.uniformLightPositionLoc = gl.getUniformLocation(teapotShader, "uLightPosition");
  teapotShader.uniformAmbientLightColorLoc = gl.getUniformLocation(teapotShader, "uAmbientLightColor");
  teapotShader.uniformDiffuseLightColorLoc = gl.getUniformLocation(teapotShader, "uDiffuseLightColor");
  teapotShader.uniformSpecularLightColorLoc = gl.getUniformLocation(teapotShader, "uSpecularLightColor");
  teapotShader.uniformShininessLoc = gl.getUniformLocation(teapotShader, "uShininess");
  teapotShader.uniformAmbientMaterialColorLoc = gl.getUniformLocation(teapotShader, "uKAmbient");
  teapotShader.uniformDiffuseMaterialColorLoc = gl.getUniformLocation(teapotShader, "uKDiffuse");
  teapotShader.uniformSpecularMaterialColorLoc = gl.getUniformLocation(teapotShader, "uKSpecular");
}

//-------------------------------------------------------------------------
/**
 * Sends material information to the teapot shader
 * @param {Float32} alpha shininess coefficient
 * @param {Float32Array} a Ambient material color
 * @param {Float32Array} d Diffuse material color
 * @param {Float32Array} s Specular material color
 */
function setMaterialUniforms(alpha,a,d,s) {
  gl.uniform1f(teapotShader.uniformShininessLoc, alpha);
  gl.uniform3fv(teapotShader.uniformAmbientMaterialColorLoc, a);
  gl.uniform3fv(teapotShader.uniformDiffuseMaterialColorLoc, d);
  gl.uniform3fv(teapotShader.uniformSpecularMaterialColorLoc, s);
}

//-------------------------------------------------------------------------
/**
 * Sends light information to the teapot
 * @param {Float32Array} loc Location of light source
 * @param {Float32Array} a Ambient light strength
 * @param {Float32Array} d Diffuse light strength
 * @param {Float32Array} s Specular light strength
 */
function setLightUniforms(loc,a,d,s) {
  gl.uniform3fv(teapotShader.uniformLightPositionLoc, loc);
  gl.uniform3fv(teapotShader.uniformAmbientLightColorLoc, a);
  gl.uniform3fv(teapotShader.uniformDiffuseLightColorLoc, d);
  gl.uniform3fv(teapotShader.uniformSpecularLightColorLoc, s);
}

//----------------------------------------------------------------------------------
/**
 * Loads a mesh from a given obj file
 * @param {string} filename Loacation of the file
 */
function setupMesh(filename) {
   myMesh = new TriMesh();
   myPromise = asyncGetFile(filename);
   myPromise.then( (retrievedText) => {
     myMesh.loadFromOBJ(retrievedText);
     console.log("File receieved, mesh made");
   })
   .catch( (reason) => {
     console.log("Promise rejected: "+reason);
     console.log("Object not loaded");
   });
}

//----------------------------------------------------------------------------------
/**
 * Draw call that applies matrix transformations to model and draws model in frame
 */
function draw() {

    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // We'll use perspective
    mat4.perspective(pMatrix,degToRad(90),
                     gl.viewportWidth / gl.viewportHeight,
                     .1, 500.0);

    // We want to look down -z, so create a lookat point in that direction
    eyePt = vec3.fromValues(10*Math.sin(degToRad(eulerY)), 0, 10*Math.cos(degToRad(eulerY)));
    viewDir = vec3.fromValues(-Math.sin(degToRad(eulerY)), 0, -Math.cos(degToRad(eulerY)));
    vec3.add(viewPt, eyePt, viewDir);

    // Then generate the lookat matrix and initialize the view matrix to that view
    mat4.lookAt(vMatrix,eyePt,viewPt,up);

    // Draw skybox
    // use proper shader
    gl.useProgram(skyShader);
    mPushMatrix();
    //send uniforms to shader
    setMatrixUniforms("skyShader");
    // set the texture map
    gl.uniform1i(skyShader.texture, 0);
    //draw the skybox
    mySkyBox.drawTriangles();
    // reset model matrix
    mPopMatrix();

    //Draw teapot if loaded
    if(myMesh.loaded()){
      mPushMatrix();
      //use proper shader
      gl.useProgram(teapotShader);
      //tell shader which method to use (reflect, refract, or normal)
      gl.uniform1i(teapotShader.selectVal, shaderSelect);
      gl.uniform1i(teapotShader.fSelectVal, shaderSelect);
      // rotate based off user input
      mat4.rotateY(mMatrix, mMatrix, degToRad(teapotY));
      // translate for better view
      mat4.translate(mMatrix, mMatrix, vec3.fromValues(0, -1.5, 0));
      //send eyept so it can determine where camera is for reflection/refraction
      gl.uniform3fv(teapotShader.cameraPosUniform, eyePt);
      // set the texture map
      gl.uniform1i(teapotShader.texture, 0);
      // send uniforms to shader
      setMatrixUniforms("teapotShader");
      // send light information to the shaders
      setLightUniforms(lightPosition,lAmbient,lDiffuse,lSpecular);
      // send material information to shaders
      setMaterialUniforms(shininess,kAmbient,kTerrainDiffuse,kSpecular);
      // draw the teapot
      myMesh.drawTriangles();
      //reset the model matrix
      mPopMatrix();
    }


}

//----------------------------------------------------------------------------------
//Code to handle user interaction
var currentlyPressedKeys = {};

/**
 * handles if key is pressed, saves value to array
 */
function handleKeyDown(event) {
        //console.log("Key down ", event.key, " code ", event.code);
        currentlyPressedKeys[event.key] = true;
}

/**
 * handles if key released, sets value in array to true
 */
function handleKeyUp(event) {
        //console.log("Key up ", event.key, " code ", event.code);
        currentlyPressedKeys[event.key] = false;
}

//----------------------------------------------------------------------------------
/**
 * Startup function called from html code to start program.
 */
 function startup() {
  canvas = document.getElementById("myGLCanvas");
  gl = createGLContext(canvas);
  // setup skybox/teapot shaders
  setupShaders();
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  document.onkeydown = handleKeyDown;
  document.onkeyup = handleKeyUp;
  // create the skybox
  mySkyBox = new Skybox();
  mySkyBox.loadBox([100,100,100], [-100,-100,-100]);
  //setup the cubemap by loading images
  setupCubeMap();
  mySkyBox.uploadCubeMap();
  //load the teapot object
  setupMesh("https://raw.githubusercontent.com/illinois-cs418/cs418CourseMaterial/master/Meshes/teapot_0.obj");
  tick();
}


//----------------------------------------------------------------------------------
/**
  * Update any model transformations
  */
function animate() {
   //console.log(eulerX, " ", eulerY, " ", eulerZ)
   // orbit the camera
   if (currentlyPressedKeys["a"]) {
     // key A
     eulerY-= 1;
   } else if (currentlyPressedKeys["d"]) {
       // key D
       eulerY+= 1;
   }
   // rotate teapot
   if (currentlyPressedKeys["ArrowLeft"]) {
     // key W
     teapotY-= 1;
   } else if (currentlyPressedKeys["ArrowRight"]) {
     // key S
     teapotY+= 1;
   }

   //update webpage
   document.getElementById("eY").value=eulerY;
   document.getElementById("eX").value=teapotY;

   // determine which shading method to use for the teapot
   if(document.getElementById("refl").checked){
     shaderSelect = 0;
   }
   else if (document.getElementById("refr").checked){
     shaderSelect = 1;
   }
   else {
     shaderSelect = 2;
   }
}


//----------------------------------------------------------------------------------
/**
 * Keeping drawing frames....
 */
function tick() {
    requestAnimFrame(tick);
    animate();
    draw();
}
