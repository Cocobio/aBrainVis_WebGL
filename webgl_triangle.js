var gl;
var canvas;
var shaderPorgram;
var vertexBuffer;

function createGLContext(canvas) {
	var names = ["webgl2", "webgl", "experimental-webgl"];
	var context = null;
	for (var i=0; i<names.length; i++) {
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
	}
	else {
		alert("Failed to create WebGL context!");
	}

	return context;
}

function loadShader(type, shaderSource) {
	var shader = gl.createShader(type);
	gl.shaderSource(shader, shaderSource);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert("Error compiling shader" + gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}
	return shader;
}

function setupShaders() {
	var vertexShaderSource = 
	"attribute vec3 aVertexPosition;				\n" +
	"void main() {									\n" +
	"	gl_Position = vec4(aVertexPosition, 1.0);	\n"+
	"}												\n";

	var fragmentShaderSource = 
	"precision mediump float;						\n" +
	"void main() {									\n" +
	"	gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);	\n" +
	"}												\n";

	var vertexShader = loadShader(gl.VERTEX_SHADER, vertexShaderSource);
	var fragmentShader = loadShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

	shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);

	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		alert("Failed to setup shaders");
	}

	gl.useProgram(shaderProgram);

	shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
}

function setupBuffers() {
	vertexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	var triangleVertices = [
		 0.0,  0.5,  0.0,
		-0.5, -0.5,  0.0,
		 0.5, -0.5,  0.0
	];

	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangleVertices), gl.STATIC_DRAW);

	vertexBuffer.itemSize = 3;
	vertexBuffer.numberOfItems = 3;
}

function draw() {
	gl.viewport(0,0,gl.viewportWidth, gl.viewportHeight);
	gl.clear(gl.COLOR_BUFFER_BIT);

	gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, vertexBuffer.itemSize, gl.FLOAT, false, 0,  0);
	gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
	gl.drawArrays(gl.TRIANGLES, 0, vertexBuffer.numberOfItems);
}


function startup() {
	// canvas = document.getElementById("myGLCanvas");
	// gl = createGLContext(canvas);
	// // gl = WebGLDebugUtils.makeDebugContext(createGLContext(canvas));
	// setupShaders();
	// setupBuffers();
	// gl.clearColor(0.0,0.0,0.0,1.0);
	// draw();

	// test();
	let bundleHeader = {};
	let pythonDict = "attributes = {\n"+
    "\'binary\' : 1,\n" +
    "\'bundles\' : [ \'CG_LEFT\', 0, \'THAL_TEMP_RIGHT\', 202, \'THAL_MOT_RIGHT\', 332, \'AR_LEFT\', 615, \'CG2_RIGHT\', 1043, \'AR_ANT_LEFT\', 1691, \'CC_SPLENIUM\', 2134, \'AR_POST_LEFT\', 2224, \'AR_POST_RIGHT\', 2546, \'THAL_FRONT_RIGHT\', 2868, \'CC_ROSTRUM\', 3346, \'CST_LEFT\', 3430, \'CC_BODY\', 3854, \'CG3_RIGHT\', 4236, \'CST_RIGHT\', 4339, \'CG_RIGHT\', 4763, \'AR_ANT_RIGHT\', 4965, \'UN_LEFT\', 5408, \'THAL_PAR_RIGHT\', 5744, \'FORNIX_RIGHT\', 5893, \'THAL_MOT_LEFT\', 5963, \'IL_LEFT\', 6246, \'IFO_RIGHT\', 6746, \'IL_RIGHT\', 7480, \'THAL_OCC_LEFT\', 7980, \'CG3_LEFT\', 8063, \'CST_long_RIGHT\', 8166, \'IFO_LEFT\', 8378, \'CC_GENU\', 9112, \'THAL_PAR_LEFT\', 9221, \'CG2_LEFT\', 9370, \'THAL_TEMP_LEFT\', 10018, \'FORNIX_LEFT\', 10148, \'THAL_OCC_RIGHT\', 10218, \'THAL_FRONT_LEFT\', 10301, \'UN_RIGHT\', 10779, \'AR_RIGHT\', 11115, \'CST_long_LEFT\', 11543 ],\n"+
    "\'byte_order\' : \'DCBA\',\n"+
    "\'curves_count\' : 11755,\n"+
    "\'data_file_name\' : \'*.bundlesdata\',\n"+
    "\'format\' : \'bundles_1.0\',\n"+
    "\'space_dimension\' : 3\n"+
  	"}\n";

  	let dict = parsePythonDict(pythonDict);
  	console.log(dict);

 //  	jQuery.get('/resources/atlas.bundles', function(data) {
	//     alert(data);
	// });

	fetch('resources/atlas.bundles')
  .then(response => response.text())
  .then((data) => {
    console.log(data)
  })
}



function test() {
	// let q = glMatrix.quat.create();
	// glMatrix.quat.identity(q);
	// console.log(glMatrix.quat.str(q));
	// console.log(q);
	// console.log(glMatrix.glMatrix.toRadian(180.0));

	// let cam = new Camera(50);
	// console.log(cam.rotation);

	// cam.orbit(30,0);
	// console.log(cam.rotation);

	// cam.panning(30,0);
	// console.log(cam.center);

	// let base = new BaseVisualization(0);
	// console.log(base);

	// let a = window.open("https://www.dropbox.com/s/gyxhsok6zh4u4ku/atlas.bundles?dl=0");
	// a = new XMLHttpRequest();
	// a.open("GET", "resources/atlas.bundlesdata");
	// a.responseType = 'arraybuffer';
	// a.onreadystatechange = function() {
	// 	if (a.readyState == 4) {
	// 		doSomething(a.mozResponseArrayBuffer || a.response);
	// 	}
	// }

	// a.send();
	// console.log(a);
}

// function doSomething(algo) {
// 	console.log(algo);
// }

// function importData() {
// 	let input = document.createElement('input');
// 	input.type = 'file';
// 	input.onchange = _ => {
// 	// you can use this method to get file and perform respective operations
// 			let files =   Array.from(input.files);
// 			console.log(files);
// 		};
// 	input.click();		
// }