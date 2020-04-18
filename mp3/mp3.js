
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

/** @global The View matrix */
var vMatrix = mat4.create();

/** @global The Projection matrix */
var pMatrix = mat4.create();

/** @global The Normal matrix */
var nMatrix = mat3.create();

/** @global The matrix stack for hierarchical modeling */
var mvMatrixStack = [];

/** @global An object holding the geometry for a 3D mesh */
var myMesh;


// View parameters
/** @global Location of the camera in world coordinates */
var eyePt = vec3.fromValues(0.0,0.0,20);
/** @global Direction of the view in world coordinates */
var viewDir = vec3.fromValues(0.0,0.0,-1.0);
/** @global Up vector for view matrix creation, in world coordinates */
var up = vec3.fromValues(0.0,1.0,0.0);
/** @global Location of a point along viewDir in world coordinates */
var viewPt = vec3.fromValues(0.0,0.0,0.0);

//Light parameters
/** @global Light position in VIEW coordinates */
var lightPosition = [0,5,5];
/** @global Ambient light color/intensity for Phong reflection */
var lAmbient = [0,0,0];
/** @global Diffuse light color/intensity for Phong reflection */
var lDiffuse = [1,1,1];
/** @global Specular light color/intensity for Phong reflection */
var lSpecular =[0,0,0];

//Material parameters
/** @global Ambient material color/intensity for Phong reflection */
var kAmbient = [1.0,1.0,1.0];
/** @global Diffuse material color/intensity for Phong reflection */
var kTerrainDiffuse = [205.0/255.0,163.0/255.0,63.0/255.0];
/** @global Specular material color/intensity for Phong reflection */
var kSpecular = [0.0,0.0,0.0];
/** @global Shininess exponent for Phong reflection */
var shininess = 23;
/** @global Edge color fpr wireframeish rendering */
var kEdgeBlack = [0.0,0.0,0.0];
/** @global Edge color for wireframe rendering */
var kEdgeWhite = [1.0,1.0,1.0];

/** @global variable for the skybox */
var mySkyBox;

//Model parameters
var eulerY=0;
var eulerX=0;


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
 * Sends Modelview matrix to shader
 */
function uploadModelViewMatrixToShader(program) {
  if(program=="skyShader"){
    gl.uniformMatrix4fv(skyShader.mvMatrixUniform, false, mvMatrix);
  }
  else if(program=="teapotShader"){
    gl.uniformMatrix4fv(teapotShader.mvMatrixUniform, false, mvMatrix);
  }
}

//-------------------------------------------------------------------------
/**
 * Sends projection matrix to shader
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
 */
function uploadNormalMatrixToShader(program) {
  mat3.fromMat4(nMatrix,mvMatrix);
  mat3.transpose(nMatrix,nMatrix);
  mat3.invert(nMatrix,nMatrix);
  if(program!="skyShader"){
    gl.uniformMatrix3fv(teapotShader.nMatrixUniform, false, nMatrix);
  }
}

//----------------------------------------------------------------------------------
/**
 * Pushes matrix onto modelview matrix stack
 */
function mvPushMatrix() {
    var copy = mat4.clone(mvMatrix);
    mvMatrixStack.push(copy);
}


//----------------------------------------------------------------------------------
/**
 * Pops matrix off of modelview matrix stack
 */
function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
      throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

//----------------------------------------------------------------------------------
/**
 * Sends projection/modelview matrices to shader
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
  // setupTeapotShaders();
}

//----------------------------------------------------------------------------------
/**
 * Setup the fragment and vertex shaders
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


  skyShader.mvMatrixUniform = gl.getUniformLocation(skyShader, "uMVMatrix");
  skyShader.pMatrixUniform = gl.getUniformLocation(skyShader, "uPMatrix");
  skyShader.texture = gl.getUniformLocation(skyShader, "uTexture");
}

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

  teapotShader.mvMatrixUniform = gl.getUniformLocation(teapotShader, "uMVMatrix");
  teapotShader.pMatrixUniform = gl.getUniformLocation(teapotShader, "uPMatrix");
  teapotShader.texture = gl.getUniformLocation(teapotShader, "uTexture");
  // shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
  // shaderProgram.uniformLightPositionLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");
  // shaderProgram.uniformAmbientLightColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientLightColor");
  // shaderProgram.uniformDiffuseLightColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseLightColor");
  // shaderProgram.uniformSpecularLightColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularLightColor");
  // shaderProgram.uniformShininessLoc = gl.getUniformLocation(shaderProgram, "uShininess");
  // shaderProgram.uniformAmbientMaterialColorLoc = gl.getUniformLocation(shaderProgram, "uKAmbient");
  // shaderProgram.uniformDiffuseMaterialColorLoc = gl.getUniformLocation(shaderProgram, "uKDiffuse");
  // shaderProgram.uniformSpecularMaterialColorLoc = gl.getUniformLocation(shaderProgram, "uKSpecular");
}

//-------------------------------------------------------------------------
/**
 * Sends material information to the shader
 * @param {Float32} alpha shininess coefficient
 * @param {Float32Array} a Ambient material color
 * @param {Float32Array} d Diffuse material color
 * @param {Float32Array} s Specular material color
 */
function setMaterialUniforms(alpha,a,d,s) {
  gl.uniform1f(shaderProgram.uniformShininessLoc, alpha);
  gl.uniform3fv(shaderProgram.uniformAmbientMaterialColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseMaterialColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularMaterialColorLoc, s);
}

//-------------------------------------------------------------------------
/**
 * Sends light information to the shader
 * @param {Float32Array} loc Location of light source
 * @param {Float32Array} a Ambient light strength
 * @param {Float32Array} d Diffuse light strength
 * @param {Float32Array} s Specular light strength
 */
function setLightUniforms(loc,a,d,s) {
  gl.uniform3fv(shaderProgram.uniformLightPositionLoc, loc);
  gl.uniform3fv(shaderProgram.uniformAmbientLightColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseLightColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularLightColorLoc, s);
}

//----------------------------------------------------------------------------------
/**
 * Populate buffers with data
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
    //console.log("function draw()")

    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // We'll use perspective
    mat4.perspective(pMatrix,degToRad(90),
                     gl.viewportWidth / gl.viewportHeight,
                     .1, 500.0);

    // We want to look down -z, so create a lookat point in that direction
    vec3.add(viewPt, eyePt, viewDir);


    // Then generate the lookat matrix and initialize the view matrix to that view
    mat4.lookAt(vMatrix,eyePt,viewPt,up);

    mat4.rotateY(vMatrix, vMatrix, degToRad(eulerY));

    // Draw skybox
    gl.useProgram(skyShader);
    mvPushMatrix();
    mat4.multiply(mvMatrix,vMatrix,mvMatrix);
    setMatrixUniforms("skyShader");
    mySkyBox.uploadCubeMap();
    mySkyBox.drawTriangles();
    mvPopMatrix();

    //Draw teapot
    if(myMesh.loaded()){
      mvPushMatrix();
      gl.useProgram(teapotShader);
      // mat4.scale(mvMatrix, mvMatrix, vec3.fromValues(.2, .2, .2));
      mat4.translate(mvMatrix, mvMatrix, vec3.fromValues(0, -1, 0));
      mat4.multiply(mvMatrix, vMatrix, mvMatrix);
      setMatrixUniforms("teapotShader");
      myMesh.drawTriangles();
      mvPopMatrix();
    }


}

//----------------------------------------------------------------------------------
//Code to handle user interaction
var currentlyPressedKeys = {};

function handleKeyDown(event) {
        //console.log("Key down ", event.key, " code ", event.code);
        currentlyPressedKeys[event.key] = true;
}

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
  setupSkyShaders();
  setupTeapotShaders();
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  document.onkeydown = handleKeyDown;
  document.onkeyup = handleKeyUp;
  mySkyBox = new Skybox();
  mySkyBox.loadBox([100,100,100], [-100,-100,-100]);
  setupCubeMap(); // Sets up cubemap
  setupMesh("teapot_0.obj");
  tick();
}


//----------------------------------------------------------------------------------
/**
  * Update any model transformations
  */
function animate() {
   //console.log(eulerX, " ", eulerY, " ", eulerZ)
   if (currentlyPressedKeys["a"]) {
     // key A
     eulerY-= 1;
   } else if (currentlyPressedKeys["d"]) {
       // key D
       eulerY+= 1;
   }
   if (currentlyPressedKeys["w"]) {
     // key W
     eulerX-= 1;
   } else if (currentlyPressedKeys["s"]) {
     // key S
     eulerX+= 1;
   }

   document.getElementById("eY").value=eulerY;
   document.getElementById("eX").value=eulerX;
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
