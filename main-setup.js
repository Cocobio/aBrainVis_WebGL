/*
	aBrainGL.sampleFiles => contains the path to files provided on the server. Each element must follow
							the convention of: element = [Class, "path"], for the proper Class constructor
							to be called. This will allow the use of more types of sample files (not just
							Bundles classes).

	Creator: Ignacio Osorio
*/

let visualizationTypes = [Bundle, BoundingBox];

let gl;
let canvas;
let aBrainGL = {};

// gl Parameters
let backgroundColor = [0.2,0.2,0.2,1.0];
let lightPosition = glMatrix.vec4.fromValues(0.0, 100.0, 0.0, 1.0);
let lightValues = glMatrix.vec4.fromValues(0.5, 0.6, 1.0);

// Cameras for obj and cordinate system
let camera = new Camera(550.0);
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
		aBrainGL.viewportWidth = canvas.width;
		aBrainGL.viewportHeight = canvas.height;
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

function setupShadersOnClasses() {
	for (const visClass of visualizationTypes) {
		visClass.setupReferenceToShader(aBrainGL.shaderKeyMap);
	}
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
	gl.viewport(0, 0, aBrainGL.viewportWidth, aBrainGL.viewportHeight);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	for (const obj of aBrainGL.visualizationObjects) {
		obj.drawSolid();
	}

	// Draw coordinate system
	gl.clear(gl.DEPTH_BUFFER_BIT);
	gl.viewport(0,0,aBrainGL.csViewport,aBrainGL.csViewport);

	aBrainGL.coordSystem.drawSolid();
}

// function resizeCanvasToDisplaySize() {
// 	let width = gl.canvas.clientWidth;
// 	let height = gl.canvas.clientHeight;
	
// 	if (gl.canvas.width != width || gl.canvas.height != height) {
// 		gl.canvas.width = width;
// 		gl.canvas.height = height;

// 		let smaller = aBrainGL.viewportWidth;
// 		if (smaller > aBrainGL.viewportHeight) { smaller = aBrainGL.viewportHeight; }

// 		aBrainGL.csViewport = smaller*aBrainGL.csFactor;

// 		let aspect = canvas.clientWidth / canvas.clientHeight;

// 		glMatrix.mat4.perspective(aBrainGL.projMat, aBrainGL.fov, aspect, 0.01, 1000.0);
// 		configPerspective();
// 	}
// }

function resize() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	aBrainGL.viewportWidth = canvas.width;
	aBrainGL.viewportHeight = canvas.height;

	let smaller = aBrainGL.viewportWidth;
	if (smaller > aBrainGL.viewportHeight) { smaller = aBrainGL.viewportHeight; }

	aBrainGL.csViewport = smaller*aBrainGL.csFactor;

	glMatrix.mat4.perspective(aBrainGL.projMat, aBrainGL.fov, aBrainGL.viewportWidth/aBrainGL.viewportHeight, 0.01, 1000.0);
	configPerspective();
}


function startup() {
	// Visualization obj list
	aBrainGL.visualizationObjects = [];

	// Stretch viewport to device's real size
	stretchViewport();

	// Gl context and lib
	canvas = document.getElementById("myGLCanvas");
	// canvas = WebGLDebugUtils.makeLostContextSimulatingCanvas(canvas);
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	gl = createGLContext(canvas);
	// gl = WebGLDebugUtils.makeDebugContext(createGLContext(canvas));

	// Alert user if its not running on WebGL 2.0
	if (aBrainGL.contextType != 'webgl2') {
		alert("Browser or device not compatible with WebGL 2.0. Currently running on WebGL1 ("+aBrainGL.contextType+").");
		gl.getExtension('OES_element_index_uint');
		gl.getExtension('OES_texture_float');
	}

	// Preparing all shaders
	aBrainGL.shaderKeyMap = setupShaders();
	setupShadersOnClasses();

	setupLightOnShaders();
	setupViewMat();

	// Perspective Matrix
	aBrainGL.csFactor = 0.2;
	aBrainGL.csViewport = aBrainGL.viewportWidth < aBrainGL.viewportHeight ? aBrainGL.viewportWidth : aBrainGL.viewportHeight;
	aBrainGL.csViewport *= aBrainGL.csFactor;

	aBrainGL.FOV_DEFAULT = glMatrix.glMatrix.toRadian(45.0);
	aBrainGL.FOV_FLOOR_LIMITER = glMatrix.glMatrix.toRadian(1.0);
	aBrainGL.FOV_CEIL_LIMITER = glMatrix.glMatrix.toRadian(160.0);
	aBrainGL.VIEWPORT_FOV_SCALER = 0.02;
	aBrainGL.fov = aBrainGL.FOV_DEFAULT;
	aBrainGL.projMat = glMatrix.mat4.create();
	aBrainGL.csProjMat = glMatrix.mat4.create();
	glMatrix.mat4.perspective(aBrainGL.projMat, aBrainGL.fov, aBrainGL.viewportWidth/aBrainGL.viewportHeight, 0.01, 1000.0);
	glMatrix.mat4.perspective(aBrainGL.csProjMat, glMatrix.glMatrix.toRadian(45.0), 1, 0.01, 10.0);

	configPerspective();

	// Coordinate system
	aBrainGL.coordSystem = new CoordinateSystem(aBrainGL.csShader);

	// Default visualization obj
	aBrainGL.id = 0;
	aBrainGL.sampleFiles = [[Bundle,"resources/atlas.bundles"], [Bundle,"resources/AtlasMG.bundles"], [Bundle,"resources/AtlasRO.bundles"], [Bundle,"resources/SWMatlasCR2017.bundles"]];//, [Bundle,"resources/001_SWM_Left_segmentation.bundles"]];
	loadSampleFile(0);

	// Set sampleFile list on combo box
	let select = document.getElementById('SampleFiles');
	for (let i=0; i<aBrainGL.sampleFiles.length; i++) {
		let file = aBrainGL.sampleFiles[i][1];
		let opt = document.createElement('option');
		opt.value = i;
		opt.innerHTML = file.substring(file.lastIndexOf("/"),file.lastIndexOf("."));
		select.appendChild(opt);
	}
	
	// WebGL configurations for depth and background
	gl.enable(gl.DEPTH_TEST);
	gl.clearColor(backgroundColor[0],backgroundColor[1],backgroundColor[2],backgroundColor[3]);

	// aBrainGL basic mouse setup
	aBrainGL.mouse = { clientX : 0, clientY : 0 };
	aBrainGL.orbitSpeed = 2.5;
	aBrainGL.orbit = false;
	aBrainGL.pan = false;

	// BoundingBox option
	aBrainGL.drawBB = true;

	// Listeners
	setupListeners();

	// Draw call
	draw();
}

function stretchViewport() {
	let width = document.documentElement.clientWidth * window.devicePixelRatio;
	viewport = document.querySelector("meta[name=viewport]");
	viewport.setAttribute('content', 'width=' + width);

	document.documentElement.style.transform = 'scale( 1 / window.devicePixelRatio )';
	document.documentElement.style.transformOrigin = 'top left';
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

	// Buttons
	document.getElementById("toggleFS").addEventListener("click", handleToggleFullScreen, false);
	document.getElementById("addFile").addEventListener("change", handleAddFile, false);
	document.getElementById("deleteAll").addEventListener("click", handleDeleteAll, false);
	document.getElementById("randomColors").addEventListener("click", handleShuffleAllColors, false);

	// Set valid extensions for files
	let validExtensions = ""
	for (const visClass of visualizationTypes) {
		let extensions = visClass.validFileExtension;
		if (extensions != undefined) {
			for (const ext of extensions.keys()) {
				validExtensions += "."+ext+", "
			}
		}
	}
	document.getElementById("addFile").accept = validExtensions;

	// Toggle bounding boxes
	document.getElementById("toggleBB").addEventListener("change", handleToggleBB, false);
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
	CoordinateSystem.setupReferenceToShader(aBrainGL.csShader);
	aBrainGL.coordSystem.cleanOpenGL();
	aBrainGL.coordSystem.loadOpenGLData();

	// Recreating all data lost from GPU
	for (const visClass of visualizationTypes) { visClass.setupReferenceToShader(aBrainGL.shaderKeyMap);}
	for (const obj of aBrainGL.visualizationObjects) {
		obj.cleanOpenGL();
		obj.loadOpenGLData();
	}

	// Ready to draw again
	aBrainGL.requestAnimId = requestAnimFrame(draw,canvas);
}

function handleKeyDown(event) {

	switch(event.keyCode) {
		case 37: // left arrow
			camera.orbit(2*Math.PI/180,[0,1,0]);
			csCamera.orbit(2*Math.PI/180,[0,1,0]);
			setupViewMat();
			break;

		case 38: // up arrow
			camera.orbit(2*Math.PI/180,[1,0,0]);
			csCamera.orbit(2*Math.PI/180,[1,0,0]);
			setupViewMat();
			break;

		case 39: // right arrow
			camera.orbit(-2*Math.PI/180,[0,1,0]);
			csCamera.orbit(-2*Math.PI/180,[0,1,0]);
			setupViewMat();
			break;

		case 40: // down arrow
			camera.orbit(-2*Math.PI/180,[1,0,0]);
			csCamera.orbit(-2*Math.PI/180,[1,0,0]);
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

		// For testing lose of context
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
	let deltaFov = aBrainGL.viewportHeight*aBrainGL.VIEWPORT_FOV_SCALER;

	if (event.wheelDeltaY > 0) {
		deltaFov *= -1;
	}

	aBrainGL.fov = (2 * Math.atan(Math.tan(aBrainGL.fov/2) * (deltaFov / aBrainGL.viewportHeight + 1)));

	if (aBrainGL.fov < aBrainGL.FOV_FLOOR_LIMITER) { aBrainGL.fov = aBrainGL.FOV_FLOOR_LIMITER; }
	else if (aBrainGL.fov > aBrainGL.FOV_CEIL_LIMITER) { aBrainGL.fov = aBrainGL.FOV_CEIL_LIMITER; }

	glMatrix.mat4.perspective(aBrainGL.projMat, aBrainGL.fov, aBrainGL.viewportWidth/aBrainGL.viewportHeight, 0.01, 1000.0);

	configPerspective();
}

function handlePointerMove(event) {
	let idx;
	let clientX, clientY;
	let pointerCount = aBrainGL.activePointers.length;
	let panAvr;

	if (event.pointerType == "mouse") {
		clientX = aBrainGL.mouse.clientX;
		clientY = aBrainGL.mouse.clientY;

		aBrainGL.mouse.clientX = event.clientX;
		aBrainGL.mouse.clientY = event.clientY;

		panAvr = 1;

	} else if (event.pointerType == "touch") {
		idx = aBrainGL.activePointers.findIndex((element) => element.identifier == event.pointerId);

		if (idx < 0) {
			console.log("can't figure out which touch to continue: idx = " + idx);
			return;
		}

		clientX = aBrainGL.activePointers[idx].clientX;
		clientY = aBrainGL.activePointers[idx].clientY;

		panAvr = pointerCount;

	} else {
		alert("Unrecognized pointerType: "+event.pointerType);
		return;
	}
	

	if (aBrainGL.orbit || pointerCount == 1) {
		let r = camera.radius;
		let y_offset = document.getElementById("head").clientHeight;

		let x1 = (2*clientX - aBrainGL.viewportWidth)/aBrainGL.viewportHeight*r*Math.tan(aBrainGL.fov/2);
		let x2 = (2*event.clientX - aBrainGL.viewportWidth)/aBrainGL.viewportHeight*r*Math.tan(aBrainGL.fov/2);

		let y1 = (aBrainGL.viewportHeight + y_offset - 2*clientY)/aBrainGL.viewportHeight*r*Math.tan(aBrainGL.fov/2);
		let y2 = (aBrainGL.viewportHeight + y_offset - 2*event.clientY)/aBrainGL.viewportHeight*r*Math.tan(aBrainGL.fov/2);

		let screen1 = glMatrix.vec3.fromValues(x1,y1,r);
		let screen2 = glMatrix.vec3.fromValues(x2,y2,r);
			
		let p1 = glMatrix.vec3.create();
		let p2 = glMatrix.vec3.create();
		glMatrix.vec3.subtract(p1,screen1,camera.center);
		glMatrix.vec3.subtract(p2,screen2,camera.center);

		glMatrix.vec3.normalize(p1,p1);
		glMatrix.vec3.normalize(p2,p2);

		let rad = glMatrix.vec3.dot(p1,p2);
		if (rad > 1) { rad = 0.99999999999; }

		let angle = Math.acos(rad)*aBrainGL.orbitSpeed;
		let axis = glMatrix.vec3.create();
		glMatrix.vec3.cross(axis,p2,p1);
		glMatrix.vec3.normalize(axis,axis);

		if (isNaN(angle)) { return; }
		camera.orbit(angle,axis);
		csCamera.orbit(angle,axis);

	} else if (aBrainGL.pan || pointerCount > 2) {
		let r = camera.radius;

		let panX = (event.clientX - clientX)/aBrainGL.viewportHeight*2*r*Math.tan(aBrainGL.fov/2)/panAvr;
		let panY = (event.clientY - clientY)/aBrainGL.viewportHeight*2*r*Math.tan(aBrainGL.fov/2)/panAvr;

		camera.pan(panX,panY);

	} else if (pointerCount == 2) {
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

		let deltaPanningX_toCenter = (aBrainGL.viewportWidth - avrXPrev-avrXNext)/aBrainGL.viewportHeight*r*Math.tan(aBrainGL.fov/2);
		let deltaPanningY_toCenter = (aBrainGL.viewportHeight- avrYPrev-avrYNext)/aBrainGL.viewportHeight*r*Math.tan(aBrainGL.fov/2);

		let deltaPanningX_toEnd = (-aBrainGL.viewportWidth-avrXPrev + 3*avrXNext)/aBrainGL.viewportHeight*r*Math.tan(aBrainGL.fov/2);
		let deltaPanningY_toEnd = (-aBrainGL.viewportHeight-avrYPrev+ 3*avrYNext)/aBrainGL.viewportHeight*r*Math.tan(aBrainGL.fov/2);

		let deltaFov = Math.sqrt(initTanX*initTanX + initTanY*initTanY) - Math.sqrt(endTanX*endTanX + endTanY*endTanY);

		camera.pan(deltaPanningX_toCenter, deltaPanningY_toCenter);
		camera.transverseRotation(deltaAngle);

		aBrainGL.fov = (2 * Math.atan(Math.tan(aBrainGL.fov/2) * (deltaFov / aBrainGL.viewportHeight + 1)));


		if (aBrainGL.fov < aBrainGL.FOV_FLOOR_LIMITER) { aBrainGL.fov = aBrainGL.FOV_FLOOR_LIMITER; }
		else if (aBrainGL.fov > aBrainGL.FOV_CEIL_LIMITER) { aBrainGL.fov = aBrainGL.FOV_CEIL_LIMITER; }

		glMatrix.mat4.perspective(aBrainGL.projMat, aBrainGL.fov, aBrainGL.viewportWidth/aBrainGL.viewportHeight, 0.01, 1000.0);
		camera.pan(deltaPanningX_toEnd, deltaPanningY_toEnd);
		csCamera.transverseRotation(deltaAngle);

		configPerspective();

	} else { return; }

	if (pointerCount > 0) {
		aBrainGL.activePointers[idx].clientX = event.clientX;
		aBrainGL.activePointers[idx].clientY = event.clientY;
	}
	
	setupViewMat();
}

function handlePointerDown(event) {
	if (event.pointerType == "mouse") {
		if (event.button == 0) {
			aBrainGL.orbit = true;
			aBrainGL.pan = false;
		} else if (event.button == 1 || event.button == 2) {
			aBrainGL.orbit = false;
			aBrainGL.pan = true;
		} else { 
			aBrainGL.orbit = false;
			aBrainGL.pan = false;

			return;
		}

		aBrainGL.mouse.clientX = event.clientX;
		aBrainGL.mouse.clientY = event.clientY;
	} else if (event.pointerType == "touch") {
		aBrainGL.activePointers.push(getTouchData(event));
	}
}

function handlePointerUp(event) {
	if (event.pointerType == "mouse") {
		if (event.button == 0) {
			aBrainGL.orbit = false;
		} else if (event.button == 1 || event.button == 2) {
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
				clientX: 	pointerEvent.clientX, 
				clientY: 	pointerEvent.clientY };
}

async function handleToggleFullScreen() {
	let doc = window.document;
	let docEl = doc.documentElement;

	let requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
	let cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

	if(!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
		requestFullScreen.call(docEl);//.then(() => console.log(window.innerWidth, window.innerHeight) );
	}
	else {
		cancelFullScreen.call(doc);//.then(() => console.log(window.innerWidth, window.innerHeight) );
	}
	// console.log(canvas.width+"\t\t"+canvas.height);
}

function handleAddFile(event) {
	const files = addFile.files;

	if (files) {
		let groupedFiles = groupFiles(files);
		let missingFiles = [];

		for (const fileData of groupedFiles) {
			if (fileData[1].findIndex( element => element==undefined) >= 0) {
				let idx = fileData[1].findIndex( element => element!=undefined);
				missingFiles.push(fileData[1][idx]);
			} else if (fileData[0] == 'json') {
				let metadataName = fileData[1][0].name.replace(/\.[^/.]+$/, "")

				for (const visObj of aBrainGL.visualizationObjects)
					if (visObj.fileName == metadataName) {
						if (visObj._vbo.length == 0)	// not loaded yet, needs to read file first, then read metadata
							visObj.finishingTouchesCallback = () => visObj.loadMetaData(URL.createObjectURL(fileData[1][0]));
						else 							// object loaded, ready to load metadata
							visObj.loadMetaData(URL.createObjectURL(fileData[1][0]));

					}
				console.log("Loading metadata");
			} else {
				//search loader
				let urls = fileData[1].map(element => URL.createObjectURL(element));
				let loaders = visualizationTypes.filter(element => element.validFileExtension != undefined && element.validFileExtension.has(fileData[0]));
				let visObj;

				if (loaders.length == 1) { visObj = loaders[0]; }
				else { alert("Multiple classes can load file \'"+fileData[1][0]+"\'. Must select a class *** not implemented yet ***."); }

				let newVisObj = new visObj(aBrainGL.id++, [urls, fileData[1][0].name]);
				newVisObj.drawBB = aBrainGL.drawBB;
				aBrainGL.visualizationObjects.push(newVisObj);
				console.log("loading file");
			}
		}

		if (missingFiles.length != 0) {
			let missingFilesStr = "";
			for (let missingFile of missingFiles) {
				missingFilesStr += "\n" + missingFile.name; 
			}
			alert("Missing files for: " + missingFilesStr + "\nPlease reselect the files. Example: Bundle files consist of .bundles and .bundlesdata.");
		}
	}

	// Fixes problem when opening same file twice
	document.getElementById("addFile").value = null;
}

// Handler for BUTTON DELETE
function handleDeleteAll(event) {
	aBrainGL.visualizationObjects.length = 0;

	// Reset cameras
	camera.defaultValues();
	csCamera.defaultValues();

	aBrainGL.fov = aBrainGL.FOV_DEFAULT;
	glMatrix.mat4.perspective(aBrainGL.projMat, aBrainGL.fov, aBrainGL.viewportWidth/aBrainGL.viewportHeight, 0.01, 1000.0);


	setupViewMat();
	configPerspective();
	document.getElementById('SampleFiles').selectedIndex = 0;
}

function handleShuffleAllColors(event) {
	for (const visObj of aBrainGL.visualizationObjects) {
		if (visObj.shuffleColors != undefined) {
			visObj.shuffleColors();
		}
	}
}

// Handler for TOGGLE BB
function handleToggleBB(event) {
	aBrainGL.drawBB = document.getElementById("toggleBB").checked;

	for (const visObj of aBrainGL.visualizationObjects) {
		visObj.drawBB = aBrainGL.drawBB;
	}
}

async function loadSampleFile(idx) {
	let sampleFile = aBrainGL.sampleFiles[idx][1];

	let i = aBrainGL.visualizationObjects.findIndex(element => element.filePath == sampleFile);

	// Only one instance for a sample file
	if (i != -1) {
		let metadata = sampleFile.substring(0,sampleFile.lastIndexOf(".")+1)+"json";
		let metadataExists = await checkFileExist(metadata);

		// If there is metadata for this file on the server update it to the sample file
		if (metadataExists)
			aBrainGL.visualizationObjects[i].loadMetaData(metadata);
	} else {
		let loader = aBrainGL.sampleFiles[idx][0];
		let metadata = sampleFile.substring(0,sampleFile.lastIndexOf(".")+1)+"json";
		let metadataExists = await checkFileExist(metadata);

		// Load file
		let newFile = new loader(aBrainGL.id++, sampleFile);
		aBrainGL.visualizationObjects.push(newFile);

		// If there is metadata for this file on the server
		if (metadataExists) {
			if (newFile._vbo.length == 0)	// not loaded yet, needs to read file first, then read metadata
				newFile.finishingTouchesCallback = () => newFile.loadMetaData(metadata);
			else 							// object loaded, ready to load metadata
				newFile.loadMetaData(metadata);
		}
	}

	// Leave combo box unselected
	document.getElementById('SampleFiles').selectedIndex = 0;
}