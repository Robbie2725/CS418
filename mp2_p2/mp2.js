/**
 * @file A WebGl program that renders and animates a Block I or two circle gradients rotating
 * @author Robert Krokos <rkroko2@illinois.edu>
 */

/** @global The WebGL context */
var gl;

/** @global The HTML5 canvas we draw on */
var canvas;

/** @global A simple GLSL shader program */
var shaderProgram;

// gl matrix variables
/** @global Global variable to simplify mat4 operations */
var mat4 = glMatrix.mat4;

/** @global Global variable to simplify mat3 operations */
var mat3 = glMatrix.mat3;

/** @global Global variable to simplify mat4 operations */
var vec3 = glMatrix.vec3;

/** @global Global variable to simplify vec4 operations */
var vec4 = glMatrix.vec4;

/** @global Global variable to simplify quat operations */
var quat = glMatrix.quat;

/** @global The Modelview matrix */
var mvMatrix = mat4.create();

/** @global The Projection matrix */
var pMatrix = mat4.create();

/** @global The Normal matrix */
var nMatrix = mat3.create();

/** @global The matrix stack for hierarchical modeling */
var mvMatrixStack = [];

/** @global The angle of rotation around the y axis */
var viewRot = 0;

/** @global A glmatrix vector to use for transformations */
var transformVec = vec3.create();

// Initialize the vector....
vec3.set(transformVec,0.0,-.25,-2.0);

/** @global An object holding the geometry for a 3D terrain */
var myTerrain;

// View parameters
/** @global Location of the camera in world coordinates */
var eyePt = vec3.fromValues(0,0,-0);
/** @global Direction of the view in world coordinates */
var viewDir = vec3.fromValues(0.0,0,-1);
/** @global Up vector for view matrix creation, in world coordinates */
var up = vec3.fromValues(0.0,1.0,0.0);
/** @global Location of a point along viewDir in world coordinates */
var viewPt = vec3.fromValues(0.0,0.0,0.0);

//Light parameters
/** @global Light position in VIEW coordinates */
var lightPosition = [0,3,3];
/** @global Ambient light color/intensity for Phong reflection */
var lAmbient = [0,0,0];
/** @global Diffuse light color/intensity for Phong reflection */
var lDiffuse = [1,1,1];
/** @global Specular light color/intensity for Phong reflection */
var lSpecular =[0,0,0];

//Material parameters
/** @global Ambient material color/intensity for Phong reflection */
var kAmbient = [1.0,1.0,1.0];
/** @global Array of diffuse material color/intensity for Phong reflection */
var kTerrainDiffuse = [[52/255, 152/255, 235/255], //blue
                        [101/255, 235/255, 52/255], //green
                        [176/255, 134/255, 7/255], //brown
                        [1, 1, 1]]; //white
/** @global Specular material color/intensity for Phong reflection */
var kSpecular = [0.0,0.0,0.0];
/** @global Shininess exponent for Phong reflection */
var shininess = 100;
/** @global Edge color fpr wireframeish rendering */
var kEdgeBlack = [0.0,0.0,0.0];
/** @global Edge color for wireframe rendering */
var kEdgeWhite = [1.0,1.0,1.0];

/** @global Variable passed to shader to determine if fog on/off */
var fogOn = 1;

/** @global Array of currently pressed keys */
var currentKeysPressed = {};

/** @global X, Y, and Z Euler angles for orientation */
var eulerAngles = [0,0,0];

/** @global Quaternion to store the current roll orientation */
var roll = quat.create();

/** @global Quaternion to store the current pitch orientation */
var pitch = quat.create();

/** @global The current speed of the 'plane' */
var speed = 0.001;

/**
 * Handles the key press
 * @param {event} event from browser
 */
function handleKeyDown(event){
  // log the key press
  console.log("Key down ", event.key," code ", event.code );
  // prevent default action so we can use for our own purposes
  if(event.key == "ArrowDown" || event.key == "ArrowUp" || event.key == "ArrowLeft" || event.key == "ArrowRight"){
    event.preventDefault();
  }
  else if (event.key == "q" || event.key == "w"){
    event.preventDefault();
  }
  // store it in the array as true
  currentKeysPressed[event.key] = true;
}

/**
 * Handles the key release
 * @param {event} event from browser
 */
function handleKeyUp(event){
  // log the key release
  console.log("Key up ", event.key," code ", event.code );
  // set value in array to false
  currentKeysPressed[event.key] = false;
}




/**
 * Translates degrees to radians
 * @param {Number} degrees Degree input to function
 * @return {Number} The radians that correspond to the degree input
 */
function degToRad(degrees) {
        return degrees * Math.PI / 180;
}

/**
* Computes AxB and places in P
* @param {Object} P an array of length 3 that will be AxB
* @param {Object} A an array of length 3 holding x,y,z coords
* @param {Object} B an array of length 3 holding x,y,z coords
*/
function cross_prod(P, A, B){
  P[0] = A[1]*B[2]-A[2]*B[1];
  P[1] = A[2]*B[0]-A[0]*B[2];
  P[2] = A[0]*B[1]-A[1]*B[0];
}


/**
 * Creates a context for WebGL
 * @param {element} canvas WebGL canvas
 * @return {Object} WebGL context
 */
function createGLContext(canvas) {
  var context = null;
  context = canvas.getContext("webgl");
  if (context) {
    // If context found, set viewport dimensions to match canvas
    context.viewportWidth = canvas.width;
    context.viewportHeight = canvas.height;
  } else {
    //else alert user
    alert("Failed to create WebGL context!");
    console.log("Error with WebGL context");
  }
  return context;
}

/**
  * Pushes matrix onto MV matrix stack
  */
function mvPop(){
  if(mvMatrixStack.length != 0){
    mvMatrix = mvMatrixStack.pop();
  }
  else {
    throw "Invalid MV PopMatrix!";
  }
}

/**
  * Pushes matrix onto MV matrix stack
  */
function mvPush(){
  var copy = mat4.clone(mvMatrix);
  mvMatrixStack.push(copy);
}

/**
* Generates and sends the normal matrix to the shader
*/
function uploadNMatrix() {
  mat3.fromMat4(nMatrix,mvMatrix);
  mat3.transpose(nMatrix,nMatrix);
  mat3.invert(nMatrix,nMatrix);
  gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, nMatrix);
}

/**
  * Sends Projection Matrix to the shader program
  */
function uploadPMatrix(){
  gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
}

/**
  * Sends Model View Matrix to the shader program
  */
function uploadMVMatrix(){
  gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

/**
 * Sends material information to the shader
 * @param {Float32} alpha shininess coefficient
 * @param {Float32Array} a Ambient material color
 * @param {Float32Array} d Array of 4 diffuse material colors
 * @param {Float32Array} s Specular material color
 */
function setMaterialUniforms(alpha,a,d,s) {
  gl.uniform1f(shaderProgram.uniformShininessLoc, alpha);
  gl.uniform3fv(shaderProgram.uniformAmbientMaterialColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseColorLoc1, d[3]);
  gl.uniform3fv(shaderProgram.uniformDiffuseColorLoc2, d[2]);
  gl.uniform3fv(shaderProgram.uniformDiffuseColorLoc3, d[1]);
  gl.uniform3fv(shaderProgram.uniformDiffuseColorLoc4, d[0]);
  gl.uniform3fv(shaderProgram.uniformSpecularMaterialColorLoc, s);
}

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

/**
 * Sends projection/modelview/normal matrices to shader
 */
function setMatrixUniforms() {
  uploadMVMatrix();
  uploadPMatrix();
  uploadNMatrix();
}

/**
* Loads and compiles shader from DOM
* @param {string} id ID string for shader to load, either a vertex shader or fragment shader
* @return {WebGLShader} the shader loaded
*/
function loadShaderFromDOM(id){
  var script = document.getElementById(id);
  if(!script){
    // Fail if element with this ID not found
    console.log("Failed to load shader by id: ", id);
    return null;
  }

  // Loop through DOM element and load shader source code
  var source = "";
  var cur = script.firstChild;
  while(cur){
    if(cur.nodeType == 3 ) {source+=cur.textContent;}
    cur =cur.nextSibling;
  }

  // Create approriate shader type based on DOM type
  var shader;
  if(script.type=="x-shader/x-fragment") {shader=gl.createShader(gl.FRAGMENT_SHADER);}
  else if(script.type=="x-shader/x-vertex") {shader=gl.createShader(gl.VERTEX_SHADER);}
  else {
    console.log("Failed to get type: ", id);
    return null;
  }

  // Set the source code and compile
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // If not compiled successfully, alert and return null
    console.log(gl.getShaderInfoLog(shader));
    console.log(source);
    console.log("Failed to load shader!");
    return null;
  }

  return shader; // return the compiled shader
}

/**
 * Setup the fragment and vertex shaders
 */
function setupShaders() {
  //Load the vertex and fragment shaders
  vertexShader =loadShaderFromDOM("blinn-phong-vs");
  fragmentShader =loadShaderFromDOM("blinn-phong-fs");

  //Create the shader program and attach the vertex/fragment shaders
  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    //Alert if shaders not set up properly
    alert("Failed to setup shaders");
    console.log(gl.getProgramInfoLog(shaderProgram));
  }

  // Use the shaderProgram just created
  gl.useProgram(shaderProgram);

  // Get attributes from shaders and enable arrays that will be needed later
  shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
  gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

  // Get the uniforms
  shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
  shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
  shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
  shaderProgram.uniformLightPositionLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");
  shaderProgram.uniformAmbientLightColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientLightColor");
  shaderProgram.uniformDiffuseLightColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseLightColor");
  shaderProgram.uniformSpecularLightColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularLightColor");
  shaderProgram.uniformShininessLoc = gl.getUniformLocation(shaderProgram, "uShininess");
  shaderProgram.uniformAmbientMaterialColorLoc = gl.getUniformLocation(shaderProgram, "uKAmbient");
  shaderProgram.uniformDiffuseColorLoc1 = gl.getUniformLocation(shaderProgram, "kDiffuse1");
  shaderProgram.uniformDiffuseColorLoc2 = gl.getUniformLocation(shaderProgram, "kDiffuse2");
  shaderProgram.uniformDiffuseColorLoc3 = gl.getUniformLocation(shaderProgram, "kDiffuse3");
  shaderProgram.uniformDiffuseColorLoc4 = gl.getUniformLocation(shaderProgram, "kDiffuse4");
  shaderProgram.uniformSpecularMaterialColorLoc = gl.getUniformLocation(shaderProgram, "uKSpecular");
  shaderProgram.uniformFogSelect = gl.getUniformLocation(shaderProgram, "uFogOn");

}

/**
 * Draw call that applies matrix transformations to model and draws model in frame
 */
function draw() {
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // We'll use perspective
  mat4.perspective(pMatrix,degToRad(45),
                   gl.viewportWidth / gl.viewportHeight,
                   0.1, 200.0);

  // update mv matrix with lookat
  mat4.lookAt(mvMatrix,eyePt,viewPt,up);
  // update the position of the light source (since camera is moving)
  var newlight = vec3.create();
  vec3.transformMat4(newlight, lightPosition, mvMatrix);

  //push current modelview matrix to stack
  mvPush();
  // update the model view
  mat4.translate(mvMatrix, mvMatrix, transformVec);
  mat4.rotateX(mvMatrix, mvMatrix, degToRad(-90));
  setMatrixUniforms();

  // Send info to determine if fog on/off
  gl.uniform1i(shaderProgram.uniformFogSelect, fogOn);

  // Send the lighting information to shaders
  setLightUniforms(newlight,lAmbient,lDiffuse,lSpecular);
  // send material information to shaders
  setMaterialUniforms(shininess,kAmbient,kTerrainDiffuse,kSpecular);
  // draw the terrain
  myTerrain.drawTriangles();
  // Pop modelview from stack
  mvPop();


}

/**
 * Populate buffers with data
 */
function setupBuffers() {
    myTerrain = new Terrain(256,-6 ,6,-6,6);
    myTerrain.loadBuffers();
}

/**
 * Called Each time frame is rendered, updates variables to simulate
 * plane flying over the terrain
 */
function animate(){
  //Update speed if q/w pressed
  if(currentKeysPressed["q"]) speed+=.001;
  else if(currentKeysPressed["w"]) speed -= .001;
  if(speed<0) speed=0;

  //Update angles if one of the arrow keys is pressed
  if(currentKeysPressed["ArrowUp"]) eulerAngles[0] -= .015;
  if(currentKeysPressed["ArrowDown"]) eulerAngles[0] += .015;
  if(currentKeysPressed["ArrowLeft"]) eulerAngles[2] -= .03; // Should this be y or z?
  if(currentKeysPressed["ArrowRight"]) eulerAngles[2] += .03;

  // update the roll quaternion (since we know the axis rotated around is the previous view direction)
  quat.setAxisAngle(roll, viewDir , eulerAngles[2]);
  eulerAngles[2]=0; // reset the angle ( so it will stop rotating)

  // Update the new up vector based on roll orientation
  vec3.transformQuat(up, up, roll);

  // Pitch axis is the cross product of the up vector and view direction
  var pitchAxis = vec3.create();
  // update the pitch quaternion
  quat.setAxisAngle(pitch, vec3.cross(pitchAxis, up, viewDir), eulerAngles[0]);
  eulerAngles[0]=0; //reset the angle so it will stop rotating

  // update up vector and view direction based on pitch quaternion
  vec3.transformQuat(up, up, pitch);
  vec3.transformQuat(viewDir, viewDir, pitch);
  vec3.scaleAndAdd(eyePt, eyePt, viewDir, speed);
  // get the new eyePt for the next time lookat function called
  vec3.add(viewPt, eyePt, viewDir);
}

/**
* Startup function called from html code to start program.
*/
function startup() {
  console.log("Startup Function Called");

  // get canvas to render model on
  canvas = document.getElementById("myGLCanvas");

  // create context
  gl = createGLContext(canvas);

  // Setup the shaders and buffers
  setupShaders();
  setupBuffers();

  // Set the clear color to white
  gl.clearColor(1, 1, 1, 1);

  gl.enable(gl.DEPTH_TEST);

  document.onkeydown = handleKeyDown;
  document.onkeyup = handleKeyUp;
  // Call tick function, which will then be called every subsequent animation frame
  tick();
}

/**
 * Tick called for every animation frame.
 */
function tick() {
    requestAnimationFrame(tick);

    // determine if fog on/off based of button
    if(document.getElementById("fogSelectOn").checked){
      fogOn = 1;
    }
    else {
      fogOn = 0;
    }
    
    animate();
    draw();
}
