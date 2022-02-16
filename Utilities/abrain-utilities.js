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