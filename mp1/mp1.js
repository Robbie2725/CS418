/** @global The WebGL context */
var gl;

/** @global The HTML5 canvas we draw on */
var canvas;

/** @global The buffer with vertex positions */
var  vertexPositionBuffer;

/** @global A simple GLSL shader program */
var shaderProgram;

var frameNumber=0;

var rotationAngle=0;

var squashScale=0;

var squashRate=-.01;

var modelView = glMatrix.mat4.create();

var colors = [
  [0.9, 0.29, 0.15, 1.0], // orange
  [0.07, 0.16, 0.29, 1.0] // dark blue
];

/**
 * Creates a context for WebGL
 * @param {element} canvas WebGL canvas
 * @return {Object} WebGL context
 */
function createGLContext(canvas) {
  var context = null;
  context = canvas.getContext("webgl");
  if (context) {
    context.viewportWidth = canvas.width;
    context.viewportHeight = canvas.height;
  } else {
    alert("Failed to create WebGL context!");
    console.log("Error with WebGL context");
  }
  return context;
}

/**
 * Setup the fragment and vertex shaders
 */
function setupShaders() {

  var vertexShader =loadShaderFromDOM("shader-v");
  var fragmentShader =loadShaderFromDOM("shader-f");

  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Failed to setup shaders");
    console.log("Failed to setup shaders!");
  }

  gl.useProgram(shaderProgram);
  shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  shaderProgram.vColorUniform = gl.getUniformLocation(shaderProgram, "vColor");
  shaderProgram.modelViewUniform = gl.getUniformLocation(shaderProgram, "uModelView");
  // shaderProgram.projectionUniform = gl.getUniformLocation(shaderProgram, "uProjection");
}

function loadShaderFromDOM(id){
  var script = document.getElementById(id);
  if(!script){
    console.log("Failed to load shader by id: ", id);
    return null;
  }

  var source = "";
  var cur = script.firstChild;
  while(cur){
    if(cur.nodeType == 3 ) {source+=cur.textContent;}
    cur =cur.nextSibling;
  }
  var shader;
  if(script.type=="x-shader/x-fragment") {shader=gl.createShader(gl.FRAGMENT_SHADER);}
  else if(script.type=="x-shader/x-vertex") {shader=gl.createShader(gl.VERTEX_SHADER);}
  else {
    console.log("Failed to get type: ", id);
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    console.log(source);
    console.log("Failed to load shader!");
    return null;
  }

  return shader;
}

/**
 * Populate buffers with data
 */
function setupBuffers() {
  vertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
  var vertexArray = [
    //small I
    -.75, .95, 0.0,
    -.75, 0.5, 0.0,
    .75, .95, 0.0,
    .75, 0.5, 0.0,
    -.35, .5, 0,
    .35, .5, 0,
    -.35, -.5, 0,
    .35, -.5, 0,
    -.75, -.5, 0,
    -.75, -.95, 0,
    .35, -.95, 0,
    .35, -.5, 0,
    .75, -.95, 0,
    .75, -.5, 0,
    //Big I
    -.8, 1.0, 0.0,
    -.8, 0.45, 0.0,
    .8, 1.0, 0.0,
    .8, 0.45, 0.0,
    -.4, .45, 0,
    .4, .45, 0,
    -.4, -.45, 0,
    .4, -.45, 0,
    -.8, -.45, 0,
    -.8, -1, 0,
    .4, -1, 0,
    .4, -.45, 0,
    .8, -1, 0,
    .8, -.45, 0
  ];

  scaledArray = vertexArray.map( x => x/1.3 );
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(scaledArray), gl.DYNAMIC_DRAW);
  vertexPositionBuffer.itemSize=3;
  vertexPositionBuffer.numberOfItems=28;
}

/**
 * Draw model (render frame)
 */
function draw(){
  setupBuffers();
  gl.viewport(0,0,gl.viewportWidth, gl.viewportHeight);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
  var affine1 = glMatrix.mat4.create();
  var affine2 = glMatrix.mat4.create();

  glMatrix.mat4.identity(modelView);
  //first affine transformation = squashing
  for(i=0; i<3; i++){
    affine1[4*i+i]-=squashScale;
  }

  //then second transformation = rotate
  glMatrix.mat4.rotate(affine2,
              affine2,
              rotationAngle,
              [0,1,0]);

  // Set the uniforms
  glMatrix.mat4.multiply(modelView, affine1, affine2);
  gl.uniformMatrix4fv(shaderProgram.modelViewUniform, false, modelView);

  // Draw blue I first
  gl.uniform4f(shaderProgram.vColorUniform, colors[1][0], colors[1][1], colors[1][2], colors[1][3]);
  gl.drawArrays(gl.TRIANGLE_STRIP, 14, 14);
  // Then the orange I
  gl.uniform4f(shaderProgram.vColorUniform, colors[0][0], colors[0][1], colors[0][2], colors[0][3]);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 14);

}

function animate(){
  rotationAngle+=.04;
  if(squashScale>.5){
    squashRate=-.01;
  }
  else if(squashScale<0){
    squashRate=.01;
  }
  squashScale+=squashRate;

}

/**
 * Startup function called from html code to start program.
 */
 function startup() {

  console.log("Startup Function Called");
  canvas = document.getElementById("myGLCanvas");
  gl = createGLContext(canvas);
  setupShaders();
  setupBuffers();
  gl.clearColor(1.0, 1.0, 1.0, 1.0);
  tick();
}

function tick(){
  // console.log("Frame ", frameNumber);
  frameNumber++;
  requestAnimationFrame(tick);
  draw();
  animate();
}
