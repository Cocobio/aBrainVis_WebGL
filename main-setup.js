let visualizationTypes = [Bundle, BoundingBox];

let gl;
let canvas;
let aBrainGL = {};

// gl Parameters
let backgroundColor = [0.2,0.2,0.2,1.0];
let lightPosition = glMatrix.vec4.fromValues(0.0, 100.0, 0.0, 1.0);
let lightValues = glMatrix.vec4.fromValues(0.5, 0.6, 1.0);

// Cameras for obj and cordinate system
let camera = new Camera(350.0);
let csCamera = new Camera(1/Math.sin(22.5*Math.PI/180));

function setDefaultLightValue() {
	lightValues[0] = 0.5;
	lightValues[1] = 0.6;
	lightValues[2] = 1.0;
}

function setDefaultLightPosition() {
	lightPosition[0] = 0.0;
	lightPosition[1] = 100.0;
	lightPosition[2] = 0.0;
}

function setDefaultBackgroundColor() {
	backgroundColor[0] = 0.2;
	backgroundColor[1] = 0.2
	backgroundColor[2] = 0.2;
	backgroundColor[3] = 1.0;
}

function createGLContext(canvas) {
	let names = ["webgl2", "webgl", "experimental-webgl"];
	let context = null;
	for (let i=0; i<names.length; i++) {
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
	let shader = gl.createShader(type);
	gl.shaderSource(shader, shaderSource);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert("Error compiling shader" + gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}
	return shader;
}

function createShaderProgram(vertexShaderDOMid, fragmentShaderDOMid, geometryShaderDOMid) {
	let vertexShader = loadShaderFromDOM(vertexShaderDOMid);
	let fragmentShader = loadShaderFromDOM(fragmentShaderDOMid);

	shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);

	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		alert("Failed to setup shaders");
	}

	return shaderProgram;
}

function setupShaders() {
	let shaderMap = {};

	for (const visualizationClass of visualizationTypes) {
		shaderMap[visualizationClass.name] = visualizationClass.createProgram();
	}

	// Here in case of lost context
	aBrainGL.csShader = CoordinateSystem.createProgram();

	return shaderMap;
}

function setupLightOnShaders() {
	for (const [visClass, shaderList] of Object.entries(aBrainGL.shaderKeyMap)) {
		for (const shader of shaderList) {
			let lightPosLoc = gl.getUniformLocation(shader,"uLight.pos");

			if (lightPosLoc == null) { continue; }
			let lightLaLoc = gl.getUniformLocation(shader,"uLight.La");
			let lightLdLoc = gl.getUniformLocation(shader,"uLight.Ld");
			let lightLsLoc = gl.getUniformLocation(shader,"uLight.Ls");

			let materialKaLoc = gl.getUniformLocation(shader,"uMaterial.Ka");
			let materialKdLoc = gl.getUniformLocation(shader,"uMaterial.Kd");
			let materialKsLoc = gl.getUniformLocation(shader,"uMaterial.Ks");
			let materialShininessLoc = gl.getUniformLocation(shader,"uMaterial.shininess");

			gl.useProgram(shader);

			gl.uniform4fv(lightPosLoc, lightPosition);
			gl.uniform3f(lightLaLoc, lightValues[0], lightValues[0], lightValues[0]);
			gl.uniform3f(lightLdLoc, lightValues[1], lightValues[1], lightValues[1]);
			gl.uniform3f(lightLsLoc, lightValues[2], lightValues[2], lightValues[2]);

			let type = visualizationTypes[0];
			gl.uniform1f(materialKaLoc, type.materialKa);
			gl.uniform1f(materialKdLoc, type.materialKd);
			gl.uniform1f(materialKsLoc, type.materialKs);
			gl.uniform1f(materialShininessLoc, type.materialShininess);
		}
	}
}

function setupViewMat() {
	for (const [visClass, shaderList] of Object.entries(aBrainGL.shaderKeyMap)) {
		for (const shader of shaderList) {
			gl.useProgram(shader);

			let viewMatLoc = gl.getUniformLocation(shader, "uView");

			gl.uniformMatrix4fv(viewMatLoc, false, camera.viewMat);
		}
	}

	gl.useProgram(aBrainGL.csShader[0]);

	let = viewMatLoc = gl.getUniformLocation(aBrainGL.csShader[0], "uView");

	gl.uniformMatrix4fv(viewMatLoc, false, csCamera.viewMat);
}

function configPerspective() {
	for (const [visClass, shaderList] of Object.entries(aBrainGL.shaderKeyMap)) {
		for (const shader of shaderList) {
			gl.useProgram(shader);

			let projectionMatLoc = gl.getUniformLocation(shader, "uProj");
			gl.uniformMatrix4fv(projectionMatLoc, false, aBrainGL.projMat);
		}
	}

	gl.useProgram(aBrainGL.csShader[0])
	let projectionMatLoc = gl.getUniformLocation(aBrainGL.csShader[0], "uProj");
	gl.uniformMatrix4fv(projectionMatLoc, false, aBrainGL.csProjMat);
}

function draw(currentTime) {
	// Request new frame
	requestAnimFrame(draw);

	// Main draw (objects)
	gl.viewport(0,0,gl.viewportWidth, gl.viewportHeight);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	for (const obj of aBrainGL.visualizationObjects) {
		obj.drawSolid();
	}

	// Draw coordinate system
	gl.clear(gl.DEPTH_BUFFER_BIT);
	gl.viewport(0,0,150,150);

	aBrainGL.coordSystem.drawSolid();
}


function resize() {
	canvas.width = window.innerWidth-20;
	canvas.height = window.innerHeight-20;

	gl.viewportWidth = canvas.width;
	gl.viewportHeight = canvas.height;

	glMatrix.mat4.perspective(aBrainGL.projMat, 45.0, gl.viewportWidth/gl.viewportHeight, 0.01, 10000.0);
	configPerspective();
}


function startup() {
	// Visualization obj list
	aBrainGL.visualizationObjects = [];

	// Gl context and lib
	canvas = document.getElementById("myGLCanvas");
	canvas.width = window.innerWidth-20;
	canvas.height = window.innerHeight-20;
	// gl = createGLContext(canvas);
	gl = WebGLDebugUtils.makeDebugContext(createGLContext(canvas));

	// Preparing all shaders
	aBrainGL.shaderKeyMap = setupShaders();

	setupLightOnShaders();
	setupViewMat();

	// Perspective Matrix
	aBrainGL.projMat = glMatrix.mat4.create();
	aBrainGL.csProjMat = glMatrix.mat4.create();
	glMatrix.mat4.perspective(aBrainGL.projMat, 45.0, canvas.width/canvas.height, 0.01, 10000.0);
	glMatrix.mat4.perspective(aBrainGL.csProjMat, 45.0, 1, 0.01, 100000.0);

	configPerspective();

	// Coordinate system
	aBrainGL.coordSystem = new CoordinateSystem(aBrainGL.csShader);

	// Default visualization obj
	aBrainGL.defaultFile = "resources/atlas.bundles";
	aBrainGL.visualizationObjects.push(new Bundle(0, aBrainGL.shaderKeyMap, aBrainGL.defaultFile));
		
	gl.enable(gl.DEPTH_TEST);
	gl.clearColor(backgroundColor[0],backgroundColor[1],backgroundColor[2],backgroundColor[3]);

	// aBrainGL basic mouse setup
	aBrainGL.mousePositionX = 0;
	aBrainGL.mousePositionY = 0;
	aBrainGL.orbit = false;
	aBrainGL.pan = false;

	// Listeners
	setupListeners();

	// setInterval(draw, 16.7);
	draw();
}

function setupListeners() {
	// Sizing
	window.addEventListener('resize', resize, false);

	// Robust
	canvas.addEventListener('webglcontextlost', handleContextLost, false);
	canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

	// Key
	document.addEventListener('keydown', handleKeyDown, false);
	document.addEventListener('keyup', handleKeyUp, false);

	// Mouse
	// document.addEventListener('mousemove', handleMouseMove, false);
	// document.addEventListener('mousedown', handleMouseDown, false);
	// document.addEventListener('mouseup', handleMouseUp, false);

	// Pointers
	document.addEventListener('pointermove', handlePointerMove, false);
	document.addEventListener('pointerdown', handlePointerDown, false);
	document.addEventListener('pointerup', handlePointerUp, false);	
}

function handleContextLost(event) {
	event.preventDefault();

	// cancelRequestAnimFrame();
	console.log("context lost");
}

function handleContextRestored(event) {
	// requestAnimFrame(draw);
	console.log("context restored");
}

function handleKeyDown(event) {
	// console.log(event.keyCode);

	switch(event.keyCode) {
		case 37: // left arrow
			camera.orbit(-2,0);
			csCamera.orbit(-2,0);
			setupViewMat();
			break;

		case 38: // up arrow
			camera.orbit(0,-2);
			csCamera.orbit(0,-2);
			setupViewMat();
			break;

		case 39: // right arrow
			camera.orbit(2,0);
			csCamera.orbit(2,0);
			setupViewMat();
			break;

		case 40: // down arrow
			camera.orbit(0,2);
			csCamera.orbit(0,2);
			setupViewMat();
			break;

		case 49: // 1
			camera.frontView();
			csCamera.frontView();
			setupViewMat();
			break;

		case 50: // 2
			camera.backView();
			csCamera.backView();
			setupViewMat();
			break;

		case 51: // 3
			camera.leftView();
			csCamera.leftView();
			setupViewMat();
			break;

		case 52: // 4
			camera.rightView();
			csCamera.rightView();
			setupViewMat();
			break;

		case 53: // 5
			camera.topView();
			csCamera.topView();
			setupViewMat();
			break;

		case 54: // 6
			camera.bottomView();
			csCamera.bottomView();
			setupViewMat();
			break;

		default:
			break;
	}
}

function handleKeyUp(event) {
	// console.log(event.keyCode);

}

// function handleMouseMove(event) {
// 	let deltaX = event.clientX - aBrainGL.mousePositionX;
// 	let deltaY = event.clientY - aBrainGL.mousePositionY;

// 	if (aBrainGL.orbit) {
// 		camera.orbit(deltaX,deltaY);
// 		csCamera.orbit(deltaX,deltaY);
// 	} else if (aBrainGL.pan) {
// 		camera.pan(deltaX,deltaY);
// 	} else {
// 		aBrainGL.orbit = false;
// 		aBrainGL.pan = false;

// 		return;
// 	}


// 	aBrainGL.mousePositionX = event.clientX;
// 	aBrainGL.mousePositionY = event.clientY;
// 	setupViewMat();
// }

// function handleMouseDown(event) {
// 	if (event.button == 0) {
// 		aBrainGL.orbit = true;
// 		aBrainGL.pan = false;
// 	} else if (event.button == 1) {
// 		aBrainGL.orbit = false;
// 		aBrainGL.pan = true;
// 	} else { 
// 		aBrainGL.orbit = false;
// 		aBrainGL.pan = false;

// 		return;
// 	}



// 	aBrainGL.mousePositionX = event.clientX;
// 	aBrainGL.mousePositionY = event.clientY;
// }

// function handleMouseUp(event) {
// 	if (event.button == 0) {
// 		aBrainGL.orbit = false;
// 	} else if (event.button == 1) {
// 		aBrainGL.pan = false;
// 	} else { return; }
// }





function handlePointerMove(event) {
	console.log("["+aBrainGL.mousePositionX+", "+aBrainGL.mousePositionY+"]");
	let deltaX = event.clientX - aBrainGL.mousePositionX;
	let deltaY = event.clientY - aBrainGL.mousePositionY;

	if (deltaX == 0 && deltaY == 0) { return; }

	if (aBrainGL.orbit) {
		camera.orbit(deltaX,deltaY);
		csCamera.orbit(deltaX,deltaY);
	} else if (aBrainGL.pan) {
		camera.pan(deltaX,deltaY);
	} else {
		aBrainGL.orbit = false;
		aBrainGL.pan = false;

		return;
	}


	aBrainGL.mousePositionX = event.clientX;
	aBrainGL.mousePositionY = event.clientY;
	setupViewMat();
}

function handlePointerDown(event) {
	console.log(event);
	if (event.button == 0) {
		aBrainGL.orbit = true;
		aBrainGL.pan = false;
	} else if (event.button == 1) {
		aBrainGL.orbit = false;
		aBrainGL.pan = true;
	} else { 
		aBrainGL.orbit = false;
		aBrainGL.pan = false;

		return;
	}



	aBrainGL.mousePositionX = event.clientX;
	aBrainGL.mousePositionY = event.clientY;

}

function handlePointerUp(event) {
	if (event.button == 0) {
		aBrainGL.orbit = false;
	} else if (event.button == 1) {
		aBrainGL.pan = false;
	} else { return; }
}