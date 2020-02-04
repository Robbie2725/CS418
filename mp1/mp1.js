/** @global The WebGL context */
var gl;

/** @global The HTML5 canvas we draw on */
var canvas;

/** @global The buffer with vertex positions */
var  vertexPositionBuffer;

/** @global A simple GLSL shader program */
var shaderProgram;

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

  //shaderProgram.vertexColorAttribute = gl.getAttribLocation(shaderProgram, "aVertexColor");
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
  if(script.type=="fragment") {shader=gl.createShader(gl.FRAGMENT_SHADER);}
  else if(script.type=="vertex") {shader=gl.createShader(gl.VERTEX_SHADER);}
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
  var triangleVertices = [
    -.75, 1.0, 0.0,
    -.75, 0.5, 0.0,
    .75, 1.0, 0.0,
    .75, 0.5, 0.0,
    -.4, .5, 0,
    .4, .5, 0,
    -.4, -.5, 0,
    .4, -.5, 0,
    -.75, -.5, 0,
    -.75, -1, 0,
    .4, -1, 0,
    .4, -.5, 0,
    .75, -1, 0,
    .75, -.5, 0
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangleVertices), gl.STATIC_DRAW);
  vertexPositionBuffer.itemSize=3;
  vertexPositionBuffer.numberOfItems=14;
}

/**
 * Draw model (render frame)
 */
function draw(){
  gl.viewport(0,0,gl.viewportWidth, gl.viewportHeight);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexPositionBuffer.numberOfItems);
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
  draw();
}
