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
			aBrainGL.contextType = names[i];
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

			// Get class to access static material values
			let type = visualizationTypes.find(element => element.name == visClass);

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
	aBrainGL.requestAnimId = requestAnimFrame(draw,canvas);

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

	glMatrix.mat4.perspective(aBrainGL.projMat, aBrainGL.fov, gl.viewportWidth/gl.viewportHeight, 0.01, 1000.0);
	configPerspective();
}


function startup() {
	// Visualization obj list
	aBrainGL.visualizationObjects = [];

	// Gl context and lib
	canvas = document.getElementById("myGLCanvas");
	// canvas = WebGLDebugUtils.makeLostContextSimulatingCanvas(canvas);
	canvas.width = window.innerWidth-20;
	canvas.height = window.innerHeight-20;

	gl = createGLContext(canvas);
	// gl = WebGLDebugUtils.makeDebugContext(createGLContext(canvas));

	// Preparing all shaders
	aBrainGL.shaderKeyMap = setupShaders();

	setupLightOnShaders();
	setupViewMat();

	// Perspective Matrix
	aBrainGL.FOV_DEFAULT = glMatrix.glMatrix.toRadian(45.0);
	aBrainGL.FOV_FLOOR_LIMITER = glMatrix.glMatrix.toRadian(1.0);
	aBrainGL.FOV_CEIL_LIMITER = glMatrix.glMatrix.toRadian(160.0);
	aBrainGL.fov = aBrainGL.FOV_DEFAULT;
	aBrainGL.projMat = glMatrix.mat4.create();
	aBrainGL.csProjMat = glMatrix.mat4.create();
	glMatrix.mat4.perspective(aBrainGL.projMat, aBrainGL.fov, gl.viewportWidth/gl.viewportHeight, 0.01, 1000.0);
	glMatrix.mat4.perspective(aBrainGL.csProjMat, glMatrix.glMatrix.toRadian(45.0), 1, 0.01, 10.0);

	configPerspective();

	// Coordinate system
	aBrainGL.coordSystem = new CoordinateSystem(aBrainGL.csShader);

	// Default visualization obj
	aBrainGL.defaultFile = "resources/atlas.bundles";
	aBrainGL.visualizationObjects.push(new Bundle(0, aBrainGL.shaderKeyMap, aBrainGL.defaultFile));

	// aBrainGL.defaultFile = "resources/001_SWM_Left_segmentation.bundles";
	// aBrainGL.visualizationObjects.push(new Bundle(0, aBrainGL.shaderKeyMap, aBrainGL.defaultFile));
		
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

	// Zoom with mouse
	canvas.addEventListener('wheel', handleWheel, false);

	// Pointers
	aBrainGL.activePointers = [];
	document.addEventListener('pointermove', handlePointerMove, false);
	document.addEventListener('pointerdown', handlePointerDown, false);
	document.addEventListener('pointerup', handlePointerUp, false);	
	document.addEventListener("pointercancel", handlePointerCancel, false);
}

function handleContextLost(event) {
	event.preventDefault();

	cancelAnimFrame(aBrainGL.requestAnimId);
}

function handleContextRestored(event) {
	// Recompiling shaders
	aBrainGL.shaderKeyMap = setupShaders();

	// Fixing light and view
	setupLightOnShaders();
	setupViewMat();

	// Loading projection matrix
	configPerspective();

	// Resetting
	gl.enable(gl.DEPTH_TEST);
	gl.clearColor(backgroundColor[0],backgroundColor[1],backgroundColor[2],backgroundColor[3]);

	// Fixing coordinate system gl data
	aBrainGL.coordSystem.updateReferenceToShader(aBrainGL.csShader);
	aBrainGL.coordSystem.cleanOpenGL();
	aBrainGL.coordSystem.loadOpenGLData();

	// Recreating all data lost from GPU
	for (const obj of aBrainGL.visualizationObjects) {
		obj.updateReferenceToShader(aBrainGL.shaderKeyMap);
		obj.cleanOpenGL();
		obj.loadOpenGLData();
	}

	// Ready to draw again
	aBrainGL.requestAnimId = requestAnimFrame(draw,canvas);
}

function handleKeyDown(event) {

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

		// case 55:
		// 	canvas.loseContext();
		// 	break;

		default:
			break;
	}
}

function handleKeyUp(event) {
}

function handleWheel(event) {
	let deltaFov = canvas.height*0.1;

	if (event.wheelDeltaY > 0) {
		deltaFov *= -1;
	}

	aBrainGL.fov = (2 * Math.atan(Math.tan(aBrainGL.fov/2) * (deltaFov / canvas.height + 1)));

	if (aBrainGL.fov < aBrainGL.FOV_FLOOR_LIMITER) { aBrainGL.fov = aBrainGL.FOV_FLOOR_LIMITER; }
	else if (aBrainGL.fov > aBrainGL.FOV_CEIL_LIMITER) { aBrainGL.fov = aBrainGL.FOV_CEIL_LIMITER; }

	glMatrix.mat4.perspective(aBrainGL.projMat, aBrainGL.fov, gl.viewportWidth/gl.viewportHeight, 0.01, 1000.0);

	configPerspective();
}

function handlePointerMove(event) {
	if (event.pointerType == "mouse") {
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
	} else if (event.pointerType == "touch") {
		let idx = aBrainGL.activePointers.findIndex((element) => element.identifier == event.pointerId);

		if (idx >= 0) {
			let pointerCount = aBrainGL.activePointers.length;

			// orbit (1 finger)
			if (pointerCount == 1) {
				let deltaX = event.clientX - aBrainGL.activePointers[idx].clientX;
				let deltaY = event.clientY - aBrainGL.activePointers[idx].clientY;

				if (deltaX == 0 && deltaY == 0) { return; }

				camera.orbit(deltaX,deltaY);
				csCamera.orbit(deltaX,deltaY);

			// zooming, rotating and panning (2 fingers)
			} else if (pointerCount == 2) {
				if (aBrainGL.activePointers[idx].clientX == event.clientX && aBrainGL.activePointers[idx].clientY == event.clientY) { return; }

				let newPointers = new Array(2);
				newPointers[idx] = {clientX : event.clientX, clientY : event.clientY};
				newPointers[1-idx] = {clientX : aBrainGL.activePointers[1-idx].clientX, clientY : aBrainGL.activePointers[1-idx].clientY};

				let initTanX = (aBrainGL.activePointers[1].clientX-aBrainGL.activePointers[0].clientX);
				let initTanY = (aBrainGL.activePointers[1].clientY-aBrainGL.activePointers[0].clientY);
				let endTanX = (newPointers[1].clientX-newPointers[0].clientX);
				let endTanY = (newPointers[1].clientY-newPointers[0].clientY);

				let initAngle = (180/Math.PI) * Math.atan(initTanY/initTanX);
				let endAngle = (180/Math.PI) * Math.atan(endTanY/endTanX);

				// homogenize quadrant
				if (initTanX < 0) { initAngle += 180; }
				if (endTanX < 0) { endAngle += 180; }

				let deltaAngle = endAngle - initAngle;

				let r = camera.radius;

				let avrXPrev = (aBrainGL.activePointers[0].clientX+aBrainGL.activePointers[1].clientX)/2;
				let avrXNext = (newPointers[0].clientX+newPointers[1].clientX)/2;
				let avrYPrev = (aBrainGL.activePointers[0].clientY+aBrainGL.activePointers[1].clientY)/2;
				let avrYNext = (newPointers[0].clientY+newPointers[1].clientY)/2;

				let deltaPanningX_toCenter = (canvas.width - 2*avrXPrev-avrXNext+avrXPrev)/canvas.height*r*Math.tan(aBrainGL.fov/2);
				let deltaPanningY_toCenter = (canvas.height- 2*avrYPrev-avrYNext+avrYPrev)/canvas.height*r*Math.tan(aBrainGL.fov/2);

				let deltaPanningX_toEnd = (2*avrXNext-canvas.width+avrXNext-avrXPrev)/canvas.height*r*Math.tan(aBrainGL.fov/2);
				let deltaPanningY_toEnd = (2*avrYNext-canvas.height+avrYNext-avrYPrev)/canvas.height*r*Math.tan(aBrainGL.fov/2);

				let deltaFov = Math.sqrt(initTanX*initTanX + initTanY*initTanY) - Math.sqrt(endTanX*endTanX + endTanY*endTanY);

				camera.pan(deltaPanningX_toCenter, deltaPanningY_toCenter);
				camera.transverseRotation(deltaAngle);

				aBrainGL.fov = (2 * Math.atan(Math.tan(aBrainGL.fov/2) * (deltaFov / canvas.height + 1)));


				if (aBrainGL.fov < aBrainGL.FOV_FLOOR_LIMITER) { aBrainGL.fov = aBrainGL.FOV_FLOOR_LIMITER; }
				else if (aBrainGL.fov > aBrainGL.FOV_CEIL_LIMITER) { aBrainGL.fov = aBrainGL.FOV_CEIL_LIMITER; }

				glMatrix.mat4.perspective(aBrainGL.projMat, aBrainGL.fov, gl.viewportWidth/gl.viewportHeight, 0.01, 1000.0);
				camera.pan(deltaPanningX_toEnd, deltaPanningY_toEnd);
				csCamera.transverseRotation(deltaAngle);

				configPerspective();

			// panning (3 or more fingers)
			} else {
				let deltaX = (event.clientX - aBrainGL.activePointers[idx].clientX) / pointerCount;
				let deltaY = (event.clientY - aBrainGL.activePointers[idx].clientY) / pointerCount;

				camera.pan(deltaX,deltaY);
			}

			aBrainGL.activePointers[idx].clientX = event.clientX;
			aBrainGL.activePointers[idx].clientY = event.clientY;
			setupViewMat();
		} else {
			console.log("can't figure out which touch to continue: idx = " + idx);

		}
	}
}

function handlePointerDown(event) {
	if (event.pointerType == "mouse") {
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
	} else if (event.pointerType == "touch") {
		aBrainGL.activePointers.push(getTouchData(event));
	}
}

function handlePointerUp(event) {
	if (event.pointerType == "mouse") {
		if (event.button == 0) {
			aBrainGL.orbit = false;
		} else if (event.button == 1) {
			aBrainGL.pan = false;
		} else { return; }
	} else if (event.pointerType == "touch") {
		let idx = aBrainGL.activePointers.findIndex((element) => element.identifier == event.pointerId);

		if (idx >= 0) {
			aBrainGL.activePointers.splice(idx,1);
		} else {
			console.log("can't figure out which touch to end: idx = " + idx);
		}
	}
}

function handlePointerCancel(event) {
	let idx = aBrainGL.activePointers.findIndex((element) => element.identifier == event.pointerId);

	if (idx >= 0) {
		aBrainGL.activePointers.splice(idx,1);
	} else {
		console.log("can't figure out which touch to end: idx = " + idx);
	}
}

function getTouchData(pointerEvent) {
  return { 	identifier: pointerEvent.pointerId, 
  			clientX: pointerEvent.clientX, 
  			clientY: pointerEvent.clientY };
}