function parsePythonDict(dictStr) {
	dictStr = dictStr.split("\n").join('');
	dictStr = dictStr.trim();

	if (!dictStr.startsWith("attributes = {")) {
		throw 'Not a python dict.';
	}

	let striped = dictStr.substring(14,dictStr.length-1);

	/// string \'[\s\w\*\.\*]*\'
	/// decimal number \d+
	/// list \[[\'\s\w\*\.,]*\]
	/// dict attributes\s*=\s*\{[\'\s\w\*\.,]*\}
	let attributes = striped.split(/\s*(\'[\s\w\*\.]*\'|\d+|\[[\'\s\w\*\.,]*\])\s*:\s*(\'[\s\w\*\.]*\'|\d+|\[[\'\s\w\*\.,]*\])\s*,*/); 

	for (let i=attributes.length-1; i>=0;i--) {
		if (attributes[i].length == 0) {
			attributes.splice(i,1);
		}
	}

	let pythonDict = {};

	for (let i=0; i<attributes.length; i+=2) {
		pythonDict[parsePythonData(attributes[i])] = parsePythonData(attributes[i+1]);
	}

	return pythonDict;
}

function parsePythonData(rawData) {
	rawData = rawData.trim();

	if (rawData.startsWith("[") && rawData.endsWith("]")) {
		let arr = [];
		for (const elem of rawData.substring(2,rawData.length-2).split(',')) {
			let data = parsePythonData(elem);
			arr.push(data);
		}

		return arr;
	} else if (rawData.startsWith("\'") && rawData.endsWith("\'")) {
		return rawData.substring(1,rawData.length-1);
	} else if (rawData.includes('.')) {
		return parseFloat(rawData);
	} else {
		return parseInt(rawData);
	}
}

async function loadFile(filePath, asType){
	return fetch(filePath)
		.then(response => { return response[asType](); });
}

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
	var i = 0;
	while (currentChild) {
		i += 1;
		if (currentChild.nodeType == 3) { // 3 corresponds to TEXT_NODE
			shaderSource += currentChild.textContent;
		}
		currentChild = currentChild.nextSibling;
	}

	var shader;
	if (shaderScript.type == "x-shader/x-vertex") {
		shader = gl.createShader(gl.VERTEX_SHADER);
	}
	else if (shaderScript.type == "x-shader/x-fragment") {
		shader = gl.createShader(gl.FRAGMENT_SHADER);
	}
	else {
		return null;
	}

	gl.shaderSource(shader, shaderSource);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert("Error compiling shader" + gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}
	return shader;
}

// returned 
function groupFiles(files) {
	groupedFiles = [];

	for (const f of files) {
		if (f.name.endsWith("bundles")) {
			let idx = groupedFiles.findIndex( element => element[1][1] != undefined && element[1][1].name.endsWith(f.name+"data"));

			if (idx >= 0) {
				groupedFiles[idx][1][0] = f;
			} else {
				groupedFiles.push(["bundles", [f, undefined]]);
			}

		} else if (f.name.endsWith("bundlesdata")) {
			let idx = groupedFiles.findIndex( element => element[1][0] != undefined && f.name.endsWith(element[1][0].name+"data"));

			if (idx >= 0) {
				groupedFiles[idx][1][1] = f;
			} else {
				groupedFiles.push(["bundles", [undefined, f]]);
			}
		} else {
			let extension = f.name.substring(f.name.lastIndexOf('.')+1);

			groupedFiles.push([extension, [f]]);
		}
	}

	return groupedFiles;
}

function parseTrkHeader(charArray) {
	let ucharView = new Uint8Array(charArray,0,1000);
	let ushortView = new Uint16Array(charArray,0,1000/2);
	let trkHeader = {};
	trkHeader.id_string = String.fromCharCode.apply(null, ucharView.subarray(0,6));
	trkHeader.dim = new Int16Array(charArray.slice(6,12));
	trkHeader.voxel_size = new Float32Array(charArray.slice(12,24));
	trkHeader.origin = new Float32Array(charArray.slice(24,36));
	trkHeader.n_scalars = ushortView[36/2];
	trkHeader.scalar_name = new Array(10);
	for (let i=0; i<10; i++) { trkHeader.scalar_name[i] = String.fromCharCode.apply(null, charArray.slice(38+i*20, 38+(i+1)*20)); }
	trkHeader.n_properties = ushortView[238/2];
	trkHeader.property_name = new Array(10);
	for (let i=0; i<10; i++) { trkHeader.property_name[i] = String.fromCharCode.apply(null, charArray.slice(240+i*20, 240+(i+1)*20)); }
	trkHeader.vox_to_ras = new Float32Array(charArray.slice(440,504)); // column or row major order???
	trkHeader.reserved = charArray.slice(504,948);
	trkHeader.voxel_order = new Int8Array(charArray.slice(948,952));
	trkHeader.pad2= new Int8Array(charArray.slice(952,956));
	trkHeader.image_orientation_patient = new Float32Array(charArray.slice(956,980));
	trkHeader.pad1 = new Int8Array(charArray.slice(980,982));
	trkHeader.invert_x = ucharView[982];
	trkHeader.invert_y = ucharView[983];
	trkHeader.invert_z = ucharView[984];
	trkHeader.swap_xy = ucharView[985];
	trkHeader.swap_yz = ucharView[986];
	trkHeader.swap_zx = ucharView[987];
	let lastInt = new Int32Array(charArray,988,3);
	trkHeader.n_count = lastInt[0];
	trkHeader.version = lastInt[1];
	trkHeader.hdr_size = lastInt[2];

	return trkHeader;
}